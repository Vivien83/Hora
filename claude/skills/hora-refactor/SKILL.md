---
name: hora-refactor
description: Systematic refactoring with safety net — Fowler catalog + Feathers characterization tests + Jidoka discipline. Use when user says refactor, clean code, code smell, technical debt, legacy, simplify, reorganize, extract, decouple. Do NOT use for bug fixes — fix first, refactor separately. Do NOT use for new features — use hora-forge instead.
metadata:
  author: HORA
  version: 2.0.0
compatibility: Claude Code. Requires test framework (Vitest/Jest detected automatically).
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

| Classe | Signal | Filet de securite | Exemples |
|--------|--------|-------------------|----------|
| **F** (trivial) | Rename, reformatage, typo | Typecheck + lint | Renommer une variable locale |
| **E** (mineur) | Extract variable, inline temp | + Tests existants passent | Simplifier une expression |
| **D** (standard) | Extract function, move method | + Characterization tests nouveaux | Decouper une fonction longue |
| **C** (significatif) | Extract class, change signature | + Tests integration | Reorganiser un module entier |
| **B** (critique) | Change d'architecture, inversion de dependances | + Tests E2E + review | Remplacer un pattern global |
| **A** (vital) | Migration de paradigme, refonte de modele | + Validation utilisateur obligatoire | Changer l'architecture d'auth |

**Regle** : en cas de doute, classifier UN NIVEAU AU-DESSUS.

Definir le perimetre :

```
REFACTOR [Classe X] — {description}
Scope : {fichier(s) ou module(s) concerne(s)}
Objectif : {ce qui doit changer ET ce qui ne doit PAS changer}
```

L'objectif explicite ce qui NE change PAS. Un refactoring qui modifie le comportement observable n'est pas un refactoring — c'est une feature ou un bug.

> **Gate 0** : le scope est defini. Le comportement observable qui doit rester identique est documente.

---

## Phase 1 — SMELL (scanner le code)

Scanner les fichiers cibles contre le catalogue complet des 5 categories Fowler : Bloaters, OO Abusers, Change Preventers, Dispensables, Couplers.

**See [references/smell-catalog.md](references/smell-catalog.md) for the full smell catalog with detection patterns, severity thresholds, and report template.**

> **Gate 1** : les smells sont catalogues avec severite et refactoring propose. Aucun refactoring n'est commence.

---

## Phase 2 — PROTECT (filet de securite avant modification)

**Principe Feathers** : avant de modifier du code legacy, ecrire des **characterization tests** qui capturent le comportement ACTUEL, meme s'il est incorrect. Le but n'est pas de tester la spec — c'est de detecter tout changement de comportement.

### Identifier les seams (Feathers)

| Type de seam | Technique |
|--------------|-----------|
| **Object seam** | Injection de dependance, interface/type |
| **Preprocessing seam** | Variables d'environnement, config |
| **Link seam** | Import mock (vi.mock, jest.mock) |

### Ecrire les characterization tests

```typescript
// Characterization test : capture le comportement ACTUEL
// Ce n'est PAS un test de specification — c'est un filet de securite

describe('auth.ts - characterization', () => {
  it('returns user object when token is valid', () => {
    const result = validateToken(validToken);
    expect(result).toMatchSnapshot(); // snapshot = characterization
  });

  it('throws when token is expired', () => {
    expect(() => validateToken(expiredToken))
      .toThrow('token invalid'); // Message actuel, pas ideal
  });
});
```

### Regles des characterization tests

1. **Tester les OUTPUTS, pas les INTERNALS** — le refactoring va changer les internals
2. **Utiliser des snapshots** pour capturer des structures complexes
3. **Couvrir les chemins principaux ET les edge cases observes**
4. **Ne pas corriger les bugs** dans les characterization tests — les documenter
5. **Quantite** : viser la couverture des branches du code a refactorer

Verifier le filet : tous les tests passent, couverture sur les fichiers cibles. Commit du filet AVANT tout refactoring.

> **Gate 2** : les characterization tests passent. La couverture couvre les branches du code cible. Le commit du filet est fait.

---

## Phase 3 — PLAN (strategie de refactoring)

Pour chaque smell identifie, choisir le refactoring du catalogue Fowler et ordonner l'execution.

**See [references/refactoring-catalog.md](references/refactoring-catalog.md) for the full Fowler catalog (fundamental, reorganization, abstraction refactorings), execution ordering rules, audit ghost failures, and plan template.**

> **Gate 3** : le plan est ordonne. Chaque etape a un seul refactoring. Les ghost failures sont adresses.
> Classe B-A : validation utilisateur obligatoire avant de continuer.

---

## Phase 4 — REFACTOR (un pas a la fois)

### Regles Jidoka (Toyota) — non negociables

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

Micro-commit apres chaque refactoring reussi : `refactor: [type] — [description courte]`

> **Gate 4** : chaque refactoring applique un par un. Tests verts apres chaque etape. Micro-commits faits. Zero test rouge.

---

## Phase 5 — VERIFY (le code est meilleur ET fonctionne)

### Metriques avant/apres

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

### Self-audit

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

Apres le refactoring, revoir les characterization tests : garder ceux qui testent le comportement observable, supprimer ceux sur les internals changes, ameliorer les snapshots en assertions explicites.

> **Gate 5** : les tests passent. Les metriques montrent une amelioration. Le comportement observable est identique.

---

## Phase 6 — DELIVER

### Rapport final

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

Metriques : [voir Phase 5]
Tests : {N} characterization + {N} existants = tous PASS
Micro-commits : {N}
```

### Commit final et PR

Message du commit final :

```
refactor: [description]

Smells fixed: {N} ({categories})
Tests: {N} characterization, {N} existing — all pass
Metrics: [key improvements]
```

Si flag `-pr` : creer la PR avec summary, smells corriges, metriques avant/apres, et test plan.

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
