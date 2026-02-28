# Performance Diagnostics Reference

> Detailed detection patterns, cause tables, and optimization code examples for `/hora-perf`.

---

## LCP — Why is rendering slow?

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

---

## INP — Why are interactions slow?

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

---

## CLS — Why does the page jump?

| Cause | Detection | Impact |
|-------|-----------|--------|
| **Images sans dimensions** | `<img>` sans width/height (ou next/image sans sizes) | Enorme |
| **Fonts FOUT** | Police qui change de taille au chargement | Fort |
| **Contenu dynamique injecte** | Banniere, toast, ad inseree apres le rendu initial | Fort |
| **Animations CSS** | `top`/`left`/`width`/`height` au lieu de `transform` | Moyen |

---

## Bundle — Why is JS large?

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

---

## Next.js Specific Patterns

| Pattern | Probleme | Solution |
|---------|----------|----------|
| `"use client"` en haut d'une page | Toute la page est client-rendered | Server Component par defaut, `"use client"` seulement sur les parties interactives |
| `useEffect` pour data fetching | Double render, pas de SSR | Server Component + fetch, ou TanStack Query |
| `next/image` absent | Images non optimisees, pas de lazy loading natif | Utiliser `<Image>` partout |
| Pas de `loading.tsx` | Pas de streaming, page blanche | Ajouter `loading.tsx` dans chaque route |
| Pas de `generateStaticParams` | Pages dynamiques re-rendues a chaque requete | SSG pour le contenu statique |

---

## Diagnostic Report Template

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

---

## Optimization Patterns (Code Examples)

### Images

```tsx
// AVANT (mauvais)
<img src="/hero.jpg" alt="Hero" />

// APRES (bon)
import Image from 'next/image';
<Image src="/hero.jpg" alt="Hero" width={1200} height={600} priority />
// priority = preload pour l'element LCP
```

### Code Splitting

```tsx
// AVANT (tout charge d'un coup)
import HeavyChart from '@/components/HeavyChart';

// APRES (charge a la demande)
import dynamic from 'next/dynamic';
const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <Skeleton className="h-64 w-full" />,
});
```

### Server Components

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

### Font Optimization

```tsx
// next/font — optimise automatiquement
import { GeistSans } from 'geist/font/sans';

export default function Layout({ children }) {
  return <html className={GeistSans.className}>{children}</html>;
}
```

---

## RAIL Model Reference

Le modele RAIL de Google definit les budgets de performance :

| Phase | Budget | Exemples |
|-------|--------|----------|
| **Response** | < 100ms | Click, tap, keyboard input |
| **Animation** | < 16ms par frame (60fps) | Scroll, transitions, animations |
| **Idle** | < 50ms par task | Background work, analytics, prefetch |
| **Load** | < 1000ms pour etre interactif | First load, navigation, hydration |

Si un fix amene une metrique sous le budget RAIL, c'est une victoire.
