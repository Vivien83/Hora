/**
 * HORA — Memory Quality Metrics
 *
 * Computes quantitative metrics about memory system health and quality.
 * Integrates with the dashboard for visualization.
 */

import * as fs from "fs";
import * as path from "path";
import type { HoraGraph } from "./knowledge-graph.js";
import type { ActivationEntry } from "./activation-model.js";
import type { Community } from "./graph-communities.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MemoryQualityMetrics {
  totalFacts: number;
  activeFacts: number;
  deduplicationRatio: number;      // facts superseded / total
  averageActivation: number;       // mean ACT-R activation
  embeddingCoverage: number;       // % facts with embedding
  communityCount: number;
  reconsolidationRate: number;     // % facts reconsolidated
  retrievalHitRate: number;        // % retrievals with access records
  dreamCycleEfficiency: number;    // distilled facts / total episodes
  memoryTypeDistribution: {
    episodic: number;
    semantic: number;
    procedural: number;
    unclassified: number;
  };
  averageConfidence: number;
  graphSizeKb: number;
}

// ─── Computation ────────────────────────────────────────────────────────────

/**
 * Compute comprehensive memory quality metrics.
 */
export function computeMetrics(
  graph: HoraGraph,
  graphDir: string,
  activationLog?: Map<string, ActivationEntry>,
  communities?: Community[],
): MemoryQualityMetrics {
  const allEntities = graph.getAllEntities();
  const activeFacts = graph.getActiveFacts();
  const stats = graph.getStats();

  // Deduplication ratio
  const totalFacts = stats.facts;
  const superseded = totalFacts - stats.activeFacts;
  const deduplicationRatio = totalFacts > 0 ? superseded / totalFacts : 0;

  // Average activation (from activation log)
  let averageActivation = 0;
  if (activationLog && activationLog.size > 0) {
    let sum = 0;
    let count = 0;
    for (const entry of activationLog.values()) {
      if (isFinite(entry.lastActivation)) {
        sum += entry.lastActivation;
        count++;
      }
    }
    averageActivation = count > 0 ? sum / count : 0;
  }

  // Embedding coverage
  const factsWithEmbedding = activeFacts.filter(f => f.embedding !== null).length;
  const entitiesWithEmbedding = allEntities.filter(e => e.embedding !== null).length;
  const totalItems = activeFacts.length + allEntities.length;
  const embeddingCoverage = totalItems > 0
    ? (factsWithEmbedding + entitiesWithEmbedding) / totalItems
    : 0;

  // Reconsolidation rate
  const reconsolidated = activeFacts.filter(
    f => f.metadata?.reconsolidation_count && f.metadata.reconsolidation_count > 0,
  ).length;
  const reconsolidationRate = activeFacts.length > 0 ? reconsolidated / activeFacts.length : 0;

  // Retrieval hit rate (facts with activation entries / total active facts)
  const retrievalHitRate = activationLog && activeFacts.length > 0
    ? Math.min(1, activationLog.size / activeFacts.length)
    : 0;

  // Dream cycle efficiency
  const episodes = stats.episodes;
  const consolidatedEpisodes = 0; // Would need to count consolidated episodes
  const distilledFacts = activeFacts.filter(
    f => f.metadata?.context?.includes("dream cycle"),
  ).length;
  const dreamCycleEfficiency = episodes > 0 ? distilledFacts / episodes : 0;

  // Memory type distribution
  const distribution = { episodic: 0, semantic: 0, procedural: 0, unclassified: 0 };
  for (const fact of activeFacts) {
    const mt = fact.metadata?.memory_type;
    if (mt === "episodic") distribution.episodic++;
    else if (mt === "semantic") distribution.semantic++;
    else if (mt === "procedural") distribution.procedural++;
    else distribution.unclassified++;
  }

  // Average confidence
  const avgConfidence = activeFacts.length > 0
    ? activeFacts.reduce((sum, f) => sum + f.confidence, 0) / activeFacts.length
    : 0;

  // Graph size on disk
  let graphSizeKb = 0;
  try {
    const files = ["entities.jsonl", "facts.jsonl", "episodes.jsonl", "embeddings.bin", "embedding-index.jsonl"];
    for (const file of files) {
      try {
        const stat = fs.statSync(path.join(graphDir, file));
        graphSizeKb += stat.size;
      } catch {}
    }
    graphSizeKb = Math.round(graphSizeKb / 1024);
  } catch {}

  return {
    totalFacts,
    activeFacts: stats.activeFacts,
    deduplicationRatio: Math.round(deduplicationRatio * 1000) / 1000,
    averageActivation: Math.round(averageActivation * 100) / 100,
    embeddingCoverage: Math.round(embeddingCoverage * 1000) / 1000,
    communityCount: communities?.length ?? 0,
    reconsolidationRate: Math.round(reconsolidationRate * 1000) / 1000,
    retrievalHitRate: Math.round(retrievalHitRate * 1000) / 1000,
    dreamCycleEfficiency: Math.round(dreamCycleEfficiency * 1000) / 1000,
    memoryTypeDistribution: distribution,
    averageConfidence: Math.round(avgConfidence * 100) / 100,
    graphSizeKb,
  };
}
