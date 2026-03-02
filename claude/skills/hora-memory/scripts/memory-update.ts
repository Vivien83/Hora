/**
 * HORA Memory Update — Mise a jour complete de la memoire
 *
 * Usage:
 *   npx tsx ~/.claude/skills/hora-memory/scripts/memory-update.ts --check
 *   npx tsx ~/.claude/skills/hora-memory/scripts/memory-update.ts --update
 *   npx tsx ~/.claude/skills/hora-memory/scripts/memory-update.ts --embed
 *   npx tsx ~/.claude/skills/hora-memory/scripts/memory-update.ts --gc
 *   npx tsx ~/.claude/skills/hora-memory/scripts/memory-update.ts --dream
 *   npx tsx ~/.claude/skills/hora-memory/scripts/memory-update.ts --repair
 *
 * Output: JSON sur stdout
 */

import * as fs from "fs";
import * as path from "path";

// ─── Constants ──────────────────────────────────────────────────────────────

const HOME = process.env.HOME || process.env.USERPROFILE || "";
const CLAUDE_DIR = path.join(HOME, ".claude");
const MEMORY_DIR = path.join(CLAUDE_DIR, "MEMORY");
const GRAPH_DIR = path.join(MEMORY_DIR, "GRAPH");
const LIB_DIR = path.join(CLAUDE_DIR, "hooks", "lib");

// Dynamic import helper — resolves to ~/.claude/hooks/lib/
function lib(name: string): string {
  return path.join(LIB_DIR, name);
}

interface StepResult {
  step: string;
  status: "ok" | "skip" | "error";
  detail: string;
}

interface UpdateReport {
  mode: string;
  steps: StepResult[];
  graph?: { entities: number; facts: number; activeFacts: number; episodes: number };
  tiers?: { t1Items: number; t2Items: number; t3Items: number };
  embeddings?: { total: number; missing: number; generated: number };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg: string): void {
  process.stderr.write(`[hora-memory] ${msg}\n`);
}

// ─── Check Mode ─────────────────────────────────────────────────────────────

async function runCheck(): Promise<UpdateReport> {
  const steps: StepResult[] = [];

  // Memory tiers
  try {
    const { getMemoryHealth } = await import(lib("memory-tiers.js"));
    const health = getMemoryHealth(MEMORY_DIR);
    steps.push({
      step: "Memory Tiers",
      status: "ok",
      detail: `T1: ${health.t1.items} (${health.t1.sizeKb}KB) | T2: ${health.t2.items} (${health.t2.sizeKb}KB) | T3: ${health.t3.items} (${health.t3.sizeKb}KB)`,
    });
    if (health.alerts.length > 0) {
      steps.push({ step: "Alerts", status: "error", detail: health.alerts.join("; ") });
    }

    // Graph
    const entitiesFile = path.join(GRAPH_DIR, "entities.jsonl");
    if (fs.existsSync(entitiesFile)) {
      const { HoraGraph } = await import(lib("knowledge-graph.js"));
      const graph = new HoraGraph(GRAPH_DIR);
      const stats = graph.getStats();
      const allEntities = graph.getAllEntities();
      const allFacts = graph.getAllFacts();

      let missingEmbed = 0;
      for (const e of allEntities) {
        if (!e.embedding || e.embedding.length === 0) missingEmbed++;
      }
      for (const f of allFacts) {
        if (f.expired_at !== null) continue;
        if (!f.embedding || f.embedding.length === 0) missingEmbed++;
      }

      steps.push({
        step: "Knowledge Graph",
        status: "ok",
        detail: `${stats.entities} entites | ${stats.activeFacts} faits actifs | ${stats.episodes} episodes`,
      });

      if (missingEmbed > 0) {
        steps.push({
          step: "Embeddings",
          status: "error",
          detail: `${missingEmbed} embeddings manquants`,
        });
      } else {
        steps.push({ step: "Embeddings", status: "ok", detail: "100% couvert" });
      }

      return {
        mode: "check",
        steps,
        graph: { entities: stats.entities, facts: stats.facts, activeFacts: stats.activeFacts, episodes: stats.episodes },
        tiers: { t1Items: health.t1.items, t2Items: health.t2.items, t3Items: health.t3.items },
        embeddings: { total: allEntities.length + stats.activeFacts, missing: missingEmbed, generated: 0 },
      };
    } else {
      steps.push({ step: "Knowledge Graph", status: "skip", detail: "Aucun graph trouve" });
      return { mode: "check", steps, tiers: { t1Items: health.t1.items, t2Items: health.t2.items, t3Items: health.t3.items } };
    }
  } catch (err) {
    steps.push({ step: "Check", status: "error", detail: String(err) });
    return { mode: "check", steps };
  }
}

// ─── GC Mode ────────────────────────────────────────────────────────────────

