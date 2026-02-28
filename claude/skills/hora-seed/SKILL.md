---
name: hora-seed
description: Test data generation and database seeding — generates realistic data from Drizzle/Prisma schemas. Use when user says seed, generate data, test data, fill database, fixtures, mock data, faker. Do NOT use for production data — this generates test/development data only.
metadata:
  author: HORA
  version: 1.0.0
compatibility: Claude Code. Works with Drizzle ORM and Prisma. Requires @faker-js/faker. Cross-platform.
---

# Skill: hora-seed

> "Des donnees de test qui ressemblent a de vraies donnees — pas des 'test123' partout."

Generation automatique de donnees de test realistes a partir des schemas Drizzle ou Prisma. Detecte le schema, comprend les types et les relations, genere des donnees coherentes.

## Invocation

```
/hora-seed <mode> [options]
```

| Mode | Description |
|------|-------------|
| `generate <N> <table>` | Genere N enregistrements pour la table donnee |
| `fill` | Remplit toutes les tables avec des donnees de test |
| `reset` | Vide les tables et re-seed (dev only) |
| `export` | Exporte les donnees generees en JSON (fixtures) |

| Flag | Description |
|------|-------------|
| `--output` | Fichier de sortie pour le mode export (defaut: `seed-data.json`) |
| `--dry-run` | Affiche les donnees sans les inserer |
| `--locale` | Locale faker (defaut: `fr`) |
| `--relations` | Genere les donnees liees automatiquement |

---

## Protocol

### Phase 1 — DETECT

1. Executer `scripts/detect-schema.ts` sur le projet
2. Identifier l'ORM (Drizzle ou Prisma)
3. Lire les schemas : tables, colonnes, types, nullables, references
4. Detecter les relations entre tables

### Phase 2 — MAP

Pour chaque colonne, mapper le type DB vers un generateur faker :
| Type DB | Generateur faker |
|---------|-----------------|
| `varchar` / `text` (name) | `faker.person.fullName()` |
| `varchar` (email) | `faker.internet.email()` |
| `varchar` (url) | `faker.internet.url()` |
| `integer` | `faker.number.int()` |
| `boolean` | `faker.datatype.boolean()` |
| `timestamp` | `faker.date.recent()` |
| `uuid` | `faker.string.uuid()` |
| `json` / `jsonb` | `faker.helpers.fake('{}')` |

Heuristiques sur les noms de colonnes : `email`, `name`, `phone`, `address`, `url`, `avatar`, `price`, `description`, `title`, `slug`.

### Phase 3 — GENERATE

1. Respecter l'ordre des foreign keys (tables parentes d'abord)
2. Generer les IDs et les referencer dans les tables enfants
3. Respecter les contraintes : unique, not null, check
4. Generer des donnees coherentes (pas d'email dans un champ name)

### Phase 4 — OUTPUT

- Mode `fill` : insertion directe via le client ORM du projet
- Mode `export` : ecriture JSON dans le fichier de sortie
- Mode `dry-run` : affichage stdout sans effet de bord

---

## Exemples

### 1. Generer 50 utilisateurs

```
/hora-seed generate 50 users
```

Detecte le schema `users`, genere 50 enregistrements realistes avec noms, emails, dates.

### 2. Remplir toute la base

```
/hora-seed fill --relations
```

Detecte toutes les tables, respecte l'ordre des FK, genere des donnees liees.

### 3. Exporter des fixtures JSON

```
/hora-seed export --output fixtures/test-data.json
```

Genere et exporte toutes les donnees en JSON pour les utiliser dans les tests.

---

## Scripts

| Script | Usage |
|--------|-------|
| `scripts/detect-schema.ts` | `npx tsx scripts/detect-schema.ts [project-dir]` |

---

## Troubleshooting

### Le schema n'est pas detecte
- Verifier la presence de `drizzle.config.ts` ou `prisma/schema.prisma`
- Pour Drizzle, verifier que les tables sont definies avec `pgTable`, `mysqlTable` ou `sqliteTable`
- Verifier que les fichiers schema sont en TypeScript (pas JS)

### Les relations ne sont pas detectees
- Drizzle : les references doivent utiliser `.references(() => table.column)`
- Prisma : les relations doivent etre definies avec `@relation`
- Le script detecte les patterns courants, pas les constructions exotiques

### Erreur de contrainte unique
- Le generateur faker peut produire des doublons sur de gros volumes
- Utiliser `--locale` different ou reduire le nombre d'enregistrements
- Les emails et slugs sont generes avec un suffixe unique

---

## Regles

1. **Dev/test only** — Ne jamais utiliser contre une base de production
2. **Schema-driven** — Les donnees sont toujours generees a partir du schema reel
3. **Ordre FK** — Respecter l'ordre topologique des tables
4. **Realisme** — Les donnees doivent etre credibles (pas de `aaa@bbb.ccc`)
