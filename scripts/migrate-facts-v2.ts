#!/usr/bin/env npx tsx
/**
 * HORA — Facts Migration v2: Rich Relations
 *
 * Deterministic migration of existing facts to use the typed ontology.
 * - Re-maps relation via normalizeRelation()
 * - Re-classifies based on source/target entity types
 * - Enriches template descriptions with entity context
 * - Adds metadata.source_session = "migration-v2"
 * - Atomic save
 *
 * Usage: npx tsx scripts/migrate-facts-v2.ts [--dry-run]
 */

import * as fs from "fs";
import * as path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────

const HOME = process.env.HOME || process.env.USERPROFILE || "";
const GRAPH_DIR = path.join(HOME, ".claude", "MEMORY", "GRAPH");
const ENTITIES_FILE = path.join(GRAPH_DIR, "entities.jsonl");
const FACTS_FILE = path.join(GRAPH_DIR, "facts.jsonl");

const DRY_RUN = process.argv.includes("--dry-run");

// ─── Types (inline to avoid import resolution issues in script) ──────────────

interface EntityNode {
  id: string;
  type: string;
  name: string;
  properties: Record<string, string | number | boolean>;
  embedding: number[] | null;
  created_at: string;
  last_seen: string;
}

interface FactEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  description: string;
  embedding: number[] | null;
  valid_at: string;
  invalid_at: string | null;
  created_at: string;
  expired_at: string | null;
  confidence: number;
  metadata?: {
    context?: string;
    evidence?: string;
    alternatives?: string[];
    category?: string;
    source_session?: string;
  };
}

// ─── Ontology (inline to avoid import issues) ───────────────────────────────

const VALID_RELATIONS = new Set([
  "has_component", "depends_on", "extends", "implements", "configures", "replaces", "hosts",
  "uses", "integrates", "built_with", "migrated_from",
  "decided_for", "decided_against", "learned_that", "caused_by", "solved_by", "blocked_by", "workaround_for",
  "works_well_for", "fails_for", "performs_better_than", "anti_pattern_in",
  "works_on", "prefers", "frustrated_with", "satisfied_with", "created", "maintains",
  "related_to", "inspired_by", "contradicts", "specializes", "exemplifies",
]);

const LEGACY_MAP: Record<string, string> = {
  involves: "related_to",
  ecosystem: "has_component",
  serves: "works_well_for",
};

function normalizeRelation(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (VALID_RELATIONS.has(trimmed)) return trimmed;
  if (trimmed in LEGACY_MAP) return LEGACY_MAP[trimmed];
  return "related_to";
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseJsonl<T>(filePath: string): T[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    return [];
  }
  if (!content) return [];
  const results: T[] = [];
  for (const line of content.split("\n")) {
    if (!line) continue;
    try {
      results.push(JSON.parse(line) as T);
    } catch {
      // skip
    }
  }
  return results;
}

function writeJsonlAtomic<T>(filePath: string, entries: T[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length > 0 ? "\n" : "");
  const tmpFile = filePath + `.tmp.${process.pid}`;
  fs.writeFileSync(tmpFile, content, "utf-8");
  fs.renameSync(tmpFile, filePath);
}

// ─── Smart Re-classification ────────────────────────────────────────────────

/**
 * Re-classify a fact based on its current relation, source type, and target type.
 * Returns a more specific relation when possible.
 */
