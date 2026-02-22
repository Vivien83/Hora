<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-Native-blueviolet?style=for-the-badge&logo=anthropic" alt="Claude Code Native">
  <img src="https://img.shields.io/badge/Platform-macOS_|_Linux_|_Windows-blue?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
  <img src="https://img.shields.io/badge/Dependencies-tsx_only-orange?style=for-the-badge" alt="Dependencies">
  <img src="https://img.shields.io/badge/Config-Zero-brightgreen?style=for-the-badge" alt="Zero Config">
</p>

<h1 align="center">HORA</h1>
<h3 align="center">Hybrid Orchestrated Reasoning Architecture</h3>

<p align="center">
  <strong>A self-learning AI system for Claude Code.</strong><br>
  Starts empty. Builds itself through usage. Opinionated TypeScript/React stack. Library-first.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> &bull;
  <a href="#-features">Features</a> &bull;
  <a href="#-how-it-works">How It Works</a> &bull;
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
Session 2:  Reloaded   --> Hora knows who you are + what you were doing
Session N:  Rich       --> Increasingly relevant responses, your vocabulary, your patterns
```

### What makes it different

| | Without HORA | With HORA |
|---|---|---|
| **New session** | "I have no context" | "Last time we were working on X. Continue?" |
| **New project** | Re-explore the codebase every time | Auto-audit stored in `.hora/project-knowledge.md` |
| **Dangerous command** | Executes silently | Blocked or confirmed before execution |
| **Context compaction** | Lost train of thought | Auto-detected, checkpoint injected |
| **File edited by mistake** | Hope you have git | Snapshot saved automatically before every edit |
| **Multi-file refactor** | One file at a time | Parallel agents, coordinated execution |
| **Library choice** | "Let me write a custom date picker" | Library-first: use battle-tested packages |
| **UI design** | Generic AI-generated look | Professional design guidelines enforced |

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
bash install.sh              # Full install
bash install.sh --dry-run    # Preview what would happen (no changes)
bash install.sh --restore    # Rollback to pre-install state
```

### What install.sh does

1. **Backs up** your existing Claude Code data (sessions, todos, history, credentials)
2. **Creates** the `~/.claude/` tree (MEMORY/, hooks/, agents/, skills/, .hora/)
3. **Merges** CLAUDE.md (preserves your existing content, inserts HORA block between markers)
4. **Merges** settings.json (merges without overwriting third-party hooks)
5. **Copies** hooks, agents, skills, security patterns, statusline
6. **Cleans orphan hooks** (removes hooks pointing to non-existent files from other frameworks)
7. **Resolves paths** on Windows (`~` and `$HOME` replaced with absolute `C:/Users/...` paths)
8. **Preserves** your MEMORY/ profile if already populated (never resets)
9. **Verifies** Claude data integrity after installation

> In case of error: `bash install.sh --restore` restores the backup.

---

## Features

### 1. Layered Security

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

### 2. Self-Learning Memory

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

#### Output format

Every data point is tagged with its source for traceability:

```markdown
## Identite
- Nom: Vivien MARTIN [env:git-config]
- GitHub: Vivien83 [env:git-remote]

## Preferences
- Langue: francais [transcript]
- Tech: TypeScript [env:package.json]
```

#### Additional extractions

| What | Format | Storage |
|:---|:---|:---|
| **Errors & Lessons** | JSONL (user messages only, conversational patterns, max 5/session) | `LEARNING/FAILURES/failures-log.jsonl` |
| **Sentiment** | JSONL (one line per session) | `LEARNING/ALGORITHM/sentiment-log.jsonl` |
| **Session Archive** | Markdown (summary + first 5000 chars) | `SESSIONS/` |

**Everything is silent.** HORA never interrupts your flow. You won't even notice it's learning.

---

### 3. Cross-Session Continuity

HORA maintains conversation threads across sessions using **deferred pairing**:

```
Session N:
  1. prompt-submit.ts saves the user message (pending)
  2. User works normally
  3. session-end.ts saves the assistant's last response summary

Session N+1:
  1. prompt-submit.ts pairs pending messages with responses
  2. Injects the last 10 exchanges + 3 most recent sessions
  3. Claude sees the full context from the very first message
```

#### Project-scoped context

Session history is **filtered by project**. Each project gets a stable ID stored in `.hora/project-id` — persists even if the folder is renamed. When you switch projects, you only see context from that project.

```
You: "hey"
HORA: "Hey! Last time we were refactoring the auth module.
       The middleware was done but we still had 2 tests failing. Continue?"
```

