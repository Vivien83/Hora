/**
 * HORA Health Check — Diagnostic complet du systeme HORA
 *
 * Usage: npx tsx ~/.claude/skills/hora-health/health-check.ts
 * Output: JSON sur stdout
 */

import * as fs from "fs";
import * as path from "path";
import { getMemoryHealth, type MemoryHealth } from "../../hooks/lib/memory-tiers.js";
import { HoraGraph } from "../../hooks/lib/knowledge-graph.js";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TierInfo {
  items: number;
  sizeKb: number;
  oldestDays?: number;
}

interface HealthReport {
  tiers: { t1: TierInfo; t2: TierInfo; t3: TierInfo };
  graph: {
    entities: number;
    facts: number;
    activeFacts: number;
    episodes: number;
    embeddedPercent: number;
    missingEntities: number;
    missingFacts: number;
  };
  jsonl: { valid: boolean; errors: string[] };
  hooks: { registered: number; total: number; missing: string[] };
  directories: { present: number; total: number; missing: string[] };
  lastGc: string | null;
  diskMb: number;
  alerts: string[];
  projectKnowledge: { exists: boolean; staleDays: number | null };
}

// ─── Constants ──────────────────────────────────────────────────────────────

const HOME = process.env.HOME || process.env.USERPROFILE || "";
const CLAUDE_DIR = path.join(HOME, ".claude");
const MEMORY_DIR = path.join(CLAUDE_DIR, "MEMORY");
const GRAPH_DIR = path.join(MEMORY_DIR, "GRAPH");
const SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.json");

const EXPECTED_MEMORY_DIRS = [
  "PROFILE",
  "INSIGHTS",
  "LEARNING",
  "STATE",
  "SESSIONS",
  "GRAPH",
  "SECURITY",
];

const EXPECTED_HOOKS: Array<{ event: string; command: string }> = [
  { event: "PostToolUse", command: "backup-monitor.ts" },
  { event: "PostToolUse", command: "doc-sync.ts" },
  { event: "PreToolUse", command: "context-checkpoint.ts" },
  { event: "PreToolUse", command: "hora-security.ts" },
  { event: "PreToolUse", command: "librarian-check.ts" },
  { event: "PreToolUse", command: "snapshot.ts" },
  { event: "PreToolUse", command: "tool-use.ts" },
  { event: "Stop", command: "session-end.ts" },
  { event: "UserPromptSubmit", command: "prompt-submit.ts" },
  { event: "UserPromptSubmit", command: "hora-session-name.ts" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function dirSizeBytes(dirPath: string): number {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isFile()) {
          total += fs.statSync(fullPath).size;
        } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
          total += dirSizeBytes(fullPath);
        }
      } catch {
        // skip inaccessible
      }
    }
  } catch {
    // dir doesn't exist
  }
  return total;
}

