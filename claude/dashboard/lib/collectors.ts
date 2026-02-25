/**
 * HORA Dashboard — collectors.ts
 * Module importable pour collecter toutes les donnees MEMORY et projet.
 * Utilise par le Vite plugin (real-time) et le CLI (collect-data.ts).
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

import type {
  DashboardData,
  ProfileData,
  SessionEntry,
  SentimentEntry,
  BackupState,
  ThreadEntry,
  FailureEntry,
  SecurityEvent,
  SecuritySummary,
  SnapshotEntry,
  ProjectContext,
  ToolUsageDay,
} from "../src/types";

// ─── Constants ──────────────────────────────────────────────────────────────

const CLAUDE_DIR = join(homedir(), ".claude");
const MEMORY_DIR = join(CLAUDE_DIR, "MEMORY");

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function safeReadJsonFile<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    const content = readFileSync(path, "utf-8").trim();
    if (!content) return null;
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

// ─── Profile ────────────────────────────────────────────────────────────────

function collectProfile(): ProfileData {
  const profileDir = join(MEMORY_DIR, "PROFILE");
  return {
    identity: safeRead(join(profileDir, "identity.md")),
    projects: safeRead(join(profileDir, "projects.md")),
    preferences: safeRead(join(profileDir, "preferences.md")),
    vocabulary: safeRead(join(profileDir, "vocabulary.md")),
  };
}

// ─── Sessions ───────────────────────────────────────────────────────────────

interface SessionNamesJson {
  sessions?: Record<string, { name?: string; sid?: string; date?: string }>;
  // Flat format: {UUID: "name"} — keys are full UUIDs, values are name strings
  [key: string]: unknown;
}

interface SentimentLogEntry {
  sid?: string;
  score?: number;
  ts?: string;
  trigger?: string;
}

function collectSessionNames(): Map<string, { name?: string; date?: string }> {
  const namesPath = join(MEMORY_DIR, "STATE", "session-names.json");
  const namesJson = safeParseJson<SessionNamesJson>(namesPath, {});
  const namesMap = new Map<string, { name?: string; date?: string }>();

  // Format 1: {sessions: {sid: {name, date}}}
  if (namesJson.sessions) {
    for (const [sid, info] of Object.entries(namesJson.sessions)) {
      namesMap.set(sid, { name: info.name, date: info.date });
      // Also index by sid8 for thread cross-ref
      if (sid.length > 8) namesMap.set(sid.slice(0, 8), { name: info.name, date: info.date });
    }
  }

  // Format 2: {UUID: "name"} (flat — actual current format)
  for (const [key, val] of Object.entries(namesJson)) {
    if (key === "sessions") continue;
    if (typeof val === "string") {
      namesMap.set(key, { name: val });
      if (key.length > 8) namesMap.set(key.slice(0, 8), { name: val });
    }
  }

  return namesMap;
}

function collectSessions(
  sentimentMap: Map<string, number>,
  namesMap: Map<string, { name?: string; date?: string }>,
): SessionEntry[] {
  const sessionsDir = join(MEMORY_DIR, "SESSIONS");

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

    const sidMatch = content.match(/sid[:\s]+([a-f0-9-]{8,})/i);
    const sid = sidMatch?.[1] ?? filename.replace(/\.md$/, "").split("_").pop() ?? "";

    const dateMatch =
      filename.match(/^(\d{4}-\d{2}-\d{2})/) ??
      content.match(/date[:\s]+(\d{4}-\d{2}-\d{2})/i);
    const date = dateMatch?.[1] ?? "";

    const nameFromMap = namesMap.get(sid)?.name;
    const titleMatch = content.match(/^#+\s+(.+)/m);
    const name = nameFromMap ?? titleMatch?.[1] ?? filename.replace(/\.md$/, "");

    const sentimentMatch = content.match(/sentiment[:\s]+(\d)/i);
    const sentimentFromContent = sentimentMatch ? parseInt(sentimentMatch[1], 10) : 0;
    const sentiment = sentimentMap.get(sid) ?? sentimentFromContent;

    const messageCount = (content.match(/^(User|Assistant|Utilisateur)\s*:/gm) ?? []).length;

    // Try to extract project from content
    const projectMatch = content.match(/projet?[:\s]+([a-z0-9]+)/i);
    const project = projectMatch?.[1] ?? undefined;

    sessions.push({ filename, name, date, sentiment, sid, messageCount, project });
  }

  return sessions;
}

// ─── Sentiment ──────────────────────────────────────────────────────────────

function collectSentiment(): { history: SentimentEntry[]; map: Map<string, number> } {
  const path = join(MEMORY_DIR, "LEARNING", "ALGORITHM", "sentiment-log.jsonl");
  const raw = parseJsonl<SentimentLogEntry>(path);

  const history: SentimentEntry[] = raw.map((e) => ({
    sid: e.sid ?? "",
    score: typeof e.score === "number" ? e.score : 3,
    ts: e.ts ?? new Date().toISOString(),
    trigger: e.trigger ?? "",
  }));

  const map = new Map<string, number>();
  for (const e of history) {
    if (e.sid) map.set(e.sid, e.score);
  }

  return { history, map };
}

// ─── Thread ─────────────────────────────────────────────────────────────────

function collectThread(
  sentimentMap: Map<string, number>,
  namesMap: Map<string, { name?: string; date?: string }>,
): ThreadEntry[] {
  const activePath = join(MEMORY_DIR, "STATE", "session-thread.json");
  const archivePath = join(MEMORY_DIR, "STATE", "session-thread-archive.json");

  const active = safeParseJson<ThreadEntry[]>(activePath, []);
  const archive = safeParseJson<ThreadEntry[]>(archivePath, []);

  // Merge: archive (oldest) + active (newest), deduplicate by ts+sid
  const seen = new Set<string>();
  const merged: ThreadEntry[] = [];
  for (const entry of [...archive, ...active]) {
    const key = `${entry.ts}-${entry.sid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }

  // Enrich with session names and sentiment
  for (const entry of merged) {
    const sid8 = entry.sid?.slice(0, 8) ?? "";
    if (!entry.sessionName && sid8) {
      entry.sessionName = namesMap.get(sid8)?.name;
    }
    if (entry.sentiment === undefined && sid8) {
      entry.sentiment = sentimentMap.get(sid8);
    }
  }

  // Return last 50 entries (enough for dashboard, not too heavy)
  return merged.slice(-50);
}

// ─── Failures ───────────────────────────────────────────────────────────────

interface FailureJsonlEntry {
  ts?: string;
  sid?: string;
  type?: string;
  summary?: string;
}

function collectFailures(): FailureEntry[] {
  const baseDir = join(MEMORY_DIR, "LEARNING", "FAILURES");
  if (!existsSync(baseDir)) return [];

  // --- Source 1: JSONL (new format, preferred) ---
  const jsonlPath = join(baseDir, "failures-log.jsonl");
  const jsonlEntries = parseJsonl<FailureJsonlEntry>(jsonlPath);
  const entries: FailureEntry[] = jsonlEntries
    .filter((e) => e.type && e.summary)
    .map((e) => ({
      filename: "failures-log.jsonl",
      title: e.summary?.slice(0, 80) ?? "",
      type: e.type ?? "error",
      session: e.sid ?? "",
      date: e.ts?.slice(0, 10) ?? "",
    }))
    .reverse();

  // If we have JSONL data, use it exclusively
  if (entries.length > 0) return entries.slice(0, 20);

  // --- Source 2: Legacy markdown files (fallback) ---
  const legacyEntries: FailureEntry[] = [];
  try {
    const months = readdirSync(baseDir).filter((d: string) => d.match(/^\d{4}-\d{2}$/));
    for (const month of months) {
      const monthDir = join(baseDir, month);
      try {
        const files = readdirSync(monthDir)
          .filter((f: string) => f.endsWith(".md"))
          .sort()
          .reverse();

        for (const filename of files) {
          const content = safeRead(join(monthDir, filename));
          const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
          const date = dateMatch?.[1] ?? "";

          const sections = content.split(/^---$/m);
          for (const section of sections) {
            const typeField = section.match(/\*\*Type\*\*\s*:\s*(\w+)/i);
            const type = typeField?.[1]?.toLowerCase() ?? "";

            // Only keep failure/blocage — "error" is too noisy in legacy .md
            if (!type || (type !== "failure" && type !== "blocage")) continue;

            const sessionField = section.match(/\*\*Session\*\*\s*:\s*([a-f0-9_-]+)/i);
            const session = sessionField?.[1] ?? "";

            const titleMatch = section.match(/##\s+\w+\s+—\s+(.+)/m);
            const title = titleMatch?.[1]?.slice(0, 80) ?? "";
            if (!title) continue;

            legacyEntries.push({ filename, title, type, session, date });
          }
        }
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }

  return legacyEntries.slice(0, 20);
}

// ─── Security ───────────────────────────────────────────────────────────────

function collectSecurity(): SecuritySummary {
  const baseDir = join(MEMORY_DIR, "SECURITY");
  if (!existsSync(baseDir)) return { alerts: 0, blocks: 0, confirms: 0, recent: [] };

  let alerts = 0;
  let blocks = 0;
  let confirms = 0;
  const allEvents: SecurityEvent[] = [];

  try {
    // Walk year/month directories
    const years = readdirSync(baseDir).filter((d) => d.match(/^\d{4}$/));
    for (const year of years) {
      const yearDir = join(baseDir, year);
      try {
        const months = readdirSync(yearDir).filter((d) => d.match(/^\d{2}$/));
        for (const month of months) {
          const monthDir = join(yearDir, month);
          try {
            const files = readdirSync(monthDir).filter((f) => f.endsWith(".jsonl"));
            for (const file of files) {
              // Each security file is a single JSON object (pretty-printed), not JSONL
              const event = safeReadJsonFile<SecurityEvent>(join(monthDir, file));
              if (!event) continue;

              if (event.event_type === "alert") alerts++;
              else if (event.event_type === "block") blocks++;
              else if (event.event_type === "confirm") confirms++;

              allEvents.push(event);
            }
          } catch {
            // skip
          }
        }
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }

  // Sort by timestamp desc, take last 10
  allEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const recent = allEvents.slice(0, 10);

  return { alerts, blocks, confirms, recent };
}

// ─── Backup state (global) ──────────────────────────────────────────────────

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

// ─── Snapshots (global count) ───────────────────────────────────────────────

interface ManifestEntry {
  path?: string;
  tool?: string;
  session?: string;
  size?: number;
  ts?: string;
}

function collectSnapshotCount(): number {
  const manifestPath = join(CLAUDE_DIR, ".hora", "snapshots", "manifest.jsonl");
  const entries = parseJsonl<ManifestEntry>(manifestPath);
  return entries.length;
}

// ─── Tool usage (total + timeline) ──────────────────────────────────────────

interface ToolUsageEntry {
  ts?: string;
  tool?: string;
  session?: string;
  count?: number;
}

function collectToolUsage(): { total: Record<string, number>; timeline: ToolUsageDay[] } {
  const path = join(MEMORY_DIR, ".tool-usage.jsonl");
  const raw = parseJsonl<ToolUsageEntry>(path);

  // Only last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString();

  const total: Record<string, number> = {};
  const byDay = new Map<string, Record<string, number>>();

  for (const entry of raw) {
    if (!entry.tool) continue;
    const count = entry.count ?? 1;

    // Total (all time)
    total[entry.tool] = (total[entry.tool] ?? 0) + count;

    // Timeline (last 7 days only)
    if (entry.ts && entry.ts >= cutoff) {
      const day = entry.ts.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, {});
      const dayMap = byDay.get(day)!;
      dayMap[entry.tool] = (dayMap[entry.tool] ?? 0) + count;
    }
  }

  const timeline: ToolUsageDay[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tools]) => ({
      date,
      tools,
      total: Object.values(tools).reduce((a, b) => a + b, 0),
    }));

  return { total, timeline };
}

// ─── Project context ────────────────────────────────────────────────────────

function collectProjectContext(projectDir: string): ProjectContext | null {
  const horaDir = join(projectDir, ".hora");
  if (!existsSync(horaDir)) return null;

  const checkpoint = safeRead(join(horaDir, "checkpoint.md"));
  const knowledge = safeRead(join(horaDir, "project-knowledge.md"));
  const projectId = safeRead(join(horaDir, "project-id")).trim();

  // Snapshots from project-local manifest
  const manifestPath = join(horaDir, "snapshots", "manifest.jsonl");
  const rawSnapshots = parseJsonl<ManifestEntry>(manifestPath);
  const snapshots: SnapshotEntry[] = rawSnapshots.slice(-10).reverse().map((e) => ({
    path: e.path ?? "",
    tool: e.tool ?? "",
    session: e.session ?? "",
    size: e.size ?? 0,
    ts: e.ts ?? "",
  }));

  // Backup state from project-local
  const backupRaw = safeParseJson<BackupStateRaw>(join(horaDir, "backup-state.json"), {});
  const backupState: BackupState | null = backupRaw.lastBackup
    ? {
        lastBackup: backupRaw.lastBackup ?? null,
        strategy: backupRaw.strategy ?? "unknown",
        commitCount: backupRaw.commitCount ?? 0,
      }
    : null;

  return {
    checkpoint,
    knowledge,
    snapshots,
    backupState,
    projectId,
  };
}

// ─── Main collector ─────────────────────────────────────────────────────────

export function collectAll(projectDir?: string): DashboardData {
  const profile = collectProfile();
  const { history: sentimentHistory, map: sentimentMap } = collectSentiment();
  const namesMap = collectSessionNames();
  const sessions = collectSessions(sentimentMap, namesMap);
  const backupState = collectBackupState();
  const snapshotCount = collectSnapshotCount();
  const { total: toolUsage, timeline: toolTimeline } = collectToolUsage();
  const thread = collectThread(sentimentMap, namesMap);
  const failures = collectFailures();
  const security = collectSecurity();
  const projectContext = projectDir ? collectProjectContext(projectDir) : null;

  // Filter thread by current project (keep entries with no project for backward compat)
  const projectId = projectContext?.projectId;
  const filteredThread = projectId
    ? thread.filter((e) => !e.project || e.project === projectId)
    : thread;

  return {
    generatedAt: new Date().toISOString(),
    profile,
    sessions,
    sentimentHistory,
    backupState,
    snapshotCount,
    toolUsage,
    thread: filteredThread,
    failures,
    security,
    projectContext,
    toolTimeline,
  };
}