---

### 4. Automatic Session Naming

Every session gets a deterministic name from the first prompt:

```
"Refonte page conges"     -->  "Refonte Conges Session"
"Fix the login bug"       -->  "Login Session"
"Implement dark mode"     -->  "Dark Mode Session"
```

No AI inference — fast regex extraction. Stored in `MEMORY/STATE/session-names.json`.

---

### 5. Pre-Edit Snapshots

Every `Write` / `Edit` / `MultiEdit` saves the file **BEFORE** modification.

```
.hora/snapshots/
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

**How to restore:**
```bash
# Find the snapshot
grep "filename" ~/.claude/.hora/snapshots/manifest.jsonl | tail -1

# Read the backup
cat ~/.claude/.hora/snapshots/2026-02-20/10-32-15-042_auth-middleware.ts.bak
```

---

### 6. Automatic Backup

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

**Restore from backup:**

```bash
# From mirror branch (GitHub)
git log hora/backup/main --oneline
git checkout hora/backup/main -- path/to/file.ts

# From local bundle
git bundle verify .hora/backups/LATEST.bundle
git clone .hora/backups/LATEST.bundle ./restored
```

---

### 7. Rich Statusline

A live status bar at the bottom of Claude Code with 3 responsive modes:

```
Full mode (>= 80 cols):
-- | HORA | -------------------------------------------------------
 CONTEXTE : [==============        ] 68%  | 23m
 USAGE    : 5H: 42% (reset 2h31) | WK: 18%
 GIT      : feat/auth | ~/project | Modif:3 Nouv:1 | Backup: R 5min
 COMMITS  : * a1b2c3d Add auth middleware
            * e4f5g6h Fix token validation
            * i7j8k9l Update tests
 SNAP: 12 proteges | MODELE : claude-sonnet-4-5-20250514
---------------------------------------------------------------

Normal mode (55-79 cols):
-- | HORA | --------------------
 CTX: [========    ] 68% | 23m
 5H: 42% (2h31) | WK: 18%
 feat/auth | M:3 N:1 | Bk:R 5m
------------------------------

Compact mode (< 55 cols):
HORA | 68% | 42% | feat/auth
```

| Data | Source | Platform |
|:---|:---|:---|
| Context window % | Claude Code API (JSON stdin) | All |
| Gradient bar | Emerald -> Gold -> Terracotta -> Rose | All |
| API usage (5h/7d) | Anthropic OAuth API via macOS Keychain | macOS only |
| Git status | `git status --porcelain` (cached 15s) | All |
| Last 3 commits | `git log --oneline -3` | All |
| Backup status | `.hora/backup-state.json` | All |
| Snapshot count | `.hora/snapshots/manifest.jsonl` | All |
| Active model | Claude Code API (JSON stdin) | All |

---

### 8. Intelligent Routing

The `prompt-submit` hook detects intent from your message and suggests the right skill:

| Keywords detected | Suggested skill |
|:---|:---|
| refactor, refonte, migration, v2 | `/hora-parallel-code` |
| compare, analyse, research, benchmark | `/hora-parallel-research` |
| plan, architecture, roadmap, strategy | `/hora-plan` |
| from scratch, new project | Branch suggestion |

Skills also trigger via **natural language** — HORA detects the intent, not just keywords.

---

### 9. Context Checkpoint System

When Claude Code compresses context (compaction), HORA detects and recovers automatically:

```
[Before compact]  Statusline writes context % --> hook stores 85%
[Compact event]   Claude Code compresses     --> context drops to ~20%
[Recovery]        Hook detects >40pt drop    --> injects checkpoint + activity log
```

**How it works:**

```
statusline.sh          -->  Writes context-pct.txt (atomic write, >0 only)
                             |
context-checkpoint.ts  -->  PreToolUse: reads context-pct.txt
                             |  Detects >40pt drop from stored state
                             |  Injects recovery via additionalContext
                             |
prompt-submit.ts       -->  At 70% context: asks Claude to write a
                             |  semantic checkpoint to MEMORY/WORK/checkpoint.md
                             |
checkpoint.md          -->  Contains: objective, current state,
                                decisions made, next steps
```

**Ghost failures addressed:** false positives at startup (GF-2), session boundary (GF-3), stale checkpoints (GF-4), race conditions (GF-6), double injection (GF-11), missing file (GF-12).

---

### 10. Auto Project Audit

When HORA detects a **new project** (no `.hora/project-knowledge.md`), it automatically proposes a full codebase audit before any work begins.

```
You open Claude Code in a new project:

