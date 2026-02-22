---
name: hora-refactor
description: Refactoring systematique avec filet de securite. Catalogue Fowler + discipline Feathers. USE WHEN refactor, hora refactor, clean code, code smell, dette technique, legacy, simplifier, reorganiser, extraire, decouple.
---

# Skill: hora-refactor

> "N'importe quel imbecile peut ecrire du code qu'un ordinateur comprend. Les bons programmeurs ecrivent du code que les humains comprennent." — Martin Fowler

Workflow de refactoring ou **chaque modification est protegee par des tests**. On ne refactore jamais a l'aveugle. Le code existant est d'abord compris, puis protege, puis transforme.

Inspire de : Martin Fowler (Refactoring, 2nd ed. 2018), Michael Feathers (Working Effectively with Legacy Code), Kent Beck (TDD), Toyota Jidoka (stop on red).

## Invocation

```
/hora-refactor [-a] [-x] [-s] [-e] [-b] [-pr] <description ou fichier(s) cible>
```

## Flags

| Flag | Description |
|------|-------------|
| `-a` | **Autonome** : skip les confirmations (sauf refactoring de classe A-B) |
| `-x` | **Examine** : active la review adversariale apres refactoring |
| `-s` | **Save** : persiste le rapport dans `.hora/refactor/{task-id}/` |
| `-e` | **Economy** : pas de sous-agents, outils directs uniquement |
| `-b` | **Branch** : verifie qu'on n'est pas sur main, cree si besoin |
| `-pr` | **Pull Request** : cree la PR a la fin (active `-b` implicitement) |

> **Il n'existe PAS de flag pour refactorer sans tests.** C'est intentionnel.

---

## Phase 0 — CLASSIFY (scope et risque)

### 0.1 Classifier le refactoring

| Classe | Signal | Filet de securite | Exemples |
|--------|--------|-------------------|----------|
| **F** (trivial) | Rename, reformatage, typo | Typecheck + lint | Renommer une variable locale |
| **E** (mineur) | Extract variable, inline temp | + Tests existants passent | Simplifier une expression |
| **D** (standard) | Extract function, move method | + Characterization tests nouveaux | Decouper une fonction longue |
| **C** (significatif) | Extract class, change signature | + Tests integration | Reorganiser un module entier |
| **B** (critique) | Change d'architecture, inversion de dependances | + Tests E2E + review | Remplacer un pattern global |
| **A** (vital) | Migration de paradigme, refonte de modele | + Validation utilisateur obligatoire | Changer l'architecture d'auth |

**Regle** : en cas de doute, classifier UN NIVEAU AU-DESSUS.

### 0.2 Definir le perimetre

```
REFACTOR [Classe X] — {description}
Scope : {fichier(s) ou module(s) concerne(s)}
Objectif : {ce qui doit changer ET ce qui ne doit PAS changer}
```

L'objectif explicite ce qui NE change PAS. Un refactoring qui modifie le comportement observable n'est pas un refactoring — c'est une feature ou un bug.

> **Gate 0** : le scope est defini. Le comportement observable qui doit rester identique est documente.

---

## Phase 1 — SMELL (scanner le code)

### 1.1 Les 5 categories de code smells (Fowler)

Scanner les fichiers cibles contre le catalogue complet :

#### Bloaters — le code qui enfle

| Smell | Detection | Seuil |
|-------|-----------|-------|
| **Long Method** | Fonction trop longue | > 20 lignes (> 10 ideal) |
| **Large Class** | Fichier/classe surchargee | > 200 lignes ou > 5 responsabilites |
| **Long Parameter List** | Trop de parametres | > 3 parametres |
| **Primitive Obsession** | Types primitifs au lieu d'objets metier | `string` la ou un type metier serait plus clair |
| **Data Clumps** | Memes groupes de donnees qui se repetent | 3+ champs qui voyagent ensemble |

#### Object-Orientation Abusers — mauvais usage des abstractions

