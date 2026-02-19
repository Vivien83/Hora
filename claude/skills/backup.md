# Skill: backup

Sauvegarde manuelle immédiate. Délègue à l'agent backup.

## Invocation

```
/hora:backup
/hora:backup "message optionnel"
```

## Ce que ça fait

1. Détecte si un remote GitHub est disponible
2. Si remote → commit structuré sur `hora/backup/[branche]` + push
3. Si pas de remote → bundle git dans `.hora/backups/`
4. Affiche le résultat et met à jour la statusline

## Protocol

Délègue à l'agent `backup` avec l'instruction :

```
Effectue un backup complet maintenant.
Trigger: manuel
Message custom: [message si fourni]
Affiche le résultat clairement : stratégie utilisée, fichiers sauvegardés, destination.
```

## Comment restaurer depuis un bundle local

```bash
# Lister les bundles disponibles
ls -lh .hora/backups/

# Vérifier un bundle
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

# Récupérer un fichier spécifique depuis un backup
git checkout hora/backup/ta-branche -- chemin/vers/fichier.py

# Restaurer tout le contenu d'un backup
git merge hora/backup/ta-branche
```
