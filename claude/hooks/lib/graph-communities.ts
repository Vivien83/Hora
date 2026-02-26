/**
 * HORA — Graph Community Detection
 *
 * Detects communities in the knowledge graph using:
 * 1. Connected components (BFS) → base communities
 * 2. Label propagation (5 iterations) → refinement
 *
 * Inspired by Graphiti's Leiden communities, but without Neo4j dependency.
 * Storage: GRAPH/communities.jsonl
 */

import * as fs from "fs";
import * as path from "path";
import type { HoraGraph, FactEdge } from "./knowledge-graph.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Community {
  id: string;
  name: string;           // Most connected entity name
  entities: string[];     // Entity IDs
  facts: string[];        // Internal fact IDs
  summary: string;        // Deterministic description
  updated_at: string;
}

// ─── Community Detection ────────────────────────────────────────────────────

/**
 * Detect communities in the knowledge graph.
 * Uses connected components + label propagation.
 */
export function detectCommunities(graph: HoraGraph): Community[] {
  const activeFacts = graph.getActiveFacts();
  const allEntities = graph.getAllEntities();

  if (allEntities.length === 0) return [];

  // Build adjacency list from active facts
  const adjacency = new Map<string, Set<string>>();
  const entityFacts = new Map<string, Set<string>>();

  for (const entity of allEntities) {
    adjacency.set(entity.id, new Set());
    entityFacts.set(entity.id, new Set());
  }

  for (const fact of activeFacts) {
    if (adjacency.has(fact.source) && adjacency.has(fact.target)) {
      adjacency.get(fact.source)!.add(fact.target);
      adjacency.get(fact.target)!.add(fact.source);
      entityFacts.get(fact.source)!.add(fact.id);
      entityFacts.get(fact.target)!.add(fact.id);
    }
  }

  // Step 1: Connected components via BFS
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const entityId of adjacency.keys()) {
    if (visited.has(entityId)) continue;

    const component: string[] = [];
    const queue = [entityId];
    visited.add(entityId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      const neighbors = adjacency.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }

    if (component.length >= 2) {
      components.push(component);
    }
  }

  // Step 2: Label propagation within large components (refine)
  const labels = new Map<string, string>();
  for (const component of components) {
    // Initialize: each node is its own label
    for (const nodeId of component) {
      labels.set(nodeId, nodeId);
    }

    // 5 iterations of label propagation
    for (let iter = 0; iter < 5; iter++) {
      let changed = false;
      for (const nodeId of component) {
        const neighbors = adjacency.get(nodeId);
        if (!neighbors || neighbors.size === 0) continue;

        // Count neighbor labels
        const labelCounts = new Map<string, number>();
        for (const neighbor of neighbors) {
          const label = labels.get(neighbor) || neighbor;
          labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
        }

        // Pick most frequent label
        let bestLabel = labels.get(nodeId)!;
        let bestCount = 0;
        for (const [label, count] of labelCounts) {
          if (count > bestCount) {
            bestCount = count;
            bestLabel = label;
          }
        }

        if (bestLabel !== labels.get(nodeId)) {
          labels.set(nodeId, bestLabel);
          changed = true;
        }
      }
      if (!changed) break;
    }
  }

  // Step 3: Group by final label
  const labelGroups = new Map<string, string[]>();
  for (const [nodeId, label] of labels) {
    if (!labelGroups.has(label)) labelGroups.set(label, []);
    labelGroups.get(label)!.push(nodeId);
  }

  // Step 4: Build Community objects
  const communities: Community[] = [];
  let communityIdx = 0;

  for (const [, members] of labelGroups) {
    if (members.length < 2) continue;

    // Find most connected entity (hub)
    let hubId = members[0];
    let maxConnections = 0;
    for (const memberId of members) {
      const connections = adjacency.get(memberId)?.size || 0;
      if (connections > maxConnections) {
        maxConnections = connections;
        hubId = memberId;
      }
    }

    const hubEntity = graph.getEntity(hubId);
    const hubName = hubEntity?.name || hubId;

    // Collect internal facts
    const memberSet = new Set(members);
    const internalFacts: string[] = [];
    for (const fact of activeFacts) {
      if (memberSet.has(fact.source) && memberSet.has(fact.target)) {
        internalFacts.push(fact.id);
      }
    }

    // Generate deterministic summary
    const entityNames = members
      .map((id) => graph.getEntity(id)?.name || id)
      .slice(0, 5);
    const summary = `Community centered on "${hubName}" with ${members.length} entities: ${entityNames.join(", ")}${members.length > 5 ? "..." : ""}`;

    communities.push({
      id: `community-${communityIdx++}`,
      name: hubName,
      entities: members,
      facts: internalFacts,
      summary,
      updated_at: new Date().toISOString(),
    });
  }

  // Sort by size descending
  communities.sort((a, b) => b.entities.length - a.entities.length);
  return communities;
}

/**
 * Find the community containing a given entity.
 */
export function getCommunityForEntity(
  entityId: string,
  communities: Community[],
): Community | null {
  return communities.find((c) => c.entities.includes(entityId)) || null;
}

// ─── Persistence ────────────────────────────────────────────────────────────

/**
 * Save communities to GRAPH/communities.jsonl
 */
export function saveCommunities(graphDir: string, communities: Community[]): void {
  const filePath = path.join(graphDir, "communities.jsonl");
  const content = communities.map((c) => JSON.stringify(c)).join("\n") + (communities.length > 0 ? "\n" : "");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpFile = filePath + `.tmp.${process.pid}`;
  fs.writeFileSync(tmpFile, content, "utf-8");
  fs.renameSync(tmpFile, filePath);
}

/**
 * Load communities from GRAPH/communities.jsonl
 */
export function loadCommunities(graphDir: string): Community[] {
  const filePath = path.join(graphDir, "communities.jsonl");
  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) return [];
    return content.split("\n").filter(Boolean).map((line) => {
      try { return JSON.parse(line) as Community; } catch { return null; }
    }).filter((c): c is Community => c !== null);
  } catch {
    return [];
  }
}
