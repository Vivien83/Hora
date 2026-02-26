/**
 * HORA — Agentic Retrieval
 *
 * Intentional, task-aware retrieval from the knowledge graph.
 * Instead of blind similarity search, generates targeted queries
 * based on task classification, then merges and formats results by category.
 *
 * Four responsibilities:
 *   1. Classify task (deterministic, no LLM)
 *   2. Generate targeted queries (templates, 3-5 per task type)
 *   3. Multi-search + merge (semantic + structural)
 *   4. Format by category with budget control
 */

import * as fs from "fs";
import * as path from "path";
import type { HoraGraph, EntityNode, FactEdge, SubGraph, SearchResult } from "./knowledge-graph.js";
import { embed, embedBatch } from "./embeddings.js";
import { getRelationCategory } from "./relation-ontology.js";
import { loadActivationLog, saveActivationLog, recordAccess, createActivationEntry, activationLogPath } from "./activation-model.js";
import { buildBM25Index, hybridSearch } from "./hybrid-search.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TaskType =
  | "feature"
  | "bugfix"
  | "refactor"
  | "question"
  | "design"
  | "debug"
  | "unknown";

type QueryCategory = "stack" | "context" | "decisions" | "errors" | "patterns";

interface AgenticQuery {
  text: string;
  category: QueryCategory;
  weight: number;
}

export interface ClassificationResult {
  type: TaskType;
  keywords: string[];
  componentHints: string[];
}

interface ScoredFact {
  fact: FactEdge;
  score: number;
  category: QueryCategory;
}

interface ScoredEntity {
  entity: EntityNode;
  score: number;
}

export interface AgenticRetrievalOptions {
  message: string;
  graph: HoraGraph;
  graphDir: string;
  projectName: string;
  maxBudget?: number;
}

interface MergedResults {
  facts: Map<string, ScoredFact>;
  entities: Map<string, ScoredEntity>;
}

// ─── Category Budgets ───────────────────────────────────────────────────────

const CATEGORY_BUDGETS: Record<QueryCategory, number> = {
  stack: 1500,
  context: 1500,
  decisions: 1000,
  errors: 1000,
  patterns: 500,
};

// ─── Task Classification ────────────────────────────────────────────────────

const TASK_KEYWORDS: Record<Exclude<TaskType, "unknown">, string[]> = {
  feature: [
    "ajoute", "cree", "créé", "nouveau", "nouvelle", "add", "create",
    "implement", "implemente", "implémente", "build", "construis",
  ],
  bugfix: [
    "fix", "bug", "erreur", "crash", "marche pas", "casse", "broken",
    "ne fonctionne pas", "doesn't work", "regresse", "regression",
  ],
  refactor: [
    "refactor", "clean", "reorganise", "réorganise", "simplifie",
    "decouple", "découple", "extraire", "restructure", "nettoie",
  ],
  question: [
    "pourquoi", "comment", "why", "how", "explain", "explique",
    "c'est quoi", "what is", "what are", "qu'est-ce",
  ],
  design: [
    "design", "ui", "ux", "bouton", "page", "composant", "component",
    "layout", "style", "theme", "modal", "formulaire",
  ],
  debug: [
    "debug", "log", "trace", "investigate", "inspecte", "diagnostique", "profile",
  ],
};

const STOP_WORDS = new Set([
  "dans", "avec", "pour", "que", "les", "des", "une", "est", "sur", "pas",
  "qui", "mais", "the", "and", "for", "with", "this", "that", "from",
  "have", "are", "was", "been", "tout", "tous", "aussi", "plus", "comme",
]);

/**
 * Classify a user message into a task type.
 * Deterministic keyword matching — no LLM.
 */
