# Smell Catalog — Fowler (Refactoring, 2nd ed. 2018)

> Reference complete pour la Phase 1 SMELL de hora-refactor.
> Scanner les fichiers cibles contre ce catalogue.

---

## Les 5 categories de code smells

### 1. Bloaters — le code qui enfle

| Smell | Detection | Seuil |
|-------|-----------|-------|
| **Long Method** | Fonction trop longue | > 20 lignes (> 10 ideal) |
| **Large Class** | Fichier/classe surchargee | > 200 lignes ou > 5 responsabilites |
| **Long Parameter List** | Trop de parametres | > 3 parametres |
| **Primitive Obsession** | Types primitifs au lieu d'objets metier | `string` la ou un type metier serait plus clair |
| **Data Clumps** | Memes groupes de donnees qui se repetent | 3+ champs qui voyagent ensemble |

### 2. Object-Orientation Abusers — mauvais usage des abstractions

| Smell | Detection |
|-------|-----------|
| **Switch Statements** | switch/if-else repete sur le meme discriminant |
| **Temporary Field** | Champ qui n'a de sens que dans certains cas |
| **Refused Bequest** | Sous-classe qui n'utilise pas ce qu'elle herite |
| **Alternative Classes with Different Interfaces** | Deux classes font la meme chose differemment |

### 3. Change Preventers — le code resistant au changement

| Smell | Detection |
|-------|-----------|
| **Divergent Change** | Un fichier modifie pour N raisons differentes |
| **Shotgun Surgery** | Un changement necessite de toucher N fichiers |
| **Parallel Inheritance Hierarchies** | Ajouter une sous-classe = en ajouter une autre ailleurs |

### 4. Dispensables — le code inutile

| Smell | Detection |
|-------|-----------|
| **Dead Code** | Code jamais execute (unreachable, exports non importes) |
| **Duplicated Code** | Blocs identiques ou quasi-identiques |
| **Lazy Class** | Classe qui ne fait presque rien |
| **Speculative Generality** | Abstraction pour un cas futur qui n'existe pas |
| **Comments** | Commentaires qui expliquent du code confus (le code devrait etre clair) |

### 5. Couplers — couplage excessif

| Smell | Detection |
|-------|-----------|
| **Feature Envy** | Methode qui utilise plus les donnees d'un autre objet que les siennes |
| **Inappropriate Intimacy** | Deux classes qui connaissent trop les details internes l'une de l'autre |
| **Message Chains** | `a.getB().getC().getD().doSomething()` |
| **Middle Man** | Classe qui ne fait que deleguer a une autre |

---

## Outils de detection automatique

```bash
# TypeScript : code mort
npx ts-prune                    # Exports non utilises

# ESLint : patterns detectables
npx eslint . --quiet            # Regles de complexity, max-lines, etc.

# Duplication
npx jscpd --min-lines 5 --min-tokens 50 src/
```

---

## Rapport des smells (template)

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
