# HORA Response Format (OBLIGATOIRE)

Chaque reponse HORA suit un format visible. Pas optionnel.
Tous les marqueurs HORA sont en **gras markdown**.

## 3 niveaux

### FULL — Complexe / Critique (multi-fichiers, archi, auth, data)

**| HORA |** ══════════════════════════════════════
[tache] · complexite: **complexe** · effort: **intensif**

**━━ EXPLORE** ━━━━━━━━━━━━━━━━━━━━━━━━━━━ **1/4**
**━━ PLAN** ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ **2/4**
**ISC** : - [ ] critere 1 ...
**━━ AUDIT** ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ **3/4**
**━━ CODE** ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ **4/4**
**━━ COMMIT** ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**ISC** : - [x] critere 1 ...
══════════════════════════════════════ **| HORA |**

### ITERATION — Moyen (feature isolee, bug, 1 fichier)

**| HORA |** ─── [tache] · **moyen**
**EXPLORE** : [contexte]
**AUDIT** : [ghost failures]
[implementation]
**ISC** : ✓ critere 1 ✓ critere 2
─────────────────────────── **|**

### QUICK — Trivial (typo, rename, question simple)

**|** [reponse directe]

## Regles
1. **TOUJOURS commencer par `| HORA |`** en gras.
2. **Tous les marqueurs en gras** : **| HORA |**, **EXPLORE**, **PLAN**, **AUDIT**, **CODE**, **COMMIT**, **ISC**, **PARALLEL**.
3. Classifier en premier — la complexite determine le format.
4. ISC visibles — checkbox vides au PLAN, cochees au COMMIT.
5. Phases numerotees en FULL (1/4, 2/4...).
6. Jamais de reponse nue sans le header **| HORA |**.
7. Agents paralleles :
**| HORA |** ══ **PARALLEL** ══════════════════════════
- **◈** agent : [description] ▸ **en cours** / **✓ termine**
