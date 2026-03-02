---
paths:
  - ".hora/**"
  - ".claude/**"
---

# HORA Project Knowledge (audit automatique)

Quand `.hora/project-knowledge.md` absent :
1. Proposer audit complet avant tout travail
2. Utiliser `/hora-parallel-code` pour explorer la codebase
3. Couvrir : architecture, stack, failles, dette, points positifs

## Format des failles
| # | Severite | Description | Impact | Solution |
|---|---|---|---|---|
Niveaux : **critique** > **haute** > **moyenne** > **basse**

## Stockage : `.hora/project-knowledge.md`
- Injecte auto au debut de session (prompt-submit)
- MAJ incrementale (editer la section, pas recrire)
- Versionne avec git

## Format
```
# Audit : <nom>
> MAJ : <date>
## Architecture
## Stack
## Failles identifiees
## Dette technique
## Points positifs
```
