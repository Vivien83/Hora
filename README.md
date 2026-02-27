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
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#1-knowledge-graph-neuroscience-inspired">Knowledge Graph</a> &bull;
  <a href="#15-dashboard-v3--real-time--neural--telemetry">Dashboard</a> &bull;
  <a href="#skills--agents">Skills & Agents</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#16-websaas-conventions-built-in">Web/SaaS Stack</a> &bull;
  <a href="#customization">Customization</a> &bull;
  <a href="MEMORY.md"><strong>Memory System Deep Dive</strong></a>
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

> **Deep dive:** The memory system is documented exhaustively in **[MEMORY.md](MEMORY.md)** — every algorithm, every formula, every data structure, every threshold. What follows here is a summary.

### 1. Knowledge Graph (Neuroscience-inspired)

HORA builds a **bi-temporal knowledge graph** inspired by [Graphiti](https://github.com/getzep/graphiti) and neuroscience (CLS theory, ACT-R, Tulving's memory taxonomy) — automatically, at the end of every session.

```
Session ends --> claude -p extracts entities + facts + contradictions
            --> @huggingface/transformers computes 384-dim embeddings (local ONNX)
            --> Graph updated with bi-temporal metadata
            --> Dream cycle consolidates episodes into semantic knowledge
            --> Next session: hybrid search (semantic + BM25) retrieves relevant context
```

| Layer | What | Example |
|:---|:---|:---|
| **Entities** (nodes) | 10 types: project, tool, error, preference, concept, person, file, library, pattern, decision | `project:hora`, `tool:react-force-graph` |
| **Facts** (edges) | 34 typed relations in 6 categories (structural, technological, learning, experience, actor, conceptual) + Tulving classification (semantic/episodic/procedural) | `semantic`: "HORA uses TypeScript", `procedural`: "When bug auth → check Better-Auth" |
| **Episodes** (raw) | Session references, consolidated by dream cycle | `session:a1b2c3d4 → 5 entities, 8 facts` |

**Key capabilities:** bi-temporality (4 timestamps per fact — time travel queries), reconsolidation (facts enriched on recall, max 5 history versions), deduplication (Jaccard > 0.85 + cosine > 0.92), community detection (BFS + label propagation), dream cycle (hippocampal replay — consolidates episodes into semantic facts every 6h).

**Zero cost:** extraction via `claude -p` (subscription), embeddings via local ONNX (MiniLM-L6-v2, 22MB), BM25 via minisearch (15KB). Everything local.

> **Full details:** [MEMORY.md — Knowledge Graph](MEMORY.md#knowledge-graph)

---

### 2. Agentic Retrieval (Hybrid Search)

On **every user message**, a 9-step pipeline: classify task → generate 3-5 queries → embed → semantic search + BM25 → RRF fusion → BFS expansion → ACT-R boost → Baddeley chunking (max 5 groups) → budget trim.

```
Semantic (cosine × activation × confidence × recency)  ─┐
                                                          ├── RRF (k=60, w=0.7/0.3)
BM25 (fuzzy=0.2, prefix=true, boost: desc=2, ent=1.5)  ─┘
```

**Latency:** ~350ms first message (model load), ~50ms after. **Fallback chain:** semantic+BM25 → BM25-only → classic injection → no injection.

> **Full details:** [MEMORY.md — Agentic Retrieval](MEMORY.md#agentic-retrieval)

---

### 3. Memory Tiers (T1/T2/T3) + ACT-R Activation

| Tier | Retention | Brain Analogy | Storage |
|:---|:---|:---|:---|
| **T1** (short) | 24 hours | Prefrontal cortex working buffer | STATE/ |
| **T2** (medium) | Adaptive (ACT-R) | Hippocampal episodic traces | SESSIONS/, LEARNING/ |
| **T3** (long) | Permanent | Neocortical semantic knowledge | PROFILE/, INSIGHTS/ |

**ACT-R formula:** `Activation = ln(Σ(t_i^{-0.5})) × emotionalWeight`. Threshold: -2.0. Single access survives ~45 days; 3 accesses in a week → months. Emotional weight (corrections/failures) = 1.5×.

**GC (every 6h):** expire T2 → promote to T3 (3+ occurrences) → ACT-R supersession → dream cycle. PID-based lock, 60s timeout.

> **Full details:** [MEMORY.md — Memory Tiers](MEMORY.md#memory-tiers) | [MEMORY.md — Activation Model](MEMORY.md#activation-model) | [MEMORY.md — Dream Cycle](MEMORY.md#dream-cycle)

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

At the end of every significant session (3+ messages), HORA silently extracts structured knowledge via a 6-phase pipeline:

| Phase | What | Output |
|:---|:---|:---|
| **Thread consolidation** | All user/assistant exchanges from transcript | `STATE/session-thread.json` |
| **Environment profile** | Git config, package.json deps, file extensions | `PROFILE/identity.md` |
| **Linguistic profile** | Language detection, vocabulary, preferences | `PROFILE/preferences.md` |
| **Sentiment** | Lexical scoring (1-5) per session | `LEARNING/ALGORITHM/sentiment-log.jsonl` |
| **Failures** | Error patterns, incorrect assumptions | `LEARNING/FAILURES/failures-log.jsonl` |
| **Knowledge graph** | Entity/fact extraction via `claude -p` + embeddings | `GRAPH/` |

**Signal tracker:** Preference signals ("toujours X", "jamais Y", corrections) are extracted deterministically (34 regex patterns FR+EN) and crystallized into T3 when seen across 3+ unique sessions.

**Everything is silent.** HORA never interrupts your flow. You won't even notice it's learning.

> **Full details:** [MEMORY.md — Self-Learning Extraction](MEMORY.md#self-learning-extraction) | [MEMORY.md — Signal Tracker](MEMORY.md#signal-tracker)

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

### 15. Dashboard (v3 — Real-time + Neural + Telemetry)

A standalone React 19 + Vite 6 app in `claude/dashboard/` that visualizes all HORA data in real-time.

```bash
cd claude/dashboard && npm install && npm run dev
# Opens at http://localhost:3847 — updates automatically via HMR
```

**9 navigation sections:**

| Section | What it shows |
|:---|:---|
| **Overview** | 6 stat cards, sessions table, sentiment chart, recent thread |
| **Project** | Checkpoint, project knowledge |
| **Memory** | Memory health (T1/T2/T3 bars), memory diff, user profile, thread history, failures |
| **Neural** | Neuroscience-inspired tier map + full knowledge graph (see below) |
| **Chat** | LLM-powered memory chat (Ask HORA) + CLI transcript viewer |
| **Security** | Security events (blocks, confirms, alerts) |
| **Tools** | Tool usage timeline (7-day bar chart) |
| **Telemetry** | Hook call stats, top tools chart, hourly heatmap, daily sparkline |
| **Replay** | Session archive browser with sentiment badges and failure details |

#### Neural Page

Two visualization modes:

**1. Tier Map** (`NeuralMemoryMap.tsx`) — Neuroscience-inspired 3-tier visualization:
- 8 memory zone nodes (T1=cyan, T2=blue, T3=purple)
- 14 synaptic connections showing memory flow (encoding, consolidation, retrieval)
- Node size ∝ `sqrt(items)`, breathing animation based on freshness
- Particle animation along edges for active data flow
- d3-force physics: charge(-120), link(80px), radial(50px for isolated nodes), center(0.05)

**2. Knowledge Graph** (`NeuralPage.tsx`) — Full interactive graph:
- Nodes = entities (9 color-coded types), size = degree centrality
- Edges = facts (34 relation types), thickness = confidence, particles on recent facts (< 24h)
- Click node → detail panel with timeline + connected facts
- Click edge → relation details, confidence, metadata
- Search bar + temporal slider + recenter button
- Breathing animation on entities seen in last 48h

#### Chat View

- **Ask HORA:** LLM-powered queries against the knowledge graph (agentic retrieval + context injection)
- **Transcripts:** Complete CLI transcript viewer with project-scoped sessions, role badges, search, collapsible messages

#### Memory Health & Diff

- T1/T2/T3 bar charts with entry counts, KB sizes, and health alerts
- Memory diff between sessions: change score (0-100), entities/facts added/removed/superseded
- Last GC timestamp, promotion stats

**Real-time architecture:** Vite plugin with chokidar watches `~/.claude/MEMORY/` and `<project>/.hora/`, debounces 500ms, pushes updates via HMR WebSocket. Auto-embeds new graph entries on load.

> **Full memory architecture:** [MEMORY.md — Neural Dashboard](MEMORY.md#neural-dashboard)

---

### 16. Web/SaaS Conventions (Built-in)

HORA ships with **opinionated conventions** for modern web/SaaS development. These are enforced automatically through the CLAUDE.md guidelines.

#### Mandatory algorithm

The HORA algorithm (EXPLORE → PLAN → AUDIT → CODE → COMMIT) runs on **every task**, with depth proportional to complexity:

| Complexity | Algorithm depth |
|:---|:---|
| Trivial (typo, 1-3 lines) | EXPLORE (implicit) → CODE |
| Medium (feature, bug) | EXPLORE → AUDIT → CODE |
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

### 17. Skill Auto-Suggest

HORA deterministically suggests the optimal skill based on message keywords + 7-day tool usage history:

```
User: "refactore le module auth"  →  Suggestion: /hora-refactor (score: 0.6)
User: "compare les ORM"           →  Suggestion: /hora-parallel-research (score: 0.3)
```

8 skill patterns, scoring: `keywordHits × 0.3 + sessionToolMatch × 0.3 + weeklyPattern × 0.1`, threshold ≥ 0.3.

---

### 18. Context Budget Optimizer

Adapts injection sizes based on remaining context to prevent overflow:

| Context Used | Level | Graph | Thread | Sections |
|:---|:---|:---:|:---:|:---:|
| < 60% | **full** | Yes | 5000 chars | 400 chars |
| 60-80% | **reduced** | Yes | 2500 chars | 280 chars |
| 80-90% | **minimal** | No | 500 chars | 150 chars |
| > 90% | **emergency** | No | None | 80 chars |

> **Full details:** [MEMORY.md — Context Injection](MEMORY.md#context-injection)

---

### 19. Cross-Project Awareness

Discovers other known projects and computes relevance based on shared npm dependencies (60% weight) and shared graph entities (40% weight). Results cached 1 hour.

```
Working on hora-engine:
  → hora (relevance: 0.36) — shared: typescript, zod, drizzle-orm
  → spotter (relevance: 0.24) — shared: react, vite
```

---

### 20. Memory Health Check

Diagnostic skill (`/hora-health`) with 8 checks: T1/T2/T3 balance, embedding coverage, GC status, graph stats, activation distribution, and disk usage.

---

### 21. Hook Telemetry Dashboard

Dashboard page with 4 stat cards (sessions, calls, distinct tools, peak hour) + 3 animated Recharts charts (top 10 tools, hourly heatmap, daily sparkline). Data from `.tool-usage.jsonl`.

---

### 22. Memory Diff

Compares graph snapshots between sessions. Change score 0-100 with color coding: 0=none, ≤10=minor, ≤30=moderate, ≤60=significant, >60=major. Tracks entities added/removed and facts added/superseded.

---

### 23. Session Replay

Two-pane viewer: session list (date, summary, size) on the left, full session content with sentiment badge (1-5) and failures on the right. Reads from `SESSIONS/*.md`.

---

### 24. Additional Features

| Feature | Description |
|:---|:---|
| **Doc Sync** | Tracks 5+ structuring file changes, reminds to update `project-knowledge.md` (7-day staleness check) |
| **Librarian Agent** | Enforces library-first at file creation time in `utils/`, `helpers/`, `lib/` |
| **Sentiment Predict** | Lexical scoring (1-5) with trend detection (3 messages ≥ 3.5 monotonic = reinforced frustration) |
| **Vision Audit** | 23-point multimodal screenshot checklist across 5 categories |
| **Custom Spinners** | 50 French messages replacing generic Claude Code spinners |
| **Tool Analytics** | Every tool call logged to `MEMORY/.tool-usage.jsonl`, 7-day retention, monthly aggregation |
| **Algorithm Tracker** | Detects HORA phases (EXPLORE/PLAN/AUDIT/CODE/COMMIT), validates transitions, classifies complexity |

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
| `/hora-health` | Memory health diagnostics — 8 checks on tiers, embeddings, GC | T1/T2/T3 balance, coverage, disk |
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
  entities.jsonl         # {id, type, name, properties, embedding: null, created_at, last_seen}
  facts.jsonl            # {id, source, target, relation, description, embedding: null,
                         #  valid_at, invalid_at, created_at, expired_at, confidence,
                         #  metadata: {memory_type, reconsolidation_count, history[]}}
  episodes.jsonl         # {id, source_type, source_ref, timestamp, entities[], facts[],
                         #  consolidated?}
  activation-log.jsonl   # {factId, accessTimes[], emotionalWeight, lastActivation}
  communities.jsonl      # {id, name, entities[], facts[], summary, updated_at}
  embeddings.bin         # Binary Float32Array (384 floats per vector, concatenated)
  embedding-index.jsonl  # {id, type: "entity"|"fact", offset, length} — index into embeddings.bin
```

Embeddings are stored in a **binary file** (`embeddings.bin`) for performance, indexed by `embedding-index.jsonl`. JSONL fields contain `embedding: null` — the real vectors live in the binary file. Estimated volume after 6 months: ~2 MB. Loadable in < 200ms.

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
  |                            routing hints, thread continuity, checkpoint reminder,
  |                            sentiment analysis, skill auto-suggest, context budget,
  |                            cross-project awareness, steering rules (rotating batch)
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
|-- README.md                        # This file
|-- MEMORY.md                        # Deep technical documentation of the memory system
|-- install.sh                       # Installer (macOS/Linux/Windows via Git Bash)
|-- install.ps1                      # Windows PowerShell entry point
|-- .gitattributes                   # Forces LF line endings
|-- .gitignore                       # Ignores **/.hora/ runtime files
|-- scripts/
|   |-- seed-graph.mjs               # One-shot graph seeding from existing memory
|
|-- claude/                          # SOURCE — everything deployed to ~/.claude/
    |
    |-- CLAUDE.md                    # The Algorithm + Stack + Design + Security
    |-- settings.json                # Hooks + statusLine + spinnerVerbs
    |-- statusline.sh                # Rich status bar (3 responsive modes)
    |
    |-- .hora/
    |   |-- patterns.yaml            # Security rules (17 blocked, 18 confirm, 6 alert)
    |
    |-- hooks/                       # 10 TypeScript lifecycle hooks
    |   |-- prompt-submit.ts         #   UserPromptSubmit: knowledge graph injection, context budget,
    |   |                            #   skill auto-suggest, cross-project, routing, sentiment, steering
    |   |-- hora-session-name.ts     #   UserPromptSubmit: auto session naming
    |   |-- snapshot.ts              #   PreToolUse: pre-edit file backup
    |   |-- hora-security.ts         #   PreToolUse: security validation (custom YAML parser)
    |   |-- tool-use.ts              #   PreToolUse: silent usage logging + agent/task tracking
    |   |-- context-checkpoint.ts    #   PreToolUse: compact detection + recovery (≥40% drop)
    |   |-- librarian-check.ts       #   PreToolUse: library-first verification
    |   |-- backup-monitor.ts        #   PostToolUse: auto-backup trigger
    |   |-- doc-sync.ts              #   PostToolUse: project-knowledge staleness tracking
    |   |-- session-end.ts           #   Stop: full 6-phase extraction + graph enrichment
    |   |-- package.json             #   Dependencies: @huggingface/transformers, minisearch, zod
    |   |-- lib/                     #   Shared modules (~9,500 LOC)
    |       |-- knowledge-graph.ts     # HoraGraph: CRUD, semantic search, bi-temporal facts,
    |       |                          #   reconsolidation, dedup, memory_type classification (1017 LOC)
    |       |-- agentic-retrieval.ts   # 9-step pipeline: classify → query → hybrid search → chunk (703 LOC)
    |       |-- memory-tiers.ts        # T1/T2/T3 lifecycle, promotion, GC, insights (801 LOC)
    |       |-- graph-builder.ts       # LLM extraction via claude -p + embedding computation (525 LOC)
    |       |-- signal-tracker.ts      # Cross-session preference crystallization (468 LOC)
    |       |-- relation-ontology.ts   # 34 relations in 6 categories + legacy mapping (255 LOC)
    |       |-- dream-cycle.ts         # Hippocampal replay: episode consolidation + distillation (239 LOC)
    |       |-- graph-communities.ts   # Community detection: BFS + label propagation (226 LOC)
    |       |-- algorithm-tracker.ts   # HORA phase detection + complexity classification (221 LOC)
    |       |-- graph-migration.ts     # Lazy migration of existing sessions to graph (203 LOC)
    |       |-- session-paths.ts       # Session-scoped file paths (isolation) (199 LOC)
    |       |-- skill-suggest.ts       # Deterministic skill auto-suggestion (168 LOC)
    |       |-- hybrid-search.ts       # BM25 (minisearch) + semantic + RRF fusion (152 LOC)
    |       |-- activation-model.ts    # ACT-R cognitive activation (decay, retrieval boost) (150 LOC)
    |       |-- memory-metrics.ts      # Quality metrics (coverage, dedup ratio, activation avg) (140 LOC)
    |       |-- schemas.ts             # Zod runtime validation for all JSONL structures (136 LOC)
    |       |-- cross-project.ts       # Cross-project dependency + entity detection (250 LOC)
    |       |-- context-budget.ts      # Dynamic injection sizing by context % (103 LOC)
    |       |-- embeddings.ts          # Local ONNX embeddings (all-MiniLM-L6-v2, 384-dim) (99 LOC)
    |       |-- identity.ts            # Central identity loader (settings.json) (204 LOC)
    |       |-- paths.ts               # Path resolution with env expansion (76 LOC)
    |       |-- time.ts                # Timezone-aware timestamps (138 LOC)
    |
    |-- agents/                      # 7 specialized agents
    |   |-- architect.md             #   Opus: architecture, system design
    |   |-- executor.md              #   Sonnet: implementation, debug
    |   |-- researcher.md            #   Sonnet: research, analysis
    |   |-- reviewer.md              #   Haiku: review, validation
    |   |-- synthesizer.md           #   Haiku: multi-source aggregation
    |   |-- backup.md                #   Haiku: git backup
    |   |-- librarian.md             #   Haiku: library-first verification
    |
    |-- skills/                      # 13 skills (directory/SKILL.md format)
    |   |-- hora-design/             #   Anti-AI web design (Dieter Rams, OKLCH)
    |   |-- hora-forge/              #   Zero Untested Delivery (NASA, TDD, 7 gates)
    |   |-- hora-refactor/           #   Systematic refactoring (Fowler, Feathers)
    |   |-- hora-security/           #   OWASP 2025 audit (CWE, SANS)
    |   |-- hora-perf/               #   Performance (Core Web Vitals, RAIL)
    |   |-- hora-vision/             #   Visual UI audit (23-point checklist)
    |   |-- hora-health/             #   Memory health diagnostics (8 checks)
    |   |-- hora-dashboard/          #   Analytics dashboard
    |   |-- hora-plan/               #   Planning with ISC
    |   |-- hora-autopilot/          #   Autonomous execution
    |   |-- hora-parallel-code/      #   Multi-agent codebase
    |   |-- hora-parallel-research/  #   Multi-angle research
    |   |-- hora-backup/             #   Immediate backup
    |
    |-- dashboard/                   # Standalone analytics + neural visualization app
    |   |-- package.json             #   React 19, Vite 6, Recharts, react-force-graph-2d
    |   |-- vite.config.ts           #   Custom HMR plugin with chokidar file watching
    |   |-- src/
    |   |   |-- App.tsx              #   Main app with 9-section routing
    |   |   |-- NeuralPage.tsx       #   Full-page interactive knowledge graph (9 entity types)
    |   |   |-- NeuralMemoryMap.tsx   #   Neuroscience-inspired 3-tier visualization
    |   |   |-- ChatView.tsx         #   Complete CLI transcript viewer
    |   |   |-- MemoryChat.tsx       #   LLM-powered memory chat (Ask HORA)
    |   |   |-- MemoryHealth.tsx     #   T1/T2/T3 memory tier visualization
    |   |   |-- MemoryDiff.tsx       #   Graph diff between sessions (change score 0-100)
    |   |   |-- HookTelemetry.tsx    #   Hook stats, top tools chart, hourly heatmap
    |   |   |-- SessionReplay.tsx    #   Session archive browser with sentiment badges
    |   |   |-- ProfileSidebar.tsx   #   Navigation (9 sections) + profile info
    |   |   |-- ThreadHistory.tsx    #   Cross-session thread browser
    |   |   |-- SessionsTable.tsx    #   Session archives table
    |   |   |-- SentimentChart.tsx   #   Sentiment over time
    |   |   |-- ToolTimeline.tsx     #   7-day tool usage chart
    |   |   |-- SecurityEvents.tsx   #   Security event viewer
    |   |   |-- ProjectPanel.tsx     #   Right panel (checkpoint, knowledge)
    |   |   |-- StatCard.tsx         #   Reusable stat card component
    |   |   |-- types.ts             #   Shared TypeScript interfaces
    |   |   |-- d3-force-3d.d.ts     #   Type declarations for d3-force-3d
    |   |-- lib/
    |   |   |-- collectors.ts        #   MEMORY/ reader (graph, transcripts, threads)
    |   |-- scripts/
    |       |-- collect-data.ts      #   CLI data collection
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
        |-- GRAPH/                #   Knowledge graph (entities, facts, episodes, activation log, communities,
        |                        #     embeddings.bin, embedding-index.jsonl)
        |-- WORK/                 #   Working memory
```

---

## What HORA Provides

| Capability | Details |
|:---|:---|
| **Knowledge graph** | Bi-temporal, 34 relations in 6 categories, Tulving-classified (semantic/episodic/procedural), reconsolidation, dream cycle, community detection |
| **Vector embeddings** | Local ONNX (all-MiniLM-L6-v2, 384-dim), binary storage (embeddings.bin), zero API cost |
| **Hybrid search** | Semantic + BM25 (minisearch) + RRF fusion (k=60, w=0.7/0.3) + BFS depth 2 + Baddeley chunking (max 5 groups) |
| **ACT-R activation** | `ln(Σ(t_i^{-0.5})) × emotionalWeight`, threshold -2.0, emotional boost 1.5× for corrections |
| **Memory tiers** | T1 (24h) → T2 (ACT-R adaptive) → T3 (permanent), GC every 6h + dream cycle |
| **Signal tracker** | 34 regex patterns, preference crystallization (3+ sessions → T3), graph mining |
| **Context budget** | 4-level adaptive injection (full/reduced/minimal/emergency) based on context % |
| **Skill auto-suggest** | 8 skill patterns, deterministic scoring (keywords + tool history), threshold ≥ 0.3 |
| **Cross-project** | Shared dependency detection (60%) + entity matching (40%), 1h cache |
| **Periodic re-extraction** | Every 20 minutes during long sessions |
| **Layered security** | 3 layers + audit trail (17 blocked, 18 confirm, 6 alert patterns) |
| **Self-learning memory** | 6-phase extraction: thread, env profile, linguistic, sentiment, failures, graph |
| **Cross-session continuity** | Full thread history, project-scoped, 20 recent + 100 archive |
| **Neural dashboard** | 9 sections: tier map, knowledge graph, memory chat, telemetry, session replay, diff |
| **Auto project audit** | Full codebase analysis on first session |
| **Web/SaaS conventions** | TypeScript/React stack, library-first, anti "AI look" design |
| **Pre-edit snapshots** | Every edit, project-scoped, with or without git |
| **Auto backup** | Mirror branch or local bundle, 15min/3-file triggers |
| **Compact recovery** | ≥40% drop detection + project-scoped checkpoint injection |
| **Session isolation** | Concurrent sessions, project-scoped checkpoints, path traversal protection |
| **13 skills** | Design, Forge, Refactor, Security, Perf, Vision, Health, Dashboard, Plan, Autopilot, Parallel-Code, Parallel-Research, Backup |
| **7 agents** | Across 3 models (Opus, Sonnet, Haiku) |
| **~9,500 LOC** | 22 lib modules + 10 hooks + 18 dashboard components |
| **Ghost failure detection** | Built into the Algorithm (AUDIT step) |
| **Cross-platform** | macOS / Linux / Windows |

> **Full memory system documentation:** **[MEMORY.md](MEMORY.md)**

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
