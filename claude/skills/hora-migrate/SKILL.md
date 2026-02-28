---
name: hora-migrate
description: Database migration management — detect schema changes, generate migrations, preview SQL, execute with rollback. Use when user says migrate, migration, schema change, database change, alter table, add column, drizzle migrate, prisma migrate. Do NOT use for seeding data — use hora-seed. Do NOT use for schema design — design the schema first, then migrate.
metadata:
  author: HORA
  version: 1.0.0
compatibility: Claude Code. Supports Drizzle ORM and Prisma. Node.js 18+. Cross-platform.
---

# Skill: hora-migrate

> "Une migration non previewee est une migration qui surprend."

Detection automatique de l'ORM, generation de migrations, preview du SQL, execution avec confirmation. Ne touche jamais a la base sans que l'utilisateur ait vu le SQL d'abord.

## Invocation

```
/hora-migrate <commande> [options]
```

| Commande | Description |
|----------|-------------|
| `detect` | Detecte l'ORM, la config, les fichiers de schema |
| `diff` | Montre les changements de schema depuis la derniere migration |
| `generate` | Cree le fichier de migration (sans l'executer) |
| `preview` | Affiche le SQL qui sera execute (dry-run) |
| `run` | Execute la migration avec confirmation utilisateur |
| `status` | Liste les migrations executees et en attente |
| `rollback` | Annule la derniere migration (si supportee par l'ORM) |

| Flag | Description |
|------|-------------|
| `--name` | Nom de la migration (defaut: timestamp auto) |
| `--yes` | Skip la confirmation (dev uniquement, jamais en prod) |
| `--db-url` | Override la DATABASE_URL pour cette commande |

---

## Protocol

### Phase 1 — DETECT

1. Executer `scripts/detect-orm.ts` sur le projet
2. Identifier l'ORM : Drizzle ou Prisma
3. Lire la config : schema paths, migrations dir, database URL env var
4. Verifier que le CLI est disponible (drizzle-kit / prisma)
5. Afficher le rapport de detection

### Phase 2 — DIFF

Comparer le schema actuel avec l'etat de la derniere migration :
- **Drizzle** : `drizzle-kit generate --dry-run` ou lecture des snapshots dans `drizzle/meta/`
- **Prisma** : `prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma`

Afficher les changements detectes :
- Tables ajoutees / supprimees
- Colonnes ajoutees / modifiees / supprimees
- Index et contraintes modifies

### Phase 3 — GENERATE

Creer le fichier de migration sans l'executer :
- **Drizzle** : `npx drizzle-kit generate`
- **Prisma** : `npx prisma migrate dev --name <name> --create-only`

Afficher le chemin du fichier cree.

### Phase 4 — PREVIEW

Lire et afficher le SQL de la migration generee.

Pour les operations destructives (DROP TABLE, DROP COLUMN, TRUNCATE) :
- Avertir explicitement
- Rappeler de faire un backup avant execution

### Phase 5 — EXECUTE

1. Afficher le recap (nombre de migrations en attente, operations)
2. Demander confirmation explicite
3. Si confirmation : executer
   - **Drizzle** : `npx drizzle-kit migrate`
   - **Prisma** : `npx prisma migrate deploy`
4. En cas d'erreur : afficher la commande de rollback

---

## Exemples

### 1. Detecter l'ORM du projet

```
/hora-migrate detect
```

Sortie : ORM detecte, config path, schema files, migrations dir, database URL env var present ou absent.

### 2. Generer et previsualiser une migration

```
/hora-migrate generate --name add-user-avatar
/hora-migrate preview
```

Genere le fichier de migration, puis affiche le SQL exact qui sera execute.

### 3. Executer avec confirmation

```
/hora-migrate run
```

Affiche le recap, demande confirmation, execute. En cas d'erreur, affiche la commande rollback.

---

## Scripts

| Script | Usage |
|--------|-------|
| `scripts/detect-orm.ts` | `npx tsx scripts/detect-orm.ts [project-dir]` |

---

## Troubleshooting

### L'ORM n'est pas detecte

- Verifier la presence de `drizzle.config.ts` (ou `.js`) a la racine ou dans un sous-dossier
- Pour Prisma : verifier que `prisma/schema.prisma` existe
- Le script cherche dans le repertoire courant et ses sous-dossiers directs

### drizzle-kit ou prisma non trouve

- Verifier que le CLI est installe : `npm ls drizzle-kit` ou `npm ls prisma`
- Les CLIs doivent etre en devDependencies du projet, pas globaux
- Utiliser `npx drizzle-kit` ou `npx prisma` — pas d'installation globale requise

### La migration echoue a l'execution

- Verifier que `DATABASE_URL` (ou l'env var detectee) est bien definie
- Verifier que la base de donnees est accessible depuis la machine courante
- Pour Drizzle : verifier que `drizzle/meta/_journal.json` n'est pas corrompu
- Commande rollback affichee automatiquement en cas d'erreur

---

## Regles

1. **Preview avant execute** — Toujours montrer le SQL avant d'executer
2. **Jamais en prod sans confirmation** — Le flag `--yes` est interdit sur un env de production
3. **Backup reminder** — Tout DROP TABLE ou DROP COLUMN declenche un avertissement backup
4. **Une migration = un changement logique** — Ne pas mixer schema changes non lies dans une meme migration