export function classifyTask(message: string): ClassificationResult {
  const lower = message.toLowerCase();

  // Score each task type
  const scores = new Map<TaskType, number>();
  for (const [type, keywords] of Object.entries(TASK_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > 0) scores.set(type as TaskType, score);
  }

  // Find best match
  let bestType: TaskType = "unknown";
  let bestScore = 0;
  for (const [type, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // Extract keywords (significant words, 4+ chars, not stopwords)
  const words = lower
    .replace(/[^\w\sàâéèêëîïôùûüç-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
  const keywords = [...new Set(words)].slice(0, 8);

  // Extract component hints
  const componentHints: string[] = [];

  // PascalCase words (e.g. NeuralPage, KnowledgeGraph)
  const pascalMatches = message.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g);
  if (pascalMatches) {
    componentHints.push(...pascalMatches.map((m) => m.toLowerCase()));
  }

  // File paths (e.g. dashboard.tsx, graph-builder.ts)
  const pathMatches = message.match(/[\w-]+\.(?:tsx?|jsx?|css|md)/g);
  if (pathMatches) {
    componentHints.push(...pathMatches.map((m) => m.replace(/\.\w+$/, "").toLowerCase()));
  }

  // Quoted names
  const quotedMatches = message.match(/["'`]([^"'`]{2,30})["'`]/g);
  if (quotedMatches) {
    componentHints.push(...quotedMatches.map((m) => m.slice(1, -1).toLowerCase()));
  }

  return {
    type: bestType,
    keywords: keywords.slice(0, 8),
    componentHints: [...new Set(componentHints)].slice(0, 5),
  };
}

// ─── Query Generation ───────────────────────────────────────────────────────

/**
 * Generate targeted queries based on task type.
 * Each query has a text to embed, a category, and a weight multiplier.
 */
function generateQueries(
  taskType: TaskType,
  rawMessage: string,
  projectName: string,
  keywords: string[],
  hints: string[],
): AgenticQuery[] {
  const kw = keywords.join(" ");
  const h = hints.join(" ");

  switch (taskType) {
    case "feature":
      return [
        { text: `stack frontend ${projectName}`, category: "stack", weight: 1.5 },
        { text: `composant ${h} architecture`, category: "context", weight: 1.0 },
        { text: `design patterns UI preferences ${h}`, category: "patterns", weight: 1.0 },
        { text: `erreur ${h}`, category: "errors", weight: 0.7 },
        { text: rawMessage, category: "context", weight: 0.5 },
      ];

    case "bugfix":
      return [
        { text: rawMessage, category: "errors", weight: 2.0 },
        { text: `erreur pattern ${kw}`, category: "errors", weight: 1.5 },
        { text: `solved_by workaround ${kw}`, category: "errors", weight: 1.5 },
        { text: `stack ${projectName} ${h}`, category: "stack", weight: 0.8 },
      ];

    case "question":
      return [
        { text: rawMessage, category: "context", weight: 2.0 },
        { text: `decided_for decided_against ${kw}`, category: "decisions", weight: 1.5 },
        { text: `learned_that ${kw}`, category: "decisions", weight: 1.0 },
      ];

    case "refactor":
      return [
        { text: `architecture ${h} ${projectName}`, category: "context", weight: 1.5 },
        { text: `depends_on ${kw}`, category: "context", weight: 1.2 },
        { text: `decision ${kw}`, category: "decisions", weight: 1.0 },
        { text: rawMessage, category: "context", weight: 0.8 },
      ];

    case "design":
      return [
        { text: `composant UI ${h}`, category: "patterns", weight: 1.5 },
        { text: `design patterns preferences`, category: "patterns", weight: 1.2 },
        { text: `stack frontend ${projectName}`, category: "stack", weight: 1.0 },
        { text: rawMessage, category: "context", weight: 0.8 },
      ];

    case "debug":
      return [
        { text: rawMessage, category: "errors", weight: 2.0 },
        { text: `erreur debug ${kw}`, category: "errors", weight: 1.5 },
        { text: `stack ${projectName}`, category: "stack", weight: 0.8 },
      ];

    default: // unknown
      return [
        { text: rawMessage, category: "context", weight: 1.0 },
        { text: `stack ${projectName}`, category: "stack", weight: 0.8 },
      ];
  }
}

// ─── Multi-Search + Merge ───────────────────────────────────────────────────

/**
 * Map relation category (from ontology) to query category.
 */
function mapRelCategoryToQueryCategory(
  relCategory: string,
  fallback: QueryCategory,
): QueryCategory {
  switch (relCategory) {
    case "technological": return "stack";
    case "structural":    return "context";
    case "learning":      return "errors";
    case "experience":    return "errors";
    case "actor":         return "patterns";
    case "conceptual":    return "context";
    default:              return fallback;
  }
}

/**
 * Execute multi-search: embed all queries, semantic search, structural queries, merge.
 * Uses ACT-R activation log for scoring and records accesses for retrieved facts.
 */
async function multiSearch(
  queries: AgenticQuery[],
  graph: HoraGraph,
  graphDir: string,
  projectName: string,
  taskType: TaskType,
): Promise<MergedResults> {
  const merged: MergedResults = {
    facts: new Map(),
    entities: new Map(),
  };

  // Load activation log for ACT-R scoring
  const actLogPath = activationLogPath(graphDir);
  let actLog: Map<string, ReturnType<typeof loadActivationLog> extends Map<string, infer V> ? V : never>;
  try {
    actLog = loadActivationLog(actLogPath);
  } catch {
    actLog = new Map();
  }

  // 1. Embed all queries in batch
  const queryTexts = queries.map((q) => q.text);
  let embeddings: (number[] | null)[];
  try {
    embeddings = await embedBatch(queryTexts);
  } catch {
    embeddings = queryTexts.map(() => null);
  }

  // 2. Semantic search for each query with embedding + activation scoring
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const queryEmb = embeddings[i];
    if (!queryEmb) continue;

    const results = graph.semanticSearch(queryEmb, {
      limit: 10,
      minScore: 0.25,
      activationLog: actLog.size > 0 ? actLog : undefined,
    });

    for (const r of results) {
      const finalScore = query.weight * r.score;

      if (r.type === "fact" && r.fact) {
        const existing = merged.facts.get(r.id);
        if (!existing || existing.score < finalScore) {
          const relCategory = getRelationCategory(r.fact.relation);
          const factCategory = mapRelCategoryToQueryCategory(relCategory, query.category);
          merged.facts.set(r.id, { fact: r.fact, score: finalScore, category: factCategory });
        }
      }

      if (r.type === "entity" && r.entity) {
        const existing = merged.entities.get(r.id);
        if (!existing || existing.score < finalScore) {
          merged.entities.set(r.id, { entity: r.entity, score: finalScore });
        }
      }
    }
  }

  // 2b. BM25 hybrid search — catches exact term matches semantic search misses
  try {
    const activeFacts = graph.getActiveFacts();
    if (activeFacts.length > 0) {
      // Build entity name map for BM25 indexing
      const entityNames = new Map<string, string>();
      for (const e of graph.getAllEntities()) {
        entityNames.set(e.id, e.name);
      }

      const factsMap = new Map<string, FactEdge>();
      for (const f of activeFacts) factsMap.set(f.id, f);

      const bm25Index = buildBM25Index(activeFacts, entityNames);

      // Run hybrid search for each query text
      for (const query of queries) {
        const semanticForQuery = [...merged.facts.values()]
          .map(sf => ({ type: "fact" as const, id: sf.fact.id, score: sf.score, fact: sf.fact }));

        const hybridResults = hybridSearch(query.text, semanticForQuery, factsMap, bm25Index, {
          semanticWeight: 0.7,
          bm25Weight: 0.3,
          limit: 10,
        });

        for (const hr of hybridResults) {
          const existing = merged.facts.get(hr.id);
          const boostedScore = hr.score * query.weight;
          if (!existing || existing.score < boostedScore) {
            const relCategory = getRelationCategory(hr.fact.relation);
            const factCategory = mapRelCategoryToQueryCategory(relCategory, query.category);
            merged.facts.set(hr.id, { fact: hr.fact, score: boostedScore, category: factCategory });
          }
        }
      }
    }
  } catch {}

  // Record access for all retrieved facts (ACT-R retrieval boost)
  if (merged.facts.size > 0) {
    try {
      let logModified = false;
      for (const [factId] of merged.facts) {
        const existing = actLog.get(factId);
        if (existing) {
          actLog.set(factId, recordAccess(existing));
        } else {
          actLog.set(factId, createActivationEntry(factId));
        }
        logModified = true;
      }
      if (logModified) {
        saveActivationLog(actLogPath, actLog);
      }
    } catch {}
  }

  // 3. Structural queries (no embedding needed)
  // Project subgraph
  const projectSub = graph.getProjectSubgraph(projectName);
  if (projectSub) {
    for (const e of projectSub.entities) {
      if (!merged.entities.has(e.id)) {
        merged.entities.set(e.id, { entity: e, score: 0.3 });
      }
    }
    for (const f of projectSub.facts) {
      if (!merged.facts.has(f.id)) {
        const relCategory = getRelationCategory(f.relation);
        merged.facts.set(f.id, {
          fact: f,
          score: 0.3,
          category: mapRelCategoryToQueryCategory(relCategory, "context"),
        });
      }
    }
  }

  // Task-specific structural queries
  if (taskType === "bugfix" || taskType === "debug") {
    const learningFacts = graph.findFactsByCategory("learning");
    for (const f of learningFacts.slice(0, 10)) {
      if (!merged.facts.has(f.id)) {
        merged.facts.set(f.id, { fact: f, score: 0.2, category: "errors" });
      }
    }

    const errorEntities = graph.findEntitiesByType(["error_pattern"]);
    for (const e of errorEntities.slice(0, 5)) {
      if (!merged.entities.has(e.id)) {
        merged.entities.set(e.id, { entity: e, score: 0.2 });
      }
    }
  }

  return merged;
}

// ─── Format by Category ─────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<QueryCategory, string> = {
  stack: "Stack technique",
  context: "Contexte projet",
  decisions: "Decisions",
  errors: "Erreurs connues",
  patterns: "Conventions et patterns",
};

const CATEGORY_ORDER: QueryCategory[] = ["context", "stack", "decisions", "errors", "patterns"];

// ─── Baddeley Chunking ──────────────────────────────────────────────────────

interface FactChunk {
  theme: string;
  category: QueryCategory;
  facts: ScoredFact[];
}

const MAX_CHUNKS = 5; // Baddeley: working memory ≈ 4±1 chunks

/**
 * Group facts into semantic chunks (Baddeley working memory model).
 * Instead of N individual facts, produces max 5 thematic groups.
 */
function chunkBySemanticProximity(allFacts: ScoredFact[]): FactChunk[] {
  if (allFacts.length === 0) return [];

  // Sort by score descending
  const sorted = [...allFacts].sort((a, b) => b.score - a.score);
  const chunks: FactChunk[] = [];

  for (const sf of sorted) {
    // Try to fit into an existing chunk (same category + word overlap > 0.3)
    let placed = false;
    for (const chunk of chunks) {
      if (chunk.category === sf.category && chunk.facts.length < 6) {
        // Check word overlap with chunk theme
        const descWords = new Set(sf.fact.description.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        const themeWords = new Set(chunk.theme.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        let overlap = 0;
        for (const w of descWords) { if (themeWords.has(w)) overlap++; }
        const sim = themeWords.size > 0 ? overlap / themeWords.size : 0;
        if (sim > 0.2) {
          chunk.facts.push(sf);
          placed = true;
          break;
        }
      }
    }

    if (!placed && chunks.length < MAX_CHUNKS) {
      // New chunk
      chunks.push({
        theme: CATEGORY_LABELS[sf.category],
        category: sf.category,
        facts: [sf],
      });
    } else if (!placed && chunks.length >= MAX_CHUNKS) {
      // Overflow: add to the most relevant existing chunk
      const bestChunk = chunks
        .filter(c => c.category === sf.category)
        .sort((a, b) => a.facts.length - b.facts.length)[0];
      if (bestChunk && bestChunk.facts.length < 8) {
        bestChunk.facts.push(sf);
      }
    }
  }

  return chunks;
}

/**
 * Format merged results as Baddeley-style semantic chunks.
 * Procedural facts get special "Quand X → Y" formatting.
 */
function formatByCategory(
  merged: MergedResults,
  projectName: string,
  budget: number,
): string {
  const parts: string[] = [];
  let remaining = budget;

  // Header with project and top stack entities
  const topEntities = [...merged.entities.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const stackEntities = topEntities
    .filter((e) => ["tool", "library"].includes(e.entity.type))
    .map((e) => e.entity.name);

  const header = `Projet: ${projectName}${stackEntities.length > 0 ? ` — stack: ${stackEntities.join(", ")}` : ""}`;
  parts.push(header);
  remaining -= header.length + 1;

  // Separate procedural facts for special formatting
  const allFacts = [...merged.facts.values()];
  const proceduralFacts = allFacts.filter(sf => sf.fact.metadata?.memory_type === "procedural");
  const nonProceduralFacts = allFacts.filter(sf => sf.fact.metadata?.memory_type !== "procedural");

  // Chunk non-procedural facts (Baddeley: max 5 semantic groups)
  const chunks = chunkBySemanticProximity(nonProceduralFacts);

  // Emit chunks
  for (const chunk of chunks) {
    const catBudget = Math.min(CATEGORY_BUDGETS[chunk.category] || 1000, remaining);
    if (catBudget < 50) continue;

    let section = `\n${chunk.theme}:`;
    let sectionLen = section.length + 1;

    for (const sf of chunk.facts) {
      const line = `\n- [${sf.fact.relation}] ${sf.fact.description}`;
      if (sectionLen + line.length > catBudget) break;
      section += line;
      sectionLen += line.length;
    }

    if (sectionLen > chunk.theme.length + 3) {
      parts.push(section);
      remaining -= sectionLen;
    }
  }

  // Emit procedural facts with "Quand X → Y" format
  if (proceduralFacts.length > 0 && remaining > 100) {
    let section = `\nProcedures connues:`;
    let sectionLen = section.length + 1;

    for (const sf of proceduralFacts.sort((a, b) => b.score - a.score)) {
      // Format as "Quand [context] → [action]"
      const desc = sf.fact.description;
      const line = `\n- ${desc}`;
      if (sectionLen + line.length > Math.min(800, remaining)) break;
      section += line;
      sectionLen += line.length;
    }

    if (sectionLen > 22) {
      parts.push(section);
      remaining -= sectionLen;
    }
  }

  return parts.join("\n");
}

// ─── Lazy Embedding Repair ──────────────────────────────────────────────────

const MAX_REPAIR_PER_CALL = 20;

/**
 * Repair up to MAX_REPAIR_PER_CALL facts missing embeddings.
 * Uses PID-based lock to prevent concurrent writes.
 * Returns the number of facts repaired.
 */
async function repairEmbeddings(graph: HoraGraph, graphDir: string): Promise<number> {
  const lockFile = path.join(graphDir, ".embedding-repair.lock");

  // Acquire lock (PID-based)
  try {
    try {
      const content = fs.readFileSync(lockFile, "utf-8").trim();
      const pid = parseInt(content, 10);
      if (!isNaN(pid)) {
        try {
          process.kill(pid, 0); // Check if process is alive
          return 0; // Lock held by running process
        } catch {
          // Stale lock — process dead, continue
        }
      }
    } catch {
      // Lock file doesn't exist — continue
    }

    fs.mkdirSync(path.dirname(lockFile), { recursive: true });
    fs.writeFileSync(lockFile, String(process.pid), "utf-8");
  } catch {
    return 0;
  }

  try {
    // Find active facts without embeddings
    const activeFacts = graph.getActiveFacts();
    const unembedded = activeFacts.filter((f) => !f.embedding).slice(0, MAX_REPAIR_PER_CALL);

    if (unembedded.length === 0) return 0;

    const texts = unembedded.map((f) => `${f.relation}: ${f.description}`);
    const embeddings = await embedBatch(texts);

    let repaired = 0;
    for (let i = 0; i < unembedded.length; i++) {
      const emb = embeddings[i];
      if (emb) {
        graph.setFactEmbedding(unembedded[i].id, emb);
        repaired++;
      }
    }

    if (repaired > 0) {
      graph.save();
    }

    return repaired;
  } finally {
    // Release lock
    try {
      fs.unlinkSync(lockFile);
    } catch {}
  }
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Agentic retrieval: classify task, generate targeted queries,
 * multi-search the graph, format results by category.
 *
 * Returns formatted context string or null if no relevant results.
 */
export async function agenticRetrieve(
  options: AgenticRetrievalOptions,
): Promise<string | null> {
  const { message, graph, graphDir, projectName, maxBudget = 6000 } = options;

  if (!message || message.trim().length < 5) return null;

  const stats = graph.getStats();
  if (stats.entities === 0 && stats.facts === 0) return null;

  // Lazy repair embeddings (non-critical, with lock)
  if (stats.embeddedRatio < 0.9) {
    try {
      await repairEmbeddings(graph, graphDir);
    } catch {
      // Non-critical — continue with whatever embeddings exist
    }
  }

  // 1. Classify task
  const classification = classifyTask(message);

  // 2. Generate queries
  const queries = generateQueries(
    classification.type,
    message,
    projectName,
    classification.keywords,
    classification.componentHints,
  );

  // 3. Multi-search (with ACT-R activation scoring + retrieval boost)
  const merged = await multiSearch(queries, graph, graphDir, projectName, classification.type);

  // 4. Check if we have any results
  if (merged.facts.size === 0 && merged.entities.size === 0) return null;

  // 5. Format by category
  const formatted = formatByCategory(merged, projectName, maxBudget);

  return formatted.trim() || null;
}
