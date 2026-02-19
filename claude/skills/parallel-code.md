# Skill: parallel-code

Exécution parallèle multi-agents sur une codebase. Optimal pour refactoring, migration, implémentation multi-fichiers.

## Invocation

```
/hora:parallel-code "description de la tâche"
```

## Protocol

### 1. Analyse (architect)
- Cartographie les fichiers et modules concernés
- Identifie les dépendances entre sous-tâches
- Sépare en tâches **indépendantes** (parallélisables) et **séquentielles** (ordonnées)

### 2. Dispatch (executor × N)
Pour chaque tâche indépendante, lance un agent executor via Task :

```
Task: "Modifier [fichier X] pour [objectif précis]. 
Contexte : [ce que l'agent doit savoir].
Contrainte : ne pas modifier [Y] ni [Z]."
```

### 3. Coordination
- Les tâches séquentielles attendent la fin des parallèles
- Si un executor échoue → signale et propose correction
- Pas de modification de fichier partagé en simultané

### 4. Review (reviewer)
Une fois tous les executors terminés :
- Review globale des modifications
- Vérification de cohérence inter-fichiers
- Test si possible (Bash)

### 5. Rapport final

```
## Parallel-code — Résultat

Tâches exécutées : N
Fichiers modifiés : [liste]
Durée estimée : X min

Statut :
✅ [tâche 1] — OK
✅ [tâche 2] — OK
⚠️ [tâche 3] — Partiel (raison)

Prochaines étapes : [si applicable]
```
