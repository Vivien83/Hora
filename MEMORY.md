<p align="center">
  <img src="https://img.shields.io/badge/Memory-Neuroscience--inspired-teal?style=for-the-badge" alt="Neuroscience-inspired">
  <img src="https://img.shields.io/badge/Embeddings-Local_ONNX_384d-orange?style=for-the-badge" alt="Local ONNX">
  <img src="https://img.shields.io/badge/Search-Semantic_+_BM25-blue?style=for-the-badge" alt="Hybrid Search">
  <img src="https://img.shields.io/badge/Cost-$0-brightgreen?style=for-the-badge" alt="Zero Cost">
  <img src="https://img.shields.io/badge/Storage-100%25_Local-purple?style=for-the-badge" alt="100% Local">
</p>

<h1 align="center">HORA Memory System</h1>
<h3 align="center">Deep Technical Documentation</h3>

<p align="center">
  <strong>A neuroscience-inspired, bi-temporal knowledge graph with zero-cloud operation.</strong><br>
  ACT-R activation decay, hippocampal dream cycles, Baddeley working memory chunking,<br>
  and Tulving memory taxonomy — all running locally on your machine.
</p>

<p align="center">
  <a href="#neuroscience-foundations">Neuroscience</a> &bull;
  <a href="#knowledge-graph">Knowledge Graph</a> &bull;
  <a href="#memory-tiers">Memory Tiers</a> &bull;
  <a href="#agentic-retrieval">Retrieval</a> &bull;
  <a href="#activation-model">ACT-R Model</a> &bull;
  <a href="#dream-cycle">Dream Cycle</a> &bull;
  <a href="#signal-tracker">Signal Tracker</a> &bull;
  <a href="#storage-format">Storage</a> &bull;
  <a href="#context-injection">Context Injection</a> &bull;
  <a href="#neural-dashboard">Dashboard</a>
</p>

---

## Neuroscience Foundations

HORA's memory system is modeled after the human brain. Every component maps to a neuroscience concept:

| Brain System | HORA Implementation | Module |
|:---|:---|:---|
| **Complementary Learning Systems** (McClelland 1995) | Fast hippocampal encoding + slow neocortical consolidation | T1/T2 fast capture → T3 slow crystallization |
| **ACT-R** (Anderson 1993) | Activation-based retrieval with power-law decay | `activation-model.ts` |
| **Tulving's Memory Taxonomy** (1972) | Episodic / Semantic / Procedural classification | `graph-builder.ts` fact classification |
| **Baddeley's Working Memory** (2000) | ~4 chunk limit, thematic grouping | `agentic-retrieval.ts` Baddeley chunking |
| **Ebbinghaus Forgetting Curve** (1885) | Power-law decay: `t^{-d}` where d=0.5 | `activation-model.ts` |
| **Hippocampal Replay** (Wilson & McNaughton 1994) | Sleep-dependent episode consolidation | `dream-cycle.ts` |
| **Reconsolidation** (Nader et al. 2000) | Recalled memories become labile, updated with new evidence | `knowledge-graph.ts` reconsolidation |
| **Spaced Repetition** (Ebbinghaus → Leitner → Pimsleur) | Frequent retrieval strengthens activation | `activation-model.ts` recordAccess |
| **Community Structure** (modularity in neural networks) | Entity clustering via label propagation | `graph-communities.ts` |

### The Memory Flow (Brain Analogy)

```
Sensory Input (user message)
       |
       v
Working Memory (T1) ──── 24h retention, immediate context
       |                  Like prefrontal cortex short-term buffer
       |
       v
Episodic Memory (T2) ──── Days to weeks, event-specific
       |                   Like hippocampal episode traces
       |
       v ─── Dream Cycle (consolidation) ─── v
       |                                      |
Semantic Memory (T3) ──── Permanent, generalized knowledge
                          Like neocortical long-term storage
```

---

## Knowledge Graph

### Overview

