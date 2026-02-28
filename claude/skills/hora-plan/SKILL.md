---
name: hora-plan
description: HORA planning with verifiable ISC — structured approach before any implementation. Use when user says plan, planifie, hora plan, roadmap, etapes, comment faire, how to build, strategie, architecture decision. Do NOT use when user wants immediate implementation — use hora-autopilot or hora-forge instead.
metadata:
  author: HORA
  version: 2.0.0
compatibility: Claude Code. Planning only — delegates to other skills for execution.
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
Avant validation, identifier les **ghost failures** :
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

## Examples

Example 1: Planning a new feature
```
User: "/hora-plan systeme de facturation"
→ Produit un plan avec :
  - Contexte : stack detectee, modeles de donnees existants
  - Approche : Stripe + webhooks + Drizzle schemas
  - ISC : 5 criteres (checkout fonctionne, webhooks gerees, factures PDF, etc.)
  - Etapes : 6 etapes ordonnees avec dependances
  - Ghost failures : webhook replay, idempotency, devises
→ Attend "go" pour lancer
```

Example 2: Architecture decision
```
User: "/hora-plan comment structurer le monorepo"
→ Compare Turborepo vs Nx vs pnpm workspaces
→ Propose une approche avec justification
→ ISC = build time, DX, CI/CD, shared packages
```

## Troubleshooting

Problem: Plan too vague
Cause: Not enough OBSERVE — insufficient codebase exploration
Solution: Read more files, check existing patterns, understand the real constraints

Problem: ISC not measurable
Cause: Criteria like "it works well" instead of "response time < 200ms"
Solution: Every ISC must have a test or metric that proves it

Problem: User skips validation on critical plan
Cause: Impatience
Solution: For critical tasks (auth, data, payments), never skip validation — explain why
