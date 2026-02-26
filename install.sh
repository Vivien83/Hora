#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# HORA — Install Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Backup versionnee, restore complet, nettoyage legacy (PAI), detection orphelins.
#
# Usage :
#   bash install.sh                        # Installation
#   bash install.sh --dry-run              # Simulation (rien modifie)
#   bash install.sh --restore              # Restaurer le dernier backup
#   bash install.sh --restore <timestamp>  # Restaurer un backup specifique
#   bash install.sh --list-backups         # Lister les backups disponibles
#
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

HORA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/claude"
CLAUDE_DIR="$HOME/.claude"
BACKUP_BASE="$HOME/.hora-install-backup"
BACKUP_MAX=5
DRY_RUN=false

# ─────────────────────────────────────────────────────────────────────────────
# INVENTAIRE
# ─────────────────────────────────────────────────────────────────────────────

# Donnees Claude Code (jamais modifiees par HORA — sauvegardees pour securite)
CLAUDE_SESSION_DATA=(
  "projects"
  "todos"
  "history.jsonl"
  "session-env"
  ".credentials.json"
  "settings.local.json"
  "commands"
  "plugins"
  "file-history"
  "statsig"
)

# Fichiers crees/modifies par HORA (sauvegardes pour rollback)
HORA_MANAGED=(
  "settings.json"
  "CLAUDE.md"
  "statusline.sh"
  "hooks"
  "agents"
  "skills"
  ".hora/patterns.yaml"
)

# Patterns legacy (PAI et predecesseurs) pour nettoyage
LEGACY_PATTERNS=("PAI_DIR" "pai-" "PAI -" "pai_")

# ─────────────────────────────────────────────────────────────────────────────
# WRAPPERS DRY-RUN
# ─────────────────────────────────────────────────────────────────────────────

_cp()    { if $DRY_RUN; then echo "   [DRY-RUN] cp $*"; else cp "$@"; fi; }
_mkdir() { if $DRY_RUN; then echo "   [DRY-RUN] mkdir $*"; else mkdir "$@"; fi; }
_rm()    { if $DRY_RUN; then echo "   [DRY-RUN] rm $*"; else rm "$@"; fi; }
_chmod() { if $DRY_RUN; then echo "   [DRY-RUN] chmod $*"; else chmod "$@"; fi; }
_touch() { if $DRY_RUN; then echo "   [DRY-RUN] touch $*"; else touch "$@"; fi; }

# ─────────────────────────────────────────────────────────────────────────────
# UI SYSTEM
# ─────────────────────────────────────────────────────────────────────────────

# Colors (disabled if not terminal or NO_COLOR set)
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ] && [ "${TERM:-dumb}" != "dumb" ]; then
  BOLD='\033[1m'
  DIM='\033[2m'
  RESET='\033[0m'
  RED='\033[31m'
  GREEN='\033[32m'
  YELLOW='\033[33m'
  CYAN='\033[36m'
  WHITE='\033[97m'
  GRAY='\033[90m'
  # Unicode symbols
  SYM_OK="✓"
  SYM_ERR="✗"
  SYM_WARN="!"
  SYM_INFO="·"
  SYM_ARROW="→"
  SYM_DOT="●"
else
  BOLD='' DIM='' RESET='' RED='' GREEN='' YELLOW='' CYAN='' WHITE='' GRAY=''
  SYM_OK="OK"
  SYM_ERR="X"
  SYM_WARN="!"
  SYM_INFO="-"
  SYM_ARROW="->"
  SYM_DOT="*"
fi

STEP_CURRENT=0
STEP_TOTAL=9

ui_header() {
  local GOLD='\033[38;2;212;168;83m'
  local DIM_GOLD='\033[38;2;160;128;64m'
  printf "\n"
  printf "${GOLD}${BOLD}"
  printf "  ██╗  ██╗ ██████╗ ██████╗  █████╗ \n"
  printf "  ██║  ██║██╔═══██╗██╔══██╗██╔══██╗\n"
  printf "  ███████║██║   ██║██████╔╝███████║\n"
  printf "  ██╔══██║██║   ██║██╔══██╗██╔══██║\n"
  printf "  ██║  ██║╚██████╔╝██║  ██║██║  ██║\n"
  printf "${DIM_GOLD}"
  printf "  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝\n"
  printf "${RESET}\n"
  printf "  ${DIM}your memory never sleeps.${RESET}\n"
  printf "  ${DIM_GOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
  printf "\n"
  if $DRY_RUN; then
    printf "  ${YELLOW}${BOLD}DRY RUN${RESET} ${DIM}— aucune modification ne sera effectuee${RESET}\n\n"
  fi
}

ui_step() {
  STEP_CURRENT=$((STEP_CURRENT + 1))
  printf "\n  ${BOLD}${WHITE}[${STEP_CURRENT}/${STEP_TOTAL}]${RESET} ${BOLD}$1${RESET}\n"
}

ui_ok() {
  printf "  ${GREEN}  ${SYM_OK}${RESET} $1\n"
}

ui_warn() {
  printf "  ${YELLOW}  ${SYM_WARN}${RESET} $1\n"
}

