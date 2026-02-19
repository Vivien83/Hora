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
# Usage 5h/7d via API OAuth Anthropic (cache 60s).
# ═══════════════════════════════════════════════════════════════════════════════

set -o pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

HORA_STATE_DIR="${HOME}/.claude/.hora"
BACKUP_STATE="${HORA_STATE_DIR}/backup-state.json"
GIT_CACHE="${HORA_STATE_DIR}/git-cache.sh"
USAGE_CACHE="${HORA_STATE_DIR}/usage-cache.json"
GIT_CACHE_TTL=5     # secondes
USAGE_CACHE_TTL=60  # secondes

# mtime cross-platform (epoch)
get_mtime() {
    stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0
}

# ─────────────────────────────────────────────────────────────────────────────
# LECTURE DU JSON — un seul appel jq
# ─────────────────────────────────────────────────────────────────────────────

input=$(cat)

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

    # Extraire le token OAuth depuis le Keychain macOS
    local keychain_data token
    keychain_data=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null)
    token=$(echo "$keychain_data" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('claudeAiOauth',{}).get('accessToken',''))" 2>/dev/null)

    if [ -n "$token" ]; then
        local usage_json
        usage_json=$(curl -s --max-time 3 \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -H "anthropic-beta: oauth-2025-04-20" \
            "https://api.anthropic.com/api/oauth/usage" 2>/dev/null)

        if [ -n "$usage_json" ] && echo "$usage_json" | jq -e '.five_hour' >/dev/null 2>&1; then
            echo "$usage_json" | jq '.' > "$USAGE_CACHE" 2>/dev/null
        fi
    fi
}

# Fetch en arriere-plan pour ne pas bloquer
fetch_usage &
USAGE_PID=$!

