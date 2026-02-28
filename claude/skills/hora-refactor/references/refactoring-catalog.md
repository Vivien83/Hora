# Refactoring Catalog — Fowler (Refactoring, 2nd ed. 2018)

> Reference complete pour la Phase 3 PLAN et Phase 4 REFACTOR de hora-refactor.

---

## Catalogue des refactorings

Pour chaque smell identifie, appliquer le refactoring du catalogue.

### Refactorings fondamentaux

| Refactoring | Quand l'utiliser | Mecanique |
|-------------|-----------------|-----------|
| **Extract Function** | Long Method, code a nommer | Couper -> coller dans nouvelle fonction -> appeler |
| **Inline Function** | Fonction triviale qui obscurcit | Remplacer l'appel par le corps |
| **Extract Variable** | Expression complexe | Nommer l'expression dans une variable |
| **Inline Variable** | Variable inutile | Remplacer la variable par l'expression |
| **Change Function Declaration** | Nom ou parametres inadaptes | Renommer + adapter les appelants |
| **Encapsulate Variable** | Acces direct a une donnee partagee | Getter/setter (ou module) |
| **Rename Variable** | Nom pas clair | Trouver un nom qui revele l'intention |

### Refactorings de reorganisation

| Refactoring | Quand l'utiliser |
|-------------|-----------------|
| **Move Function** | Feature Envy — la fonction est dans le mauvais module |
| **Move Field** | Le champ est utilise plus ailleurs que dans son module |
| **Move Statements into Function** | Code duplique autour d'un appel de fonction |
| **Split Phase** | Code qui fait 2 choses sequentiellement |
| **Replace Temp with Query** | Variable temporaire qui peut devenir une fonction |

### Refactorings d'abstraction

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

---

## Ordre d'execution

**Principes** :
1. **Du plus profond au plus superficiel** : refactorer les fonctions internes avant les fonctions appelantes
2. **Un smell a la fois** : ne jamais combiner deux refactorings dans la meme etape
3. **Petit pas** : chaque etape doit laisser le code compilable et les tests verts
4. **Dependances d'abord** : si B depend de A, refactorer A en premier

**Template plan** :

```
PLAN DE REFACTORING :
| # | Smell | Refactoring | Fichier | Risque | Tests a verifier |
|---|-------|-------------|---------|--------|------------------|
| 1 | Long Method | Extract Function | src/auth.ts:45 | faible | auth.char.test.ts |
| 2 | Feature Envy | Move Function | src/user.ts:120 | moyen | user.char.test.ts |
| ...
```

---

## AUDIT ghost failures (3 questions obligatoires avant de refactorer)

1. **Dependances cachees** : y a-t-il du code qui depend du comportement interne (reflection, monkey-patching, string-based imports) ?
2. **Effets de bord** : la fonction modifie-t-elle un etat global, un fichier, une base de donnees ?
3. **Contrats implicites** : d'autres modules dependent-ils de l'ordre des proprietes, du format exact des erreurs, ou de timings ?

Si ghost failure critique -> **tester le cas specifique avant de refactorer**.

> **Gate 3** : le plan est ordonne. Chaque etape a un seul refactoring. Les ghost failures sont adresses.
> Classe B-A : validation utilisateur obligatoire avant de continuer.

---

## Boucle de refactoring (Phase 4)

Pour CHAQUE ligne du plan :

```
1. Lire le code concerne
2. Appliquer UN SEUL refactoring du catalogue
3. Lancer les tests
   -> VERT : continuer au refactoring suivant
   -> ROUGE : STOP (Jidoka)
4. Verifier : typecheck + lint
5. Micro-commit si le changement est coherent
```

---

## Regles Jidoka (Toyota)

```
SI test_rouge PENDANT refactoring :
    -> STOP immediat
    -> NE PAS "fix forward"
    -> UNDO le refactoring (git checkout le fichier)
    -> Analyser pourquoi le test a casse
    -> Soit le refactoring etait trop ambitieux -> le decouper
    -> Soit un contrat implicite a ete casse -> ajouter un characterization test
    -> Max 3 tentatives sur le meme refactoring, apres -> signaler blocage

SI typecheck echoue PENDANT refactoring :
    -> Le refactoring a change l'interface publique
    -> C'est acceptable SEULEMENT si c'est documente dans le plan
    -> Adapter tous les appelants DANS LA MEME ETAPE
```

---

## Micro-commits

Commiter apres chaque refactoring reussi :

```bash
git commit -m "refactor: [type] — [description courte]"
# Exemples :
# refactor: extract function — split validateToken into parseToken + verifySignature
# refactor: move method — move formatUser from auth.ts to user.ts
# refactor: rename — clarify ambiguous variable names in checkout flow
```

Le micro-commit est le filet de securite ultime. Si le refactoring suivant echoue, on peut revenir au commit precedent sans perdre le travail.

---

## Refactorings interdits

| Interdit | Pourquoi | Alternative |
|----------|----------|-------------|
| Refactorer + ajouter une feature | Melange deux intentions | Refactorer d'abord, feature ensuite |
| Refactorer sans tests | Aucun filet de securite | Phase 2 (PROTECT) d'abord |
| Refactorer par "intuition" | Pas de traceabilite | Toujours citer le smell et le refactoring du catalogue |
| Renommer + restructurer dans le meme commit | Trop de changements | Renommer d'abord, restructurer ensuite |

> **Gate 4** : chaque refactoring est applique un par un. Les tests passent apres chaque etape. Les micro-commits sont faits. Zero test rouge.