ui_err() {
  printf "  ${RED}  ${SYM_ERR}${RESET} $1\n"
}

ui_info() {
  printf "  ${DIM}  ${SYM_INFO} $1${RESET}\n"
}

ui_detail() {
  printf "  ${DIM}    $1${RESET}\n"
}

ui_summary() {
  local skills_count hooks_count agents_count
  skills_count=$(find "$HORA_DIR/skills" -name SKILL.md 2>/dev/null | wc -l | tr -d ' ')
  hooks_count=$(ls "$HORA_DIR/hooks/"*.ts 2>/dev/null | wc -l | tr -d ' ')
  agents_count=$(ls "$HORA_DIR/agents/"*.md 2>/dev/null | wc -l | tr -d ' ')

  local GOLD='\033[38;2;212;168;83m'
  local DIM_GOLD='\033[38;2;160;128;64m'
  printf "\n"
  printf "  ${DIM_GOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
  printf "\n"
  if $DRY_RUN; then
    printf "  ${YELLOW}${BOLD}DRY RUN termine${RESET} ${DIM}— rien n'a ete modifie${RESET}\n"
  else
    printf "  ${GREEN}${BOLD}${SYM_OK} Installation terminee${RESET}\n"
  fi
  printf "\n"
  printf "  ${DIM}Composants :${RESET}\n"
  printf "    ${GOLD}⟐${RESET} ${BOLD}${hooks_count}${RESET} hooks  ${DIM_GOLD}│${RESET}  ${BOLD}${agents_count}${RESET} agents  ${DIM_GOLD}│${RESET}  ${BOLD}${skills_count}${RESET} skills\n"
  printf "\n"
  printf "  ${BOLD}Demarrer${RESET}   ${GOLD}hora${RESET}  ${DIM}(Claude + Dashboard)${RESET}\n"
  printf "  ${BOLD}Claude${RESET}     ${DIM}hora --no-dash  ${RESET}${DIM}(sans dashboard)${RESET}\n"
  printf "  ${BOLD}Skills${RESET}     ${DIM}/hora-design  /hora-forge  /hora-refactor  /hora-security  /hora-perf${RESET}\n"
  printf "  ${BOLD}Backup${RESET}     ${DIM}bash install.sh --restore${RESET}\n"
  printf "\n"
}

# ─────────────────────────────────────────────────────────────────────────────
# BACKUP (versionnee, rotation automatique)
# ─────────────────────────────────────────────────────────────────────────────

