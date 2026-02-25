#!/usr/bin/env npx tsx
if (process.env.HORA_SKIP_HOOKS === "1") process.exit(0);
/**
 * HORA — hook: hora-security (PreToolUse)
 * Valide chaque commande Bash et operation fichier avant execution.
 * Bloque les ops catastrophiques, demande confirmation pour les dangereuses.
 *
 * TRIGGER: PreToolUse (matcher: Bash|Edit|Write|Read|MultiEdit)
 *
 * SORTIE:
 *   {"continue": true}                     → Autorise
 *   {"decision": "ask", "message": "..."}  → Demande confirmation
 *   exit(2)                                → Blocage dur
 *
 * LOGGING: MEMORY/SECURITY/YYYY/MM/security-{resume}-{timestamp}.jsonl
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ========================================
// Parser YAML minimal (zero dependance)
// Cible : patterns.yaml de HORA uniquement
// Supporte : scalaires, listes simples, listes d'objets {pattern, reason}
// ========================================

function parseYaml(content: string): any {
  const lines = content.split("\n");
  const result: any = {};

  // Etat du parsing
  const objStack: { obj: any; indent: number }[] = [{ obj: result, indent: -2 }];
  let currentArray: any[] | null = null;
  let currentArrayIndent = -1;
  let lastArrayItem: any = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed === "---") continue;

    const indent = rawLine.search(/\S/);

    // Si on est dans un array et que l'indent revient en arriere, on sort de l'array
    if (currentArray && indent <= currentArrayIndent && !trimmed.startsWith("- ")) {
      currentArray = null;
      lastArrayItem = null;
    }

    // Ligne "- " : element d'array
    if (trimmed.startsWith("- ")) {
      const itemContent = trimmed.slice(2).trim();

      if (!currentArray) {
        // On devrait etre dans un array — trouver le parent
        // Normalement currentArray est deja set par la cle parente
        continue;
      }

      // "- pattern: valeur" → objet dans l'array
      const kvMatch = itemContent.match(/^([a-zA-Z_]+):\s*(.*)/);
      if (kvMatch) {
        const key = kvMatch[1];
        const val = unquote(kvMatch[2].trim());
        const obj: any = { [key]: val };
        currentArray.push(obj);
        lastArrayItem = obj;
      } else {
        // "- valeur" → string simple dans l'array
        const val = unquote(itemContent);
        currentArray.push(val);
        lastArrayItem = null;
      }
      continue;
    }

    // Ligne "key: value" ou "key:"
    const kvMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)/);
    if (kvMatch) {
      const key = kvMatch[1];
      const rawValue = kvMatch[2].trim();

      // Si on est dans un array et c'est une propriete supplementaire du dernier item
      if (lastArrayItem && typeof lastArrayItem === "object" && indent > currentArrayIndent + 2) {
        lastArrayItem[key] = unquote(rawValue);
        continue;
      }

      // Trouver le parent correct selon l'indentation
      while (objStack.length > 1 && objStack[objStack.length - 1].indent >= indent) {
        objStack.pop();
      }
      const parent = objStack[objStack.length - 1].obj;

      if (rawValue === "" || rawValue === "[]") {
        // Cle sans valeur → peut etre un objet ou un array
        // Regarder la prochaine ligne non-vide pour determiner
        const isArray = rawValue === "[]" || peekIsArray(lines, rawLine);

        if (isArray) {
          parent[key] = [];
          currentArray = parent[key];
          currentArrayIndent = indent;
          lastArrayItem = null;
        } else {
          parent[key] = {};
          objStack.push({ obj: parent[key], indent });
          currentArray = null;
          lastArrayItem = null;
        }
      } else {
        // Valeur scalaire
        parent[key] = unquote(rawValue);
        // Pas dans un array
        if (indent <= currentArrayIndent) {
          currentArray = null;
          lastArrayItem = null;
        }
      }
      continue;
    }
  }

  return result;
}

function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function peekIsArray(lines: string[], currentLine: string): boolean {
  const idx = lines.indexOf(currentLine);
  for (let i = idx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith("#")) continue;
    return t.startsWith("- ");
  }
  return false;
}

const CLAUDE_DIR = join(homedir(), ".claude");
const HORA_DIR = join(CLAUDE_DIR, ".hora");
const MEMORY_DIR = join(CLAUDE_DIR, "MEMORY");
const PATTERNS_PATH = join(HORA_DIR, "patterns.yaml");

// ========================================
// Types
// ========================================

interface HookInput {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown> | string;
}

interface Pattern {
  pattern: string;
  reason: string;
}

interface PatternsConfig {
  version: string;
  philosophy: { mode: string; principle: string };
  bash: {
    blocked: Pattern[];
    confirm: Pattern[];
    alert: Pattern[];
  };
  paths: {
    zeroAccess: string[];
    readOnly: string[];
    confirmWrite: string[];
    noDelete: string[];
  };
}

interface SecurityEvent {
  timestamp: string;
  session_id: string;
  event_type: "block" | "confirm" | "alert" | "allow";
  tool: string;
  category: "bash_command" | "path_access";
  target: string;
  pattern_matched?: string;
  reason?: string;
  action_taken: string;
}

// ========================================
// Logging
// ========================================

function generateSlug(event: SecurityEvent): string {
  const source = event.reason || event.target || "unknown";
  const words = source
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 4);
  return [event.event_type, ...words].join("-");
}

function logSecurityEvent(event: SecurityEvent): void {
  try {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const slug = generateSlug(event);

    const dir = join(MEMORY_DIR, "SECURITY", year, month);
    mkdirSync(dir, { recursive: true });

    const filePath = join(dir, `security-${slug}-${ts}.jsonl`);
    writeFileSync(filePath, JSON.stringify(event, null, 2));
  } catch {
    // Erreur de log ne doit jamais bloquer
  }
}

// ========================================
// Chargement des patterns
// ========================================

let patternsCache: PatternsConfig | null = null;

function loadPatterns(): PatternsConfig {
  if (patternsCache) return patternsCache;

  if (!existsSync(PATTERNS_PATH)) {
    return {
      version: "0.0",
      philosophy: { mode: "permissive", principle: "Pas de fichier patterns" },
      bash: { blocked: [], confirm: [], alert: [] },
      paths: { zeroAccess: [], readOnly: [], confirmWrite: [], noDelete: [] },
    };
  }

  try {
    const content = readFileSync(PATTERNS_PATH, "utf-8");
    patternsCache = parseYaml(content) as PatternsConfig;
    return patternsCache;
  } catch {
    return {
      version: "0.0",
      philosophy: { mode: "permissive", principle: "Erreur de parsing" },
      bash: { blocked: [], confirm: [], alert: [] },
      paths: { zeroAccess: [], readOnly: [], confirmWrite: [], noDelete: [] },
    };
  }
}

// ========================================
// Normalisation de commande
// ========================================

function stripEnvVarPrefix(command: string): string {
  return command.replace(
    /^\s*(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]*)\s+)*/,
    ""
  );
}

