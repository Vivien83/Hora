#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# HORA — Barre de statut
# ═══════════════════════════════════════════════════════════════════════════════
#
# 3 modes responsive :
#   - compact (<55 cols): Metriques essentielles
#   - normal  (55-79):    Densite equilibree
#   - full    (80+):      Affichage complet
#
# Utilise le JSON natif de Claude Code :
#   - context_window.used_percentage : % contexte
#   - cost.total_duration_ms         : duree session
# Usage 5h/7d via API OAuth Anthropic (cache 60s, cross-platform).
#
# Credentials cross-platform :
#   - macOS  : Keychain natif (service "Claude Code-credentials")
#   - Windows: ~/.claude/.credentials.json (JSON en clair)
#   - Linux  : ~/.claude/.credentials.json + fallback secret-tool
#   - CI     : variable CLAUDE_CODE_OAUTH_TOKEN
# ═══════════════════════════════════════════════════════════════════════════════

set -o pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

HORA_STATE_DIR="${HOME}/.claude/.hora"
USAGE_CACHE="${HORA_STATE_DIR}/usage-cache.json"
GIT_CACHE_TTL=5     # secondes
USAGE_CACHE_TTL=60  # secondes

# Find project root: walk up from CWD looking for .hora/project-id
PROJECT_ROOT=""
_dir="$(pwd)"
while [ "$_dir" != "/" ]; do
    if [ -f "$_dir/.hora/project-id" ]; then
        PROJECT_ROOT="$_dir"
        break
    fi
    _dir="$(dirname "$_dir")"
done
# Fallback to git root, then CWD
if [ -z "$PROJECT_ROOT" ]; then
    PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
fi
PROJECT_HORA_DIR="${PROJECT_ROOT}/.hora"

# Project-scoped git cache (avoids cross-session conflicts with multiple projects)
_proj_hash=$(printf '%s' "$PROJECT_ROOT" | cksum | cut -d' ' -f1)
GIT_CACHE="${HORA_STATE_DIR}/git-cache-${_proj_hash}.sh"

# Project-scoped backup state (fallback to global)
if [ -f "${PROJECT_HORA_DIR}/backup-state.json" ]; then
    BACKUP_STATE="${PROJECT_HORA_DIR}/backup-state.json"
else
    BACKUP_STATE="${HORA_STATE_DIR}/backup-state.json"
fi

# mtime cross-platform (epoch)
get_mtime() {
    stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0
}

# ─────────────────────────────────────────────────────────────────────────────
# LECTURE DU JSON — un seul appel jq
# ─────────────────────────────────────────────────────────────────────────────

input=$(cat)