backup_all() {
  # Verifier s'il y a quelque chose a sauvegarder
  local has_data=false
  for item in "${CLAUDE_SESSION_DATA[@]}" "${HORA_MANAGED[@]}"; do
    [ -e "$CLAUDE_DIR/$item" ] && has_data=true && break
  done
  $has_data || return 0

  # Migration : si "latest" est un dossier/symlink (ancienne version), le supprimer
  if [ -d "$BACKUP_BASE/latest" ] || [ -L "$BACKUP_BASE/latest" ]; then
    rm -rf "$BACKUP_BASE/latest"
  fi

  local ts
  ts=$(date +%Y%m%d-%H%M%S)
  local backup_dir="$BACKUP_BASE/$ts"

  _mkdir -p "$backup_dir"
  ui_info "Snapshot ${BOLD}$ts${RESET}"

  # Donnees de session Claude Code
  for item in "${CLAUDE_SESSION_DATA[@]}"; do
    if [ -e "$CLAUDE_DIR/$item" ]; then
      _cp -r "$CLAUDE_DIR/$item" "$backup_dir/"
      ui_detail "$item"
    fi
  done

  # Fichiers geres par HORA
  for item in "${HORA_MANAGED[@]}"; do
    if [ -e "$CLAUDE_DIR/$item" ]; then
      local parent
      parent=$(dirname "$item")
      if [ "$parent" != "." ]; then
        _mkdir -p "$backup_dir/$parent"
      fi
      _cp -r "$CLAUDE_DIR/$item" "$backup_dir/$item"
      ui_detail "$item"
    fi
  done

  if ! $DRY_RUN; then
    # Mettre a jour le marqueur latest (fichier texte, pas symlink — Windows compat)
    echo "$ts" > "$BACKUP_BASE/latest"

    # Rotation : garder les BACKUP_MAX derniers
    local backups=()
    while IFS= read -r d; do
      backups+=("$d")
    done < <(ls -1d "$BACKUP_BASE"/2* 2>/dev/null | sort)

    local count=${#backups[@]}
    if [ "$count" -gt "$BACKUP_MAX" ]; then
      local to_remove=$((count - BACKUP_MAX))
      for ((i=0; i<to_remove; i++)); do
        rm -rf "${backups[$i]}"
        ui_detail "rotation: $(basename "${backups[$i]}")"
      done
    fi
  fi

  echo "   -> $backup_dir"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# RESTORE (complet — session + config)
# ─────────────────────────────────────────────────────────────────────────────

do_restore() {
  local target="${1:-latest}"

  # --list-backups ou --restore list
  if [ "$target" = "list" ]; then
    ui_header
    printf "  ${BOLD}Snapshots disponibles${RESET}\n\n"
    if [ -d "$BACKUP_BASE" ] && ls -1d "$BACKUP_BASE"/2* &>/dev/null; then
      for d in $(ls -1d "$BACKUP_BASE"/2* | sort -r); do
        local name
        name=$(basename "$d")
        local marker=""
        if [ -f "$BACKUP_BASE/latest" ]; then
          [ "$(cat "$BACKUP_BASE/latest" 2>/dev/null | tr -d '[:space:]')" = "$name" ] && marker=" ${CYAN}${SYM_ARROW} latest${RESET}"
        fi
        # Compter les elements dans le backup
        local file_count
        file_count=$(find "$d" -maxdepth 1 -not -name "$(basename "$d")" | wc -l | tr -d ' ')
        printf "    ${SYM_DOT} ${BOLD}$name${RESET}  ${DIM}($file_count elements)${RESET}$marker\n"
      done
    else
      ui_info "aucun backup"
    fi
    printf "\n  ${DIM}Restaurer : bash install.sh --restore <timestamp>${RESET}\n\n"
    exit 0
  fi

  # Resoudre "latest"
  local restore_dir
  if [ "$target" = "latest" ]; then
    if [ ! -f "$BACKUP_BASE/latest" ]; then
      ui_err "Aucun backup 'latest' trouve"
      ui_detail "bash install.sh --list-backups"
      exit 1
    fi
    restore_dir="$BACKUP_BASE/$(cat "$BACKUP_BASE/latest" | tr -d '[:space:]')"
  else
    restore_dir="$BACKUP_BASE/$target"
  fi

  if [ ! -d "$restore_dir" ]; then
    ui_err "Backup introuvable : $target"
    ui_detail "bash install.sh --list-backups"
    exit 1
  fi

  ui_header
  printf "  ${BOLD}Restauration depuis ${CYAN}$(basename "$restore_dir")${RESET}\n\n"

  # Restaurer les donnees de session
  for item in "${CLAUDE_SESSION_DATA[@]}"; do
    if [ -e "$restore_dir/$item" ]; then
      rm -rf "$CLAUDE_DIR/$item"
      cp -r "$restore_dir/$item" "$CLAUDE_DIR/"
      ui_detail "$item"
    fi
  done

  # Restaurer les fichiers HORA-managed
  for item in "${HORA_MANAGED[@]}"; do
    if [ -e "$restore_dir/$item" ]; then
      # Supprimer l'actuel (fichier ou dossier)
      rm -rf "$CLAUDE_DIR/$item"
      # Creer le parent si besoin
      local parent
      parent=$(dirname "$CLAUDE_DIR/$item")
      [ ! -d "$parent" ] && mkdir -p "$parent"
      # Restaurer
      cp -r "$restore_dir/$item" "$CLAUDE_DIR/$item"
      ui_ok "$item"
    elif [ -e "$CLAUDE_DIR/$item" ]; then
      # L'item n'existait pas avant HORA → le supprimer
      rm -rf "$CLAUDE_DIR/$item"
      ui_detail "$item supprime"
    fi
  done

  printf "\n"
  printf "  ${GREEN}${BOLD}${SYM_OK} Etat restaure${RESET}\n\n"
  ui_info "MEMORY/ non affecte par le restore"
  ui_info "Reinstaller : bash install.sh"
  printf "\n"
  exit 0
}

# ─────────────────────────────────────────────────────────────────────────────
# NETTOYAGE LEGACY (PAI et predecesseurs)
# ─────────────────────────────────────────────────────────────────────────────

cleanup_legacy() {
  local cleaned=0
  ui_info "Recherche d'artefacts legacy..."

  # 1. Hooks contenant des references PAI
  for f in "$CLAUDE_DIR/hooks/"*.ts; do
    [ -f "$f" ] || continue
    for pattern in "${LEGACY_PATTERNS[@]}"; do
      if grep -qi "$pattern" "$f" 2>/dev/null; then
        ui_detail "hooks/$(basename "$f")"
        _rm "$f"
        cleaned=$((cleaned + 1))
        break
      fi
    done
  done

  # 2. Agents contenant des references PAI
  for f in "$CLAUDE_DIR/agents/"*.md; do
    [ -f "$f" ] || continue
    for pattern in "${LEGACY_PATTERNS[@]}"; do
      if grep -qi "$pattern" "$f" 2>/dev/null; then
        ui_detail "agents/$(basename "$f")"
        _rm "$f"
        cleaned=$((cleaned + 1))
        break
      fi
    done
  done

  # 3. Skills legacy (dossiers non-HORA contenant des refs PAI)
  for d in "$CLAUDE_DIR/skills/"*/; do
    [ -d "$d" ] || continue
    local skill_name
    skill_name=$(basename "$d")
    # Skip les skills HORA
    [ -d "$HORA_DIR/skills/$skill_name" ] && continue
    if [ -f "$d/SKILL.md" ]; then
      for pattern in "${LEGACY_PATTERNS[@]}"; do
        if grep -qi "$pattern" "$d/SKILL.md" 2>/dev/null; then
          ui_detail "skills/$skill_name/"
          _rm -r "$d"
          cleaned=$((cleaned + 1))
          break
        fi
      done
    fi
  done

  # 4. Bloc PAI dans CLAUDE.md
  if [ -f "$CLAUDE_DIR/CLAUDE.md" ] && grep -qF "<!-- PAI:START" "$CLAUDE_DIR/CLAUDE.md" 2>/dev/null; then
    if $DRY_RUN; then
      ui_detail "[DRY-RUN] CLAUDE.md — bloc PAI serait supprime"
    else
      sed '/<!-- PAI:START/,/<!-- PAI:END/d' "$CLAUDE_DIR/CLAUDE.md" > "$CLAUDE_DIR/CLAUDE.md.tmp"
      mv "$CLAUDE_DIR/CLAUDE.md.tmp" "$CLAUDE_DIR/CLAUDE.md"
    fi
    ui_detail "CLAUDE.md — bloc PAI supprime"
    cleaned=$((cleaned + 1))
  fi

  # 5. Hooks PAI dans settings.json (signalement — nettoyage fait au merge)
  if [ -f "$CLAUDE_DIR/settings.json" ] && grep -q "PAI_DIR" "$CLAUDE_DIR/settings.json" 2>/dev/null; then
    ui_detail "settings.json — hooks PAI detectes"
    cleaned=$((cleaned + 1))
  fi

  if [ "$cleaned" -gt 0 ]; then
    echo "   $cleaned artefact(s) legacy nettoye(s)"
  else
    echo "   Aucun artefact legacy detecte"
  fi
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# DETECTION DES ORPHELINS (post-install)
# ─────────────────────────────────────────────────────────────────────────────

detect_orphans() {
  local orphans=0

  # Hooks non-HORA
  for f in "$CLAUDE_DIR/hooks/"*.ts; do
    [ -f "$f" ] || continue
    local name
    name=$(basename "$f")
    if [ ! -f "$HORA_DIR/hooks/$name" ]; then
      ui_warn "hooks/$name ${DIM}(orphelin)${RESET}"
      orphans=$((orphans + 1))
    fi
  done

  # Agents non-HORA
  for f in "$CLAUDE_DIR/agents/"*.md; do
    [ -f "$f" ] || continue
    local name
    name=$(basename "$f")
    if [ ! -f "$HORA_DIR/agents/$name" ]; then
      ui_warn "agents/$name ${DIM}(orphelin)${RESET}"
      orphans=$((orphans + 1))
    fi
  done

  # Skills non-HORA
  for d in "$CLAUDE_DIR/skills/"*/; do
    [ -d "$d" ] || continue
    local name
    name=$(basename "$d")
    if [ ! -d "$HORA_DIR/skills/$name" ]; then
      ui_warn "skills/$name/ ${DIM}(orphelin)${RESET}"
      orphans=$((orphans + 1))
    fi
  done

  if [ "$orphans" -gt 0 ]; then
    echo "   $orphans fichier(s) non-HORA detecte(s)"
    echo "   Verifier et nettoyer manuellement si necessaire"
  else
    ui_ok "Aucun orphelin"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# PARSING DES ARGUMENTS
# ═══════════════════════════════════════════════════════════════════════════════

case "${1:-}" in
  --restore)
    do_restore "${2:-latest}"
    ;;
  --list-backups)
    do_restore "list"
    ;;
  --dry-run)
    DRY_RUN=true
    ;;
  "")
    ;;
  *)
    ui_err "Flag inconnu: $1"
    echo ""
    echo "Usage :"
    echo "  bash install.sh                        # Installation"
    echo "  bash install.sh --dry-run              # Simulation"
    echo "  bash install.sh --restore              # Restaurer (dernier backup)"
    echo "  bash install.sh --restore <timestamp>  # Restaurer un backup specifique"
    echo "  bash install.sh --list-backups         # Lister les backups"
    exit 1
    ;;
