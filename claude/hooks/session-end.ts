#!/usr/bin/env npx tsx
if (process.env.HORA_SKIP_HOOKS === "1") process.exit(0);
/**
 * HORA — hook: session-end (Stop)
 * A la fin de chaque session significative :
 *   1. Extrait le profil utilisateur (identity, projets, preferences)
 *   2. Extrait les erreurs et lecons (LEARNING/FAILURES/)
 *   3. Archive un resume de session (SESSIONS/)
 *
 * TRIGGER: Stop (messageCount >= 3 pour eviter le bruit)
 *
 * IMPORTANT: Ce hook se declenche sur chaque Stop (chaque tour de Claude).
 * L'extraction complete n'a lieu qu'une fois par session (flag file).
 */

import * as fs from "fs";
import * as path from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import { stateSessionFile, memorySessionFile } from "./lib/session-paths.js";
import { runMemoryLifecycle } from "./lib/memory-tiers.js";
import { HoraGraph } from "./lib/knowledge-graph.js";
import { buildGraphFromSession } from "./lib/graph-builder.js";
import { migrateExistingData } from "./lib/graph-migration.js";
import { disposeEmbedder } from "./lib/embeddings.js";

const CLAUDE_DIR = path.join(homedir(), ".claude");
const MEMORY_DIR = path.join(CLAUDE_DIR, "MEMORY");
const PROFILE_DIR = path.join(MEMORY_DIR, "PROFILE");
const LEARNING_DIR = path.join(MEMORY_DIR, "LEARNING");
const SESSIONS_DIR = path.join(MEMORY_DIR, "SESSIONS");
const EXTRACTED_FLAG = path.join(MEMORY_DIR, ".extraction-done");
const SENTIMENT_LOG = path.join(LEARNING_DIR, "ALGORITHM", "sentiment-log.jsonl");
const FAILURES_LOG = path.join(LEARNING_DIR, "FAILURES", "failures-log.jsonl");
const MIGRATION_FLAG = path.join(MEMORY_DIR, ".migration-hora-v2-done");

const PROJECT_DISPLAY = path.basename(process.cwd());
const isSubagent = process.argv.includes("--subagent");

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  last_assistant_message?: string;
}

// ========================================
// Utilitaires
// ========================================

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

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    return "";
  }
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

function appendJsonl(filePath: string, data: Record<string, any>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(data) + "\n", "utf-8");
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function execWithTimeout(cmd: string, timeoutMs: number): string {
  try {
    return execSync(cmd, { timeout: timeoutMs, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

// ========================================
// Thread state — troncature assistant
// ========================================

function truncateAtBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const truncated = text.slice(0, max);
  // Chercher la derniere fin de phrase
  const lastDot = truncated.lastIndexOf(". ");
  const lastExcl = truncated.lastIndexOf("! ");
  const lastQ = truncated.lastIndexOf("? ");
  const boundary = Math.max(lastDot, lastExcl, lastQ);
  if (boundary > max * 0.4) return truncated.slice(0, boundary + 1);
  // Sinon couper au dernier espace
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > max * 0.5) return truncated.slice(0, lastSpace) + "...";
  return truncated + "...";
}

function summarizeAssistantResponse(text: string): string {
  if (!text || text.length < 10) return "";
  // Nettoyer markdown, system-reminder, code blocks
  let clean = text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/\*\*/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{2,}/g, "\n")
    .trim();

  // Chercher un resume (patterns courants)
  const summaryPatterns = [
    /(?:en resume|en résumé|to summarize)[:\s]+(.{20,300})/i,
    /(?:resultat|résultat|result)[:\s]+(.{20,300})/i,
    /(?:prochaines etapes|prochaines étapes|next steps)[:\s]+(.{20,300})/i,
    /(?:voici ce que|here's what)[:\s]+(.{20,300})/i,
  ];
  for (const p of summaryPatterns) {
    const match = clean.match(p);
    if (match) return truncateAtBoundary(match[1].trim(), 200);
  }

  // Sinon prendre le premier paragraphe substantiel
  const paragraphs = clean.split("\n").filter((p) => p.trim().length > 30);
  if (paragraphs.length > 0) {
    return truncateAtBoundary(paragraphs[0].trim(), 200);
  }

  return truncateAtBoundary(clean, 200);
}

// ========================================
// Thread: extract ALL user/assistant pairs from transcript
// ========================================

interface ThreadEntry {
  ts: string;
  sid: string;
  u: string;
  a: string;
  project?: string;
}

const SESSION_THREAD_FILE = path.join(MEMORY_DIR, "STATE", "session-thread.json");
const THREAD_ARCHIVE_FILE = path.join(MEMORY_DIR, "STATE", "session-thread-archive.json");
const MAX_THREAD_ENTRIES = 20;

function summarizeUserMsg(msg: string): string {
  if (!msg) return "";
  let clean = msg
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\/[\w./-]{20,}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();
  if (clean.length <= 200) return clean;
  const cut = clean.slice(0, 200);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 100) return cut.slice(0, lastSpace) + "...";
  return cut + "...";
}

function extractAllExchanges(transcriptPath: string, sessionId: string, projectId: string): ThreadEntry[] {
  try {
    const raw = fs.readFileSync(transcriptPath, "utf-8");
    const lines = raw.split("\n").filter(Boolean);

    // Parse all messages from the JSONL transcript
    const messages: Array<{ role: string; text: string; ts?: string }> = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const msg = entry.message || entry;
        const role = msg.role || "";
        if (role !== "user" && role !== "human" && role !== "assistant") continue;

        let text = "";
        const content = msg.content;
        if (Array.isArray(content)) {
          text = content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join(" ");
        } else if (typeof content === "string") {
          text = content;
        }
        if (!text || text.trim().length < 5) continue;
        messages.push({
          role: role === "human" ? "user" : role,
          text,
          ts: entry.timestamp || entry.ts,
        });
      } catch {}
    }

    // Pair consecutive user → assistant messages
    const entries: ThreadEntry[] = [];
    const sid8 = sessionId.slice(0, 8);
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role === "user" && messages[i + 1].role === "assistant") {
        const userSummary = summarizeUserMsg(messages[i].text);
        const assistSummary = summarizeAssistantResponse(messages[i + 1].text);
        if (userSummary.length > 0 && assistSummary.length > 10) {
          entries.push({
            ts: messages[i + 1].ts || new Date().toISOString(),
            sid: sid8,
            u: userSummary,
            a: assistSummary,
            project: projectId,
          });
        }
        i++; // skip the assistant message
      }
    }
    return entries;
  } catch {
    return [];
  }
}

