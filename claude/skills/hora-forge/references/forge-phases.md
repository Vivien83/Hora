# Forge Phases — Reference detaillee

> Ce fichier contient le detail complet de chaque phase du workflow hora-forge.
> Charge a la demande par Claude quand une phase specifique est executee.

---

## Phase 1 — SPEC (Specification avant tout)

**Principe SDD** : la specification EST le contrat. Pas de code sans spec.

### 1.1 Definir les comportements attendus (BDD)

Pour chaque comportement, ecrire en **Given/When/Then** :

```
GIVEN [etat initial / preconditions]
WHEN  [action / declencheur]
THEN  [resultat attendu / postconditions]
```

### 1.2 Definir les contrats (Design by Contract)

Pour chaque fonction/service concerne :
- **Preconditions** : qu'est-ce que l'appelant doit garantir ? (schema Zod d'entree)
- **Postconditions** : qu'est-ce que la fonction garantit ? (schema Zod de sortie)
- **Invariants** : qu'est-ce qui doit rester vrai avant ET apres ? (type assertions)

### 1.3 Criteres d'acceptation (ISC)

Chaque critere DOIT etre testable automatiquement. Pas de "ca marche bien" — un test precis.

```
ISC :
- [ ] [Critere 1] -> verifie par : [type de test + description]
- [ ] [Critere 2] -> verifie par : [type de test + description]
- [ ] [Critere 3] -> verifie par : [type de test + description]
```

### 1.4 Matrice de tracabilite (DO-178C)

Chaque spec -> au moins un test. Chaque test -> au moins une spec.

```
| Spec | Test | Statut |
|------|------|--------|
| S1: [comportement] | T1: [test unitaire] | pending |
| S2: [comportement] | T2: [test integration] | pending |
```

> **Gate 1** : la phase SPEC ne se termine pas tant que chaque ISC n'a pas un test associe dans la matrice.

---

## Phase 2 — ANALYZE (Exploration intelligente)

Lire avant d'ecrire. Explorer la codebase et le contexte.

### Actions (agents adaptatifs sauf mode `-e`)

| Complexite | Agents | Focus |
|------------|--------|-------|
| F-E | 0 (direct) | Glob/Grep rapide |
| D | 1-2 | Codebase patterns + docs |
| C | 2-4 | + conventions existantes, tests existants |
| B-A | 4-8 | + securite, edge cases, libs alternatives |

### Checklist obligatoire

- [ ] Fichiers concernes identifies
- [ ] Patterns existants compris (comment le projet teste deja ?)
- [ ] Framework de test detecte (Vitest ? Jest ? Playwright ? autre ?)
- [ ] SSOT verifie (cette logique existe-t-elle deja ?)
- [ ] Library-first verifie (une lib fait-elle deja ca ?)

---

## Phase 3 — PLAN (Strategie fichier par fichier)

### 3.1 Plan d'implementation

Pour chaque fichier a modifier/creer :

```
| # | Fichier | Action | Test associe | Classe |
|---|---------|--------|-------------|--------|
| 1 | src/services/auth.ts | Modifier | tests/services/auth.test.ts | B |
| 2 | src/schemas/user.ts | Creer | tests/schemas/user.test.ts | C |
```

### 3.2 Ordre d'execution

Respecter les dependances. Les schemas/contrats d'abord, les services ensuite, les composants UI en dernier.

### 3.3 AUDIT (ghost failures)

**3 questions NASA obligatoires :**
1. **Hypotheses** : chaque supposition technique est-elle **verifiee** ou **supposee** ? Supposee = tester avant.
2. **Integrations** : chaque point de contact — que se passe-t-il s'il echoue / timeout / valeur inattendue ?
3. **Flux** : race conditions ? fichiers stale ? faux positifs dans les tests ?

Si ghost failure critique -> **ne pas passer a la phase suivante**. Resoudre d'abord.

> **Gate 2** : le plan est valide si chaque fichier a un test associe ET zero ghost failure critique ouvert.
> Classe B-A : validation utilisateur obligatoire avant de continuer.

---

## Phase 4 — TEST FIRST (TDD Red)

**Principe fondamental** : les tests sont ecrits AVANT le code d'implementation.

### 4.1 Detecter l'infra de test existante

```bash
# Detecter automatiquement
# Vitest : vitest.config.ts / vite.config.ts avec test
# Jest : jest.config.* / package.json > jest
# Playwright : playwright.config.ts
# Si rien : proposer Vitest (defaut HORA stack)
```

### 4.2 Ecrire les tests (RED)

Pour chaque ligne de la matrice de tracabilite :
1. Ecrire le test correspondant
2. Le test DOIT echouer (Red) — sinon c'est que le comportement existe deja
3. Suivre la pyramide Google :
   - **Unit** (base) : fonctions pures, schemas Zod, utils
   - **Integration** (milieu) : services, API routes, hooks
   - **E2E** (sommet, Classe B+ uniquement) : workflows utilisateur complets

### 4.3 Contrats Zod comme tests

Les schemas Zod sont des tests de contrat vivants :

```typescript
// Le schema EST le test de precondition
const CreateUserInput = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

// Le schema EST le test de postcondition
const CreateUserOutput = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.date(),
});
```

### 4.4 Verification

Lancer les tests. Ils doivent TOUS echouer (Red) pour les nouveaux comportements.
Les tests existants doivent TOUS passer (pas de regression).

```bash
# Adapter au framework detecte
npx vitest run          # ou npm test, ou jest, etc.
```

> **Gate 3** : les tests Red sont ecrits et echouent pour les bonnes raisons. Les tests existants passent.

---

## Phase 5 — BUILD (TDD Green + Refactor)

### 5.1 Implementation minimale (GREEN)

Pour chaque test Red :
1. Ecrire le **minimum de code** pour faire passer le test
2. Lancer le test apres chaque modification
3. **JIDOKA** : si un test devient rouge -> **STOP IMMEDIAT**. Ne pas continuer. Corriger d'abord.

### 5.2 Refactor

Une fois tous les tests au vert :
1. Eliminer la duplication
2. Ameliorer le design d'implementation (pas l'interface)
3. Relancer tous les tests apres chaque refactor
4. **JIDOKA** : test rouge pendant refactor -> UNDO le refactor, pas "fix forward"