| Smell | Detection |
|-------|-----------|
| **Switch Statements** | switch/if-else repete sur le meme discriminant |
| **Temporary Field** | Champ qui n'a de sens que dans certains cas |
| **Refused Bequest** | Sous-classe qui n'utilise pas ce qu'elle herite |
| **Alternative Classes with Different Interfaces** | Deux classes font la meme chose differemment |

#### Change Preventers — le code resistant au changement

| Smell | Detection |
|-------|-----------|
| **Divergent Change** | Un fichier modifie pour N raisons differentes |
| **Shotgun Surgery** | Un changement necessite de toucher N fichiers |
| **Parallel Inheritance Hierarchies** | Ajouter une sous-classe = en ajouter une autre ailleurs |

#### Dispensables — le code inutile

| Smell | Detection |
|-------|-----------|
| **Dead Code** | Code jamais execute (unreachable, exports non importes) |
| **Duplicated Code** | Blocs identiques ou quasi-identiques |
| **Lazy Class** | Classe qui ne fait presque rien |
| **Speculative Generality** | Abstraction pour un cas futur qui n'existe pas |
| **Comments** | Commentaires qui expliquent du code confus (le code devrait etre clair) |

#### Couplers — couplage excessif

| Smell | Detection |
|-------|-----------|
| **Feature Envy** | Methode qui utilise plus les donnees d'un autre objet que les siennes |
| **Inappropriate Intimacy** | Deux classes qui connaissent trop les details internes l'une de l'autre |
| **Message Chains** | `a.getB().getC().getD().doSomething()` |
| **Middle Man** | Classe qui ne fait que deleguer a une autre |

### 1.2 Outils de detection automatique

```bash
# TypeScript : code mort
npx ts-prune                    # Exports non utilises

# ESLint : patterns detectables
npx eslint . --quiet            # Regles de complexity, max-lines, etc.

# Duplication
npx jscpd --min-lines 5 --min-tokens 50 src/
```

### 1.3 Rapport des smells

```
SMELL REPORT :
Fichier(s) : {liste}
Smells detectes : {N total}

| # | Categorie | Smell | Fichier:ligne | Severite | Refactoring propose |
|---|-----------|-------|---------------|----------|---------------------|
| 1 | Bloater | Long Method | src/auth.ts:45 | haute | Extract Function |
| 2 | Coupler | Feature Envy | src/user.ts:120 | moyenne | Move Method |
| ...
```

> **Gate 1** : les smells sont catalogues avec severite et refactoring propose. Aucun refactoring n'est commence.

---

## Phase 2 — PROTECT (filet de securite avant modification)

**Principe Feathers** : avant de modifier du code legacy, ecrire des **characterization tests** qui capturent le comportement ACTUEL, meme s'il est incorrect. Le but n'est pas de tester la spec — c'est de detecter tout changement de comportement.

### 2.1 Identifier les seams (Feathers)

Un **seam** est un endroit ou on peut alterer le comportement du code sans modifier le code lui-meme. Types de seams en TypeScript :

| Type de seam | Technique |
|--------------|-----------|
| **Object seam** | Injection de dependance, interface/type |
| **Preprocessing seam** | Variables d'environnement, config |
| **Link seam** | Import mock (vi.mock, jest.mock) |

Pour chaque fichier a refactorer, identifier les seams AVANT d'ecrire les tests.

### 2.2 Ecrire les characterization tests

```typescript
// Characterization test : capture le comportement ACTUEL
// Ce n'est PAS un test de specification — c'est un filet de securite

describe('auth.ts - characterization', () => {
  it('returns user object when token is valid', () => {
    // Arrangement : reproduire l'etat actuel
    const result = validateToken(validToken);
    // Assert : capturer le comportement actuel exactement
    expect(result).toMatchSnapshot(); // snapshot = characterization
  });

  it('throws when token is expired', () => {
    // Meme si le message d'erreur est mauvais, on le capture
    expect(() => validateToken(expiredToken))
      .toThrow('token invalid'); // Message actuel, pas ideal
  });
});
```

### 2.3 Regles des characterization tests

