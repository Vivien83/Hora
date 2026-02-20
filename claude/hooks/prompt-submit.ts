#!/usr/bin/env npx tsx
/**
 * HORA — hook: prompt-submit
 * Injecte le contexte MEMORY/ au premier message (borné).
 * Routing hints sur chaque message.
 *
 * OUTPUT FORMAT: hookSpecificOutput (requis pour UserPromptSubmit, bug #13912)
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const CLAUDE_DIR = path.join(process.env.HOME!, ".claude");
const MEMORY_DIR = path.join(CLAUDE_DIR, "MEMORY");
const PROFILE_DIR = path.join(MEMORY_DIR, "PROFILE");
const STATE_DIR = path.join(MEMORY_DIR, "STATE");
const SESSIONS_DIR = path.join(MEMORY_DIR, "SESSIONS");
const STATE_FILE = path.join(MEMORY_DIR, ".session-state.json");

// Thread continuity files
const PENDING_USER_MSG = path.join(STATE_DIR, ".pending-user-msg.json");
const THREAD_STATE_FILE = path.join(STATE_DIR, "thread-state.json");
const SESSION_THREAD_FILE = path.join(STATE_DIR, "session-thread.json");
const THREAD_ARCHIVE_FILE = path.join(STATE_DIR, "session-thread-archive.json");

// Limite stricte par section injectée
const MAX_SECTION_CHARS = 400;
const MAX_WORK_CHARS = 300;

// Thread limits
const MAX_THREAD_ENTRIES = 10;
const MAX_THREAD_CHARS = 2500;
const MAX_USER_SUMMARY = 80;

interface HookInput {
  session_id?: string;
  prompt?: string;       // Claude Code sends "prompt", not "message"
  message?: string;      // fallback
  transcript_path?: string;
  cwd?: string;
}

function readFile(filePath: string): string {
  try { return fs.readFileSync(filePath, "utf-8").trim(); } catch { return ""; }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

function isProfileEmpty(): boolean {
  return ["identity.md", "projects.md", "preferences.md"].every((f) => {
    const c = readFile(path.join(PROFILE_DIR, f));
    return c === "" || c.startsWith("<!-- vide");
  });
}

// ========================================
// Thread continuity
// ========================================

interface ThreadEntry {
  ts: string;
  sid: string;
  u: string;
  a: string;
}

function summarizeUserMessage(msg: string): string {
  if (!msg) return "";
  let clean = msg
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\/[\w./-]{20,}/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= MAX_USER_SUMMARY) return clean;

  // Couper a la fin de phrase
  const cut = clean.slice(0, MAX_USER_SUMMARY);
  const lastDot = cut.lastIndexOf(". ");
  const lastExcl = cut.lastIndexOf("! ");
  const lastQ = cut.lastIndexOf("? ");
  const boundary = Math.max(lastDot, lastExcl, lastQ);
  if (boundary > MAX_USER_SUMMARY * 0.4) return cut.slice(0, boundary + 1);

  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > MAX_USER_SUMMARY * 0.5) return cut.slice(0, lastSpace) + "...";
  return cut + "...";
}

function readThreadFile(): ThreadEntry[] {
  try {
    const raw = fs.readFileSync(SESSION_THREAD_FILE, "utf-8").trim();
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeThreadFile(entries: ThreadEntry[]) {
  fs.mkdirSync(path.dirname(SESSION_THREAD_FILE), { recursive: true });
  fs.writeFileSync(SESSION_THREAD_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

function archiveEntries(entries: ThreadEntry[]): ThreadEntry[] {
  if (entries.length <= MAX_THREAD_ENTRIES) return entries;
  const toArchive = entries.slice(0, entries.length - MAX_THREAD_ENTRIES);
  const toKeep = entries.slice(entries.length - MAX_THREAD_ENTRIES);

  try {
    let archive: ThreadEntry[] = [];
    try {
      archive = JSON.parse(fs.readFileSync(THREAD_ARCHIVE_FILE, "utf-8"));
    } catch {}
    archive.push(...toArchive);
    if (archive.length > 100) archive = archive.slice(archive.length - 100);
    fs.mkdirSync(path.dirname(THREAD_ARCHIVE_FILE), { recursive: true });
    fs.writeFileSync(THREAD_ARCHIVE_FILE, JSON.stringify(archive, null, 2), "utf-8");
  } catch {}

  return toKeep;
}

interface LastSessionInfo {
  name: string;
  sid: string;
  date: string;
  summary: string;
}

function getLastSessionSummary(): LastSessionInfo | null {
  try {
    try {
      const threadState = JSON.parse(fs.readFileSync(THREAD_STATE_FILE, "utf-8"));
      if (threadState.session_name && threadState.session_summary) {
        return {
          name: threadState.session_name,
          sid: threadState.session_id || "?",
          date: threadState.timestamp?.slice(0, 10) || "?",
          summary: threadState.session_summary,
        };
      }
    } catch {}

    const sessionFiles = fs.readdirSync(SESSIONS_DIR)
      .filter((f: string) => f.endsWith(".md"))
      .sort()
      .slice(-1);
    if (sessionFiles.length === 0) return null;

    const content = fs.readFileSync(path.join(SESSIONS_DIR, sessionFiles[0]), "utf-8");

    const nameMatch = content.match(/^# Session\s*:\s*(.+)$/m);
    const name = nameMatch ? nameMatch[1].trim() : "Sans nom";

    const sidMatch = content.match(/\*\*ID\*\*\s*:\s*(\S+)/);
    const sid = sidMatch ? sidMatch[1].slice(0, 8) : "?";

    const dateMatch = content.match(/\*\*Date\*\*\s*:\s*(\S+)/);
    const date = dateMatch ? dateMatch[1].slice(0, 10) : "?";

    const lines = content.split("\n");
    const exchanges: string[] = [];
    for (const line of lines) {
      if (exchanges.length >= 5) break;
      const userMatch = line.match(/^\[user\]:\s*(.+)/);
      const assistMatch = line.match(/^\[assistant\]:\s*(.{20,})/);
      if (userMatch) exchanges.push(`U: ${userMatch[1].slice(0, 100)}`);
      if (assistMatch) exchanges.push(`A: ${assistMatch[1].slice(0, 100)}`);
    }

    return {
      name,
      sid,
      date,
      summary: exchanges.length > 0 ? exchanges.join("\n") : "Pas de resume disponible",
    };
  } catch {
    return null;
  }
}

function formatThreadForInjection(entries: ThreadEntry[]): string {
  if (entries.length === 0) return "";

  const parts: string[] = [];

  // 1. Directive explicite
  parts.push(
    `<HORA_SESSION_CONTEXT>`,
    `DIRECTIVE OBLIGATOIRE:`,
    `- Tu as acces aux echanges des sessions precedentes ci-dessous.`,
    `- Ne dis JAMAIS "je n'ai pas de contexte", "chaque session repart de zero", ou "je ne me souviens pas".`,
    `- DES TA PREMIERE REPONSE (meme a un simple "hey", "bonjour", "salut"), tu DOIS mentionner brievement la derniere session et ce sur quoi vous travailliez. Exemple: "Hey ! La derniere fois on travaillait sur [X]. On continue ou tu veux faire autre chose ?"`,
    `- Ne demande JAMAIS a l'utilisateur d'aller chercher dans la memoire HORA — tu l'as deja.`,
    ``
  );

  // 2. Resume de la derniere session
  const lastSession = getLastSessionSummary();
  if (lastSession) {
    parts.push(
      `Derniere session: "${lastSession.name}" (${lastSession.sid}) — ${lastSession.date}`,
      lastSession.summary,
      ``
    );
  }

  // 3. Dernieres sessions archivees (2-3 plus recentes)
  try {
    const sessionFiles = fs.readdirSync(SESSIONS_DIR)
      .filter((f: string) => f.endsWith(".md"))
      .sort()
      .slice(-3);
    if (sessionFiles.length > 0) {
      parts.push(`Sessions recentes:`);
      for (const sf of sessionFiles) {
        try {
          const content = fs.readFileSync(path.join(SESSIONS_DIR, sf), "utf-8");
          const nameMatch = content.match(/^# Session\s*:\s*(.+)$/m);
          const name = nameMatch ? nameMatch[1].trim() : "Sans nom";
          const dateMatch = content.match(/\*\*Date\*\*\s*:\s*(\S+)/);
          const date = dateMatch ? dateMatch[1].slice(0, 16).replace("T", " ") : "?";
          const sentMatch = content.match(/\*\*Sentiment\*\*\s*:\s*(\d)/);
          const sent = sentMatch ? sentMatch[1] : "?";
          const userMsgs: string[] = [];
          for (const line of content.split("\n")) {
            if (userMsgs.length >= 2) break;
            const um = line.match(/^\[user\]:\s*(.+)/);
            if (um && um[1].trim().length > 5) userMsgs.push(um[1].trim().slice(0, 80));
          }
          parts.push(`- "${name}" (${date}, ${sent}/5): ${userMsgs.join(" → ") || "..."}`);
        } catch {}
      }
      parts.push(``);
    }
  } catch {}

  // 4. Thread des echanges recents
  let lines: string[] = [];
  let totalChars = 0;

  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    const time = e.ts.slice(11, 16); // HH:MM
    const line = `[${time} ${e.sid}] U: ${e.u} | A: ${e.a}`;
    if (totalChars + line.length > MAX_THREAD_CHARS && lines.length > 0) break;
    lines.unshift(line);
    totalChars += line.length + 1;
  }

  if (lines.length > 0) {
    parts.push(
      `Historique recent (${lines.length} echanges):`,
      ...lines
    );
  }

  parts.push(`</HORA_SESSION_CONTEXT>`);

  return parts.join("\n");
}

function detectMode(message: string): string | null {
  const msg = message.toLowerCase();

  if (msg.includes("/hora:autopilot")) return "AUTOPILOT";
  if (msg.includes("/hora:parallel-code")) return "PARALLEL_CODE";
  if (msg.includes("/hora:parallel-research")) return "PARALLEL_RESEARCH";
  if (msg.includes("/hora:plan")) return "PLAN";

  const codeWords = ["refactor", "implement", "implément", "migrate", "architecture", "restructure", "plusieurs fichiers", "codebase"];
  const researchWords = ["compare", "benchmark", "évalue", "quelles sont les", "what are the best"];
  const planWords = ["planifie", "roadmap", "étapes", "comment faire", "how to build", "stratégie"];

  if (codeWords.some((p) => msg.includes(p))) return "CODE_HINT";
  if (researchWords.some((p) => msg.includes(p))) return "RESEARCH_HINT";
  if (planWords.some((p) => msg.includes(p))) return "PLAN_HINT";

  return null;
}

function getRoutingHint(mode: string): string {
  const hints: Record<string, string> = {
    AUTOPILOT:         "Mode AUTOPILOT active. Lis ~/.claude/skills/autopilot.md pour le protocol complet. EXPLORE→PLAN→CODE→COMMIT. Delegue architect + executor. Stop quand tous les ISC sont satisfaits.",
    PARALLEL_CODE:     "Mode PARALLEL_CODE active. Lis ~/.claude/skills/parallel-code.md pour le protocol complet. Divise en sous-taches independantes. Agents executor en parallele, architect en coordination.",
    PARALLEL_RESEARCH: "Mode PARALLEL_RESEARCH active. Lis ~/.claude/skills/parallel-research.md pour le protocol complet. Agents researcher en parallele sur angles differents. Agrege avec synthesizer.",
    PLAN:              "Mode PLAN active. Lis ~/.claude/skills/plan.md pour le protocol complet. Produis le plan + ISC avant tout code. Attends validation.",
    CODE_HINT:         "Hint: /hora:parallel-code si plusieurs fichiers/sous-systemes.",
    RESEARCH_HINT:     "Hint: /hora:parallel-research pour multi-sources.",
    PLAN_HINT:         "Hint: /hora:plan pour definir les ISC avant d'executer.",
  };
  return hints[mode] || "";
}

// --- Detection nouveau chantier + suggestion branche ---

const NEW_WORK_KEYWORDS = [
  "nouveau design", "nouvelle approche", "new design", "new approach",
  "refonte", "redesign", "repartir de zero", "from scratch",
  "migration", "migrer vers", "switcher vers", "switch to",
  "v2", "rewrite", "reecrire", "recommencer",
  "tout refaire", "rebuild", "nouvelle version", "new version",
  "changer completement", "grosse modif", "big refactor",
  "nouvelle archi", "new architecture",
];

function detectNewWork(message: string): boolean {
  const msg = message.toLowerCase();
  return NEW_WORK_KEYWORDS.some((kw) => msg.includes(kw));
}

function isGitRepo(): boolean {
  try {
    execSync("git rev-parse --git-dir", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function hasUncommittedChanges(): boolean {
  try {
    const output = execSync("git status --short", { stdio: "pipe" }).toString().trim();
    return output.length > 0;
  } catch {
    return false;
  }
}

function getCurrentBranch(): string {
  try {
    return execSync("git branch --show-current", { stdio: "pipe" }).toString().trim();
  } catch {
    return "unknown";
  }
}

function getSessionState(sessionId: string): any {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    if (s.sessionId === sessionId) return s;
  } catch {}
  return null;
}

function updateSessionState(sessionId: string) {
  const s = getSessionState(sessionId) || { sessionId, startedAt: new Date().toISOString(), messageCount: 0, branchSuggestionMade: false };
  const next = { ...s, messageCount: s.messageCount + 1 };
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(next));
  return next;
}

async function main() {
  const input = await new Promise<string>((resolve) => {
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => resolve(d));
    setTimeout(() => resolve(d), 3000);
  });

  let hookData: HookInput = {};
  try { hookData = JSON.parse(input); } catch {}

  const sessionId = hookData.session_id || "unknown";
  const message = hookData.prompt || hookData.message || "";
  const state = updateSessionState(sessionId);
  const isFirst = state.messageCount <= 1;

  // --- Deferred Pairing: pairer l'echange precedent ---
  try {
    let prevUser: { session_id: string; message: string; timestamp: string } | null = null;
    try {
      prevUser = JSON.parse(fs.readFileSync(PENDING_USER_MSG, "utf-8"));
    } catch {}

    let prevAssistant: { session_id: string; assistant_summary: string; timestamp: string } | null = null;
    try {
      prevAssistant = JSON.parse(fs.readFileSync(THREAD_STATE_FILE, "utf-8"));
    } catch {}

    if (prevUser && prevAssistant && prevAssistant.assistant_summary.length > 10) {
      const entry: ThreadEntry = {
        ts: prevAssistant.timestamp || new Date().toISOString(),
        sid: (prevUser.session_id || sessionId).slice(0, 8),
        u: summarizeUserMessage(prevUser.message),
        a: prevAssistant.assistant_summary,
      };
      if (entry.u.length > 0) {
        let thread = readThreadFile();
        thread.push(entry);
        thread = archiveEntries(thread);
        writeThreadFile(thread);
      }
    }

    if (message && message.trim().length > 0) {
      fs.mkdirSync(path.dirname(PENDING_USER_MSG), { recursive: true });
      fs.writeFileSync(PENDING_USER_MSG, JSON.stringify({
        session_id: sessionId,
        message: message,
        timestamp: new Date().toISOString(),
      }), "utf-8");
    }

    try { fs.unlinkSync(THREAD_STATE_FILE); } catch {}
  } catch {}

  const parts: string[] = [];

  // --- Contexte MEMORY (premier message seulement) ---
  if (isFirst) {
    const thread = readThreadFile();
    const hasThreadHistory = thread.length > 0;

    if (isProfileEmpty() && !hasThreadHistory) {
      // Profil vide ET pas d'historique → nouveau user, poser les questions
      parts.push("[HORA] Profil vide. Pose 3 questions:\n1. Comment tu t'appelles ?\n2. Domaine principal ?\n3. Objectif en ce moment ?");
    } else if (!isProfileEmpty()) {
      // Profil rempli → injecter
      const sections: string[] = [];

      const identity = readFile(path.join(PROFILE_DIR, "identity.md"));
      if (identity) sections.push(`Profil: ${truncate(identity, MAX_SECTION_CHARS)}`);

      const projects = readFile(path.join(PROFILE_DIR, "projects.md"));
      if (projects) sections.push(`Projets: ${truncate(projects, MAX_SECTION_CHARS)}`);

      const prefs = readFile(path.join(PROFILE_DIR, "preferences.md"));
      if (prefs) sections.push(`Prefs: ${truncate(prefs, MAX_SECTION_CHARS)}`);

      try {
        const workFiles = fs.readdirSync(path.join(MEMORY_DIR, "WORK"))
          .filter((f) => f.endsWith(".md"))
          .sort()
          .slice(-1);
        if (workFiles.length > 0) {
          const w = readFile(path.join(MEMORY_DIR, "WORK", workFiles[0]));
          if (w) sections.push(`En cours: ${truncate(w, MAX_WORK_CHARS)}`);
        }
      } catch {}

      if (sections.length > 0) {
        parts.push(`[HORA]\n${sections.join("\n")}`);
      }
    }
    // else: profil vide mais historique present → skip les questions, le thread suffit

    // Thread injection (premier message, toujours si historique existe)
    if (hasThreadHistory) {
      const threadText = formatThreadForInjection(thread);
      if (threadText) parts.push(threadText);
    }
  }

  // --- Routing hint (chaque message) ---
  if (message) {
    const mode = detectMode(message);
    if (mode) {
      const hint = getRoutingHint(mode);
      if (hint) parts.push(`[HORA] ${hint}`);
    }
  }

  // --- Checkpoint reminder (contexte >= 70%) ---
  const CHECKPOINT_THRESHOLD = 70;
  const CTX_PCT_FILE = path.join(CLAUDE_DIR, ".hora", "context-pct.txt");
  try {
    const pctRaw = fs.readFileSync(CTX_PCT_FILE, "utf-8").trim();
    const pctVal = parseInt(pctRaw, 10);
    if (!isNaN(pctVal) && pctVal >= CHECKPOINT_THRESHOLD) {
      const checkpointPath = path.join(MEMORY_DIR, "WORK", "checkpoint.md");
      parts.push(
        `[HORA CHECKPOINT] Contexte a ${pctVal}%. INSTRUCTION OBLIGATOIRE : ecris un checkpoint semantique dans ${checkpointPath} avec ce format :\n` +
        `---\n` +
        `session: ${sessionId.slice(0, 8)}\n` +
        `timestamp: ${new Date().toISOString()}\n` +
        `context_pct: ${pctVal}\n` +
        `---\n` +
        `# Objectif en cours\n[Quoi]\n\n# Etat actuel\n[Ou on en est]\n\n# Decisions prises\n[Ce qui a ete decide]\n\n# Prochaines etapes\n[Ce qui reste a faire]\n\n` +
        `Fais-le MAINTENANT avant de repondre, puis continue normalement.`
      );
    }
  } catch {}

  // --- Suggestion branche (nouveau chantier + uncommitted changes) ---
  if (message && detectNewWork(message) && !state.branchSuggestionMade) {
    if (isGitRepo() && hasUncommittedChanges()) {
      const branch = getCurrentBranch();
      parts.push(`[HORA] L'utilisateur commence un nouveau chantier et il y a des modifications non commitees sur "${branch}". Propose de sauvegarder l'etat actuel (commit + nouvelle branche) avant de continuer.`);
      const updated = { ...state, branchSuggestionMade: true };
      fs.writeFileSync(STATE_FILE, JSON.stringify(updated));
    }
  }

  if (parts.length > 0) {
    const content = parts.join("\n\n");
    const output = JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: content,
      },
    });
    fs.writeSync(1, output);
  }
}

main().catch(() => {});
