---
name: hora-backup
description: Sauvegarde immediate HORA. USE WHEN backup, hora backup, sauvegarde, save.
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
