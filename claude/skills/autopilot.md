# Skill: autopilot

Exécution autonome complète d'une tâche. Ne s'arrête que quand les ISC sont satisfaits.

## Invocation

```
/hora:autopilot "objectif complet"
```

## Protocol

### 1. OBSERVE
Analyse la demande en profondeur. Identifie la vraie demande derrière les mots. Charge le contexte pertinent depuis MEMORY/.

### 2. THINK
Détermine l'approche. Quels agents activer ? Quelle complexité réelle ? Quels risques ?

### 3. PLAN
Crée une checklist d'exécution avec ISC (Ideal State Criteria).

```
ISC de succès :
- [ ] Critère 1 (vérifiable)
- [ ] Critère 2 (vérifiable)
- [ ] Critère 3 (vérifiable)
```

### 4. BUILD
Délègue à architect pour les décisions structurelles.
Délègue à executor pour l'implémentation.
Lance en parallèle si les tâches sont indépendantes.

### 5. VERIFY
Passe en revue chaque ISC. Tous cochés → terminé. ISC manquant → reboucle sur BUILD.

## Règle fondamentale

Ne pas s'arrêter avant que tous les ISC soient satisfaits. Si bloqué, signale le blocage et attends instruction.
