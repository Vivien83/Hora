# Skill: plan

Planification complète avant exécution. Produit un plan avec ISC vérifiables. Attend validation avant de BUILD.

## Invocation

```
/hora:plan "objectif"
```

## Protocol

### 1. OBSERVE
- Quelle est la vraie demande ?
- Quelles sont les contraintes implicites ?
- Quel est le contexte depuis MEMORY/ ?
- Qu'est-ce qui pourrait mal tourner ?

### 2. THINK
- Quelle est la meilleure approche ?
- Quelles alternatives existent ?
- Quel est le scope réel (ne pas sous-estimer, ne pas sur-estimer) ?

### 3. PLAN — Output

```
## Plan — [objectif]

### Contexte
[ce qu'on sait, les contraintes]

### Approche retenue
[et pourquoi cette approche vs les alternatives]

### ISC — Ideal State Criteria
Succès = tous ces critères sont vérifiables et cochés :
- [ ] [Critère 1 — mesurable]
- [ ] [Critère 2 — mesurable]
- [ ] [Critère 3 — mesurable]

### Étapes d'exécution
1. [Étape 1] — responsable: [executor/architect/...] — durée estimée: Xmin
2. [Étape 2] — dépend de: [Étape 1]
3. [Étape 3] — peut être parallèle avec [Étape 2]

### Risques identifiés
- [Risque 1] → mitigation: [action]
- [Risque 2] → mitigation: [action]

### Questions ouvertes
[ce qui nécessite validation avant de commencer]
```

### 4. Validation
Attendre confirmation avant de passer à BUILD.
Si "go" → active autopilot ou parallel-code selon le plan.
