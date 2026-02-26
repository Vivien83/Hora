<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-Native-blueviolet?style=for-the-badge&logo=anthropic" alt="Claude Code Native">
  <img src="https://img.shields.io/badge/Platform-macOS_|_Linux_|_Windows-blue?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
  <img src="https://img.shields.io/badge/Knowledge_Graph-Bi--temporal-teal?style=for-the-badge" alt="Knowledge Graph">
  <img src="https://img.shields.io/badge/Embeddings-Local_ONNX-orange?style=for-the-badge" alt="Local Embeddings">
  <img src="https://img.shields.io/badge/Config-Zero-brightgreen?style=for-the-badge" alt="Zero Config">
</p>

<h1 align="center">HORA</h1>
<h3 align="center">Hybrid Orchestrated Reasoning Architecture</h3>

<p align="center">
  <strong>A self-learning AI system with neural memory for Claude Code.</strong><br>
  Starts empty. Builds a knowledge graph through usage. Retrieves context via semantic search.<br>
  Opinionated TypeScript/React stack. Library-first. Zero additional cost.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> &bull;
  <a href="#-features">Features</a> &bull;
  <a href="#-knowledge-graph">Knowledge Graph</a> &bull;
  <a href="#-dashboard">Dashboard</a> &bull;
  <a href="#-skills--agents">Skills & Agents</a> &bull;
  <a href="#%EF%B8%8F-architecture">Architecture</a> &bull;
  <a href="#-web-saas-conventions">Web/SaaS Stack</a> &bull;
  <a href="#-customization">Customization</a>
</p>

---

## Why HORA?

Claude Code is powerful out of the box. But it forgets everything between sessions. It doesn't learn your preferences. It can't protect you from destructive commands. And when context compacts, you lose your train of thought.

**HORA fixes all of that** — silently, automatically, with zero configuration.

```
Session 1:  Empty      --> 3 questions --> MEMORY/PROFILE/ starts filling
Session 2:  Reloaded   --> Knowledge graph captures entities, facts, relationships
Session N:  Rich       --> Semantic search injects only the relevant context per query
```

### What makes it different

| | Without HORA | With HORA |
|---|---|---|
| **New session** | "I have no context" | Semantic search retrieves relevant facts from the knowledge graph |
| **New project** | Re-explore the codebase every time | Auto-audit stored in `.hora/project-knowledge.md` |
| **Dangerous command** | Executes silently | Blocked or confirmed before execution |
| **Context compaction** | Lost train of thought | Auto-detected, project-scoped checkpoint injected |
| **Long session (days)** | Memory only saved at end | Re-extraction every 20 minutes |
| **Multiple terminals** | Sessions overwrite each other's state | Full session isolation, project-scoped checkpoints |
| **File edited by mistake** | Hope you have git | Snapshot saved automatically before every edit |
| **Memory after months** | Flat files, everything loaded | 3-tier memory (T1/T2/T3) with ACT-R activation decay, GC |
| **Context injection** | Dump everything | Hybrid search (semantic + BM25) with Baddeley chunking |
| **Understanding patterns** | None | Knowledge graph with reconsolidation, dream cycle, community detection |
| **Forgetting** | Never or all-at-once | ACT-R model: frequently recalled facts survive, unused facts decay naturally |
| **Duplicate facts** | Accumulate forever | Auto-dedup by embedding similarity (> 0.92 cosine = same fact) |

---

## Quick Start

### macOS / Linux

```bash
git clone https://github.com/Vivien83/Hora.git
cd Hora
bash install.sh
```

### Windows (native, no WSL)

```powershell
git clone https://github.com/Vivien83/Hora.git
cd Hora
.\install.ps1
```

### Then just use Claude Code as usual

```bash
claude
```

That's it. No config files to edit. No API keys to set. HORA learns silently from your first session.

### Prerequisites

