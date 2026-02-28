---
name: hora-parallel-code
description: Parallel multi-agent codebase execution — architect plans, executors implement in parallel, reviewer validates. Use when user says parallel code, hora parallel, refactor multiple files, migration, multi-fichiers, codebase-wide change. Do NOT use for single-file changes — standard HORA workflow is faster. Do NOT use for research — use hora-parallel-research instead.
metadata:
  author: HORA
  version: 2.0.0
compatibility: Claude Code. Spawns architect, executor, and reviewer agents.
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

Statut :
- [tache 1] — OK
- [tache 2] — OK
- [tache 3] — Partiel (raison)

Prochaines etapes : [si applicable]
```

## Examples

Example 1: Rename a concept across the codebase
```
User: "/hora-parallel-code renomme 'workspace' en 'project' partout"
→ Architect: identifie 15 fichiers concernes, 3 groupes independants
→ Dispatch: 3 executors en parallele (types, services, UI)
→ Review: coherence des imports, pas de reference orpheline
```

Example 2: Add Zod validation to all API routes
```
User: "/hora-parallel-code ajoute la validation Zod sur toutes les API routes"
→ Architect: liste 8 routes, detecte les schemas existants
→ AUDIT: routes partagent-elles des schemas ? (oui → schemas d'abord, routes ensuite)
→ Dispatch: 1 executor schemas, puis 4 executors routes en parallele
→ Review: tous les endpoints valident, tests passent
```

## Troubleshooting

Problem: Two executors modify the same file
Cause: Architect decomposition missed a shared dependency
Solution: Never assign the same file to two executors — merge those tasks

Problem: Executor fails on a file
Cause: Unexpected code state or missing context
Solution: Retry with more context, or escalate to architect for re-decomposition

Problem: Tests fail after parallel modifications
Cause: Cross-file dependencies not accounted for
Solution: Run full test suite after all executors complete, not per-executor