HORA: "This project hasn't been audited yet. I'll analyze:
       - Architecture and structure
       - Stack and dependencies
       - Security flaws (with severity levels)
       - Technical debt
       - Good practices already in place

       Want me to run the full audit?"
```

#### Audit output

Results are stored in `.hora/project-knowledge.md` — versioned with git, injected automatically on every future session:

```markdown
# Audit : my-saas-app
> Last updated: 2026-02-20

## Architecture
Next.js 15 App Router, src/ directory, feature-based structure...

## Stack
TypeScript 5.7, React 19, Tailwind CSS 4, Drizzle ORM, PostgreSQL...

## Flaws Identified
| # | Severity | Description | Impact | Solution |
|---|----------|-------------|--------|----------|
| 1 | critical | No rate limiting on auth endpoints | Brute force possible | Add rate-limiter middleware |
| 2 | high     | SQL queries not parameterized in 3 files | SQL injection risk | Migrate to Drizzle prepared statements |
| 3 | medium   | No error boundaries on route layouts | White screen on crash | Add Error Boundary per layout |

## Technical Debt
- 12 `any` types in API layer
- No input validation on 4 form components
- Unused dependencies: lodash, moment (replaced by date-fns)

## Strengths
- Clean separation of concerns (services layer)
- Consistent naming conventions
- Good test coverage on auth module (87%)
```

**Incremental updates:** When Claude discovers new information during a session (new flaw fixed, module added, debt resolved), the relevant section is updated in-place — never a full rewrite.

---

### 11. Web/SaaS Conventions (Built-in)

HORA ships with **opinionated conventions** for modern web/SaaS development. These are enforced automatically through the CLAUDE.md guidelines — not optional suggestions.

#### Mandatory algorithm

The HORA algorithm (EXPLORE → PLAN → AUDIT → CODE → COMMIT) runs on **every task**, with depth proportional to complexity:

| Complexity | Algorithm depth |
|:---|:---|
| Trivial (typo, 1-3 lines) | EXPLORE (2s mental) → CODE |
| Medium (feature, bug) | EXPLORE → PLAN → AUDIT → CODE |
| Complex (multi-file, archi) | EXPLORE → full PLAN with ISC → AUDIT → CODE |
| Critical (auth, data, migration) | Full algorithm + **user validation required** |

Skills are activated automatically or proposed as choices:

- Implementation task → HORA proposes **Normal** vs **Forge** mode
- Multi-file task → `/hora-parallel-code` auto-triggered
- Research/comparison → `/hora-parallel-research` auto-triggered
- Complex end-to-end → `/hora-autopilot` auto-triggered

#### Library-first philosophy

**Never reimplement what a maintained library already does.**

Decision rule:
1. Does it differentiate the product? **No** → use existing library
2. Does the library cover 80%+ of the need? **Yes** → library + light extension
3. Otherwise → build, but document why

Never build from scratch: auth, form validation, dates, drag-and-drop, file upload, payments, charts, rich text editors.

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
| i18n | **next-intl** | — |
| Payments | **@stripe/react-stripe-js** | — |
| Analytics | **PostHog** | — |
| Errors | **@sentry/nextjs** | — |
| Testing | **Vitest + Testing Library + Playwright** | — |

#### Design anti-patterns (banned)

HORA explicitly **bans the generic "AI look"** in all UI work:

| Banned pattern | Replace with |
|:---|:---|
| Blue-violet gradients (Tailwind defaults) | Custom brand hue from OKLCH palette |
| Inter on everything | Geist, Plus Jakarta Sans, Bricolage Grotesque |
| 3 icons in a grid ("features section") | Asymmetric layouts, numbered lists, prose |
| Glassmorphism / blurry cards | Solid surfaces with defined elevation |
| Floating blob SVGs | Intentional geometric elements tied to brand |
| Hero > 100vh with centered H1 + CTA | Show the product in the hero |
| Pure black `#000000` backgrounds | `#0A0A0B` or warm dark neutrals |
| Gradient CTAs with glow effects | Solid primary color, high contrast |

**Design references:** Linear, Vercel, Clerk, Resend — not AI startup templates.

**Accessibility (WCAG 2.2):** 4.5:1 contrast, 44px touch targets, visible focus rings, `prefers-reduced-motion` respected, keyboard alternatives for all drag interactions.

---

### 12. Custom Spinner Verbs

50 French messages replace the generic Claude Code spinners:

> "Reflexion profonde", "Cartographie du code", "Tissage des liens", "Delegation aux agents", "Exploration des possibles", "Verification des hypotheses"...

Customizable in the `spinnerVerbs` section of `~/.claude/settings.json`.

---

### 13. Tool Usage Analytics

Every tool call is silently logged to `MEMORY/.tool-usage.jsonl`:

```json
{"tool":"Edit","session":"a1b2c3d4","ts":"2026-02-20T10:32:15.042Z"}
{"tool":"Bash","session":"a1b2c3d4","ts":"2026-02-20T10:32:18.118Z"}
{"tool":"Read","session":"a1b2c3d4","ts":"2026-02-20T10:32:19.901Z"}
```

Useful for understanding your workflow patterns over time.

---

## Skills & Agents

### Skills (slash commands)

| Command | What it does | Methodology |
|:---|:---|:---|
| `/hora-design` | Anti-AI web design — intentional, premium UI | Dieter Rams, Bauhaus, Swiss Style, Ma, OKLCH |
| `/hora-forge` | Zero Untested Delivery — TDD with 7 mandatory gates | NASA Cleanroom, TDD, DO-178C, Jidoka |
| `/hora-refactor` | Systematic refactoring with safety nets | Martin Fowler (70+ catalog), Michael Feathers |
| `/hora-security` | OWASP Top 10 2025 audit with CWE references | OWASP 2025, CWE/SANS Top 25, Microsoft SDL |
| `/hora-perf` | Core Web Vitals + Lighthouse performance audit | Google CWV, RAIL model, Lighthouse |
| `/hora-plan` | Full planning with verifiable ISC criteria | EXPLORE -> PLAN -> AUDIT -> Validation |
| `/hora-autopilot` | Autonomous end-to-end execution | PLAN -> AUDIT -> BUILD -> VERIFY |
| `/hora-parallel-code` | Multi-agent codebase work | Architect -> AUDIT -> Executors in parallel |
| `/hora-parallel-research` | Multi-angle research | 3-5 angles -> Researchers -> Synthesizer |
| `/hora-backup` | Immediate backup | Delegates to backup agent |

#### Specialized workflows

**`/hora-design`** — Every UI choice is intentional. 13-point anti-AI checklist catches generic patterns (indigo gradients, symmetric grids, glassmorphism). OKLCH color system, fluid typography, asymmetric layouts. Gates: anti-AI, a11y, dark mode, responsive.

**`/hora-forge`** — No deliverable ships without tests. 9 phases (CLASSIFY → SPEC → ANALYZE → PLAN → TEST FIRST → BUILD → VERIFY → EXAMINE → DELIVER), 7 gates, 6 criticality classes (F-A). Jidoka: red test = stop immediately.

**`/hora-refactor`** — Code smells detected from Fowler's catalog (5 categories, 22 smells). Characterization tests written BEFORE any modification (Feathers). One refactoring at a time, micro-commits, metrics before/after.

**`/hora-security`** — All 10 OWASP 2025 categories scanned systematically. Every finding gets a CWE reference and severity. Fixes require reproduction tests. Defense-in-depth hardening (headers, validation, env, dependencies).

**`/hora-perf`** — Baseline measurement first (Lighthouse, bundle analysis, Core Web Vitals). Diagnose by category (LCP/INP/CLS/bundle). Quick wins prioritized. Every optimization measured before/after. RAIL model budgets.

> Every skill includes an **AUDIT step** that identifies ghost failures (silent failure modes) before any code is written.

### Agents

| Agent | Model | Role | When to use |
|:---|:---:|:---|:---|
| **architect** | Opus | Structural decisions, system design, proposes 2-3 options | Architecture, design system, tech choices |
| **executor** | Sonnet | Implementation, debug, refactoring (surgical modifications) | Code changes, bug fixes, feature implementation |
| **researcher** | Sonnet | Multi-source research, analysis, documentation | Technology comparison, due diligence |
| **reviewer** | Haiku | Quick review, PASS/FAIL verdict, Critical/Warning/OK severity | Code review, validation |
| **synthesizer** | Haiku | Multi-source aggregation, deduplication | Combining research from multiple angles |
| **backup** | Haiku | Silent git backup (mirror branch or local bundle) | Automated by backup-monitor hook |

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
   - SSOT: Does this logic already exist? If yes --> reuse.
   - Library-first: Does a maintained library do this? If yes --> use it.
   - Can what's in production break?