function reclassifyRelation(
  currentRelation: string,
  sourceType: string,
  targetType: string,
  description: string,
  targetName?: string,
): string {
  const normalized = normalizeRelation(currentRelation);
  const tName = (targetName || "").toLowerCase();

  // "involves" (now "related_to") — try to be more specific
  if (currentRelation === "involves" || normalized === "related_to") {
    // project + tool/library → uses or built_with
    if (sourceType === "project" && (targetType === "tool" || targetType === "library")) {
      if (/construit|built|stack|core|fondamental/i.test(description)) {
        return "built_with";
      }
      return "uses";
    }

    // project + concept → smart reclassification based on concept name
    if (sourceType === "project" && targetType === "concept") {
      // Concepts that are architectural patterns implemented in the project
      const implementedConcepts = [
        "knowledge graph", "memory tiers", "bi-temporality", "embeddings",
        "library-first", "ssot", "ghost failures", "tdd", "cosine similarity",
        "bfs traversal", "snapshots", "sentiment analysis",
      ];
      if (implementedConcepts.some(c => tName.includes(c))) {
        return "implements";
      }

      // Concepts that are sub-systems/components
      const componentConcepts = [
        "session-end hook", "prompt-submit hook", "doc-sync", "backup system",
        "security system", "dashboard", "statusline", "install script",
        "neural memory map", "orchestrator",
      ];
      if (componentConcepts.some(c => tName.includes(c))) {
        return "has_component";
      }

      // Concepts that are tools/methodologies used
      const usedConcepts = [
        "forge workflow", "apex methodology", "cleanroom", "power of ten",
        "dry-run mode", "hmr", "sse", "polling", "heatmap",
      ];
      if (usedConcepts.some(c => tName.includes(c))) {
        return "uses";
      }

      // Technology concepts → built_with
      const techConcepts = [
        "server components", "app router", "api routes", "real-time updates",
      ];
      if (techConcepts.some(c => tName.includes(c))) {
        return "built_with";
      }

      // Inspiration sources
      if (tName.includes("graphiti")) {
        return "inspired_by";
      }

      // Migration concept
      if (tName.includes("migration")) {
        return "related_to";
      }

      // Explicit "implements" keywords in description
      if (/implemente|implement|met en|applique/i.test(description)) {
        return "implements";
      }

      return "related_to";
    }

    // concept + concept → specializes or related_to
    if (sourceType === "concept" && targetType === "concept") {
      return "related_to";
    }

    // person + project → works_on
    if (sourceType === "person" && targetType === "project") {
      return "works_on";
    }

    // person + tool → prefers
    if (sourceType === "person" && (targetType === "tool" || targetType === "library")) {
      return "prefers";
    }

    // project + project → has_component
    if (sourceType === "project" && targetType === "project") {
      return "has_component";
    }
  }

  // "uses" — try to be more specific for core stack
  if (normalized === "uses") {
    if (sourceType === "project" && targetType === "tool") {
      // Core technologies → built_with
      const coreTools = ["typescript", "node.js", "react", "next.js", "tailwind css"];
      const targetName = description.toLowerCase();
      if (coreTools.some(t => targetName.includes(t))) {
        return "built_with";
      }
    }
    if (sourceType === "project" && targetType === "library") {
      if (/integre|integrate|composant majeur|deep/i.test(description)) {
        return "integrates";
      }
    }
  }

  // "ecosystem" → has_component (already handled by normalizeRelation)
  // Keep other relations as normalized
  return normalized;
}

/**
 * Enrich a template description with more context from entities.
 */
