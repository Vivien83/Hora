#!/usr/bin/env bash
# HORA — Install Script
set -euo pipefail

HORA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/claude"
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$HOME/.hora-install-backup"

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

echo ""
echo "+===========================================+"
echo "|           HORA — Installation              |"
echo "+===========================================+"
echo ""

# --- Prérequis ---
if ! command -v claude &>/dev/null; then
  echo "[ERREUR] Claude Code introuvable. Installe : npm install -g @anthropic-ai/claude-code"
  exit 1
fi

if ! node -e "require('tsx')" &>/dev/null 2>&1 && ! command -v tsx &>/dev/null; then
  echo "[INFO] Installation de tsx..."
  npm install -g tsx
fi

if ! command -v jq &>/dev/null; then
  echo "[ERREUR] jq requis. Installe : brew install jq / apt install jq"
  exit 1
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

  rm -rf "$BACKUP_DIR"
  mkdir -p "$BACKUP_DIR"

  echo "[BACKUP] Sauvegarde des donnees Claude..."
  for item in "${CLAUDE_PROTECTED[@]}"; do
    if [ -e "$CLAUDE_DIR/$item" ]; then
      cp -r "$CLAUDE_DIR/$item" "$BACKUP_DIR/"
      echo "   OK $item"
    fi
  done
  echo "   -> $BACKUP_DIR"
  echo ""
}

# --- Restauration ---
restore_sessions() {
  if [ ! -d "$BACKUP_DIR" ]; then
    echo "[ERREUR] Aucun backup trouve dans $BACKUP_DIR"
    return 1
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
}

# --- Mode restore explicite ---
if [ "${1:-}" = "--restore" ]; then
  restore_sessions
  exit 0
fi

# --- Restauration automatique en cas d'erreur ---
trap 'echo ""; echo "[ERREUR] Erreur pendant linstallation."; echo "   Lance: bash install.sh --restore"; exit 1' ERR

# --- Backup sessions existantes ---
backup_sessions

# --- Structure ---
mkdir -p "$CLAUDE_DIR"/{MEMORY/{PROFILE,SESSIONS,LEARNING/{FAILURES,ALGORITHM,SYSTEM},SECURITY,STATE,WORK},agents,hooks,skills,.hora/{sessions,snapshots}}

# --- CLAUDE.md ---
HORA_MARKER="<!-- HORA:START -->"
HORA_START_MARKER="<!-- HORA:START -->"
HORA_END_MARKER="<!-- HORA:END -->"

if [ -f "$CLAUDE_DIR/CLAUDE.md" ]; then
  if grep -qF "$HORA_MARKER" "$CLAUDE_DIR/CLAUDE.md"; then
    BEFORE=$(sed "/$HORA_START_MARKER/,/$HORA_END_MARKER/d" "$CLAUDE_DIR/CLAUDE.md")
    {
      echo "$BEFORE"
      echo ""
      echo "$HORA_START_MARKER"
      cat "$HORA_DIR/CLAUDE.md"
      echo "$HORA_END_MARKER"
    } > "$CLAUDE_DIR/CLAUDE.md.tmp" && mv "$CLAUDE_DIR/CLAUDE.md.tmp" "$CLAUDE_DIR/CLAUDE.md"
    echo "[OK] CLAUDE.md (bloc Hora mis a jour)"
  else
    cp "$CLAUDE_DIR/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md.bak"
    {
      echo ""
      echo "$HORA_START_MARKER"
      cat "$HORA_DIR/CLAUDE.md"
      echo "$HORA_END_MARKER"
    } >> "$CLAUDE_DIR/CLAUDE.md"
    echo "[OK] CLAUDE.md (Hora ajoute, existant conserve -> .bak)"
  fi
else
  {
    echo "$HORA_START_MARKER"
    cat "$HORA_DIR/CLAUDE.md"
    echo "$HORA_END_MARKER"
  } > "$CLAUDE_DIR/CLAUDE.md"
  echo "[OK] CLAUDE.md (cree)"
fi

# --- settings.json : remplacer par Hora, supprimer hooks PAI ---
HORA_SETTINGS="$HORA_DIR/settings.json"
TARGET_SETTINGS="$CLAUDE_DIR/settings.json"

if [ -f "$TARGET_SETTINGS" ]; then
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
  cp "$HORA_SETTINGS" "$TARGET_SETTINGS"
fi
echo "[OK] settings.json"

# --- Statusline ---
cp "$HORA_DIR/statusline.sh" "$CLAUDE_DIR/statusline.sh"
chmod +x "$CLAUDE_DIR/statusline.sh"
echo "[OK] statusline.sh"

# --- Hooks / Agents / Skills ---
cp "$HORA_DIR/hooks/"*.ts "$CLAUDE_DIR/hooks/"
echo "[OK] hooks/ ($(ls "$HORA_DIR/hooks/"*.ts | wc -l | tr -d ' ') fichiers)"

cp "$HORA_DIR/agents/"*.md "$CLAUDE_DIR/agents/"
echo "[OK] agents/"

cp "$HORA_DIR/skills/"*.md "$CLAUDE_DIR/skills/"
echo "[OK] skills/"

# --- Patterns de securite ---
cp "$HORA_DIR/.hora/patterns.yaml" "$CLAUDE_DIR/.hora/patterns.yaml"
echo "[OK] .hora/patterns.yaml (regles de securite)"

# --- MEMORY (ne pas écraser si déjà rempli) ---
INSTALLED=0
for f in identity projects preferences vocabulary; do
  TARGET="$CLAUDE_DIR/MEMORY/PROFILE/$f.md"
  if [ ! -f "$TARGET" ] || [ ! -s "$TARGET" ]; then
    cp "$HORA_DIR/MEMORY/PROFILE/$f.md" "$TARGET"
    INSTALLED=1
  fi
done
[ $INSTALLED -eq 1 ] && echo "[OK] MEMORY/PROFILE/ (vierge)" || echo "[INFO] MEMORY/PROFILE/ existant conserve"

# --- Gitkeeps pour les répertoires vides ---
for dir in SESSIONS LEARNING/FAILURES LEARNING/ALGORITHM LEARNING/SYSTEM SECURITY STATE WORK; do
  touch "$CLAUDE_DIR/MEMORY/$dir/.gitkeep" 2>/dev/null || true
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
    cp -r "$BACKUP" "$CLAUDE_DIR/"
    ISSUES=$((ISSUES + 1))
  fi
done
[ $ISSUES -eq 0 ] && echo "   [OK] Toutes les donnees de session intactes" || echo "   [OK] $ISSUES element(s) restaure(s)"

echo ""
echo "+===========================================+"
echo "|         Installation terminee !            |"
echo "+===========================================+"
echo ""
echo "-> Lance : claude"
echo ""
echo "Skills : /hora:plan | /hora:autopilot | /hora:parallel-code | /hora:parallel-research | /hora:backup"
echo ""
echo "Securite : .hora/patterns.yaml (personnalisable)"
echo ""
echo "[INFO] Backup sessions dans : $BACKUP_DIR"
echo "[INFO] Restaurer si besoin  : bash install.sh --restore"
echo ""
