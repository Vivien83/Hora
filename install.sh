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
  echo "[BACKUP] Snapshot $ts"

  # Donnees de session Claude Code
  for item in "${CLAUDE_SESSION_DATA[@]}"; do
    if [ -e "$CLAUDE_DIR/$item" ]; then
      _cp -r "$CLAUDE_DIR/$item" "$backup_dir/"
      echo "   OK $item (session)"
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
      echo "   OK $item (config)"
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
        echo "   [ROTATE] $(basename "${backups[$i]}") supprime"
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
    echo ""
    echo "[BACKUPS] Snapshots disponibles :"
    if [ -d "$BACKUP_BASE" ] && ls -1d "$BACKUP_BASE"/2* &>/dev/null; then
      for d in $(ls -1d "$BACKUP_BASE"/2* | sort -r); do
        local name
        name=$(basename "$d")
        local marker=""
        if [ -f "$BACKUP_BASE/latest" ]; then
          [ "$(cat "$BACKUP_BASE/latest" 2>/dev/null | tr -d '[:space:]')" = "$name" ] && marker=" <- latest"
        fi
        # Compter les elements dans le backup
        local file_count
        file_count=$(find "$d" -maxdepth 1 -not -name "$(basename "$d")" | wc -l | tr -d ' ')
        echo "   $name  ($file_count elements)$marker"
      done
    else
      echo "   (aucun backup)"
    fi
    echo ""
    echo "Restaurer : bash install.sh --restore <timestamp>"
    echo "           bash install.sh --restore   (= latest)"
    exit 0
  fi

  # Resoudre "latest"
  local restore_dir
  if [ "$target" = "latest" ]; then
    if [ ! -f "$BACKUP_BASE/latest" ]; then
      echo "[ERREUR] Aucun backup 'latest' trouve."
      echo "   Lance : bash install.sh --list-backups"
      exit 1
    fi
    restore_dir="$BACKUP_BASE/$(cat "$BACKUP_BASE/latest" | tr -d '[:space:]')"
  else
    restore_dir="$BACKUP_BASE/$target"
  fi

  if [ ! -d "$restore_dir" ]; then
    echo "[ERREUR] Backup introuvable : $target"
    echo "   Lance : bash install.sh --list-backups"
    exit 1
  fi

  echo ""
  echo "[RESTORE] Depuis $(basename "$restore_dir")"
  echo ""

  # Restaurer les donnees de session
  for item in "${CLAUDE_SESSION_DATA[@]}"; do
    if [ -e "$restore_dir/$item" ]; then
      rm -rf "$CLAUDE_DIR/$item"
      cp -r "$restore_dir/$item" "$CLAUDE_DIR/"
      echo "   OK $item (session)"
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
      echo "   OK $item (config restauree)"
    elif [ -e "$CLAUDE_DIR/$item" ]; then
      # L'item n'existait pas avant HORA → le supprimer
      rm -rf "$CLAUDE_DIR/$item"
      echo "   OK $item (supprime — absent du backup)"
    fi
  done

  echo ""
  echo "[RESTORE] Etat restaure : $(basename "$restore_dir")"
  echo ""
  echo "[INFO] Les donnees MEMORY/ ne sont pas affectees par le restore."
  echo "[INFO] Pour reinstaller HORA : bash install.sh"
  exit 0
}

# ─────────────────────────────────────────────────────────────────────────────
# NETTOYAGE LEGACY (PAI et predecesseurs)
# ─────────────────────────────────────────────────────────────────────────────

