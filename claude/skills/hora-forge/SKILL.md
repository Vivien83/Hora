---
name: hora-forge
description: Zero Untested Delivery workflow — TDD, 7 gates, tests at every phase. Use when user says forge, hora forge, implement, build, develop, feature, fix bug, TDD, test-driven, critical code, quality. Do NOT use for simple typos or renames — use standard HORA workflow instead.
metadata:
  author: HORA
  version: 2.0.0
compatibility: Claude Code. Requires test framework (Vitest/Jest/Playwright detected automatically).
---

# Skill: hora-forge

> "Du metal teste sous pression. Rien ne sort de la forge sans avoir ete eprouve."

Workflow de developpement ou **aucun livrable ne passe sans etre teste**. Les tests ne sont pas une etape finale optionnelle — ils sont tisses dans chaque phase.

Inspire de : NASA Cleanroom, Power of Ten (Holzmann/JPL), Toyota Jidoka, TDD (Kent Beck), DO-178C, Google Testing Pyramid, Design by Contract (Meyer).

## Invocation

```
/hora-forge [-a] [-x] [-s] [-e] [-b] [-pr] <description de la tache>
```

## Flags

| Flag | Description |
|------|-------------|
| `-a` | **Autonome** : skip les confirmations (sauf classification critique) |
| `-x` | **Examine** : active la review adversariale IV&V (phase 7) |
| `-s` | **Save** : persiste les sorties dans `.hora/forge/{task-id}/` |
| `-e` | **Economy** : pas de sous-agents, outils directs uniquement |
| `-b` | **Branch** : verifie qu'on n'est pas sur main, cree si besoin |
| `-pr` | **Pull Request** : cree la PR a la fin (active `-b` implicitement) |

> **Il n'existe PAS de flag pour desactiver les tests.** C'est intentionnel.

---

## Phase 0 — CLASSIFY (obligatoire, premiere action)

Avant toute chose, classifier la tache. La rigueur est **proportionnelle a la criticite** (inspire NPR 7150.2).

| Classe | Signal | Rigueur de test | Exemples |
|--------|--------|-----------------|----------|
| **F** (trivial) | Typo, rename, 1-3 lignes | Typecheck + lint | Renommer une variable |
| **E** (mineur) | UI cosmetique, texte, style | + Tests existants passent | Changer une couleur, un label |
| **D** (standard) | Feature isolee, bug simple | + Tests unitaires nouveaux (TDD) | Nouveau composant, fix de bug |
| **C** (significatif) | Multi-fichiers, logique metier | + Tests integration + contrats Zod | Nouveau endpoint API, nouveau service |
| **B** (critique) | Auth, donnees, paiements | + Tests E2E + review adversariale | Login flow, checkout, migration DB |
| **A** (vital) | Infra, securite, migration prod | + Property-based testing + validation user | Changement d'auth provider, migration schema |

**Regle** : en cas de doute, classifier UN NIVEAU AU-DESSUS.

Afficher : `FORGE [Classe X] — {description}`

---

## Workflow (Phases 1-9)

Chaque phase est detaillee dans `references/forge-phases.md`. Voici le flux :

| Phase | Nom | Action cle | Gate |
|-------|-----|-----------|------|
| **1** | SPEC | Given/When/Then + contrats Zod + ISC + matrice de tracabilite | Chaque ISC a un test associe |
| **2** | ANALYZE | Explorer la codebase, detecter framework de test, SSOT, library-first | — |
| **3** | PLAN | Plan fichier par fichier + audit ghost failures (3 questions NASA) | Zero ghost failure critique; B-A = validation user |
| **4** | TEST FIRST | Ecrire les tests AVANT le code (TDD Red), pyramide Google | Tests Red echouent pour les bonnes raisons |
| **5** | BUILD | Implementation minimale (Green) + Refactor + Jidoka | Tous tests Green, typecheck+lint OK |
| **6** | VERIFY | 6 couches de verification (statique -> unit -> integ -> E2E -> coverage -> mutation) | Toutes couches applicables passent |
| **7** | EXAMINE | Review adversariale IV&V (B-A par defaut, autres avec `-x`) | Zero finding CRITICAL/HIGH ouvert |
| **8** | RESOLVE | Corriger findings en TDD (Red -> Green), boucle max 3 iterations | Tous findings resolus |
| **9** | DELIVER | Matrice de tracabilite finale + commit + PR optionnelle | TOUTES les gates OK |

> Pour le detail complet de chaque phase (code examples, checklists, commandes), voir `references/forge-phases.md`.

---

## Gates (checklist de sortie)

```
- [ ] Gate 1 (SPEC)    : chaque ISC a un test associe
- [ ] Gate 2 (PLAN)    : zero ghost failure critique ouvert
- [ ] Gate 3 (TEST)    : tests Red ecrits, existants passent
- [ ] Gate 4 (BUILD)   : tous tests Green, typecheck+lint OK
- [ ] Gate 5 (VERIFY)  : toutes couches de verification passent
- [ ] Gate 6 (EXAMINE) : zero finding critique ouvert (si applicable)
- [ ] Gate 7 (RESOLVE) : corrections verifiees (si applicable)
```

---

## Regles absolues (non negociables)

1. **Zero Untested Delivery** — Aucun code ne sort sans test. Aucune exception. Aucun flag pour contourner.
2. **Test First** — Les tests sont ecrits AVANT le code (sauf Classe F-E ou seul typecheck+lint+existants suffisent).
3. **Jidoka** — Test rouge = STOP. On ne continue pas. On corrige d'abord.
4. **Tracabilite** — Chaque spec a un test. Chaque test a une spec. Bidirectionnel.
5. **Classification** — La rigueur est proportionnelle a la criticite. Pas de sur-engineering sur du trivial.
6. **IV&V** — Le code critique (B-A) est review par un agent qui ne l'a PAS ecrit.
7. **Prevention > Detection** — Les contrats Zod, les types stricts, le lint : ils empechent les bugs AVANT qu'ils n'existent.
