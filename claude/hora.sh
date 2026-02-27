#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  HORA Launcher — Claude Code + Dashboard
#
#  Usage:
#    hora              # Launch claude + dashboard
#    hora --yolo       # Mode YOLO: auto-approve sauf ops dangereuses
#    hora --no-dash    # Launch claude only (skip dashboard)
#    hora [claude args] # Pass any args to claude (e.g. hora -p "hello")
#
#  The dashboard runs in the background on http://localhost:3847
#  and is automatically stopped when claude exits.
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

DASHBOARD_DIR="${HOME}/.claude/dashboard"
DASHBOARD_PID=""
NO_DASH=false
YOLO=false

# Parse hora flags (remove from args before passing to claude)
CLAUDE_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --no-dash|--no-dashboard) NO_DASH=true ;;
    --yolo) YOLO=true ;;
    *) CLAUDE_ARGS+=("$arg") ;;
  esac
done

# YOLO mode: auto-approve tout sauf les operations dangereuses
# hora-security.ts reste actif comme filet de securite
if [[ "$YOLO" == true ]]; then
  CLAUDE_ARGS+=("--allowedTools" "Edit" "Write" "MultiEdit" "Bash(npm:*)" "Bash(npx:*)" "Bash(node:*)" "Bash(git status:*)" "Bash(git diff:*)" "Bash(git log:*)" "Bash(git add:*)" "Bash(git commit:*)" "Bash(git branch:*)" "Bash(git checkout:*)" "Bash(git stash:*)" "Bash(ls:*)" "Bash(mkdir:*)" "Bash(cp:*)" "Bash(mv:*)" "Bash(cat:*)" "Bash(head:*)" "Bash(tail:*)" "Bash(wc:*)" "Bash(diff:*)" "Bash(echo:*)" "Bash(printf:*)" "Bash(test:*)" "Bash(which:*)" "Bash(pwd:*)" "Bash(date:*)" "Read" "Glob" "Grep" "WebSearch" "WebFetch" "Task" "TaskCreate" "TaskUpdate" "TaskList" "TaskGet" "NotebookEdit")
fi

# ─── Cleanup on exit ──────────────────────────────────────────────

cleanup() {
  if [[ -n "$DASHBOARD_PID" ]] && kill -0 "$DASHBOARD_PID" 2>/dev/null; then
    kill "$DASHBOARD_PID" 2>/dev/null
    wait "$DASHBOARD_PID" 2>/dev/null
  fi
}
trap cleanup EXIT INT TERM

# ─── Banner ──────────────────────────────────────────────────────

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ] && [ "${TERM:-dumb}" != "dumb" ]; then
  GOLD='\033[38;2;212;168;83m'
  DIM_GOLD='\033[38;2;160;128;64m'
  B='\033[1m'
  D='\033[2m'
  R='\033[0m'
  W='\033[97m'
  printf "\n"
  printf "${GOLD}${B}"
  printf "  ██╗  ██╗ ██████╗ ██████╗  █████╗ \n"
  printf "  ██║  ██║██╔═══██╗██╔══██╗██╔══██╗\n"
  printf "  ███████║██║   ██║██████╔╝███████║\n"
  printf "  ██╔══██║██║   ██║██╔══██╗██╔══██║\n"
  printf "  ██║  ██║╚██████╔╝██║  ██║██║  ██║\n"
  printf "${DIM_GOLD}  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝${R}\n"
  printf "\n"
  if [[ "$YOLO" == true ]]; then
    printf "  ${D}your memory never sleeps.${R}  ${GOLD}${B}YOLO${R}\n"
  else
    printf "  ${D}your memory never sleeps.${R}\n"
  fi
  printf "  ${DIM_GOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}\n"
  # Dynamic stats
  ENTITIES=0; FACTS=0; SESSIONS=0
  [ -f "$HOME/.claude/MEMORY/GRAPH/entities.jsonl" ] && ENTITIES=$(wc -l < "$HOME/.claude/MEMORY/GRAPH/entities.jsonl" 2>/dev/null | tr -d ' ')
  [ -f "$HOME/.claude/MEMORY/GRAPH/facts.jsonl" ] && FACTS=$(wc -l < "$HOME/.claude/MEMORY/GRAPH/facts.jsonl" 2>/dev/null | tr -d ' ')
  [ -d "$HOME/.claude/MEMORY/SESSIONS" ] && SESSIONS=$(ls "$HOME/.claude/MEMORY/SESSIONS/"*.md 2>/dev/null | wc -l | tr -d ' ')
  printf "  ${W}⟐${R} ${D}${ENTITIES} entites${R} ${DIM_GOLD}│${R} ${D}${FACTS} facts${R} ${DIM_GOLD}│${R} ${D}${SESSIONS} sessions${R}\n"
  printf "\n"
fi

# ─── Start dashboard ──────────────────────────────────────────────

if [[ "$NO_DASH" == false ]] && [[ -d "$DASHBOARD_DIR" ]]; then
  # Check if dashboard is already running on port 3847
  if lsof -iTCP:3847 -sTCP:LISTEN -t &>/dev/null; then
    printf '\033[90m◈ HORA Dashboard already running → http://localhost:3847\033[0m\n'
  else
    # Ensure dependencies are installed
    if [[ ! -d "$DASHBOARD_DIR/node_modules" ]]; then
      printf '\033[90m◈ Installing dashboard dependencies...\033[0m\n'
      (cd "$DASHBOARD_DIR" && npm install --silent 2>/dev/null)
    fi

    # Collect data before launch
    if [[ -f "$DASHBOARD_DIR/scripts/collect-data.ts" ]]; then
      (cd "$DASHBOARD_DIR" && npx tsx scripts/collect-data.ts 2>/dev/null) || true
    fi

    # Start Vite dev server in background (suppress output)
    (cd "$DASHBOARD_DIR" && npx vite --port 3847 &>/dev/null) &
    DASHBOARD_PID=$!

    # Brief wait to let Vite start
    sleep 1

    if kill -0 "$DASHBOARD_PID" 2>/dev/null; then
      printf '\033[90m◈ HORA Dashboard → http://localhost:3847\033[0m\n'
    fi
  fi
fi

# ─── Project init (first time) ──────────────────────────────────

NEED_COMMIT=false

# Ensure .hora/ exists with project-id
if [[ ! -f .hora/project-id ]]; then
  mkdir -p .hora
  # Generate project-id without tr|head (SIGPIPE-safe)
  printf '%s' "$(date +%s%N | shasum | head -c 12)" > .hora/project-id
  printf '\033[90m◈ HORA project initialized (.hora/project-id)\033[0m\n'
  NEED_COMMIT=true
fi

# Ensure git repo exists IN THIS directory (not a parent repo)
GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$GIT_ROOT" ]] || [[ "$GIT_ROOT" != "$(pwd)" ]]; then
  printf '\033[90m◈ Initializing git repo...\033[0m\n'
  git init -q
  if [[ ! -f .gitignore ]]; then
    cat > .gitignore <<'GITIGNORE'
node_modules/
dist/
.env
.env.local
.DS_Store
*.log
GITIGNORE
  fi
  NEED_COMMIT=true
fi

if [[ "$NEED_COMMIT" == true ]]; then
  git add -A
  git commit -q -m "init: hora project" --allow-empty
fi

# ─── Launch Claude Code ──────────────────────────────────────────

exec claude ${CLAUDE_ARGS[@]+"${CLAUDE_ARGS[@]}"}
