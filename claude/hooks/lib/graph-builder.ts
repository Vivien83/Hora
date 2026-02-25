/**
 * HORA — Knowledge Graph Builder (LLM extraction)
 *
 * Uses `claude -p` (CLI pipe, covered by subscription) to extract
 * entities and facts from session data, then calculates embeddings.
 *
 * Runs in session-end background — must never crash.
 */

import { execSync } from "child_process";
import type { EntityNode, FactEdge, HoraGraph } from "./knowledge-graph.js";
import { embedBatch } from "./embeddings.js";

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface ExtractionResult {
  entities: Array<{
    type: EntityNode["type"];
    name: string;
    properties?: Record<string, string>;
  }>;
  facts: Array<{
    source_name: string;
    target_name: string;
    relation: string;
    description: string;
    valid_at?: string;
  }>;
  superseded: Array<{
    existing_fact_description: string;
    reason: string;
  }>;
}

export interface SessionData {
  sessionId: string;
  archive: string;
  failures: Array<{ type: string; summary: string }>;
  sentiment: number;
  toolUsage: Record<string, number>;
  projectId?: string;
}

export interface BuildReport {
  newEntities: EntityNode[];
  newFacts: FactEdge[];
  supersededCount: number;
  episodeId: string;
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function emptyReport(error?: string): BuildReport {
  return {
    newEntities: [],
    newFacts: [],
    supersededCount: 0,
    episodeId: "",
    error,
  };
}

/**
 * Check if `claude` CLI is available on the system.
 */
function claudeAvailable(): boolean {
  try {
    execSync("which claude", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 5000 });
    return true;
  } catch {
    // Fallback: check common install path
    try {
      execSync("test -x /usr/local/bin/claude", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Call `claude -p` with a prompt on stdin.
 * Returns the raw text output, or empty string on any error.
 * GF-1: checks claude availability first.
 * GF-6: sets HORA_SKIP_HOOKS=1 to prevent recursion.
 */
export function callClaude(prompt: string): string {
  try {
    if (!claudeAvailable()) return "";

    const result = execSync("claude -p --output-format text --max-turns 1", {
      input: prompt,
      encoding: "utf8",
      timeout: 45000,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, HORA_SKIP_HOOKS: "1" },
    });

    return (result || "").trim();
  } catch {
    return "";
  }
}

/**
 * Build the extraction prompt for Claude.
 * Includes existing entities/facts for dedup and contradiction detection.
 */
export function buildExtractionPrompt(
  sessionData: SessionData,
  existingEntities: EntityNode[],
  activeFacts: FactEdge[],
): string {
  // Format existing entities (max 100)
  const entityList = existingEntities
    .slice(0, 100)
    .map((e) => `- ${e.name} (${e.type})`)
    .join("\n");

  // Format active facts (max 50)
  const factList = activeFacts
    .slice(0, 50)
    .map((f) => `- ${f.description}`)
    .join("\n");

  // Format tool usage
  const toolUsageStr = Object.entries(sessionData.toolUsage)
    .map(([tool, count]) => `${tool}: ${count}`)
    .join(", ");

  // Format failures
  const failuresStr = sessionData.failures.length > 0
    ? sessionData.failures.map((f) => `[${f.type}] ${f.summary}`).join("\n")
    : "Aucune";

  // Truncate archive to 3000 chars
  const archiveText = sessionData.archive.length > 3000
    ? sessionData.archive.slice(0, 3000) + "..."
    : sessionData.archive;

  return `Tu es un extracteur de knowledge graph pour un systeme de memoire IA.
A partir de ce resume de session de travail, extrais :

1. ENTITES (types: project, tool, error_pattern, preference, concept, person, file, library)
2. FAITS (relations entre entites avec description en langage naturel)
3. CONTRADICTIONS avec les faits existants

Entites existantes (reutilise ces noms exacts pour eviter les doublons) :
${entityList || "(aucune)"}

Faits actifs existants (pour detecter les contradictions) :
${factList || "(aucun)"}

Session a analyser :
- Session ID: ${sessionData.sessionId}
- Projet: ${sessionData.projectId || "inconnu"}
- Sentiment: ${sessionData.sentiment}/5
- Outils: ${toolUsageStr || "aucun"}
- Erreurs: ${failuresStr}
- Resume: ${archiveText}

Reponds UNIQUEMENT en JSON valide (pas de markdown, pas de commentaires) :
{"entities":[{"type":"...","name":"...","properties":{}}],"facts":[{"source_name":"...","target_name":"...","relation":"...","description":"..."}],"superseded":[{"existing_fact_description":"...","reason":"..."}]}
Max 10 entites, max 15 faits, max 5 contradictions.`;
}

/**
 * Parse the raw LLM output into an ExtractionResult.
 * GF-3: tries JSON.parse, then regex extraction from markdown blocks.
 * GF-4: returns null if all parsing fails.
 */
export function parseExtraction(rawResult: string): ExtractionResult | null {
  if (!rawResult) return null;

  // Attempt 1: direct JSON.parse
  try {
    const parsed = JSON.parse(rawResult);
    return validateExtraction(parsed);
  } catch {
    // Continue to fallback
  }

  // Attempt 2: extract JSON from markdown code blocks
  try {
    const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return validateExtraction(parsed);
    }
  } catch {
    // Continue to null
  }

  return null;
}

/**
 * Validate and cap extraction result to prevent oversized output.
 * GF-7: max 10 entities, 15 facts, 5 superseded.
 */
function validateExtraction(raw: Record<string, unknown>): ExtractionResult | null {
  if (!raw || typeof raw !== "object") return null;

  const entities = Array.isArray(raw.entities) ? raw.entities.slice(0, 10) : [];
  const facts = Array.isArray(raw.facts) ? raw.facts.slice(0, 15) : [];
  const superseded = Array.isArray(raw.superseded) ? raw.superseded.slice(0, 5) : [];

  // Basic shape validation
  const validEntities = entities.filter(
    (e: Record<string, unknown>) =>
      typeof e === "object" && e !== null && typeof e.name === "string" && typeof e.type === "string",
  );

  const validFacts = facts.filter(
    (f: Record<string, unknown>) =>
      typeof f === "object" &&
      f !== null &&
      typeof f.source_name === "string" &&
      typeof f.target_name === "string" &&
      typeof f.relation === "string" &&
      typeof f.description === "string",
  );

  const validSuperseded = superseded.filter(
    (s: Record<string, unknown>) =>
      typeof s === "object" && s !== null && typeof s.existing_fact_description === "string",
  );

  if (validEntities.length === 0 && validFacts.length === 0) return null;

  return {
    entities: validEntities as ExtractionResult["entities"],
    facts: validFacts as ExtractionResult["facts"],
    superseded: validSuperseded as ExtractionResult["superseded"],
  };
}

/**
 * Apply extraction results to the graph.
 * - Upserts entities
 * - Adds facts (resolving names to entity IDs)
 * - Supersedes contradicted facts
 * - Creates an Episode linking everything
 * GF-5: skips facts where source/target entity cannot be resolved.
 * GF-7: caps at 20 facts per episode.
 */
export function applyToGraph(
  graph: HoraGraph,
  extraction: ExtractionResult,
  sessionData: SessionData,
): BuildReport {
  const newEntityIds: string[] = [];
  const newFactIds: string[] = [];
  const newEntities: EntityNode[] = [];
  const newFacts: FactEdge[] = [];
  let supersededCount = 0;

  // 1. Upsert entities
  for (const ent of extraction.entities) {
    try {
      const id = graph.upsertEntity(
        ent.type,
        ent.name,
        (ent.properties as Record<string, string | number | boolean>) || {},
      );
      newEntityIds.push(id);
      const entity = graph.getEntity(id);
      if (entity) newEntities.push(entity);
    } catch {
      // Skip malformed entity
    }
  }

  // 2. Add facts (resolve source/target by name)
  let factCount = 0;
  for (const fact of extraction.facts) {
    if (factCount >= 20) break; // GF-7: cap

    try {
      const sourceEntity = graph.findEntityByName(fact.source_name);
      const targetEntity = graph.findEntityByName(fact.target_name);

      // GF-5: skip if either entity not found
      if (!sourceEntity || !targetEntity) continue;

      const factId = graph.addFact(
        sourceEntity.id,
        targetEntity.id,
        fact.relation,
        fact.description,
        1.0,
        fact.valid_at,
      );
      newFactIds.push(factId);
      const activeFacts = graph.getActiveFacts();
      const addedFact = activeFacts.find((f) => f.id === factId);
      if (addedFact) newFacts.push(addedFact);
      factCount++;
    } catch {
      // Skip malformed fact
    }
  }

  // 3. Supersede contradicted facts
  for (const sup of extraction.superseded) {
    try {
      const activeFacts = graph.getActiveFacts();
      const descLower = sup.existing_fact_description.toLowerCase();

      // Match by description substring
      const match = activeFacts.find(
        (f) =>
          f.description.toLowerCase().includes(descLower) ||
          descLower.includes(f.description.toLowerCase()),
      );

      if (match) {
        graph.supersedeFact(match.id);
        supersededCount++;
      }
    } catch {
      // Skip
    }
  }

  // 4. Create episode
  const episodeId = graph.addEpisode(
    "session",
    sessionData.sessionId,
    newEntityIds,
    newFactIds,
  );

  // 5. Save
  graph.save();

  return {
    newEntities,
    newFacts,
    supersededCount,
    episodeId,
  };
}

/**
 * Main entry point: build knowledge graph from a session.
 *
 * 1. Build prompt with existing graph context
 * 2. Call Claude for extraction
 * 3. Parse LLM output
 * 4. Apply to graph
 * 5. Calculate and set embeddings for new items
 */
export async function buildGraphFromSession(
  graph: HoraGraph,
  sessionData: SessionData,
): Promise<BuildReport> {
  try {
    // 1. Build prompt
    const existingEntities = graph.getAllEntities();
    const activeFacts = graph.getActiveFacts();
    const prompt = buildExtractionPrompt(sessionData, existingEntities, activeFacts);

    // 2. Call Claude
    const rawResult = callClaude(prompt);
    if (!rawResult) {
      return emptyReport("claude -p returned empty result");
    }

    // 3. Parse extraction
    const extraction = parseExtraction(rawResult);
    if (!extraction) {
      return emptyReport("Failed to parse extraction result");
    }

    // 4. Apply to graph
    const report = applyToGraph(graph, extraction, sessionData);

    // 5. Calculate embeddings for new entities and facts
    try {
      const textsToEmbed: string[] = [];
      const embedTargets: Array<{ type: "entity" | "fact"; id: string }> = [];

      for (const entity of report.newEntities) {
        if (!entity.embedding) {
          textsToEmbed.push(`${entity.type}: ${entity.name}`);
          embedTargets.push({ type: "entity", id: entity.id });
        }
      }

      for (const fact of report.newFacts) {
        if (!fact.embedding) {
          textsToEmbed.push(`${fact.relation}: ${fact.description}`);
          embedTargets.push({ type: "fact", id: fact.id });
        }
      }

      if (textsToEmbed.length > 0) {
        const embeddings = await embedBatch(textsToEmbed);

        for (let i = 0; i < embedTargets.length; i++) {
          const target = embedTargets[i];
          const embedding = embeddings[i];
          if (!embedding) continue;

          if (target.type === "entity") {
            graph.setEntityEmbedding(target.id, embedding);
          } else {
            graph.setFactEmbedding(target.id, embedding);
          }
        }

        // Save again after embeddings
        graph.save();
      }
    } catch {
      // Embeddings are optional — graph data is already saved
    }

    return report;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return emptyReport(`buildGraphFromSession failed: ${message}`);
  }
}
