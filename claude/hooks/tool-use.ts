#!/usr/bin/env npx tsx
if (process.env.HORA_SKIP_HOOKS === "1") process.exit(0);
/**
 * HORA — hook: tool-use
 * Observe les patterns d'utilisation des outils.
 * Track les agents paralleles et les taches pour la statusline.
 * Silencieux — ne bloque jamais l'exécution.
 */

import * as fs from "fs";
import * as path from "path";
import { homedir } from "os";

const CLAUDE_DIR = path.join(homedir(), ".claude");
const HORA_STATE_DIR = path.join(CLAUDE_DIR, ".hora");
const MEMORY_DIR = path.join(CLAUDE_DIR, "MEMORY");
const TOOL_LOG = path.join(MEMORY_DIR, ".tool-usage.jsonl");

// Chemins session-scoped (resolus dans main() apres lecture du session_id)
function agentsStatePath(sid8: string): string {
  return path.join(HORA_STATE_DIR, "sessions", sid8, "active-agents.json");
}
function taskStatePath(sid8: string): string {
  return path.join(HORA_STATE_DIR, "sessions", sid8, "current-task.json");
}

interface ToolUseInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, any>;
}

interface AgentEntry {
  name: string;
  ts: string;
}

interface AgentsState {
  count: number;
  agents: AgentEntry[];
  updated: string;
}

interface TaskState {
  label: string;
  total: number;
  done: number;
  updated: string;
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: unknown): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = filePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, filePath);
  } catch {}
}

async function main() {
  const input = await new Promise<string>((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });

  let hookData: ToolUseInput = {};
  try {
    hookData = JSON.parse(input);
  } catch {}

  const toolName = hookData.tool_name || "unknown";
  const sessionId = hookData.session_id || "unknown";
  const toolInput = hookData.tool_input || {};

  // Logger l'utilisation (sans les données sensibles)
  const logEntry = {
    ts: new Date().toISOString(),
    session: sessionId.slice(0, 8),
    tool: toolName,
  };

  try {
    fs.mkdirSync(path.dirname(TOOL_LOG), { recursive: true });
    fs.appendFileSync(TOOL_LOG, JSON.stringify(logEntry) + "\n");
  } catch {}

  // Session-scoped paths (8 premiers chars du session_id)
  const sid8 = sessionId.slice(0, 8);
  const AGENTS_STATE = agentsStatePath(sid8);
  const TASK_STATE = taskStatePath(sid8);

  // ── Track agents paralleles ──────────────────────────────────────
  if (toolName === "Task") {
    const agentName =
      (toolInput as any).description ||
      (toolInput as any).subagent_type ||
      "agent";
    const state = readJson<AgentsState>(AGENTS_STATE, {
      count: 0,
      agents: [],
      updated: "",
    });

    // Expirer les agents > 60s (safety net)
    const now = Date.now();
    state.agents = state.agents.filter(
      (a) => now - new Date(a.ts).getTime() < 60_000
    );

    state.agents.push({
      name: String(agentName).slice(0, 30),
      ts: new Date().toISOString(),
    });
    state.count = state.agents.length;
    state.updated = new Date().toISOString();
    writeJson(AGENTS_STATE, state);
  }

  // ── Track taches (TaskCreate / TaskUpdate) ───────────────────────
  if (toolName === "TaskCreate") {
    const state = readJson<TaskState>(TASK_STATE, {
      label: "",
      total: 0,
      done: 0,
      updated: "",
    });
    state.total += 1;
    const activeForm = (toolInput as any).activeForm;
    const subject = (toolInput as any).subject;
    if (activeForm || subject) {
      state.label = String(activeForm || subject).slice(0, 50);
    }
    state.updated = new Date().toISOString();
    writeJson(TASK_STATE, state);
  }

  if (toolName === "TaskUpdate") {
    const state = readJson<TaskState>(TASK_STATE, {
      label: "",
      total: 0,
      done: 0,
      updated: "",
    });
    const status = (toolInput as any).status;
    if (status === "completed") {
      state.done = Math.min(state.done + 1, state.total);
    }
    if (status === "in_progress") {
      const activeForm = (toolInput as any).activeForm;
      const subject = (toolInput as any).subject;
      if (activeForm || subject) {
        state.label = String(activeForm || subject).slice(0, 50);
      }
    }
    if (status === "deleted") {
      state.total = Math.max(state.total - 1, 0);
    }
    state.updated = new Date().toISOString();
    writeJson(TASK_STATE, state);
  }

  // Ne jamais bloquer
  process.exit(0);
}

main().catch(() => process.exit(0));