esac

# ═══════════════════════════════════════════════════════════════════════════════
# INSTALLATION
# ═══════════════════════════════════════════════════════════════════════════════

ui_header

# ─── Prerequis ──────────────────────────────────────────────────────────────

ui_step "Prerequis"

if ! command -v claude &>/dev/null; then
  ui_err "Claude Code introuvable"
  ui_detail "npm install -g @anthropic-ai/claude-code"
  exit 1
fi
ui_ok "Claude Code"

if ! node -e "require('tsx')" &>/dev/null 2>&1 && ! command -v tsx &>/dev/null; then
  if $DRY_RUN; then
    ui_detail "[DRY-RUN] npm install -g tsx"
  else
    ui_info "Installation de tsx..."
    npm install -g tsx
  fi
fi

HAS_JQ=false
if command -v jq &>/dev/null; then
  HAS_JQ=true
else
  # Tenter l'installation automatique selon l'OS
  case "$(uname -s)" in
    Darwin)
      if command -v brew &>/dev/null; then
        ui_info "Installation de jq via Homebrew..."
        brew install jq 2>/dev/null && HAS_JQ=true
      fi
      ;;
    Linux)
      if command -v apt-get &>/dev/null && [ "$(id -u)" = "0" ]; then
        ui_info "Installation de jq via apt..."
        apt-get install -y jq 2>/dev/null && HAS_JQ=true
      elif command -v apk &>/dev/null; then
        ui_info "Installation de jq via apk..."
        apk add --no-cache jq 2>/dev/null && HAS_JQ=true
      fi
      ;;
    # Windows (Git Bash) : gere par install.ps1
  esac

  if ! $HAS_JQ; then
    ui_warn "jq absent ${DIM}(optionnel — node sera utilise)${RESET}"
  fi