async function runGc(): Promise<StepResult[]> {
  const steps: StepResult[] = [];
  try {
    const { expireT2, promoteToT3 } = await import(lib("memory-tiers.js"));

    log("[1/2] Expire T2...");
    const expire = expireT2(MEMORY_DIR);
    steps.push({
      step: "Expire T2",
      status: "ok",
      detail: `${expire.sessionsArchived} sessions archivees, ${expire.sentimentTruncated} sentiments tronques, ${expire.failuresTruncated} failures tronquees`,
    });

    log("[2/2] Promote T3...");
    const promote = await promoteToT3(MEMORY_DIR);
    steps.push({
      step: "Promote T3",
      status: "ok",
      detail: `${promote.crystallizedPatterns} patterns cristallises, ${promote.recurringFailures} failures recurrentes`,
    });
  } catch (err) {
    steps.push({ step: "GC", status: "error", detail: String(err) });
  }
  return steps;
}

// ─── Embed Mode ─────────────────────────────────────────────────────────────

async function runEmbed(): Promise<StepResult & { generated: number }> {
  try {
    const { HoraGraph } = await import(lib("knowledge-graph.js"));
    const { embedBatch, disposeEmbedder } = await import(lib("embeddings.js"));

    if (!fs.existsSync(path.join(GRAPH_DIR, "entities.jsonl"))) {
      return { step: "Auto-embed", status: "skip", detail: "Pas de graph", generated: 0 };
    }

    const graph = new HoraGraph(GRAPH_DIR);
    const allEntities = graph.getAllEntities();
    const allFacts = graph.getAllFacts().filter((f: any) => f.expired_at === null);

    // Collect items needing embeddings
    const toEmbed: Array<{ id: string; text: string; type: "entity" | "fact" }> = [];

    for (const e of allEntities) {
      if (!e.embedding || e.embedding.length === 0) {
        toEmbed.push({ id: e.id, text: `${e.type}: ${e.name}`, type: "entity" });
      }
    }
    for (const f of allFacts) {
      if (!f.embedding || f.embedding.length === 0) {
        toEmbed.push({ id: f.id, text: `${f.relation}: ${f.description || ""}`, type: "fact" });
      }
    }

    if (toEmbed.length === 0) {
      return { step: "Auto-embed", status: "ok", detail: "Tous les embeddings sont a jour", generated: 0 };
    }

    log(`Generating ${toEmbed.length} embeddings...`);
    const texts = toEmbed.map((t) => t.text);
    const embeddings = await embedBatch(texts);

    let generated = 0;
    for (let i = 0; i < toEmbed.length; i++) {
      const emb = embeddings[i];
      if (!emb) continue;
      const item = toEmbed[i];
      if (item.type === "entity") {
        graph.setEntityEmbedding(item.id, emb);
      } else {
        graph.setFactEmbedding(item.id, emb);
      }
      generated++;
    }

    graph.save();
    await disposeEmbedder();

    return {
      step: "Auto-embed",
      status: "ok",
      detail: `${generated} embeddings generes (384-dim MiniLM-L6-v2)`,
      generated,
    };
  } catch (err) {
    return { step: "Auto-embed", status: "error", detail: String(err), generated: 0 };
  }
}

// ─── Dream Mode ─────────────────────────────────────────────────────────────

async function runDream(): Promise<StepResult> {
  try {
    const { HoraGraph } = await import(lib("knowledge-graph.js"));
    const { runDreamCycle } = await import(lib("dream-cycle.js"));

    if (!fs.existsSync(path.join(GRAPH_DIR, "entities.jsonl"))) {
      return { step: "Dream cycle", status: "skip", detail: "Pas de graph" };
    }

    const graph = new HoraGraph(GRAPH_DIR);
    log("Running dream cycle...");
    const report = runDreamCycle(graph);

    if (report.patternsDistilled > 0 || report.factsReconsolidated > 0) {
      graph.save();
    }

    return {
      step: "Dream cycle",
      status: "ok",
      detail: `${report.episodesProcessed} episodes traites, ${report.patternsDistilled} patterns distilles, ${report.factsReconsolidated} faits reconsolides`,
    };
  } catch (err) {
    return { step: "Dream cycle", status: "error", detail: String(err) };
  }
}

// ─── Expire Graph Facts (ACT-R) ─────────────────────────────────────────────

