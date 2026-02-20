---
name: hora-parallel-code
description: Execution parallele multi-agents sur codebase. USE WHEN parallel code, hora parallel, refactor, migration, multi-fichiers, plusieurs fichiers, codebase.
---

# Skill: hora-parallel-code

Execution parallele multi-agents sur une codebase. Optimal pour refactoring, migration, implementation multi-fichiers.

## Invocation

```
/hora-parallel-code "description de la tache"
```

## Protocol

### 1. Analyse (architect)
- Cartographie les fichiers et modules concernes
- Identifie les dependances entre sous-taches
- Separe en taches **independantes** (parallelisables) et **sequentielles** (ordonnees)

### 2. AUDIT (ghost failures)
Avant de dispatcher les executors, verifier :
- Dependances circulaires entre taches ? (parallelisation impossible)
- Fichiers partages entre taches ? (conflit de modification simultanee)
- Hypotheses sur l'etat du code : **verifiees** ou **supposees** ?
- Impact de chaque modification sur les tests existants ?

Si ghost failure critique → ajuster la decomposition avant dispatch.
Si aucun → documenter pourquoi.

### 3. Dispatch (executor x N)
Pour chaque tache independante, lance un agent executor via Task :

```
Task: "Modifier [fichier X] pour [objectif precis].
Contexte : [ce que l'agent doit savoir].
Contrainte : ne pas modifier [Y] ni [Z]."
```

### 4. Coordination
- Les taches sequentielles attendent la fin des paralleles
- Si un executor echoue → signale et propose correction
- Pas de modification de fichier partage en simultane

### 5. Review (reviewer)
Une fois tous les executors termines :
- Review globale des modifications
- Verification de coherence inter-fichiers
- Test si possible (Bash)

### 6. Rapport final

```
## Parallel-code — Resultat

Taches executees : N
Fichiers modifies : [liste]
Duree estimee : X min

Statut :
- [tache 1] — OK
- [tache 2] — OK
- [tache 3] — Partiel (raison)

Prochaines etapes : [si applicable]
```
