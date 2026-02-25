#!/usr/bin/env npx tsx
if (process.env.HORA_SKIP_HOOKS === "1") process.exit(0);
/**
 * HORA — hook: context-checkpoint
 * Detecte les compact events (chute brutale du context %) et injecte
 * le checkpoint de recovery via additionalContext.
 *
 * Hook type: PreToolUse (matcher: "" = all tools)
 *
 * Ghost failures adresses:
 *   GF-2:  Ignore ctx_pct == 0 (demarrage, jq fail)
 *   GF-3:  Ignore chutes entre sessions differentes (session_id)
 *   GF-4:  Ignore checkpoints stale (>30 min ou session differente)
 *   GF-5:  Accepte 2-3 calls de latence (statusline refresh)
 *   GF-6:  Ecriture atomique (tmp + rename)
 *   GF-9:  Lecture legere — 2 fs.read max en cas normal, pas de fork
 *   GF-11: Flag .compact-recovered pour eviter double injection
 *   GF-12: Si context-pct.txt absent → exit silencieux
 */

import * as fs from "fs";
import * as path from "path";
import { homedir } from "os";
import { horaSessionFile } from "./lib/session-paths.js";

const HORA_STATE_DIR = path.join(homedir(), ".claude", ".hora");
const MEMORY_DIR = path.join(homedir(), ".claude", "MEMORY");

let CONTEXT_PCT_FILE = "";
let CONTEXT_STATE_FILE = "";
// Project-scoped checkpoint — lives in <cwd>/.hora/checkpoint.md
// Any session on the same project reads/writes the same file.
// No cross-project contamination (each project has its own .hora/).
let CHECKPOINT_FILE = "";
const ACTIVITY_LOG = path.join(HORA_STATE_DIR, "activity-log.jsonl");
let COMPACT_FLAG = "";

const DROP_THRESHOLD = 40;
const STALE_CHECKPOINT_MS = 30 * 60 * 1000; // 30 min
const RECOVERY_COOLDOWN_MS = 60 * 1000; // 1 min

interface ContextState {
  session_id: string;
  last_pct: number;
  last_update: string;
  compact_count: number;
}

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, any>;
}

// --- FS helpers ---

function readFileSafe(p: string): string {
  try { return fs.readFileSync(p, "utf-8").trim(); } catch { return ""; }
}

function writeAtomic(p: string, data: string) {
  const tmp = p + ".tmp";
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, p);
}

// --- Core logic ---

function readContextPct(): number | null {
  const raw = readFileSafe(CONTEXT_PCT_FILE);
  if (!raw) return null; // GF-12
  const val = parseInt(raw, 10);
  if (isNaN(val) || val <= 0) return null; // GF-2
  return val;
}

function readState(): ContextState | null {
  const raw = readFileSafe(CONTEXT_STATE_FILE);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function writeState(s: ContextState) {
  writeAtomic(CONTEXT_STATE_FILE, JSON.stringify(s)); // GF-6
}

function isRecoveryCooldown(): boolean {
  try {
    const mtime = fs.statSync(COMPACT_FLAG).mtimeMs;
    if (Date.now() - mtime < RECOVERY_COOLDOWN_MS) return true; // GF-11
    fs.unlinkSync(COMPACT_FLAG);
  } catch {}
  return false;
}

function setRecoveryFlag() {
  try {
    fs.mkdirSync(path.dirname(COMPACT_FLAG), { recursive: true });
    fs.writeFileSync(COMPACT_FLAG, new Date().toISOString());
  } catch {}
}

function readCheckpoint(sessionId: string): string | null {
  const content = readFileSafe(CHECKPOINT_FILE);
  if (!content) return null;

  // GF-4: verifier fraicheur
  const tsMatch = content.match(/^timestamp:\s*(.+)$/m);
  if (tsMatch) {
    const age = Date.now() - new Date(tsMatch[1]).getTime();
    if (age > STALE_CHECKPOINT_MS) return null;
  }

  return content;
}

function readRecentActivity(max: number = 15): string | null {
  const raw = readFileSafe(ACTIVITY_LOG);
  if (!raw) return null;

  const lines = raw.split("\n").filter(Boolean).slice(-max);
  const entries: string[] = [];

  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      const time = (e.ts || "").slice(11, 19);
      entries.push(`[${time}] ${e.tool || "?"}: ${e.summary || e.file || "?"}`);
    } catch {}
  }

  return entries.length > 0 ? entries.join("\n") : null;
}

function buildRecoveryContext(sessionId: string, prevPct: number, curPct: number): string {
  const parts: string[] = [
    `[HORA RECOVERY] Compaction detectee (${prevPct}% → ${curPct}%).`,
    `Le contexte precedent a ete compresse. Voici ce qui a ete preserve :`,
  ];

  const checkpoint = readCheckpoint(sessionId);
  if (checkpoint) {
    parts.push("", "--- Checkpoint semantique ---", checkpoint);
  }

  const activity = readRecentActivity();
  if (activity) {
    parts.push("", "--- Activite recente (tool log) ---", activity);
  }

  if (!checkpoint && !activity) {
    parts.push(
      "",
      "Aucun checkpoint ni log disponible.",
      "Demande a l'utilisateur de resumer le contexte actuel avant de continuer.",
    );
  }

  parts.push(
    "",
    "INSTRUCTION: Relis ce contexte, confirme ta comprehension a l'utilisateur, puis continue le travail en cours.",
  );

  return parts.join("\n");
}

// --- Main ---

async function main() {
  const input = await new Promise<string>((resolve) => {
    let data = "";
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    setTimeout(() => resolve(data), 2000);
  });

  let hookData: HookInput = {};
  try { hookData = JSON.parse(input); } catch {}

  const sessionId = hookData.session_id || "unknown";

  // Session-scoped paths — each session writes to its own files (no cross-session collision)
  CONTEXT_PCT_FILE = horaSessionFile(sessionId, "context-pct.txt");
  CONTEXT_STATE_FILE = horaSessionFile(sessionId, "context-state.json");
  COMPACT_FLAG = horaSessionFile(sessionId, ".compact-recovered");
  // Project-scoped: <cwd>/.hora/checkpoint.md — shared across sessions on same project
  const horaDir = path.join(process.cwd(), ".hora");
  fs.mkdirSync(horaDir, { recursive: true });
  CHECKPOINT_FILE = path.join(horaDir, "checkpoint.md");

  const currentPct = readContextPct();

  // GF-2 / GF-12: pas de donnees → exit
  if (currentPct === null) process.exit(0);

  const prevState = readState();

  // GF-3: No longer needed — each session has its own state file

  // Premiere observation pour cette session
  if (!prevState) {
    writeState({
      session_id: sessionId,
      last_pct: currentPct,
      last_update: new Date().toISOString(),
      compact_count: 0,
    });
    process.exit(0);
  }

  const drop = prevState.last_pct - currentPct;

  // Update state
  writeState({
    session_id: sessionId,
    last_pct: currentPct,
    last_update: new Date().toISOString(),
    compact_count: prevState.compact_count + (drop >= DROP_THRESHOLD ? 1 : 0),
  });

  // Compact detecte ?
  if (drop >= DROP_THRESHOLD) {
    // GF-11: cooldown
    if (isRecoveryCooldown()) process.exit(0);
    setRecoveryFlag();

    const recovery = buildRecoveryContext(sessionId, prevState.last_pct, currentPct);

    const output = JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: recovery,
      },
    });
    fs.writeSync(1, output); // Sync write — process.exit() ne flush pas stdout
  }
}

main().catch(() => process.exit(0));
