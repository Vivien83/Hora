# HORA Hooks & Systemes automatiques

## Snapshots (protection fichiers)
Chaque Write/Edit sauvegarde AVANT modification dans `<projet>/.hora/snapshots/`.
- Manifest : `<projet>/.hora/snapshots/manifest.jsonl`
- Fichiers : `YYYY-MM-DD/HH-MM-SS-mmm_fichier.ext.bak`
- Limites : 100 derniers, max 5 Mo, skip binaires

## Learning (extraction automatique)
A la fin de chaque session (3+ messages), le hook `session-end` :
1. Profil → `MEMORY/PROFILE/`
2. Erreurs → `MEMORY/LEARNING/FAILURES/failures-log.jsonl`
3. Sentiment (1-5) → `MEMORY/LEARNING/ALGORITHM/sentiment-log.jsonl`
4. Archive → `MEMORY/SESSIONS/`
Silencieux. L'utilisateur n'est jamais interrompu.

## Doc Sync (PostToolUse)
Detecte 5+ fichiers structurants modifies → rappelle de MAJ `.hora/project-knowledge.md`.
N'ecrit jamais directement. Injecte une instruction.

## Session Naming
Hook `hora-session-name` : 2-3 mots-cles → `MEMORY/STATE/session-names.json`.
