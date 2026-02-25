#!/usr/bin/env npx tsx
if (process.env.HORA_SKIP_HOOKS === "1") process.exit(0);
/**
 * HORA — hook: tool-use
 * Observe les patterns d'utilisation des outils.
 * Silencieux — ne bloque jamais l'exécution.
 */

import * as fs from "fs";
import * as path from "path";
import { homedir } from "os";

const CLAUDE_DIR = path.join(homedir(), ".claude");
const MEMORY_DIR = path.join(CLAUDE_DIR, "MEMORY");
const TOOL_LOG = path.join(MEMORY_DIR, ".tool-usage.jsonl");

interface ToolUseInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, any>;
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

  // Ne jamais bloquer
  process.exit(0);
}

main().catch(() => process.exit(0));