// ========================================
// Pattern matching
// ========================================

function matchesPattern(command: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern, "i");
    return regex.test(command);
  } catch {
    return command.toLowerCase().includes(pattern.toLowerCase());
  }
}

function expandPath(p: string): string {
  if (p.startsWith("~")) return p.replace("~", homedir());
  return p;
}

function matchesPathPattern(filePath: string, pattern: string): boolean {
  const expanded = expandPath(pattern);
  const expandedFile = expandPath(filePath);

  if (pattern.includes("*")) {
    let regexPattern = expanded
      .replace(/\*\*/g, "<<<DOUBLE>>>")
      .replace(/\*/g, "<<<SINGLE>>>")
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/<<<DOUBLE>>>/g, ".*")
      .replace(/<<<SINGLE>>>/g, "[^/]*");

    try {
      return new RegExp(`^${regexPattern}$`).test(expandedFile);
    } catch {
      return false;
    }
  }

  return (
    expandedFile === expanded ||
    expandedFile.startsWith(
      expanded.endsWith("/") ? expanded : expanded + "/"
    )
  );
}

// ========================================
// Validation Bash
// ========================================

function validateBash(
  command: string
): { action: "allow" | "block" | "confirm" | "alert"; reason?: string } {
  const patterns = loadPatterns();

  for (const p of patterns.bash.blocked) {
    if (matchesPattern(command, p.pattern))
      return { action: "block", reason: p.reason };
  }
  for (const p of patterns.bash.confirm) {
    if (matchesPattern(command, p.pattern))
      return { action: "confirm", reason: p.reason };
  }
  for (const p of patterns.bash.alert) {
    if (matchesPattern(command, p.pattern))
      return { action: "alert", reason: p.reason };
  }

  return { action: "allow" };
}

// ========================================
// Validation chemins
// ========================================

type PathAction = "read" | "write" | "delete";