function enrichDescription(
  description: string,
  sourceEntity: EntityNode | undefined,
  targetEntity: EntityNode | undefined,
  newRelation: string,
): string {
  // If description already has 20+ words, keep it
  if (description.split(/\s+/).length >= 20) {
    return description;
  }

  const sourceName = sourceEntity?.name || "?";
  const targetName = targetEntity?.name || "?";
  const sourceType = sourceEntity?.type || "unknown";
  const targetType = targetEntity?.type || "unknown";

  // Build enriched description based on relation type
  switch (newRelation) {
    case "built_with":
      return `${sourceName} est construit avec ${targetName} comme technologie fondamentale de sa stack, utilise dans l'ensemble de la codebase pour le developpement et l'execution du systeme`;

    case "has_component":
      return `${sourceName} contient ${targetName} comme sous-systeme integre qui contribue a l'architecture globale du projet et fournit des fonctionnalites specifiques`;

    case "uses":
      return `${sourceName} utilise ${targetName} (${targetType}) comme outil dans son workflow de developpement ou son execution, apportant des capacites specifiques au projet`;

    case "integrates":
      return `${sourceName} integre ${targetName} comme composant majeur de son architecture, avec une dependance forte et une utilisation intensive dans le code source`;

    case "works_on":
      return `${sourceName} travaille activement sur ${targetName}, contribuant au developpement, a la maintenance et a l'evolution du projet au fil des sessions`;

    case "prefers":
      return `${sourceName} prefere utiliser ${targetName} dans ses workflows de developpement, choix confirme par l'usage recurrent dans les sessions de travail`;

    case "implements":
      return `${sourceName} implemente le concept de ${targetName} dans son architecture, mettant en pratique ce principe dans le code et les workflows du systeme`;

    case "works_well_for":
      return `${sourceName} fonctionne particulierement bien pour ${targetName}, avec des resultats positifs confirmes par l'experience et les sessions de travail`;

    case "frustrated_with":
      return description; // Keep original — already contextual from sentiment

    case "satisfied_with":
      return description; // Keep original — already contextual from sentiment

    case "related_to":
      return `${sourceName} (${sourceType}) est lie a ${targetName} (${targetType}) dans le contexte du systeme, avec une connexion thematique ou fonctionnelle identifiee dans les sessions`;

    default:
      return description;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log("=== HORA Facts Migration v2: Rich Relations ===\n");

  if (DRY_RUN) {
    console.log("MODE: dry-run (aucune ecriture)\n");
  }

  // Load data
  if (!fs.existsSync(ENTITIES_FILE)) {
    console.error(`Entities file not found: ${ENTITIES_FILE}`);
    process.exit(1);
  }

  const entities = parseJsonl<EntityNode>(ENTITIES_FILE);
  const facts = parseJsonl<FactEdge>(FACTS_FILE);
  const entityById = new Map(entities.map(e => [e.id, e]));

  console.log(`Loaded: ${entities.length} entities, ${facts.length} facts\n`);

  // Stats
  const stats = {
    total: facts.length,
    reclassified: 0,
    enriched: 0,
    involvesBefore: 0,
    involvesAfter: 0,
    metadataAdded: 0,
  };

  // Count "involves" before
  stats.involvesBefore = facts.filter(f => f.relation === "involves").length;

  // Migrate each fact
  const migratedFacts: FactEdge[] = facts.map(fact => {
    const sourceEntity = entityById.get(fact.source);
    const targetEntity = entityById.get(fact.target);
    const sourceType = sourceEntity?.type || "unknown";
    const targetType = targetEntity?.type || "unknown";

    // Re-classify relation (pass target name for concept-aware reclassification)
    const newRelation = reclassifyRelation(
      fact.relation,
      sourceType,
      targetType,
      fact.description,
      targetEntity?.name,
    );

    const relationChanged = newRelation !== fact.relation;
    if (relationChanged) stats.reclassified++;

    // Enrich description
    const newDescription = enrichDescription(
      fact.description,
      sourceEntity,
      targetEntity,
      newRelation,
    );
    if (newDescription !== fact.description) stats.enriched++;

    // Add metadata
    const hasMetadata = !fact.metadata;
    if (hasMetadata) stats.metadataAdded++;

    const migrated: FactEdge = {
      ...fact,
      relation: newRelation,
      description: newDescription,
      // Clear embedding since description changed — will be recalculated
      embedding: newDescription !== fact.description ? null : fact.embedding,
      metadata: {
        ...fact.metadata,
        source_session: fact.metadata?.source_session || "migration-v2",
        category: getCategoryForRelation(newRelation),
      },
    };

    return migrated;
  });

  // Count "involves" after
  stats.involvesAfter = migratedFacts.filter(f => f.relation === "involves").length;

  // Report
  console.log("=== Migration Report ===");
  console.log(`Total facts: ${stats.total}`);
  console.log(`Re-classified: ${stats.reclassified}`);
  console.log(`Descriptions enriched: ${stats.enriched}`);
  console.log(`Metadata added: ${stats.metadataAdded}`);
  console.log(`"involves" before: ${stats.involvesBefore}`);
  console.log(`"involves" after: ${stats.involvesAfter}`);

  // Relation distribution
  const relDist = new Map<string, number>();
  for (const f of migratedFacts) {
    relDist.set(f.relation, (relDist.get(f.relation) || 0) + 1);
  }
  console.log("\nRelation distribution:");
  for (const [rel, count] of [...relDist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${rel}: ${count}`);
  }

  // Write
  if (!DRY_RUN) {
    // Backup original
    const backupFile = FACTS_FILE + ".pre-v2.bak";
    if (!fs.existsSync(backupFile)) {
      fs.copyFileSync(FACTS_FILE, backupFile);
      console.log(`\nBackup: ${backupFile}`);
    }

    writeJsonlAtomic(FACTS_FILE, migratedFacts);
    console.log(`\nWritten: ${FACTS_FILE}`);
  } else {
    console.log("\nDry-run complete. No files modified.");
  }
}

function getCategoryForRelation(relation: string): string {
  const structural = ["has_component", "depends_on", "extends", "implements", "configures", "replaces", "hosts"];
  const technological = ["uses", "integrates", "built_with", "migrated_from"];
  const learning = ["decided_for", "decided_against", "learned_that", "caused_by", "solved_by", "blocked_by", "workaround_for"];
  const experience = ["works_well_for", "fails_for", "performs_better_than", "anti_pattern_in"];
  const actor = ["works_on", "prefers", "frustrated_with", "satisfied_with", "created", "maintains"];

  if (structural.includes(relation)) return "structural";
  if (technological.includes(relation)) return "technological";
  if (learning.includes(relation)) return "learning";
  if (experience.includes(relation)) return "experience";
  if (actor.includes(relation)) return "actor";
  return "conceptual";
}

main();
