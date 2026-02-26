/**
 * HORA — Knowledge Graph Engine
 *
 * Bi-temporal knowledge graph inspired by Graphiti (getzep/graphiti).
 * Stores entities (nodes), facts (edges), and episodes (raw events).
 *
 * Bi-temporality:
 *   - valid_at / invalid_at  — when the fact was true in the real world
 *   - created_at / expired_at — when the fact was recorded / superseded in the graph
 *
 * Storage: JSONL files with atomic writes (tmp + rename).
 * Retrieval: cosine similarity + BFS neighborhood + recency decay.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { getRelationCategory } from "./relation-ontology.js";

// ─── Binary Embedding Storage ───────────────────────────────────────────────

interface EmbeddingIndexEntry {
  id: string;
  type: "entity" | "fact";
  offset: number; // byte offset in embeddings.bin
  dim: number;    // dimension (384)
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FactMetadata {
  context?: string;
  evidence?: string;
  alternatives?: string[];
  category?: string;
  source_session?: string;
  memory_type?: "episodic" | "semantic" | "procedural";
  reconsolidation_count?: number;
  history?: Array<{ description: string; valid_at: string; confidence: number }>;
}

export interface EntityNode {
  id: string;
  type: "project" | "tool" | "error_pattern" | "preference" | "concept" | "person" | "file" | "library" | "pattern" | "decision";
  name: string;
  properties: Record<string, string | number | boolean>;
  embedding: number[] | null;
  created_at: string;
  last_seen: string;
}

export interface FactEdge {
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
  metadata?: FactMetadata;
}

export interface Episode {
  id: string;
  source_type: "session" | "thread" | "failure" | "sentiment";
  source_ref: string;
  timestamp: string;
  entities_extracted: string[];
  facts_extracted: string[];
  consolidated?: boolean;
}

export interface SearchResult {
  type: "entity" | "fact";
  id: string;
  score: number;
  entity?: EntityNode;
  fact?: FactEdge;
}

export interface SubGraph {
  entities: EntityNode[];
  facts: FactEdge[];
}

export interface GraphStats {
  entities: number;
  facts: number;
  activeFacts: number;
  episodes: number;
  embeddedRatio: number;
  topEntities: Array<{ name: string; type: string; connections: number }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function genId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function now(): string {
  return new Date().toISOString();
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

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
      // Skip malformed lines
    }
  }
  return results;
}

function writeJsonlAtomic<T>(filePath: string, entries: T[]): void {
  ensureDir(path.dirname(filePath));
  const content = entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length > 0 ? "\n" : "");
  const tmpFile = filePath + `.tmp.${process.pid}`;
  fs.writeFileSync(tmpFile, content, "utf-8");
  fs.renameSync(tmpFile, filePath);
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

function daysBetween(dateStr: string, refDate: Date): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return Math.max(0, (refDate.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Cosine similarity via dot product.
 * Assumes embeddings are normalized (||v|| = 1), so dot product = cosine sim.
 */