2. PLAN
   | Impact               | Thinking level                    |
   |----------------------|-----------------------------------|
   | Isolated / cosmetic  | Standard                          |
   | Business logic       | Think hard                        |
   | Auth / data / infra  | Ultrathink + user validation      |

3. AUDIT (Ghost Failures)
   Before coding, identify silent failure modes:
   - What happens if this integration point fails, times out, or returns unexpected data?
   - Is each technical assumption VERIFIED or ASSUMED?
   - Race conditions, stale files, false positives?

   Critical ghost failure found? --> Test before coding.
   None found? --> Document why (negative proof).

4. CODE
   - Errors handled explicitly (no silent failures)
   - Search before creating (SSOT)
   - Modify only what's in scope (minimal footprint)

5. COMMIT
   - Verify each ISC criterion
   - Message: what / why / impact
   - Flag: tech debt introduced, uncovered edge cases, next steps
```

> **Robustness > Speed. SSOT > Convenience.**
> A bug in production costs more than 30 minutes of design.

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
    hora-session-name  hora-security     .ts          |
           .ts         tool-use.ts                 Extract:
           |           context-                    - Profile
    Injects:           checkpoint.ts               - Errors
    - MEMORY/                |                     - Sentiment
    - Thread history   Validates:                  - Archive
    - Routing hints    - Security rules
    - Checkpoint       - Pre-edit snapshot
      reminder         - Tool logging
                       - Compact detection
```

### Data flow

```
                    ~/.claude/
                         |
        +--------+-------+-------+--------+
        |        |       |       |        |
     MEMORY/   hooks/  agents/  skills/  .hora/
        |                                  |
   +----+----+                    +--------+--------+--------+
   |    |    |                    |        |        |        |
PROFILE/ LEARNING/ SESSIONS/  snapshots/ backups/ state/  patterns.yaml
   |       |          |           |                  |
identity errors    archives    manifest.jsonl   context-pct.txt
projects failures  summaries   timestamped       backup-state
prefs    sentiment             .bak files        session-state
vocab    system

                    <project>/
                         |
                       .hora/
                         |
              +----------+----------+
              |                     |
        project-id         project-knowledge.md
     (stable UUID,          (auto-audit results,
      survives rename)       injected every session)
```

### Zero runtime dependencies

All hooks use **only Node.js built-ins** (`fs`, `path`, `crypto`). The YAML parser in `hora-security.ts` is custom-written. No `npm install` required at runtime — only `tsx` is needed to execute TypeScript.

### Fail-safe design

Every hook wraps its logic in `try/catch` and exits `0` on error. **Hooks never block Claude Code**, even if a file is missing or corrupted.

### Deferred pairing

Hooks can't see both the user message and assistant response simultaneously. HORA works around this:

1. `prompt-submit.ts` saves the user message at prompt time
2. `session-end.ts` saves the assistant response summary at session end
3. On next prompt, both are paired into a continuous thread history

### Cross-platform

| Component | macOS | Linux | Windows (Git Bash) |
|:---|:---:|:---:|:---:|
| install.sh | Full | Full | Full (via install.ps1) |
| install.ps1 | N/A | N/A | Full (entry point) |
| TypeScript hooks | Full | Full | Full (runs via cmd.exe) |
| statusline.sh | Full | Full | Full (jq or Node.js fallback) |
| Security patterns | Full | Full | Full |
| Orphan hook cleanup | Full | Full | Full |
| Path resolution | N/A | N/A | Auto (`~` → `C:/Users/...`) |

> \* API usage display requires macOS Keychain. On Windows/Linux, the statusline gracefully degrades — all other data (context %, git, backup, commits) works everywhere. The statusline uses `jq` when available and falls back to Node.js.

---

## Hooks Lifecycle

```
UserPromptSubmit (fires on every user message)
  |-- prompt-submit.ts         Injects MEMORY/, routing hints, thread continuity,
  |                            checkpoint reminder at 70% context
  |-- hora-session-name.ts     Names the session on first prompt

PreToolUse (fires before every tool call)
  |-- snapshot.ts              Write|Edit|MultiEdit: saves file before edit
  |-- hora-security.ts         Bash|Edit|Write|Read|MultiEdit: security validation
  |-- tool-use.ts              *: silent usage logging
  |-- context-checkpoint.ts    *: compact detection + recovery injection

PostToolUse (fires after every tool call)
  |-- backup-monitor.ts        Write|Edit|MultiEdit: monitors changes, triggers backup

Stop (fires at session end)
  |-- session-end.ts           Extracts profile + errors + sentiment + archive

SubagentStop
  |-- session-end.ts --subagent  Skips extraction for sub-agents
```