function validateJsonlFile(filePath: string): string[] {
  const errors: string[] = [];
  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) return [];
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      try {
        JSON.parse(line);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${path.basename(filePath)}:${i + 1}: ${msg}`);
      }
    }
  } catch {
    // File doesn't exist — not an error for validation
  }
  return errors;
}

function fileDaysOld(filePath: string): number | null {
  try {
    const stat = fs.statSync(filePath);
    return Math.floor((Date.now() - stat.mtimeMs) / (24 * 60 * 60 * 1000));
  } catch {
    return null;
  }
}

// ─── Check 1: Memory Tiers ─────────────────────────────────────────────────

function checkMemoryTiers(): { tiers: HealthReport["tiers"]; lastGc: string | null; tierAlerts: string[] } {
  const health: MemoryHealth = getMemoryHealth(MEMORY_DIR);
  return {
    tiers: {
      t1: { items: health.t1.items, sizeKb: health.t1.sizeKb, oldestDays: health.t1.oldestDays },
      t2: { items: health.t2.items, sizeKb: health.t2.sizeKb, oldestDays: health.t2.oldestDays },
      t3: { items: health.t3.items, sizeKb: health.t3.sizeKb, oldestDays: health.t3.oldestDays },
    },
    lastGc: health.lastGc,
    tierAlerts: health.alerts,
  };
}

// ─── Check 2 & 3: Knowledge Graph + Embeddings ─────────────────────────────

function checkGraph(): HealthReport["graph"] {
  const entitiesFile = path.join(GRAPH_DIR, "entities.jsonl");
  if (!fs.existsSync(entitiesFile)) {
    return { entities: 0, facts: 0, activeFacts: 0, episodes: 0, embeddedPercent: 0, missingEntities: 0, missingFacts: 0 };
  }

  const graph = new HoraGraph(GRAPH_DIR);
  const stats = graph.getStats();
  const allEntities = graph.getAllEntities();
  const allFacts = graph.getAllFacts();

  let missingEntities = 0;
  for (const e of allEntities) {
    if (!e.embedding || e.embedding.length === 0) missingEntities++;
  }

  let missingFacts = 0;
  for (const f of allFacts) {
    if (f.expired_at !== null) continue; // only count active facts
    if (!f.embedding || f.embedding.length === 0) missingFacts++;
  }

  const totalEmbeddable = allEntities.length + stats.activeFacts;
  const embedded = (allEntities.length - missingEntities) + (stats.activeFacts - missingFacts);
  const embeddedPercent = totalEmbeddable > 0 ? Math.round((embedded / totalEmbeddable) * 100) : 0;

  return {
    entities: stats.entities,
    facts: stats.facts,
    activeFacts: stats.activeFacts,
    episodes: stats.episodes,
    embeddedPercent,
    missingEntities,
    missingFacts,
  };
}

// ─── Check 4: JSONL Integrity ───────────────────────────────────────────────

function checkJsonlIntegrity(): HealthReport["jsonl"] {
  const files = [
    path.join(GRAPH_DIR, "entities.jsonl"),
    path.join(GRAPH_DIR, "facts.jsonl"),
    path.join(GRAPH_DIR, "episodes.jsonl"),
    path.join(GRAPH_DIR, "embedding-index.jsonl"),
    path.join(GRAPH_DIR, "activation-log.jsonl"),
    path.join(MEMORY_DIR, "LEARNING", "ALGORITHM", "sentiment-log.jsonl"),
    path.join(MEMORY_DIR, "LEARNING", "FAILURES", "failures-log.jsonl"),
    path.join(MEMORY_DIR, "LEARNING", "SIGNALS", "preference-signals.jsonl"),
    path.join(MEMORY_DIR, ".tool-usage.jsonl"),
  ];

  const allErrors: string[] = [];
  for (const file of files) {
    const errors = validateJsonlFile(file);
    allErrors.push(...errors);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

// ─── Check 5: Hooks Registration ───────────────────────────────────────────

function checkHooks(): HealthReport["hooks"] {
  const missing: string[] = [];

  try {
    const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
    const settings = JSON.parse(raw);
    const hooks = settings.hooks || {};

    for (const expected of EXPECTED_HOOKS) {
      const eventHooks = hooks[expected.event];
      if (!eventHooks || !Array.isArray(eventHooks)) {
        missing.push(`${expected.event}/${expected.command}`);
        continue;
      }

      const found = eventHooks.some((group: { hooks?: Array<{ command?: string }> }) => {
        if (!group.hooks || !Array.isArray(group.hooks)) return false;
        return group.hooks.some((h) => h.command && h.command.includes(expected.command));
      });

      if (!found) {
        missing.push(`${expected.event}/${expected.command}`);
      }
    }
  } catch {
    // settings.json missing or invalid — all hooks missing
    for (const expected of EXPECTED_HOOKS) {
      missing.push(`${expected.event}/${expected.command}`);
    }
  }

  return {
    registered: EXPECTED_HOOKS.length - missing.length,
    total: EXPECTED_HOOKS.length,
    missing,
  };
}

// ─── Check 6: MEMORY/ Directories ──────────────────────────────────────────

function checkDirectories(): HealthReport["directories"] {
  const missing: string[] = [];

  for (const dir of EXPECTED_MEMORY_DIRS) {
    const fullPath = path.join(MEMORY_DIR, dir);
    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isDirectory()) {
        missing.push(dir);
      }
    } catch {
      missing.push(dir);
    }
  }

  return {
    present: EXPECTED_MEMORY_DIRS.length - missing.length,
    total: EXPECTED_MEMORY_DIRS.length,
    missing,
  };
}

// ─── Check 7: project-knowledge.md Freshness ───────────────────────────────

function checkProjectKnowledge(): HealthReport["projectKnowledge"] {
  // Check in current working directory first, then common locations
  const candidates = [
    path.join(process.cwd(), ".hora", "project-knowledge.md"),
  ];

  for (const candidate of candidates) {
    const days = fileDaysOld(candidate);
    if (days !== null) {
      return { exists: true, staleDays: days };
    }
  }

  return { exists: false, staleDays: null };
}

// ─── Check 8: Disk Usage ───────────────────────────────────────────────────

function checkDiskUsage(): number {
  const totalBytes = dirSizeBytes(MEMORY_DIR);
  return Math.round((totalBytes / (1024 * 1024)) * 100) / 100;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function runHealthCheck(): HealthReport {
  const alerts: string[] = [];

  // 1. Memory Tiers
  const { tiers, lastGc, tierAlerts } = checkMemoryTiers();
  alerts.push(...tierAlerts);

  // 2 & 3. Graph + Embeddings
  const graph = checkGraph();
  if (graph.missingEntities > 0 || graph.missingFacts > 0) {
    const total = graph.missingEntities + graph.missingFacts;
    alerts.push(`${total} embeddings manquants (entities: ${graph.missingEntities}, facts: ${graph.missingFacts})`);
  }

  // 4. JSONL Integrity
  const jsonl = checkJsonlIntegrity();
  if (!jsonl.valid) {
    alerts.push(`${jsonl.errors.length} erreur(s) JSONL : ${jsonl.errors.slice(0, 3).join("; ")}`);
  }

  // 5. Hooks
  const hooks = checkHooks();
  if (hooks.missing.length > 0) {
    alerts.push(`Hooks manquants: ${hooks.missing.join(", ")}`);
  }

  // 6. Directories
  const directories = checkDirectories();
  if (directories.missing.length > 0) {
    alerts.push(`Repertoires MEMORY/ manquants: ${directories.missing.join(", ")}`);
  }

  // 7. project-knowledge.md
  const projectKnowledge = checkProjectKnowledge();
  if (!projectKnowledge.exists) {
    alerts.push("project-knowledge.md introuvable dans le projet courant");
  } else if (projectKnowledge.staleDays !== null && projectKnowledge.staleDays > 7) {
    alerts.push(`project-knowledge.md date de ${projectKnowledge.staleDays}j (>7j = stale)`);
  }

  // 8. Disk usage
  const diskMb = checkDiskUsage();
  if (diskMb > 50) {
    alerts.push(`MEMORY/ occupe ${diskMb} MB (>50 MB = volumineux)`);
  }

  // Last GC alert
  if (!lastGc) {
    // Already in tierAlerts
  } else {
    const gcDate = new Date(lastGc);
    const hoursAgo = Math.round((Date.now() - gcDate.getTime()) / (60 * 60 * 1000));
    if (hoursAgo > 48) {
      alerts.push(`Dernier GC il y a ${hoursAgo}h (>48h)`);
    }
  }

  return {
    tiers,
    graph,
    jsonl,
    hooks,
    directories,
    lastGc,
    diskMb,
    alerts,
    projectKnowledge,
  };
}

// ─── Execute ────────────────────────────────────────────────────────────────

try {
  const report = runHealthCheck();
  console.log(JSON.stringify(report, null, 2));
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(JSON.stringify({ error: msg }));
  process.exit(1);
}