function validatePath(
  filePath: string,
  action: PathAction
): { action: "allow" | "block" | "confirm"; reason?: string } {
  const patterns = loadPatterns();

  for (const p of patterns.paths.zeroAccess) {
    if (matchesPathPattern(filePath, p))
      return { action: "block", reason: `Acces interdit : ${p}` };
  }

  if (action === "write" || action === "delete") {
    for (const p of patterns.paths.readOnly) {
      if (matchesPathPattern(filePath, p))
        return { action: "block", reason: `Chemin en lecture seule : ${p}` };
    }
  }

  if (action === "write") {
    for (const p of patterns.paths.confirmWrite) {
      if (matchesPathPattern(filePath, p))
        return {
          action: "confirm",
          reason: `Ecriture sur chemin protege : ${p}`,
        };
    }
  }

  if (action === "delete") {
    for (const p of patterns.paths.noDelete) {
      if (matchesPathPattern(filePath, p))
        return {
          action: "block",
          reason: `Suppression interdite : ${p}`,
        };
    }
  }

  return { action: "allow" };
}

// ========================================
// Handlers par outil
// ========================================

function handleBash(input: HookInput): void {
  const rawCommand =
    typeof input.tool_input === "string"
      ? input.tool_input
      : (input.tool_input?.command as string) || "";

  if (!rawCommand) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  const command = stripEnvVarPrefix(rawCommand);
  const result = validateBash(command);

  switch (result.action) {
    case "block":
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        session_id: input.session_id,
        event_type: "block",
        tool: "Bash",
        category: "bash_command",
        target: command.slice(0, 500),
        reason: result.reason,
        action_taken: "Blocage dur — exit 2",
      });
      console.error(`[HORA SECURITE] BLOQUE : ${result.reason}`);
      console.error(`Commande : ${command.slice(0, 100)}`);
      process.exit(2);
      break;

    case "confirm":
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        session_id: input.session_id,
        event_type: "confirm",
        tool: "Bash",
        category: "bash_command",
        target: command.slice(0, 500),
        reason: result.reason,
        action_taken: "Demande de confirmation",
      });
      console.log(
        JSON.stringify({
          decision: "ask",
          message: `[HORA SECURITE] ${result.reason}\n\nCommande : ${command.slice(0, 200)}\n\nContinuer ?`,
        })
      );
      break;

    case "alert":
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        session_id: input.session_id,
        event_type: "alert",
        tool: "Bash",
        category: "bash_command",
        target: command.slice(0, 500),
        reason: result.reason,
        action_taken: "Alerte loguee, execution autorisee",
      });
      console.error(`[HORA SECURITE] ALERTE : ${result.reason}`);
      console.log(JSON.stringify({ continue: true }));
      break;

    default:
      console.log(JSON.stringify({ continue: true }));
  }
}

function handleFileTool(
  input: HookInput,
  action: PathAction
): void {
  const filePath =
    typeof input.tool_input === "string"
      ? input.tool_input
      : (input.tool_input?.file_path as string) || "";

  if (!filePath) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  const result = validatePath(filePath, action);

  switch (result.action) {
    case "block":
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        session_id: input.session_id,
        event_type: "block",
        tool: input.tool_name,
        category: "path_access",
        target: filePath,
        reason: result.reason,
        action_taken: "Blocage dur — exit 2",
      });
      console.error(`[HORA SECURITE] BLOQUE : ${result.reason}`);
      console.error(`Chemin : ${filePath}`);
      process.exit(2);
      break;

    case "confirm":
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        session_id: input.session_id,
        event_type: "confirm",
        tool: input.tool_name,
        category: "path_access",
        target: filePath,
        reason: result.reason,
        action_taken: "Demande de confirmation",
      });
      console.log(
        JSON.stringify({
          decision: "ask",
          message: `[HORA SECURITE] ${result.reason}\n\nChemin : ${filePath}\n\nContinuer ?`,
        })
      );
      break;

    default:
      console.log(JSON.stringify({ continue: true }));
  }
}

// ========================================
// Main
// ========================================

async function main(): Promise<void> {
  let input: HookInput;

  try {
    const raw = await new Promise<string>((resolve) => {
      let data = "";
      const timeout = setTimeout(() => resolve(data), 200);
      process.stdin.on("data", (chunk) => (data += chunk));
      process.stdin.on("end", () => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    if (!raw.trim()) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    input = JSON.parse(raw);
  } catch {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  switch (input.tool_name) {
    case "Bash":
      handleBash(input);
      break;
    case "Edit":
    case "MultiEdit":
    case "Write":
      handleFileTool(input, "write");
      break;
    case "Read":
      handleFileTool(input, "read");
      break;
    default:
      console.log(JSON.stringify({ continue: true }));
  }
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true }));
});