### 5.3 Regles Jidoka (Toyota)

```
SI test_rouge PENDANT build:
    -> STOP immediat
    -> Identifier le test qui echoue
    -> Corriger dans le scope actuel
    -> NE PAS avancer tant que tous les tests ne sont pas verts
    -> Max 3 tentatives sur la meme erreur, apres -> signaler blocage

SI test_rouge PENDANT refactor:
    -> UNDO le refactor (git checkout le fichier)
    -> Le refactor etait trop ambitieux, le decouper
```

### 5.4 Verification continue

Apres CHAQUE fichier modifie :
```bash
# Typecheck
npx tsc --noEmit

# Lint
npx eslint . --quiet

# Tests
npx vitest run
```

Les 3 doivent passer. Si l'un echoue -> corriger avant de toucher au fichier suivant.

> **Gate 4** : tous les tests passent (Green), typecheck OK, lint OK. Zero regression.

---

## Phase 6 — VERIFY (Validation multi-couches)

La pyramide de verification, du plus rapide au plus lent :

### Couche 1 — Analyse statique (shift-left)
```bash
npx tsc --noEmit           # Types
npx eslint . --quiet       # Lint + regles securite
```

### Couche 2 — Tests unitaires
```bash
npx vitest run --reporter=verbose
```

### Couche 3 — Tests d'integration (Classe C+)
```bash
npx vitest run --project=integration   # ou equivalent
```

### Couche 4 — Tests E2E (Classe B+)
```bash
npx playwright test        # ou equivalent
```

### Couche 5 — Couverture (Classe C+)
```bash
npx vitest run --coverage
```
- Viser 80%+ sur les fichiers modifies
- 100% sur les chemins critiques (auth, paiement, data)

### Couche 6 — Mutation testing (Classe A uniquement)
```bash
npx stryker run --mutate="src/chemin/fichier.ts"
```
- Mutation score > 80% sur les modules critiques
- Revele les tests qui passent toujours (vacuous tests)

### Self-audit checklist

- [ ] Tous les tests passent (unit + integ + E2E si applicable)
- [ ] Typecheck clean
- [ ] Lint clean
- [ ] Pas de `console.log` oublie
- [ ] Pas de `any` introduit
- [ ] Pas de TODO sans issue trackee
- [ ] Pas de secrets hardcodes
- [ ] Chaque ISC de la matrice de tracabilite est au statut `pass`