fi

# ─── Backup complet ────────────────────────────────────────────────────────

ui_step "Backup"
backup_all
ui_ok "Snapshot sauvegarde"

# ─── Trap en cas d'erreur ──────────────────────────────────────────────────

if ! $DRY_RUN; then
  trap 'printf "\n"; ui_err "Installation interrompue"; ui_detail "Restaurer : bash install.sh --restore"; exit 1' ERR
fi

# ─── Nettoyage legacy (PAI) ────────────────────────────────────────────────

ui_step "Nettoyage"
cleanup_legacy

# ─── Structure de dossiers ─────────────────────────────────────────────────

ui_step "Configuration"
_mkdir -p "$CLAUDE_DIR"/{MEMORY/{PROFILE,SESSIONS,LEARNING/{FAILURES,ALGORITHM,SYSTEM},SECURITY,STATE,WORK},agents,hooks,skills,.hora/{sessions,snapshots}}

# ─── CLAUDE.md ─────────────────────────────────────────────────────────────

HORA_START_MARKER="<!-- HORA:START -->"
HORA_END_MARKER="<!-- HORA:END -->"

if [ -f "$CLAUDE_DIR/CLAUDE.md" ]; then
  if grep -qF "$HORA_START_MARKER" "$CLAUDE_DIR/CLAUDE.md"; then
    # Bloc HORA existant → mise a jour
    if $DRY_RUN; then
      ui_detail "[DRY-RUN] CLAUDE.md — bloc HORA serait mis a jour"
    else
      BEFORE=$(sed "/$HORA_START_MARKER/,/$HORA_END_MARKER/d" "$CLAUDE_DIR/CLAUDE.md")
      {
        echo "$BEFORE"
        echo ""
        echo "$HORA_START_MARKER"
        cat "$HORA_DIR/CLAUDE.md"
        echo "$HORA_END_MARKER"
      } > "$CLAUDE_DIR/CLAUDE.md.tmp" && mv "$CLAUDE_DIR/CLAUDE.md.tmp" "$CLAUDE_DIR/CLAUDE.md"
    fi
    ui_ok "CLAUDE.md ${DIM}(bloc HORA mis a jour)${RESET}"
  else
    # CLAUDE.md existant sans HORA → append
    if $DRY_RUN; then
      ui_detail "[DRY-RUN] CLAUDE.md — HORA serait ajoute"
    else
      {
        echo ""
        echo "$HORA_START_MARKER"
        cat "$HORA_DIR/CLAUDE.md"
        echo "$HORA_END_MARKER"
      } >> "$CLAUDE_DIR/CLAUDE.md"
    fi
    ui_ok "CLAUDE.md ${DIM}(HORA ajoute, existant conserve)${RESET}"
  fi
else
  # Pas de CLAUDE.md → creation
  if $DRY_RUN; then
    ui_detail "[DRY-RUN] CLAUDE.md serait cree"
  else
    {
      echo "$HORA_START_MARKER"
      cat "$HORA_DIR/CLAUDE.md"
      echo "$HORA_END_MARKER"
    } > "$CLAUDE_DIR/CLAUDE.md"
  fi
  ui_ok "CLAUDE.md ${DIM}(cree)${RESET}"
fi

# ─── settings.json (merge intelligent) ────────────────────────────────────

HORA_SETTINGS="$HORA_DIR/settings.json"
TARGET_SETTINGS="$CLAUDE_DIR/settings.json"

