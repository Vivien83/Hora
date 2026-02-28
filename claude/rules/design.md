---
paths:
  - "**/*.tsx"
  - "**/*.css"
  - "**/*.scss"
  - "tailwind.config.*"
  - "components/**"
---

# HORA Design UI/UX

## Principe
Design **intentionnel et professionnel**. Chaque element a une raison d'exister.
References : Linear, Vercel, Clerk, Resend — pas les templates AI generiques.

## Anti-patterns INTERDITS (style AI)
- Gradients bleu-violet / indigo
- Inter sur tout
- 3 icones en grille ("features section")
- Glassmorphism / cards floues
- Blobs SVG decoratifs
- Hero > 100vh avec H1 centre
- Fond noir pur `#000000` ou `bg-black` (utiliser `oklch(0.13 0.004 285)` via `bg-background`)
- `rounded-2xl` partout
- CTAs gradient avec glow
- Ombres sans hierarchie

## Typographie
- Max 2 familles : display (Geist / Plus Jakarta Sans / Bricolage Grotesque) + body
- Mono : Geist Mono / JetBrains Mono
- Headings : 600-800, 1.1-1.2 line-height, tracking-tight
- Body : 400, 1.5 line-height
- Echelle 8px : 12/14/16/18/20/24/30/36px

## Couleurs (3 couches)
- Primitives → Tokens semantiques → Tokens composants
- Jamais `bg-blue-500` dans un composant → `bg-primary`
- 1 teinte de marque, neutrals d'une famille (zinc OU slate)
- Dark mode : tokens explicites, pas l'inverse du light

## Spacing (grille 8px)
4px micro | 8px tight | 12px small | 16px standard | 24px medium | 32px large | 48px xlarge | 64px 2xlarge

## Composants shadcn/ui
- Customiser via CSS variables, jamais modifier les sources
- Etendre via wrapper + CVA
- Tester light ET dark mode

## Animations
- 100-150ms hover | 150-200ms modals | 150ms dropdowns
- Jamais > 400ms sur interactif
- `prefers-reduced-motion` respecte

## Accessibilite (WCAG 2.2)
- Contraste : 4.5:1 min (3:1 large)
- Focus visible : 2px min, 3:1 contraste
- Touch targets : 44x44px min
- Couleur seule ne communique jamais une info