function writeAllThreadEntries(newEntries: ThreadEntry[]): void {
  if (newEntries.length === 0) return;
  try {
    // Read existing thread file
    let existing: ThreadEntry[] = [];
    try {
      const raw = fs.readFileSync(SESSION_THREAD_FILE, "utf-8").trim();
      if (raw) existing = JSON.parse(raw);
    } catch {}

    // Deduplicate: by ts+sid AND by sid+u_prefix (catch near-duplicates from prompt-submit)
    const seenTs = new Set(existing.map(e => `${e.ts}-${e.sid}`));
    const seenContent = new Set(existing.map(e => `${e.sid}-${(e.u || "").slice(0, 50)}`));
    const toAdd = newEntries.filter(e =>
      !seenTs.has(`${e.ts}-${e.sid}`) && !seenContent.has(`${e.sid}-${(e.u || "").slice(0, 50)}`)
    );
    if (toAdd.length === 0) return;

    existing.push(...toAdd);

    // Archive if too many
    if (existing.length > MAX_THREAD_ENTRIES) {
      const toArchive = existing.slice(0, existing.length - MAX_THREAD_ENTRIES);
      existing = existing.slice(existing.length - MAX_THREAD_ENTRIES);
      try {
        let archive: ThreadEntry[] = [];
        try {
          archive = JSON.parse(fs.readFileSync(THREAD_ARCHIVE_FILE, "utf-8"));
        } catch {}
        archive.push(...toArchive);
        if (archive.length > 500) archive = archive.slice(archive.length - 500);
        fs.mkdirSync(path.dirname(THREAD_ARCHIVE_FILE), { recursive: true });
        fs.writeFileSync(THREAD_ARCHIVE_FILE, JSON.stringify(archive, null, 2), "utf-8");
      } catch {}
    }

    fs.mkdirSync(path.dirname(SESSION_THREAD_FILE), { recursive: true });
    fs.writeFileSync(SESSION_THREAD_FILE, JSON.stringify(existing, null, 2), "utf-8");
  } catch {}
}

// ========================================
// Transcript parsing
// ========================================

function extractLastAssistantMessage(transcriptPath: string): string {
  try {
    const raw = fs.readFileSync(transcriptPath, "utf-8");
    const lines = raw.split("\n").filter(Boolean);
    // Parcourir en sens inverse pour trouver le dernier message assistant
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        const msg = entry.message || entry;
        if (msg.role === "assistant") {
          const content = msg.content;
          if (Array.isArray(content)) {
            return content
              .filter((c: any) => c.type === "text")
              .map((c: any) => c.text)
              .join(" ");
          }
          if (typeof content === "string") return content;
        }
      } catch {}
    }
  } catch {}
  return "";
}

