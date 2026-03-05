# HORA Design

## Agent Designer

Tout travail UI/UX passe par l'agent Designer (`~/.claude/agents/Designer.md`).
Workflow complet via le skill `/hora-design`.

## Design Language de reference

Source de verite : `Insights.tsx` dans le dashboard HORA.

### Patterns eprouves
- **Fond warm** : `#F2F0E9` (light), OKLCH tokens (dark)
- **Typo** : Playfair Display (serif, titres/nombres) + DM Sans (body) + JetBrains Mono (labels)
- **Surfaces** : Frosted glass (`white/45%` + `blur(20px)` + `white/70%` border)
- **Spacing** : inline styles (jamais Tailwind classes pour padding/margin/gap)
- **Animations** : `cubic-bezier(0.23, 1, 0.32, 1)`, entrees staggerees, hover lift
- **Textures** : noise SVG (`opacity: 0.035`) + ambient blobs (`mix-blend-mode: multiply`)

### Lecons critiques
- `overflow: hidden` tronque le contenu — ne pas utiliser sur les cards
- `truncate` = troncature intentionnelle — ne pas utiliser par defaut
- Tailwind classes pour spacing causaient des troncatures — inline styles resolvent

### Innovation
Le Designer est encourage a explorer au-dela du template : nouvelles techniques CSS, layouts experimentaux, micro-interactions creatives. La reference est un point de depart, pas une limite.