cleanup_legacy() {
  local cleaned=0
  echo "[CLEAN] Recherche d'artefacts legacy..."

  # 1. Hooks contenant des references PAI
  for f in "$CLAUDE_DIR/hooks/"*.ts; do
    [ -f "$f" ] || continue
    for pattern in "${LEGACY_PATTERNS[@]}"; do
      if grep -qi "$pattern" "$f" 2>/dev/null; then
        echo "   [LEGACY] hooks/$(basename "$f") (contient '$pattern')"
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
        echo "   [LEGACY] agents/$(basename "$f") (contient '$pattern')"
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
          echo "   [LEGACY] skills/$skill_name/ (contient '$pattern')"
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
      echo "   [DRY-RUN] CLAUDE.md — bloc PAI serait supprime"
    else
      sed '/<!-- PAI:START/,/<!-- PAI:END/d' "$CLAUDE_DIR/CLAUDE.md" > "$CLAUDE_DIR/CLAUDE.md.tmp"
      mv "$CLAUDE_DIR/CLAUDE.md.tmp" "$CLAUDE_DIR/CLAUDE.md"
    fi
    echo "   [LEGACY] CLAUDE.md — bloc PAI supprime"
    cleaned=$((cleaned + 1))
  fi

  # 5. Hooks PAI dans settings.json (signalement — nettoyage fait au merge)
  if [ -f "$CLAUDE_DIR/settings.json" ] && grep -q "PAI_DIR" "$CLAUDE_DIR/settings.json" 2>/dev/null; then
    echo "   [LEGACY] settings.json — hooks PAI detectes (seront nettoyes au merge)"
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
      echo "   [ORPHELIN] hooks/$name"
      orphans=$((orphans + 1))
    fi
  done

  # Agents non-HORA
  for f in "$CLAUDE_DIR/agents/"*.md; do
    [ -f "$f" ] || continue
    local name
    name=$(basename "$f")
    if [ ! -f "$HORA_DIR/agents/$name" ]; then
      echo "   [ORPHELIN] agents/$name"
      orphans=$((orphans + 1))
    fi
  done

  # Skills non-HORA
  for d in "$CLAUDE_DIR/skills/"*/; do
    [ -d "$d" ] || continue
    local name
    name=$(basename "$d")
    if [ ! -d "$HORA_DIR/skills/$name" ]; then
      echo "   [ORPHELIN] skills/$name/"
      orphans=$((orphans + 1))
    fi
  done

  if [ "$orphans" -gt 0 ]; then
    echo "   $orphans fichier(s) non-HORA detecte(s)"
    echo "   Verifier et nettoyer manuellement si necessaire"
  else
    echo "   [OK] Aucun orphelin"
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
    echo "[ERREUR] Flag inconnu: $1"
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

echo ""
echo "+===========================================+"
if $DRY_RUN; then
echo "|       HORA — Installation (DRY RUN)        |"
else
echo "|           HORA — Installation              |"
fi
echo "+===========================================+"
echo ""
$DRY_RUN && echo "[DRY-RUN] Aucune modification ne sera effectuee." && echo ""

# ─── Prerequis ──────────────────────────────────────────────────────────────

if ! command -v claude &>/dev/null; then
  echo "[ERREUR] Claude Code introuvable. Installe : npm install -g @anthropic-ai/claude-code"
  exit 1
fi

if ! node -e "require('tsx')" &>/dev/null 2>&1 && ! command -v tsx &>/dev/null; then
  if $DRY_RUN; then
    echo "   [DRY-RUN] npm install -g tsx"
  else
    echo "[INFO] Installation de tsx..."
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
        echo "[INFO] Installation de jq via Homebrew..."
        brew install jq 2>/dev/null && HAS_JQ=true
      fi
      ;;
    Linux)
      if command -v apt-get &>/dev/null && [ "$(id -u)" = "0" ]; then
        echo "[INFO] Installation de jq via apt..."
        apt-get install -y jq 2>/dev/null && HAS_JQ=true
      elif command -v apk &>/dev/null; then
        echo "[INFO] Installation de jq via apk..."
        apk add --no-cache jq 2>/dev/null && HAS_JQ=true
      fi
      ;;
    # Windows (Git Bash) : gere par install.ps1
  esac

  if ! $HAS_JQ; then
    echo "[INFO] jq absent (optionnel - HORA utilisera node a la place)"
    case "$(uname -s)" in
      MINGW*|MSYS*|CYGWIN*) echo "   winget install jqlang.jq" ;;
      Darwin)               echo "   brew install jq" ;;
      *)                    echo "   sudo apt install jq" ;;
    esac
  fi
fi

# ─── Backup complet ────────────────────────────────────────────────────────

backup_all

# ─── Trap en cas d'erreur ──────────────────────────────────────────────────

if ! $DRY_RUN; then
  trap 'echo ""; echo "[ERREUR] Installation interrompue."; echo "   Restaurer : bash install.sh --restore"; exit 1' ERR