// ========================================
// Parsing du transcript
// ========================================

function parseTranscript(transcriptPath: string): string {
  try {
    const raw = fs.readFileSync(transcriptPath, "utf-8");
    const messages = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return messages
      .map((m: any) => {
        // Claude Code transcript format: content is nested in m.message
        const msg = m.message || m;
        const role = msg.role || m.type || "unknown";

        // Extract text content from message
        const rawContent = msg.content;
        let text = "";

        if (Array.isArray(rawContent)) {
          text = rawContent
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join(" ");
        } else if (typeof rawContent === "string") {
          text = rawContent;
        }

        return text ? `[${role}]: ${text}` : null;
      })
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

// ========================================
// Extraction de profil — Couche A : environnement
// ========================================

interface ProfileEntry {
  key: string;
  value: string;
  source: string;
}

interface ProfileData {
  identity: ProfileEntry[];
  projects: Array<{ name: string; source: string; date: string }>;
  techStack: Array<{ name: string; source: string }>;
  preferences: ProfileEntry[];
  vocabulary: string[];
}

function extractProfileEnv(): ProfileData {
  const data: ProfileData = {
    identity: [],
    projects: [],
    techStack: [],
    preferences: [],
    vocabulary: [],
  };

  // Git config → name, email
  const gitName = execWithTimeout("git config user.name", 2000);
  if (gitName) data.identity.push({ key: "Nom", value: gitName, source: "env:git-config" });

  const gitEmail = execWithTimeout("git config user.email", 2000);
  if (gitEmail) data.identity.push({ key: "Email", value: gitEmail, source: "env:git-config" });

  // Git remote → GitHub username
  const remote = execWithTimeout("git remote get-url origin", 2000);
  if (remote) {
    const ghMatch = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (ghMatch) data.identity.push({ key: "GitHub", value: ghMatch[1], source: "env:git-remote" });
  }

  // CWD → project name
  const cwdName = path.basename(process.cwd());
  if (cwdName && cwdName !== "/" && cwdName !== ".") {
    data.projects.push({ name: cwdName, source: "env:cwd", date: new Date().toISOString().slice(0, 10) });
  }

  // package.json → tech stack
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const stat = fs.statSync(pkgPath);
    if (stat.size <= 50 * 1024) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const allDeps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
      const techMap: Record<string, string> = {
        typescript: "TypeScript",
        react: "React",
        next: "Next.js",
        vue: "Vue",
        express: "Express",
        "drizzle-orm": "Drizzle",
        "@trpc/server": "tRPC",
        svelte: "Svelte",
        "@angular/core": "Angular",
        fastify: "Fastify",
        hono: "Hono",
        prisma: "Prisma",
        tsx: "tsx",
        tailwindcss: "Tailwind CSS",
        vite: "Vite",
        esbuild: "esbuild",
        "n8n-workflow": "n8n",
        flask: "Flask",
        "solid-js": "SolidJS",
      };
      for (const [dep, label] of Object.entries(techMap)) {
        if (allDeps[dep]) data.techStack.push({ name: label, source: "env:package.json" });
      }
    }
  } catch {}

  // Git ls-files → dominant languages by extension
  try {
    const files = execWithTimeout("git ls-files", 3000);
    if (files) {
      const truncated = files.slice(0, 10000);
      const extCounts: Record<string, number> = {};
      for (const line of truncated.split("\n")) {
        const ext = path.extname(line).toLowerCase();
        if (ext && ext.length <= 6) extCounts[ext] = (extCounts[ext] || 0) + 1;
      }
      const extToLang: Record<string, string> = {
        ".ts": "TypeScript",
        ".tsx": "TypeScript",
        ".js": "JavaScript",
        ".jsx": "JavaScript",
        ".py": "Python",
        ".rs": "Rust",
        ".go": "Go",
        ".java": "Java",
        ".rb": "Ruby",
        ".dart": "Dart",
        ".swift": "Swift",
        ".kt": "Kotlin",
      };
      const sorted = Object.entries(extCounts).sort((a, b) => b[1] - a[1]);
      for (const [ext] of sorted.slice(0, 3)) {
        const lang = extToLang[ext];
        if (lang && !data.techStack.some((t) => t.name === lang)) {
          data.techStack.push({ name: lang, source: "env:git-ls-files" });
        }
      }
    }
  } catch {}

  return data;
}

// ========================================
// Extraction de profil — Couche B : linguistique
// ========================================

