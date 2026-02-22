---
name: hora-perf
description: Audit et optimisation de performance web. Core Web Vitals, Lighthouse, bundle analysis. USE WHEN perf, hora perf, performance, lent, slow, optimiser, vitesse, lighthouse, core web vitals, bundle, lazy load, LCP, INP, CLS.
---

# Skill: hora-perf

> "La performance est une feature. La lenteur est un bug." — Google Web Fundamentals

Audit de performance systematique ou **chaque optimisation est mesuree avant/apres**. Pas de cargo cult ("ajoute `lazy` partout") — des mesures, un diagnostic, des fixes cibles.

Inspire de : Google Core Web Vitals, Lighthouse, RAIL model (Response/Animation/Idle/Load), Next.js Performance Guide, HTTP Archive (donnees reelles).

## Invocation

```
/hora-perf [-a] [-f] [-s] [-e] <scope optionnel : page, route, ou "full">
```

## Flags

| Flag | Description |
|------|-------------|
| `-a` | **Autonome** : skip les confirmations |
| `-f` | **Full** : audit de toutes les routes (pas seulement la page cible) |
| `-s` | **Save** : persiste les rapports dans `.hora/perf/{timestamp}/` |
| `-e` | **Economy** : pas de sous-agents, outils directs uniquement |

---

## Phase 0 — MEASURE (baseline avant tout)

On ne peut pas ameliorer ce qu'on ne mesure pas.

### 0.1 Core Web Vitals — les 3 metriques qui comptent

| Metrique | Bon | A ameliorer | Mauvais | Mesure |
|----------|-----|-------------|---------|--------|
| **LCP** (Largest Contentful Paint) | < 2.5s | 2.5-4s | > 4s | Temps de rendu du plus grand element visible |
| **INP** (Interaction to Next Paint) | < 200ms | 200-500ms | > 500ms | Latence de l'interaction la plus lente |
| **CLS** (Cumulative Layout Shift) | < 0.1 | 0.1-0.25 | > 0.25 | Deplacement visuel cumule des elements |

### 0.2 Etablir la baseline

```bash
# Lighthouse CI (si disponible)
npx lighthouse --output=json --output-path=./lighthouse-report.json {URL}

# Bundle analysis
npx @next/bundle-analyzer  # Next.js
# ou
npx vite-bundle-analyzer   # Vite

# Build size
npm run build 2>&1 | tail -30  # Next.js affiche les tailles par route
```

### 0.3 Rapport baseline

```
PERF BASELINE :
Page : {URL ou route}
Date : {YYYY-MM-DD}

Core Web Vitals :
- LCP : {N}s [{BON | A AMELIORER | MAUVAIS}]
- INP : {N}ms [{BON | A AMELIORER | MAUVAIS}]
- CLS : {N} [{BON | A AMELIORER | MAUVAIS}]

Lighthouse :
- Performance : {N}/100
- Accessibility : {N}/100
- Best Practices : {N}/100
- SEO : {N}/100

Bundle :
- Total JS : {N} kB (gzipped)
- Plus grosse route : {route} — {N} kB
- Plus grosse dep : {package} — {N} kB
```

> **Gate 0** : la baseline est etablie. On sait d'ou on part.

---

## Phase 1 — DIAGNOSE (identifier les problemes)

### 1.1 LCP — Pourquoi le rendu est lent ?

| Cause | Detection | Impact |
|-------|-----------|--------|
| **Image hero non optimisee** | `<img>` sans `next/image`, sans `priority` | Enorme |
| **Font bloquante** | `font-display: block` ou pas de `font-display` | Fort |
| **CSS bloquant** | CSS non critique dans le `<head>` | Fort |
| **Server response lent** | TTFB > 800ms | Fort |
| **Client-side rendering** | Composant avec `"use client"` qui pourrait etre Server | Moyen |
| **Third-party scripts** | Analytics, chat widgets, trackers dans le chemin critique | Moyen |

```bash
# Detecter les images sans optimization
grep -rn "<img " --include="*.tsx" --include="*.jsx" src/
# Devrait utiliser next/image, pas <img>

# Detecter les fonts sans display swap
grep -rn "font-display" --include="*.css" --include="*.ts" src/
```

### 1.2 INP — Pourquoi les interactions sont lentes ?

| Cause | Detection | Impact |
|-------|-----------|--------|
| **Long task dans un event handler** | Calcul > 50ms dans onClick/onChange | Enorme |
| **Hydration excessive** | Trop de composants `"use client"` | Fort |
| **Re-renders inutiles** | State updates qui re-render tout l'arbre | Fort |
| **Layout thrashing** | Lecture + ecriture DOM alternees | Moyen |
| **Third-party JS** | Scripts tiers qui bloquent le main thread | Moyen |