fi

# ─── Nettoyage legacy (PAI) ────────────────────────────────────────────────

cleanup_legacy

# ─── Structure de dossiers ─────────────────────────────────────────────────

_mkdir -p "$CLAUDE_DIR"/{MEMORY/{PROFILE,SESSIONS,LEARNING/{FAILURES,ALGORITHM,SYSTEM},SECURITY,STATE,WORK},agents,hooks,skills,.hora/{sessions,snapshots}}

# ─── CLAUDE.md ─────────────────────────────────────────────────────────────

HORA_START_MARKER="<!-- HORA:START -->"
HORA_END_MARKER="<!-- HORA:END -->"

if [ -f "$CLAUDE_DIR/CLAUDE.md" ]; then
  if grep -qF "$HORA_START_MARKER" "$CLAUDE_DIR/CLAUDE.md"; then
    # Bloc HORA existant → mise a jour
    if $DRY_RUN; then
      echo "   [DRY-RUN] CLAUDE.md — bloc HORA serait mis a jour"
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
    echo "[OK] CLAUDE.md (bloc HORA mis a jour)"
  else
    # CLAUDE.md existant sans HORA → append
    if $DRY_RUN; then
      echo "   [DRY-RUN] CLAUDE.md — HORA serait ajoute (existant conserve)"
    else
      {
        echo ""
        echo "$HORA_START_MARKER"
        cat "$HORA_DIR/CLAUDE.md"
        echo "$HORA_END_MARKER"
      } >> "$CLAUDE_DIR/CLAUDE.md"
    fi
    echo "[OK] CLAUDE.md (HORA ajoute, contenu existant conserve)"
  fi
else
  # Pas de CLAUDE.md → creation
  if $DRY_RUN; then
    echo "   [DRY-RUN] CLAUDE.md — serait cree"
  else
    {
      echo "$HORA_START_MARKER"
      cat "$HORA_DIR/CLAUDE.md"
      echo "$HORA_END_MARKER"
    } > "$CLAUDE_DIR/CLAUDE.md"
  fi
  echo "[OK] CLAUDE.md (cree)"
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
    echo "   [DRY-RUN] settings.json — merge HORA"
  elif $HAS_JQ; then
    merge_settings_jq
  else
    merge_settings_node
  fi
else
  _cp "$HORA_SETTINGS" "$TARGET_SETTINGS"
fi
echo "[OK] settings.json (merge)"

# ─── Statusline ────────────────────────────────────────────────────────────

_cp "$HORA_DIR/statusline.sh" "$CLAUDE_DIR/statusline.sh"
_chmod +x "$CLAUDE_DIR/statusline.sh"
echo "[OK] statusline.sh"

# ─── Hooks ─────────────────────────────────────────────────────────────────

if $DRY_RUN; then
  echo "   [DRY-RUN] hooks/ — $(ls "$HORA_DIR/hooks/"*.ts 2>/dev/null | wc -l | tr -d ' ') fichiers seraient copies"
else
  cp "$HORA_DIR/hooks/"*.ts "$CLAUDE_DIR/hooks/"
fi
echo "[OK] hooks/ ($(ls "$HORA_DIR/hooks/"*.ts 2>/dev/null | wc -l | tr -d ' ') fichiers)"

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
      echo "   [WIN] Chemins absolus resolus dans settings.json"
    fi
    ;;
esac

# ─── Agents ────────────────────────────────────────────────────────────────

if $DRY_RUN; then
  echo "   [DRY-RUN] agents/ — fichiers seraient copies"
else
  cp "$HORA_DIR/agents/"*.md "$CLAUDE_DIR/agents/"
fi
echo "[OK] agents/"

# ─── Skills ────────────────────────────────────────────────────────────────

# Nettoyer les anciens fichiers .md plats
for old_skill in "$CLAUDE_DIR/skills/"*.md; do
  [ -f "$old_skill" ] || continue
  _rm "$old_skill"
  echo "   [CLEAN] $(basename "$old_skill") (ancien format .md plat)"
done

