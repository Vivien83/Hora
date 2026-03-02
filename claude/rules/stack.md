---
paths:
  - "src/**"
  - "app/**"
  - "pages/**"
  - "components/**"
  - "lib/**"
  - "services/**"
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "package.json"
  - "tsconfig.json"
  - "*.config.ts"
  - "*.config.js"
---

# HORA Stack & Conventions Web/SaaS

## Library-first
Ne JAMAIS recoder ce qui existe en librairie maintenue.
Avant adoption : TypeScript natif, >10k DL/semaine, <12 mois, MIT/Apache.
Jamais build from scratch : auth, forms, dates, DnD, upload, paiements, charts, rich text.

## Stack par defaut
| Couche | Choix | Alt |
|---|---|---|
| Langage | **TypeScript strict** | Jamais JS pur |
| Frontend | **React 19+ / Next.js App Router** | Vite + React si SPA |
| Styling | **Tailwind CSS + shadcn/ui** | — |
| Backend | **tRPC** ou API Routes Next.js | Hono si micro |
| Database | **PostgreSQL + Drizzle ORM** | Prisma si existant |
| Auth | **Better-Auth** ou Auth.js v5 | — |
| Validation | **Zod** partout | — |
| Forms | **react-hook-form + Zod** | — |
| Tables | **@tanstack/react-table** | — |
| State serveur | **TanStack Query** | — |
| State client | **Zustand** | Context si trivial |
| Dates | **date-fns** | dayjs |
| Animations | **motion** | — |
| Charts | **Recharts** | Tremor |
| Rich text | **@tiptap/react** | — |
| DnD | **@dnd-kit/core** | @hello-pangea/dnd |
| Email | **react-email + Resend** | — |
| Upload | **uploadthing** | react-dropzone |
| i18n | **next-intl** | react-i18next |
| Paiements | **@stripe/react-stripe-js** | — |
| Analytics | **PostHog** | — |
| Errors | **@sentry/nextjs** | — |
| Feature flags | **PostHog** / GrowthBook | — |
| Testing | **Vitest + Testing Library + Playwright** | — |

## Conventions TypeScript
- `strict: true`, jamais `any`, `satisfies` > `as`
- Interfaces pour props, Zod pour runtime
- Union types > `enum` : `type Status = "active" | "inactive"`
- Exports nommes, pas de default (sauf pages Next.js)

## Conventions React
- Server Components par defaut, `"use client"` si interactivite
- Jamais `useEffect` pour data fetching → Server Components / TanStack Query
- Composants petits, single-responsibility
- Custom hooks pour logique reutilisable
- Error Boundaries sur chaque route/layout

## Conventions API
- Entrees validees avec Zod
- Reponses : `{ data: T }` ou `{ error: string, code: string }`
- Logique metier dans services, pas handlers
- Rate limiting sur endpoints publics

## Conventions projet
- Env validees au demarrage (`env.ts` + Zod)
- Pas de `console.log` en prod
- Commits conventionnels : `feat:`, `fix:`, `refactor:`, `docs:`