# Lire le cache existant (meme si le fetch tourne en parallele)
if [ -f "$USAGE_CACHE" ]; then
    eval "$(jq -r '
        "usage_5h=" + (.five_hour.utilization // 0 | tostring) + "\n" +
        "usage_5h_reset=" + (.five_hour.resets_at // "" | @sh) + "\n" +
        "usage_7d=" + (.seven_day.utilization // 0 | tostring) + "\n" +
        "usage_7d_reset=" + (.seven_day.resets_at // "" | @sh)
    ' "$USAGE_CACHE" 2>/dev/null)"
fi

usage_5h_int=${usage_5h%%.*}
usage_7d_int=${usage_7d%%.*}
[ -z "$usage_5h_int" ] && usage_5h_int=0
[ -z "$usage_7d_int" ] && usage_7d_int=0

# Calculer le temps restant avant reset 5h
reset_5h_str=""
if [ -n "$usage_5h_reset" ] && [ "$usage_5h_reset" != "null" ] && [ "$usage_5h_reset" != "''" ]; then
    reset_5h_str=$(python3 -c "
from datetime import datetime, timezone
try:
    ts = $usage_5h_reset if isinstance($usage_5h_reset, str) else str($usage_5h_reset)
    if not ts: raise ValueError
    if ts.endswith('Z'):
        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
    elif '+' in ts[10:]:
        dt = datetime.fromisoformat(ts)
    else:
        dt = datetime.fromisoformat(ts + '+00:00')
    diff = int((dt - datetime.now(timezone.utc)).total_seconds())
    if diff <= 0: print('now')
    else:
        h, m = diff // 3600, (diff % 3600) // 60
        print(f'{h}h{m:02d}' if h > 0 else f'{m}m')
except:
    pass
" 2>/dev/null)
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
        status_output=$(git status --porcelain 2>/dev/null)
        modified=$(echo "$status_output" | grep -c '^.[MDRC]' 2>/dev/null || echo 0)
        staged=$(echo "$status_output" | grep -c '^[MADRC]' 2>/dev/null || echo 0)
        untracked=$(echo "$status_output" | grep -c '^??' 2>/dev/null || echo 0)
        total_changed=$((modified + staged))

        mkdir -p "$HORA_STATE_DIR" 2>/dev/null
        cat > "$GIT_CACHE" << GITEOF
branch='$branch'
modified=${modified:-0}
staged=${staged:-0}
untracked=${untracked:-0}
total_changed=${total_changed:-0}
GITEOF
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# ETAT DU BACKUP
# ─────────────────────────────────────────────────────────────────────────────

b_str=""
b_icon=""
b_warn=""
if [ -f "$BACKUP_STATE" ]; then
    last_backup=$(jq -r '.lastBackup // empty' "$BACKUP_STATE" 2>/dev/null)
    strategy=$(jq -r '.strategy // "none"' "$BACKUP_STATE" 2>/dev/null)
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
# ETAT DES SNAPSHOTS
# ─────────────────────────────────────────────────────────────────────────────

SNAP_MANIFEST="${HORA_STATE_DIR}/snapshots/manifest.jsonl"
snap_count=0
if [ -f "$SNAP_MANIFEST" ]; then
    snap_count=$(wc -l < "$SNAP_MANIFEST" 2>/dev/null | tr -d ' ')
    [ -z "$snap_count" ] && snap_count=0
fi

# ─────────────────────────────────────────────────────────────────────────────
# LARGEUR DU TERMINAL & MODE
# ─────────────────────────────────────────────────────────────────────────────

detect_width() {
    local w=""
    w=$(stty size </dev/tty 2>/dev/null | awk '{print $2}')
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

# Marque Hora (terracotta warm)
HORA_PRIMARY='\033[38;2;196;100;74m'
HORA_ACCENT='\033[38;2;220;140;110m'
HORA_LIGHT='\033[38;2;240;180;155m'
HORA_DIM='\033[38;2;160;85;65m'

# Git
GIT_BRANCH='\033[38;2;147;197;253m'
GIT_CLEAN='\033[38;2;74;222;128m'
GIT_DIRTY='\033[38;2;251;146;60m'

# Usage
USAGE_LABEL='\033[38;2;217;163;29m'
USAGE_RESET_CLR='\033[38;2;148;163;184m'

# Context bar bucket empty
CTX_EMPTY='\033[38;2;55;50;45m'

# ─────────────────────────────────────────────────────────────────────────────
# FONCTIONS UTILITAIRES
# ─────────────────────────────────────────────────────────────────────────────

# Gradient terracotta pour bucket position :
# Emerald(74,222,128) → Gold(250,204,21) → Terracotta(196,100,74) → Rose(251,113,133)
get_bucket_color() {
    local pos=$1 max=$2
    local pct=$((pos * 100 / max))
    local r g b

    if [ "$pct" -le 33 ]; then
        # Emerald → Gold
        r=$((74 + (250 - 74) * pct / 33))
        g=$((222 + (204 - 222) * pct / 33))
        b=$((128 + (21 - 128) * pct / 33))
    elif [ "$pct" -le 66 ]; then
        # Gold → Terracotta
        local t=$((pct - 33))
        r=$((250 + (196 - 250) * t / 33))
        g=$((204 + (100 - 204) * t / 33))
        b=$((21 + (74 - 21) * t / 33))
    else
        # Terracotta → Rose
        local t=$((pct - 66))
        r=$((196 + (251 - 196) * t / 34))
        g=$((100 + (113 - 100) * t / 34))
        b=$((74 + (133 - 74) * t / 34))
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
    local content_width=72
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
            prefix_len=14   # "◈ CONTEXTE : "
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
if [ -f "$USAGE_CACHE" ]; then
    eval "$(jq -r '
        "usage_5h=" + (.five_hour.utilization // 0 | tostring) + "\n" +
        "usage_5h_reset=" + (.five_hour.resets_at // "" | @sh) + "\n" +
        "usage_7d=" + (.seven_day.utilization // 0 | tostring) + "\n" +
        "usage_7d_reset=" + (.seven_day.resets_at // "" | @sh)
    ' "$USAGE_CACHE" 2>/dev/null)"

    usage_5h_int=${usage_5h%%.*}
    usage_7d_int=${usage_7d%%.*}
    [ -z "$usage_5h_int" ] && usage_5h_int=0
    [ -z "$usage_7d_int" ] && usage_7d_int=0

    # Recalculer le reset time si pas deja fait
    if [ -n "$usage_5h_reset" ] && [ "$usage_5h_reset" != "null" ] && [ "$usage_5h_reset" != "''" ] && [ "$reset_5h_str" = "—" ]; then
        reset_5h_str=$(python3 -c "
from datetime import datetime, timezone
try:
    ts = $usage_5h_reset if isinstance($usage_5h_reset, str) else str($usage_5h_reset)
    if not ts: raise ValueError
    if ts.endswith('Z'):
        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
    elif '+' in ts[10:]:
        dt = datetime.fromisoformat(ts)
    else:
        dt = datetime.fromisoformat(ts + '+00:00')
    diff = int((dt - datetime.now(timezone.utc)).total_seconds())
    if diff <= 0: print('now')
    else:
        h, m = diff // 3600, (diff % 3600) // 60
        print(f'{h}h{m:02d}' if h > 0 else f'{m}m')
except:
    pass
" 2>/dev/null)
        reset_5h_str="${reset_5h_str:-—}"
    fi
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
            # Usage compact
            if [ "$usage_5h_int" -gt 0 ]; then
                u5_c=$(get_usage_color "$usage_5h_int")
                printf " ${u5_c}${usage_5h_int}%%${RST}${USAGE_RESET_CLR}↻${reset_5h_str}${RST}"
            fi
            printf "\n"
        elif [ "$snap_count" -gt 0 ]; then
            printf "${HORA_DIM}${snap_count}snap${RST}\n"
        fi
        ;;

    normal)
        # Ligne 1 : HORA + barre contexte + duree
        bar=$(render_context_bar "$bar_width" "$ctx_pct_int")
        printf "${HORA_PRIMARY}HORA${RST} ${SLATE_500}ctx:${RST} ${bar} ${ctx_c}${ctx_pct_int}%%${RST}"
        [ "$duration_sec" -gt 0 ] && printf " ${SLATE_600}|${RST} ${SLATE_400}${time_display}${RST}"
        printf "\n"

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
            printf "\n"
        elif [ "$snap_count" -gt 0 ]; then
            printf "${HORA_DIM}snap:${snap_count}${RST}\n"
        fi

        # Ligne 3 : Usage (si data disponible)
        if [ "$usage_5h_int" -gt 0 ] || [ "$usage_7d_int" -gt 0 ]; then
            u5_c=$(get_usage_color "$usage_5h_int")
            u7_c=$(get_usage_color "$usage_7d_int")
            printf "${AMBER}▰${RST} ${USAGE_RESET_CLR}5H:${RST} ${u5_c}${usage_5h_int}%%${RST} ${USAGE_RESET_CLR}↻${reset_5h_str}${RST} ${SLATE_600}|${RST} ${USAGE_RESET_CLR}WK:${RST} ${u7_c}${usage_7d_int}%%${RST}\n"
        fi
        ;;

    full)
        # Separateur header
        printf "${SLATE_600}── |${RST} ${HORA_PRIMARY}H${HORA_ACCENT}O${HORA_LIGHT}R${HORA_PRIMARY}A${RST} ${SLATE_600}| ────────────────────────────────────────────────────────────${RST}\n"

        # Ligne 1 : Barre de contexte
        bar=$(render_context_bar "$bar_width" "$ctx_pct_int")
        printf "${HORA_PRIMARY}◈${RST} ${SLATE_500}CONTEXTE :${RST} ${bar} ${ctx_c}${ctx_pct_int}%%${RST}"
        [ "$duration_sec" -gt 0 ] && printf " ${SLATE_600}|${RST} ${SLATE_400}${time_display}${RST}"
        printf "\n"

        # Ligne 2 : Usage
        if [ "$usage_5h_int" -gt 0 ] || [ "$usage_7d_int" -gt 0 ]; then
            u5_c=$(get_usage_color "$usage_5h_int")
            u7_c=$(get_usage_color "$usage_7d_int")
            printf "${HORA_PRIMARY}◈${RST} ${USAGE_LABEL}USAGE :${RST} ${USAGE_RESET_CLR}5H:${RST} ${u5_c}${usage_5h_int}%%${RST} ${USAGE_RESET_CLR}↻${SLATE_500}${reset_5h_str}${RST} ${SLATE_600}|${RST} ${USAGE_RESET_CLR}WK:${RST} ${u7_c}${usage_7d_int}%%${RST}\n"
        fi

        # Ligne 3 : Git
        if [ "$is_git_repo" = true ]; then
            printf "${HORA_PRIMARY}◈${RST} ${SLATE_500}GIT :${RST} ${GIT_BRANCH}${branch}${RST}"
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
        fi

        # Ligne 4 : Snap + Modele
        printf "${HORA_PRIMARY}◈${RST} "
        [ "$snap_count" -gt 0 ] && printf "${HORA_DIM}SNAP:${RST} ${SLATE_400}${snap_count} proteges${RST} ${SLATE_600}|${RST} "
        printf "${SLATE_500}MODELE :${RST} ${HORA_ACCENT}${model_name}${RST}\n"

        # Separateur footer
        printf "${SLATE_600}────────────────────────────────────────────────────────────────────────${RST}\n"
        ;;
esac