const STOPWORDS = new Set([
  // FR
  "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles",
  "le", "la", "les", "un", "une", "des", "de", "du", "au", "aux",
  "et", "ou", "mais", "donc", "car", "ni", "que", "qui", "quoi",
  "ce", "cette", "ces", "mon", "ton", "son", "ma", "ta", "sa",
  "dans", "sur", "sous", "avec", "sans", "pour", "par", "en",
  "est", "sont", "fait", "faire", "pas", "plus", "bien", "tout",
  "oui", "non", "aussi", "comme", "peut", "faut", "deja", "ici",
  "moi", "toi", "lui", "eux", "nos", "vos", "leurs", "ses",
  // EN
  "the", "a", "an", "is", "are", "was", "were", "be", "been",
  "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "can", "shall", "must",
  "and", "or", "but", "not", "no", "yes", "so", "if", "then",
  "this", "that", "these", "those", "it", "its", "my", "your",
  "his", "her", "our", "their", "what", "which", "who", "whom",
  "how", "when", "where", "why", "all", "each", "every", "both",
  "few", "more", "most", "other", "some", "such", "than", "too",
  "very", "just", "about", "above", "after", "again", "also",
  "any", "because", "before", "between", "come", "from", "get",
  "into", "know", "like", "make", "need", "new", "now", "only",
  "out", "over", "take", "them", "there", "they", "think",
  "time", "use", "want", "way", "work", "with", "you",
  // code common
  "file", "code", "line", "function", "const", "let", "var",
  "true", "false", "null", "undefined", "return", "import",
  "string", "number", "type", "class", "export", "default",
]);

function extractProfileLinguistic(transcript: string): Partial<ProfileData> {
  const data: Partial<ProfileData> = { identity: [], preferences: [], vocabulary: [] };

  const userLines = transcript
    .split("\n")
    .filter((l) => l.startsWith("[user]:") || l.startsWith("[human]:"));
  const userText = userLines.join("\n");

  if (userLines.length === 0) return data;

  // Langue detection: >50% user lines contain FR words
  const frWords =
    /\b(je|tu|on|les|des|dans|pour|avec|est|une|que|pas|sur|qui|mais|comme|cette|mon|ton|faut|fait)\b/i;
  const frCount = userLines.filter((l) => frWords.test(l)).length;
  if (frCount / userLines.length > 0.5) {
    data.preferences!.push({ key: "Langue", value: "francais", source: "transcript" });
  } else {
    data.preferences!.push({ key: "Langue", value: "english", source: "transcript" });
  }

  // Vocabulary: technical terms repeated 3+ times (exclude code blocks)
  const cleanUserText = userText.replace(/```[\s\S]*?```/g, "");
  const words = cleanUserText
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  const wordFreq: Record<string, number> = {};
  for (const w of words) wordFreq[w] = (wordFreq[w] || 0) + 1;

  data.vocabulary = Object.entries(wordFreq)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);

  // Identity fallback (original patterns, used only if env didn't find name)
  const namePatterns = [
    /je m'appelle (\w+)/i,
    /mon nom est (\w+)/i,
    /i'm (\w+)/i,
    /my name is (\w+)/i,
  ];
  for (const p of namePatterns) {
    const match = userText.match(p);
    if (match) {
      data.identity!.push({ key: "Nom", value: match[1], source: "transcript" });
      break;
    }
  }

  return data;
}

// ========================================
// Ecriture du profil
// ========================================

