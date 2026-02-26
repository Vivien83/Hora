/**
 * HORA — Zod Validation Schemas
 *
 * Runtime validation for all JSONL data structures.
 * Used in parseJsonl to filter invalid entries instead of crashing.
 */

import { z } from "zod";

// ─── Core Graph Schemas ─────────────────────────────────────────────────────

export const FactMetadataSchema = z.object({
  context: z.string().optional(),
  evidence: z.string().optional(),
  alternatives: z.array(z.string()).optional(),
  category: z.string().optional(),
  source_session: z.string().optional(),
  memory_type: z.enum(["episodic", "semantic", "procedural"]).optional(),
  reconsolidation_count: z.number().optional(),
  history: z.array(z.object({
    description: z.string(),
    valid_at: z.string(),
    confidence: z.number(),
  })).optional(),
});

export const EntityNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["project", "tool", "error_pattern", "preference", "concept", "person", "file", "library", "pattern", "decision"]),
  name: z.string(),
  properties: z.record(z.union([z.string(), z.number(), z.boolean()])),
  embedding: z.array(z.number()).nullable(),
  created_at: z.string(),
  last_seen: z.string(),
});

export const FactEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  relation: z.string(),
  description: z.string(),
  embedding: z.array(z.number()).nullable(),
  valid_at: z.string(),
  invalid_at: z.string().nullable(),
  created_at: z.string(),
  expired_at: z.string().nullable(),
  confidence: z.number(),
  metadata: FactMetadataSchema.optional(),
});

export const EpisodeSchema = z.object({
  id: z.string(),
  source_type: z.enum(["session", "thread", "failure", "sentiment"]),
  source_ref: z.string(),
  timestamp: z.string(),
  entities_extracted: z.array(z.string()),
  facts_extracted: z.array(z.string()),
  consolidated: z.boolean().optional(),
});

// ─── Activation Model Schema ────────────────────────────────────────────────

export const ActivationEntrySchema = z.object({
  factId: z.string(),
  accessTimes: z.array(z.string()),
  emotionalWeight: z.number(),
  lastActivation: z.number(),
});

// ─── Community Schema ───────────────────────────────────────────────────────

export const CommunitySchema = z.object({
  id: z.string(),
  name: z.string(),
  entities: z.array(z.string()),
  facts: z.array(z.string()),
  summary: z.string(),
  updated_at: z.string(),
});

// ─── Memory Tier Schemas ────────────────────────────────────────────────────

export const SentimentLogEntrySchema = z.object({
  sid: z.string().optional(),
  score: z.number().optional(),
  ts: z.string().optional(),
  messages: z.number().optional(),
  trigger: z.string().optional(),
});

export const FailureLogEntrySchema = z.object({
  ts: z.string().optional(),
  sid: z.string().optional(),
  type: z.string().optional(),
  summary: z.string().optional(),
});

export const EmbeddingIndexEntrySchema = z.object({
  id: z.string(),
  type: z.enum(["entity", "fact"]),
  offset: z.number(),
  dim: z.number(),
});

// ─── Safe Parse Helper ──────────────────────────────────────────────────────

/**
 * Parse a JSONL file with Zod validation.
 * Invalid entries are silently filtered (no crash).
 * Returns only entries that pass validation.
 */
export function parseJsonlWithSchema<T>(
  filePath: string,
  schema: z.ZodType<T>,
  readFileFn: (path: string) => string,
): T[] {
  const content = readFileFn(filePath);
  if (!content) return [];

  const results: T[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const raw = JSON.parse(line);
      const parsed = schema.safeParse(raw);
      if (parsed.success) {
        results.push(parsed.data);
      }
    } catch {
      // Skip malformed lines
    }
  }
  return results;
}
