---
name: hora-changelog
description: Automated changelog generation from conventional git commits — categorizes by type, links PRs, generates formatted output. Use when user says changelog, release notes, what changed, generate changelog, version. Do NOT use for commit message writing — commits should already follow conventional format.
metadata:
  author: HORA
  version: 1.0.0
compatibility: Claude Code. Requires git. Cross-platform.
---

# Skill: hora-changelog

> "Un changelog bien tenu, c'est du respect pour ceux qui liront ton code demain."

Generation automatique de changelogs a partir des commits conventionnels. Parse le git log, categorise par type (feat, fix, refactor...), detecte les breaking changes, et genere un changelog formate.

## Invocation

```
/hora-changelog [options]
```

| Flag | Description |
|------|-------------|
| `--since` | Tag ou SHA de depart (defaut: dernier tag, ou premier commit) |
| `--until` | Tag ou SHA de fin (defaut: HEAD) |
| `--format` | Format de sortie: `markdown` (defaut) ou `github-release` |
| `--version` | Nom de la version pour le titre (defaut: detecte depuis package.json) |
| `--output` | Fichier de sortie (defaut: stdout) |

---

## Protocol

### Phase 1 — DETECT

1. Verifier qu'on est dans un repo git
2. Detecter le dernier tag (si `--since` non fourni)
3. Lire la version depuis `package.json` (si `--version` non fourni)

### Phase 2 — PARSE

1. Executer `scripts/parse-commits.ts`
2. Extraire les commits depuis le point de depart
3. Parser le format conventionnel : `type(scope): description`
4. Categoriser : feat, fix, refactor, docs, perf, test, chore
5. Detecter les breaking changes (`BREAKING CHANGE:` ou `type!:`)

### Phase 3 — FORMAT

#### Format markdown (defaut)
```markdown
# v1.2.0 (2026-02-28)

## New Features
- **users**: add avatar upload endpoint
- **auth**: support OAuth2 PKCE flow

## Bug Fixes
- **api**: fix rate limiter counting OPTIONS requests
- fix null pointer in user serializer

## Breaking Changes
- **auth**: remove deprecated session cookie auth

## Other Changes
- **deps**: update drizzle-orm to 0.35
- refactor user service to use repository pattern
```

#### Format github-release
Meme contenu, sans le titre H1 (GitHub le met automatiquement).

### Phase 4 — OUTPUT

- Ecrire dans le fichier de sortie (si `--output`)
- Ou afficher dans le terminal

---

## Exemples

### 1. Changelog depuis le dernier tag

```
/hora-changelog
```

Detecte le dernier tag, parse les commits entre le tag et HEAD, genere le markdown.

### 2. Changelog pour une release specifique

```
/hora-changelog --since v1.1.0 --version v1.2.0
```

Parse les commits entre v1.1.0 et HEAD, genere le changelog avec le titre v1.2.0.

### 3. Notes de release GitHub

```
/hora-changelog --format github-release --output RELEASE_NOTES.md
```

Genere les notes au format GitHub Release et les ecrit dans un fichier.

---

## Scripts

| Script | Usage |
|--------|-------|
| `scripts/parse-commits.ts` | `npx tsx scripts/parse-commits.ts [--since tag-or-sha] [--format markdown\|json]` |

---

## Troubleshooting

### Aucun commit conventionnel detecte
- Les commits doivent suivre le format `type: description` ou `type(scope): description`
- Types reconnus : `feat`, `fix`, `refactor`, `docs`, `perf`, `test`, `chore`, `build`, `ci`, `style`
- Les commits qui ne suivent pas le format sont groupes dans "Other Changes"

### Le tag n'est pas detecte
- Verifier que les tags existent avec `git tag --list`
- Utiliser `--since SHA` avec un SHA specifique
- Si aucun tag, le script utilise le premier commit du repo

---

## Regles

1. **Conventional commits** — Le format source est le standard conventionnel
2. **Breaking changes explicites** — Toujours mis en evidence dans une section separee
3. **Pas d'edition** — Le changelog est genere, pas edite. Editer les commits, pas le changelog.
4. **Scope optionnel** — Les commits sans scope sont affiches sans prefixe
