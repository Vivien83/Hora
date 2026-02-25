#!/usr/bin/env npx tsx
if (process.env.HORA_SKIP_HOOKS === "1") process.exit(0);
/**
 * HORA — hook: doc-sync
 * Detecte les changements structurants dans la session et injecte une instruction
 * pour mettre a jour `.hora/project-knowledge.md`.
 *
 * Hook type: PostToolUse (matcher: "Write|Edit|MultiEdit")
 *
 * Ghost failures adresses:
 *   GF-1: project-knowledge.md absent → exit silencieux (prompt-submit gere l'audit initial)
 *   GF-2: context > 80% → pas d'injection (evite de polluer un contexte charge)
 *   GF-3: Fichier non structurant → ignore, compteur non incremente
 *   GF-4: Ecriture atomique du state (tmp + rename)
 *   GF-5: tool_input.file_path absent → ignore
 *   GF-6: Staleness check uniquement au premier declenchement du seuil
 */

import * as fs from "fs";
import * as path from "path";
import { projectSessionFile, horaSessionFile } from "./lib/session-paths.js";

const THRESHOLD = 5;
const STALENESS_DAYS = 7;
const MAX_FILES_IN_MSG = 5;

const STRUCTURING_DIRS = ["src", "lib", "app", "pages", "components", "services", "api"];
const STRUCTURING_FILES = ["package.json", "tsconfig.json"];
const STRUCTURING_EXTS = [".config.ts", ".config.js", ".config.mjs", ".config.cjs"];

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

interface DocSyncState {
  sessionId: string;
  structuringFiles: string[];
  triggeredAt: string | null;
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

// --- Logic ---

function isStructuringFile(filePath: string): boolean {
  const basename = path.basename(filePath);
  const normalized = filePath.replace(/\\/g, "/");

  // Fichiers explicites
  if (STRUCTURING_FILES.includes(basename)) return true;

  // Extensions config
  if (STRUCTURING_EXTS.some(ext => basename.endsWith(ext))) return true;

  // Dossiers structurants (match n'importe quel segment du path)
  const segments = normalized.split("/");
  if (STRUCTURING_DIRS.some(dir => segments.includes(dir))) return true;

  return false;
}

function readState(sessionId: string): DocSyncState {
  const stateFile = projectSessionFile(sessionId, "doc-sync-state", ".json");
  try {
    if (fs.existsSync(stateFile)) {
      const raw = fs.readFileSync(stateFile, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        "sessionId" in parsed &&
        (parsed as DocSyncState).sessionId === sessionId
      ) {
        return parsed as DocSyncState;
      }
    }
  } catch {}
  return { sessionId, structuringFiles: [], triggeredAt: null };
}

function writeState(sessionId: string, state: DocSyncState) {
  const stateFile = projectSessionFile(sessionId, "doc-sync-state", ".json");
  writeAtomic(stateFile, JSON.stringify(state, null, 2));
}

function getContextPct(sessionId: string): number | null {
  const pctFile = horaSessionFile(sessionId, "context-pct.txt");
  const raw = readFileSafe(pctFile);
  if (!raw) return null;
  const val = parseInt(raw, 10);
  if (isNaN(val)) return null;
  return val;
}

function getProjectKnowledgePath(): string {
  return path.join(process.cwd(), ".hora", "project-knowledge.md");
}

function projectKnowledgeExists(): boolean {
  return fs.existsSync(getProjectKnowledgePath());
}

function getStalenessDays(): number | null {
  const pkPath = getProjectKnowledgePath();
  try {
    const stat = fs.statSync(pkPath);
    const ageMs = Date.now() - stat.mtimeMs;
    return Math.floor(ageMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function buildInstruction(files: string[]): string {
  const displayed = files.slice(0, MAX_FILES_IN_MSG);
  const remaining = files.length - displayed.length;
  const fileList = displayed.join(", ") + (remaining > 0 ? ` (+${remaining} autres)` : "");

  const stalenessDays = getStalenessDays();
  const stalenessNote =
    stalenessDays !== null && stalenessDays > STALENESS_DAYS
      ? ` Note : project-knowledge.md date de ${stalenessDays} jours — une mise a jour complete est recommandee.`
      : "";

  return (
    `[HORA Doc Sync] ${files.length} fichiers structurants modifies dans cette session (${fileList}).` +
    ` Mets a jour la section pertinente de \`.hora/project-knowledge.md\` si ce fichier existe.` +
    stalenessNote
  );
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
  const filePath = typeof hookData.tool_input?.file_path === "string"
    ? hookData.tool_input.file_path
    : null;

  // GF-5: pas de file_path → exit
  if (!filePath) process.exit(0);

  // GF-3: fichier non structurant → exit
  if (!isStructuringFile(filePath)) process.exit(0);

  const state = readState(sessionId);

  // Ajouter le fichier s'il n'est pas deja dans la liste
  const relPath = path.relative(process.cwd(), filePath) || filePath;
  if (!state.structuringFiles.includes(relPath)) {
    state.structuringFiles.push(relPath);
  }

  writeState(sessionId, state);

  // Pas encore au seuil → exit
  if (state.structuringFiles.length < THRESHOLD) process.exit(0);

  // GF-1: project-knowledge.md absent → exit
  if (!projectKnowledgeExists()) process.exit(0);

  // GF-2: contexte > 80% → exit
  const ctxPct = getContextPct(sessionId);
  if (ctxPct !== null && ctxPct > 80) process.exit(0);

  // Injecter l'instruction
  const instruction = buildInstruction(state.structuringFiles);

  const output = JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: instruction,
    },
  });

  fs.writeSync(1, output);
  process.exit(0);
}

main().catch(() => process.exit(0));