---

## Repository Structure

```
hora/
|-- README.md
|-- install.sh                    # Installer (macOS/Linux/Windows via Git Bash)
|-- install.ps1                   # Windows PowerShell entry point
|-- .gitattributes                # Forces LF line endings (prevents Windows CRLF issues)
|-- .gitignore
|-- .hora/                        # Project runtime state (git-ignored)
|   |-- project-id                # Stable project ID (survives folder renames)
|   |-- project-knowledge.md      # Auto-audit results (versioned with git)
|   |-- snapshots/                # Pre-edit file backups
|   |-- backups/                  # Git bundles (when no remote)
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
    |-- hooks/                    # 8 TypeScript lifecycle hooks
    |   |-- snapshot.ts           #   PreToolUse: pre-edit file backup
    |   |-- hora-security.ts      #   PreToolUse: security validation (custom YAML parser)
    |   |-- tool-use.ts           #   PreToolUse: silent usage logging
    |   |-- context-checkpoint.ts #   PreToolUse: compact detection + recovery
    |   |-- backup-monitor.ts     #   PostToolUse: auto-backup trigger
    |   |-- prompt-submit.ts      #   UserPromptSubmit: context + routing + thread + checkpoint
    |   |-- hora-session-name.ts  #   UserPromptSubmit: auto session naming
    |   |-- session-end.ts        #   Stop: profile + errors + sentiment + archive extraction
    |
    |-- agents/                   # 6 specialized agents
    |   |-- architect.md          #   Opus: architecture, system design
    |   |-- executor.md           #   Sonnet: implementation, debug
    |   |-- researcher.md         #   Sonnet: research, analysis
    |   |-- reviewer.md           #   Haiku: review, validation
    |   |-- synthesizer.md        #   Haiku: multi-source aggregation
    |   |-- backup.md             #   Haiku: git backup
    |
    |-- skills/                   # 10 skills (directory/SKILL.md format)
    |   |-- hora-design/SKILL.md       #   Anti-AI web design (Dieter Rams, OKLCH)
    |   |-- hora-forge/SKILL.md        #   Zero Untested Delivery (NASA, TDD)
    |   |-- hora-refactor/SKILL.md     #   Systematic refactoring (Fowler, Feathers)
    |   |-- hora-security/SKILL.md     #   OWASP 2025 audit (CWE, SANS)
    |   |-- hora-perf/SKILL.md         #   Performance (Core Web Vitals, RAIL)
    |   |-- hora-plan/SKILL.md
    |   |-- hora-autopilot/SKILL.md
    |   |-- hora-parallel-code/SKILL.md
    |   |-- hora-parallel-research/SKILL.md
    |   |-- hora-backup/SKILL.md
    |
    |-- MEMORY/                   # Persistent memory (empty at start)
        |-- PROFILE/              #   identity.md, projects.md, preferences.md, vocabulary.md
        |-- LEARNING/
        |   |-- FAILURES/         #   Extracted errors and lessons
        |   |-- ALGORITHM/        #   Sentiment patterns
        |   |-- SYSTEM/           #   Technical issues
        |-- SESSIONS/             #   Session archives
        |-- SECURITY/             #   Security audit trail
        |-- STATE/                #   Current state (session names, thread state)
        |-- WORK/                 #   Work in progress (checkpoints)
```

---

## What HORA Provides

| Capability | Details |
|:---|:---|
| **Initial setup** | Nothing — 3 questions, then it learns |
| **Long-term memory** | Self-constructed from sessions (hybrid env + linguistic extraction) |
| **Security** | Layered defense + audit trail |
| **Cross-session continuity** | Thread persistence, project-scoped (stable `.hora/project-id`) |
| **Learning extraction** | Profile + errors + sentiment (JSONL append-only) |
| **Auto project audit** | Full codebase analysis on first session (stored in `.hora/project-knowledge.md`) |
| **Web/SaaS conventions** | Opinionated TypeScript/React stack, library-first, anti "AI look" design |
| **Session naming** | Deterministic (fast regex, no AI) |
| **Statusline** | Rich (context %, git, API usage, backup) |
| **Compact recovery** | Auto-detection + checkpoint injection |
| **Pre-edit snapshots** | Every edit, with or without git |
| **Auto backup** | Mirror branch or local bundle |
| **10 skills** | Design, Forge, Refactor, Security, Perf, Plan, Autopilot, Parallel-Code, Parallel-Research, Backup |
| **Multi-agents** | 6 agents across 3 models |
| **Model routing** | Opus / Sonnet / Haiku |
| **Ghost failure detection** | Built into the Algorithm (AUDIT step) |
| **Library-first** | Never reimplement what a maintained library does |
| **Cross-platform** | macOS / Linux / Windows |
| **Runtime dependencies** | tsx only |
| **Custom spinners** | 50 verbs (FR, customizable) |

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