| | macOS | Linux | Windows |
|:---|:---:|:---:|:---:|
| **Claude Code** | Required | Required | Required |
| **Node.js 18+** | Required | Required | Required |
| **Git** | Required | Required | Required ([Git for Windows](https://git-scm.com/download/win)) |
| **tsx** | Auto-installed | Auto-installed | Auto-installed |
| **jq** | Recommended | Recommended | Auto-installed |

> `jq` enables smart merging of `settings.json` (preserves your existing hooks). Without it, HORA settings overwrite entirely. The installer auto-installs jq when possible (`winget` on Windows, `brew` on macOS, `apt`/`apk` on Linux). Manual install: `brew install jq` / `apt install jq` / `choco install jq`.

### Install options

```bash
bash install.sh                        # Full install
bash install.sh --dry-run              # Preview what would happen (no changes)
bash install.sh --restore              # Rollback to latest backup
bash install.sh --restore <timestamp>  # Rollback to a specific backup
bash install.sh --list-backups         # List available backups
```

### What install.sh does

The installer runs 8 steps with a visual UI (ASCII header, progress counter, colored output):

1. **Prerequisites** — checks Claude Code, installs tsx/jq if missing
2. **Backup** — versioned snapshot of all Claude Code data + HORA files (rotation: keeps last 5)
3. **Cleanup** — removes legacy artifacts (PAI and predecessors)
4. **Configuration** — creates directory tree, merges CLAUDE.md (between `<!-- HORA:START/END -->` markers), merges settings.json (preserves third-party hooks, deduplicates)
5. **Hooks & Agents** — copies TypeScript hooks and agent definitions, cleans orphan hooks pointing to non-existent files, resolves Windows paths (`~` → `C:/Users/...`)
6. **Skills & Security** — copies skill directories (SKILL.md format), installs security patterns
7. **Memory** — initializes MEMORY/PROFILE/ if empty (never overwrites existing data)
8. **Verification** — checks session data integrity, detects orphan files

> In case of error: `bash install.sh --restore` restores the backup.

---

## Features

### 1. Knowledge Graph (Neuroscience-inspired)

HORA builds a **bi-temporal knowledge graph** inspired by [Graphiti](https://github.com/getzep/graphiti) and neuroscience (CLS theory, ACT-R, Tulving's memory taxonomy) — automatically, at the end of every session.

```
Session ends --> claude -p extracts entities + facts + contradictions
            --> @huggingface/transformers computes 384-dim embeddings (local ONNX)
            --> Graph updated with bi-temporal metadata
            --> Dream cycle consolidates episodes into semantic knowledge
            --> Next session: hybrid search (semantic + BM25) retrieves relevant context
```

#### Three-layer structure

| Layer | What | Example |
|:---|:---|:---|
| **Entities** (nodes) | Concepts extracted from sessions | `project:hora`, `tool:react-force-graph`, `preference:library-first` |
| **Facts** (edges) | Typed relationships with Tulving classification | `semantic`: "HORA uses TypeScript", `procedural`: "When bug auth → check Better-Auth config" |
| **Episodes** (raw) | Source references, consolidated by dream cycle | `session:a1b2c3d4 → extracted 5 entities, 8 facts` |

#### Memory types (Tulving taxonomy)

Every fact is classified as one of three types, enabling type-aware retrieval:

| Type | What | Mutable | Example |
|:---|:---|:---:|:---|
| **Semantic** | General knowledge | Yes (reconsolidation) | "HORA uses TypeScript strict" |
| **Episodic** | Time-bound events | No (immutable) | "Fixed auth bug on Feb 20" |
| **Procedural** | How-to patterns | Yes (reconsolidation) | "When new component → create in src/components/ with shadcn" |

#### Bi-temporality (4 timestamps per fact)

| Timestamp | Meaning |
|:---|:---|
| `valid_at` | When the fact became true in the real world |
| `invalid_at` | When it stopped being true (`null` = still valid) |
| `created_at` | When recorded in the graph |
| `expired_at` | When superseded by a newer fact |

This means HORA can **travel through time** — see what was true at any point, detect contradictions, and automatically supersede outdated facts.

#### Reconsolidation

When a semantic or procedural fact is recalled and new evidence appears, HORA **enriches it progressively** instead of replacing it. Each reconsolidation stores the previous state in `metadata.history[]` (max 5 versions) — like how human memories are updated each time they're recalled.

#### Dream Cycle (hippocampal replay)

Inspired by sleep-dependent memory consolidation, the dream cycle runs during GC (every 6h):

1. Replays unconsolidated episodes from the last 7 days
2. Clusters episodes by shared entities
3. Patterns appearing in 3+ episodes → distilled into new semantic facts
4. Existing facts reinforced with new evidence (reconsolidation)
5. Episodes marked as consolidated

#### Community Detection

Facts and entities are grouped into **communities** via BFS + label propagation. When a query matches an entity, its entire community can be surfaced for richer context.

#### Zero additional cost

| Component | Technology | Cost |
|:---|:---|:---|
| **Extraction** | `claude -p` (CLI pipe, subscription) | $0 |
| **Embeddings** | `@huggingface/transformers` (all-MiniLM-L6-v2, local ONNX, 22MB) | $0 |
| **BM25 search** | `minisearch` (zero deps, ~15KB) | $0 |
| **Retrieval** | Hybrid (cosine similarity + BM25 + RRF fusion + BFS) | $0 |

Everything runs locally or through your existing Claude subscription.

#### Anti-recursion

When `session-end.ts` calls `claude -p` for extraction, it sets `HORA_SKIP_HOOKS=1`. All HORA hooks exit immediately when this variable is present — zero risk of infinite recursion.

---

### 2. Agentic Retrieval (Hybrid Search)

On **every user message**, HORA runs an agentic retrieval pipeline — classifying the task, generating targeted queries, and searching the graph with two complementary systems.

```
User message: "Fix the auth middleware"
                |
                v
    1. Classify task (debug? feature? question?)
                |
                v
    2. Generate 2-3 search queries with weights
                |
                v
    3. Hybrid search per query:
       ├── Semantic: embed(query) → cosine similarity vs all facts
       └── BM25: minisearch exact keyword matching
       └── Reciprocal Rank Fusion (RRF) merges both rankings
                |
                v
    4. BFS depth 2 on top entities → semantic neighborhood
                |
                v
    5. ACT-R activation boost: recently recalled facts score higher
                |
                v
    6. Baddeley chunking: group into max 5 thematic chunks
                |
                v
    Budget: min(6000 chars, 15% remaining context)
                |
                v
    Inject as [HORA KNOWLEDGE GRAPH] section
```

**Why hybrid?** Semantic search finds `"TypeScript coding"` from `"TS development"` — but misses exact terms. BM25 catches `"Drizzle"` matching a fact about `"uses Drizzle ORM"`. Together via RRF, they cover both fuzzy and exact matching.

**Why Baddeley chunking?** Working memory handles ~4 chunks, not 20 individual items. Facts are grouped by semantic proximity into thematic chunks (e.g., "Stack & Tooling", "Architecture Decisions") for better comprehension.

**Latency:** ~350ms on first message only (model load from cache + embed + search). Subsequent messages: ~50ms.

**ACT-R retrieval boost:** Every successful retrieval strengthens the recalled facts — like spaced repetition. Facts that keep being useful survive longer.

**Fallback:** If embeddings aren't available, HORA falls back to BM25-only then to classic profile injection. Zero degradation.

---

### 3. Memory Tiers (T1/T2/T3) + ACT-R Activation

HORA organizes memory like the human brain — short-term, medium-term, and long-term — with an **ACT-R activation model** that replaces fixed expiration thresholds.

| Tier | Retention | Promotion criteria | Storage |
|:---|:---|:---|:---|
| **T1** (short) | 24 hours | Auto-expires | Recent sessions, raw data |
| **T2** (medium) | Adaptive (ACT-R) | Recurring patterns (3+ occurrences) | `LEARNING/INSIGHTS/` |
| **T3** (long) | Permanent | Confirmed important | `LEARNING/INSIGHTS/` |

#### ACT-R Activation Model

Instead of fixed 30-day expiration, each fact has an **activation level** based on the ACT-R cognitive architecture:

```
Activation = ln(Σ(t_i^{-d})) × emotionalWeight
```

Where `t_i` = time since each access, `d` = 0.5 (decay rate).

- A fact accessed **often and recently** → high activation → survives indefinitely
- A fact accessed **once, 90 days ago** → low activation → expires naturally
- **Emotional weight** boosts corrections and failures (1.5x) — memorable events decay slower

The `shouldExpire` threshold (-2.0) means a single access survives ~45 days, but 3 accesses in a week can keep a fact alive for months.

#### Automatic lifecycle

- **Expiration:** T1 entries older than 24h are garbage-collected. T2 facts expire based on ACT-R activation (not fixed days).
- **Promotion:** Patterns seen 3+ times in T2 are promoted to T3
- **Dream Cycle:** Consolidates episodes → distills patterns → reconsolidates facts (runs during GC)
- **GC:** Runs every 6 hours (lock file prevents concurrent runs)
- **Insights:** Recurring failures, sentiment trends, tool usage patterns — all aggregated automatically

```
MEMORY/LEARNING/INSIGHTS/
  recurring-failures.md       # Patterns that keep happening
  sentiment-summary.jsonl     # Monthly sentiment trends
  tool-monthly.jsonl          # Tool usage aggregated by month
MEMORY/GRAPH/
  activation-log.jsonl        # ACT-R access history per fact
  communities.jsonl           # Detected entity communities
```

---

### 4. Periodic Re-extraction

Long sessions (hours or days) no longer lose memory. HORA re-extracts every **20 minutes**:

```
Session start  --> Full extraction (profile, errors, sentiment, archive)
+20 min        --> Re-extraction (update archive, new thread entries, refresh memory)
+40 min        --> Re-extraction
...            --> Every 20 minutes until session ends
Session end    --> Final extraction
```

The extraction flag uses a **timestamp** (not boolean) — so HORA knows exactly when the last extraction happened and only triggers when the interval has elapsed.

---

### 5. Layered Security

Every operation is validated automatically by `hora-security.ts` — a defense-in-depth system with three layers.

```
Layer 1:  AI asks for confirmation (proactive)
Layer 2:  Hook validates and blocks if AI forgets (safety net)
Layer 3:  Full audit trail in MEMORY/SECURITY/ (accountability)
```

#### Severity Levels

| Level | Action | Examples |
|:---|:---|:---|
| **BLOCKED** | Operation denied, exit 2 | `rm -rf /`, `gh repo delete`, `diskutil eraseDisk`, `format C:` |
| **CONFIRM** | User prompt required | `git push --force`, `DROP TABLE`, `terraform destroy` |
| **ALERT** | Logged, but allowed | `curl \| bash`, `sudo`, `chmod 777` |

#### Protected Paths

| Type | Effect | Examples |
|:---|:---|:---|
| **zeroAccess** | No access at all | `~/.ssh/id_*`, `credentials.json`, `.env.production` |
| **readOnly** | Read only | `/etc/**` |
| **confirmWrite** | Write requires confirmation | `settings.json`, `.env`, `~/.zshrc` |
| **noDelete** | Cannot be deleted | `hooks/`, `skills/`, `.hora/`, `.git/` |

All patterns are customizable in `~/.claude/.hora/patterns.yaml`.

> **17 blocked patterns, 18 confirm patterns, 6 alert patterns** out of the box. Add your own in YAML.

---

### 6. Self-Learning Memory

At the end of every significant session (3+ messages), HORA silently extracts profile data using **two-layer hybrid extraction**:

#### Layer A — Environment (deterministic)

| Source | Command | Data extracted |
|:---|:---|:---|
| Git config | `git config user.name/email` | Full name, email |
| Git remote | `git remote get-url origin` | GitHub username |
| Working directory | `process.cwd()` | Current project name |
| package.json | `fs.readFileSync` (max 50KB) | Tech stack from dependencies |
| Git ls-files | `git ls-files` (timeout 3s) | Dominant languages by extension |

#### Layer B — Linguistic (transcript analysis)

| Detection | Method | Example |
|:---|:---|:---|
| Language | >50% user lines contain FR words | `Langue: francais [transcript]` |
| Vocabulary | Technical terms repeated 3+ times (stopwords filtered) | `hook, snapshot, statusline` |
| Identity (fallback) | Regex patterns if git config empty | `je m'appelle X` |

#### Additional extractions

| What | Format | Storage |
|:---|:---|:---|
| **Errors & Lessons** | JSONL (user messages only, conversational patterns, max 5/session) | `LEARNING/FAILURES/failures-log.jsonl` |
| **Sentiment** | JSONL (one line per session) | `LEARNING/ALGORITHM/sentiment-log.jsonl` |
| **Session Archive** | Markdown (summary + first 5000 chars) | `SESSIONS/` |
| **Thread History** | JSONL (ALL user/assistant exchanges from transcript) | `STATE/thread-state.jsonl` |

**Everything is silent.** HORA never interrupts your flow. You won't even notice it's learning.

---

### 7. Cross-Session Continuity

HORA extracts **all user/assistant exchanges** from the JSONL transcript at session end, providing complete thread history across sessions.

#### Project-scoped context

Session history is **filtered by project**. Each project gets a stable ID stored in `.hora/project-id` — persists even if the folder is renamed. When you switch projects, you only see context from that project.

```
You: "hey"
HORA: "Hey! Last time we were refactoring the auth module.
       The middleware was done but we still had 2 tests failing. Continue?"
```

---

### 8. Automatic Session Naming

Every session gets a deterministic name from the first prompt:

```
"Refonte page conges"     -->  "Refonte Conges Session"
"Fix the login bug"       -->  "Login Session"
"Implement dark mode"     -->  "Dark Mode Session"
```

No AI inference — fast regex extraction. Stored in `MEMORY/STATE/session-names.json`.

---

### 9. Pre-Edit Snapshots

Every `Write` / `Edit` / `MultiEdit` saves the file **BEFORE** modification.

```
<project>/.hora/snapshots/
  manifest.jsonl                           <-- append-only index (JSONL)
  2026-02-20/
    10-32-15-042_auth-middleware.ts.bak     <-- timestamped backup
    10-45-03-118_settings.json.bak
    11-02-44-901_README.md.bak
```

| Parameter | Value |
|:---|:---|
| Max snapshots | 100 (auto-cleanup at 90) |
| Max file size | 5 MB |
| Binary files | Skipped |
| Git required | No — works with or without git |

Snapshots are **project-scoped** — each project has its own snapshot history in `<project>/.hora/snapshots/`. No cross-project mixing.

---

### 10. Automatic Backup

The `backup-monitor` hook watches for changes and triggers backup automatically:

```
Trigger conditions:
  - 15 minutes elapsed with modified files
  - OR 3+ files modified in the session

Strategy selection:
  Remote available?  -->  git commit + push to hora/backup/[branch]
  No remote?         -->  git bundle to .hora/backups/ (keeps last 10)

Cooldown: 30s between full checks
```

---

### 11. Rich Statusline

A live status bar at the bottom of Claude Code with 3 responsive modes using gradient diamond bars and push-aware commit indicators:

```
Full mode (>= 80 cols):
── | HORA | ──────────────────────────────────────────────────────────────────────
◈ CONTEXTE : ◆◆◆◆◆◆◆◆◆◆◆◆◆◆◇◇◇◇◇◇ 68% | 23m
◈ USAGE : 5H: 42% (reset 2h31) | WK: 18%
◈ GIT : feat/auth | ~/project | Modif:3 Nouv:1 | Backup: R 5min
◈ COMMITS : ● a1b2c3d Add auth middleware
◈ SNAP: 12 proteges | MODELE : claude-sonnet-4-5 | SKILLS : 5 hora/10 total
──────────────────────────────────────────────────────────────────────────────────
```

---

### 12. Context Checkpoint System

When Claude Code compresses context (compaction), HORA detects and recovers automatically:

```
[Before compact]  Statusline writes context % --> hook stores 85%
[Compact event]   Claude Code compresses     --> context drops to ~20%
[Recovery]        Hook detects >40pt drop    --> injects checkpoint + activity log
```

**Project-scoped, not session-scoped:** The checkpoint lives in the project's `.hora/` directory. Different projects each have their own checkpoint — no cross-contamination.

---

### 13. Session Isolation

HORA supports **concurrent sessions** — multiple Claude Code terminals working on different projects simultaneously without interference.

```
Terminal 1 (project-A):  ~/.claude/.hora/sessions/a1b2c3d4/  (own state)
Terminal 2 (project-B):  ~/.claude/.hora/sessions/e5f6g7h8/  (own state)
                         project-A/.hora/checkpoint.md        (own checkpoint)
                         project-B/.hora/checkpoint.md        (own checkpoint)
```

**Path traversal protection:** Session IDs are sanitized to `[a-zA-Z0-9_-]` only — no `../` injection possible.

---

### 14. Auto Project Audit

When HORA detects a **new project** (no `.hora/project-knowledge.md`), it automatically proposes a full codebase audit covering architecture, stack, security flaws (with severity levels), technical debt, and good practices.

Results are stored in `.hora/project-knowledge.md` — versioned with git, injected automatically on every future session. Updated incrementally as Claude discovers new information.

---

### 15. Dashboard (v2 — Real-time + Neural)

A standalone React 19 + Vite 6 app in `claude/dashboard/` that visualizes all HORA data in real-time.

```bash
cd claude/dashboard && npm install && npm run dev
# Opens at http://localhost:3847 — updates automatically via HMR
```

**7 navigation sections:**

| Section | What it shows |
|:---|:---|
| **Overview** | 6 stat cards, sessions table, sentiment chart, recent thread |
| **Project** | Checkpoint, project knowledge |
| **Memory** | Memory health (T1/T2/T3 bars), user profile, thread history, failures |
| **Neural** | Full-page interactive knowledge graph (see below) |
| **Chat** | Complete CLI transcript viewer — all messages, all sessions |
| **Security** | Security events (blocks, confirms, alerts) |
| **Tools** | Tool usage timeline (7-day bar chart) |

#### Neural Page

Full-page interactive visualization of the **real knowledge graph** using `react-force-graph-2d`:

- **Nodes** = entities from `GRAPH/entities.jsonl`, colored by type (project=teal, tool=blue, error=red, preference=green, concept=purple, person=amber, file=zinc, library=orange)
- **Edges** = facts from `GRAPH/facts.jsonl`, thickness = confidence, opacity = recency
- **Node size** = degree centrality (number of connected facts)
- **Interactions:** click node for detail panel with timeline, click link for relation details, drag to reposition (positions persisted), search bar, temporal slider
- **Breathing animation** on entities seen in the last 48 hours
- **Particle animation** on facts created in the last 24 hours

#### Chat View

Complete CLI transcript viewer reading raw JSONL from `~/.claude/projects/`:

- **Scope:** current project only (based on path-encoded slug)
- **Complete messages:** full content from Claude Code transcripts, not summaries
- **Terminal style:** dark background, role badges (U/A), timestamps, session separators
- **Search:** filter by content, session ID, role
- **Collapsible:** long messages collapsed with expand button

#### Memory Health

Visual monitoring of the 3-tier memory system:

- Bar charts showing T1/T2/T3 entry counts
- Alerts when memory is unhealthy (too many T1, empty T3, etc.)
- Last GC timestamp, promotion stats

**Real-time architecture:** Vite plugin with chokidar watches `~/.claude/MEMORY/` and `<project>/.hora/`, debounces 500ms, pushes updates via HMR WebSocket. Fallback: polling every 10s.

---

### 16. Web/SaaS Conventions (Built-in)

HORA ships with **opinionated conventions** for modern web/SaaS development. These are enforced automatically through the CLAUDE.md guidelines.

#### Mandatory algorithm

The HORA algorithm (EXPLORE → PLAN → AUDIT → CODE → COMMIT) runs on **every task**, with depth proportional to complexity:

| Complexity | Algorithm depth |
|:---|:---|
| Trivial (typo, 1-3 lines) | EXPLORE (implicit) → CODE |
| Medium (feature, bug) | EXPLORE → PLAN → AUDIT → CODE |
| Complex (multi-file, archi) | EXPLORE → full PLAN with ISC → AUDIT → CODE |
| Critical (auth, data, migration) | Full algorithm + **user validation required** |

#### Implementation mode choice

When an implementation task is detected, HORA proposes:

| Mode | Description |
|:---|:---|
| **HORA** (default) | EXPLORE → PLAN → AUDIT → CODE → COMMIT. Fast and effective. |
| **Forge** | Zero Untested Delivery. TDD, 7 gates, tests mandatory at every phase. |

#### Library-first philosophy

**Never reimplement what a maintained library already does.**

Decision rule:
1. Does it differentiate the product? **No** → use existing library
2. Does the library cover 80%+ of the need? **Yes** → library + light extension
3. Otherwise → build, but document why

#### Default stack

| Layer | Default | Alternative |
|:---|:---|:---|
| Language | **TypeScript strict** | Never JS, never Python |
| Frontend | **React 19+ / Next.js App Router** | Vite + React (SPA) |
| Styling | **Tailwind CSS + shadcn/ui** | — |
| Database | **PostgreSQL + Drizzle ORM** | Prisma if already in place |
| Auth | **Better-Auth** or Auth.js v5 | — |
| Validation | **Zod** (forms, API, env) | — |
| Forms | **react-hook-form + Zod** | — |
| Tables | **@tanstack/react-table** | — |
| Server state | **TanStack Query** | — |
| Client state | **Zustand** | Context if trivial |
| Animations | **motion** | — |
| Charts | **Recharts** | Tremor for dashboards |
| Rich text | **@tiptap/react** | — |
| DnD | **@dnd-kit/core** | — |
| Payments | **@stripe/react-stripe-js** | — |
| Testing | **Vitest + Testing Library + Playwright** | — |

#### Design anti-patterns (banned)

HORA explicitly **bans the generic "AI look"** in all UI work. No indigo gradients, no glassmorphism, no floating blobs, no hero > 100vh, no pure black backgrounds. **Design references:** Linear, Vercel, Clerk, Resend.

**Accessibility (WCAG 2.2):** 4.5:1 contrast, 44px touch targets, visible focus rings, `prefers-reduced-motion` respected, keyboard alternatives for all interactions.

---

### 17. Additional Features

| Feature | Description |
|:---|:---|
| **Intelligent Routing** | `prompt-submit` detects intent and suggests the right skill |
| **Doc Sync** | Tracks structuring file changes and reminds to update `project-knowledge.md` |
| **Librarian Agent** | Enforces library-first at file creation time in `utils/`, `helpers/`, `lib/` |
| **Sentiment Predict** | Heuristic tone analysis (1-5), alerts on frustration, anti-false-positive |
| **Vision Audit** | 23-point multimodal screenshot checklist across 5 categories |
| **Custom Spinners** | 50 French messages replacing generic Claude Code spinners |
| **Tool Analytics** | Every tool call logged to `MEMORY/.tool-usage.jsonl` |

---

## Skills & Agents

### Skills (slash commands)

| Command | What it does | Methodology |
|:---|:---|:---|
| `/hora-design` | Anti-AI web design — intentional, premium UI | Dieter Rams, Bauhaus, Swiss Style, OKLCH |
| `/hora-forge` | Zero Untested Delivery — TDD with 7 mandatory gates | NASA Cleanroom, TDD, DO-178C, Jidoka |
| `/hora-refactor` | Systematic refactoring with safety nets | Martin Fowler (70+ catalog), Michael Feathers |
| `/hora-security` | OWASP Top 10 2025 audit with CWE references | OWASP 2025, CWE/SANS Top 25, Microsoft SDL |
| `/hora-perf` | Core Web Vitals + Lighthouse performance audit | Google CWV, RAIL model, Lighthouse |
| `/hora-plan` | Full planning with verifiable ISC criteria | EXPLORE → PLAN → AUDIT → Validation |
| `/hora-autopilot` | Autonomous end-to-end execution | PLAN → AUDIT → BUILD → VERIFY |
| `/hora-parallel-code` | Multi-agent codebase work | Architect → AUDIT → Executors in parallel |
| `/hora-parallel-research` | Multi-angle research | 3-5 angles → Researchers → Synthesizer |
| `/hora-backup` | Immediate backup | Delegates to backup agent |
| `/hora-vision` | Visual UI audit — detects anti-patterns from screenshots | 23-point checklist, multimodal |
| `/hora-dashboard` | HORA analytics dashboard | React 19, Vite 6, Recharts, react-force-graph-2d |

> Every skill includes an **AUDIT step** that identifies ghost failures (silent failure modes) before any code is written.

### Agents

| Agent | Model | Role |
|:---|:---:|:---|
| **architect** | Opus | Structural decisions, system design, proposes 2-3 options |
| **executor** | Sonnet | Implementation, debug, refactoring (surgical modifications) |
| **researcher** | Sonnet | Multi-source research, analysis, documentation |
| **reviewer** | Haiku | Quick review, PASS/FAIL verdict, Critical/Warning/OK severity |
| **synthesizer** | Haiku | Multi-source aggregation, deduplication |
| **backup** | Haiku | Silent git backup (mirror branch or local bundle) |
| **librarian** | Haiku | Library-first verification (npm search, criteria check) |

> Agents are only activated when needed. Simple tasks get direct responses — no over-delegation.

---

## The Algorithm

HORA follows a structured reasoning process for **every task** — it's not optional. The depth scales with complexity, but the steps are always followed.

```
0. PRIORITIES (in case of conflict)
   Security > Ethics > Robustness > HORA Guidelines > Utility

1. EXPLORE
   Read before writing. Always.
   - What's the real ask behind the words?
   - SSOT: Does this logic already exist?
   - Library-first: Does a maintained library do this?
   - Can what's in production break?

2. PLAN (Complex+ only)
   | Impact               | Thinking level                    |
   |----------------------|-----------------------------------|
   | Isolated / cosmetic  | Standard                          |
   | Business logic       | Think hard                        |
   | Auth / data / infra  | Ultrathink + user validation      |

3. AUDIT (Ghost Failures)
   Before coding, identify silent failure modes:
   - Is each technical assumption VERIFIED or ASSUMED?
   - What happens if integration points fail, timeout, or return unexpected data?
   - Race conditions, stale files, false positives?

   Critical ghost failure found? --> Test before coding.
   None found? --> Document why (negative proof).

4. CODE
   Robustness > Speed. SSOT > Convenience. Library > Custom.

5. COMMIT
   Verify ISC. Message: what / why / impact.
```

---

## Architecture

### How hooks work

```
                         Claude Code
                              |
                    +---------+---------+
                    |                   |
              User Prompt          Tool Call
                    |                   |
           +--------+--------+    +----+----+
           |                 |    |         |
    UserPromptSubmit    PreToolUse    PostToolUse    Stop
           |                 |         |              |
    prompt-submit.ts   snapshot.ts  backup-monitor  session-end.ts
    hora-session-name  hora-security doc-sync.ts      |
           .ts         tool-use.ts                 Extract:
           |           context-                    - Profile + Errors
    Injects:           checkpoint.ts               - Sentiment + Archive
    - Knowledge Graph  librarian-                  - Thread (all exchanges)
      (semantic search) check.ts                   - Knowledge Graph
    - MEMORY/                |                       (claude -p extraction
    - Thread history   Validates:                    + embeddings)
    - Routing hints    - Security rules
    - Checkpoint       - Pre-edit snapshot
      reminder         - Tool logging
    - Sentiment alert  - Compact detection
                       - Library-first check
```

### Data flow

```
                    ~/.claude/
                         |
        +--------+-------+-------+--------+
        |        |       |       |        |
     MEMORY/   hooks/  agents/  skills/  .hora/
        |        |                        |
   +----+----+   +-- lib/         +------+------+------+
   |    |    |   |   knowledge-   |      |      |      |
PROFILE/ |   |   |   graph.ts   sessions/ state/ patterns
LEARNING/|   |   |   embeddings   <sid8>/        .yaml
  |   SESSIONS/  |   .ts          (per-
  |      |       |   graph-        session
GRAPH/   |       |   builder.ts    state)
  |    STATE/    |   graph-
entities         |   migration.ts
.jsonl           |   memory-
facts            |   tiers.ts
.jsonl           |   session-
episodes         |   paths.ts
.jsonl           |

                    <project>/
                         |
                       .hora/
                         |
              +----------+----------+----------+
              |          |          |          |
        project-id  checkpoint  snapshots/  project-
     (stable UUID)    .md       manifest    knowledge
                   (inherited   .jsonl +    .md
                    by new      .bak files
                    sessions)
```

### Knowledge Graph storage

```
MEMORY/GRAPH/
  entities.jsonl       # {id, type, name, properties, embedding[384], created_at, last_seen}
  facts.jsonl          # {id, source, target, relation, description, embedding[384],
                       #  valid_at, invalid_at, created_at, expired_at, confidence,
                       #  metadata: {memory_type, reconsolidation_count, history[]}}
  episodes.jsonl       # {id, source_type, source_ref, timestamp, entities[], facts[],
                       #  consolidated?}
  activation-log.jsonl # {factId, accessTimes[], emotionalWeight, lastActivation}
  communities.jsonl    # {id, name, entities[], facts[], summary, updated_at}
```

Embeddings are stored inline (384 floats per entity/fact). Estimated volume after 6 months: ~2 MB. Loadable in < 200ms.

### Dependencies

| Component | Dependencies |
|:---|:---|
| **Hooks** (runtime) | `tsx` + `@huggingface/transformers` (embeddings) + `minisearch` (BM25) + `zod` (validation) |
| **Dashboard** | React 19, Vite 6, Recharts, react-force-graph-2d, chokidar |
| **Security** | Node.js built-ins only (custom YAML parser) |

### Fail-safe design

Every hook wraps its logic in `try/catch` and exits `0` on error. **Hooks never block Claude Code**, even if a file is missing or corrupted. Embeddings unavailable? Falls back to classic injection. Claude CLI absent? Skips graph extraction. JSON invalid? Skips and continues.

### Cross-platform

| Component | macOS | Linux | Windows (Git Bash) |
|:---|:---:|:---:|:---:|
| install.sh | Full | Full | Full (via install.ps1) |
| install.ps1 | N/A | N/A | Full (entry point) |
| TypeScript hooks | Full | Full | Full (runs via cmd.exe) |
| statusline.sh | Full | Full | Full (jq or Node.js fallback) |
| Knowledge graph | Full | Full | Full |
| Dashboard | Full | Full | Full |

---

## Hooks Lifecycle

```
UserPromptSubmit (fires on every user message)
  |-- prompt-submit.ts         Injects: knowledge graph (semantic search), MEMORY/,
  |                            routing hints, thread continuity, checkpoint reminder
  |                            at 70%, sentiment analysis
  |-- hora-session-name.ts     Names the session on first prompt

PreToolUse (fires before every tool call)
  |-- snapshot.ts              Write|Edit|MultiEdit: saves file before edit
  |-- hora-security.ts         Bash|Edit|Write|Read|MultiEdit: security validation
  |-- tool-use.ts              *: silent usage logging
  |-- context-checkpoint.ts    *: compact detection + recovery injection
  |-- librarian-check.ts       Write: library-first verification on new utility files

PostToolUse (fires after every tool call)
  |-- backup-monitor.ts        Write|Edit|MultiEdit: monitors changes, triggers backup
  |-- doc-sync.ts              Write|Edit|MultiEdit: tracks structuring changes

Stop (fires at session end)
  |-- session-end.ts           Extracts: profile, errors, sentiment, archive,
                               all thread exchanges, knowledge graph
                               (claude -p extraction + embeddings)

Re-extraction: every 20 minutes during long sessions
```

---

## Repository Structure

```
hora/
|-- README.md
|-- install.sh                    # Installer (macOS/Linux/Windows via Git Bash)
|-- install.ps1                   # Windows PowerShell entry point
|-- .gitattributes                # Forces LF line endings
|-- .gitignore                    # Ignores **/.hora/ runtime files
|-- scripts/
|   |-- seed-graph.mjs            # One-shot graph seeding from existing memory
|
|-- claude/                       # SOURCE — everything deployed to ~/.claude/
    |
    |-- CLAUDE.md                 # The Algorithm + Stack + Design + Security
    |-- settings.json             # Hooks + statusLine + spinnerVerbs
    |-- statusline.sh             # Rich status bar (3 responsive modes)
    |
    |-- .hora/
    |   |-- patterns.yaml         # Security rules (17 blocked, 18 confirm, 6 alert)
    |
    |-- hooks/                    # 10 TypeScript lifecycle hooks
    |   |-- prompt-submit.ts      #   UserPromptSubmit: knowledge graph injection + context
    |   |-- hora-session-name.ts  #   UserPromptSubmit: auto session naming
    |   |-- snapshot.ts           #   PreToolUse: pre-edit file backup
    |   |-- hora-security.ts      #   PreToolUse: security validation (custom YAML parser)
    |   |-- tool-use.ts           #   PreToolUse: silent usage logging
    |   |-- context-checkpoint.ts #   PreToolUse: compact detection + recovery
    |   |-- librarian-check.ts    #   PreToolUse: library-first verification
    |   |-- backup-monitor.ts     #   PostToolUse: auto-backup trigger
    |   |-- doc-sync.ts           #   PostToolUse: project-knowledge staleness tracking
    |   |-- session-end.ts        #   Stop: full extraction + graph enrichment
    |   |-- package.json          #   Dependencies: @huggingface/transformers, minisearch, zod
    |   |-- lib/                  #   Shared modules
    |       |-- knowledge-graph.ts  # HoraGraph: CRUD, semantic search, bi-temporal facts,
    |       |                       #   reconsolidation, dedup, memory_type classification
    |       |-- embeddings.ts       # Local ONNX embeddings (all-MiniLM-L6-v2, 384-dim)
    |       |-- graph-builder.ts    # LLM extraction via claude -p + embedding computation
    |       |-- graph-migration.ts  # Lazy migration of existing sessions to graph
    |       |-- memory-tiers.ts     # T1/T2/T3 lifecycle, promotion, GC, insights
    |       |-- session-paths.ts    # Session-scoped file paths (isolation)
    |       |-- agentic-retrieval.ts # Task classification → query gen → hybrid search → chunking
    |       |-- activation-model.ts # ACT-R cognitive activation (decay, retrieval boost)
    |       |-- hybrid-search.ts    # BM25 (minisearch) + semantic + RRF fusion
    |       |-- dream-cycle.ts      # Hippocampal replay: episode consolidation + distillation
    |       |-- graph-communities.ts # Community detection (BFS + label propagation)
    |       |-- schemas.ts          # Zod runtime validation for all JSONL structures
    |       |-- memory-metrics.ts   # Quality metrics (coverage, dedup ratio, activation avg)
    |       |-- signal-tracker.ts   # Cross-session preference crystallization
    |
    |-- agents/                   # 7 specialized agents
    |   |-- architect.md          #   Opus: architecture, system design
    |   |-- executor.md           #   Sonnet: implementation, debug
    |   |-- researcher.md         #   Sonnet: research, analysis
    |   |-- reviewer.md           #   Haiku: review, validation
    |   |-- synthesizer.md        #   Haiku: multi-source aggregation
    |   |-- backup.md             #   Haiku: git backup
    |   |-- librarian.md          #   Haiku: library-first verification
    |
    |-- skills/                   # 12 skills (directory/SKILL.md format)
    |   |-- hora-design/          #   Anti-AI web design (Dieter Rams, OKLCH)
    |   |-- hora-forge/           #   Zero Untested Delivery (NASA, TDD, 7 gates)
    |   |-- hora-refactor/        #   Systematic refactoring (Fowler, Feathers)
    |   |-- hora-security/        #   OWASP 2025 audit (CWE, SANS)
    |   |-- hora-perf/            #   Performance (Core Web Vitals, RAIL)
    |   |-- hora-vision/          #   Visual UI audit (23-point checklist)
    |   |-- hora-dashboard/       #   Analytics dashboard
    |   |-- hora-plan/            #   Planning with ISC
    |   |-- hora-autopilot/       #   Autonomous execution
    |   |-- hora-parallel-code/   #   Multi-agent codebase
    |   |-- hora-parallel-research/ # Multi-angle research
    |   |-- hora-backup/          #   Immediate backup
    |
    |-- dashboard/                # Standalone analytics + neural visualization app
    |   |-- package.json          #   React 19, Vite 6, Recharts, react-force-graph-2d
    |   |-- vite.config.ts        #   Custom HMR plugin with chokidar file watching
    |   |-- src/
    |   |   |-- App.tsx           #   Main app with 7-section routing
    |   |   |-- NeuralPage.tsx    #   Full-page interactive knowledge graph
    |   |   |-- ChatView.tsx      #   Complete CLI transcript viewer
    |   |   |-- MemoryHealth.tsx  #   T1/T2/T3 memory tier visualization
    |   |   |-- ProfileSidebar.tsx #  Navigation + profile info
    |   |   |-- ThreadHistory.tsx #   Cross-session thread browser
    |   |   |-- SessionsTable.tsx #   Session archives table
    |   |   |-- SentimentChart.tsx #  Sentiment over time
    |   |   |-- ToolTimeline.tsx  #   7-day tool usage chart
    |   |   |-- SecurityEvents.tsx #  Security event viewer
    |   |   |-- ProjectPanel.tsx  #   Right panel (checkpoint, knowledge)
    |   |   |-- StatCard.tsx      #   Reusable stat card component
    |   |   |-- types.ts          #   Shared TypeScript interfaces
    |   |-- lib/
    |   |   |-- collectors.ts     #   MEMORY/ reader (graph, transcripts, threads)
    |   |-- scripts/
    |       |-- collect-data.ts   #   CLI data collection
    |
    |-- MEMORY/                   # Persistent memory (empty at start)
        |-- PROFILE/              #   identity.md, projects.md, preferences.md, vocabulary.md
        |-- LEARNING/
        |   |-- FAILURES/         #   Extracted errors and lessons
        |   |-- ALGORITHM/        #   Sentiment patterns
        |   |-- INSIGHTS/         #   T2/T3 aggregated insights
        |   |-- SYSTEM/           #   Technical issues
        |-- SESSIONS/             #   Session archives
        |-- SECURITY/             #   Security audit trail
        |-- STATE/                #   Thread state, session names
        |-- GRAPH/                #   Knowledge graph (entities, facts, episodes, activation log, communities)
        |-- WORK/                 #   Working memory
```

---

## What HORA Provides

| Capability | Details |
|:---|:---|
| **Knowledge graph** | Bi-temporal, Tulving-classified (semantic/episodic/procedural), reconsolidation, dream cycle |
| **Vector embeddings** | Local ONNX (all-MiniLM-L6-v2, 384-dim), zero API cost |
| **Hybrid search** | Semantic + BM25 (minisearch) + RRF fusion + BFS + Baddeley chunking |
| **ACT-R activation** | Adaptive decay replaces fixed expiry — frequent facts survive, unused decay |
| **Memory tiers** | T1 (24h) → T2 (ACT-R adaptive) → T3 (permanent), auto-promotion, GC + dream cycle |
| **Periodic re-extraction** | Every 20 minutes during long sessions |
| **Layered security** | 3 layers + audit trail (17 blocked, 18 confirm, 6 alert patterns) |
| **Self-learning memory** | Hybrid env + linguistic extraction, silent |
| **Cross-session continuity** | Full thread history, project-scoped |
| **Neural dashboard** | Interactive graph, chat viewer, memory health, 7 sections |
| **Auto project audit** | Full codebase analysis on first session |
| **Web/SaaS conventions** | TypeScript/React stack, library-first, anti "AI look" design |
| **Pre-edit snapshots** | Every edit, project-scoped, with or without git |
| **Auto backup** | Mirror branch or local bundle |
| **Compact recovery** | Auto-detection + project-scoped checkpoint injection |
| **Session isolation** | Concurrent sessions, project-scoped checkpoints |
| **12 skills** | Design, Forge, Refactor, Security, Perf, Vision, Dashboard, Plan, Autopilot, Parallel-Code, Parallel-Research, Backup |
| **7 agents** | Across 3 models (Opus, Sonnet, Haiku) |
| **Ghost failure detection** | Built into the Algorithm (AUDIT step) |
| **Cross-platform** | macOS / Linux / Windows |

---

## Customization

### Security rules

Edit `~/.claude/.hora/patterns.yaml`:

```yaml
blocked:
  - pattern: "rm -rf /"
    reason: "System destruction"
  - pattern: "your-custom-pattern"
    reason: "Your reason"

confirm:
  - pattern: "git push --force"
    reason: "Force push — may lose commits"

alert:
  - pattern: "sudo"
    reason: "Elevated privileges"
```

### Agents

Edit files in `~/.claude/agents/`. Each `.md` file defines the model, authorized tools, and protocol.

### Skills

Edit files in `~/.claude/skills/`. Each skill follows the directory format with `SKILL.md`.

### Spinner verbs

Edit the `spinnerVerbs` section in `~/.claude/settings.json`.

---

## Windows Notes

### How it works

Claude Code on Windows uses **Git for Windows** ([download](https://git-scm.com/download/win)) for shell operations:

- **Hooks** (TypeScript) execute via **cmd.exe** using `npx tsx` — NOT through Git Bash
- **Bash tool** uses Git Bash (controlled by `CLAUDE_CODE_GIT_BASH_PATH`)
- **Statusline** runs through Git Bash

### What install.ps1 handles automatically

| Step | What it does |
|:---|:---|
| **Git Bash detection** | Finds `bash.exe` in standard locations, rejects WSL bash |
| **CLAUDE_CODE_GIT_BASH_PATH** | Set permanently (User env var) |
| **jq installation** | Auto-installs via `winget` if missing |
| **tsx installation** | Auto-installs via `npm install -g tsx` if missing |
| **Orphan hook cleanup** | Removes hooks from other frameworks pointing to non-existent files |
| **Path resolution** | Replaces `~` and `$HOME` with absolute `C:/Users/...` paths |

### Switching from another framework

If you previously used another Claude Code framework, HORA automatically detects and removes orphan hooks — no need to manually delete settings before installing.