# Copier les dossiers de skills
for skill_dir in "$HORA_DIR/skills/"*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  _mkdir -p "$CLAUDE_DIR/skills/$skill_name"
  _cp "$skill_dir"SKILL.md "$CLAUDE_DIR/skills/$skill_name/SKILL.md"
done
echo "[OK] skills/ ($(find "$HORA_DIR/skills" -name SKILL.md 2>/dev/null | wc -l | tr -d ' ') skills)"

# ─── Patterns de securite ─────────────────────────────────────────────────

_cp "$HORA_DIR/.hora/patterns.yaml" "$CLAUDE_DIR/.hora/patterns.yaml"
echo "[OK] .hora/patterns.yaml"

# ─── MEMORY (ne pas ecraser si deja rempli) ───────────────────────────────

INSTALLED=0
PROFILE_TEMPLATE="<!-- vide - sera complete automatiquement a l'usage -->"
for f in identity projects preferences vocabulary; do
  TARGET="$CLAUDE_DIR/MEMORY/PROFILE/$f.md"
  if [ ! -f "$TARGET" ] || [ ! -s "$TARGET" ]; then
    if [ -f "$HORA_DIR/MEMORY/PROFILE/$f.md" ]; then
      _cp "$HORA_DIR/MEMORY/PROFILE/$f.md" "$TARGET"
    elif $DRY_RUN; then
      echo "   [DRY-RUN] create $TARGET"
    else
      echo "$PROFILE_TEMPLATE" > "$TARGET"
    fi
    INSTALLED=1
  fi
done
[ $INSTALLED -eq 1 ] && echo "[OK] MEMORY/PROFILE/ (vierge)" || echo "[INFO] MEMORY/PROFILE/ existant conserve"

for dir in SESSIONS LEARNING/FAILURES LEARNING/ALGORITHM LEARNING/SYSTEM SECURITY STATE WORK; do
  _touch "$CLAUDE_DIR/MEMORY/$dir/.gitkeep" 2>/dev/null || true
done

# ─────────────────────────────────────────────────────────────────────────────
# VERIFICATION POST-INSTALL
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "[CHECK] Verification integrite..."
ISSUES=0

# Verifier que les donnees de session n'ont pas ete perdues
LATEST_BACKUP=""
if [ -f "$BACKUP_BASE/latest" ] && [ -d "$BACKUP_BASE/$(cat "$BACKUP_BASE/latest" | tr -d '[:space:]')" ]; then
  LATEST_BACKUP="$BACKUP_BASE/$(cat "$BACKUP_BASE/latest" | tr -d '[:space:]')"
fi

if [ -n "$LATEST_BACKUP" ]; then
  for item in "${CLAUDE_SESSION_DATA[@]}"; do
    if [ -e "$LATEST_BACKUP/$item" ] && [ ! -e "$CLAUDE_DIR/$item" ]; then
      echo "   [WARN] $item manquant -> restauration depuis backup..."
      _cp -r "$LATEST_BACKUP/$item" "$CLAUDE_DIR/"
      ISSUES=$((ISSUES + 1))
    fi
  done
fi
[ $ISSUES -eq 0 ] && echo "   [OK] Donnees de session intactes" || echo "   [OK] $ISSUES element(s) restaure(s)"

echo ""
echo "[CHECK] Detection des orphelins..."
detect_orphans

# ─────────────────────────────────────────────────────────────────────────────
# RESUME
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "+===========================================+"
if $DRY_RUN; then
echo "|       DRY RUN termine (rien modifie)       |"
else
echo "|         Installation terminee !            |"
fi
echo "+===========================================+"
echo ""
echo "-> Lance : claude"
echo ""
echo "Skills : /hora-plan | /hora-autopilot | /hora-parallel-code | /hora-parallel-research | /hora-backup"
echo ""
echo "Usage :"
echo "  bash install.sh                        # Installer / mettre a jour"
echo "  bash install.sh --dry-run              # Simuler"
echo "  bash install.sh --restore              # Restaurer le dernier backup"
echo "  bash install.sh --restore <timestamp>  # Restaurer un backup specifique"
echo "  bash install.sh --list-backups         # Lister les backups"
echo ""
if ! $DRY_RUN; then
echo "[INFO] Backup : $BACKUP_BASE/"
echo "[INFO] Restore : bash install.sh --restore"
echo ""
fi
