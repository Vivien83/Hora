---
name: hora-deploy
description: Pre-deploy validation checklist — automated checks before pushing to production. Build, tests, env vars, console.logs, types, bundle size, migrations, TODOs. Use when user says deploy, pre-deploy, ship, mise en prod, go live, release, checklist, ready to deploy. Do NOT use for CI/CD pipeline setup — configure that manually. Do NOT use for actual deployment commands — this validates, it doesn't deploy.
metadata:
  author: HORA
  version: 1.0.0
compatibility: Claude Code. Next.js / Vite / any Node.js project. Cross-platform.
---

# Skill: hora-deploy

> "Ne jamais shipper sans avoir verifie. Un bug en prod coute plus cher que 5 minutes de checklist."

Validation automatique pre-deploiement : build, tests, types, console.logs, variables d'environnement, migrations, git status. Produit un rapport GO / NO-GO / REVIEW avec score de confiance.

## Invocation

```
/hora-deploy <mode> [options]
```

| Mode | Description |
|------|-------------|
| `check` | Validation complete (tous les checks) |
| `quick` | Rapide : build + tests + types uniquement |
| `report` | Affiche le dernier rapport JSON genere |

| Flag | Description |
|------|-------------|
| `--project` | Chemin du projet (defaut: `.`) |
| `--skip` | Checks a ignorer, separes par virgule (ex: `--skip migrations,bundle`) |
| `--json` | Sortie JSON brute sur stdout |

---

## Protocol

### Phase 1 — SCAN

1. Executer `scripts/pre-deploy-check.ts` sur le projet
2. Detecter le type de projet (Next.js, Vite, Node.js) via `package.json`
3. Identifier le package manager (`npm`, `pnpm`, `yarn`, `bun`) via lockfiles
4. Detecter le framework de tests (`vitest`, `jest`) et l'ORM (`drizzle`, `prisma`)
5. Resoudre les commandes `build`, `test`, `typecheck` depuis les scripts `package.json`

### Phase 2 — CHECK

Executer chaque check en sequence avec statut `pass` / `fail` / `warn` / `skip` :

| Check | Poids | Critere |
|-------|-------|---------|
| Build | 25 | `npm run build` sort avec exit code 0 |
| Tests | 25 | `npm test` sort avec exit code 0 |
| TypeScript | 15 | `npx tsc --noEmit` sans erreur |
| console.log | 10 | Aucun `console.log` dans `src/` |
| Git status | 10 | Pas de changements non commites |
| Env vars | 10 | `.env.example` couvre toutes les vars requises |
| Dependencies | 5 | Pas de vulnerabilites connues (`npm audit`) |
| TODOs | 5 | Pas de `TODO/FIXME/HACK` dans le code commite |

Checks optionnels (skip si non detectes) :
- Bundle size : si `bundlesize` ou `size-limit` est configure
- Migrations : si Drizzle ou Prisma detecte, verifier que les migrations sont a jour

### Phase 3 — REPORT

Generer un rapport JSON :
```json
{
  "timestamp": "2026-02-28T12:00:00Z",
  "project": "/path/to/project",
  "score": 85,
  "recommendation": "GO",
  "checks": [
    {
      "name": "build",
      "status": "pass",
      "message": "Build completed in 12.3s",
      "duration": 12340,
      "weight": 25,
      "earned": 25
    }
  ],
  "summary": "8/8 checks passed"
}
```

**Score** : somme des points `earned` / somme des poids × 100
**Recommandation** : `GO` >= 80 | `REVIEW` >= 60 | `NO-GO` < 60

---

## Exemples

### 1. Validation complete avant deploiement

```
/hora-deploy check
```

Lance tous les checks, affiche la progression en temps reel, termine avec le rapport GO/NO-GO.

### 2. Validation rapide (CI-like)

```
/hora-deploy quick
```

Build + tests + TypeScript uniquement. Prend ~30s sur un projet medium. Score partiel sur 65 points max.

### 3. Ignorer les checks lents

```
/hora-deploy check --skip tests,bundle
```

Utile quand les tests prennent trop de temps et ont deja ete executes separement.

---

## Scripts

| Script | Usage |
|--------|-------|
| `scripts/pre-deploy-check.ts` | `npx tsx scripts/pre-deploy-check.ts [project-dir] [--skip checks] [--mode quick]` |

---

## Troubleshooting

### Le build echoue avec "command not found"

- Verifier que `node_modules` est installe (`npm install`)
- Verifier que le script `build` existe dans `package.json`
- Si pnpm/yarn : passer `--project` avec le chemin absolu du projet

### Les tests timeout

- Les tests peuvent prendre plus de temps en CI qu'en local
- Utiliser `--skip tests` et lancer les tests manuellement : `npm test`
- Verifier que la DB de test est accessible si les tests sont des integration tests

### Le check env vars passe alors qu'une var manque

- Le check compare `.env.example` avec les vars dans `.env` et `process.env`
- Si une var est injectee par la plateforme (Vercel, Railway), elle n'est pas dans `.env` — c'est attendu
- Ajouter les vars critiques dans `.env.example` avec une valeur placeholder

---

## Regles

1. **Valider, pas deployer** — Ce skill ne pousse rien. Il valide uniquement.
2. **NO-GO = stop** — Un score < 60 doit bloquer le deploiement sans exception
3. **REVIEW = discussion** — Entre 60 et 80, lister les checks en warn et decider consciemment
4. **Skip explicite** — Chaque skip doit etre justifie (flag `--skip` avec raison documentee)
