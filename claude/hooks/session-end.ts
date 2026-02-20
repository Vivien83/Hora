#!/usr/bin/env npx tsx
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

const CLAUDE_DIR = path.join(homedir(), ".claude");
const MEMORY_DIR = path.join(CLAUDE_DIR, "MEMORY");
const PROFILE_DIR = path.join(MEMORY_DIR, "PROFILE");
const LEARNING_DIR = path.join(MEMORY_DIR, "LEARNING");
const SESSIONS_DIR = path.join(MEMORY_DIR, "SESSIONS");
const STATE_FILE = path.join(MEMORY_DIR, ".session-state.json");
const EXTRACTED_FLAG = path.join(MEMORY_DIR, ".extraction-done");
const THREAD_STATE_FILE = path.join(MEMORY_DIR, "STATE", "thread-state.json");

const isSubagent = process.argv.includes("--subagent");

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  last_assistant_message?: string;
}

// ========================================
// Utilitaires
// ========================================

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

function appendFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, "\n\n" + content, "utf-8");
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function yearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
// Extraction de profil
// ========================================

function extractProfile(transcript: string): Record<string, string[]> {
  const extracted: Record<string, string[]> = {
    identity: [],
    projects: [],
    preferences: [],
  };

  const userLines = transcript
    .split("\n")
    .filter((l) => l.startsWith("[user]:") || l.startsWith("[human]:"));
  const userText = userLines.join("\n");

  // Identite
  const namePatterns = [
    /je m'appelle (\w+)/i,
    /mon nom est (\w+)/i,
    /i'm (\w+)/i,
    /my name is (\w+)/i,
  ];
  namePatterns.forEach((p) => {
    const match = userText.match(p);
    if (match) extracted.identity.push(`Nom: ${match[1]}`);
  });

  // Domaine/projets
  const domainPatterns = [
    /je travaille (?:dans|sur|en) ([^.!?\n]{5,40})/i,
    /mon domaine (?:est|c'est) ([^.!?\n]{5,40})/i,
    /i work (?:on|in|with) ([^.!?\n]{5,40})/i,
  ];
  domainPatterns.forEach((p) => {
    const match = userText.match(p);
    if (match) extracted.projects.push(match[1].trim());
  });

  // Preferences de code
  const langPatterns: [RegExp, string][] = [
    [/\bj'utilise (python|typescript|rust|flutter|dart|go|java)\b/i, "Langage"],
    [/\bje code en (python|typescript|rust|flutter|dart|go|java)\b/i, "Langage"],
    [/\bj'utilise (n8n|flask|solidjs|nextjs|react|vue|angular)\b/i, "Framework"],
    [/\bje bosse avec (n8n|flask|solidjs|nextjs|react|vue|angular)\b/i, "Framework"],
  ];
  langPatterns.forEach(([pattern, category]) => {
    const match = userText.match(pattern);
    if (match) {
      const val = `${category}: ${match[1]}`;
      if (!extracted.preferences.includes(val)) {
        extracted.preferences.push(val);
      }
    }
  });

  return extracted;
}

// ========================================
// Extraction des erreurs et lecons
// ========================================

interface FailureEntry {
  timestamp: string;
  session_id: string;
  type: "error" | "failure" | "blocage" | "correction";
  summary: string;
  context: string;
  sentiment: number; // 1-5 (1=frustre, 5=satisfait)
}

function extractFailures(transcript: string, sessionId: string): FailureEntry[] {
  const failures: FailureEntry[] = [];
  const lines = transcript.split("\n");

  // Patterns d'erreurs dans les messages assistant
  const errorPatterns = [
    { pattern: /error|erreur|echoue|failed|echec/i, type: "error" as const },
    { pattern: /bug|broken|casse|ne fonctionne pas|doesn't work/i, type: "failure" as const },
    { pattern: /bloque|stuck|impossible|cannot|can't/i, type: "blocage" as const },
    { pattern: /corrige|fixed|resolu|solved|repare/i, type: "correction" as const },
  ];

  // Scanner le transcript par blocs de ~5 lignes
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    for (const { pattern, type } of errorPatterns) {
      if (pattern.test(line)) {
        // Capturer le contexte (2 lignes avant, 2 apres)
        const contextStart = Math.max(0, i - 2);
        const contextEnd = Math.min(lines.length, i + 3);
        const context = lines.slice(contextStart, contextEnd).join("\n").slice(0, 500);

        // Extraire un resume court
        const summary = line
          .replace(/^\[(?:assistant|user|human)\]:\s*/, "")
          .slice(0, 150);

        // Eviter les doublons (meme type + meme debut de summary)
        const isDuplicate = failures.some(
          (f) => f.type === type && f.summary.slice(0, 50) === summary.slice(0, 50)
        );

        if (!isDuplicate && summary.length > 10) {
          failures.push({
            timestamp: new Date().toISOString(),
            session_id: sessionId,
            type,
            summary,
            context,
            sentiment: type === "correction" ? 4 : type === "blocage" ? 2 : 3,
          });
        }
        break; // Une seule correspondance par ligne
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
// Sauvegarde des learnings
// ========================================

function saveFailures(failures: FailureEntry[]): void {
  if (failures.length === 0) return;

  const ym = yearMonth();
  const dir = path.join(LEARNING_DIR, "FAILURES", ym);
  fs.mkdirSync(dir, { recursive: true });

  const ts = timestamp();
  const slug = failures[0].summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);

  const filename = `${ts}_${slug}.md`;
  const filePath = path.join(dir, filename);

  let content = `# Lecons de session — ${ts}\n\n`;
  content += `**Nombre d'evenements** : ${failures.length}\n\n`;

  for (const f of failures) {
    content += `## ${f.type.toUpperCase()} — ${f.summary.slice(0, 80)}\n\n`;
    content += `- **Type** : ${f.type}\n`;
    content += `- **Sentiment** : ${"*".repeat(f.sentiment)}/5\n`;
    content += `- **Session** : ${f.session_id.slice(0, 8)}\n\n`;
    content += `### Contexte\n\`\`\`\n${f.context}\n\`\`\`\n\n---\n\n`;
  }

  content += `*Extrait automatiquement par HORA session-end*\n`;
  writeFile(filePath, content);
}

function saveSentiment(sessionId: string, sentiment: number, messageCount: number): void {
  const ym = yearMonth();
  const dir = path.join(LEARNING_DIR, "ALGORITHM", ym);
  fs.mkdirSync(dir, { recursive: true });

  const ts = timestamp();
  const filename = `${ts}_LEARNING_sentiment-rating-${sentiment}.md`;
  const filePath = path.join(dir, filename);

  writeFile(
    filePath,
    `# Sentiment de session\n\n` +
      `- **Session** : ${sessionId.slice(0, 8)}\n` +
      `- **Score** : ${sentiment}/5\n` +
      `- **Messages** : ${messageCount}\n` +
      `- **Date** : ${new Date().toISOString()}\n\n` +
      `*Extrait automatiquement par HORA session-end*\n`
  );
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
            const userLines = tLines.filter((l) => l.startsWith("[user]:") || l.startsWith("[human]:"));
            const assistLines = tLines.filter((l) => l.startsWith("[assistant]:"));
            const summaryParts: string[] = [];
            if (userLines.length > 0) summaryParts.push(userLines[0].slice(0, 150));
            if (assistLines.length > 0) summaryParts.push(assistLines[0].slice(0, 150));
            if (userLines.length > 1) summaryParts.push(userLines[userLines.length - 1].slice(0, 150));
            sessionSummary = summaryParts.join(" | ");
          }
        } catch {}

        fs.mkdirSync(path.dirname(THREAD_STATE_FILE), { recursive: true });
        fs.writeFileSync(
          THREAD_STATE_FILE,
          JSON.stringify({
            session_id: sessionId.slice(0, 8),
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
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {}

  // Si pas de transcript ou session trop courte, skip extraction complete
  if (!transcriptPath || (state.messageCount || 0) < 3) {
    process.exit(0);
  }

  // Verifier si extraction deja faite pour cette session
  const flagFile = `${EXTRACTED_FLAG}-${sessionId.slice(0, 8)}`;
  if (fs.existsSync(flagFile)) {
    process.exit(0);
  }

  // Lire le transcript
  const transcript = parseTranscript(transcriptPath);
  if (!transcript || transcript.length < 200) {
    process.exit(0);
  }

  // Marquer l'extraction comme faite
  fs.mkdirSync(path.dirname(flagFile), { recursive: true });
  fs.writeFileSync(flagFile, new Date().toISOString());

  // --- 1. Extraction de profil ---
  const extracted = extractProfile(transcript);

  const identityFile = path.join(PROFILE_DIR, "identity.md");
  const projectsFile = path.join(PROFILE_DIR, "projects.md");
  const preferencesFile = path.join(PROFILE_DIR, "preferences.md");

  if (extracted.identity.length > 0) {
    const existing = readFile(identityFile);
    const newInfo = extracted.identity.filter((i) => !existing.includes(i));
    if (newInfo.length > 0) appendFile(identityFile, newInfo.join("\n"));
  }

  if (extracted.projects.length > 0) {
    const existing = readFile(projectsFile);
    const newInfo = extracted.projects.filter((p) => !existing.includes(p));
    if (newInfo.length > 0)
      appendFile(projectsFile, `\n### Session ${timestamp()}\n` + newInfo.join("\n"));
  }

  if (extracted.preferences.length > 0) {
    const existing = readFile(preferencesFile);
    const newInfo = extracted.preferences.filter((p) => !existing.includes(p));
    if (newInfo.length > 0) appendFile(preferencesFile, newInfo.join("\n"));
  }

  // --- 2. Extraction des erreurs et lecons ---
  const failures = extractFailures(transcript, sessionId);
  saveFailures(failures);

  // --- 3. Analyse de sentiment ---
  const sentiment = analyzeSentiment(transcript);
  saveSentiment(sessionId, sentiment, state.messageCount || 0);

  // --- 4. Archive de session ---
  const sessionFile = path.join(
    SESSIONS_DIR,
    `${timestamp()}_${sessionId.slice(0, 8)}.md`
  );
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
      `- **Messages** : ${state.messageCount || "?"}\n` +
      `- **Sentiment** : ${sentiment}/5\n` +
      `- **Erreurs detectees** : ${failures.length}\n` +
      `- **Date** : ${new Date().toISOString()}\n\n` +
      `---\n\n${transcript.slice(0, 5000)}`
  );

  // NE PAS supprimer le state file — il est utilise par prompt-submit
  // pour detecter isFirst. Il sera ecrase naturellement par la session suivante.

  process.exit(0);
}

main().catch(() => process.exit(0));