function dotProduct(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Recency decay: exponential decay with 90-day half-life.
 * score = e^(-daysSince / 90)
 */
function recencyDecay(dateStr: string, refDate: Date): number {
  const days = daysBetween(dateStr, refDate);
  if (!isFinite(days)) return 0;
  return Math.exp(-days / 90);
}

// ─── HoraGraph ──────────────────────────────────────────────────────────────

export class HoraGraph {
  private graphDir: string;
  private entities: Map<string, EntityNode>;
  private facts: Map<string, FactEdge>;
  private episodes: Episode[];

  // Name-to-id index for dedup on upsert
  private nameIndex: Map<string, string>;

  constructor(graphDir: string) {
    this.graphDir = graphDir;
    this.entities = new Map();
    this.facts = new Map();
    this.episodes = [];
    this.nameIndex = new Map();

    this.load();
  }

  // ─── Persistence ────────────────────────────────────────────────────────

  private get entitiesFile(): string {
    return path.join(this.graphDir, "entities.jsonl");
  }

  private get factsFile(): string {
    return path.join(this.graphDir, "facts.jsonl");
  }

  private get episodesFile(): string {
    return path.join(this.graphDir, "episodes.jsonl");
  }

  private get embeddingsBinFile(): string {
    return path.join(this.graphDir, "embeddings.bin");
  }

  private get embeddingIndexFile(): string {
    return path.join(this.graphDir, "embedding-index.jsonl");
  }

  private load(): void {
    const rawEntities = parseJsonl<EntityNode>(this.entitiesFile);
    for (const e of rawEntities) {
      this.entities.set(e.id, e);
      this.nameIndex.set(normalizeName(e.name), e.id);
    }

    const rawFacts = parseJsonl<FactEdge>(this.factsFile);
    for (const f of rawFacts) {
      this.facts.set(f.id, f);
    }

    this.episodes = parseJsonl<Episode>(this.episodesFile);

    // Load binary embeddings (new format) — overwrites any inline nulls
    this.loadBinaryEmbeddings();
  }

  /**
   * Load embeddings from binary storage (Float32Array).
   * Falls back gracefully if binary files don't exist yet (pre-migration).
   */
  private loadBinaryEmbeddings(): void {
    const index = parseJsonl<EmbeddingIndexEntry>(this.embeddingIndexFile);
    if (index.length === 0) return;

    let binBuffer: Buffer;
    try {
      binBuffer = fs.readFileSync(this.embeddingsBinFile);
    } catch {
      return; // No binary file yet — inline embeddings (if any) will be used
    }

    for (const entry of index) {
      const start = entry.offset;
      const byteLen = entry.dim * 4;
      if (start + byteLen > binBuffer.length) continue; // Corrupted entry, skip

      // Read Float32Array from buffer at correct offset
      const floatArr = new Float32Array(
        binBuffer.buffer,
        binBuffer.byteOffset + start,
        entry.dim,
      );
      const embedding = Array.from(floatArr);

      if (entry.type === "entity") {
        const entity = this.entities.get(entry.id);
        if (entity) entity.embedding = embedding;
      } else {
        const fact = this.facts.get(entry.id);
        if (fact) fact.embedding = embedding;
      }
    }
  }

  save(): void {
    ensureDir(this.graphDir);

    // Build binary embedding data
    const indexEntries: EmbeddingIndexEntry[] = [];
    const floatArrays: Float32Array[] = [];
    let currentOffset = 0;

    for (const entity of this.entities.values()) {
      if (entity.embedding && entity.embedding.length > 0) {
        const arr = new Float32Array(entity.embedding);
        indexEntries.push({ id: entity.id, type: "entity", offset: currentOffset, dim: arr.length });
        floatArrays.push(arr);
        currentOffset += arr.length * 4;
      }
    }

    for (const fact of this.facts.values()) {
      if (fact.embedding && fact.embedding.length > 0) {
        const arr = new Float32Array(fact.embedding);
        indexEntries.push({ id: fact.id, type: "fact", offset: currentOffset, dim: arr.length });
        floatArrays.push(arr);
        currentOffset += arr.length * 4;
      }
    }

    // Write binary embeddings file atomically
    if (floatArrays.length > 0) {
      const totalBytes = currentOffset;
      const buffer = Buffer.alloc(totalBytes);
      let pos = 0;
      for (const arr of floatArrays) {
        Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).copy(buffer, pos);
        pos += arr.byteLength;
      }
      const tmpBin = this.embeddingsBinFile + `.tmp.${process.pid}`;
      fs.writeFileSync(tmpBin, buffer);
      fs.renameSync(tmpBin, this.embeddingsBinFile);
    } else {
      // No embeddings — clean up binary files if they exist
      try { fs.unlinkSync(this.embeddingsBinFile); } catch {}
    }

    // Write embedding index atomically
    writeJsonlAtomic(this.embeddingIndexFile, indexEntries);

    // Write entities/facts WITHOUT inline embeddings (embeddings are in binary)
    const entitiesToWrite = [...this.entities.values()].map(e => ({ ...e, embedding: null }));
    const factsToWrite = [...this.facts.values()].map(f => ({ ...f, embedding: null }));
    writeJsonlAtomic(this.entitiesFile, entitiesToWrite);
    writeJsonlAtomic(this.factsFile, factsToWrite);
    writeJsonlAtomic(this.episodesFile, this.episodes);
  }

  // ─── CRUD: Entities ─────────────────────────────────────────────────────

  /**
   * Upsert an entity. Name is normalized (lowercase, trim) for dedup.
   * If entity with same normalized name exists, merges properties and updates last_seen.
   * Returns the entity id.
   */
  upsertEntity(
    type: EntityNode["type"],
    name: string,
    properties: Record<string, string | number | boolean> = {},
  ): string {
    const normalized = normalizeName(name);
    const existingId = this.nameIndex.get(normalized);

    if (existingId) {
      const existing = this.entities.get(existingId)!;
      existing.properties = { ...existing.properties, ...properties };
      existing.last_seen = now();
      if (existing.type !== type) {
        existing.type = type;
      }
      return existingId;
    }

    const id = genId();
    const timestamp = now();
    const entity: EntityNode = {
      id,
      type,
      name: normalized,
      properties,
      embedding: null,
      created_at: timestamp,
      last_seen: timestamp,
    };
    this.entities.set(id, entity);
    this.nameIndex.set(normalized, id);
    return id;
  }

  /**
   * Update last_seen timestamp for an entity.
   */
  touchEntity(entityId: string): void {
    const entity = this.entities.get(entityId);
    if (entity) {
      entity.last_seen = now();
    }
  }

  /**
   * Get an entity by id.
   */
  getEntity(entityId: string): EntityNode | undefined {
    return this.entities.get(entityId);
  }

  /**
   * Find entity by normalized name.
   */
  findEntityByName(name: string): EntityNode | undefined {
    const id = this.nameIndex.get(normalizeName(name));
    return id ? this.entities.get(id) : undefined;
  }

  /**
   * Get all entities.
   */
  getAllEntities(): EntityNode[] {
    return [...this.entities.values()];
  }

  // ─── CRUD: Facts ────────────────────────────────────────────────────────

  /**
   * Add a new fact (edge) between two entities.
   * Returns the fact id.
   */
  addFact(
    source: string,
    target: string,
    relation: string,
    description: string,
    confidence: number = 1.0,
    validAt?: string,
    metadata?: FactMetadata,
  ): string {
    // Dedup: check for semantically identical existing facts (same source+target)
    const existingFacts = this.getActiveFacts().filter(
      (f) => f.source === source && f.target === target,
    );
    for (const existing of existingFacts) {
      if (existing.embedding) {
        // Check embedding similarity if the new fact also has an embedding
        // (embedding is set after addFact, so we compare descriptions as fallback)
        const descSim = this.descriptionSimilarity(existing.description, description);
        if (descSim > 0.85) {
          // Near-duplicate — supersede old, keep the newer one
          this.supersedeFact(existing.id);
          break;
        }
      } else {
        // No embedding — use description similarity
        const descSim = this.descriptionSimilarity(existing.description, description);
        if (descSim > 0.85) {
          this.supersedeFact(existing.id);
          break;
        }
      }
    }

    const id = genId();
    const timestamp = now();
    const fact: FactEdge = {
      id,
      source,
      target,
      relation,
      description,
      embedding: null,
      valid_at: validAt || timestamp,
      invalid_at: null,
      created_at: timestamp,
      expired_at: null,
      confidence,
      ...(metadata ? { metadata } : {}),
    };
    this.facts.set(id, fact);

    // Touch connected entities
    this.touchEntity(source);
    this.touchEntity(target);

    return id;
  }

  /**
   * Check for semantic dedup using embedding cosine similarity.
   * Call after embeddings are set on both facts.
   * Returns true if a duplicate was found and superseded.
   */
  deduplicateByEmbedding(factId: string, threshold: number = 0.92): boolean {
    const fact = this.facts.get(factId);
    if (!fact || !fact.embedding || fact.expired_at !== null) return false;

    for (const existing of this.facts.values()) {
      if (existing.id === factId) continue;
      if (existing.expired_at !== null) continue;
      if (!existing.embedding) continue;
      if (existing.source !== fact.source || existing.target !== fact.target) continue;

      const sim = dotProduct(fact.embedding, existing.embedding);
      if (sim > threshold) {
        // Supersede the older one (keep the newer)
        const existingDate = new Date(existing.created_at).getTime();
        const factDate = new Date(fact.created_at).getTime();
        if (factDate >= existingDate) {
          this.supersedeFact(existing.id);
        } else {
          this.supersedeFact(factId);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Simple text-based description similarity using word overlap (Jaccard).
   * Used as fallback when embeddings aren't available yet.
   */
  private descriptionSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }
    return intersection / (wordsA.size + wordsB.size - intersection);
  }

  /**
   * Supersede an existing fact with explicit bi-temporal tracking.
   *
   * Bi-temporal semantics (Graphiti-compatible):
   *   - invalid_at: when the fact stopped being true in the real world
   *   - expired_at: when the fact was superseded in the graph (always now())
   *
   * @param invalidAt - When the fact became invalid in reality. Defaults to now().
   */
  supersedeFact(
    factId: string,
    replacement?: {
      relation?: string;
      description?: string;
      confidence?: number;
    },
    invalidAt?: string,
  ): string | null {
    const oldFact = this.facts.get(factId);
    if (!oldFact) return null;

    // Bi-temporal: mark both graph-time (expired_at) and real-world-time (invalid_at)
    const timestamp = now();
    oldFact.expired_at = timestamp;
    oldFact.invalid_at = invalidAt || timestamp;

    // Create replacement if provided
    if (replacement) {
      return this.addFact(
        oldFact.source,
        oldFact.target,
        replacement.relation || oldFact.relation,
        replacement.description || oldFact.description,
        replacement.confidence ?? oldFact.confidence,
      );
    }

    return null;
  }

  /**
   * Reconsolidate a fact: update its content without superseding.
   * Only semantic and procedural facts are reconsolidable; episodic facts are immutable.
   * Preserves history of previous states (max 5 versions).
   *
   * Returns true if reconsolidation succeeded.
   */
  reconsolidateFact(factId: string, updates: {
    description?: string;
    confidence?: number;
    metadata?: Partial<FactMetadata>;
  }): boolean {
    const fact = this.facts.get(factId);
    if (!fact || fact.expired_at !== null) return false;

    // Episodic facts are immutable (time-bound context)
    const memoryType = fact.metadata?.memory_type;
    if (memoryType === "episodic") return false;

    // Save previous state in history
    const history = fact.metadata?.history || [];
    history.push({
      description: fact.description,
      valid_at: fact.valid_at,
      confidence: fact.confidence,
    });
    // Keep max 5 history entries
    if (history.length > 5) history.splice(0, history.length - 5);

    // Apply updates
    if (updates.description) fact.description = updates.description;
    if (updates.confidence !== undefined) fact.confidence = updates.confidence;
    fact.valid_at = now(); // Reconsolidation refreshes valid_at

    // Merge metadata
    const reconCount = (fact.metadata?.reconsolidation_count || 0) + 1;
    fact.metadata = {
      ...fact.metadata,
      ...updates.metadata,
      history,
      reconsolidation_count: reconCount,
    };

    // Clear embedding so it gets recomputed
    fact.embedding = null;

    return true;
  }

  /**
   * Get all episodes.
   */
  getEpisodes(): Episode[] {
    return this.episodes;
  }

  /**
   * Get all facts (including expired).
   */
  getAllFacts(): FactEdge[] {
    return [...this.facts.values()];
  }

  /**
   * Get all currently active facts (not expired).
   */
  getActiveFacts(): FactEdge[] {
    return [...this.facts.values()].filter((f) => f.expired_at === null);
  }

  /**
   * Get facts active at a given date using bi-temporal filtering.
   *
   * Bi-temporal (Graphiti-compatible):
   *   - Graph dimension: created_at <= D AND (expired_at is null OR expired_at > D)
   *   - Real-world dimension: valid_at <= D AND (invalid_at is null OR invalid_at > D)
   *
   * A fact must be active in BOTH dimensions to be returned.
   */
  getActiveFactsAt(date: string): FactEdge[] {
    const d = new Date(date);
    if (isNaN(d.getTime())) return [];

    return [...this.facts.values()].filter((f) => {
      // Graph dimension: was the fact recorded and not yet superseded?
      const created = new Date(f.created_at);
      if (created > d) return false;
      if (f.expired_at !== null) {
        const expired = new Date(f.expired_at);
        if (expired <= d) return false;
      }

      // Real-world dimension: was the fact true at that date?
      const validAt = new Date(f.valid_at);
      if (validAt > d) return false;
      if (f.invalid_at !== null) {
        const invalidAt = new Date(f.invalid_at);
        if (invalidAt <= d) return false;
      }

      return true;
    });
  }

  // ─── CRUD: Episodes ─────────────────────────────────────────────────────

  /**
   * Record an episode (raw event that triggered entity/fact extraction).
   * Returns the episode id.
   */
  addEpisode(
    sourceType: Episode["source_type"],
    sourceRef: string,
    entitiesExtracted: string[],
    factsExtracted: string[],
  ): string {
    const id = genId();
    const episode: Episode = {
      id,
      source_type: sourceType,
      source_ref: sourceRef,
      timestamp: now(),
      entities_extracted: entitiesExtracted,
      facts_extracted: factsExtracted,
    };
    this.episodes.push(episode);
    return id;
  }

  // ─── Embeddings ─────────────────────────────────────────────────────────

  /**
   * Set embedding vector for an entity.
   */
  setEntityEmbedding(entityId: string, embedding: number[]): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) return false;
    entity.embedding = embedding;
    return true;
  }

  /**
   * Set embedding vector for a fact.
   */
  setFactEmbedding(factId: string, embedding: number[]): boolean {
    const fact = this.facts.get(factId);
    if (!fact) return false;
    fact.embedding = embedding;
    return true;
  }

  // ─── Retrieval ──────────────────────────────────────────────────────────

  /**
   * Semantic search across all embedded entities and facts.
   * Score = cosine_similarity * activation_factor * confidence
   * Falls back to recency_decay if no activation log provided.
   * Returns top results sorted by score descending.
   */
  semanticSearch(
    queryEmbedding: number[],
    opts: {
      limit?: number;
      minScore?: number;
      types?: Array<"entity" | "fact">;
      activationLog?: Map<string, { lastActivation: number }>;
    } = {},
  ): SearchResult[] {
    const limit = opts.limit ?? 10;
    const minScore = opts.minScore ?? 0.0;
    const types = opts.types ?? ["entity", "fact"];
    const actLog = opts.activationLog;
    const refDate = new Date();
    const results: SearchResult[] = [];

    if (types.includes("entity")) {
      for (const entity of this.entities.values()) {
        if (!entity.embedding) continue;
        const sim = dotProduct(queryEmbedding, entity.embedding);
        const decay = recencyDecay(entity.last_seen, refDate);
        const score = sim * decay;
        if (score >= minScore) {
          results.push({ type: "entity", id: entity.id, score, entity });
        }
      }
    }

    if (types.includes("fact")) {
      for (const fact of this.facts.values()) {
        if (!fact.embedding) continue;
        if (fact.expired_at !== null) continue; // Only search active facts
        const sim = dotProduct(queryEmbedding, fact.embedding);

        let scoreFactor: number;
        if (actLog) {
          // ACT-R activation-based scoring
          const actEntry = actLog.get(fact.id);
          const activation = actEntry?.lastActivation ?? -1;
          // sigmoid normalization: maps activation to 0-1, centered on threshold
          const actF = 1 / (1 + Math.exp(-(activation + 2)));
          scoreFactor = actF * fact.confidence;
        } else {
          // Fallback: recency decay
          scoreFactor = recencyDecay(fact.valid_at, refDate);
        }

        const score = sim * scoreFactor;
        if (score >= minScore) {
          results.push({ type: "fact", id: fact.id, score, fact });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * BFS neighborhood expansion from an entity.
   * Returns all entities and facts within `depth` hops.
   */
  getNeighborhood(entityId: string, depth: number = 2): SubGraph {
    const visitedEntities = new Set<string>();
    const visitedFacts = new Set<string>();
    let frontier = new Set<string>([entityId]);

    // Pre-build adjacency index for active facts only
    const adjacency = new Map<string, FactEdge[]>();
    for (const fact of this.facts.values()) {
      if (fact.expired_at !== null) continue;

      if (!adjacency.has(fact.source)) adjacency.set(fact.source, []);
      adjacency.get(fact.source)!.push(fact);

      if (!adjacency.has(fact.target)) adjacency.set(fact.target, []);
      adjacency.get(fact.target)!.push(fact);
    }

    for (let d = 0; d < depth; d++) {
      const nextFrontier = new Set<string>();

      for (const nodeId of frontier) {
        if (visitedEntities.has(nodeId)) continue;
        visitedEntities.add(nodeId);

        const edges = adjacency.get(nodeId) || [];
        for (const fact of edges) {
          if (visitedFacts.has(fact.id)) continue;
          visitedFacts.add(fact.id);

          const neighbor = fact.source === nodeId ? fact.target : fact.source;
          if (!visitedEntities.has(neighbor)) {
            nextFrontier.add(neighbor);
          }
        }
      }

      frontier = nextFrontier;
      if (frontier.size === 0) break;
    }

    // Include the last frontier in visited entities
    for (const nodeId of frontier) {
      visitedEntities.add(nodeId);
    }

    const entities: EntityNode[] = [];
    for (const id of visitedEntities) {
      const entity = this.entities.get(id);
      if (entity) entities.push(entity);
    }

    const facts: FactEdge[] = [];
    for (const id of visitedFacts) {
      const fact = this.facts.get(id);
      if (fact) facts.push(fact);
    }

    return { entities, facts };
  }

  /**
   * Get all facts connected to an entity (as source or target),
   * sorted by valid_at ascending.
   */
  getTimeline(entityId: string): FactEdge[] {
    const results: FactEdge[] = [];
    for (const fact of this.facts.values()) {
      if (fact.source === entityId || fact.target === entityId) {
        results.push(fact);
      }
    }
    results.sort((a, b) => a.valid_at.localeCompare(b.valid_at));
    return results;
  }

  // ─── Filtered Retrieval ─────────────────────────────────────────────────

  /**
   * Find active facts filtered by relation type.
   */
  findFactsByRelation(relations: string[]): FactEdge[] {
    const relationSet = new Set(relations);
    return this.getActiveFacts().filter((f) => relationSet.has(f.relation));
  }

  /**
   * Find entities filtered by type.
   */
  findEntitiesByType(types: Array<EntityNode["type"]>): EntityNode[] {
    const typeSet = new Set(types);
    return [...this.entities.values()].filter((e) => typeSet.has(e.type));
  }

  /**
   * Get subgraph around a project entity (found by name).
   * Returns neighborhood of depth 1 if entity exists, null otherwise.
   */
  getProjectSubgraph(projectName: string): SubGraph | null {
    const entity = this.findEntityByName(projectName);
    if (!entity) return null;
    return this.getNeighborhood(entity.id, 1);
  }

  /**
   * Find active facts by category.
   * Uses metadata.category if set, otherwise derives from relation via ontology.
   */
  findFactsByCategory(category: string): FactEdge[] {
    return this.getActiveFacts().filter((f) => {
      if (f.metadata?.category === category) return true;
      return getRelationCategory(f.relation) === category;
    });
  }

  // ─── Stats ──────────────────────────────────────────────────────────────

  /**
   * Get graph statistics for dashboard visualization.
   */
  getStats(): GraphStats {
    const entityCount = this.entities.size;
    const factCount = this.facts.size;
    const activeFacts = this.getActiveFacts().length;

    // Count embedded items
    let embeddedEntities = 0;
    for (const e of this.entities.values()) {
      if (e.embedding) embeddedEntities++;
    }
    let embeddedFacts = 0;
    for (const f of this.facts.values()) {
      if (f.embedding) embeddedFacts++;
    }
    const totalItems = entityCount + factCount;
    const embeddedRatio = totalItems > 0 ? (embeddedEntities + embeddedFacts) / totalItems : 0;

    // Top entities by connection count (active facts only)
    const connectionCount = new Map<string, number>();
    for (const fact of this.facts.values()) {
      if (fact.expired_at !== null) continue;
      connectionCount.set(fact.source, (connectionCount.get(fact.source) || 0) + 1);
      connectionCount.set(fact.target, (connectionCount.get(fact.target) || 0) + 1);
    }

    const topEntities = [...connectionCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, connections]) => {
        const entity = this.entities.get(id);
        return {
          name: entity?.name || id,
          type: entity?.type || "unknown",
          connections,
        };
      });

    return {
      entities: entityCount,
      facts: factCount,
      activeFacts,
      episodes: this.episodes.length,
      embeddedRatio: Math.round(embeddedRatio * 100) / 100,
      topEntities,
    };
  }
}
