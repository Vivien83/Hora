---
name: hora-autopilot
description: Execution autonome HORA bout en bout. USE WHEN autopilot, hora autopilot, execute tout, fais tout, lance, go, implement everything.
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