1. **Tester les OUTPUTS, pas les INTERNALS** — le refactoring va changer les internals
2. **Utiliser des snapshots** pour capturer des structures complexes
3. **Couvrir les chemins principaux ET les edge cases observes**
4. **Ne pas corriger les bugs** dans les characterization tests — les documenter
5. **Quantite** : viser la couverture des branches du code a refactorer

### 2.4 Verifier le filet

```bash
# Lancer les characterization tests
npx vitest run --reporter=verbose

# Verifier la couverture sur les fichiers cibles
npx vitest run --coverage -- src/fichier-cible.ts
```

Tous les tests doivent passer. Si un test echoue, c'est que le characterization test est mal ecrit, pas que le code est bugge.

### 2.5 Sauvegarder le point de reference

```bash
# Commit du filet de securite AVANT tout refactoring
git add tests/
git commit -m "test: add characterization tests for [scope] refactoring"
```

> **Gate 2** : les characterization tests passent. La couverture couvre les branches du code cible. Le commit du filet est fait. On peut refactorer en securite.

---

## Phase 3 — PLAN (strategie de refactoring)

### 3.1 Catalogue des refactorings (Fowler)

Pour chaque smell identifie, appliquer le refactoring du catalogue :

#### Refactorings fondamentaux

| Refactoring | Quand l'utiliser | Mecanique |
|-------------|-----------------|-----------|
| **Extract Function** | Long Method, code a nommer | Couper → coller dans nouvelle fonction → appeler |
| **Inline Function** | Fonction triviale qui obscurcit | Remplacer l'appel par le corps |
| **Extract Variable** | Expression complexe | Nommer l'expression dans une variable |
| **Inline Variable** | Variable inutile | Remplacer la variable par l'expression |
| **Change Function Declaration** | Nom ou parametres inadaptes | Renommer + adapter les appelants |
| **Encapsulate Variable** | Acces direct a une donnee partagee | Getter/setter (ou module) |
| **Rename Variable** | Nom pas clair | Trouver un nom qui revele l'intention |

#### Refactorings de reorganisation

| Refactoring | Quand l'utiliser |
|-------------|-----------------|
| **Move Function** | Feature Envy — la fonction est dans le mauvais module |
| **Move Field** | Le champ est utilise plus ailleurs que dans son module |
| **Move Statements into Function** | Code duplique autour d'un appel de fonction |
| **Split Phase** | Code qui fait 2 choses sequentiellement |
| **Replace Temp with Query** | Variable temporaire qui peut devenir une fonction |

#### Refactorings d'abstraction

| Refactoring | Quand l'utiliser |
|-------------|-----------------|
| **Extract Class** | Large Class avec responsabilites multiples |
| **Inline Class** | Lazy Class qui ne justifie pas son existence |
| **Replace Type Code with Subclasses** | Switch statements sur un type |
| **Replace Conditional with Polymorphism** | if/else ou switch repete |
| **Introduce Parameter Object** | Long Parameter List avec data clumps |
| **Combine Functions into Class** | Fonctions qui operent sur les memes donnees |
| **Combine Functions into Transform** | Fonctions qui enrichissent les memes donnees |
| **Replace Derived Variable with Query** | Variable calculee qui peut devenir une fonction |

### 3.2 Ordre d'execution

**Principes** :
1. **Du plus profond au plus superficiel** : refactorer les fonctions internes avant les fonctions appelantes
2. **Un smell a la fois** : ne jamais combiner deux refactorings dans la meme etape
3. **Petit pas** : chaque etape doit laisser le code compilable et les tests verts
4. **Dependances d'abord** : si B depend de A, refactorer A en premier

```
PLAN DE REFACTORING :
| # | Smell | Refactoring | Fichier | Risque | Tests a verifier |
|---|-------|-------------|---------|--------|------------------|
| 1 | Long Method | Extract Function | src/auth.ts:45 | faible | auth.char.test.ts |
| 2 | Feature Envy | Move Function | src/user.ts:120 | moyen | user.char.test.ts |
| ...
```

### 3.3 AUDIT (ghost failures)

