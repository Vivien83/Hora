# Design Foundations — hora-design Phase 2

> Les fondations se posent AVANT les composants. Changer une fondation apres coup = refaire 80% du travail.

---

## 2.1 Couleurs — OKLCH obligatoire

**Pourquoi OKLCH** : HSL ment. Un jaune et un bleu a la meme "lightness" HSL ne paraissent PAS aussi lumineux. OKLCH corrige ca — uniformite perceptuelle reelle.

**Methode de generation** :

```css
/* 1. Definir la teinte de marque (1 seule) */
:root {
  --brand-hue: [0-360];        /* La teinte signature */
  --brand-chroma: [0.05-0.20]; /* Saturation — rester sobre */
}

/* 2. Generer la palette depuis ces 2 variables */
--color-brand-50:  oklch(0.97 calc(var(--brand-chroma) * 0.1) var(--brand-hue));
--color-brand-100: oklch(0.93 calc(var(--brand-chroma) * 0.2) var(--brand-hue));
--color-brand-200: oklch(0.87 calc(var(--brand-chroma) * 0.4) var(--brand-hue));
--color-brand-300: oklch(0.78 calc(var(--brand-chroma) * 0.6) var(--brand-hue));
--color-brand-400: oklch(0.70 calc(var(--brand-chroma) * 0.8) var(--brand-hue));
--color-brand-500: oklch(0.62 var(--brand-chroma) var(--brand-hue));
--color-brand-600: oklch(0.54 var(--brand-chroma) var(--brand-hue));
--color-brand-700: oklch(0.45 calc(var(--brand-chroma) * 0.9) var(--brand-hue));
--color-brand-800: oklch(0.35 calc(var(--brand-chroma) * 0.8) var(--brand-hue));
--color-brand-900: oklch(0.25 calc(var(--brand-chroma) * 0.7) var(--brand-hue));
--color-brand-950: oklch(0.15 calc(var(--brand-chroma) * 0.5) var(--brand-hue));
```

**3 couches obligatoires** :

| Couche | Role | Exemple |
|--------|------|---------|
| **Primitives** | Valeurs brutes, JAMAIS utilisees dans les composants | `--color-zinc-900: oklch(0.21 0.006 285)` |
| **Semantiques** | Decisions de design, mappent sur les primitives | `--color-bg-canvas: var(--color-zinc-50)` |
| **Composants** | Application aux elements UI specifiques | `--button-primary-bg: var(--color-action-primary)` |

**Regle 60-30-10** :
- 60% : fond neutre (canvas)
- 30% : couleur de marque (surfaces, navigation)
- 10% : accent (CTAs, notifications, actions)

**Dark mode — tokens dedies** :
```css
[data-theme="dark"] {
  --color-bg-canvas: oklch(0.13 0.004 285);     /* PAS #000000 */
  --color-bg-surface: oklch(0.18 0.005 285);
  --color-bg-raised: oklch(0.22 0.006 285);
  --color-text-default: oklch(0.93 0.005 285);
  --color-text-muted: oklch(0.65 0.01 285);
  --color-border-default: oklch(0.28 0.006 285);
}
```

---

## 2.2 Typographie — intentionnelle, pas par defaut

**Choix des familles** :

| Usage | Options premium | INTERDIT |
|-------|----------------|----------|
| Display/Headings | Geist, Plus Jakarta Sans, Bricolage Grotesque, Cabinet Grotesk | Inter seul, Roboto, Arial |
| Body | Geist Sans, Inter (si heading different), Source Sans Pro | Meme police que heading sans variation |
| Monospace | Geist Mono, JetBrains Mono, Berkeley Mono | Courier New |
| Serif (accent) | Fraunces, Playfair Display, Source Serif Pro | Times New Roman |

