/**
 * HORA — Hybrid Search: BM25 + Semantic Fusion
 *
 * Combines semantic (embedding) search with exact keyword (BM25) search
 * using Reciprocal Rank Fusion (RRF) for score merging.
 *
 * BM25 via minisearch catches exact term matches that semantic search misses
 * (e.g., "Drizzle" query matching a fact about "uses Drizzle ORM").
 *
 * Dependency: minisearch (zero deps, ~15KB, MIT)
 */

import MiniSearch from "minisearch";
import type { FactEdge, SearchResult } from "./knowledge-graph.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HybridSearchOptions {
  semanticWeight?: number;   // default 0.7
  bm25Weight?: number;       // default 0.3
  limit?: number;
}

interface RankedItem {
  id: string;
  score: number;
  fact: FactEdge;
}

// ─── BM25 Index ─────────────────────────────────────────────────────────────

/**
 * Build a MiniSearch BM25 index from active facts.
 * Indexes: description, relation, and source+target entity names.
 */
export function buildBM25Index(
  facts: FactEdge[],
  entityNames?: Map<string, string>,
): MiniSearch {
  const index = new MiniSearch({
    fields: ["description", "relation", "entities"],
    storeFields: ["id"],
    searchOptions: {
      boost: { description: 2, entities: 1.5, relation: 1 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  const docs = facts.map((f) => {
    const sourceName = entityNames?.get(f.source) || f.source;
    const targetName = entityNames?.get(f.target) || f.target;
    return {
      id: f.id,
      description: f.description,
      relation: f.relation.replace(/_/g, " "),
      entities: `${sourceName} ${targetName}`,
    };
  });

  index.addAll(docs);
  return index;
}

// ─── Reciprocal Rank Fusion ─────────────────────────────────────────────────

const RRF_K = 60; // Standard RRF constant

/**
 * Merge semantic and BM25 results using Reciprocal Rank Fusion.
 * score = Σ(weight / (k + rank_i)) for each system
 */
function reciprocalRankFusion(
  semanticRanked: RankedItem[],
  bm25Ranked: RankedItem[],
  semanticWeight: number,
  bm25Weight: number,
): RankedItem[] {
  const scoreMap = new Map<string, { score: number; fact: FactEdge }>();

  // Semantic ranks
  for (let rank = 0; rank < semanticRanked.length; rank++) {
    const item = semanticRanked[rank];
    const rrfScore = semanticWeight / (RRF_K + rank + 1);
    const existing = scoreMap.get(item.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scoreMap.set(item.id, { score: rrfScore, fact: item.fact });
    }
  }

  // BM25 ranks
  for (let rank = 0; rank < bm25Ranked.length; rank++) {
    const item = bm25Ranked[rank];
    const rrfScore = bm25Weight / (RRF_K + rank + 1);
    const existing = scoreMap.get(item.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scoreMap.set(item.id, { score: rrfScore, fact: item.fact });
    }
  }

  return [...scoreMap.entries()]
    .map(([id, { score, fact }]) => ({ id, score, fact }))
    .sort((a, b) => b.score - a.score);
}

// ─── Hybrid Search ──────────────────────────────────────────────────────────

/**
 * Perform hybrid search combining semantic similarity and BM25.
 *
 * @param query - Raw text query
 * @param semanticResults - Pre-computed semantic search results (from graph.semanticSearch)
 * @param factsMap - Map of all active facts by ID
 * @param bm25Index - Pre-built MiniSearch index
 * @param opts - Weight configuration
 */
export function hybridSearch(
  query: string,
  semanticResults: SearchResult[],
  factsMap: Map<string, FactEdge>,
  bm25Index: MiniSearch,
  opts?: HybridSearchOptions,
): RankedItem[] {
  const semanticWeight = opts?.semanticWeight ?? 0.7;
  const bm25Weight = opts?.bm25Weight ?? 0.3;
  const limit = opts?.limit ?? 20;

  // Convert semantic results to ranked items (facts only)
  const semanticRanked: RankedItem[] = semanticResults
    .filter((r) => r.type === "fact" && r.fact)
    .map((r) => ({ id: r.id, score: r.score, fact: r.fact! }));

  // BM25 search
  const bm25Results = bm25Index.search(query, { limit: 20 });
  const bm25Ranked: RankedItem[] = bm25Results
    .map((r) => {
      const fact = factsMap.get(r.id as string);
      if (!fact) return null;
      return { id: r.id as string, score: r.score, fact };
    })
    .filter((r): r is RankedItem => r !== null);

  // Fuse with RRF
  const fused = reciprocalRankFusion(semanticRanked, bm25Ranked, semanticWeight, bm25Weight);

  return fused.slice(0, limit);
}