**3 questions obligatoires avant de refactorer :**

1. **Dependances cachees** : y a-t-il du code qui depend du comportement interne (reflection, monkey-patching, string-based imports) ?
2. **Effets de bord** : la fonction modifie-t-elle un etat global, un fichier, une base de donnees ?
3. **Contrats implicites** : d'autres modules dependent-ils de l'ordre des proprietes, du format exact des erreurs, ou de timings ?

Si ghost failure critique → **tester le cas specifique avant de refactorer**.

> **Gate 3** : le plan est ordonne. Chaque etape a un seul refactoring. Les ghost failures sont adresses.
> Classe B-A : validation utilisateur obligatoire avant de continuer.

---

## Phase 4 — REFACTOR (un pas a la fois)

### 4.1 Boucle de refactoring

Pour CHAQUE ligne du plan :

```
1. Lire le code concerne
2. Appliquer UN SEUL refactoring du catalogue
3. Lancer les tests
   → VERT : continuer au refactoring suivant
   → ROUGE : STOP (Jidoka)
4. Verifier : typecheck + lint
5. Micro-commit si le changement est coherent
```

### 4.2 Regles Jidoka (Toyota)

```
SI test_rouge PENDANT refactoring :
    → STOP immediat
    → NE PAS "fix forward"
    → UNDO le refactoring (git checkout le fichier)
    → Analyser pourquoi le test a casse
    → Soit le refactoring etait trop ambitieux → le decouper
    → Soit un contrat implicite a ete casse → ajouter un characterization test
    → Max 3 tentatives sur le meme refactoring, apres → signaler blocage

SI typecheck echoue PENDANT refactoring :
    → Le refactoring a change l'interface publique
    → C'est acceptable SEULEMENT si c'est documente dans le plan
    → Adapter tous les appelants DANS LA MEME ETAPE
```

### 4.3 Micro-commits

Commiter apres chaque refactoring reussi :

```bash
git commit -m "refactor: [type] — [description courte]"
# Exemples :
# refactor: extract function — split validateToken into parseToken + verifySignature
# refactor: move method — move formatUser from auth.ts to user.ts
# refactor: rename — clarify ambiguous variable names in checkout flow
```

Le micro-commit est le filet de securite ultime. Si le refactoring suivant echoue, on peut revenir au commit precedent sans perdre le travail.

### 4.4 Refactorings interdits

| Interdit | Pourquoi | Alternative |
|----------|----------|-------------|
| Refactorer + ajouter une feature | Melange deux intentions | Refactorer d'abord, feature ensuite |
| Refactorer sans tests | Aucun filet de securite | Phase 2 (PROTECT) d'abord |
| Refactorer par "intuition" | Pas de traceabilite | Toujours citer le smell et le refactoring du catalogue |
| Renommer + restructurer dans le meme commit | Trop de changements | Renommer d'abord, restructurer ensuite |

> **Gate 4** : chaque refactoring est applique un par un. Les tests passent apres chaque etape. Les micro-commits sont faits. Zero test rouge.

---

## Phase 5 — VERIFY (le code est meilleur ET fonctionne)

### 5.1 Tests

```bash
# Tous les characterization tests passent toujours
npx vitest run --reporter=verbose

# Typecheck clean
npx tsc --noEmit

# Lint clean
npx eslint . --quiet
```

### 5.2 Metriques avant/apres

Mesurer l'amelioration objective :

```
METRIQUES :
| Metrique | Avant | Apres | Amelioration |
|----------|-------|-------|--------------|
| Lignes du fichier | {N} | {N} | {diff} |
| Fonctions > 20 lignes | {N} | {N} | {diff} |
| Complexite cyclomatique max | {N} | {N} | {diff} |
| Duplication (jscpd) | {N}% | {N}% | {diff} |
| Exports non utilises | {N} | {N} | {diff} |
| Smells restants | {N} | {N} | {diff} |
```

### 5.3 Review des characterization tests

Apres le refactoring, les characterization tests remplissent un nouveau role :