function writeProfileFiles(env: ProfileData, ling: Partial<ProfileData>): void {
  const identityFile = path.join(PROFILE_DIR, "identity.md");
  const projectsFile = path.join(PROFILE_DIR, "projects.md");
  const preferencesFile = path.join(PROFILE_DIR, "preferences.md");
  const vocabularyFile = path.join(PROFILE_DIR, "vocabulary.md");

  // --- identity.md ---
  // Merge: env identity takes priority, linguistic as fallback
  const identityEntries = [...env.identity];
  for (const entry of ling.identity || []) {
    if (!identityEntries.some((e) => e.key === entry.key)) {
      identityEntries.push(entry);
    }
  }

  if (identityEntries.length > 0) {
    const existing = readFile(identityFile);
    const newEntries = identityEntries.filter(
      (e) => !existing.includes(e.value)
    );
    if (newEntries.length > 0) {
      let content = existing && !existing.startsWith("<!--") ? existing : "## Identite";
      for (const e of newEntries) {
        content += `\n- ${e.key}: ${e.value} [${e.source}]`;
      }
      writeFile(identityFile, content);
    }
  }

  // --- projects.md ---
  if (env.projects.length > 0) {
    const existing = readFile(projectsFile);
    const newProjects = env.projects.filter((p) => !existing.includes(p.name));
    if (newProjects.length > 0) {
      let content = existing && !existing.startsWith("<!--") ? existing : "## Projets";
      for (const p of newProjects) {
        content += `\n- ${p.name} [${p.source}, ${p.date}]`;
      }
      writeFile(projectsFile, content);
    }
  }

  // --- preferences.md ---
  const allPrefs = [...(ling.preferences || [])];
  // Add tech stack as preferences
  for (const tech of env.techStack) {
    allPrefs.push({ key: "Tech", value: tech.name, source: tech.source });
  }

  if (allPrefs.length > 0) {
    const existing = readFile(preferencesFile);
    const newPrefs = allPrefs.filter((p) => !existing.includes(p.value));
    if (newPrefs.length > 0) {
      let content = existing && !existing.startsWith("<!--") ? existing : "## Preferences";
      // Group by key for readability
      const grouped: Record<string, ProfileEntry[]> = {};
      for (const p of newPrefs) {
        if (!grouped[p.key]) grouped[p.key] = [];
        grouped[p.key].push(p);
      }
      for (const [, entries] of Object.entries(grouped)) {
        for (const e of entries) {
          content += `\n- ${e.key}: ${e.value} [${e.source}]`;
        }
      }
      writeFile(preferencesFile, content);
    }
  }

  // --- vocabulary.md ---
  const vocab = ling.vocabulary || [];
  if (vocab.length > 0) {
    const existing = readFile(vocabularyFile);
    const newVocab = vocab.filter((v) => !existing.includes(v));
    if (newVocab.length > 0) {
      let content = existing && !existing.startsWith("<!--") ? existing : "## Vocabulaire";
      content += `\n- ${newVocab.join(", ")} [transcript, freq>=3]`;
      writeFile(vocabularyFile, content);
    }
  }
}

// ========================================
// Extraction des erreurs et lecons (v2)
// ========================================

interface FailureEntry {
  ts: string;
  sid: string;
  type: "error" | "failure" | "blocage" | "correction";
  summary: string;
}

