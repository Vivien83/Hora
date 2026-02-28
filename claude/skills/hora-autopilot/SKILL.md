---
name: hora-autopilot
description: Autonomous end-to-end HORA execution — runs until all ISC are satisfied. Use when user says autopilot, hora autopilot, execute everything, do it all, go, implement everything, lance tout, fais tout. Do NOT use for planning only — use hora-plan instead. Do NOT use for single-file changes — standard HORA workflow is faster.
metadata:
  author: HORA
  version: 2.0.0
compatibility: Claude Code. Delegates to architect, executor, and reviewer agents.
---

# Skill: hora-autopilot

Execution autonome complete d'une tache. Ne s'arrete que quand les ISC sont satisfaits.

## Invocation

```
/hora-autopilot "objectif complet"
```

## Protocol

### 1. OBSERVE
Analyse la demande en profondeur. Identifie la vraie demande derriere les mots. Charge le contexte pertinent depuis MEMORY/.

### 2. THINK
Determine l'approche. Quels agents activer ? Quelle complexite reelle ? Quels risques ?

### 3. PLAN
Cree une checklist d'execution avec ISC (Ideal State Criteria).

```
ISC de succes :
- [ ] Critere 1 (verifiable)
- [ ] Critere 2 (verifiable)
- [ ] Critere 3 (verifiable)
```

### 4. AUDIT (ghost failures)
Avant de coder, identifier les **ghost failures** — les cas ou le systeme echoue silencieusement :
- Chaque point d'integration : que se passe-t-il s'il echoue, timeout, ou valeur inattendue ?
- Chaque hypothese technique : **verifiee** ou **supposee** ?
- Chaque flux de donnees : race conditions, fichiers stale, faux positifs ?

Si ghost failures critiques → **tester avant de coder**. Jamais d'implementation sur hypothese non verifiee.
Si aucun → documenter pourquoi (preuve negative).

### 5. BUILD (si AUDIT ok)
Delegue a architect pour les decisions structurelles.
Delegue a executor pour l'implementation.
Lance en parallele si les taches sont independantes.

### 6. VERIFY
Passe en revue chaque ISC. Tous coches → termine. ISC manquant → reboucle sur BUILD.

## Regle fondamentale

Ne pas s'arreter avant que tous les ISC soient satisfaits. Si bloque, signale le blocage et attends instruction.

## Examples

Example 1: Feature complete
```
User: "/hora-autopilot ajoute un systeme de notifications email"
→ OBSERVE: lit le projet, detecte le stack (Next.js, Drizzle, etc.)
→ THINK: react-email + Resend, 3 templates, 1 service, 1 API route
→ PLAN: ISC = emails envoyes, templates renders, erreurs gerees
→ AUDIT: que faire si Resend est down ? (fallback log + retry queue)
→ BUILD: architect definit la structure, executor implemente
→ VERIFY: chaque ISC coche, tests passent
```

Example 2: Multi-step migration
```
User: "/hora-autopilot migre l'auth de NextAuth vers Better-Auth"
→ OBSERVE: lit la config NextAuth actuelle, les sessions, les providers
→ THINK: migration en 4 phases (schema, provider, middleware, UI)
→ PLAN: ISC = login fonctionne, sessions preservees, 0 regression
→ AUDIT: ghost failure = sessions existantes invalidees (mitigation: migration DB)
→ BUILD: phase par phase, tests a chaque etape
→ VERIFY: tous les flows auth testes
```

## Troubleshooting

Problem: Autopilot loops on the same ISC
Cause: ISC too vague or not measurable
Solution: Redefine ISC with concrete, testable criteria

Problem: Agent gets stuck on a build step
Cause: Missing dependency or conflicting code
Solution: Autopilot should signal the blockage and wait for user input — never force-fix

Problem: Too many agents spawned
Cause: Task decomposition too granular
Solution: Merge related subtasks, max 4-6 parallel agents