if command -v jq &>/dev/null; then
    eval "$(echo "$input" | jq -r '
      "ctx_pct=" + (.context_window.used_percentage // 0 | tostring) + "\n" +
      "ctx_max=" + (.context_window.context_window_size // 200000 | tostring) + "\n" +
      "session_id=" + (.session_id // "" | @sh) + "\n" +
      "model_name=" + (.model.display_name // "unknown" | @sh) + "\n" +
      "duration_ms=" + (.cost.total_duration_ms // 0 | tostring) + "\n" +
      "cur_input=" + (.context_window.current_usage.input_tokens // 0 | tostring) + "\n" +
      "cur_cache_create=" + (.context_window.current_usage.cache_creation_input_tokens // 0 | tostring) + "\n" +
      "cur_cache_read=" + (.context_window.current_usage.cache_read_input_tokens // 0 | tostring)
    ' 2>/dev/null)"
elif command -v node &>/dev/null; then
    eval "$(echo "$input" | node -e "
      let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
        try{const j=JSON.parse(d);
        const cw=j.context_window||{};const cu=cw.current_usage||{};
        console.log('ctx_pct='+(cw.used_percentage||0));
        console.log('ctx_max='+(cw.context_window_size||200000));
        console.log('session_id=\\x27'+(j.session_id||'')+'\\x27');
        console.log('model_name=\\x27'+(j.model?.display_name||'unknown')+'\\x27');
        console.log('duration_ms='+(j.cost?.total_duration_ms||0));
        console.log('cur_input='+(cu.input_tokens||0));
        console.log('cur_cache_create='+(cu.cache_creation_input_tokens||0));
        console.log('cur_cache_read='+(cu.cache_read_input_tokens||0));
        }catch{}
      })
    " 2>/dev/null)"
fi

# Valeurs par defaut
ctx_pct=${ctx_pct:-0}
ctx_pct_int=${ctx_pct%%.*}
[ -z "$ctx_pct_int" ] && ctx_pct_int=0
duration_ms=${duration_ms:-0}

# Si used_percentage est 0 mais current_usage disponible, calcul depuis les vrais tokens actuels
# NOTE : on utilise current_usage (pas total_input/total_output qui sont cumulatifs et faux apres compaction)
if [ "$ctx_pct_int" = "0" ] && [ "${cur_input:-0}" -gt 0 ] 2>/dev/null; then
    used_tokens=$((cur_input + cur_cache_create + cur_cache_read))
    ctx_pct_int=$((used_tokens * 100 / ${ctx_max:-200000}))
    # Cap a 100%
    [ "$ctx_pct_int" -gt 100 ] && ctx_pct_int=100
fi

# GF-2: Persister context-pct seulement si > 0 (session-scoped)
if [ "$ctx_pct_int" -gt 0 ] && [ -n "$session_id" ]; then
    _sid8="${session_id:0:8}"
    _sess_dir="${HORA_STATE_DIR}/sessions/${_sid8}"
    mkdir -p "$_sess_dir" 2>/dev/null
    # GF-6: Ecriture atomique (tmp + mv)
    _ctx_tmp="${_sess_dir}/context-pct.tmp"
    printf '%d' "$ctx_pct_int" > "$_ctx_tmp" 2>/dev/null && mv "$_ctx_tmp" "${_sess_dir}/context-pct.txt" 2>/dev/null
fi

# ─────────────────────────────────────────────────────────────────────────────
# DUREE DE SESSION (depuis Claude Code JSON)
# ─────────────────────────────────────────────────────────────────────────────

duration_sec=$((duration_ms / 1000))
if   [ "$duration_sec" -ge 3600 ]; then
    time_display="$((duration_sec / 3600))h$(printf '%02d' $((duration_sec % 3600 / 60)))"
elif [ "$duration_sec" -ge 60 ]; then
    time_display="$((duration_sec / 60))m$((duration_sec % 60))s"
else
    time_display="${duration_sec}s"
fi

# ─────────────────────────────────────────────────────────────────────────────
# USAGE API (5h/7d — OAuth Anthropic, cache 60s)
# ─────────────────────────────────────────────────────────────────────────────

usage_5h=0
usage_7d=0
usage_5h_reset=""
usage_7d_reset=""

fetch_usage() {
    mkdir -p "$HORA_STATE_DIR" 2>/dev/null

    # Verifier le cache
    if [ -f "$USAGE_CACHE" ]; then
        local cache_age=$(( $(date +%s) - $(get_mtime "$USAGE_CACHE") ))
        if [ "$cache_age" -lt "$USAGE_CACHE_TTL" ]; then
            return 0
        fi
    fi

    # Extraire le token OAuth — cross-platform
    # Priorite : env var > fichier credentials > macOS Keychain > Linux secret-tool
    # - macOS : Keychain natif (le fichier .credentials.json est supprime apres migration)
    # - Windows/Linux : fichier ~/.claude/.credentials.json (JSON en clair)
    # - CI/headless : variable CLAUDE_CODE_OAUTH_TOKEN
    local keychain_data="" token=""

    # 1. Variable d'env (CI, containers, headless)
    if [ -n "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
        token="$CLAUDE_CODE_OAUTH_TOKEN"
    else
        # 2. Fichier credentials (Linux, Windows/Git Bash, containers)
        local creds_file="$HOME/.claude/.credentials.json"
        if [ -f "$creds_file" ]; then
            keychain_data=$(cat "$creds_file" 2>/dev/null)
        fi

        # 3. macOS Keychain (le fichier est absent car supprime apres migration)
        if [ -z "$keychain_data" ] && command -v security &>/dev/null; then
            keychain_data=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null)
        fi

        # 4. Linux GNOME Keyring (secret-tool via D-Bus)
        if [ -z "$keychain_data" ] && command -v secret-tool &>/dev/null; then
            keychain_data=$(secret-tool lookup service "Claude Code-credentials" 2>/dev/null)
        fi

        # Extraire le token OAuth du JSON
        if [ -n "$keychain_data" ]; then
            token=$(echo "$keychain_data" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log(j.claudeAiOauth?.accessToken||'')}catch{}})" 2>/dev/null)
        fi
    fi

    if [ -n "$token" ]; then
        local usage_json
        usage_json=$(curl -s --max-time 3 \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -H "anthropic-beta: oauth-2025-04-20" \
            "https://api.anthropic.com/api/oauth/usage" 2>/dev/null)

        if [ -n "$usage_json" ]; then
            if command -v jq &>/dev/null; then
                echo "$usage_json" | jq -e '.five_hour' >/dev/null 2>&1 && echo "$usage_json" | jq '.' > "$USAGE_CACHE" 2>/dev/null
            else
                echo "$usage_json" > "$USAGE_CACHE" 2>/dev/null
            fi
        fi
    fi
}

# Fetch en arriere-plan pour ne pas bloquer
fetch_usage &
USAGE_PID=$!

# Lire le cache existant (meme si le fetch tourne en parallele)
# Fonction cross-platform : jq si disponible, sinon node
read_usage_cache() {
    [ -f "$USAGE_CACHE" ] || return
    if command -v jq &>/dev/null; then
        eval "$(jq -r '
            "usage_5h=" + (.five_hour.utilization // 0 | tostring) + "\n" +
            "usage_5h_reset=" + (.five_hour.resets_at // "" | @sh) + "\n" +
            "usage_7d=" + (.seven_day.utilization // 0 | tostring) + "\n" +
            "usage_7d_reset=" + (.seven_day.resets_at // "" | @sh)
        ' "$USAGE_CACHE" 2>/dev/null)"
    elif command -v node &>/dev/null; then
        eval "$(node -e "
            const d=require('fs').readFileSync('$USAGE_CACHE','utf8');
            try{const j=JSON.parse(d);
            console.log('usage_5h='+(j.five_hour?.utilization||0));
            console.log('usage_5h_reset=\\x27'+(j.five_hour?.resets_at||'')+'\\x27');
            console.log('usage_7d='+(j.seven_day?.utilization||0));
            console.log('usage_7d_reset=\\x27'+(j.seven_day?.resets_at||'')+'\\x27');
            }catch{}
        " 2>/dev/null)"
    fi
}
read_usage_cache

usage_5h_int=${usage_5h%%.*}
usage_7d_int=${usage_7d%%.*}
[ -z "$usage_5h_int" ] && usage_5h_int=0
[ -z "$usage_7d_int" ] && usage_7d_int=0

# Calculer le temps restant avant reset (bash pur — cross-platform)
parse_countdown() {
    local ts="$1"
    [ -z "$ts" ] || [ "$ts" = "null" ] || [ "$ts" = "''" ] && return
    local ts_epoch now_epoch diff h m
    # GNU date (Linux, Git Bash on Windows)
    ts_epoch=$(date -d "$ts" +%s 2>/dev/null)
    # BSD date (macOS) fallback — force UTC since API returns +00:00 timestamps
    if [ -z "$ts_epoch" ]; then
        local clean_ts="${ts%%Z*}"
        clean_ts="${clean_ts%%+*}"
        clean_ts="${clean_ts%%.*}"
        ts_epoch=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "$clean_ts" +%s 2>/dev/null)
    fi
    [ -z "$ts_epoch" ] && return
    now_epoch=$(date +%s)
    diff=$((ts_epoch - now_epoch))
    if [ "$diff" -le 0 ]; then
        echo "now"
    else
        h=$((diff / 3600))
        m=$(( (diff % 3600) / 60 ))
        if [ "$h" -gt 0 ]; then
            printf '%dh%02d' "$h" "$m"
        else
            printf '%dm' "$m"
        fi
    fi
}

reset_5h_str=""
if [ -n "$usage_5h_reset" ] && [ "$usage_5h_reset" != "null" ] && [ "$usage_5h_reset" != "''" ]; then
    reset_5h_str=$(parse_countdown "$usage_5h_reset")
fi
reset_5h_str="${reset_5h_str:-—}"

# ─────────────────────────────────────────────────────────────────────────────
# STATUT GIT (cache)
# ─────────────────────────────────────────────────────────────────────────────

is_git_repo=false
if git rev-parse --git-dir > /dev/null 2>&1; then
    is_git_repo=true

    cache_valid=false
    if [ -f "$GIT_CACHE" ]; then
        cache_mtime=$(get_mtime "$GIT_CACHE")
        cache_age=$(($(date +%s) - cache_mtime))
        [ "$cache_age" -lt "$GIT_CACHE_TTL" ] && cache_valid=true
    fi

    if [ "$cache_valid" = true ]; then
        source "$GIT_CACHE"
    else
        branch=$(git branch --show-current 2>/dev/null)
        [ -z "$branch" ] && branch="detached"
        git_root=$(git rev-parse --show-toplevel 2>/dev/null)
        git_root_short="${git_root/#$HOME/~}"
        status_output=$(git status --porcelain 2>/dev/null | grep -v '\.hora/' )
        modified=$(echo "$status_output" | grep -c '^.[MDRC]' 2>/dev/null) || modified=0
        staged=$(echo "$status_output" | grep -c '^[MADRC]' 2>/dev/null) || staged=0
        untracked=$(echo "$status_output" | grep -c '^??' 2>/dev/null) || untracked=0
        total_changed=$((modified + staged))

        mkdir -p "$HORA_STATE_DIR" 2>/dev/null
        cat > "$GIT_CACHE" << GITEOF
branch='$branch'
git_root_short='$git_root_short'
modified=${modified:-0}
staged=${staged:-0}
untracked=${untracked:-0}
total_changed=${total_changed:-0}
GITEOF

        # Last 3 commits + push status
        if git rev-parse --verify "origin/${branch}" >/dev/null 2>&1; then
            unpushed_count=$(git log "origin/${branch}..HEAD" --oneline 2>/dev/null | wc -l | tr -d ' ')
        else
            unpushed_count=999
        fi
        [ -z "$unpushed_count" ] && unpushed_count=0
        printf 'unpushed_count=%d\n' "${unpushed_count:-0}" >> "$GIT_CACHE"

        for _ci in 1 2 3; do
            _ch=$(git log -1 --skip=$((_ci-1)) --format='%h' 2>/dev/null)
            _cs=$(git log -1 --skip=$((_ci-1)) --format='%s' 2>/dev/null | cut -c1-80)
            if [ -n "$_ch" ]; then
                printf -v "c${_ci}_hash" '%s' "$_ch"
                printf -v "c${_ci}_subj" '%s' "$_cs"
                printf 'c%d_hash=%q\n' "$_ci" "$_ch" >> "$GIT_CACHE"
                printf 'c%d_subj=%q\n' "$_ci" "$_cs" >> "$GIT_CACHE"
            fi
        done
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# ETAT DU BACKUP
# ─────────────────────────────────────────────────────────────────────────────

b_str=""
b_icon=""
b_warn=""
if [ -f "$BACKUP_STATE" ]; then
    if command -v jq &>/dev/null; then
        last_backup=$(jq -r '.lastBackup // empty' "$BACKUP_STATE" 2>/dev/null)
        strategy=$(jq -r '.strategy // "none"' "$BACKUP_STATE" 2>/dev/null)
    elif command -v node &>/dev/null; then
        eval "$(node -e "
            const d=require('fs').readFileSync('$BACKUP_STATE','utf8');
            try{const j=JSON.parse(d);
            console.log('last_backup='+(j.lastBackup||''));
            console.log('strategy='+(j.strategy||'none'));
            }catch{}
        " 2>/dev/null)"
    fi
    if [ -n "$last_backup" ]; then
        elapsed_b=0
        if date -d "$last_backup" +%s > /dev/null 2>&1; then
            elapsed_b=$(( $(date +%s) - $(date -d "$last_backup" +%s) ))
        else
            backup_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${last_backup%%.*}" +%s 2>/dev/null || echo 0)
            [ "$backup_epoch" -gt 0 ] && elapsed_b=$(( $(date +%s) - backup_epoch ))
        fi

        b_min=$((elapsed_b / 60))
        b_h=$((elapsed_b / 3600))
        if [ "$b_h" -gt 0 ]; then
            b_str="${b_h}h"
        elif [ "$b_min" -gt 0 ]; then
            b_str="${b_min}min"
        else
            b_str="now"
        fi

        [ "$strategy" = "remote" ] && b_icon="R" || b_icon="L"
        if [ "$is_git_repo" = true ] && [ "${total_changed:-0}" -gt 0 ] && [ "$elapsed_b" -gt 1200 ]; then
            b_warn="!"
        fi
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# TACHE EN COURS (barre de progression doree)
# ─────────────────────────────────────────────────────────────────────────────

task_label=""
task_pct=0
task_total=0
task_done=0
# Session-scoped: utilise les 8 premiers chars du session_id
_sid8="${session_id:0:8}"
TASK_STATE="${HORA_STATE_DIR}/sessions/${_sid8}/current-task.json"

if [ -f "$TASK_STATE" ]; then
    if command -v jq &>/dev/null; then
        eval "$(jq -r '
            "task_label=" + (.label // "" | @sh) + "\n" +
            "task_total=" + (.total // 0 | tostring) + "\n" +
            "task_done=" + (.done // 0 | tostring)
        ' "$TASK_STATE" 2>/dev/null)"
    elif command -v node &>/dev/null; then
        eval "$(node -e "
            const d=require('fs').readFileSync('$TASK_STATE','utf8');
            try{const j=JSON.parse(d);
            console.log('task_label=\\x27'+(j.label||'')+'\\x27');
            console.log('task_total='+(j.total||0));
            console.log('task_done='+(j.done||0));
            }catch{}
        " 2>/dev/null)"
    fi
    if [ -n "$task_label" ] && [ "$task_total" -gt 0 ]; then
        task_pct=$((task_done * 100 / task_total))
        [ "$task_pct" -gt 100 ] && task_pct=100
    fi
fi

# Render gold task progress bar
render_task_bar() {
    local width=$1 pct=$2
    local filled=$((pct * width / 100))
    [ "$filled" -lt 0 ] && filled=0
    [ "$filled" -gt "$width" ] && filled=$width
    local output=""
    for i in $(seq 1 $width 2>/dev/null); do
        if [ "$i" -le "$filled" ]; then
            output="${output}${HORA_PRIMARY}━${RST}"
        else
            output="${output}${HORA_DIM}─${RST}"
        fi
    done
    echo "$output"
}

# ─────────────────────────────────────────────────────────────────────────────
# ETAT DES SNAPSHOTS
# ─────────────────────────────────────────────────────────────────────────────

# Project-scoped: snapshots live in <project-root>/.hora/snapshots/
SNAP_MANIFEST="${PROJECT_HORA_DIR}/snapshots/manifest.jsonl"
snap_count=0
if [ -f "$SNAP_MANIFEST" ]; then
    snap_count=$(wc -l < "$SNAP_MANIFEST" 2>/dev/null | tr -d ' ')
    [ -z "$snap_count" ] && snap_count=0
fi

# ─────────────────────────────────────────────────────────────────────────────
# AGENTS PARALLELES (visuel HORA)
# ─────────────────────────────────────────────────────────────────────────────

active_agents=0
agents_display=""
AGENTS_STATE="${HORA_STATE_DIR}/sessions/${_sid8}/active-agents.json"

if [ -f "$AGENTS_STATE" ]; then
    # Check if file is recent (< 30s old = agents likely still running)
    _agents_age=$(( $(date +%s) - $(get_mtime "$AGENTS_STATE") ))
    if [ "$_agents_age" -lt 30 ]; then
        if command -v jq &>/dev/null; then
            active_agents=$(jq -r '.count // 0' "$AGENTS_STATE" 2>/dev/null)
            agents_display=$(jq -r '.agents // [] | .[] | .name' "$AGENTS_STATE" 2>/dev/null | head -4 | tr '\n' ' ')
        elif command -v node &>/dev/null; then
            eval "$(node -e "
                const d=require('fs').readFileSync('$AGENTS_STATE','utf8');
                try{const j=JSON.parse(d);
                console.log('active_agents='+(j.count||0));
                console.log('agents_display=\\x27'+(j.agents||[]).map(a=>a.name).slice(0,4).join(' ')+'\\x27');
                }catch{}
            " 2>/dev/null)"
        fi
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# COMPTEUR DE SKILLS (HORA vs ALL)
# ─────────────────────────────────────────────────────────────────────────────

hora_skills=0
all_skills=0
SKILLS_DIR="${HOME}/.claude/skills"
if [ -d "$SKILLS_DIR" ]; then
    all_skills=$(find "$SKILLS_DIR" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    hora_skills=$(find "$SKILLS_DIR" -path "*/hora-*/SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    [ -z "$all_skills" ] && all_skills=0
    [ -z "$hora_skills" ] && hora_skills=0
fi

# ─────────────────────────────────────────────────────────────────────────────
# LARGEUR DU TERMINAL & MODE
# ─────────────────────────────────────────────────────────────────────────────

detect_width() {
    local w=""
    # /dev/tty n'existe pas sur Windows — tester avant d'utiliser
    [ -e /dev/tty ] && w=$(stty size </dev/tty 2>/dev/null | awk '{print $2}')
    [ -z "$w" ] || [ "$w" = "0" ] && w=$(tput cols 2>/dev/null)
    [ -z "$w" ] || [ "$w" = "0" ] && w=${COLUMNS:-80}
    echo "$w"
}

term_width=$(detect_width)

if [ "$term_width" -lt 55 ]; then
    MODE="compact"
elif [ "$term_width" -lt 80 ]; then
    MODE="normal"
else
    MODE="full"
fi

# ─────────────────────────────────────────────────────────────────────────────
# PALETTE DE COULEURS (24-bit RGB)
# ─────────────────────────────────────────────────────────────────────────────

RST='\033[0m'

# Structure
SLATE_300='\033[38;2;203;213;225m'
SLATE_400='\033[38;2;148;163;184m'
SLATE_500='\033[38;2;100;116;139m'
SLATE_600='\033[38;2;71;85;105m'

# Semantique
EMERALD='\033[38;2;74;222;128m'
AMBER='\033[38;2;251;191;36m'
ORANGE='\033[38;2;251;146;60m'
ROSE='\033[38;2;251;113;133m'

# Marque Hora (gold #D4A853)
HORA_PRIMARY='\033[38;2;212;168;83m'
HORA_ACCENT='\033[38;2;230;195;120m'
HORA_LIGHT='\033[38;2;245;220;165m'
HORA_DIM='\033[38;2;160;128;64m'

# Git
GIT_BRANCH='\033[38;2;147;197;253m'
GIT_CLEAN='\033[38;2;74;222;128m'
GIT_DIRTY='\033[38;2;251;146;60m'

# Usage
USAGE_LABEL='\033[38;2;217;163;29m'
USAGE_RESET_CLR='\033[38;2;148;163;184m'

# Context bar bucket empty (dark gold)
CTX_EMPTY='\033[38;2;80;64;32m'

# ─────────────────────────────────────────────────────────────────────────────
# FONCTIONS UTILITAIRES
# ─────────────────────────────────────────────────────────────────────────────

# Gradient dore pour bucket position :
# Gold-light(245,220,165) → Gold(212,168,83) → Amber(251,191,36) → Rose(251,113,133)
get_bucket_color() {
    local pos=$1 max=$2
    local pct=$((pos * 100 / max))
    local r g b

    if [ "$pct" -le 33 ]; then
        # Gold-light → Gold
        r=$((245 + (212 - 245) * pct / 33))
        g=$((220 + (168 - 220) * pct / 33))
        b=$((165 + (83 - 165) * pct / 33))
    elif [ "$pct" -le 66 ]; then
        # Gold → Amber
        local t=$((pct - 33))
        r=$((212 + (251 - 212) * t / 33))
        g=$((168 + (191 - 168) * t / 33))
        b=$((83 + (36 - 83) * t / 33))
    else
        # Amber → Rose
        local t=$((pct - 66))
        r=$((251 + (251 - 251) * t / 34))
        g=$((191 + (113 - 191) * t / 34))
        b=$((36 + (133 - 36) * t / 34))
    fi
    printf '\033[38;2;%d;%d;%dm' "$r" "$g" "$b"
}

# Barre de contexte avec gradient par bucket
render_context_bar() {
    local width=$1 pct=$2
    local filled=$((pct * width / 100))
    [ "$filled" -lt 0 ] && filled=0
    [ "$filled" -gt "$width" ] && filled=$width

    local output=""
    local use_spacing=false
    [ "$width" -le 20 ] && use_spacing=true

    for i in $(seq 1 $width 2>/dev/null); do
        if [ "$i" -le "$filled" ]; then
            local color=$(get_bucket_color $i $width)
            output="${output}${color}◆${RST}"
            [ "$use_spacing" = true ] && output="${output} "
        else
            output="${output}${CTX_EMPTY}◇${RST}"
            [ "$use_spacing" = true ] && output="${output} "
        fi
    done

    output="${output% }"
    echo "$output"
}

# Largeur optimale de barre selon le mode
calc_bar_width() {
    local mode=$1
    local content_width=$((term_width - 10))
    [ "$content_width" -gt 70 ] && content_width=70
    [ "$content_width" -lt 40 ] && content_width=40
    local prefix_len suffix_len bucket_size available

    case "$mode" in
        compact)
            prefix_len=5    # "HORA "
            suffix_len=5    # " XX%"
            bucket_size=2   # char + space
            ;;
        normal)
            prefix_len=10   # "HORA ctx: "
            suffix_len=5    # " XX%"
            bucket_size=2
            ;;
        full)
            prefix_len=14   # "◆ CONTEXTE : "
            suffix_len=5    # " XXX%"
            bucket_size=1   # dense, no spacing
            ;;
    esac

    available=$((content_width - prefix_len - suffix_len))
    echo $((available / bucket_size))
}

# Couleur pour pourcentage (usage)
get_usage_color() {
    local p="${1%%.*}"
    [ -z "$p" ] && p=0
    if   [ "$p" -ge 80 ]; then echo "$ROSE"
    elif [ "$p" -ge 60 ]; then echo "$ORANGE"
    elif [ "$p" -ge 40 ]; then echo "$AMBER"
    else echo "$EMERALD"
    fi
}

# Couleur pour pourcentage (contexte)
pct_color() {
    local p=$1
    if   [ "$p" -ge 80 ]; then echo "$ROSE"
    elif [ "$p" -ge 60 ]; then echo "$ORANGE"
    elif [ "$p" -ge 40 ]; then echo "$AMBER"
    else echo "$EMERALD"
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# ATTENDRE LE FETCH USAGE (si encore en cours)
# ─────────────────────────────────────────────────────────────────────────────

wait $USAGE_PID 2>/dev/null

# Relire le cache si le fetch a mis a jour
read_usage_cache

usage_5h_int=${usage_5h%%.*}
usage_7d_int=${usage_7d%%.*}
[ -z "$usage_5h_int" ] && usage_5h_int=0
[ -z "$usage_7d_int" ] && usage_7d_int=0

# Recalculer le reset time si pas deja fait
if [ -n "$usage_5h_reset" ] && [ "$usage_5h_reset" != "null" ] && [ "$usage_5h_reset" != "''" ] && [ "$reset_5h_str" = "—" ]; then
    reset_5h_str=$(parse_countdown "$usage_5h_reset")
    reset_5h_str="${reset_5h_str:-—}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# AFFICHAGE
# ─────────────────────────────────────────────────────────────────────────────

ctx_c=$(pct_color "$ctx_pct_int")
bar_width=$(calc_bar_width "$MODE")

case "$MODE" in
    compact)
        # Ligne 1 : HORA + barre contexte
        bar=$(render_context_bar "$bar_width" "$ctx_pct_int")
        printf "${HORA_PRIMARY}HORA${RST} ${bar} ${ctx_c}${ctx_pct_int}%%${RST}"
        [ "$duration_sec" -gt 0 ] && printf " ${SLATE_400}${time_display}${RST}"
        printf "\n"

        # Ligne task (si tache en cours)
        if [ -n "$task_label" ] && [ "$task_total" -gt 0 ]; then
            _task_bar_w=$((bar_width > 15 ? 15 : bar_width))
            _tbar=$(render_task_bar "$_task_bar_w" "$task_pct")
            printf "${HORA_ACCENT}▸${RST} ${SLATE_300}${task_label}${RST} ${_tbar} ${HORA_PRIMARY}${task_done}/${task_total}${RST}\n"
        fi

        # Ligne 2 : git + protection
        if [ "$is_git_repo" = true ]; then
            printf "${GIT_BRANCH}${branch}${RST}"
            if [ "${total_changed:-0}" -gt 0 ] || [ "${untracked:-0}" -gt 0 ]; then
                printf " ${GIT_DIRTY}*${total_changed}${RST}"
            else
                printf " ${GIT_CLEAN}ok${RST}"
            fi
            if [ -n "$b_str" ]; then
                printf " ${SLATE_400}${b_icon}:${b_str}${b_warn}${RST}"
            fi
            [ "$snap_count" -gt 0 ] && printf " ${HORA_DIM}${snap_count}snap${RST}"
            [ "$hora_skills" -gt 0 ] && printf " ${HORA_ACCENT}${hora_skills}h${RST}${SLATE_600}/${RST}${SLATE_400}${all_skills}sk${RST}"
            # Usage compact
            if [ "$usage_5h_int" -gt 0 ]; then
                u5_c=$(get_usage_color "$usage_5h_int")
                printf " ${u5_c}${usage_5h_int}%%${RST}${USAGE_RESET_CLR}↻${reset_5h_str}${RST}"
            fi
            printf "\n"
        elif [ "$snap_count" -gt 0 ] || [ "$all_skills" -gt 0 ]; then
            [ "$snap_count" -gt 0 ] && printf "${HORA_DIM}${snap_count}snap${RST} "
            [ "$hora_skills" -gt 0 ] && printf "${HORA_ACCENT}${hora_skills}h${RST}${SLATE_600}/${RST}${SLATE_400}${all_skills}sk${RST}"
            printf "\n"
        fi
        ;;

    normal)
        # Ligne 1 : HORA + barre contexte + duree
        bar=$(render_context_bar "$bar_width" "$ctx_pct_int")
        printf "${HORA_PRIMARY}HORA${RST} ${SLATE_500}ctx:${RST} ${bar} ${ctx_c}${ctx_pct_int}%%${RST}"
        [ "$duration_sec" -gt 0 ] && printf " ${SLATE_600}|${RST} ${SLATE_400}${time_display}${RST}"
        printf "\n"

        # Ligne task (si tache en cours)
        if [ -n "$task_label" ] && [ "$task_total" -gt 0 ]; then
            _task_bar_w=$((bar_width > 25 ? 25 : bar_width))
            _tbar=$(render_task_bar "$_task_bar_w" "$task_pct")
            printf "${HORA_ACCENT}▸${RST} ${SLATE_500}TACHE :${RST} ${SLATE_300}${task_label}${RST} ${_tbar} ${HORA_PRIMARY}${task_pct}%%${RST} ${SLATE_400}(${task_done}/${task_total})${RST}\n"
        fi

        # Ligne agents paralleles
        if [ "${active_agents:-0}" -gt 0 ]; then
            _dots_n=$(( $(date +%s) % 3 + 1 ))
            _dots=$(printf '%*s' "$_dots_n" '' | tr ' ' '◆')
            printf "${HORA_ACCENT}▸ ${active_agents} agents${RST} ${HORA_PRIMARY}${_dots}${RST}\n"
        fi

        # Ligne 2 : git + backup + snap
        if [ "$is_git_repo" = true ]; then
            printf "${SLATE_500}git:${RST} ${GIT_BRANCH}${branch}${RST}"
            if [ "${total_changed:-0}" -gt 0 ] || [ "${untracked:-0}" -gt 0 ]; then
                printf " ${GIT_DIRTY}*${total_changed}${RST}"
                [ "${untracked:-0}" -gt 0 ] && printf " ${SLATE_400}+${untracked}${RST}"
            else
                printf " ${GIT_CLEAN}propre${RST}"
            fi
            if [ -n "$b_str" ]; then
                printf " ${SLATE_600}|${RST} ${SLATE_500}bak:${RST} ${SLATE_400}${b_icon}:${b_str}${b_warn}${RST}"
            fi
            [ "$snap_count" -gt 0 ] && printf " ${SLATE_600}|${RST} ${HORA_DIM}snap:${snap_count}${RST}"
            [ "$hora_skills" -gt 0 ] && printf " ${SLATE_600}|${RST} ${HORA_ACCENT}hora:${hora_skills}${RST}${SLATE_600}/${RST}${SLATE_400}${all_skills}sk${RST}"
            printf "\n"
        elif [ "$snap_count" -gt 0 ] || [ "$all_skills" -gt 0 ]; then
            [ "$snap_count" -gt 0 ] && printf "${HORA_DIM}snap:${snap_count}${RST} "
            [ "$hora_skills" -gt 0 ] && printf "${HORA_ACCENT}hora:${hora_skills}${RST}${SLATE_600}/${RST}${SLATE_400}${all_skills}sk${RST}"
            printf "\n"
        fi

        # Ligne commits
        if [ "$is_git_repo" = true ] && [ -n "$c1_hash" ]; then
            printf "${SLATE_500}log:${RST}"
            for _ci in 1 2 3; do
                _vn="c${_ci}_hash"; _ch="${!_vn}"
                _vn="c${_ci}_subj"; _cs="${!_vn}"
                [ -z "$_ch" ] && continue
                _cs_short=$(echo "$_cs" | cut -c1-18)
                if [ "${unpushed_count:-0}" -ge "$_ci" ]; then
                    printf " ${ORANGE}●${RST}${SLATE_400}${_ch}${RST} ${SLATE_300}${_cs_short}${RST}"
                else
                    printf " ${EMERALD}✓${RST}${SLATE_400}${_ch}${RST} ${SLATE_300}${_cs_short}${RST}"
                fi
            done
            printf "\n"
        fi

        # Ligne 3 : Usage (si data disponible)
        if [ "$usage_5h_int" -gt 0 ] || [ "$usage_7d_int" -gt 0 ]; then
            u5_c=$(get_usage_color "$usage_5h_int")
            u7_c=$(get_usage_color "$usage_7d_int")
            printf "${AMBER}▰${RST} ${USAGE_RESET_CLR}5H:${RST} ${u5_c}${usage_5h_int}%%${RST} ${USAGE_RESET_CLR}↻${reset_5h_str}${RST} ${SLATE_600}|${RST} ${USAGE_RESET_CLR}WK:${RST} ${u7_c}${usage_7d_int}%%${RST}\n"
        fi
        ;;

    full)
        # Separateur header dore (fixe 80 cols)
        printf "${HORA_DIM}────${RST} ${HORA_PRIMARY}H${HORA_ACCENT}O${HORA_LIGHT}R${HORA_PRIMARY}A${RST} ${HORA_DIM}──────────────────────────────────────────────────────────────────────${RST}\n"

        # Ligne 1 : Barre de contexte
        bar=$(render_context_bar "$bar_width" "$ctx_pct_int")
        printf "${HORA_PRIMARY}◆${RST} ${SLATE_500}CONTEXTE :${RST} ${bar} ${ctx_c}${ctx_pct_int}%%${RST}"
        [ "$duration_sec" -gt 0 ] && printf " ${SLATE_600}|${RST} ${SLATE_400}${time_display}${RST}"
        printf "\n"

        # Ligne task (si tache en cours) — barre de progression doree
        if [ -n "$task_label" ] && [ "$task_total" -gt 0 ]; then
            _task_bar_w=$((bar_width > 30 ? 30 : bar_width))
            _tbar=$(render_task_bar "$_task_bar_w" "$task_pct")
            _task_short=$(echo "$task_label" | cut -c1-40)
            printf "${HORA_PRIMARY}◆${RST} ${HORA_ACCENT}TACHE :${RST} ${SLATE_300}${_task_short}${RST} ${_tbar} ${HORA_PRIMARY}${task_pct}%%${RST} ${SLATE_400}(${task_done}/${task_total})${RST}\n"
        fi

        # Ligne 2 : Usage
        if [ "$usage_5h_int" -gt 0 ] || [ "$usage_7d_int" -gt 0 ]; then
            u5_c=$(get_usage_color "$usage_5h_int")
            u7_c=$(get_usage_color "$usage_7d_int")
            printf "${HORA_PRIMARY}◆${RST} ${USAGE_LABEL}USAGE :${RST} ${USAGE_RESET_CLR}5H:${RST} ${u5_c}${usage_5h_int}%%${RST} ${SLATE_400}(reset ${reset_5h_str})${RST} ${SLATE_600}|${RST} ${USAGE_RESET_CLR}WK:${RST} ${u7_c}${usage_7d_int}%%${RST}\n"
        fi

        # Ligne 3 : Git
        if [ "$is_git_repo" = true ]; then
            printf "${HORA_PRIMARY}◆${RST} ${SLATE_500}GIT :${RST} ${GIT_BRANCH}${branch}${RST}"
            [ -n "$git_root_short" ] && printf " ${SLATE_600}|${RST} ${SLATE_400}${git_root_short}${RST}"
            if [ "${total_changed:-0}" -gt 0 ] || [ "${untracked:-0}" -gt 0 ]; then
                printf " ${SLATE_600}|${RST} ${GIT_DIRTY}Modif:${total_changed}${RST}"
                [ "${untracked:-0}" -gt 0 ] && printf " ${SLATE_400}Nouv:${untracked}${RST}"
            else
                printf " ${SLATE_600}|${RST} ${GIT_CLEAN}propre${RST}"
            fi
            if [ -n "$b_str" ]; then
                printf " ${SLATE_600}|${RST} ${SLATE_500}Backup:${RST} ${SLATE_400}${b_icon} ${b_str}${RST}"
                [ -n "$b_warn" ] && printf " ${ROSE}${b_warn}${RST}"
            fi
            printf "\n"

            # Derniers commits (texte responsive)
            if [ -n "$c1_hash" ]; then
                # Largeur dispo pour le sujet : terminal - prefix(14) - mark(2) - hash(8) - spaces(3)
                _subj_max=$((term_width - 27))
                [ "$_subj_max" -lt 10 ] && _subj_max=10
                [ "$_subj_max" -gt 60 ] && _subj_max=60
                for _ci in 1 2 3; do
                    _vn="c${_ci}_hash"; _ch="${!_vn}"
                    _vn="c${_ci}_subj"; _cs="${!_vn}"
                    [ -z "$_ch" ] && continue
                    _cs_trunc=$(echo "$_cs" | cut -c1-${_subj_max})
                    if [ "${unpushed_count:-0}" -ge "$_ci" ]; then
                        _mark="${ORANGE}●${RST}"
                    else
                        _mark="${EMERALD}✓${RST}"
                    fi
                    if [ "$_ci" -eq 1 ]; then
                        printf "${HORA_PRIMARY}◆${RST} ${SLATE_500}COMMITS :${RST} ${_mark} ${SLATE_400}${_ch}${RST} ${SLATE_300}${_cs_trunc}${RST}\n"
                    else
                        printf "${HORA_PRIMARY}◆${RST}           ${_mark} ${SLATE_400}${_ch}${RST} ${SLATE_300}${_cs_trunc}${RST}\n"
                    fi
                done
            fi
        fi

        # Ligne agents paralleles (si actifs)
        if [ "${active_agents:-0}" -gt 0 ]; then
            printf "${HORA_PRIMARY}◆${RST} ${HORA_ACCENT}PARALLEL :${RST} ${HORA_PRIMARY}${active_agents} agents${RST}"
            if [ -n "$agents_display" ]; then
                printf " ${HORA_DIM}━${RST} ${SLATE_300}${agents_display}${RST}"
            fi
            # Animated spinner dots (based on seconds)
            _dots_n=$(( $(date +%s) % 3 + 1 ))
            _dots=$(printf '%*s' "$_dots_n" '' | tr ' ' '◆')
            printf " ${HORA_PRIMARY}${_dots}${RST}"
            printf "\n"
        fi

        # Ligne 4 : Snap + Modele + Skills
        printf "${HORA_PRIMARY}◆${RST} "
        [ "$snap_count" -gt 0 ] && printf "${HORA_DIM}SNAP:${RST} ${SLATE_400}${snap_count} proteges${RST} ${SLATE_600}|${RST} "
        printf "${SLATE_500}MODELE :${RST} ${HORA_ACCENT}${model_name}${RST}"
        [ "$hora_skills" -gt 0 ] && printf " ${SLATE_600}|${RST} ${SLATE_500}SKILLS :${RST} ${HORA_ACCENT}${hora_skills} hora${RST}${SLATE_600}/${RST}${SLATE_400}${all_skills} total${RST}"
        printf "\n"

        # Separateur footer dore (fixe 80 cols)
        printf "${HORA_DIM}──────────────────────────────────────────────────────────────────────────────────${RST}\n"
        ;;
esac