**Regles** :
- Maximum 2 familles (display + body). Jamais 3.
- Headings : weight 600-800, line-height 1.1-1.2, `tracking-tight`
- Body : weight 400, line-height 1.5-1.6
- Jamais weight 300 pour le body (contraste insuffisant)
- `font-display: swap` obligatoire (pas de FOIT)

**Type scale fluide** (pas de breakpoints typographiques) :
```css
--font-size-xs:      clamp(0.75rem,  0.7rem  + 0.2vw,  0.875rem);
--font-size-sm:      clamp(0.875rem, 0.8rem  + 0.25vw, 1rem);
--font-size-base:    clamp(1rem,     0.9rem  + 0.33vw, 1.125rem);
--font-size-lg:      clamp(1.125rem, 1rem    + 0.5vw,  1.25rem);
--font-size-xl:      clamp(1.25rem,  1rem    + 0.75vw, 1.5rem);
--font-size-2xl:     clamp(1.5rem,   1.1rem  + 1.25vw, 2rem);
--font-size-3xl:     clamp(1.875rem, 1.3rem  + 1.75vw, 2.5rem);
--font-size-display: clamp(2.5rem,   1.5rem  + 3.5vw,  4.5rem);
```

---

## 2.3 Spacing — grille 8px stricte

```
4px  — micro (gap entre icone et label)
8px  — tight (padding interne compact)
12px — small (entre elements lies)
16px — base (padding standard)
24px — medium (entre groupes)
32px — large (entre sections liees)
48px — xlarge (entre sections distinctes)
64px — 2xlarge (entre blocs majeurs)
```

**Pas de valeurs arbitraires.** Si `mt-[13px]` apparait, c'est un bug.

---

## 2.4 Border radius — hierarchie, pas uniformite

```
--radius-xs: 2px;   /* Badges, tags */
--radius-sm: 4px;   /* Inputs, boutons secondaires */
--radius-md: 6px;   /* Boutons primaires, dropdowns */
--radius-lg: 8px;   /* Cards, modals */
--radius-xl: 12px;  /* Containers, sections */
--radius-full: 9999px; /* Avatars, pills */
```

**Interdit** : `rounded-2xl` (16px) applique partout. La variation cree la hierarchie.

---

## 2.5 Ombres — elevation intentionnelle

```css
/* 2 niveaux maximum. Plus = hierarchie plate */
--shadow-sm: 0 1px 2px oklch(0 0 0 / 0.05);                    /* Raised */
--shadow-md: 0 4px 12px oklch(0 0 0 / 0.08), 0 1px 3px oklch(0 0 0 / 0.04); /* Floating */

/* Dark mode : ombres plus douces, bordures plus visibles */
[data-theme="dark"] {
  --shadow-sm: 0 1px 2px oklch(0 0 0 / 0.2);
  --shadow-md: 0 4px 12px oklch(0 0 0 / 0.3), 0 1px 3px oklch(0 0 0 / 0.15);
}
```

**Pas d'ombre sur chaque card.** Utiliser les bordures pour la structure, les ombres pour l'elevation.

---

## Phase 4 — COMPONENTS (craft, pas assemblage)

### 4.1 shadcn/ui — customiser, jamais modifier les sources

```
REGLE : les fichiers dans components/ui/ ne sont JAMAIS modifies directement.
Customiser via :
1. CSS variables (@theme dans globals.css)
2. Wrapper components (composant metier qui wrappe le composant UI)
3. CVA pour les variantes custom
```

### 4.2 Etats — chaque composant a 7 etats

Chaque composant interactif doit definir ses etats :

| Etat | Description | A verifier |
|------|-------------|------------|
| **Default** | Etat de base | Lisible, contraste suffisant |
| **Hover** | Souris au survol | Transition 100-150ms, changement subtil |
| **Focus** | Navigation clavier | Ring visible 2px min, contraste 3:1 |
| **Active** | En cours de clic | Feedback visuel (scale 0.98 ou couleur) |
| **Disabled** | Non interactif | Opacity 0.5, cursor not-allowed |
| **Loading** | En attente | Skeleton ou spinner, pas de layout shift |
| **Error** | Etat d'erreur | Bordure destructive, message clair |