```bash
# Composants client qui pourraient etre server
grep -rn "\"use client\"" --include="*.tsx" src/
# Verifier : utilisent-ils vraiment du state/effects ?
```

### 1.3 CLS — Pourquoi la page saute ?

| Cause | Detection | Impact |
|-------|-----------|--------|
| **Images sans dimensions** | `<img>` sans width/height (ou next/image sans sizes) | Enorme |
| **Fonts FOUT** | Police qui change de taille au chargement | Fort |
| **Contenu dynamique injecte** | Banniere, toast, ad inseree apres le rendu initial | Fort |
| **Animations CSS** | `top`/`left`/`width`/`height` au lieu de `transform` | Moyen |

### 1.4 Bundle — Pourquoi le JS est gros ?

| Cause | Detection | Impact |
|-------|-----------|--------|
| **Barrel files** | `import { x } from './index'` qui importe tout le module | Enorme |
| **Dependency geante** | moment.js (300kB), lodash complet (70kB) | Fort |
| **Pas de code splitting** | Composants lourds sans `next/dynamic` ou `React.lazy` | Fort |
| **Duplication** | Meme lib dans plusieurs bundles | Moyen |
| **Polyfills inutiles** | Polyfills pour navigateurs qu'on ne supporte plus | Moyen |

```bash
# Analyser le bundle
ANALYZE=true npm run build  # Next.js avec @next/bundle-analyzer

# Chercher les imports lourds
grep -rn "from 'lodash'" --include="*.ts" --include="*.tsx" src/
# Devrait etre "from 'lodash/specificFunction'"
```

### 1.5 Next.js specifique

| Pattern | Probleme | Solution |
|---------|----------|----------|
| `"use client"` en haut d'une page | Toute la page est client-rendered | Server Component par defaut, `"use client"` seulement sur les parties interactives |
| `useEffect` pour data fetching | Double render, pas de SSR | Server Component + fetch, ou TanStack Query |
| `next/image` absent | Images non optimisees, pas de lazy loading natif | Utiliser `<Image>` partout |
| Pas de `loading.tsx` | Pas de streaming, page blanche | Ajouter `loading.tsx` dans chaque route |
| Pas de `generateStaticParams` | Pages dynamiques re-rendues a chaque requete | SSG pour le contenu statique |

### 1.6 Rapport diagnostic

```
DIAGNOSTIC :
| # | Categorie | Probleme | Fichier | Impact | Fix propose |
|---|-----------|----------|---------|--------|-------------|
| 1 | LCP | Image hero sans priority | src/app/page.tsx:45 | Enorme | next/image + priority |
| 2 | Bundle | lodash import complet | src/utils/format.ts:1 | Fort | Import specifique |
| ...

Impact total estime :
- LCP : -{N}s
- Bundle : -{N} kB
- INP : -{N}ms
```

> **Gate 1** : les problemes sont identifies, classes par impact, avec fix propose. On sait quoi corriger et dans quel ordre.

---

## Phase 2 — PRIORITIZE (impact vs effort)

### 2.1 Matrice de priorite

```
        Effort faible          Effort fort
       ┌─────────────────┬─────────────────┐
Impact │   QUICK WINS     │   PROJECTS      │
fort   │   Faire d'abord  │   Planifier     │
       ├─────────────────┼─────────────────┤
Impact │   FILL-INS       │   EVITER        │
faible │   Si le temps     │   Pas maintenant│
       └─────────────────┴─────────────────┘
```

### 2.2 Quick wins typiques (effort faible, impact fort)

| Fix | Effort | Impact LCP | Impact Bundle |
|-----|--------|------------|---------------|
| Ajouter `priority` a l'image LCP | 1 ligne | -0.5-2s | 0 |
| `font-display: swap` | 1 ligne | -0.1-0.5s | 0 |
| `next/dynamic` pour un composant lourd | 3 lignes | 0 | -10-100kB |
| Import specifique lodash/date-fns | 1 ligne | 0 | -5-50kB |
| `width`/`height` sur les images | 2 props | CLS fix | 0 |
| `loading.tsx` par route | 1 fichier | UX percue | 0 |

> **Gate 2** : les fixes sont priorises. Quick wins d'abord.

---

## Phase 3 — OPTIMIZE (un fix a la fois, mesurer)

### 3.1 Boucle d'optimisation

Pour CHAQUE fix dans l'ordre de priorite :

```
1. Appliquer UN SEUL fix
2. Verifier : build reussit, tests passent
3. Mesurer l'impact (Lighthouse, bundle size)
4. Documenter : avant → apres
5. Micro-commit si l'amelioration est reelle
6. Si regression → UNDO
```

### 3.2 Patterns d'optimisation Next.js

#### Images
```tsx
// AVANT (mauvais)
<img src="/hero.jpg" alt="Hero" />

// APRES (bon)
import Image from 'next/image';
<Image src="/hero.jpg" alt="Hero" width={1200} height={600} priority />
// priority = preload pour l'element LCP
```