Edit files in `~/.claude/agents/`. Each `.md` file defines the model, authorized tools, and protocol:

```markdown
# Agent: your-agent-name

Model: sonnet
Tools: Read, Write, Edit, Bash, Glob, Grep

## Protocol
1. First step
2. Second step
```

### Skills

Edit files in `~/.claude/skills/`. Each skill follows the directory format with `SKILL.md` + YAML frontmatter:

```
~/.claude/skills/your-skill/SKILL.md
```

```markdown
---
name: your-skill
description: What it does. USE WHEN trigger words.
---

# Skill: your-skill

## Protocol
### 1. Step one
### 2. Step two
```

### Spinner verbs

Edit the `spinnerVerbs` section in `~/.claude/settings.json`:

```json
{
  "spinnerVerbs": [
    "Your custom message 1",
    "Your custom message 2"
  ]
}
```

---

## Windows Notes

### How it works

Claude Code on Windows uses **Git for Windows** ([download](https://git-scm.com/download/win)) for shell operations. Important distinction:

- **Hooks** (TypeScript) execute via **cmd.exe** using `npx tsx` — NOT through Git Bash
- **Bash tool** uses Git Bash (controlled by `CLAUDE_CODE_GIT_BASH_PATH`)
- **Statusline** runs through Git Bash

### What install.ps1 handles automatically

The PowerShell installer (`.\install.ps1`) does everything:

| Step | What it does |
|:---|:---|
| **Git Bash detection** | Finds `bash.exe` in standard locations, rejects WSL bash |
| **CLAUDE_CODE_GIT_BASH_PATH** | Set permanently (User env var) — no manual config needed |
| **jq installation** | Auto-installs via `winget` if missing (optional, Node.js fallback exists) |
| **tsx installation** | Auto-installs via `npm install -g tsx` if missing |
| **Orphan hook cleanup** | Removes hooks from other frameworks pointing to non-existent files |
| **Path resolution** | Replaces `~` and `$HOME` with absolute `C:/Users/...` paths in settings.json |
| **Hook verification** | Tests hooks after install to confirm they work |

### Receiving HORA without git clone

If you receive HORA as a `.zip` (private repo, offline transfer):

1. Extract the zip anywhere
2. Open PowerShell in the extracted folder
3. Run `.\install.ps1`

The installer works identically whether the source is a git clone or extracted zip.

### Switching from another framework

If you previously used another Claude Code framework, HORA automatically detects and removes orphan hooks — no need to manually delete `~/.claude/settings.json` before installing. The cleanup runs after HORA hooks are copied, so only truly orphaned references (files that don't exist) are removed.

### Known limitations

| Limitation | Details |
|:---|:---|
| API usage not displayed | Requires macOS Keychain — statusline gracefully degrades |
| Console window flashes | Known Claude Code limitation on Windows ([#17230](https://github.com/anthropics/claude-code/issues/17230)) |
| CRLF line endings | Handled by `.gitattributes` (forces LF on all scripts) |
| Symlinks not supported | HORA uses plain text files instead (backup `latest` pointer) |

### Manual troubleshooting

If hooks fail after install, check these in order:

```powershell
# 1. Verify CLAUDE_CODE_GIT_BASH_PATH is set
[System.Environment]::GetEnvironmentVariable('CLAUDE_CODE_GIT_BASH_PATH', 'User')

# 2. Test a hook manually
echo '{}' | npx tsx "$env:USERPROFILE\.claude\hooks\prompt-submit.ts"

# 3. Check settings.json for orphan hooks
# Look for hooks referencing .ts files that don't exist:
Get-Content "$env:USERPROFILE\.claude\settings.json" | Select-String "\.ts"

# 4. Re-run the installer (safe to run multiple times)
.\install.ps1
```

---

## FAQ

<details>
<summary><strong>Does HORA send my data anywhere?</strong></summary>

No. Everything stays local in `~/.claude/`. The only network call is the Anthropic API usage check (macOS only, uses your existing Claude Code OAuth token). No telemetry, no analytics, no external services.
</details>

<details>
<summary><strong>Can HORA break my Claude Code setup?</strong></summary>

No. The installer backs up all your data first and can be rolled back with `bash install.sh --restore`. HORA merges into your existing config — it doesn't replace it. Every hook is fail-safe (try/catch + exit 0).
</details>

<details>
<summary><strong>What happens if I uninstall HORA?</strong></summary>

Run `bash install.sh --restore` to get back to your pre-HORA state. Or manually remove the HORA blocks from `~/.claude/CLAUDE.md` and `~/.claude/settings.json`.
</details>

<details>
<summary><strong>Does it work with other Claude Code extensions?</strong></summary>

Yes. The installer preserves third-party hooks during merge (requires jq). HORA hooks are additive — they don't interfere with existing ones. If you switch FROM another framework to HORA, orphan hooks (referencing non-existent files) are automatically cleaned up.
</details>

<details>
<summary><strong>I'm on Windows and hooks are failing — what should I do?</strong></summary>

Re-run `.\install.ps1` — it's safe to run multiple times. The installer will auto-detect Git Bash, set `CLAUDE_CODE_GIT_BASH_PATH`, clean orphan hooks from previous frameworks, and resolve paths. If you previously used another Claude Code framework, the installer handles the transition automatically. See the [Windows Notes](#windows-notes) section for manual troubleshooting.
</details>

<details>
<summary><strong>Can I use it in English?</strong></summary>

Yes. HORA's internal language is French (comments, spinner verbs, skill descriptions) but it works with any language. Memory extraction and session continuity are language-agnostic. You can customize spinner verbs to English in `settings.json`.
</details>

<details>
<summary><strong>What's the performance impact?</strong></summary>

Minimal. Each hook runs in 10-50ms. The statusline is a single bash script. Backup checks have a 30s cooldown. The heaviest operation (session-end extraction) only runs once per session.
</details>

<details>
<summary><strong>What happens if I rename a project folder?</strong></summary>

Nothing breaks. HORA generates a stable project ID stored in `.hora/project-id` on first use. This ID persists across folder renames, so session history and project knowledge stay associated correctly.
</details>

<details>
<summary><strong>Can I opt out of the web/SaaS conventions?</strong></summary>

Yes. The conventions live in the `STACK & CONVENTIONS WEB/SAAS` and `DESIGN UI/UX` sections of `~/.claude/CLAUDE.md`. Remove or edit those sections to change the defaults. The core HORA features (memory, security, snapshots, continuity) are independent of the stack opinions.
</details>

<details>
<summary><strong>How does the auto project audit work?</strong></summary>

When you open Claude Code in a directory without `.hora/project-knowledge.md`, HORA detects it as a new project and proposes a full codebase audit. The audit covers architecture, stack, security flaws (with severity), technical debt, and good practices. Results are stored locally and injected as context on every future session — so Claude never has to re-analyze the same project.
</details>

<details>
<summary><strong>What's a "ghost failure"?</strong></summary>

A ghost failure is when something fails **silently** — no error, no warning, but the system doesn't work as expected. HORA's Algorithm includes a mandatory AUDIT step that identifies these before any code is written. Example: the discovery that `system_reminder` output from PreToolUse hooks is silently ignored by Claude Code (the correct format is `hookSpecificOutput.additionalContext`).
</details>

---

## Contributing

Contributions are welcome! HORA is built with a specific philosophy:

1. **Zero runtime dependencies** — only Node.js built-ins
2. **Fail-safe everything** — hooks must never block Claude Code
3. **Silent by default** — never interrupt the user's flow
4. **SSOT** — search before creating, reuse before duplicating
5. **Ghost failure awareness** — identify silent failures before coding

### Development

```bash
# Clone and install
git clone https://github.com/Vivien83/Hora.git
cd Hora
bash install.sh

# Test changes
bash install.sh --dry-run     # Verify installer
npx tsx claude/hooks/FILE.ts  # Test individual hooks

# The source is in claude/ — everything deploys to ~/.claude/
```

---

## Acknowledgments

HORA was born from the inspiration of two projects: [PAI](https://github.com/danielmiessler/Personal_AI_Infrastructure) by Daniel Miessler and [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) by Yeachan Heo. Their work showed what was possible with Claude Code — HORA takes a different path, but wouldn't exist without them.

---

## License

**MIT** — Free, open-source, forever.

---

<p align="center">
  <strong>HORA starts empty and builds itself through usage.</strong><br>
  The more you use it, the more it knows. The more it knows, the better it helps.
</p>
