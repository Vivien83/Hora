#!/usr/bin/env npx tsx
/**
 * HORA — hook: hora-session-name (UserPromptSubmit)
 * Nomme automatiquement chaque session avec un slug descriptif
 * a partir du premier prompt utilisateur.
 *
 * TRIGGER: UserPromptSubmit
 *
 * LOGIQUE:
 *   - Premier prompt → extraire mots-cles → generer nom 2-3 mots
 *   - Prompts suivants → skip (nom deja defini)
 *   - Sauvegarde dans MEMORY/STATE/session-names.json
 *   - Cache rapide dans MEMORY/STATE/session-name-cache.sh
 */

import * as fs from "fs";
import * as path from "path";
import { homedir } from "os";

const CLAUDE_DIR = path.join(homedir(), ".claude");
const MEMORY_DIR = path.join(CLAUDE_DIR, "MEMORY");
const STATE_DIR = path.join(MEMORY_DIR, "STATE");
const NAMES_FILE = path.join(STATE_DIR, "session-names.json");
const CACHE_FILE = path.join(STATE_DIR, "session-name-cache.sh");

interface HookInput {
  session_id?: string;
  message?: string;
  prompt?: string;
  user_prompt?: string;
}

interface SessionNames {
  [sessionId: string]: string;
}

// Mots a ignorer pour l'extraction de mots-cles
const NOISE_WORDS = new Set([
  // Francais
  "le", "la", "les", "un", "une", "des", "du", "de", "au", "aux",
  "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles",
  "mon", "ton", "son", "ma", "ta", "sa", "mes", "tes", "ses",
  "ce", "cet", "cette", "ces", "est", "sont", "suis", "etre",
  "avoir", "fait", "faire", "dans", "sur", "avec", "pour", "par",
  "que", "qui", "quoi", "comment", "pourquoi", "quand", "ou",
  "pas", "plus", "mais", "donc", "car", "ni", "ou", "et",
  "tout", "tous", "toute", "toutes", "bien", "bon", "moi", "toi",
  "peu", "tres", "aussi", "deja", "encore", "ici", "avant",
  "apres", "maintenant", "juste", "veux", "peux", "dois", "faut",
  // Anglais commun
  "the", "a", "an", "i", "my", "we", "you", "your", "this", "that", "it",
  "is", "are", "was", "were", "do", "does", "did", "can", "could", "should",
  "would", "will", "have", "has", "had", "just", "also", "need", "want",
  "please", "help", "work", "task", "update", "new", "check",
  "make", "get", "set", "put", "use", "run", "try", "let", "see", "look",
  "fix", "add", "create", "build", "deploy", "code", "read", "write",
  "what", "how", "why", "when", "where", "which", "who", "there", "here",
  "not", "but", "and", "for", "with", "from", "about", "into",
  // Generiques dev
  "fichier", "page", "composant", "fonction", "variable", "module",
  "file", "component", "function",
]);

function readNames(): SessionNames {
  try {
    if (fs.existsSync(NAMES_FILE)) {
      return JSON.parse(fs.readFileSync(NAMES_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function writeNames(names: SessionNames): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(NAMES_FILE, JSON.stringify(names, null, 2), "utf-8");
}

function writeCache(sessionId: string, label: string): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(
    CACHE_FILE,
    `cached_session_id='${sessionId}'\ncached_session_label='${label}'\n`,
    "utf-8"
  );
}

/**
 * Nettoie le prompt des artefacts techniques avant extraction
 */
function sanitize(prompt: string): string {
  return prompt
    .replace(/<[^>]+>/g, " ")                    // Tags XML
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, " ") // UUIDs
    .replace(/\b[0-9a-f]{7,}\b/gi, " ")         // Hash hex
    .replace(/(?:\/[\w.-]+){2,}/g, " ")          // Chemins de fichiers
    .replace(/https?:\/\/\S+/g, " ")             // URLs
    .replace(/[{}()\[\]"'`]/g, " ")              // Brackets et quotes
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrait un nom de session 2-3 mots a partir du prompt.
 * Strategie : prendre les 2-3 premiers mots substantiels.
 */
function extractName(prompt: string): string | null {
  const cleaned = sanitize(prompt);

  // Extraire les mots substantiels (4+ lettres, pas du bruit)
  const words = cleaned
    .replace(/[^a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !NOISE_WORDS.has(w.toLowerCase()));

  if (words.length === 0) return null;

  // Prendre 2-3 mots, capitaliser
  const selected = words.slice(0, 3);
  const label = selected
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  // Verifier que le nom fait sens (au moins 2 mots de 4+ chars)
  const substantialWords = selected.filter((w) => w.length >= 4);
  if (substantialWords.length < 1) return null;

  // Si un seul mot, ajouter "Session"
  if (selected.length === 1) {
    return `${label} Session`;
  }

  return label;
}

async function main() {
  const input = await new Promise<string>((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    // Timeout de securite
    setTimeout(() => resolve(data), 2000);
  });

  let hookData: HookInput = {};
  try {
    hookData = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const sessionId = hookData.session_id;
  if (!sessionId) process.exit(0);

  const names = readNames();

  // Si session deja nommee → skip
  if (names[sessionId]) {
    process.exit(0);
  }

  // Extraire le prompt
  const rawPrompt = hookData.message || hookData.prompt || hookData.user_prompt || "";
  if (!rawPrompt || rawPrompt.length < 5) {
    process.exit(0);
  }

  // Generer le nom
  const name = extractName(rawPrompt);
  if (!name) {
    process.exit(0);
  }

  // Sauvegarder
  names[sessionId] = name;
  writeNames(names);
  writeCache(sessionId, name);

  console.error(`[HORA Session] Nommee : "${name}"`);
  process.exit(0);
}

main().catch(() => process.exit(0));