#### Code splitting
```tsx
// AVANT (tout charge d'un coup)
import HeavyChart from '@/components/HeavyChart';

// APRES (charge a la demande)
import dynamic from 'next/dynamic';
const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <Skeleton className="h-64 w-full" />,
});
```

#### Server Components
```tsx
// AVANT (inutilement client)
"use client";
export default function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  useEffect(() => { fetchUser(userId).then(setUser); }, [userId]);
  return <div>{user?.name}</div>;
}

// APRES (Server Component)
export default async function UserProfile({ userId }: { userId: string }) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return <div>{user?.name}</div>;
}
```

#### Font optimization
```tsx
// next/font — optimise automatiquement
import { GeistSans } from 'geist/font/sans';

export default function Layout({ children }) {
  return <html className={GeistSans.className}>{children}</html>;
}
```

### 3.3 Regles d'optimisation

- **Mesurer AVANT et APRES** — pas d'optimisation "a l'intuition"
- **Un fix par commit** — tracer quel changement a quel impact
- **Ne pas pre-optimiser** — corriger les problemes identifies, pas les problemes imaginaires
- **Pas de regression fonctionnelle** — les tests doivent passer apres chaque fix
- **Le plus simple est souvent le mieux** — `priority` sur une image > setup CDN custom

> **Gate 3** : chaque optimisation est mesuree et documentee. Tests verts. Zero regression.

---

## Phase 4 — VERIFY (confirmation des gains)

### 4.1 Mesure finale

```bash
# Re-run Lighthouse
npx lighthouse --output=json {URL}

# Re-check bundle
npm run build 2>&1 | tail -30

# Comparer avant/apres
```

### 4.2 Rapport final

```
PERF REPORT :
Page : {URL ou route}
Date : {YYYY-MM-DD}

CORE WEB VITALS :
| Metrique | Avant | Apres | Seuil | Statut |
|----------|-------|-------|-------|--------|
| LCP | {N}s | {N}s | < 2.5s | {PASS/FAIL} |
| INP | {N}ms | {N}ms | < 200ms | {PASS/FAIL} |
| CLS | {N} | {N} | < 0.1 | {PASS/FAIL} |

LIGHTHOUSE :
| Categorie | Avant | Apres | Delta |
|-----------|-------|-------|-------|
| Performance | {N} | {N} | +{N} |
| Accessibility | {N} | {N} | +{N} |
| Best Practices | {N} | {N} | +{N} |
| SEO | {N} | {N} | +{N} |

BUNDLE :
| Metrique | Avant | Apres | Delta |
|----------|-------|-------|-------|
| Total JS (gzip) | {N} kB | {N} kB | -{N} kB |
| Plus grosse route | {N} kB | {N} kB | -{N} kB |

FIXES APPLIQUES :
| # | Fix | Impact mesure |
|---|-----|---------------|
| 1 | ... | LCP -{N}s |
| 2 | ... | Bundle -{N}kB |
```

### 4.3 Commit

```
perf: [description]

Lighthouse: {avant} → {apres} (+{delta})
LCP: {avant}s → {apres}s
Bundle: -{N}kB total
Fixes: {N} optimizations applied
```

> **Gate 4** : les Core Web Vitals sont dans le vert (ou documenter pourquoi pas). Le gain est mesure et prouve.

---

## RAIL Model (reference)

Le modele RAIL de Google definit les budgets de performance :

| Phase | Budget | Exemples |
|-------|--------|----------|
| **Response** | < 100ms | Click, tap, keyboard input |
| **Animation** | < 16ms par frame (60fps) | Scroll, transitions, animations |
| **Idle** | < 50ms par task | Background work, analytics, prefetch |
| **Load** | < 1000ms pour etre interactif | First load, navigation, hydration |

Si un fix amene une metrique sous le budget RAIL, c'est une victoire.

---

## Regles absolues (non negociables)

1. **Mesurer avant d'optimiser** — Pas de cargo cult. Chaque fix est justifie par une mesure.
2. **Un fix a la fois** — Combiner = impossible de savoir quel fix a quel impact.
3. **Quick wins d'abord** — Le ratio impact/effort guide l'ordre. 1 ligne qui gagne 1s de LCP > 1 jour de refactoring qui gagne 50ms.
4. **Server Components par defaut** — `"use client"` est un opt-in justifie, pas un defaut.
5. **Zero regression** — Une optimisation qui casse une feature n'est pas une optimisation.
6. **Budget RAIL** — Response < 100ms, Animation < 16ms, Idle < 50ms, Load < 1000ms.
7. **Les donnees reelles > Lighthouse** — Lighthouse mesure en labo. Les vrais utilisateurs ont des conditions differentes. Si possible, mesurer avec des RUM (Real User Monitoring).
