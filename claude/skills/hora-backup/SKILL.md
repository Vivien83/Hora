---
name: hora-backup
description: Immediate HORA backup — git mirror branch or local bundle. Use when user says backup, hora backup, sauvegarde, save, save my work. Do NOT use for git commit — use standard git workflow. Do NOT use for snapshots — those are automatic via hooks.
metadata:
  author: HORA
  version: 2.0.0
compatibility: Claude Code. Requires git. Optional GitHub remote for mirror strategy.
---

# Skill: hora-backup

Sauvegarde manuelle immediate. Delegue a l'agent backup.

## Invocation

```
/hora-backup
/hora-backup "message optionnel"
```

## Ce que ca fait

1. Detecte si un remote GitHub est disponible
2. Si remote → commit structure sur `hora/backup/[branche]` + push
3. Si pas de remote → bundle git dans `.hora/backups/`
4. Affiche le resultat et met a jour la statusline

## Protocol

### Pre-check (AUDIT)
Avant de deleguer, verifier :
- Remote accessible ? (timeout reseau = fallback bundle local automatique)
- Branche courante identifiee ? (ne jamais toucher main)
- Espace disque suffisant pour bundle local ? (`df -h .hora/`)

### Execution
Delegue a l'agent `backup` avec l'instruction :

```
Effectue un backup complet maintenant.
Trigger: manuel
Message custom: [message si fourni]
Affiche le resultat clairement : strategie utilisee, fichiers sauvegardes, destination.
```

## Examples

Example 1: Quick backup before risky change
```
User: "/hora-backup avant de refactorer l'auth"
→ Detecte remote GitHub
→ Push sur hora/backup/main avec message "avant de refactorer l'auth"
→ Affiche : "Backup OK — 15 fichiers sur hora/backup/main"
```

Example 2: Offline backup
```
User: "/hora-backup"
→ Pas de remote accessible (timeout)
→ Cree .hora/backups/2026-02-28-1430.bundle
→ Affiche : "Bundle local cree — 2.3 MB"
```

## Comment restaurer depuis un bundle local

```bash
# Lister les bundles disponibles
ls -lh .hora/backups/

# Verifier un bundle
git bundle verify .hora/backups/FICHIER.bundle

# Restaurer
git clone .hora/backups/FICHIER.bundle ./projet-restaure
cd projet-restaure
git checkout [ta-branche]
```

## Comment restaurer depuis la branche miroir GitHub

```bash
# Voir les commits de backup
git log hora/backup/ta-branche --oneline

# Recuperer un fichier specifique depuis un backup
git checkout hora/backup/ta-branche -- chemin/vers/fichier.py

# Restaurer tout le contenu d'un backup
git merge hora/backup/ta-branche
```

## Troubleshooting

Error: "Remote not found"
Cause: No GitHub remote configured or network unavailable
Solution: Automatic fallback to local bundle — no action needed

Error: "Bundle too large"
Cause: Repository has large binary files
Solution: Add binaries to .gitignore, or use git-lfs

Error: "Permission denied on push"
Cause: GitHub credentials expired or insufficient permissions
Solution: Re-authenticate with `gh auth login`