function extractFailures(transcript: string, sessionId: string): FailureEntry[] {
  const failures: FailureEntry[] = [];
  const lines = transcript.split("\n");

  // Only scan USER messages, skip code blocks
  let inCodeBlock = false;
  const userContentLines: string[] = [];

  for (const line of lines) {
    // Track code blocks
    if (line.includes("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Only user messages
    if (line.startsWith("[user]:") || line.startsWith("[human]:")) {
      userContentLines.push(line.replace(/^\[(?:user|human)\]:\s*/, ""));
    }
  }

  // Conversational patterns — user-only, context-rich phrases (not bare keywords).
  // FR and EN variants. Grouped by severity.
  const errorPatterns = [
    // Error: user reports an error
    { pattern: /j'ai (?:une|eu une|cette) erreur|il y a une erreur|y'?a une erreur|there'?s an error|i got an error|i have an error|i'?m getting (?:an |this )?error/i, type: "error" as const },
    { pattern: /erreur (?:quand|lorsque|si|au moment)|error (?:when|while|after|during)/i, type: "error" as const },

    // Failure: something doesn't work
    { pattern: /(?:ca|ça) (?:ne )?(?:marche|fonctionne) (?:pas|plus)|doesn'?t work|it'?s (?:not working|broken)|it broke|c'est (?:casse|cassé)|(?:ca|ça) plante|(?:ca|ça) crash/i, type: "failure" as const },
    { pattern: /(?:toujours|encore) (?:le meme |la meme )?(?:bug|probleme|erreur)|still (?:broken|failing|not working)|same (?:bug|issue|error)/i, type: "failure" as const },
    { pattern: /(?:ca|ça) (?:a |ne |n'a )(?:pas |)(?:marche|fonctionne|resolu|corrige)|didn'?t (?:work|fix|help|solve)/i, type: "failure" as const },

    // Blocage: user is stuck
    { pattern: /je suis (?:bloque|bloqu[eé])|je (?:n')?(?:y )?arrive pas|i'?m stuck|i can'?t (?:figure|get|make)|je ne (?:comprends|sais) pas (?:pourquoi|comment)/i, type: "blocage" as const },
    { pattern: /on (?:n')?avance (?:pas|plus)|(?:ca|ça) (?:ne )?(?:bouge|avance) (?:pas|plus)|we'?re? stuck|can'?t (?:proceed|continue|move forward)/i, type: "blocage" as const },

    // Correction: user confirms fix
    { pattern: /c'est (?:corrig[eé]|r[eé]par[eé]|r[eé]solu|r[eé]gl[eé])|(?:it'?s|that'?s) (?:fixed|resolved|solved)|(?:ca|ça) (?:re)?marche (?:maintenant|enfin)/i, type: "correction" as const },
    { pattern: /(?:ok|bien|bon|parfait|top|nickel),? (?:ca|ça) (?:marche|fonctionne)|(?:ok|good|great|nice),? (?:it |that )?works/i, type: "correction" as const },
  ];

  for (const line of userContentLines) {
    if (failures.length >= 5) break;

    for (const { pattern, type } of errorPatterns) {
      if (pattern.test(line)) {
        const summary = line.slice(0, 150);

        // Deduplicate
        const isDuplicate = failures.some(
          (f) => f.type === type && f.summary.slice(0, 50) === summary.slice(0, 50)
        );

        if (!isDuplicate && summary.length > 10) {
          failures.push({
            ts: new Date().toISOString(),
            sid: sessionId.slice(0, 8),
            type,
            summary,
          });
        }
        break;
      }
    }
  }

  return failures;
}

/**
 * Analyse le sentiment global de la session.
 * Retourne un score 1-5 base sur les patterns detectes.
 */
function analyzeSentiment(transcript: string): number {
  const positivePatterns = [
    /merci|thanks|parfait|perfect|genial|great|excellent|bravo/i,
    /ca marche|it works|fonctionne|resolved|resolu|fixed/i,
    /bien joue|good job|nicely done|impeccable/i,
  ];
  const negativePatterns = [
    /frustre|frustrated|enerve|angry|merde|damn|putain/i,
    /ne marche pas|doesn't work|broken|casse|bug/i,
    /recommence|start over|tout refaire|redo/i,
    /non|pas ca|wrong|incorrect|faux|erreur/i,
  ];

  let score = 3; // Neutre par defaut
  const userText = transcript
    .split("\n")
    .filter((l) => l.startsWith("[user]:") || l.startsWith("[human]:"))
    .join("\n");

  for (const p of positivePatterns) {
    if (p.test(userText)) score += 0.5;
  }
  for (const p of negativePatterns) {
    if (p.test(userText)) score -= 0.5;
  }

  return Math.max(1, Math.min(5, Math.round(score)));
}

// ========================================
// Sauvegarde des learnings (JSONL)
// ========================================

function saveFailures(failures: FailureEntry[]): void {
  if (failures.length === 0) return;
  for (const f of failures) {
    appendJsonl(FAILURES_LOG, f);
  }
}

function saveSentiment(sessionId: string, sentiment: number, messageCount: number): void {
  appendJsonl(SENTIMENT_LOG, {
    sid: sessionId.slice(0, 8),
    score: sentiment,
    messages: messageCount,
    ts: new Date().toISOString(),
  });
}

// ========================================
// Cleanup flags + legacy migration
// ========================================

function cleanupOldFlags(): void {
  try {
    const flagPrefix = ".extraction-done-";
    const files = fs.readdirSync(MEMORY_DIR)
      .filter((f) => f.startsWith(flagPrefix))
      .map((f) => ({
        name: f,
        mtime: fs.statSync(path.join(MEMORY_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    // Keep only the 5 most recent
    for (const file of files.slice(5)) {
      try {
        fs.unlinkSync(path.join(MEMORY_DIR, file.name));
      } catch {}
    }
  } catch {}
}

function migrateLegacyPAI(): void {
  // One-shot migration, gated by flag
  if (fs.existsSync(MIGRATION_FLAG)) return;

  const HORA_START = new Date("2026-02-19T00:00:00Z").getTime();

  // Migrate ALGORITHM pre-19/02 → _legacy/
  try {
    const algoDir = path.join(LEARNING_DIR, "ALGORITHM", "2026-02");
    if (fs.existsSync(algoDir)) {
      const legacyDir = path.join(LEARNING_DIR, "ALGORITHM", "_legacy");
      fs.mkdirSync(legacyDir, { recursive: true });
      for (const f of fs.readdirSync(algoDir)) {
        if (f.startsWith(".")) continue;
        try {
          const filePath = path.join(algoDir, f);
          const stat = fs.statSync(filePath);
          if (stat.mtimeMs < HORA_START) {
            fs.renameSync(filePath, path.join(legacyDir, f));
          }
        } catch {}
      }
    }
  } catch {}

  // Migrate FAILURES pre-19/02 → _legacy/
  try {
    const failDir = path.join(LEARNING_DIR, "FAILURES", "2026-02");
    if (fs.existsSync(failDir)) {
      const legacyDir = path.join(LEARNING_DIR, "FAILURES", "_legacy");
      fs.mkdirSync(legacyDir, { recursive: true });
      for (const f of fs.readdirSync(failDir)) {
        if (f.startsWith(".")) continue;
        try {
          const filePath = path.join(failDir, f);
          const stat = fs.statSync(filePath);
          if (stat.mtimeMs < HORA_START) {
            fs.renameSync(filePath, path.join(legacyDir, f));
          }
        } catch {}
      }
    }
  } catch {}

  // Mark migration as done
  try {
    writeFile(MIGRATION_FLAG, new Date().toISOString());
  } catch {}
}

// ========================================
// Main
// ========================================

async function main() {
  if (isSubagent) process.exit(0);

  const input = await new Promise<string>((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    setTimeout(() => resolve(data), 3000);
  });

  let hookData: HookInput = {};
  try {
    hookData = JSON.parse(input);
  } catch {}

  const sessionId = hookData.session_id || "unknown";
  const transcriptPath = hookData.transcript_path;

  // --- Thread state: sauvegarder le dernier message assistant (a chaque Stop) ---
  if (transcriptPath) {
    try {
      const lastAssistant =
        hookData.last_assistant_message || extractLastAssistantMessage(transcriptPath);
      const summary = summarizeAssistantResponse(lastAssistant);
      if (summary.length > 10) {
        // Recuperer le nom de session
        let sessionName = "Sans nom";
        try {
          const names = JSON.parse(
            fs.readFileSync(path.join(MEMORY_DIR, "STATE", "session-names.json"), "utf-8")
          );
          sessionName = names[sessionId] || "Sans nom";
        } catch {}

        // Generer un resume de session (premier + dernier echanges significatifs)
        let sessionSummary = "";
        try {
          const transcript = parseTranscript(transcriptPath);
          if (transcript) {
            const tLines = transcript.split("\n").filter((l) => l.trim().length > 20);
            const userLines = tLines.filter(
              (l) => l.startsWith("[user]:") || l.startsWith("[human]:")
            );
            const assistLines = tLines.filter((l) => l.startsWith("[assistant]:"));
            const summaryParts: string[] = [];
            if (userLines.length > 0) summaryParts.push(userLines[0].slice(0, 150));
            if (assistLines.length > 0) summaryParts.push(assistLines[0].slice(0, 150));
            if (userLines.length > 1)
              summaryParts.push(userLines[userLines.length - 1].slice(0, 150));
            sessionSummary = summaryParts.join(" | ");
          }
        } catch {}

        const threadFile = stateSessionFile(sessionId, "thread-state");
        fs.mkdirSync(path.dirname(threadFile), { recursive: true });
        fs.writeFileSync(
          threadFile,
          JSON.stringify({
            session_id: sessionId.slice(0, 8),
            project: getProjectId(),
            timestamp: new Date().toISOString(),
            assistant_summary: summary,
            raw_length: lastAssistant.length,
            session_name: sessionName,
            session_summary: sessionSummary || summary,
          }),
          "utf-8"
        );
      }
    } catch {}
  }

  // Lire l'etat de session
  let state: any = {};
  try {
    const sessionStateFile = memorySessionFile(sessionId, "session-state");
    state = JSON.parse(fs.readFileSync(sessionStateFile, "utf-8"));
  } catch {}

  // --- Thread: extraire TOUTES les paires user/assistant du transcript ---
  if (transcriptPath) {
    try {
      const allExchanges = extractAllExchanges(transcriptPath, sessionId, getProjectId());
      writeAllThreadEntries(allExchanges);
    } catch {}
  }

  // Si pas de transcript ou session trop courte, skip extraction complete
  if (!transcriptPath || (state.messageCount || 0) < 3) {
    process.exit(0);
  }

  // Verifier si extraction recente pour cette session (re-extraction toutes les 2h)
  const EXTRACTION_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes
  const flagFile = `${EXTRACTED_FLAG}-${sessionId.slice(0, 8)}`;
  let isReExtraction = false;
  try {
    if (fs.existsSync(flagFile)) {
      const lastExtraction = new Date(fs.readFileSync(flagFile, "utf-8").trim()).getTime();
      if (Date.now() - lastExtraction < EXTRACTION_INTERVAL_MS) {
        process.exit(0); // Extraction recente, skip
      }
      isReExtraction = true; // Extraction perimee, on re-extrait
    }
  } catch {}

  // Lire le transcript
  const transcript = parseTranscript(transcriptPath);
  if (!transcript || transcript.length < 200) {
    process.exit(0);
  }

  // Marquer l'extraction comme faite (timestamp, pas booleen)
  fs.mkdirSync(path.dirname(flagFile), { recursive: true });
  fs.writeFileSync(flagFile, new Date().toISOString());

  // --- 1. Extraction de profil (hybride env + linguistique) ---
  const envProfile = extractProfileEnv();
  const lingProfile = extractProfileLinguistic(transcript);
  writeProfileFiles(envProfile, lingProfile);

  // --- 1.5. Signal extraction (cross-session crystallization) ---
  try {
    const { extractPreferenceSignals, appendSignals } = await import("./lib/signal-tracker.js");
    const signals = extractPreferenceSignals(transcript, sessionId);
    if (signals.length > 0) {
      appendSignals(path.join(LEARNING_DIR, "SIGNALS", "preference-signals.jsonl"), signals);
    }
  } catch {}

  // --- 2. Extraction des erreurs et lecons (JSONL) ---
  const failures = extractFailures(transcript, sessionId);
  saveFailures(failures);

  // --- 3. Analyse de sentiment (JSONL) ---
  const sentiment = analyzeSentiment(transcript);
  saveSentiment(sessionId, sentiment, state.messageCount || 0);

  // --- 4. Archive de session (update si re-extraction) ---
  let sessionFile = path.join(SESSIONS_DIR, `${timestamp()}_${sessionId.slice(0, 8)}.md`);
  if (isReExtraction) {
    // Trouver l'archive existante pour cette session
    try {
      const existing = fs.readdirSync(SESSIONS_DIR)
        .filter(f => f.endsWith(`_${sessionId.slice(0, 8)}.md`))
        .sort()
        .pop();
      if (existing) sessionFile = path.join(SESSIONS_DIR, existing);
    } catch {}
  }
  const sessionName = (() => {
    try {
      const names = JSON.parse(
        fs.readFileSync(path.join(MEMORY_DIR, "STATE", "session-names.json"), "utf-8")
      );
      return names[sessionId] || "Sans nom";
    } catch {
      return "Sans nom";
    }
  })();

  writeFile(
    sessionFile,
    `# Session : ${sessionName}\n\n` +
      `- **ID** : ${sessionId}\n` +
      `- **Projet** : ${PROJECT_DISPLAY}\n` +
      `- **ProjetID** : ${getProjectId()}\n` +
      `- **Messages** : ${state.messageCount || "?"}\n` +
      `- **Sentiment** : ${sentiment}/5\n` +
      `- **Erreurs detectees** : ${failures.length}\n` +
      `- **Date** : ${new Date().toISOString()}\n\n` +
      `---\n\n${transcript.slice(0, 5000)}`
  );

  // --- 5. Cleanup flags + legacy migration ---
  cleanupOldFlags();
  migrateLegacyPAI();

  // --- 6. Memory lifecycle: expire T2 + promote to T3 ---
  // Silencieux: respecte le GC interval (6h) et le lock file
  try {
    await runMemoryLifecycle(MEMORY_DIR);
  } catch {}

  // --- 7. Knowledge Graph enrichment ---
  try {
    const graphDir = path.join(MEMORY_DIR, "GRAPH");
    fs.mkdirSync(graphDir, { recursive: true });
    const graph = new HoraGraph(graphDir);

    // Build session archive for extraction
    const archive = transcript.slice(0, 5000);
    const toolUsage: Record<string, number> = {};
    try {
      const toolLog = path.join(MEMORY_DIR, ".tool-usage.jsonl");
      const raw = fs.readFileSync(toolLog, "utf-8").trim();
      for (const line of raw.split("\n").slice(-50)) {
        try {
          const e = JSON.parse(line);
          if (e.session === sessionId.slice(0, 8) && e.tool) {
            toolUsage[e.tool] = (toolUsage[e.tool] || 0) + (e.count || 1);
          }
        } catch {}
      }
    } catch {}

    await buildGraphFromSession(graph, {
      sessionId,
      archive,
      failures,
      sentiment,
      toolUsage,
      projectId: getProjectId(),
    });

    // Lazy migration of existing sessions (max 3 per run)
    if (!fs.existsSync(path.join(graphDir, ".migrated"))) {
      await migrateExistingData(graph, MEMORY_DIR);
    }

    graph.save();
  } catch {
    // Echec silencieux — graph enrichment is best-effort
  }

  // NE PAS supprimer le state file — il est utilise par prompt-submit
  // pour detecter isFirst. Il sera ecrase naturellement par la session suivante.

  // Dispose ONNX pipeline to avoid native thread crash on exit
  await disposeEmbedder();

  process.exit(0);
}

main().catch(() => process.exit(0));
