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
import { homedir } from "os";
import { horaSessionFile, memorySessionFile, stateSessionFile, findLatestFile, readLatestAndClean, cleanupExpiredSessions } from "./lib/session-paths.js";

const CLAUDE_DIR = path.join(homedir(), ".claude");
const MEMORY_DIR = path.join(CLAUDE_DIR, "MEMORY");
const PROFILE_DIR = path.join(MEMORY_DIR, "PROFILE");
const STATE_DIR = path.join(MEMORY_DIR, "STATE");
const SESSIONS_DIR = path.join(MEMORY_DIR, "SESSIONS");

/**
 * Retourne un ID stable pour le projet courant.
 * Stocke dans .hora/project-id a la racine du projet.
 * Persiste meme si le dossier est renomme.
 */
function getProjectId(): string {
  const horaDir = path.join(process.cwd(), ".hora");
  const idFile = path.join(horaDir, "project-id");
  try {
    const existing = fs.readFileSync(idFile, "utf-8").trim();
    if (existing.length >= 8) return existing;
  } catch {}
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  try {
    fs.mkdirSync(horaDir, { recursive: true });
    fs.writeFileSync(idFile, id, "utf-8");
  } catch {}
  return id;
}

// Thread continuity files
const SESSION_THREAD_FILE = path.join(STATE_DIR, "session-thread.json");
const THREAD_ARCHIVE_FILE = path.join(STATE_DIR, "session-thread-archive.json");

// Limite stricte par section injectée
const MAX_SECTION_CHARS = 400;
const MAX_WORK_CHARS = 300;

// Thread limits
const MAX_THREAD_ENTRIES = 20;
const MAX_THREAD_CHARS = 5000;
const MAX_USER_SUMMARY = 200;

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
  project?: string;
}

function summarizeUserMessage(msg: string): string {
  if (!msg) return "";
  let clean = msg
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\/[\w./-]{20,}/g, "")
    .replace(/\n{3,}/g, "\n\n")          // collapse 3+ newlines to 2
    .replace(/[^\S\n]+/g, " ")           // collapse spaces/tabs but preserve \n
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

