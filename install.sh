#!/usr/bin/env bash
# HORA — Install Script
set -euo pipefail

HORA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/claude"
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$HOME/.hora-install-backup"
DRY_RUN=false

# Données Claude Code à ne jamais modifier
CLAUDE_PROTECTED=(
  "projects"        # sessions complètes (JSONL par projet)
  "todos"           # todos par session
  "history.jsonl"   # index global sessions
  "session-env"     # vars d'env par session
  ".credentials.json"
  "settings.local.json"
  "commands"        # slash commands existants
  "plugins"         # plugins installés
  "file-history"    # snapshots pre-edit
  "statsig"         # cache analytics
)

# --- Wrappers dry-run ---
_cp()    { if $DRY_RUN; then echo "   [DRY-RUN] cp $*"; else cp "$@"; fi; }
_mkdir() { if $DRY_RUN; then echo "   [DRY-RUN] mkdir $*"; else mkdir "$@"; fi; }
_rm()    { if $DRY_RUN; then echo "   [DRY-RUN] rm $*"; else rm "$@"; fi; }
_mv()    { if $DRY_RUN; then echo "   [DRY-RUN] mv $*"; else mv "$@"; fi; }
_chmod() { if $DRY_RUN; then echo "   [DRY-RUN] chmod $*"; else chmod "$@"; fi; }
_touch() { if $DRY_RUN; then echo "   [DRY-RUN] touch $*"; else touch "$@"; fi; }
_write() {
  # _write <content> <dest> — ecrit du contenu dans un fichier (ou affiche en dry-run)
  if $DRY_RUN; then echo "   [DRY-RUN] write -> $2"; else echo "$1" > "$2"; fi
}

# --- Parsing des arguments ---
case "${1:-}" in
  --restore)
    # Restauration rapide — pas de dry-run ici
    if [ ! -d "$BACKUP_DIR" ]; then
      echo "[ERREUR] Aucun backup trouve dans $BACKUP_DIR"
      exit 1
    fi
    echo "[RESTORE] Restauration des donnees de session..."
    for item in "${CLAUDE_PROTECTED[@]}"; do
      if [ -e "$BACKUP_DIR/$item" ]; then
        rm -rf "$CLAUDE_DIR/$item"
        cp -r "$BACKUP_DIR/$item" "$CLAUDE_DIR/"
        echo "   OK $item"
      fi
    done
    echo "   OK Restauration terminee."
    exit 0
    ;;
  --dry-run)
    DRY_RUN=true
    ;;
  "")
    ;;
  *)
    echo "[ERREUR] Flag inconnu: $1"
    echo "Usage: bash install.sh [--dry-run | --restore]"
    exit 1
    ;;
esac

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

# --- Prérequis ---
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
  echo "[WARN] jq non trouve — le merge settings.json sera simplifie (ecrasement au lieu de fusion)"
  echo "   Pour un merge complet : brew install jq (macOS) / apt install jq (Linux) / choco install jq (Windows)"
fi

# --- Sauvegarde des données de session Claude ---
backup_sessions() {
  local has_data=0
  for item in "${CLAUDE_PROTECTED[@]}"; do
    [ -e "$CLAUDE_DIR/$item" ] && has_data=1 && break
  done

  if [ $has_data -eq 0 ]; then
    return 0
  fi

  _rm -rf "$BACKUP_DIR"
  _mkdir -p "$BACKUP_DIR"

  echo "[BACKUP] Sauvegarde des donnees Claude..."
  for item in "${CLAUDE_PROTECTED[@]}"; do
    if [ -e "$CLAUDE_DIR/$item" ]; then
      _cp -r "$CLAUDE_DIR/$item" "$BACKUP_DIR/"
      echo "   OK $item"
    fi
  done
  echo "   -> $BACKUP_DIR"
  echo ""
}

# --- Restauration automatique en cas d'erreur (skip en dry-run) ---
if ! $DRY_RUN; then
  trap 'echo ""; echo "[ERREUR] Erreur pendant linstallation."; echo "   Lance: bash install.sh --restore"; exit 1' ERR
fi

# --- Backup sessions existantes ---
backup_sessions

# --- Structure ---
_mkdir -p "$CLAUDE_DIR"/{MEMORY/{PROFILE,SESSIONS,LEARNING/{FAILURES,ALGORITHM,SYSTEM},SECURITY,STATE,WORK},agents,hooks,skills,.hora/{sessions,snapshots}}

# --- CLAUDE.md ---
HORA_MARKER="<!-- HORA:START -->"
HORA_START_MARKER="<!-- HORA:START -->"
HORA_END_MARKER="<!-- HORA:END -->"

if [ -f "$CLAUDE_DIR/CLAUDE.md" ]; then
  if grep -qF "$HORA_MARKER" "$CLAUDE_DIR/CLAUDE.md"; then
    if $DRY_RUN; then
      echo "   [DRY-RUN] CLAUDE.md — bloc Hora serait mis a jour"
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
    echo "[OK] CLAUDE.md (bloc Hora mis a jour)"
  else
    if $DRY_RUN; then
      echo "   [DRY-RUN] CLAUDE.md — Hora serait ajoute (existant conserve)"
    else
      cp "$CLAUDE_DIR/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md.bak"
      {
        echo ""
        echo "$HORA_START_MARKER"
        cat "$HORA_DIR/CLAUDE.md"
        echo "$HORA_END_MARKER"
      } >> "$CLAUDE_DIR/CLAUDE.md"
    fi
    echo "[OK] CLAUDE.md (Hora ajoute, existant conserve -> .bak)"
  fi
else
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

# --- settings.json : remplacer par Hora, supprimer hooks PAI ---
HORA_SETTINGS="$HORA_DIR/settings.json"
TARGET_SETTINGS="$CLAUDE_DIR/settings.json"