### 4.3 Boutons — hierarchie d'action

```
Primary   : 1 seul par ecran. Action principale. Plein, couleur de marque.
Secondary : Actions secondaires. Outline ou ghost.
Tertiary  : Actions mineures. Lien style ou ghost subtil.
Destructive : Actions dangereuses. Rouge, jamais en primary sauf confirmation.
```

**Interdit** : 2 boutons primary cote a cote. Si tout est important, rien ne l'est.

### 4.4 Cards — pas toutes identiques

```
Card hero      : grande, featured, ombre shadow-md, contenu riche
Card standard  : bordure subtile, pas d'ombre, contenu moyen
Card compact   : pas de bordure, fond surface-raised, contenu minimal
Card interactive : hover avec translateY(-1px) + shadow-sm, cursor pointer
```

### 4.5 Forms — la friction invisible

- Labels au-dessus des champs (jamais placeholder-only)
- Validation inline en temps reel (pas juste au submit)
- Messages d'erreur sous le champ concerne (pas un toast generique)
- Groupes logiques avec fieldset + legend
- Focus auto sur le premier champ au chargement
- Transitions sur les etats (border-color 150ms)

### 4.6 Tables — lisibilite avant tout

- Alternance de fond subtile (`odd:bg-muted/50`) ou bordures horizontales
- Header sticky si > 10 lignes
- Padding genereux dans les cellules (12-16px)
- Aligner les nombres a droite, le texte a gauche
- Tronquer le texte long avec `truncate` + tooltip

---

## Phase 5 — MOTION (animation fonctionnelle, pas decorative)

### 5.1 Principe de Stripe : l'animation communique

Chaque animation doit repondre a une question :
- **Quoi** : quel changement d'etat est-ce que je communique ?
- **Ou** : d'ou vient l'element et ou va-t-il ?
- **Pourquoi** : quelle info l'utilisateur en tire-t-il ?

Si aucune reponse → pas d'animation.

### 5.2 Durees strictes

| Type | Duree | Easing | Exemple |
|------|-------|--------|---------|
| Hover | 100-150ms | ease-out | Changement de couleur/opacite |
| Dropdown/Popover | 150ms | ease-out | Menu qui apparait |
| Modal/Dialog | 150-200ms | ease-out | Scale 0.95->1 + opacity 0->1 |
| Slide | 200-250ms | ease-in-out | Drawer, panel lateral |
| Page transition | 200-300ms | ease-in-out | Crossfade entre routes |
| Notification | 300ms in, 200ms out | ease-out | Toast apparition |

**Jamais > 400ms** sur un element interactif. L'utilisateur ne doit jamais attendre l'animation.

### 5.3 Patterns recommandes

```css
/* Hover subtil (pas de scale excessif) */
.interactive:hover {
  transform: translateY(-1px);
  transition: transform 150ms ease-out;
}

/* Apparition de contenu (pas de bounce) */
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Skeleton loading (pas de spinner partout) */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg,
    var(--color-bg-raised) 25%,
    var(--color-bg-surface) 50%,
    var(--color-bg-raised) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
```

### 5.4 Reduced motion — obligatoire

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Pas de condition, pas d'exception. Si l'utilisateur demande moins de mouvement, on respecte.

> **Gate 2** : les fondations sont posees. Couleurs OKLCH, typographie intentionnelle, spacing 8px, radius hierarchise, ombres limitees. Aucun token hardcode dans les composants.

> **Gate 4** : chaque composant modifie a ses 7 etats definis. La hierarchie des boutons est respectee. Les cards ont des variations. Les forms ont des labels visibles et une validation inline.

> **Gate 5** : chaque animation a une justification fonctionnelle. Les durees respectent les limites. `prefers-reduced-motion` est gere. Zero animation purement decorative.
