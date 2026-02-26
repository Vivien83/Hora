/**
 * HORA — Dream Cycle: Hippocampal Replay & Consolidation
 *
 * Inspired by sleep-dependent memory consolidation:
 * - Replays recent episodes
 * - Extracts recurring patterns → creates/reinforces semantic facts
 * - Reconsolidates existing facts with new evidence
 * - Marks episodes as consolidated
 *
 * Runs during GC (memory lifecycle), after expireT2 and promoteToT3.
 * Frequency: same as GC (6h), but skips if < 5 unconsolidated episodes.
 */

import type { HoraGraph, Episode, FactEdge, FactMetadata } from "./knowledge-graph.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DreamReport {
  episodesProcessed: number;
  patternsDistilled: number;
  factsReconsolidated: number;
  episodesConsolidated: number;
}

interface EpisodeCluster {
  entityId: string;
  entityName: string;
  episodes: Episode[];
  relatedFacts: FactEdge[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MIN_EPISODES_FOR_DREAM = 5;
const DREAM_WINDOW_DAYS = 7;
const PATTERN_THRESHOLD = 3; // Minimum episodes to distill a pattern
const MAX_DISTILLED_PER_CYCLE = 10;

// ─── Core ───────────────────────────────────────────────────────────────────

/**
 * Run the dream cycle: replay recent episodes, distill patterns, reconsolidate.
 */
export function runDreamCycle(graph: HoraGraph): DreamReport {
  const report: DreamReport = {
    episodesProcessed: 0,
    patternsDistilled: 0,
    factsReconsolidated: 0,
    episodesConsolidated: 0,
  };

  // 1. Get unconsolidated episodes from the last 7 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DREAM_WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString();

  const allEpisodes = graph.getEpisodes();
  if (!allEpisodes || allEpisodes.length === 0) return report;

  const recentEpisodes = allEpisodes.filter(
    (ep) => ep.timestamp >= cutoffStr && !ep.consolidated,
  );

  if (recentEpisodes.length < MIN_EPISODES_FOR_DREAM) return report;

  report.episodesProcessed = recentEpisodes.length;

  // 2. Cluster episodes by shared entities
  const clusters = clusterByEntity(recentEpisodes, graph);

  // 3. For each cluster with 3+ episodes, distill patterns
  let distilled = 0;
  for (const cluster of clusters) {
    if (distilled >= MAX_DISTILLED_PER_CYCLE) break;
    if (cluster.episodes.length < PATTERN_THRESHOLD) continue;

    const result = distillCluster(cluster, graph);
    report.patternsDistilled += result.newFacts;
    report.factsReconsolidated += result.reconsolidated;
    distilled += result.newFacts;
  }

  // 4. Mark processed episodes as consolidated
  for (const ep of recentEpisodes) {
    ep.consolidated = true;
    report.episodesConsolidated++;
  }

  return report;
}

// ─── Clustering ─────────────────────────────────────────────────────────────

/**
 * Cluster episodes by shared entities.
 * An episode belongs to a cluster if it extracted the entity.
 */
function clusterByEntity(episodes: Episode[], graph: HoraGraph): EpisodeCluster[] {
  const entityEpisodes = new Map<string, Episode[]>();

  for (const ep of episodes) {
    for (const entityId of ep.entities_extracted) {
      if (!entityEpisodes.has(entityId)) entityEpisodes.set(entityId, []);
      entityEpisodes.get(entityId)!.push(ep);
    }
  }

  const clusters: EpisodeCluster[] = [];
  for (const [entityId, eps] of entityEpisodes) {
    if (eps.length < PATTERN_THRESHOLD) continue;

    const entity = graph.getEntity(entityId);
    if (!entity) continue;

    // Get facts related to this entity
    const activeFacts = graph.getActiveFacts();
    const relatedFacts = activeFacts.filter(
      (f) => f.source === entityId || f.target === entityId,
    );

    clusters.push({
      entityId,
      entityName: entity.name,
      episodes: eps,
      relatedFacts,
    });
  }

  // Sort by episode count descending
  clusters.sort((a, b) => b.episodes.length - a.episodes.length);
  return clusters;
}

// ─── Distillation ───────────────────────────────────────────────────────────

/**
 * Distill a cluster of episodes into semantic knowledge.
 *
 * Strategy:
 * - Find common facts across episodes
 * - If a fact pattern appears in 3+ episodes → reinforce (reconsolidate)
 * - If episodes share a pattern not yet captured → create new semantic fact
 */
function distillCluster(
  cluster: EpisodeCluster,
  graph: HoraGraph,
): { newFacts: number; reconsolidated: number } {
  let newFacts = 0;
  let reconsolidated = 0;

  // Count how many episodes reference each fact
  const factOccurrences = new Map<string, number>();
  for (const ep of cluster.episodes) {
    for (const factId of ep.facts_extracted) {
      factOccurrences.set(factId, (factOccurrences.get(factId) || 0) + 1);
    }
  }

  // Facts that appear in 3+ episodes → candidates for reinforcement
  for (const [factId, count] of factOccurrences) {
    if (count < PATTERN_THRESHOLD) continue;

    const fact = cluster.relatedFacts.find((f) => f.id === factId);
    if (!fact) continue;

    // Reconsolidate: boost confidence based on repetition
    const newConfidence = Math.min(1.0, fact.confidence + 0.05 * (count - 2));
    if (newConfidence > fact.confidence) {
      const success = graph.reconsolidateFact(factId, {
        confidence: newConfidence,
        metadata: {
          memory_type: "semantic" as const, // Promoted from episodic to semantic
        },
      });
      if (success) reconsolidated++;
    }
  }

  // Check for common relations across episodes that aren't yet captured
  const relationCounts = new Map<string, { count: number; descriptions: string[] }>();
  for (const ep of cluster.episodes) {
    for (const factId of ep.facts_extracted) {
      // Find the fact in the graph (might be expired)
      const allFacts = graph.getAllFacts();
      const fact = allFacts.find((f) => f.id === factId);
      if (!fact) continue;

      const key = `${fact.source}-${fact.relation}-${fact.target}`;
      const existing = relationCounts.get(key);
      if (existing) {
        existing.count++;
        if (!existing.descriptions.includes(fact.description)) {
          existing.descriptions.push(fact.description);
        }
      } else {
        relationCounts.set(key, { count: 1, descriptions: [fact.description] });
      }
    }
  }

  // Create distilled semantic facts for recurring patterns not already active
  const activeFacts = graph.getActiveFacts();
  for (const [key, { count, descriptions }] of relationCounts) {
    if (count < PATTERN_THRESHOLD) continue;
    if (newFacts >= 3) break; // Max 3 new facts per cluster

    const [source, relation, target] = key.split("-");
    if (!source || !relation || !target) continue;

    // Check if an active fact already covers this
    const alreadyCovered = activeFacts.some(
      (f) => f.source === source && f.target === target && f.relation === relation,
    );
    if (alreadyCovered) continue;

    // Create a distilled semantic fact
    const bestDescription = descriptions.sort((a, b) => b.length - a.length)[0];
    if (!bestDescription) continue;

    const metadata: FactMetadata = {
      memory_type: "semantic",
      context: `Distilled from ${count} episodes via dream cycle`,
    };

    graph.addFact(
      source,
      target,
      relation,
      bestDescription,
      Math.min(0.9, 0.6 + 0.1 * (count - 2)),
      undefined,
      metadata,
    );
    newFacts++;
  }

  return { newFacts, reconsolidated };
}