1. **Garder** ceux qui testent le comportement observable (ce sont maintenant des vrais tests)
2. **Supprimer** ceux qui testaient des details d'implementation qui ont change
3. **Ameliorer** ceux qui utilisaient des snapshots en assertions explicites

### 5.4 Self-audit

```
REFACTORING AUDIT :
- [ ] Tous les tests passent (characterization + existants)
- [ ] Typecheck clean
- [ ] Lint clean
- [ ] Aucun comportement observable n'a change
- [ ] Le code est objectivement plus lisible (metriques)
- [ ] Pas de nouveau code mort introduit
- [ ] Pas de `any` introduit
- [ ] Pas de duplication introduite
- [ ] Les micro-commits sont propres et atomiques
```

> **Gate 5** : les tests passent. Les metriques montrent une amelioration. Le comportement observable est identique. Le refactoring est complet.

---

## Phase 6 — DELIVER

### 6.1 Rapport final

```
REFACTOR REPORT :
Classe : [F-A]
Scope  : {fichier(s)}
Smells corriges : {N} / {N total detectes}

| # | Smell | Refactoring | Statut |
|---|-------|-------------|--------|
| 1 | Long Method | Extract Function | DONE |
| 2 | Feature Envy | Move Function | DONE |
| ...

Metriques : [voir Phase 5.2]
Tests : {N} characterization + {N} existants = tous PASS
Micro-commits : {N}
```

### 6.2 Commit final (squash optionnel)

Si l'utilisateur le demande, proposer un squash des micro-commits :

```bash
# Option A : garder l'historique granulaire (recommande)
git log --oneline

# Option B : squash en un seul commit
git rebase -i HEAD~{N}
```

Message du commit final :
```
refactor: [description]

Smells fixed: {N} ({categories})
Tests: {N} characterization, {N} existing — all pass
Metrics: [key improvements]
```

### 6.3 PR (si flag `-pr`)

```bash
gh pr create --title "[description]" --body "$(cat <<'EOF'
## Summary
Refactoring systematique de {scope}.

## Smells corriges
| Smell | Refactoring | Impact |
|-------|-------------|--------|
| ... | ... | ... |

## Metriques
| Metrique | Avant | Apres |
|----------|-------|-------|
| ... | ... | ... |

## Verification
- Characterization tests : {N} (couvrent le comportement avant refactoring)
- Tests existants : tous PASS
- Typecheck : clean
- Lint : clean
- Comportement observable : INCHANGE

## Test plan
- [ ] Verifier que les tests passent en CI
- [ ] Verifier le comportement en staging
- [ ] Pas de regression fonctionnelle
EOF
)"
```

---

## Quand NE PAS utiliser hora-refactor

| Situation | Utiliser plutot |
|-----------|-----------------|
| Nouveau code a ecrire | `/hora-forge` |
| Bug a corriger | Fix d'abord, refactor ensuite (separement) |
| Migration de stack | `/hora-migrate` (quand disponible) |
| Refactoring UI/design | `/hora-design` |
| Performance | `/hora-perf` (quand disponible) |

---

## Regles absolues (non negociables)

1. **Protect First** — Jamais de refactoring sans characterization tests. Le code existant est un systeme vivant qu'on respecte avant de le transformer.
2. **Un a la fois** — Un seul refactoring par etape. Combiner = risque de regression non tracable.
3. **Catalogue, pas intuition** — Chaque refactoring vient du catalogue Fowler. Si le refactoring n'a pas de nom, c'est un hack.
4. **Jidoka** — Test rouge = STOP + UNDO. Pas de "fix forward". Le code doit compiler et passer les tests apres CHAQUE etape.
5. **Comportement inchange** — Si le test d'un comportement observable echoue, ce n'est plus un refactoring. STOP.
6. **Micro-commits** — Chaque refactoring reussi = un commit. Le rollback granulaire est le meilleur filet de securite.
7. **Mesurer** — Les metriques avant/apres prouvent que le refactoring a de la valeur. Pas de "c'est plus propre" sans chiffres.