> **Gate 5** : toutes les couches applicables a la Classe passent. La matrice de tracabilite est complete : chaque spec a un test PASS.

---

## Phase 7 — EXAMINE (Review adversariale IV&V)

Active par defaut pour Classe B-A. Active avec flag `-x` pour les autres classes.

**Principe NASA IV&V** : celui qui a ecrit le code ne le review pas. L'examinateur est independant.

### Lancer un agent reviewer avec le mandat suivant :

```
Review adversariale du code modifie. Tu n'as PAS ecrit ce code.
Ton role est de trouver les failles, pas de confirmer que ca marche.

Chercher specifiquement :
1. SECURITE : injections, XSS, CSRF, auth bypass, OWASP top 10
2. LOGIQUE : edge cases, off-by-one, null/undefined, race conditions
3. CONTRATS : les schemas Zod couvrent-ils tous les cas ? inputs invalides ?
4. TESTS : les tests testent-ils le bon comportement ? faux positifs possibles ?
5. ROBUSTESSE : que se passe-t-il si [X] echoue / timeout / renvoie une erreur ?

Classification des findings :
- CRITICAL : doit etre corrige avant merge
- HIGH : devrait etre corrige avant merge
- MEDIUM : a corriger dans le prochain sprint
- LOW : suggestion d'amelioration
```

> **Gate 6** : zero finding CRITICAL ou HIGH ouvert. Tout CRITICAL/HIGH est corrige ou explicitement accepte par l'utilisateur.

---

## Phase 8 — RESOLVE (Correction des findings)

Si la phase 7 a produit des findings CRITICAL ou HIGH :

### 8.1 Pour chaque finding
1. Ecrire un test qui reproduit le probleme (TDD Red)
2. Corriger le code (TDD Green)
3. Relancer toute la suite de verification (Phase 6)
4. **JIDOKA** : si la correction casse autre chose -> STOP

### 8.2 Re-examiner
Si des corrections ont ete apportees, relancer la Phase 7 sur les fichiers modifies.
Boucle max : 3 iterations. Apres 3 -> signaler le blocage.

> **Gate 7** : tous les findings CRITICAL/HIGH sont resolus. La suite de tests passe toujours.

---

## Phase 9 — DELIVER (Gate finale)

### 9.1 Checklist de livraison

```
MATRICE DE TRACABILITE FINALE :
| Spec | Test | Resultat | Gate |
|------|------|----------|------|
| S1   | T1   | PASS     | OK   |
| S2   | T2   | PASS     | OK   |
| ...  | ...  | ...      | ...  |

GATES :
- [x] Gate 1 (SPEC)    : chaque ISC a un test associe
- [x] Gate 2 (PLAN)    : zero ghost failure critique ouvert
- [x] Gate 3 (TEST)    : tests Red ecrits, existants passent
- [x] Gate 4 (BUILD)   : tous tests Green, typecheck+lint OK
- [x] Gate 5 (VERIFY)  : toutes couches de verification passent
- [x] Gate 6 (EXAMINE) : zero finding critique ouvert (si applicable)
- [x] Gate 7 (RESOLVE) : corrections verifiees (si applicable)
```

### 9.2 Commit

Message conventionnel avec tracabilite :
```
feat: [description]

Tested: [N] unit, [N] integration, [N] E2E
Coverage: [X]% on modified files
Forge class: [X]
```

### 9.3 PR (si flag `-pr`)

```bash
gh pr create --title "[description]" --body "$(cat <<'EOF'
## Summary
[1-3 bullet points]

## Forge Report
- Class: [X]
- Tests added: [N]
- Coverage: [X]% on modified files
- Gates passed: [N]/7
- Matrice de tracabilite: [N] specs / [N] tests / [N] pass

## Test plan
[Checklist des tests]
EOF
)"
```

> **Gate finale** : TOUTES les gates precedentes sont OK. Le livrable est **prouve fonctionnel**.

---

## Adaptation au projet

La skill detecte automatiquement :
- **Framework de test** : Vitest / Jest / Playwright / autre (via config files)
- **Linter** : ESLint / Biome / autre
- **Typecheck** : tsc / autre
- **Structure de tests** : `__tests__/`, `tests/`, `*.test.ts`, `*.spec.ts`
- **Couverture** : c8 / istanbul / v8

Si rien n'est detecte, proposer la stack par defaut HORA : **Vitest + Playwright + ESLint**.