if [ -f "$TARGET_SETTINGS" ]; then
  if $DRY_RUN; then
    if $HAS_JQ; then
      echo "   [DRY-RUN] settings.json — merge Hora (PAI supprime si present)"
    else
      echo "   [DRY-RUN] settings.json — ecrasement par Hora (jq absent)"
    fi
  elif $HAS_JQ; then
    cp "$TARGET_SETTINGS" "$TARGET_SETTINGS.bak"

    # Détecter si PAI est présent
    if jq -e '.hooks | to_entries[].value[] | .hooks[]?.command | contains("PAI_DIR")' "$TARGET_SETTINGS" &>/dev/null; then
      echo "[INFO] PAI detecte -> suppression des hooks PAI..."
    fi

    # Garder les hooks tiers non-PAI + merger hooks Hora + conserver statusLine/spinnerVerbs
    jq -s '
      .[0] as $existing | .[1] as $hora |
      ($existing.hooks // {}) |
      to_entries | map(
        .key as $event |
        {
          key: $event,
          value: [
            .value[] |
            select(.hooks[]?.command | contains("PAI_DIR") | not)
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
  else
    # Sans jq : sauvegarder et ecraser
    cp "$TARGET_SETTINGS" "$TARGET_SETTINGS.bak"
    cp "$HORA_SETTINGS" "$TARGET_SETTINGS"
    echo "[WARN] settings.json ecrase (jq absent — hooks tiers perdus, .bak conserve)"
  fi
else
  _cp "$HORA_SETTINGS" "$TARGET_SETTINGS"
fi
echo "[OK] settings.json"

# --- Statusline ---
_cp "$HORA_DIR/statusline.sh" "$CLAUDE_DIR/statusline.sh"
_chmod +x "$CLAUDE_DIR/statusline.sh"
echo "[OK] statusline.sh"

# --- Hooks / Agents / Skills ---
if $DRY_RUN; then
  echo "   [DRY-RUN] hooks/ — $(ls "$HORA_DIR/hooks/"*.ts | wc -l | tr -d ' ') fichiers seraient copies"
else
  cp "$HORA_DIR/hooks/"*.ts "$CLAUDE_DIR/hooks/"
fi
echo "[OK] hooks/ ($(ls "$HORA_DIR/hooks/"*.ts | wc -l | tr -d ' ') fichiers)"

if $DRY_RUN; then
  echo "   [DRY-RUN] agents/ — fichiers seraient copies"
else
  cp "$HORA_DIR/agents/"*.md "$CLAUDE_DIR/agents/"
fi
echo "[OK] agents/"

# Skills = dossiers avec SKILL.md (pas des fichiers .md plats)
# Nettoyer les anciens fichiers .md plats si presents
for old_skill in "$CLAUDE_DIR/skills/"*.md; do
  [ -f "$old_skill" ] || continue
  _rm "$old_skill"
  echo "   [CLEAN] $(basename "$old_skill") (ancien format)"
done
# Copier les dossiers de skills
for skill_dir in "$HORA_DIR/skills/"*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  _mkdir -p "$CLAUDE_DIR/skills/$skill_name"
  _cp "$skill_dir"SKILL.md "$CLAUDE_DIR/skills/$skill_name/SKILL.md"
done
echo "[OK] skills/ ($(find "$HORA_DIR/skills" -name SKILL.md | wc -l | tr -d ' ') skills)"

# --- Patterns de securite ---
_cp "$HORA_DIR/.hora/patterns.yaml" "$CLAUDE_DIR/.hora/patterns.yaml"
echo "[OK] .hora/patterns.yaml (regles de securite)"

# --- MEMORY (ne pas écraser si déjà rempli) ---
INSTALLED=0
for f in identity projects preferences vocabulary; do
  TARGET="$CLAUDE_DIR/MEMORY/PROFILE/$f.md"
  if [ ! -f "$TARGET" ] || [ ! -s "$TARGET" ]; then
    _cp "$HORA_DIR/MEMORY/PROFILE/$f.md" "$TARGET"
    INSTALLED=1
  fi
done
[ $INSTALLED -eq 1 ] && echo "[OK] MEMORY/PROFILE/ (vierge)" || echo "[INFO] MEMORY/PROFILE/ existant conserve"

# --- Gitkeeps pour les répertoires vides ---
for dir in SESSIONS LEARNING/FAILURES LEARNING/ALGORITHM LEARNING/SYSTEM SECURITY STATE WORK; do
  _touch "$CLAUDE_DIR/MEMORY/$dir/.gitkeep" 2>/dev/null || true
done

# --- Vérification intégrité données session ---
echo ""
echo "[CHECK] Verification integrite..."
ISSUES=0
for item in "${CLAUDE_PROTECTED[@]}"; do
  BACKUP="$BACKUP_DIR/$item"
  LIVE="$CLAUDE_DIR/$item"
  if [ -e "$BACKUP" ] && [ ! -e "$LIVE" ]; then
    echo "   [WARN] $item manquant -> restauration..."
    _cp -r "$BACKUP" "$CLAUDE_DIR/"
    ISSUES=$((ISSUES + 1))
  fi
done
[ $ISSUES -eq 0 ] && echo "   [OK] Toutes les donnees de session intactes" || echo "   [OK] $ISSUES element(s) restaure(s)"

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
echo "Securite : .hora/patterns.yaml (personnalisable)"
echo ""
echo "Usage : bash install.sh [--dry-run | --restore]"
echo ""
if ! $DRY_RUN; then
echo "[INFO] Backup sessions dans : $BACKUP_DIR"
echo "[INFO] Restaurer si besoin  : bash install.sh --restore"
echo ""
fi
