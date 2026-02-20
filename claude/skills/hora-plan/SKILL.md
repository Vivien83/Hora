---
name: hora-plan
description: Planification HORA avec ISC verifiables. USE WHEN plan, planifie, hora plan, roadmap, etapes, comment faire, how to build, strategie.
---

# Skill: hora-plan

Planification complete avant execution. Produit un plan avec ISC verifiables. Attend validation avant de BUILD.

## Invocation

```
/hora-plan "objectif"
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
- Quel est le scope reel (ne pas sous-estimer, ne pas sur-estimer) ?

### 3. PLAN — Output

```
## Plan — [objectif]

### Contexte
[ce qu'on sait, les contraintes]

### Approche retenue
[et pourquoi cette approche vs les alternatives]

### ISC — Ideal State Criteria
Succes = tous ces criteres sont verifiables et coches :
- [ ] [Critere 1 — mesurable]
- [ ] [Critere 2 — mesurable]
- [ ] [Critere 3 — mesurable]

### Etapes d'execution
1. [Etape 1] — responsable: [executor/architect/...] — duree estimee: Xmin
2. [Etape 2] — depend de: [Etape 1]
3. [Etape 3] — peut etre parallele avec [Etape 2]

### Risques identifies
- [Risque 1] → mitigation: [action]
- [Risque 2] → mitigation: [action]

### Questions ouvertes
[ce qui necessite validation avant de commencer]
```

### 4. AUDIT (ghost failures)
Avant validation, identifier les **ghost failures** — les cas ou le systeme echoue silencieusement :
- Chaque point d'integration : que se passe-t-il s'il echoue, timeout, ou valeur inattendue ?
- Chaque hypothese technique : **verifiee** ou **supposee** ?
- Chaque flux de donnees : race conditions, fichiers stale, faux positifs ?

Ajouter au plan :
```
### Ghost failures identifies
- [GF-1] [hypothese non verifiee] → tester avant de coder
- [GF-2] [point d'echec silencieux] → mitigation: [action]
```

Si ghost failures critiques → **proposer de tester avant de coder**.
Si aucun → documenter pourquoi (preuve negative).

### 5. Validation
Attendre confirmation avant de passer a BUILD.
Si "go" → active autopilot ou parallel-code selon le plan.
