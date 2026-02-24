#!/usr/bin/env tsx
/**
 * HORA Dashboard — collect-data.ts
 * Lit les fichiers MEMORY de HORA et produit public/data.json.
 * Usage : npx tsx scripts/collect-data.ts
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionEntry {
  filename: string;
  name: string;
  date: string;
  sentiment: number;
  sid: string;
  messageCount: number;
}

interface SentimentEntry {
  sid: string;
  score: number;
  ts: string;
  trigger: string;
}

interface BackupState {
  lastBackup: string | null;
  strategy: string;
  commitCount: number;
}

interface DashboardData {
  generatedAt: string;
  profile: {
    identity: string;
    projects: string;
    preferences: string;
  };
  sessions: SessionEntry[];
  sentimentHistory: SentimentEntry[];
  backupState: BackupState | null;
  snapshotCount: number;
  toolUsage: Record<string, number>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CLAUDE_DIR = join(homedir(), ".claude");
const MEMORY_DIR = join(CLAUDE_DIR, "MEMORY");

function safeRead(path: string): string {
  try {
    if (!existsSync(path)) return "";
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

function safeReadLines(path: string): string[] {
  const content = safeRead(path);
  if (!content.trim()) return [];
  return content.split("\n").filter((l) => l.trim());
}

function parseJsonl<T>(path: string): T[] {
  const lines = safeReadLines(path);
  const results: T[] = [];
  for (const line of lines) {
    try {
      results.push(JSON.parse(line) as T);
    } catch {
      // skip malformed lines
    }
  }
  return results;
}

function safeParseJson<T>(path: string, fallback: T): T {
  try {
    const content = safeRead(path);
    if (!content.trim()) return fallback;
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

// ─── Profil ──────────────────────────────────────────────────────────────────

function collectProfile(): DashboardData["profile"] {
  const profileDir = join(MEMORY_DIR, "PROFILE");
  return {
    identity: safeRead(join(profileDir, "identity.md")),
    projects: safeRead(join(profileDir, "projects.md")),
    preferences: safeRead(join(profileDir, "preferences.md")),
  };
}

// ─── Sessions ────────────────────────────────────────────────────────────────

interface SessionNamesJson {
  sessions?: Record<string, { name?: string; sid?: string; date?: string }>;
}

interface SentimentLogEntry {
  sid?: string;
  score?: number;
  ts?: string;
  trigger?: string;
}

function collectSessions(sentimentMap: Map<string, number>): SessionEntry[] {
  const sessionsDir = join(MEMORY_DIR, "SESSIONS");
  const namesPath = join(MEMORY_DIR, "STATE", "session-names.json");

  // Charger le mapping SID → name
  const namesJson = safeParseJson<SessionNamesJson>(namesPath, {});
  const namesMap = new Map<string, { name?: string; date?: string }>();
  for (const [sid, info] of Object.entries(namesJson.sessions ?? {})) {
    namesMap.set(sid, { name: info.name, date: info.date });
  }

  if (!existsSync(sessionsDir)) return [];

  let files: string[] = [];
  try {
    files = readdirSync(sessionsDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();
  } catch {
    return [];
  }

  const sessions: SessionEntry[] = [];

  for (const filename of files) {
    const content = safeRead(join(sessionsDir, filename));

    // Extraire le SID depuis le contenu ou le nom de fichier
    const sidMatch = content.match(/sid[:\s]+([a-f0-9-]{8,})/i);
    const sid = sidMatch?.[1] ?? filename.replace(/\.md$/, "").split("_").pop() ?? "";

    // Extraire la date
    const dateMatch =
      filename.match(/^(\d{4}-\d{2}-\d{2})/) ??
      content.match(/date[:\s]+(\d{4}-\d{2}-\d{2})/i);
    const date = dateMatch?.[1] ?? "";

    // Extraire le nom depuis le mapping ou le contenu
    const nameFromMap = namesMap.get(sid)?.name;
    const titleMatch = content.match(/^#+\s+(.+)/m);
    const name = nameFromMap ?? titleMatch?.[1] ?? filename.replace(/\.md$/, "");

    // Extraire le sentiment depuis le contenu
    const sentimentMatch = content.match(/sentiment[:\s]+(\d)/i);
    const sentimentFromContent = sentimentMatch ? parseInt(sentimentMatch[1], 10) : 0;
    const sentiment = sentimentMap.get(sid) ?? sentimentFromContent;

    // Compter les messages (heuristique : lignes "User:" ou "Assistant:")
    const messageCount = (content.match(/^(User|Assistant|Utilisateur)\s*:/gm) ?? []).length;

    sessions.push({ filename, name, date, sentiment, sid, messageCount });
  }

  return sessions;
}

// ─── Sentiment history ───────────────────────────────────────────────────────

function collectSentiment(): { history: SentimentEntry[]; map: Map<string, number> } {
  const path = join(MEMORY_DIR, "LEARNING", "ALGORITHM", "sentiment-log.jsonl");
  const raw = parseJsonl<SentimentLogEntry>(path);

  const history: SentimentEntry[] = raw.map((e) => ({
    sid: e.sid ?? "",
    score: typeof e.score === "number" ? e.score : 3,
    ts: e.ts ?? new Date().toISOString(),
    trigger: e.trigger ?? "",
  }));

  // Map SID → dernier score
  const map = new Map<string, number>();
  for (const e of history) {
    if (e.sid) map.set(e.sid, e.score);
  }

  return { history, map };
}

// ─── Backup state ────────────────────────────────────────────────────────────

interface BackupStateRaw {
  lastBackup?: string;
  strategy?: string;
  commitCount?: number;
}

function collectBackupState(): BackupState | null {
  const path = join(CLAUDE_DIR, ".hora", "backup-state.json");
  if (!existsSync(path)) return null;
  const raw = safeParseJson<BackupStateRaw>(path, {});
  return {
    lastBackup: raw.lastBackup ?? null,
    strategy: raw.strategy ?? "unknown",
    commitCount: raw.commitCount ?? 0,
  };
}

// ─── Snapshots ───────────────────────────────────────────────────────────────

interface ManifestEntry {
  path?: string;
}

function collectSnapshotCount(): number {
  const manifestPath = join(CLAUDE_DIR, ".hora", "snapshots", "manifest.jsonl");
  const entries = parseJsonl<ManifestEntry>(manifestPath);
  return entries.length;
}

// ─── Tool usage ──────────────────────────────────────────────────────────────

interface ToolUsageEntry {
  tool?: string;
  count?: number;
}

function collectToolUsage(): Record<string, number> {
  const path = join(MEMORY_DIR, ".tool-usage.jsonl");
  const raw = parseJsonl<ToolUsageEntry>(path);
  const usage: Record<string, number> = {};
  for (const entry of raw) {
    if (!entry.tool) continue;
    usage[entry.tool] = (usage[entry.tool] ?? 0) + (entry.count ?? 1);
  }
  return usage;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log("HORA Dashboard — collecte des donnees...");

  const profile = collectProfile();
  const { history: sentimentHistory, map: sentimentMap } = collectSentiment();
  const sessions = collectSessions(sentimentMap);
  const backupState = collectBackupState();
  const snapshotCount = collectSnapshotCount();
  const toolUsage = collectToolUsage();

  const data: DashboardData = {
    generatedAt: new Date().toISOString(),
    profile,
    sessions,
    sentimentHistory,
    backupState,
    snapshotCount,
    toolUsage,
  };

  // Ecrire dans public/data.json
  const outputDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch {
    // deja existe
  }

  const outputPath = join(outputDir, "data.json");
  writeFileSync(outputPath, JSON.stringify(data, null, 2) + "\n");

  console.log(`  Sessions    : ${sessions.length}`);
  console.log(`  Sentiment   : ${sentimentHistory.length} entrees`);
  console.log(`  Snapshots   : ${snapshotCount}`);
  console.log(`  Outils      : ${Object.keys(toolUsage).length} distincts`);
  console.log(`  -> ${outputPath}`);
  console.log("");
  console.log("Lancez maintenant : npm run dev");
}

main();