HORA builds a **bi-temporal knowledge graph** inspired by [Graphiti](https://github.com/getzep/graphiti) (Zep's temporal knowledge graph). The graph grows automatically at the end of every session through LLM extraction.

**Module:** `claude/hooks/lib/knowledge-graph.ts` (~1,017 lines)

### Three-Layer Structure

```
┌──────────────────────────────────────────────────────────┐
│                      EPISODES                             │
│  Raw session references, consolidated by dream cycle      │
│  {id, source_type, source_ref, timestamp, entities[],     │
│   facts[], consolidated?}                                 │
├──────────────────────────────────────────────────────────┤
│                       FACTS (edges)                       │
│  Typed relationships with Tulving classification          │
│  {id, source, target, relation, description, embedding,   │
│   valid_at, invalid_at, created_at, expired_at,           │
│   confidence, metadata}                                   │
├──────────────────────────────────────────────────────────┤
│                     ENTITIES (nodes)                      │
│  Concepts extracted from sessions                         │
│  {id, type, name, properties, embedding,                  │
│   created_at, last_seen}                                  │
└──────────────────────────────────────────────────────────┘
```

### Entity Types (10)

| Type | Color (Dashboard) | Example |
|:---|:---|:---|
| `project` | Teal | `hora`, `hora-engine` |
| `tool` | Blue | `react-force-graph`, `recharts` |
| `error_pattern` | Red | `updateEntityEmbedding missing` |
| `preference` | Green | `library-first`, `TypeScript strict` |
| `concept` | Purple | `bi-temporality`, `ACT-R` |
| `person` | Amber | `Vivien` |
| `file` | Gray/Zinc | `knowledge-graph.ts` |
| `library` | Orange | `@huggingface/transformers` |
| `pattern` | — | `atomic-write-tmp-rename` |
| `decision` | — | `chose-drizzle-over-prisma` |

### Relation Ontology (34 Relations in 6 Categories)

**Module:** `claude/hooks/lib/relation-ontology.ts` (~255 lines)

#### Structural (7)

| Relation | Label | Example |
|:---|:---|:---|
| `has_component` | "contient le composant" | hora → knowledge-graph |
| `depends_on` | "depend de" | dashboard → react-force-graph-2d |
| `extends` | "etend" | HoraGraph → base graph class |
| `implements` | "implemente" | dream-cycle → hippocampal replay |
| `configures` | "configure" | patterns.yaml → security rules |
| `replaces` | "remplace" | d3-force-3d → d3-force |
| `hosts` | "heberge" | ~/.claude → MEMORY directory |

#### Technological (4)

| Relation | Label | Example |
|:---|:---|:---|
| `uses` | "utilise" | HORA → TypeScript |
| `integrates` | "integre" | prompt-submit → agentic-retrieval |
| `built_with` | "construit avec" | dashboard → Vite 6 |
| `migrated_from` | "migre depuis" | graph v2 → graph v1 |

#### Learning (7)

| Relation | Label | Example |
|:---|:---|:---|
| `decided_for` | "a choisi" | user → Drizzle ORM |
| `decided_against` | "a rejete" | user → Prisma |
| `learned_that` | "a appris que" | — |
| `caused_by` | "cause par" | build error → missing types |
| `solved_by` | "resolu par" | — → add d3-force-3d.d.ts |
| `blocked_by` | "bloque par" | — |
| `workaround_for` | "contournement pour" | — |

#### Experience (4)

| Relation | Label | Example |
|:---|:---|:---|
| `works_well_for` | "fonctionne bien pour" | minisearch → BM25 search |
| `fails_for` | "echoue pour" | — |
| `performs_better_than` | "performe mieux que" | — |
| `anti_pattern_in` | "anti-pattern dans" | glassmorphism → HORA design |

#### Actor (6)

| Relation | Label | Example |
|:---|:---|:---|
| `works_on` | "travaille sur" | Vivien → hora |
| `prefers` | "prefere" | user → library-first |
| `frustrated_with` | "frustre par" | — |
| `satisfied_with` | "satisfait de" | — |
| `created` | "a cree" | user → signal-tracker |
| `maintains` | "maintient" | — |

#### Conceptual (5)

| Relation | Label | Example |
|:---|:---|:---|
| `related_to` | "lie a" | ACT-R → Ebbinghaus |
| `inspired_by` | "inspire par" | dream-cycle → hippocampal replay |
| `contradicts` | "contredit" | — |
| `specializes` | "specialise" | procedural memory → semantic memory |
| `exemplifies` | "exemplifie" | — |

**Legacy Mapping:** Old relations are automatically normalized (`"involves"` → `"related_to"`, `"ecosystem"` → `"has_component"`, etc.)

### Bi-Temporality (4 Timestamps Per Fact)

Every fact carries two time dimensions:

```
Real-world dimension (when was the fact TRUE?)
├── valid_at      When the fact became true in reality
└── invalid_at    When it stopped being true (null = still valid)

Graph dimension (when was the fact RECORDED?)
├── created_at    When first written to the graph
└── expired_at    When superseded by a newer fact (null = current)
```

**Why this matters:**

```
Day 1: "HORA uses fixed 30-day expiration"
        valid_at: Day 1, invalid_at: null, created_at: Day 1, expired_at: null

Day 15: "HORA now uses ACT-R activation model"
        → Old fact: invalid_at: Day 15, expired_at: Day 15
        → New fact: valid_at: Day 15, created_at: Day 15

Query "What did HORA use on Day 10?" → Returns the old fact (valid_at ≤ 10 < invalid_at)
Query "What does HORA use now?" → Returns the new fact (invalid_at = null)
```

This enables **time-travel queries** — see what was true at any point in history.

### Memory Types (Tulving Taxonomy)

Every fact is classified into one of three memory types:

| Type | Mutable | Classification Criteria | Example |
|:---|:---:|:---|:---|
| **Semantic** | Yes (reconsolidation) | Default; general knowledge not tied to a specific event | "HORA uses TypeScript strict" |
| **Episodic** | No (immutable) | Contains temporal markers (ISO date, "session", "hier"), or valid_at < 48h ago | "Fixed auth bug on Feb 20 in session abc123" |
| **Procedural** | Yes (reconsolidation) | Relations: `follows_pattern`, `implements`, `configured_with`, or describes a how-to | "When creating a new component → use shadcn/ui in src/components/" |

**Classification is deterministic** (regex-based in `graph-builder.ts`), not LLM-based:

```
Procedural relations: follows_pattern, implements, configured_with,
                      workaround_for, solved_by, built_with
Episodic markers:     ISO dates, "session", "hier", "aujourd'hui",
                      valid_at within 48h of now
Semantic:             everything else (default)
```

**Type-aware retrieval:** Procedural facts are formatted as "Quand X → Y" patterns. Semantic facts are grouped thematically. Episodic facts are sorted chronologically.

### Reconsolidation

When a **semantic or procedural** fact is recalled and new evidence appears, HORA enriches it progressively instead of replacing it — mimicking how human memories are updated each time they're recalled.

```
Original fact:
  "HORA memory uses JSONL files for storage"
  reconsolidation_count: 0
  history: []

After reconsolidation:
  "HORA memory uses JSONL files with binary embeddings.bin for storage"
  reconsolidation_count: 1
  history: [{
    description: "HORA memory uses JSONL files for storage",
    confidence: 0.7,
    reconsolidated_at: "2026-02-25T..."
  }]
```

**Rules:**
- Max 5 versions in history (oldest dropped)
- Episodic facts are **never** reconsolidated (immutable by definition)
- Confidence can increase (new evidence strengthens) or decrease
- Embedding is cleared after reconsolidation (recomputed on next access)

### Deduplication

Two deduplication strategies prevent the graph from accumulating redundant facts:

**1. Description similarity (Jaccard, threshold > 0.85):**
```
Jaccard(fact_a, fact_b) = |words_a ∩ words_b| / |words_a ∪ words_b|
Words filtered: length ≥ 2 characters
```
Applied at `addFact()` time — before writing to disk.

**2. Embedding similarity (cosine, threshold > 0.92):**
```
cosine(embedding_a, embedding_b) > 0.92 → same fact
```
Applied via `deduplicateByEmbedding()` — supersedes the older fact.

### Key Methods (HoraGraph Class)

| Method | Purpose |
|:---|:---|
| `upsertEntity(type, name, props)` | Create or update entity. Dedup by normalized name. Merges properties. |
| `addFact(source, target, relation, desc, confidence, validAt, metadata)` | Add fact with Jaccard dedup. Auto-classify memory type. |
| `supersedeFact(id, replacement?, invalidAt?)` | Mark fact as expired. Optionally create replacement. |
| `reconsolidateFact(id, updates)` | Update description/confidence, preserve history (max 5). |
| `deduplicateByEmbedding(id, threshold)` | Cosine similarity check, supersede older duplicate. |
| `semanticSearch(queryEmb, opts)` | Cosine sim × activation × confidence × recency decay. |
| `getNeighborhood(entityId, depth)` | BFS traversal, returns connected entities + facts. |
| `getTimeline(entityId)` | All facts connected to entity, sorted by valid_at. |
| `detectCommunities()` | Connected components → label propagation (5 iterations). |
| `snapshotState()` | Lightweight snapshot for diff comparison. |
| `diffSnapshots(a, b)` | Compute change score between two snapshots. |
| `getStats()` | Counts, embedded ratio, top entities by degree. |
| `save()` | Persist all JSONL + binary embeddings (atomic write: tmp + rename). |

### Atomic Write Pattern

Every write operation uses the tmp-rename pattern to prevent corruption:

```typescript
const tmpFile = filePath + `.tmp.${process.pid}`;
fs.writeFileSync(tmpFile, content);
fs.renameSync(tmpFile, filePath);  // atomic on POSIX
```

This prevents partial reads during concurrent hook executions — a file is either fully old or fully new, never half-written.

---

## Memory Tiers

### Overview

**Module:** `claude/hooks/lib/memory-tiers.ts` (~801 lines)

HORA organizes memory in three tiers with automatic lifecycle management:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        T1 — SHORT-TERM                              │
│  Retention: 24 hours                                                │
│  Storage: STATE/, .hora/sessions/                                   │
│  Analogy: Prefrontal cortex working memory buffer                   │
│  Contents: Current session state, thread, checkpoint                │
│  Promotion: Patterns auto-captured by session-end extraction        │
├─────────────────────────────────────────────────────────────────────┤
│                        T2 — MEDIUM-TERM                             │
│  Retention: Adaptive (ACT-R activation, ~7-90 days)                 │
│  Storage: SESSIONS/, LEARNING/                                      │
│  Analogy: Hippocampal episodic traces                               │
│  Contents: Session archives, sentiment logs, failure logs,          │
│            tool usage, preference signals                           │
│  Promotion: 3+ occurrences across unique sessions → T3              │
├─────────────────────────────────────────────────────────────────────┤
│                        T3 — LONG-TERM                               │
│  Retention: Permanent                                               │
│  Storage: PROFILE/, LEARNING/INSIGHTS/                              │
│  Analogy: Neocortical semantic knowledge                            │
│  Contents: Identity, crystallized preferences, recurring failures,  │
│            aggregated insights, knowledge graph                     │
│  Decay: Only via ACT-R activation (very slow for frequently used)   │
└─────────────────────────────────────────────────────────────────────┘
```

### Garbage Collection (GC)

GC runs every **6 hours** via `runMemoryLifecycle()`, protected by a PID-based lock with 60s timeout:

```
runMemoryLifecycle()
  │
  ├── 1. Acquire GC lock (PID file, 60s timeout)
  │
  ├── 2. expireT2()
  │     ├── Step 1: Archive sessions > 30 days → _archived/
  │     ├── Step 2: Consolidate sentiment > 90 days → monthly summaries
  │     ├── Step 3: Aggregate tool usage > 7 days → tool-monthly.jsonl
  │     ├── Step 4: Truncate failures > 30 days
  │     ├── Step 5: Rolling window preference signals (max 500)
  │     └── Step 6: Auto-compress legacy transcripts (gzip)
  │
  ├── 3. promoteToT3()
  │     ├── Recurring failures (3+ occurrences) → recurring-failures.md
  │     ├── Crystallize preference signals (3+ sessions) → crystallized-patterns.md
  │     └── Graph pattern mining (preferences) → append to crystallized
  │
  ├── 4. expireGraphFacts()
  │     └── ACT-R activation < -2.0 → supersede fact
  │
  ├── 5. runDreamCycle()
  │     └── Consolidate episodes → distill semantic facts
  │
  └── 6. Release GC lock
```

### T2 Expiry Details

#### Sessions (> 30 days)
```
SESSIONS/20260115-143022.md  →  SESSIONS/_archived/20260115-143022.md
```

#### Sentiment Consolidation (> 90 days)
```
Input:  sentiment-log.jsonl (hundreds of entries)
Output: INSIGHTS/sentiment-summary.jsonl

Example entry:
{
  "month": "2026-01",
  "avgScore": 3.2,
  "count": 45,
  "trend": "stable",        // up, down, stable
  "consolidatedAt": "2026-02-27T..."
}
```

#### Tool Usage Aggregation (> 7 days)
```
Input:  .tool-usage.jsonl (thousands of lines: {ts, session, tool})
Output: INSIGHTS/tool-monthly.jsonl

Example entry:
{
  "month": "2026-02",
  "tools": {"Read": 1523, "Edit": 892, "Bash": 456, ...},
  "total": 4210,
  "topTool": "Read"
}
```

#### Legacy Transcript Compression
```
LEARNING/FAILURES/_legacy/*/transcript.jsonl  →  transcript.jsonl.gz
Compression ratio: ~5:1 (318 MB → 60 MB in production)
```

### T3 Promotion Details

#### Recurring Failures (3+ occurrences)
```
Reads: failures-log.jsonl
Groups by: normalized summary (lowercase, first 80 chars)
Threshold: 3+ occurrences
Output: INSIGHTS/recurring-failures.md (top 10, markdown table)
```

#### Preference Crystallization (3+ unique sessions)
```
Reads: LEARNING/ALGORITHM/preference-signals.jsonl
Groups by: normalized signal text
Threshold: 3+ unique session IDs
Output: INSIGHTS/crystallized-patterns.md
        + appended to PROFILE/preferences.md (cap 30 entries)
```

---

## Agentic Retrieval

### Overview

**Module:** `claude/hooks/lib/agentic-retrieval.ts` (~703 lines)

On **every user message**, HORA runs a multi-step retrieval pipeline — not just a blind similarity search, but a task-aware, multi-query system inspired by agentic RAG:

### Full Pipeline

```
User message
     │
     ▼
┌─────────────────────────────────────┐
│  1. CLASSIFY TASK                   │
│  Deterministic regex, no LLM        │
│  → feature, bugfix, refactor,       │
│    question, design, debug, unknown │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  2. GENERATE QUERIES (3-5)          │
│  Based on task type + user message  │
│  Each query has: text, category,    │
│  weight (0-1)                       │
│  Categories: stack, context,        │
│    decisions, errors, patterns      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  3. EMBED QUERIES (batch)           │
│  MiniLM-L6-v2, 384 dimensions      │
│  ~50ms per query after model loaded │
└─────────────┬───────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────┐
│  4. HYBRID SEARCH (per query)                     │
│                                                   │
│  ┌───────────────┐  ┌─────────────────────────┐  │
│  │ Semantic       │  │ BM25 (minisearch)       │  │
│  │ cosine(q, f)   │  │ fuzzy=0.2, prefix=true  │  │
│  │ × activation   │  │ boost: desc=2, ent=1.5  │  │
│  │ × confidence   │  │                         │  │
│  │ × recency      │  │                         │  │
│  └───────┬───────┘  └───────────┬─────────────┘  │
│          │                      │                  │
│          └──────┬───────────────┘                  │
│                 ▼                                   │
│  ┌──────────────────────────────────┐              │
│  │ RRF (Reciprocal Rank Fusion)     │              │
│  │ score = Σ(w / (k + rank))        │              │
│  │ k=60, semantic_w=0.7, bm25_w=0.3│              │
│  └──────────────────────────────────┘              │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  5. BFS EXPANSION (depth 2)         │
│  Top entities → neighbors →          │
│  connected facts in semantic         │
│  neighborhood                        │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  6. ACT-R BOOST                     │
│  Record access for retrieved facts   │
│  → strengthens activation for next   │
│  retrieval (spaced repetition)       │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  7. BADDELEY CHUNKING               │
│  Group into max 5 thematic chunks    │
│  by category + word overlap > 0.2    │
│  Working memory: ~4 chunks optimal   │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  8. FORMAT BY CATEGORY               │
│  Budget allocation per category:     │
│  stack=1500, context=1500,           │
│  decisions=1000, errors=1000,        │
│  patterns=500 chars                  │
│                                      │
│  Procedural: "Quand X → Y" format    │
│  Semantic: thematic grouping         │
│  Episodic: chronological             │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  9. BUDGET TRIM                      │
│  min(6000 chars, 15% remaining ctx)  │
│  Adaptive based on context-budget    │
└─────────────────────────────────────┘
              │
              ▼
    Injected as [HORA KNOWLEDGE GRAPH]
```

### Task Classification (Deterministic)

| Type | Trigger Keywords |
|:---|:---|
| `feature` | ajoute, crée, implémente, nouveau, nouvelle |
| `bugfix` | bug, erreur, crash, fix, corrige, ne marche pas |
| `refactor` | refactor, nettoie, simplifie, réorganise, dette |
| `question` | pourquoi, comment, qu'est-ce que, explique |
| `design` | design, ui, ux, layout, composant, page |
| `debug` | debug, trace, log, console, inspect |
| `unknown` | (default) |

### Semantic Search Scoring

For each fact, the relevance score combines four factors:

```
score = cosine(query_embedding, fact_embedding)
      × activationFactor(ACT-R_activation)
      × fact.confidence
      × recencyDecay(days_since_valid_at)

Where:
  activationFactor = 1 / (1 + exp(-(activation + 2)))   // sigmoid
  recencyDecay = exp(-days / 90)                         // 90-day half-life
```

### BM25 Index Configuration

```typescript
// Fields indexed with different boosts:
description:  boost = 2.0    // Most important — what the fact says
entities:     boost = 1.5    // Entity names connected to fact
relation:     boost = 1.0    // Relation type

// Search options:
fuzzy = 0.2      // Typo tolerance
prefix = true    // Prefix matching ("React" matches "ReactDOM")
limit = 20       // Top 20 results per search
```

### Reciprocal Rank Fusion (RRF)

```
For each result appearing in either system:
  RRF_score = (0.7 / (60 + semantic_rank)) + (0.3 / (60 + bm25_rank))

Where:
  semantic_weight = 0.7
  bm25_weight = 0.3
  k = 60 (standard RRF constant)
```

**Why hybrid?** Semantic search finds `"TypeScript coding"` from `"TS development"` — but misses exact terms. BM25 catches `"Drizzle"` matching a fact about `"uses Drizzle ORM"`. Together via RRF, they cover both fuzzy and exact matching.

### Lazy Embedding Repair

During retrieval, if facts are found without embeddings (e.g., migrated from older format), HORA repairs them lazily:

```
Max 20 embeddings per retrieval call
PID-based lock prevents concurrent writes
Write to embeddings.bin + embedding-index.jsonl
```

### Performance

| Operation | Latency |
|:---|:---|
| First message (model load + embed + search) | ~350ms |
| Subsequent messages | ~50ms |
| Embedding computation | ~10-50ms per text |
| BM25 search | ~2ms |
| Graph load (from JSONL + binary) | ~200ms |

### Fallback Chain

```
Full pipeline (semantic + BM25 + ACT-R)
       │ fails?
       ▼
BM25 only (embeddings unavailable)
       │ fails?
       ▼
Classic profile injection (raw text from MEMORY/)
       │ fails?
       ▼
No injection (zero degradation — Claude Code works normally)
```

---

## Activation Model

### Overview

**Module:** `claude/hooks/lib/activation-model.ts` (~150 lines)

Instead of fixed expiration (e.g., "delete after 30 days"), HORA uses the **ACT-R cognitive architecture** (Anderson 1993) where each fact's survival depends on how often and recently it was recalled.

### The Formula

```
Activation = ln(Σ(t_i^{-d})) × emotionalWeight

Where:
  t_i = time in days since the i-th access
  d   = 0.5 (decay parameter, following Ebbinghaus power law)
  emotionalWeight = 1.0 (normal) or 1.5 (corrections/failures)
```

### How It Works

```
Fact: "HORA uses TypeScript strict"
Access history: [today, 3 days ago, 10 days ago]

Activation = ln(1^{-0.5} + 3^{-0.5} + 10^{-0.5}) × 1.0
           = ln(1.0 + 0.577 + 0.316)
           = ln(1.893)
           = 0.638   ← HIGH activation, will survive long

Fact: "Had a DNS issue on Jan 15"
Access history: [45 days ago]

Activation = ln(45^{-0.5}) × 1.0
           = ln(0.149)
           = -1.904  ← Approaching threshold, will expire soon
```

### Threshold and Survival

| Activation | Status | Approximate Survival |
|:---|:---|:---|
| > 0 | Very active | Accessed recently and frequently |
| -1 to 0 | Active | Healthy, will survive months |
| -2 to -1 | Declining | Will expire in weeks |
| < **-2.0** | **EXPIRED** | Superseded in next GC |

**Key insight:** A single access survives ~45 days. But 3 accesses in a week can keep a fact alive for months. Frequently recalled facts effectively become permanent.

### Emotional Weight

Corrections and failures get a 1.5× emotional weight — mimicking how emotionally charged memories decay slower in the brain:

```
Normal fact:     emotionalWeight = 1.0
Correction fact: emotionalWeight = 1.5  (user said "non", "arrête", "je t'ai dit")
Failure fact:    emotionalWeight = 1.5  (error pattern, crash, frustration)
```

### Retrieval Boost (Spaced Repetition)

Every time a fact is successfully retrieved during agentic search, its access time is recorded:

```
Before retrieval: accessTimes = ["2026-02-20T..."]
After retrieval:  accessTimes = ["2026-02-20T...", "2026-02-27T..."]
                  → Activation increases
                  → Fact survives longer
```

This creates a natural **spaced repetition** effect: facts that keep being useful are strengthened, while unused facts decay naturally.

### Sigmoid Normalization (for Search Scoring)

```
activationFactor = 1 / (1 + exp(-(activation + 2)))

Maps:
  activation = -2 (threshold) → factor = 0.5
  activation = 0              → factor = 0.88
  activation = 2              → factor = 0.98
```

---

## Dream Cycle

### Overview

**Module:** `claude/hooks/lib/dream-cycle.ts` (~239 lines)

Inspired by **hippocampal replay during sleep** (Wilson & McNaughton 1994), the dream cycle consolidates episodic memories into semantic knowledge. It runs during GC (every 6 hours).

### Pipeline

```
Step 1: Get unconsolidated episodes (last 7 days)
           │
           ▼
Step 2: Cluster by shared entities
        (episodes sharing 2+ entities → same cluster)
           │
           ▼
Step 3: For each cluster with 3+ episodes:
        ├── Count fact co-occurrences across episodes
        ├── Facts appearing 3+ times:
        │   → Reconsolidate (boost confidence by 0.05 × (count - 2))
        └── Recurring patterns across episodes:
            → Distill into NEW semantic facts
           │
           ▼
Step 4: Mark episodes as consolidated
```

### Distillation Rules

When a pattern appears across 3+ episodes, the dream cycle creates a new **semantic fact**:

```
New distilled fact:
  memory_type: "semantic"
  confidence: min(0.9, 0.6 + 0.1 × (count - 2))
  metadata.context: "Distilled from N episodes via dream cycle"
  source: hub entity of cluster
  target: most connected entity in cluster
```

### Constants

| Parameter | Value | Purpose |
|:---|:---|:---|
| `MIN_EPISODES_FOR_DREAM` | 5 | Don't run dream cycle with too few episodes |
| `DREAM_WINDOW_DAYS` | 7 | Only process recent unconsolidated episodes |
| `PATTERN_THRESHOLD` | 3 | Min occurrences to distill a pattern |
| Max new facts per cluster | 3 | Prevent explosion |
| Confidence boost per occurrence | 0.05 | Gradual strengthening |

### Example

```
Episode 1 (session abc): "User used react-force-graph for visualization"
Episode 2 (session def): "User chose react-force-graph over D3 directly"
Episode 3 (session ghi): "User extended react-force-graph with custom forces"

Dream cycle detects:
  → "react-force-graph" entity appears in 3 episodes
  → Distills: "User consistently uses react-force-graph for graph visualization"
  → Type: semantic, confidence: 0.7
  → Mark episodes 1-3 as consolidated
```

---

## Community Detection

### Overview

**Module:** `claude/hooks/lib/graph-communities.ts` (~226 lines)

Facts and entities are grouped into **communities** (clusters of related knowledge) via graph algorithms. When a query matches an entity, its entire community can be surfaced for richer context.

### Algorithm

```
Step 1: Build adjacency (entity → connected entities via active facts)
           │
           ▼
Step 2: BFS → find connected components (min 2 entities)
           │
           ▼
Step 3: Label Propagation (5 iterations)
        Each node adopts the most frequent label among neighbors
        Converges when no labels change
           │
           ▼
Step 4: Hub Selection
        Most connected entity per community → becomes the community name
           │
           ▼
Step 5: Internal Facts
        Collect all facts where both source AND target are in the community
           │
           ▼
Step 6: Persist to GRAPH/communities.jsonl (atomic write)
```

### Output Format

```json
{
  "id": "community-0",
  "name": "react-force-graph",
  "entities": ["react-force-graph", "d3-force-3d", "NeuralMemoryMap"],
  "facts": ["fact-123", "fact-456"],
  "summary": "Community centered on react-force-graph with 3 entities: ...",
  "updated_at": "2026-02-27T..."
}
```

---

## Signal Tracker

### Overview

**Module:** `claude/hooks/lib/signal-tracker.ts` (~468 lines)

The signal tracker extracts **user preferences** from conversations and **crystallizes** them (promotes to T3) when they recur across multiple sessions.

### Signal Types

| Type | Detection | Example |
|:---|:---|:---|
| **explicit** | "toujours X", "jamais Y", "je préfère X" | "Je préfère Drizzle à Prisma" |
| **principle** | SSOT, DRY, KISS, library-first, TDD | "On applique le principe SSOT" |
| **correction** | "non X", "je t'ai dit X", "arrête X" | "Non, pas de default exports" |

### Extraction Pipeline

```
User message (raw text)
     │
     ├── Skip code blocks (``` ... ```)
     │
     ├── Match 34 regex patterns (FR + EN):
     │   ├── "toujours utiliser?" → explicit
     │   ├── "ne jamais" → explicit
     │   ├── "je préfère" → explicit
     │   ├── "ssot|dry|kiss|library.first|tdd" → principle
     │   ├── "non,? (pas|plus|arrête)" → correction
     │   └── ... (31 more patterns)
     │
     ├── Normalize signal:
     │   ├── Lowercase
     │   ├── Collapse whitespace
     │   ├── Strip neutral prefixes ("je pense que", "il faut")
     │   └── Keep negatives ("ne pas", "jamais")
     │
     ├── Dedup by normalized form (per session)
     │
     └── Max 10 signals per session
           │
           ▼
     Append to LEARNING/ALGORITHM/preference-signals.jsonl
```

### Crystallization (T2 → T3)

```
preference-signals.jsonl
     │
     ├── Group by normalized signal text
     │
     ├── Count unique session IDs per group
     │
     ├── If sessionCount ≥ 3:
     │   ├── Write to INSIGHTS/crystallized-patterns.md (table format)
     │   └── Append to PROFILE/preferences.md (cap 30 entries)
     │
     └── Also mine graph for preference-related relations:
         ├── Relations: prefers, decided_for, decided_against, uses, avoids
         ├── Group by description, count unique sessions
         └── If 3+ sessions → crystallize as "graph" type
```

### Example Crystallization

```
Session 1: "Toujours utiliser des exports nommés"
Session 4: "On utilise des named exports, pas de default"
Session 7: "Je préfère les named exports"

→ 3 unique sessions with similar signal
→ Crystallized: "Préfère les exports nommés (named exports)"
→ Written to INSIGHTS/crystallized-patterns.md
→ Appended to PROFILE/preferences.md
```

---

## Embeddings

### Overview

**Module:** `claude/hooks/lib/embeddings.ts` (~99 lines)

### Model Specifications

| Property | Value |
|:---|:---|
| Model | `Xenova/all-MiniLM-L6-v2` |
| Framework | `@huggingface/transformers` |
| Runtime | ONNX (local, no API) |
| Dimensions | 384 |
| Normalization | L2 normalized (dot product = cosine similarity) |
| Quantization | fp32 |
| Pooling | Mean pooling |
| Model size | ~22 MB (downloaded once, cached) |
| First load | ~200ms |
| Per embedding | ~10-50ms |
| Cost | $0 (runs locally) |

### API

```typescript
// Singleton model loader
getEmbedder(): Promise<Pipeline>

// Single text embedding
embed(text: string): Promise<number[] | null>

// Batch embedding (falls back to sequential on OOM)
embedBatch(texts: string[]): Promise<(number[] | null)[]>

// Cosine similarity between two vectors
cosineSimilarity(a: number[], b: number[]): number

// Cleanup before exit
disposeEmbedder(): Promise<void>
```

### Binary Storage

Embeddings are **not** stored in the JSONL files (which contain `embedding: null`). Instead, they use a compact binary format:

```
GRAPH/
  embeddings.bin           ← Float32Array concatenated (384 floats × N items)
  embedding-index.jsonl    ← Metadata: {id, type, offset, dim}
```

**Read operation:**
```typescript
const buffer = fs.readFileSync("embeddings.bin");
const float32 = new Float32Array(buffer.buffer, offset, 384);
```

**Estimated volume:** ~2 MB after 6 months of active use (loadable in < 200ms).

---

## Hybrid Search

### Overview

**Module:** `claude/hooks/lib/hybrid-search.ts` (~152 lines)

Combines semantic vector search with BM25 keyword search via Reciprocal Rank Fusion.

### BM25 Configuration

```typescript
const index = new MiniSearch({
  fields: ["description", "entities", "relation"],
  storeFields: ["id"],
  searchOptions: {
    boost: { description: 2, entities: 1.5, relation: 1 },
    fuzzy: 0.2,           // Typo tolerance (edit distance)
    prefix: true,          // "React" matches "ReactDOM"
    combineWith: "OR",     // Any field can match
  },
});
```

### Fusion Algorithm

```
For each unique result across both systems:

  RRF_score(item) = (w_semantic / (k + rank_semantic))
                   + (w_bm25 / (k + rank_bm25))

  Where:
    w_semantic = 0.7
    w_bm25 = 0.3
    k = 60
    rank = position in results (1-based), or ∞ if not found

Sort by RRF_score descending → return top N
```

### Technology

| Component | Library | Size | License |
|:---|:---|:---|:---|
| BM25 | `minisearch` | ~15 KB | MIT |
| Semantic | `@huggingface/transformers` | ~22 MB model | Apache 2.0 |

---

## Context Injection

### Overview

**Module:** `claude/hooks/prompt-submit.ts` (~1,500 lines)

Every user message triggers a multi-phase injection pipeline that assembles relevant context from all memory systems.

### Injection Phases

```
User message arrives
     │
     ▼
Phase 1: INITIALIZATION
  ├── Read/generate project ID (.hora/project-id)
  ├── Resolve context budget (context-budget.ts)
  └── Update session state (messageCount, timestamp)
     │
     ▼
Phase 2: THREAD CONTINUITY
  ├── Read session-thread.json (last session summary)
  ├── Format last 20 thread entries
  ├── Archive older entries (100-entry rolling archive)
  └── Inject: "Last session was about X. Continue from there."
     │
     ▼
Phase 3: KNOWLEDGE GRAPH (if context < 80%)
  ├── Load HoraGraph from MEMORY/GRAPH/
  ├── agenticRetrieve() → full pipeline (see Agentic Retrieval)
  └── Inject as [HORA KNOWLEDGE GRAPH] section
     │
     ▼
Phase 4: SENTIMENT ANALYSIS
  ├── Sanitize text (strip code blocks, paths, XML tags)
  ├── Lexical scoring (FR + EN negative words, CAPS, punctuation)
  ├── Trend detection (3 messages monotonic increase ≥ 3.5)
  └── Inject alert if score ≥ 4 AND trend reinforced
     │
     ▼
Phase 5: ROUTING HINTS
  ├── Detect mode (refactor, test, debug, design...)
  ├── Skill auto-suggest (skill-suggest.ts)
  ├── Classify effort (trivial, moyen, complexe, critique)
  └── Inject: suggested skill + algorithm phase tracker
     │
     ▼
Phase 6: STEERING RULES
  ├── Load HORA steering rules (Bad/Correct pairs)
  ├── Rotate batch (3 rules per message, cycle-based)
  └── Inject: 3 rotating steering rules
     │
     ▼
Phase 7: BANNER STATS
  ├── Count entities, facts, sessions
  ├── Cache in .banner-cache.json
  └── Inject: live memory stats header
```

### Context Budget System

**Module:** `claude/hooks/lib/context-budget.ts` (~103 lines)

Adapts injection sizes based on how much context is already consumed:

| Context Used | Level | Graph | Thread | Sections | Behavior |
|:---|:---|:---:|:---:|:---:|:---|
| < 60% | **full** | Yes | 5000 chars | 400 chars | All features at max |
| 60-80% | **reduced** | Yes | 2500 chars | 280 chars | Reduced by 30% |
| 80-90% | **minimal** | **No** | 500 chars | 150 chars | Graph skipped, thread minimal |
| > 90% | **emergency** | **No** | **None** | 80 chars | ISC + steering only |

### Skill Auto-Suggest

**Module:** `claude/hooks/lib/skill-suggest.ts` (~168 lines)

Deterministic suggestion of the optimal HORA skill based on message keywords + tool usage history:

| Skill | Trigger Keywords | Tool Pattern |
|:---|:---|:---|
| `/hora-refactor` | refactor, clean, smell, dette | 8+ Edit/Grep/Read in session |
| `/hora-security` | auth, token, password, xss, injection | Bash tools in session |
| `/hora-forge` | test, tdd, spec, coverage | 5+ Edit/Write in session |
| `/hora-perf` | slow, lighthouse, bundle, core web vitals | — |
| `/hora-parallel-code` | plusieurs fichiers, multi-fichier, codebase | Task tools in session |
| `/hora-parallel-research` | compare, benchmark, alternatives, vs | — |
| `/hora-design` | design, ui, ux, layout, shadcn | — |
| `/hora-vision` | screenshot, audit visuel, anti-pattern | — |

**Scoring:** `keywordHits × 0.3 + sessionToolMatch × 0.3 + weeklyPattern × 0.1`
**Threshold:** score ≥ 0.3 to emit suggestion.

### Cross-Project Awareness

**Module:** `claude/hooks/lib/cross-project.ts` (~250 lines)

Discovers other known projects and computes relevance based on shared dependencies and entities:

```
Relevance = (sharedDeps / totalDeps) × 0.6
          + (sharedEntities > 0 ? 0.4 : 0)
```

Cache: 1-hour TTL in `~/.hora/cross-project-cache.json`.

---

## Self-Learning Extraction

### Overview

**Module:** `claude/hooks/session-end.ts` (~1,200 lines)

At the end of every significant session (3+ messages), HORA silently extracts structured knowledge:

### Extraction Pipeline

```
Session ends (Stop hook)
     │
     ▼
Phase 1: THREAD CONSOLIDATION
  ├── Parse JSONL transcript (all user/assistant exchanges)
  ├── Dedupe by (session_id, timestamp, content_hash)
  └── Keep last 20 entries, archive rest (100-entry rolling)
     │
     ▼
Phase 2: PROFILE EXTRACTION
  │
  ├── 2A: Environment (deterministic)
  │   ├── git config user.name/email → identity
  │   ├── git remote URL → GitHub username
  │   ├── package.json → dependencies → tech stack
  │   ├── git ls-files → dominant languages by extension
  │   └── Output: PROFILE/identity.md
  │
  ├── 2B: Linguistic (transcript analysis)
  │   ├── French word detection (50+ word list, >50% = FR)
  │   ├── Technical vocabulary frequency (top 20, stopwords filtered)
  │   ├── Repeating pattern detection
  │   └── Output: PROFILE/preferences.md
  │
  └── 2C: Vocabulary
      ├── Multi-word noun phrases (domain terms)
      └── Output: PROFILE/vocabulary.md
     │
     ▼
Phase 3: SENTIMENT AGGREGATION
  ├── Read session sentiment scores
  ├── Compute rolling 3-message average
  └── Append to LEARNING/ALGORITHM/sentiment-log.jsonl
     │
     ▼
Phase 4: LEARNING EXTRACTION (failures)
  ├── Parse assistant responses for error patterns
  ├── Detect incorrect assumptions by AI
  └── Append to LEARNING/FAILURES/failures-log.jsonl
     │
     ▼
Phase 5: KNOWLEDGE GRAPH BUILDING
  ├── buildGraphFromSession() via claude -p (HORA_SKIP_HOOKS=1)
  ├── Extract entities + facts + contradictions
  ├── Compute embeddings for new items
  ├── Run memory lifecycle (GC if 6h elapsed)
  └── Run graph migration (lazy, batch 3)
     │
     ▼
Phase 6: SESSION ARCHIVE
  └── Write SESSIONS/YYYYMMDD-HHMMSS.md (summary, exchanges, metadata)
```

### Graph Building via LLM

**Module:** `claude/hooks/lib/graph-builder.ts` (~525 lines)

```
buildGraphFromSession(graph, sessionData)
     │
     ▼
1. Build extraction prompt
   ├── Include existing entities (max 100) for context
   ├── Include existing facts (max 50) for dedup
   ├── Include relation ontology (34 types)
   └── Constraints: min 20 words/fact, confidence scale, JSON only
     │
     ▼
2. Call claude -p (CLI pipe, subscription — $0 cost)
   └── HORA_SKIP_HOOKS=1 prevents infinite recursion
     │
     ▼
3. Parse JSON output
   ├── Try direct JSON.parse
   └── Fallback: regex extraction from markdown code blocks
     │
     ▼
4. Apply to graph
   ├── Upsert entities (name dedup)
   ├── Resolve source/target by name
   ├── Add facts (Jaccard dedup > 0.85)
   ├── Supersede contradicted facts
   ├── Create episode linking everything
   └── Classify memory types (Tulving)
     │
     ▼
5. Compute embeddings (batch, 384-dim)
     │
     ▼
6. Save graph (atomic write)
```

### Anti-Recursion

When `session-end.ts` calls `claude -p` for graph extraction, it sets the environment variable `HORA_SKIP_HOOKS=1`. Every HORA hook checks for this variable at startup and exits immediately if present — preventing infinite recursion (extraction → hooks → extraction → ...).

---

## Storage Format

### Directory Structure

```
~/.claude/MEMORY/
├── PROFILE/                          # T3 — Permanent user profile
│   ├── identity.md                   #   Name, email, GitHub, timezone
│   ├── projects.md                   #   Known projects + tech stacks
│   ├── preferences.md                #   Crystallized preferences (cap 30)
│   └── vocabulary.md                 #   Domain-specific terms
│
├── LEARNING/
│   ├── FAILURES/
│   │   ├── failures-log.jsonl        #   T2 — Error patterns + lessons
│   │   └── _legacy/                  #     Old format (compressed .gz)
│   ├── ALGORITHM/
│   │   ├── sentiment-log.jsonl       #   T2 — Sentiment per session (1-5)
│   │   └── preference-signals.jsonl  #   T2 — Extracted preference signals
│   └── INSIGHTS/                     #   T3 — Promoted insights
│       ├── recurring-failures.md     #     Top 10 recurring failures
│       ├── crystallized-patterns.md  #     Confirmed user preferences
│       ├── sentiment-summary.jsonl   #     Monthly sentiment aggregates
│       └── tool-monthly.jsonl        #     Monthly tool usage aggregates
│
├── SESSIONS/                         #   T2 — Session archives
│   ├── 20260227-143022.md            #     One file per session
│   └── _archived/                    #     Sessions older than 30 days
│
├── SECURITY/                         #   Security audit trail
│   └── YYYY/MM/security-*.jsonl      #     Event logs (blocks, alerts, confirms)
│
├── STATE/                            #   T1 — Current state
│   ├── session-thread.json           #     Last session thread entries
│   ├── session-names.json            #     Session ID → name mapping
│   └── thread-archive.json           #     Older thread entries (100 max)
│
├── GRAPH/                            #   Knowledge graph (bi-temporal)
│   ├── entities.jsonl                #     Entity nodes
│   ├── facts.jsonl                   #     Fact edges (typed relationships)
│   ├── episodes.jsonl                #     Episode references
│   ├── activation-log.jsonl          #     ACT-R access history
│   ├── communities.jsonl             #     Detected entity communities
│   ├── embeddings.bin                #     Binary Float32Array (384-dim vectors)
│   ├── embedding-index.jsonl         #     Embedding offset metadata
│   └── snapshots/
│       └── snapshots.jsonl           #     State snapshots for diff
│
├── WORK/                             #   Working memory
│
└── .tool-usage.jsonl                 #   Tool call log (append-only)
```

### JSONL Formats

#### entities.jsonl
```json
{
  "id": "ent-a1b2c3",
  "type": "tool",
  "name": "react-force-graph-2d",
  "properties": {"version": "1.29.1", "category": "visualization"},
  "embedding": null,
  "created_at": "2026-02-20T14:30:00Z",
  "last_seen": "2026-02-27T10:15:00Z"
}
```

#### facts.jsonl
```json
{
  "id": "fact-d4e5f6",
  "source": "ent-a1b2c3",
  "target": "ent-g7h8i9",
  "relation": "uses",
  "description": "HORA dashboard uses react-force-graph-2d for neural memory visualization with d3-force-3d physics simulation",
  "embedding": null,
  "valid_at": "2026-02-15T00:00:00Z",
  "invalid_at": null,
  "created_at": "2026-02-20T14:30:00Z",
  "expired_at": null,
  "confidence": 0.9,
  "metadata": {
    "memory_type": "semantic",
    "reconsolidation_count": 1,
    "history": [{
      "description": "HORA dashboard uses react-force-graph-2d for graph visualization",
      "confidence": 0.7,
      "reconsolidated_at": "2026-02-25T..."
    }],
    "source_session": "abc12345",
    "context": "Neural page implementation",
    "category": "technological"
  }
}
```

#### episodes.jsonl
```json
{
  "id": "ep-j0k1l2",
  "source_type": "session",
  "source_ref": "abc12345",
  "timestamp": "2026-02-27T14:30:00Z",
  "entities": ["ent-a1b2c3", "ent-g7h8i9"],
  "facts": ["fact-d4e5f6", "fact-m3n4o5"],
  "consolidated": false
}
```

#### activation-log.jsonl
```json
{
  "factId": "fact-d4e5f6",
  "accessTimes": ["2026-02-20T14:30:00Z", "2026-02-25T10:00:00Z", "2026-02-27T14:30:00Z"],
  "emotionalWeight": 1.0,
  "lastActivation": 0.638
}
```

#### preference-signals.jsonl
```json
{
  "signal": "toujours utiliser des exports nommes",
  "type": "explicit",
  "sessionId": "abc12345",
  "timestamp": "2026-02-27T14:30:00Z",
  "raw": "Toujours utiliser des exports nommés, pas de default"
}
```

#### sentiment-log.jsonl
```json
{
  "sid": "abc12345",
  "score": 2.3,
  "ts": "2026-02-27T14:30:00Z",
  "trigger": null
}
```

### Binary Embedding Format

```
embeddings.bin:
┌────────────────────────────────────────────┐
│ Float32[384] — entity "react-force-graph"  │  offset: 0
├────────────────────────────────────────────┤
│ Float32[384] — fact "uses for viz"         │  offset: 1536
├────────────────────────────────────────────┤
│ Float32[384] — entity "hora"               │  offset: 3072
├────────────────────────────────────────────┤
│ ...                                        │
└────────────────────────────────────────────┘

Each entry: 384 floats × 4 bytes = 1,536 bytes

embedding-index.jsonl:
{"id": "ent-a1b2c3", "type": "entity", "offset": 0, "dim": 384}
{"id": "fact-d4e5f6", "type": "fact", "offset": 1536, "dim": 384}
```

---

## Neural Dashboard

### Overview

The HORA dashboard is a standalone **React 19 + Vite 6** application that visualizes all memory data in real-time.

**Location:** `claude/dashboard/`

```bash
cd claude/dashboard && npm install && npm run dev
# Opens at http://localhost:3847
```

### Architecture

```
Browser (React 19 + Vite HMR)
       │
       ▼
Vite Dev Server
  ├── HMR WebSocket ← chokidar watches ~/.claude/MEMORY/ + .hora/
  │   └── Debounce 500ms → push "hora:update" event
  │
  └── API Endpoints:
      ├── GET  /api/hora-data          → Full dashboard data
      ├── GET  /api/hora/telemetry     → Hook call statistics
      ├── GET  /api/hora/memory-diff   → Graph diff between snapshots
      ├── GET  /api/hora/sessions-list → Session archive metadata
      ├── GET  /api/hora/session/:id   → Session detail + failures
      ├── POST /api/hora-chat          → Memory chat (agentic retrieval + LLM)
      ├── GET  /api/hora-chat-history  → Chat history + cost
      └── GET  /api/hora-chat-config   → LLM provider configuration
```

### 9 Navigation Sections

| Section | Components | Data Sources |
|:---|:---|:---|
| **Overview** | StatCards, SessionsTable, SentimentChart, ThreadHistory | All MEMORY/ |
| **Project** | CheckpointPanel, ProjectKnowledge | .hora/ |
| **Memory** | MemoryHealth (T1/T2/T3 bars), MemoryDiff, Profile, Failures | MEMORY/GRAPH/, LEARNING/ |
| **Neural** | NeuralMemoryMap (tier visualization) + NeuralPage (full knowledge graph) | GRAPH/ |
| **Chat** | ChatView (transcript viewer) + MemoryChat (LLM-powered) | JSONL transcripts |
| **Security** | SecurityEvents | SECURITY/ |
| **Tools** | ToolTimeline | .tool-usage.jsonl |
| **Telemetry** | HookTelemetry (stats, charts) | /api/hora/telemetry |
| **Replay** | SessionReplay | SESSIONS/ |

### Neural Memory Map (Tier Visualization)

**Module:** `claude/dashboard/src/NeuralMemoryMap.tsx`

Neuroscience-inspired visualization of the 3-tier memory system:

```
Nodes (8 memory zones):
  T1 (Cyan):   Thread, State (current working memory)
  T2 (Blue):   Sessions, Sentiment, Failures, Tools
  T3 (Purple): Profile, Insights

Visual encoding:
  Node size     = sqrt(items) × 2 + 4     (proportional to data volume)
  Breathing     = sin(t / 2000) × 0.04    (fresher nodes breathe more)
  Outer glow    = radius × (1.5 + freshness × 0.8)
  Nucleus       = 60% alpha at center

Edges (14 synaptic connections):
  T1↔T1: working memory loop
  T1→T2: encoding (writing to medium-term)
  T2→T2: emotional tagging (sentiment ↔ failures)
  T2→T3: consolidation (learning → permanent)
  T3→T1: retrieval (knowledge → working memory)

Physics (d3-force):
  Charge:  -120 (repulsion)
  Link:    80px distance
  Radial:  50px, strength 0.3 (isolated nodes pulled to center)
  Center:  strength 0.05 (prevent drift)

Particles: animate along edges (speed 0.004) to show data flow
```

### Neural Page (Knowledge Graph)

**Module:** `claude/dashboard/src/NeuralPage.tsx`

Full interactive visualization of the **real knowledge graph**:

```
Node rendering:
  Radius:     max(6, min(24, degree × 3 + 6))
  Breathing:  recent nodes (< 48h) pulse with sin(t/1500) × 0.06
  Color:      9 types (project=teal, tool=blue, error=red, ...)
  Labels:     visible for degree ≥ 3 or on hover

Edge rendering:
  Color:      category-based with confidence opacity
  Width:      1px normal, 2px highlighted
  Particles:  3 particles on facts < 24h old

Interactions:
  Click node → Detail panel (properties, timeline, connected facts)
  Click edge → Link detail (relation, confidence, metadata)
  Drag       → Persist positions in memory
  Search     → Filter by entity name
  Temporal   → Slider to filter by date range
  Recenter   → zoomToFit(400, 60)
```

### Design Palette

| Element | Hex | Usage |
|:---|:---|:---|
| Background | `#0A0A0B` | App background |
| Card | `#18181b` | Panel backgrounds |
| Border | `#27272a` | Subtle borders |
| Text | `#e4e4e7` | Primary text |
| Muted | `#a1a1aa` | Secondary text |
| Dim | `#52525b` | Tertiary/disabled |
| Accent (teal) | `#14b8a6` | Primary accent |
| Gold | `#D4A853` | HORA brand color |

---

## Memory Quality Metrics

**Module:** `claude/hooks/lib/memory-metrics.ts` (~140 lines)

HORA tracks the health and quality of its memory system:

| Metric | Formula | Healthy Range |
|:---|:---|:---|
| **Dedup ratio** | superseded / total facts | < 0.3 |
| **Embedding coverage** | (factsWithEmb + entitiesWithEmb) / total | > 0.8 |
| **Average activation** | mean(log(activation)) for active entries | > -1.0 |
| **Reconsolidation rate** | facts with reconsolidation_count > 0 | 0.1 - 0.3 |
| **Retrieval hit rate** | min(1, activationLog.size / activeFacts) | > 0.5 |
| **Dream cycle efficiency** | distilled facts / episodes | > 0.1 |
| **Memory type distribution** | episodic / semantic / procedural / unclassified | Balanced |
| **Average confidence** | mean(confidence) for active facts | > 0.6 |

---

## Zod Validation

**Module:** `claude/hooks/lib/schemas.ts` (~136 lines)

Every JSONL structure is validated at runtime using Zod schemas:

```typescript
EntityNodeSchema     // Validates entity structure
FactEdgeSchema       // Validates fact structure
EpisodeSchema        // Validates episode structure
FactMetadataSchema   // Validates fact metadata
ActivationEntrySchema // Validates ACT-R entries
CommunitySchema      // Validates community structure
SentimentLogEntry    // Validates sentiment logs
FailureLogEntry      // Validates failure logs
EmbeddingIndexEntry  // Validates embedding index
```

**Helper:** `parseJsonlWithSchema<T>(filePath, schema)` — parses JSONL line by line, silently filters invalid entries (never crashes).

---

## Robustness Guarantees

### Atomic Writes
Every file write uses `tmp + rename`:
```typescript
const tmp = path + `.tmp.${process.pid}`;
fs.writeFileSync(tmp, data);
fs.renameSync(tmp, path);  // Atomic on POSIX
```

### Lock Mechanism
GC uses PID-based locks with 60s timeout:
```
gc.lock contains: PID
If PID is stale (process doesn't exist) → steal lock
If PID is alive → skip GC (another instance running)
```

### Error Handling
Every hook wraps logic in `try/catch` and exits `0` on error:
- Hooks **never block Claude Code**
- Missing file → skip gracefully
- Invalid JSON → skip entry
- Embeddings unavailable → fallback to BM25-only
- Claude CLI absent → skip graph extraction

### Limits and Caps

| Parameter | Value | Purpose |
|:---|:---|:---|
| Max 10 signals per session | Prevent noise | Signal tracker |
| Max 30 crystallized preferences | Cap profile size | Crystallization |
| Max 3 new facts per dream cluster | Prevent explosion | Dream cycle |
| Max 20 embedding repairs per call | Prevent blocking | Lazy repair |
| Max 100 entities in extraction prompt | Context budget | Graph builder |
| Max 50 facts in extraction prompt | Context budget | Graph builder |
| Max 500 preference signals | Rolling window | Signal tracker |
| Max 5 history versions per fact | Memory management | Reconsolidation |
| Max 100 snapshots per project | Disk management | Pre-edit snapshots |
| GC interval: 6 hours | Prevent over-processing | Memory lifecycle |
| GC lock timeout: 60 seconds | Prevent deadlocks | Lock mechanism |

---

## Performance Summary

| Component | Technology | Cost | Latency |
|:---|:---|:---:|:---|
| Extraction | `claude -p` (CLI, subscription) | $0 | ~2-5s per session |
| Embeddings | MiniLM-L6-v2 (local ONNX, 22MB) | $0 | ~10-50ms per text |
| BM25 search | `minisearch` (15KB, zero deps) | $0 | ~2ms |
| Semantic search | Cosine similarity (Float32Array) | $0 | ~5ms |
| Hybrid fusion | RRF (pure math) | $0 | ~1ms |
| Graph load | JSONL + binary parse | $0 | ~200ms |
| Full retrieval | First message (model load + search) | $0 | ~350ms |
| Full retrieval | Subsequent messages | $0 | ~50ms |

**Everything runs locally.** Zero API calls except `claude -p` (which uses your existing subscription). Zero cloud storage. Zero telemetry sent anywhere.

---

## Algorithm Summary

| Algorithm | Origin | Use Case | Implementation |
|:---|:---|:---|:---|
| **ACT-R Activation** | Anderson 1993 | Fact importance decay | `ln(Σ(t_i^{-0.5})) × weight` |
| **Reciprocal Rank Fusion** | Cormack et al. 2009 | Hybrid search merge | `Σ(w / (k + rank))` |
| **Baddeley Chunking** | Baddeley 2000 | Working memory grouping | Max 5 semantic groups |
| **Label Propagation** | Raghavan et al. 2007 | Community detection | 5 iterations, majority label |
| **Bi-Temporality** | Graphiti/Zep 2024 | Fact versioning | 4 timestamps per fact |
| **Recency Decay** | Ebbinghaus 1885 | Search scoring | `exp(-days / 90)` |
| **Jaccard Similarity** | Jaccard 1912 | Dedup fallback | `|A ∩ B| / |A ∪ B|` |
| **Hippocampal Replay** | Wilson & McNaughton 1994 | Episode consolidation | Dream cycle |
| **Reconsolidation** | Nader et al. 2000 | Memory update | History preservation |
| **CLS Theory** | McClelland 1995 | Tier architecture | Fast T1 → slow T3 |
| **Tulving Taxonomy** | Tulving 1972 | Fact classification | Episodic/semantic/procedural |
| **Cosine Similarity** | — | Embedding comparison | `dot(a,b) / (|a| × |b|)` |

---

<p align="center">
  <strong>HORA Memory</strong> — <em>your memory never sleeps.</em>
</p>