async function runExpireFacts(): Promise<StepResult> {
  try {
    const { HoraGraph } = await import(lib("knowledge-graph.js"));
    const {
      loadActivationLog,
      computeActivation,
      shouldExpire,
      activationLogPath,
    } = await import(lib("activation-model.js"));

    if (!fs.existsSync(path.join(GRAPH_DIR, "entities.jsonl"))) {
      return { step: "Expire facts", status: "skip", detail: "Pas de graph" };
    }

    const graph = new HoraGraph(GRAPH_DIR);
    const logPath = activationLogPath(GRAPH_DIR);
    const activationLog = loadActivationLog(logPath);

    let expired = 0;
    const activeFacts = graph.getActiveFacts();

    for (const fact of activeFacts) {
      const entry = activationLog.get(fact.id);
      if (!entry) continue;
      const activation = computeActivation(entry);
      if (shouldExpire(activation)) {
        graph.supersedeFact(fact.id);
        expired++;
      }
    }

    if (expired > 0) graph.save();

    return {
      step: "Expire facts",
      status: "ok",
      detail: `${expired} faits oublies (activation < -2.0)`,
    };
  } catch (err) {
    return { step: "Expire facts", status: "error", detail: String(err) };
  }
}

// ─── Repair Mode ────────────────────────────────────────────────────────────

function runRepair(): StepResult[] {
  const steps: StepResult[] = [];
  const jsonlFiles = [
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

  let totalRepaired = 0;

  for (const file of jsonlFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf-8").trim();
    if (!content) continue;

    const lines = content.split("\n");
    const validLines: string[] = [];
    let errors = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        JSON.parse(line);
        validLines.push(line);
      } catch {
        errors++;
      }
    }

    if (errors > 0) {
      fs.writeFileSync(file, validLines.join("\n") + "\n");
      totalRepaired += errors;
      steps.push({
        step: `Repair ${path.basename(file)}`,
        status: "ok",
        detail: `${errors} lignes corrompues supprimees`,
      });
    }
  }

  if (totalRepaired === 0) {
    steps.push({ step: "Repair JSONL", status: "ok", detail: "Tous les fichiers valides" });
  }

  // Ensure required directories exist
  const requiredDirs = [
    "PROFILE", "SESSIONS", "LEARNING/FAILURES", "LEARNING/ALGORITHM",
    "LEARNING/SIGNALS", "LEARNING/SYSTEM", "SECURITY", "STATE", "WORK",
    "INSIGHTS", "GRAPH",
  ];
  let created = 0;
  for (const dir of requiredDirs) {
    const fullPath = path.join(MEMORY_DIR, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      created++;
    }
  }
  if (created > 0) {
    steps.push({ step: "Repair dirs", status: "ok", detail: `${created} repertoires crees` });
  }

  return steps;
}

// ─── Full Update Mode ───────────────────────────────────────────────────────

async function runFullUpdate(): Promise<UpdateReport> {
  const steps: StepResult[] = [];

  // Step 1-2: GC
  log("[1/7] Expire T2...");
  log("[2/7] Promote T3...");
  const gcSteps = await runGc();
  steps.push(...gcSteps);

  // Step 3: Graph build — skip in manual mode (needs session data)
  steps.push({
    step: "Graph build",
    status: "skip",
    detail: "Extraction automatique a la fin de session (session-end hook)",
  });

  // Step 4: Expire facts (ACT-R)
  log("[4/7] Expire facts...");
  steps.push(await runExpireFacts());

  // Step 5: Dream cycle
  log("[5/7] Dream cycle...");
  steps.push(await runDream());

  // Step 6: Auto-embed
  log("[6/7] Auto-embed...");
  const embedResult = await runEmbed();
  steps.push(embedResult);

  // Step 7: Final stats
  log("[7/7] Final stats...");
  let graphStats;
  try {
    const { HoraGraph } = await import(lib("knowledge-graph.js"));
    if (fs.existsSync(path.join(GRAPH_DIR, "entities.jsonl"))) {
      const graph = new HoraGraph(GRAPH_DIR);
      const stats = graph.getStats();
      graphStats = { entities: stats.entities, facts: stats.facts, activeFacts: stats.activeFacts, episodes: stats.episodes };
      steps.push({
        step: "Save",
        status: "ok",
        detail: `Graph: ${stats.entities} entites, ${stats.activeFacts} faits actifs, ${stats.episodes} episodes`,
      });
    }
  } catch {}

  return { mode: "update", steps, graph: graphStats };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const arg = process.argv[2] || "--update";

  let report: UpdateReport;

  switch (arg) {
    case "--check":
      report = await runCheck();
      break;
    case "--update":
      report = await runFullUpdate();
      break;
    case "--embed": {
      const r = await runEmbed();
      report = { mode: "embed", steps: [r] };
      break;
    }
    case "--gc": {
      const gcSteps = await runGc();
      report = { mode: "gc", steps: gcSteps };
      break;
    }
    case "--dream": {
      const d = await runDream();
      report = { mode: "dream", steps: [d] };
      break;
    }
    case "--repair": {
      const repairSteps = runRepair();
      report = { mode: "repair", steps: repairSteps };
      break;
    }
    default:
      report = { mode: "error", steps: [{ step: "Parse args", status: "error", detail: `Flag inconnu: ${arg}` }] };
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: String(err) }));
  process.exit(1);
});
