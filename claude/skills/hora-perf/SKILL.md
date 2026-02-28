---
name: hora-perf
description: Web performance audit and optimization — Core Web Vitals, Lighthouse, bundle analysis. Measures before and after every fix. Use when user says perf, performance, slow, optimize, speed, lighthouse, core web vitals, bundle, lazy load, LCP, INP, CLS. Do NOT use for backend/API performance — this is frontend-focused.
metadata:
  author: HORA
  version: 2.0.0
compatibility: Claude Code. Works with Next.js and Vite projects.
---

# Skill: hora-perf

> "La performance est une feature. La lenteur est un bug."

Audit systematique ou **chaque optimisation est mesuree avant/apres**. Pas de cargo cult — des mesures, un diagnostic, des fixes cibles. Inspire de Google Core Web Vitals, Lighthouse, RAIL model, Next.js Performance Guide.

## Invocation

```
/hora-perf [-a] [-f] [-s] [-e] <scope optionnel : page, route, ou "full">
```

| Flag | Description |
|------|-------------|
| `-a` | **Autonome** : skip les confirmations |
| `-f` | **Full** : audit de toutes les routes |
| `-s` | **Save** : persiste les rapports dans `.hora/perf/{timestamp}/` |
| `-e` | **Economy** : pas de sous-agents, outils directs uniquement |

---

## Phase 0 — MEASURE (baseline)

### Core Web Vitals — seuils

| Metrique | Bon | A ameliorer | Mauvais | Mesure |
|----------|-----|-------------|---------|--------|
| **LCP** | < 2.5s | 2.5-4s | > 4s | Temps de rendu du plus grand element visible |
| **INP** | < 200ms | 200-500ms | > 500ms | Latence de l'interaction la plus lente |
| **CLS** | < 0.1 | 0.1-0.25 | > 0.25 | Deplacement visuel cumule des elements |

### Baseline commands

```bash
npx lighthouse --output=json --output-path=./lighthouse-report.json {URL}
npx @next/bundle-analyzer  # Next.js
npx vite-bundle-analyzer   # Vite
npm run build 2>&1 | tail -30
```

### Rapport baseline

```
PERF BASELINE — {URL ou route} — {YYYY-MM-DD}
LCP: {N}s [{status}] | INP: {N}ms [{status}] | CLS: {N} [{status}]
Lighthouse: Perf {N} | A11y {N} | BP {N} | SEO {N}
Bundle: {N}kB gzip | Biggest route: {route} {N}kB | Biggest dep: {pkg} {N}kB
```

> **Gate 0** : la baseline est etablie.

---

## Phase 1 — DIAGNOSE (identifier les problemes)

5 categories : **LCP** (rendu lent), **INP** (interactions lentes), **CLS** (layout shift), **Bundle** (JS trop gros), **Next.js patterns** (anti-patterns framework). Pour chaque : table de causes avec detection et impact.

> See **references/perf-diagnostics.md** for full detection patterns, cause tables, and bash commands.

> **Gate 1** : problemes identifies, classes par impact, avec fix propose.

---

## Phase 2 — PRIORITIZE (impact vs effort)

### Matrice de priorite

```
        Effort faible          Effort fort
       +------------------+------------------+
Impact |   QUICK WINS      |   PROJECTS       |
fort   |   Faire d'abord   |   Planifier      |
       +------------------+------------------+
Impact |   FILL-INS        |   EVITER         |
faible |   Si le temps      |   Pas maintenant |
       +------------------+------------------+
```

### Quick wins typiques

| Fix | Effort | Impact LCP | Impact Bundle |
|-----|--------|------------|---------------|
| Ajouter `priority` a l'image LCP | 1 ligne | -0.5-2s | 0 |
| `font-display: swap` | 1 ligne | -0.1-0.5s | 0 |
| `next/dynamic` pour composant lourd | 3 lignes | 0 | -10-100kB |
| Import specifique lodash/date-fns | 1 ligne | 0 | -5-50kB |
| `width`/`height` sur les images | 2 props | CLS fix | 0 |
| `loading.tsx` par route | 1 fichier | UX percue | 0 |

> **Gate 2** : fixes priorises. Quick wins d'abord.

---

## Phase 3 — OPTIMIZE (un fix a la fois)

### Boucle d'optimisation (obligatoire)

Pour CHAQUE fix dans l'ordre de priorite :
1. Appliquer **UN SEUL** fix
2. Verifier : build reussit, tests passent
3. Mesurer l'impact (Lighthouse, bundle size)
4. Documenter : avant -> apres
5. Micro-commit si amelioration reelle
6. Si regression -> **UNDO**

### Regles d'optimisation

- **Mesurer AVANT et APRES** — pas d'optimisation a l'intuition
- **Un fix par commit** — tracer quel changement a quel impact
- **Ne pas pre-optimiser** — corriger les problemes identifies, pas les imaginaires
- **Pas de regression fonctionnelle** — tests verts apres chaque fix
- **Le plus simple est souvent le mieux** — `priority` sur une image > setup CDN custom

> See **references/perf-diagnostics.md** for optimization code patterns (images, code splitting, server components, fonts).

> **Gate 3** : chaque optimisation mesuree et documentee. Tests verts. Zero regression.

---

## Phase 4 — VERIFY (confirmation des gains)

Re-run `npx lighthouse --output=json {URL}` + `npm run build 2>&1 | tail -30`, then fill:

### Rapport final

```
PERF REPORT — {URL ou route} — {YYYY-MM-DD}

| Metrique | Avant | Apres | Seuil | Statut |
|----------|-------|-------|-------|--------|
| LCP | {N}s | {N}s | < 2.5s | {PASS/FAIL} |
| INP | {N}ms | {N}ms | < 200ms | {PASS/FAIL} |
| CLS | {N} | {N} | < 0.1 | {PASS/FAIL} |
| Lighthouse Perf | {N} | {N} | — | +{N} |
| Total JS (gzip) | {N} kB | {N} kB | — | -{N} kB |

FIXES : | # | Fix | Impact mesure |
```

### Commit format

```
perf: [description] — Lighthouse {avant}->{apres}, LCP {N}s->{N}s, Bundle -{N}kB
```

> **Gate 4** : Core Web Vitals dans le vert (ou documenter pourquoi pas). Gain mesure et prouve.

---

## Regles absolues (non negociables)

1. **Mesurer avant d'optimiser** — Pas de cargo cult. Chaque fix justifie par une mesure.
2. **Un fix a la fois** — Combiner = impossible de savoir quel fix a quel impact.
3. **Quick wins d'abord** — Le ratio impact/effort guide l'ordre.
4. **Server Components par defaut** — `"use client"` est un opt-in justifie, pas un defaut.
5. **Zero regression** — Une optimisation qui casse une feature n'est pas une optimisation.
6. **Budget RAIL** — Response < 100ms, Animation < 16ms, Idle < 50ms, Load < 1000ms.
7. **Donnees reelles > Lighthouse** — Lighthouse = labo. Si possible, mesurer avec RUM.