merge_settings_jq() {
  jq -s '
    .[0] as $existing | .[1] as $hora |
    ($existing.hooks // {}) |
    to_entries | map(
      .key as $event |
      {
        key: $event,
        value: [
          .value[] |
          select(.hooks[]?.command | (contains("PAI_DIR") or contains("pai-")) | not)
        ]
      }
    ) | from_entries as $cleaned |
    {
      hooks: (
        ($hora.hooks | keys) + ($cleaned | keys) | unique |
        map(. as $k | {
          key: $k,
          value: (
            (($cleaned[$k] // []) + ($hora.hooks[$k] // []))
            | unique_by(.hooks[0].command)
            | map(select(.hooks | length > 0))
          )
        }) | from_entries |
        to_entries | map(select(.value | length > 0)) | from_entries
      ),
      statusLine: ($hora.statusLine // $existing.statusLine // null),
      spinnerVerbs: ($hora.spinnerVerbs // $existing.spinnerVerbs // null)
    } | with_entries(select(.value != null))
  ' "$TARGET_SETTINGS" "$HORA_SETTINGS" > "$TARGET_SETTINGS.tmp" && mv "$TARGET_SETTINGS.tmp" "$TARGET_SETTINGS"
}

merge_settings_node() {
  node -e "
    const fs = require('fs');
    const path = require('path');
    const existing = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    const hora = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';

    // Verifier si un fichier reference dans un hook existe
    function hookFileExists(command) {
      if (!command) return false;
      // Extraire le chemin du fichier (.ts ou .js) de la commande
      const match = command.match(/(?:npx tsx|tsx|node)\s+(.+\.(?:ts|js))(?:\s|$)/);
      if (!match) return true; // pas un hook fichier, on garde
      let filePath = match[1].trim();
      // Resoudre ~ et \$HOME
      filePath = filePath.replace(/^~\//, homeDir + '/');
      filePath = filePath.replace(/^\\\$HOME\//, homeDir + '/');
      try { return fs.existsSync(filePath); } catch { return false; }
    }

    // Nettoyer les hooks de l'existant : PAI + fichiers inexistants
    const cleaned = {};
    let removed = 0;
    for (const [event, matchers] of Object.entries(existing.hooks || {})) {
      cleaned[event] = matchers.filter(m => {
        const dominated = m.hooks?.some(h =>
          h.command?.includes('PAI_DIR') || h.command?.includes('pai-')
        );
        if (dominated) { removed++; return false; }
        // Verifier que les fichiers references existent
        const missing = m.hooks?.some(h => !hookFileExists(h.command));
        if (missing) { removed++; return false; }
        return true;
      });
    }
    if (removed > 0) process.stderr.write('   [CLEAN] ' + removed + ' hooks orphelins supprimes\n');

    // Merger : hooks existants (nettoyes) + hooks HORA (dedup par commande)
    const merged = {};
    const allEvents = [...new Set([...Object.keys(hora.hooks || {}), ...Object.keys(cleaned)])];
    for (const event of allEvents) {
      const combined = [...(cleaned[event] || []), ...(hora.hooks?.[event] || [])];
      const seen = new Set();
      const deduped = combined.filter(m => {
        const cmd = m.hooks?.[0]?.command;
        if (!cmd || seen.has(cmd)) return false;
        seen.add(cmd);
        return m.hooks?.length > 0;
      });
      if (deduped.length > 0) merged[event] = deduped;
    }

    const result = { hooks: merged };
    if (hora.statusLine || existing.statusLine) result.statusLine = hora.statusLine || existing.statusLine;
    if (hora.spinnerVerbs || existing.spinnerVerbs) result.spinnerVerbs = hora.spinnerVerbs || existing.spinnerVerbs;

    fs.writeFileSync(process.argv[1], JSON.stringify(result, null, 2) + '\n');
  " "$TARGET_SETTINGS" "$HORA_SETTINGS"
}

if [ -f "$TARGET_SETTINGS" ]; then
  if $DRY_RUN; then
    ui_detail "[DRY-RUN] settings.json — merge HORA"
  elif $HAS_JQ; then
    merge_settings_jq
  else
    merge_settings_node
  fi
else
  _cp "$HORA_SETTINGS" "$TARGET_SETTINGS"
fi
ui_ok "settings.json"

# ─── Statusline ────────────────────────────────────────────────────────────

_cp "$HORA_DIR/statusline.sh" "$CLAUDE_DIR/statusline.sh"
_chmod +x "$CLAUDE_DIR/statusline.sh"
ui_ok "statusline.sh"

# ─── Hooks ─────────────────────────────────────────────────────────────────

ui_step "Hooks & Agents"

HOOKS_COUNT=$(ls "$HORA_DIR/hooks/"*.ts 2>/dev/null | wc -l | tr -d ' ')
LIB_COUNT=$(ls "$HORA_DIR/hooks/lib/"*.ts 2>/dev/null | wc -l | tr -d ' ')
if $DRY_RUN; then
  ui_detail "[DRY-RUN] hooks/ — $HOOKS_COUNT fichiers + lib/ ($LIB_COUNT)"
else
  cp "$HORA_DIR/hooks/"*.ts "$CLAUDE_DIR/hooks/"
  # Copy lib/ subdirectory (session-paths shared utility)
  if [ -d "$HORA_DIR/hooks/lib" ]; then
    mkdir -p "$CLAUDE_DIR/hooks/lib"
    cp "$HORA_DIR/hooks/lib/"*.ts "$CLAUDE_DIR/hooks/lib/"
  fi
  # Copy package.json for hooks dependencies (transformers, minisearch, zod)
  if [ -f "$HORA_DIR/hooks/package.json" ]; then
    cp "$HORA_DIR/hooks/package.json" "$CLAUDE_DIR/hooks/package.json"
    [ -f "$HORA_DIR/hooks/package-lock.json" ] && cp "$HORA_DIR/hooks/package-lock.json" "$CLAUDE_DIR/hooks/package-lock.json"
    ui_info "Installation des dependances hooks..."
    (cd "$CLAUDE_DIR/hooks" && npm install --omit=dev --silent 2>/dev/null) || ui_warn "npm install hooks echoue ${DIM}(non-bloquant)${RESET}"
  fi
fi
ui_ok "hooks/ ${DIM}($HOOKS_COUNT hooks + lib/$LIB_COUNT)${RESET}"

# ─── settings.json : nettoyage orphelins + Windows paths ─────────────────
# (apres copie des hooks pour ne pas supprimer les hooks HORA pas encore installes)

if ! $DRY_RUN && [ -f "$TARGET_SETTINGS" ]; then
  node -e "
    const fs = require('fs');
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const s = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    let removed = 0;
    for (const [event, matchers] of Object.entries(s.hooks || {})) {
      s.hooks[event] = matchers.filter(m => {
        for (const h of (m.hooks || [])) {
          if (!h.command) continue;
          const match = h.command.match(/(?:npx tsx|tsx|node)\s+([^\s]+\.(?:ts|js))/);
          if (!match) continue;
          let fp = match[1].replace(/^~\//, homeDir + '/').replace(/^\\\$HOME\//, homeDir + '/');
          if (!fs.existsSync(fp)) { removed++; return false; }
        }
        return true;
      });
      if (s.hooks[event].length === 0) delete s.hooks[event];
    }
    if (removed > 0) {
      fs.writeFileSync(process.argv[1], JSON.stringify(s, null, 2) + '\n');
      process.stderr.write('   [CLEAN] ' + removed + ' hook(s) orphelin(s) supprime(s)\n');
    }
  " "$TARGET_SETTINGS" 2>&1
fi

# Windows : resoudre ~ et $HOME en chemins absolus
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    if ! $DRY_RUN && [ -f "$TARGET_SETTINGS" ]; then
      WIN_HOME=$(cygpath -m "$HOME" 2>/dev/null || echo "$HOME")
      node -e "
        const fs = require('fs');
        let s = fs.readFileSync(process.argv[1], 'utf8');
        const h = process.argv[2];
        s = s.replace(/~\//g, h + '/');
        s = s.replace(/\\\$HOME\//g, h + '/');
        fs.writeFileSync(process.argv[1], s);
      " "$TARGET_SETTINGS" "$WIN_HOME"
      ui_detail "Chemins Windows resolus dans settings.json"
    fi
    ;;
esac

# ─── Agents ────────────────────────────────────────────────────────────────

if $DRY_RUN; then
  ui_detail "[DRY-RUN] agents/ — fichiers seraient copies"
else
  cp "$HORA_DIR/agents/"*.md "$CLAUDE_DIR/agents/"
fi
ui_ok "agents/ ${DIM}($(ls "$HORA_DIR/agents/"*.md 2>/dev/null | wc -l | tr -d ' ') agents)${RESET}"

# ─── Skills ────────────────────────────────────────────────────────────────

ui_step "Skills & Securite"

# Nettoyer les anciens fichiers .md plats
for old_skill in "$CLAUDE_DIR/skills/"*.md; do
  [ -f "$old_skill" ] || continue
  _rm "$old_skill"
  ui_detail "$(basename "$old_skill") supprime (ancien format)"
done

# Copier les dossiers de skills
for skill_dir in "$HORA_DIR/skills/"*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  _mkdir -p "$CLAUDE_DIR/skills/$skill_name"
  _cp "$skill_dir"SKILL.md "$CLAUDE_DIR/skills/$skill_name/SKILL.md"
done
ui_ok "skills/ ${DIM}($(find "$HORA_DIR/skills" -name SKILL.md 2>/dev/null | wc -l | tr -d ' ') skills)${RESET}"

# ─── Dashboard ─────────────────────────────────────────────────────────────

if [ -d "$HORA_DIR/dashboard" ]; then
  _mkdir -p "$CLAUDE_DIR/dashboard"
  if $DRY_RUN; then
    ui_detail "[DRY-RUN] dashboard/ serait copie"
  else
    cp -r "$HORA_DIR/dashboard/"* "$CLAUDE_DIR/dashboard/"
    # Install dashboard dependencies if package.json exists
    if [ -f "$CLAUDE_DIR/dashboard/package.json" ]; then
      ui_info "Installation des dependances dashboard..."
      (cd "$CLAUDE_DIR/dashboard" && npm install --silent 2>/dev/null) || ui_warn "npm install dashboard echoue ${DIM}(non-bloquant)${RESET}"
    fi
  fi
  ui_ok "dashboard/"
fi

# ─── Patterns de securite ─────────────────────────────────────────────────

_cp "$HORA_DIR/.hora/patterns.yaml" "$CLAUDE_DIR/.hora/patterns.yaml"
ui_ok "patterns.yaml ${DIM}(securite)${RESET}"

# ─── MEMORY (ne pas ecraser si deja rempli) ───────────────────────────────

ui_step "Memory"

INSTALLED=0
PROFILE_TEMPLATE="<!-- vide - sera complete automatiquement a l'usage -->"
for f in identity projects preferences vocabulary; do
  TARGET="$CLAUDE_DIR/MEMORY/PROFILE/$f.md"
  if [ ! -f "$TARGET" ] || [ ! -s "$TARGET" ]; then
    if [ -f "$HORA_DIR/MEMORY/PROFILE/$f.md" ]; then
      _cp "$HORA_DIR/MEMORY/PROFILE/$f.md" "$TARGET"
    elif $DRY_RUN; then
      ui_detail "[DRY-RUN] create $f.md"
    else
      echo "$PROFILE_TEMPLATE" > "$TARGET"
    fi
    INSTALLED=1
  fi
done
[ $INSTALLED -eq 1 ] && ui_ok "MEMORY/PROFILE/ ${DIM}(initialise)${RESET}" || ui_info "MEMORY/PROFILE/ existant conserve"

for dir in SESSIONS LEARNING/FAILURES LEARNING/ALGORITHM LEARNING/SYSTEM SECURITY STATE WORK; do
  _touch "$CLAUDE_DIR/MEMORY/$dir/.gitkeep" 2>/dev/null || true
done

# ─────────────────────────────────────────────────────────────────────────────
# VERIFICATION POST-INSTALL
# ─────────────────────────────────────────────────────────────────────────────

ui_step "Verification"
ISSUES=0

# Verifier que les donnees de session n'ont pas ete perdues
LATEST_BACKUP=""
if [ -f "$BACKUP_BASE/latest" ] && [ -d "$BACKUP_BASE/$(cat "$BACKUP_BASE/latest" | tr -d '[:space:]')" ]; then
  LATEST_BACKUP="$BACKUP_BASE/$(cat "$BACKUP_BASE/latest" | tr -d '[:space:]')"
fi

if [ -n "$LATEST_BACKUP" ]; then
  for item in "${CLAUDE_SESSION_DATA[@]}"; do
    if [ -e "$LATEST_BACKUP/$item" ] && [ ! -e "$CLAUDE_DIR/$item" ]; then
      ui_warn "$item manquant ${SYM_ARROW} restauration depuis backup..."
      _cp -r "$LATEST_BACKUP/$item" "$CLAUDE_DIR/"
      ISSUES=$((ISSUES + 1))
    fi
  done
fi
[ $ISSUES -eq 0 ] && ui_ok "Donnees de session intactes" || ui_ok "$ISSUES element(s) restaure(s)"

detect_orphans

# ─────────────────────────────────────────────────────────────────────────────
# COMMANDE HORA (launcher Claude + Dashboard)
# ─────────────────────────────────────────────────────────────────────────────

ui_step "Commande hora"

# Copy launcher to ~/.claude/
_cp "$HORA_DIR/hora.sh" "$CLAUDE_DIR/hora.sh"
chmod +x "$CLAUDE_DIR/hora.sh"

# Determine install location for the 'hora' command
HORA_INSTALLED=false

if [[ "$OSTYPE" == msys* ]] || [[ "$OSTYPE" == cygwin* ]] || [[ "$OSTYPE" == win* ]]; then
  # Windows: create a .cmd wrapper next to claude
  CLAUDE_BIN=$(command -v claude 2>/dev/null || echo "")
  if [ -n "$CLAUDE_BIN" ]; then
    HORA_CMD_DIR=$(dirname "$CLAUDE_BIN")
    # Create hora.cmd that calls bash with hora.sh
    cat > "$HORA_CMD_DIR/hora.cmd" << 'WINEOF'
@echo off
set "HORA_SCRIPT=%USERPROFILE%\.claude\hora.sh"
if defined CLAUDE_CODE_GIT_BASH_PATH (
  "%CLAUDE_CODE_GIT_BASH_PATH%" "%HORA_SCRIPT%" %*
) else (
  bash "%HORA_SCRIPT%" %*
)
WINEOF
    HORA_INSTALLED=true
    ui_ok "hora.cmd installe dans $HORA_CMD_DIR"
  fi
else
  # macOS / Linux: symlink to the same directory as claude
  CLAUDE_BIN=$(command -v claude 2>/dev/null || echo "")
  if [ -n "$CLAUDE_BIN" ]; then
    # Resolve symlinks to find the actual bin directory
    HORA_BIN_DIR=$(dirname "$CLAUDE_BIN")
  elif [ -d "$HOME/.local/bin" ]; then
    HORA_BIN_DIR="$HOME/.local/bin"
  else
    HORA_BIN_DIR="/usr/local/bin"
  fi

  # Create/update symlink
  if [ -d "$HORA_BIN_DIR" ]; then
    ln -sf "$CLAUDE_DIR/hora.sh" "$HORA_BIN_DIR/hora"
    HORA_INSTALLED=true
    ui_ok "hora ${SYM_ARROW} $HORA_BIN_DIR/hora"
  fi
fi

if ! $HORA_INSTALLED; then
  ui_warn "Impossible d'installer la commande hora automatiquement"
  ui_warn "Ajouter manuellement : ln -s $CLAUDE_DIR/hora.sh /usr/local/bin/hora"
fi

# ─────────────────────────────────────────────────────────────────────────────
# RESUME
# ─────────────────────────────────────────────────────────────────────────────

ui_summary