function getLastSessionSummary(currentProject: string): LastSessionInfo | null {
  try {
    // Cross-session: try reading thread-state from any previous session
    const threadStateContent = findLatestFile(STATE_DIR, "thread-state-");
    if (threadStateContent) {
      try {
        const threadState = JSON.parse(fs.readFileSync(threadStateContent, "utf-8"));
        if (threadState.session_name && threadState.session_summary &&
            (!threadState.project || threadState.project === currentProject)) {
          return {
            name: threadState.session_name,
            sid: threadState.session_id || "?",
            date: threadState.timestamp?.slice(0, 10) || "?",
            summary: threadState.session_summary,
          };
        }
      } catch {}
    }
    // Legacy fallback: try the old singleton file
    try {
      const legacyFile = path.join(STATE_DIR, "thread-state.json");
      const threadState = JSON.parse(fs.readFileSync(legacyFile, "utf-8"));
      if (threadState.session_name && threadState.session_summary &&
          (!threadState.project || threadState.project === currentProject)) {
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

function formatThreadForInjection(entries: ThreadEntry[], currentProject: string): string {
  // Filter to current project (entries without project field = legacy, include them)
  const filtered = entries.filter(
    (e) => !e.project || e.project === currentProject
  );
  if (filtered.length === 0) return "";

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

  // 2. Resume de la derniere session (meme projet)
  const lastSession = getLastSessionSummary(currentProject);
  if (lastSession) {
    parts.push(
      `Derniere session: "${lastSession.name}" (${lastSession.sid}) — ${lastSession.date}`,
      lastSession.summary,
      ``
    );
  }

  // 3. Dernieres sessions archivees (meme projet, 2-3 plus recentes)
  try {
    const allSessionFiles = fs.readdirSync(SESSIONS_DIR)
      .filter((f: string) => f.endsWith(".md"))
      .sort();

    // Filter by project: read each file and check **Projet** field
    const projectSessions: string[] = [];
    for (let i = allSessionFiles.length - 1; i >= 0 && projectSessions.length < 3; i--) {
      try {
        const content = fs.readFileSync(path.join(SESSIONS_DIR, allSessionFiles[i]), "utf-8");
        const projetIdMatch = content.match(/\*\*ProjetID\*\*\s*:\s*(\S+)/);
        // Include if same project ID or no ProjetID field (legacy)
        if (!projetIdMatch || projetIdMatch[1].trim() === currentProject) {
          projectSessions.unshift(allSessionFiles[i]);
        }
      } catch {}
    }

    if (projectSessions.length > 0) {
      parts.push(`Sessions recentes:`);
      for (const sf of projectSessions) {
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

  // 4. Thread des echanges recents (meme projet)
  let lines: string[] = [];
  let totalChars = 0;

  for (let i = filtered.length - 1; i >= 0; i--) {
    const e = filtered[i];
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

// ========================================
// Sentiment Predict
// ========================================

interface SentimentEntry {
  ts: string;
  score: number;
  msgPreview: string;
}

interface SentimentFile {
  scores: SentimentEntry[];
}

/**
 * Sanitise le texte avant scoring : retire les blocs de code, paths, variables, balises XML/HTML.
 * Fonction pure — pas d'I/O.
 */
function sanitizeForSentiment(text: string): string {
  return text
    // Blocs de code fenced (``` ... ```)
    .replace(/```[\s\S]*?```/g, " ")
    // Inline code (`...`)
    .replace(/`[^`]*`/g, " ")
    // Chemins de fichiers absolus ou relatifs (/path/to/FILE ou ./path)
    .replace(/(?:\/|\.\/|\.\.\/)\S+/g, " ")
    // Variables UPPER_SNAKE_CASE
    .replace(/\b[A-Z][A-Z0-9_]{2,}\b/g, " ")
    // CamelCase identifiers (contiennent au moins une majuscule interne : myVar, useState)
    .replace(/\b[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*\b/g, " ")
    // Balises XML/HTML <TAG> ou </TAG>
    .replace(/<\/?[A-Za-z][A-Za-z0-9_:-]*(?:\s[^>]*)?\/?>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Analyse le sentiment d'un message. Retourne un score 1-5 (5 = très frustré).
 * Fonction pure — pas d'I/O.
 */
export function analyzeSentiment(message: string): number {
  const clean = sanitizeForSentiment(message);
  const lower = clean.toLowerCase();
  let score = 0;

  // Mots négatifs FR (max 3)
  const negFR = [
    "encore", "toujours pas", "j'ai dit", "je t'ai dit", "relis",
    "non", "stop", "arrête", "mauvais", "nul", "pire", "horrible",
    "n'importe quoi", "rien ne marche", "ça marche pas",
  ];
  let countFR = 0;
  for (const w of negFR) {
    if (lower.includes(w)) {
      countFR++;
      if (countFR >= 3) break;
    }
  }
  score += countFR;

  // Mots négatifs EN (max 2)
  const negEN = [
    "wrong", "broken", "terrible", "useless", "doesn't work",
    "still not", "i said", "again", "stop",
  ];
  let countEN = 0;
  for (const w of negEN) {
    if (lower.includes(w)) {
      countEN++;
      if (countEN >= 2) break;
    }
  }
  score += countEN;

  // Ponctuation agressive (!!!  ou ???  = 3+ identiques)
  if (/[!?]{3,}/.test(clean)) score += 1;

  // MAJUSCULES > 30% du message et message > 20 chars
  if (clean.length > 20) {
    const letters = clean.replace(/[^a-zA-Z]/g, "");
    if (letters.length > 0) {
      const upperCount = (clean.match(/[A-Z]/g) || []).length;
      if (upperCount / letters.length > 0.3) score += 1;
    }
  }

  // Message court + négatif (< 30 chars avec un mot négatif = frustration concentrée)
  if (clean.length < 30 && (countFR > 0 || countEN > 0)) score += 1;

  return Math.max(1, Math.min(5, score));
}

function readSentimentFile(filePath: string): SentimentFile {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as SentimentFile;
  } catch {
    return { scores: [] };
  }
}

function writeSentimentFile(filePath: string, data: SentimentFile): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {}
}

function appendSentimentLog(logPath: string, sessionId: string, score: number): void {
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const entry = JSON.stringify({
      sid: sessionId.slice(0, 8),
      score,
      ts: new Date().toISOString(),
      trigger: "predict",
    });
    fs.appendFileSync(logPath, entry + "\n", "utf-8");
  } catch {}
}

/**
 * Retourne le message d'alerte à injecter, ou null si aucune alerte nécessaire.
 * Fonction pure — pas d'I/O.
 */
export function buildSentimentAlert(currentScore: number, recentScores: number[]): string | null {
  const last3 = recentScores.slice(-3);
  const avg = last3.length > 0
    ? last3.reduce((a, b) => a + b, 0) / last3.length
    : currentScore;

  const isTrend = last3.length >= 2 &&
    last3.every((v, i, arr) => i === 0 || v >= arr[i - 1]);

  const reinforced = avg >= 3.5 || isTrend;

  if (currentScore >= 4 && reinforced) {
    return "[HORA] Frustration detectee sur plusieurs messages. STOP — relis TOUT le contexte depuis le debut. Identifie ce qui ne va pas. Propose une approche differente au lieu de reessayer la meme chose.";
  }
  if (currentScore >= 4) {
    return "[HORA] L'utilisateur semble frustre. Ralentis, relis sa demande attentivement, confirme ta comprehension avant d'agir. Ne repete pas les memes erreurs.";
  }
  return null;
}

function processSentiment(sessionId: string, message: string): string | null {
  if (!message || message.trim().length === 0) return null;

  const score = analyzeSentiment(message);
  const msgPreview = message.slice(0, 50);
  const ts = new Date().toISOString();

  // Persister dans le fichier session-scoped
  const predictFile = horaSessionFile(sessionId, "sentiment-predict.json");
  const data = readSentimentFile(predictFile);
  data.scores.push({ ts, score, msgPreview });
  if (data.scores.length > 10) data.scores = data.scores.slice(-10);
  writeSentimentFile(predictFile, data);

  // Appender dans le sentiment-log MEMORY global
  const logPath = path.join(MEMORY_DIR, "LEARNING", "ALGORITHM", "sentiment-log.jsonl");
  appendSentimentLog(logPath, sessionId, score);

  // Calculer l'alerte basée sur les scores récents (hors actuel)
  const previousScores = data.scores.slice(0, -1).map((e) => e.score);
  return buildSentimentAlert(score, previousScores);
}

function detectMode(message: string): string | null {
  const msg = message.toLowerCase();

  if (msg.includes("/hora-autopilot")) return "AUTOPILOT";
  if (msg.includes("/hora-parallel-code")) return "PARALLEL_CODE";
  if (msg.includes("/hora-parallel-research")) return "PARALLEL_RESEARCH";
  if (msg.includes("/hora-plan")) return "PLAN";

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
    CODE_HINT:         "Hint: /hora-parallel-code si plusieurs fichiers/sous-systemes.",
    RESEARCH_HINT:     "Hint: /hora-parallel-research pour multi-sources.",
    PLAN_HINT:         "Hint: /hora-plan pour definir les ISC avant d'executer.",
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
  const stateFile = memorySessionFile(sessionId, "session-state");
  try {
    const s = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    if (s.sessionId === sessionId) return s;
  } catch {}
  // GF-3 backward compat: try legacy singleton
  try {
    const legacyFile = path.join(MEMORY_DIR, ".session-state.json");
    const s = JSON.parse(fs.readFileSync(legacyFile, "utf-8"));
    if (s.sessionId === sessionId) return s;
  } catch {}
  return null;
}

function updateSessionState(sessionId: string) {
  const stateFile = memorySessionFile(sessionId, "session-state");
  const s = getSessionState(sessionId) || { sessionId, startedAt: new Date().toISOString(), messageCount: 0, branchSuggestionMade: false };
  const next = { ...s, messageCount: s.messageCount + 1 };
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(next));
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

  // --- Sentiment Predict ---
  const sentimentAlert = processSentiment(sessionId, message);

  const state = updateSessionState(sessionId);
  const isFirst = state.messageCount <= 1;

  if (isFirst) {
    cleanupExpiredSessions();
  }

  // --- Deferred Pairing: pairer l'echange precedent ---
  try {
    const pendingFile = stateSessionFile(sessionId, "pending-user-msg");
    let prevUser: { session_id: string; message: string; timestamp: string; project?: string } | null = null;
    try {
      prevUser = JSON.parse(fs.readFileSync(pendingFile, "utf-8"));
    } catch {}

    // Cross-session: read the most recent thread-state from any session
    let prevAssistant: { session_id: string; assistant_summary: string; timestamp: string; project?: string } | null = null;
    const threadStateContent = readLatestAndClean(STATE_DIR, "thread-state-");
    if (threadStateContent) {
      try { prevAssistant = JSON.parse(threadStateContent); } catch {}
    }

    if (prevUser && prevAssistant && prevAssistant.assistant_summary.length > 10) {
      const entry: ThreadEntry = {
        ts: prevAssistant.timestamp || new Date().toISOString(),
        sid: (prevUser.session_id || sessionId).slice(0, 8),
        u: summarizeUserMessage(prevUser.message),
        a: prevAssistant.assistant_summary,
        project: prevUser.project || prevAssistant.project || getProjectId(),
      };
      if (entry.u.length > 0) {
        let thread = readThreadFile();
        thread.push(entry);
        thread = archiveEntries(thread);
        writeThreadFile(thread);
      }
    }

    if (message && message.trim().length > 0) {
      fs.mkdirSync(path.dirname(pendingFile), { recursive: true });
      fs.writeFileSync(pendingFile, JSON.stringify({
        session_id: sessionId,
        project: getProjectId(),
        message: message,
        timestamp: new Date().toISOString(),
      }), "utf-8");
    }

    // No need for unlinkSync — readLatestAndClean already cleans up
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

    // --- Project knowledge injection ---
    const projectKnowledgeFile = path.join(process.cwd(), ".hora", "project-knowledge.md");
    try {
      if (fs.existsSync(projectKnowledgeFile)) {
        // Projet connu → injecter le knowledge comme contexte
        const knowledge = readFile(projectKnowledgeFile);
        if (knowledge && knowledge.length > 20) {
          parts.push(`[HORA PROJECT KNOWLEDGE]\n${truncate(knowledge, 3000)}`);
        }
      } else {
        // Nouveau projet → proposer un audit complet
        const projectName = path.basename(process.cwd());
        const hasCode = (() => {
          try {
            // Verifier qu'il y a du code (pas un dossier vide)
            const files = fs.readdirSync(process.cwd()).filter(
              (f) => !f.startsWith(".") && f !== "node_modules"
            );
            return files.length > 0;
          } catch { return false; }
        })();
        if (hasCode) {
          parts.push(
            `[HORA AUDIT] Nouveau projet "${projectName}" sans audit.\n` +
            `INSTRUCTION : Propose a l'utilisateur un audit complet du projet AVANT de travailler.\n` +
            `L'audit doit couvrir : architecture, stack, failles (avec severite), dette technique, points positifs.\n` +
            `Utilise /hora-parallel-code pour explorer la codebase en parallele.\n` +
            `Resultat a ecrire dans .hora/project-knowledge.md`
          );
        }
      }
    } catch {}

    // Thread injection (premier message, filtre par projet courant)
    if (hasThreadHistory) {
      const threadText = formatThreadForInjection(thread, getProjectId());
      if (threadText) parts.push(threadText);
    }

    // --- Dashboard availability ---
    const dashboardDir = path.join(homedir(), ".claude", "dashboard");
    try {
      if (fs.existsSync(path.join(dashboardDir, "package.json"))) {
        parts.push(
          `[HORA] Dashboard disponible. Propose a l'utilisateur : "Le dashboard HORA est disponible — souhaites-tu l'ouvrir ?" ` +
          `Si oui, execute : cd ${dashboardDir} && npm run collect && npm run dev`
        );
      }
    } catch {}
  }

  // --- Sentiment alert (chaque message, si score >= 4) ---
  if (sentimentAlert) {
    parts.push(sentimentAlert);
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
  const CTX_PCT_FILE = horaSessionFile(sessionId, "context-pct.txt");
  try {
    const pctRaw = fs.readFileSync(CTX_PCT_FILE, "utf-8").trim();
    const pctVal = parseInt(pctRaw, 10);
    if (!isNaN(pctVal) && pctVal >= CHECKPOINT_THRESHOLD) {
      // Project-scoped: <cwd>/.hora/checkpoint.md — new sessions inherit previous session's context
      const checkpointPath = path.join(process.cwd(), ".hora", "checkpoint.md");
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
      const stateFile = memorySessionFile(sessionId, "session-state");
      const updated = { ...state, branchSuggestionMade: true };
      fs.writeFileSync(stateFile, JSON.stringify(updated));
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
