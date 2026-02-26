#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  HORA Launcher — Claude Code + Dashboard
#
#  Usage:
#    hora              # Launch claude + dashboard
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

# Parse --no-dash flag (remove from args before passing to claude)
CLAUDE_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --no-dash|--no-dashboard) NO_DASH=true ;;
    *) CLAUDE_ARGS+=("$arg") ;;
  esac
done

# ─── Cleanup on exit ──────────────────────────────────────────────

cleanup() {
  if [[ -n "$DASHBOARD_PID" ]] && kill -0 "$DASHBOARD_PID" 2>/dev/null; then
    kill "$DASHBOARD_PID" 2>/dev/null
    wait "$DASHBOARD_PID" 2>/dev/null
  fi
}
trap cleanup EXIT INT TERM

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

# ─── Launch Claude Code ──────────────────────────────────────────

exec claude "${CLAUDE_ARGS[@]}"
