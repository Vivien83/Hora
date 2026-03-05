---
name: hora-init
description: Bootstrap structured project — auto-detect new project, create docs/ + research/ arborescence, fetch context7 docs, store research. Use when new project detected or user says init, bootstrap, nouveau projet, start project, demarrer projet. Do NOT use for existing projects with docs/ already present.
metadata:
  author: HORA
  version: 1.0.0
compatibility: Claude Code. Requires context7 MCP for research phase.
---

# Skill: hora-init

Bootstrap complet d'un nouveau projet HORA. Cree une arborescence docs/ structuree avec phases, puis lance context7 pour stocker la recherche en dur.

## Invocation

```
/hora-init
```

Ou declenchement automatique par le hook prompt-submit quand un nouveau projet est detecte.

## Protocol

### Phase 1 — DISCOVERY

Comprendre le projet. Si le dossier est vide ou quasi-vide :
1. Demander a l'utilisateur : **Quel est le projet ? Stack envisagee ? Objectif final ?**
2. Si des fichiers existent deja (package.json, Cargo.toml, etc.) : les lire pour deduire la stack.

Output attendu : nom du projet, description courte, stack, objectif.

### Phase 2 — PLAN (phases du projet)

Decouper le projet en phases incrementales (v0.1, v0.2, ..., v0.N).

Chaque phase doit avoir :
- Un nom clair
- Un objectif mesurable (ce qu'on peut faire a la fin)
- Les modules/fichiers a creer
- Les dependances vers les phases precedentes

Nombre de phases : typiquement 4-8 selon la complexite.

### Phase 3 — ARBORESCENCE

Creer la structure suivante :

```
docs/
  INDEX.md              # Vue d'ensemble + table des phases + stack + principes
  v0.1-[nom].md         # Phase detaillee
  v0.2-[nom].md
  ...
  research/             # Resultats context7 (stockes en dur)
```

#### Format de INDEX.md

```markdown
# [nom-projet] — Documentation Phases

> [description courte]

## Vue d'ensemble

| Phase | Nom | Modules | Livrable |
|:------|:----|:--------|:---------|
| **v0.1** | [Foundation](v0.1-foundation.md) | `module-a` | [ce qu'on peut faire] |
| **v0.2** | [Feature X](v0.2-feature-x.md) | `module-b` | [ce qu'on peut faire] |
| ... | ... | ... | ... |

## Stack

- **Backend** : [tech]
- **Frontend** : [tech]
- **Database** : [tech]
- ...

## Research docs

Docs de reference a jour (context7) dans [`docs/research/`](research/) :

| Fichier | Contenu |
|---------|---------|
| [lib-name.md](research/lib-name.md) | [description] |
| ... | ... |

## Structure cible

[arborescence du projet final]

## Principes

1. [principe 1]
2. [principe 2]
3. ...

## Convention commits

feat(v0.Xa): description courte
fix(v0.Xb): description courte
```

#### Format de chaque phase v0.X-[nom].md

```markdown
# v0.X — [Nom]

> [description courte]

## Objectif

[ce qu'on peut faire a la fin de cette phase]

---

## Sous-phases

### v0.Xa — [sous-tache 1]

**Fichiers a creer :**
[arborescence]

**Code principal :**
[snippets / types / interfaces]

**ISC :**
- [ ] [critere verifiable 1]
- [ ] [critere verifiable 2]

### v0.Xb — [sous-tache 2]
...
```

### Phase 4 — RESEARCH (context7)

Pour chaque lib/techno de la stack :

1. Utiliser `mcp__context7__resolve-library-id` pour trouver l'ID
2. Utiliser `mcp__context7__get-library-docs` pour recuperer la doc a jour
3. Extraire les patterns essentiels (endpoints, types, config, exemples)
4. Ecrire dans `docs/research/[lib-name].md`

Format de chaque fichier research :

```markdown
# [Lib Name] — Reference

> Source: context7, [url] ([date])

## [Section pertinente 1]
[contenu extrait et formate]

## [Section pertinente 2]
[contenu extrait et formate]

## Patterns utiles pour ce projet
[extraits specifiques au contexte du projet]
```

**IMPORTANT** : les fichiers research sont des snapshots a date. Ils servent de reference locale pour eviter de re-fetcher context7 a chaque session. Mettre la date dans le header.

### Phase 5 — UPDATE DOCS

Apres la recherche, mettre a jour les phases si des informations context7 changent l'approche :
- API differente de ce qui etait prevu
- Lib deprecee → alternative
- Pattern meilleur decouvert

### Phase 6 — COMMIT

```
feat: bootstrap project docs + research

- docs/INDEX.md with N phases
- docs/v0.1 through v0.N detailed
- docs/research/ with M library references (context7)
```

## Regles

1. **Chaque phase doit etre implementable independamment** — on peut s'arreter apres n'importe quelle phase et avoir un projet fonctionnel.
2. **Les ISC sont verifiables** — pas "le code marche bien" mais "le endpoint POST /api/parse retourne un JSON valide avec status 200".
3. **La recherche est stockee en dur** — pas ephemere. C'est la knowledge base du projet.
4. **Le plan evolue** — les docs sont vivantes, on les met a jour quand on avance.
5. **Context7 en batch** — lancer toutes les recherches en parallele (Agent tool) pour gagner du temps.
