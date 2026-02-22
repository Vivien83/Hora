---
name: hora-design
description: Anti-AI web design workflow. Produit du design intentionnel et premium, jamais generique. USE WHEN design, hora design, UI, UX, landing page, composant UI, page, layout, redesign, maquette, style, theme, dark mode, branding.
---

# Skill: hora-design

> "L'IA ajoute. Un bon designer retire." — Dieter Rams, adapte.

Workflow de design web ou **chaque choix visuel est intentionnel**. Le but n'est pas de produire du "joli" — c'est de produire du design qu'un humain reconnait comme craft, pas comme output.

Inspire de : Dieter Rams (10 principes), Bauhaus (form follows function), Swiss/International Typographic Style (Linear, Vercel), Ma japonais (espace actif), wabi-sabi (imperfection intentionnelle), Apple HIG, Stripe (animation narrative).

## Invocation

```
/hora-design [-a] [-d] [-s] [-e] <description de la tache>
```

## Flags

| Flag | Description |
|------|-------------|
| `-a` | **Autonome** : skip les confirmations (sauf decisions de branding) |
| `-d` | **Dark** : design dark-mode first (defaut : light-first) |
| `-s` | **Save** : persiste les decisions dans `.hora/design/{task-id}/` |
| `-e` | **Economy** : pas de sous-agents, outils directs uniquement |

> **Il n'existe PAS de flag pour ignorer la checklist anti-AI.** C'est intentionnel.

---

## Phase 0 — BRIEF (comprendre avant de dessiner)

Avant de toucher au moindre composant, comprendre le contexte. Un design sans brief est un template.

### 0.1 Questions obligatoires

| Question | Pourquoi |
|----------|----------|
| **Quel est le produit/service ?** | Le design sert le produit, pas l'inverse |
| **Qui est l'utilisateur cible ?** | Developer? CEO? Grand public? Change tout |
| **Quel est l'objectif de cette page/composant ?** | Une seule action principale par ecran |
| **References visuelles ?** | Sites que le client admire (pas "fais comme Apple") |
| **Contraintes existantes ?** | Design system en place ? Couleurs de marque ? Polices imposees ? |

### 0.2 Classifier la tache

| Niveau | Signal | Profondeur design |
|--------|--------|-------------------|
| **Micro** | Un composant, un etat | Token check + coherence |
| **Page** | Une page ou section complete | + Layout + hierarchie + responsive |
| **System** | Theme, design system, branding | + Tokens complets + documentation + multi-pages |

Afficher :
```
DESIGN [Niveau] — {description}
Ref: {references citees ou "Linear-like" / "Vercel-like" / "Stripe-like" si aucune}
```

> **Gate 0** : le brief est compris. L'objectif utilisateur est clair. On ne dessine pas "pour que ce soit beau" — on dessine pour resoudre un probleme.

---

## Phase 1 — AUDIT (detecter le generique)

Scanner le code existant pour identifier les patterns AI a eliminer.

### 1.1 Scan anti-patterns

Pour chaque fichier UI concerne, verifier la presence de :

```
ANTI-PATTERNS AI — DETECTION :
- [ ] Gradient indigo/violet/bleu-violet (bg-gradient-to-*, from-indigo-*, from-purple-*)
- [ ] Inter/Roboto/Arial comme seule police
- [ ] 3 colonnes d'icones symetriques ("features section")
- [ ] Glassmorphism sans justification (backdrop-blur + bg-opacity)
- [ ] Blobs SVG decoratifs (cercles flous, formes amorphes)
- [ ] Hero > 100vh avec H1 centre + sous-titre + CTA
- [ ] Fond noir pur #000000 ou bg-black
- [ ] rounded-2xl applique uniformement sans variation
- [ ] CTA gradient avec glow/shadow colore
- [ ] Ombres identiques sur toutes les cards (pas de hierarchie)
- [ ] Texte "seamless", "landscape", "delve", "leverage", "empower"
- [ ] Paragraphes de longueur artificiellement identique
- [ ] Icones Lucide/Heroicons utilisees comme decoration sans fonction
```

### 1.2 Analyse du design system existant

- [ ] Tokens de couleur : semantiques ou hardcodes ?
- [ ] Typographie : combien de familles ? scale coherente ?
- [ ] Spacing : grille 8px respectee ou valeurs arbitraires ?
- [ ] Composants shadcn/ui : customises ou defaut ?
- [ ] Dark mode : tokens dedies ou simple inversion ?
- [ ] Responsive : breakpoints coherents ou patchwork ?

### 1.3 Verdict

```
AUDIT DESIGN :
- Anti-patterns detectes : [N] / 13
- Tokens : [semantiques | hardcodes | absents]
- Hierarchie visuelle : [claire | plate | absente]
- Score : [A: premium | B: correct | C: generique | D: template AI]
```

> **Gate 1** : les anti-patterns sont identifies. Le score est etabli. On sait ce qu'il faut corriger.

---

## Phase 2 — FOUNDATION (les decisions qui determinent tout)

Les fondations se posent AVANT les composants. Changer une fondation apres coup = refaire 80% du travail.

### 2.1 Couleurs — OKLCH obligatoire

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

### 2.2 Typographie — intentionnelle, pas par defaut

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

### 2.3 Spacing — grille 8px stricte

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

### 2.4 Border radius — hierarchie, pas uniformite

```
--radius-xs: 2px;   /* Badges, tags */
--radius-sm: 4px;   /* Inputs, boutons secondaires */
--radius-md: 6px;   /* Boutons primaires, dropdowns */
--radius-lg: 8px;   /* Cards, modals */
--radius-xl: 12px;  /* Containers, sections */
--radius-full: 9999px; /* Avatars, pills */
```

**Interdit** : `rounded-2xl` (16px) applique partout. La variation cree la hierarchie.

### 2.5 Ombres — elevation intentionnelle

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

> **Gate 2** : les fondations sont posees. Couleurs OKLCH, typographie intentionnelle, spacing 8px, radius hierarchise, ombres limitees. Aucun token hardcode dans les composants.

---

## Phase 3 — LAYOUT (la structure raconte une histoire)

### 3.1 Principe : asymetrie deliberee

L'IA produit des layouts symetriques par defaut. L'asymetrie est le signal visuel le plus fort de design humain.

**Grilles editoriales** (pas de colonnes egales) :

```css
/* Au lieu de grid-cols-3 (3 colonnes egales = AI) */

/* Ratio 2:1 — contenu principal + sidebar */
.editorial-2-1 {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-lg);
}

/* Ratio 3:2 — feature highlight */
.editorial-3-2 {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: var(--space-xl);
}

/* 12 colonnes — placement libre (magazine) */
.editorial-12 {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-md);
}
.editorial-12 .hero    { grid-column: 1 / 8; }
.editorial-12 .sidebar { grid-column: 9 / 13; }
```

### 3.2 Hierarchie visuelle — 3 niveaux max

Chaque ecran a **un seul point focal** :

| Niveau | Poids visuel | Exemples |
|--------|--------------|----------|
| **Primaire** | Le plus grand, le plus contrastant | Titre principal, CTA, donnee cle |
| **Secondaire** | Taille moyenne, contraste moyen | Sous-titres, texte descriptif, navigation |
| **Tertiaire** | Petit, faible contraste (muted) | Metadata, timestamps, labels, footnotes |

**Test de la "vision floue"** : plisse les yeux devant l'ecran. Si tout parait au meme niveau → la hierarchie est plate. Corriger.

### 3.3 Espace negatif — Ma (間)

L'espace vide n'est pas une absence. C'est un element de composition actif.

**Regles** :
- Marges genereuses entre sections (48-64px minimum)
- Un seul element focal par viewport
- Plus l'element est important, plus il a d'espace autour de lui
- **Ne jamais remplir le vide avec des decorations** (blobs, patterns, gradients)
- Le vide guide l'oeil vers le contenu

### 3.4 Responsive — fluid, pas breakpoints

Privilegier les techniques fluides :
- `clamp()` pour les tailles de texte et spacing
- `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))` plutot que media queries
- Container Queries (`@container`) pour les composants adaptables a leur parent
- Tester : mobile (375px), tablet (768px), desktop (1280px), wide (1536px)

> **Gate 3** : le layout utilise au moins un ratio asymetrique. La hierarchie est claire sur 3 niveaux. L'espace negatif est intentionnel. Zero decoration de remplissage.

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

> **Gate 4** : chaque composant modifie a ses 7 etats definis. La hierarchie des boutons est respectee. Les cards ont des variations. Les forms ont des labels visibles et une validation inline.

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
| Modal/Dialog | 150-200ms | ease-out | Scale 0.95→1 + opacity 0→1 |
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

> **Gate 5** : chaque animation a une justification fonctionnelle. Les durees respectent les limites. `prefers-reduced-motion` est gere. Zero animation purement decorative.

---

## Phase 6 — VERIFY (le design passe ou il ne passe pas)

### 6.1 Checklist anti-AI (13 points)

Le design ne sort pas si un seul de ces points echoue :

```
ANTI-AI CHECKLIST :
- [ ] Zero gradient indigo/violet/bleu-violet
- [ ] Typographie : 2 familles max, heading ≠ body (weight ou famille)
- [ ] Pas de "3 colonnes d'icones" symetriques
- [ ] Zero glassmorphism sans justification fonctionnelle
- [ ] Zero blob/forme decorative SVG
- [ ] Hero : montre le produit ou < 80vh, pas de H1 centre generique
- [ ] Fond sombre : oklch, jamais #000000 ou bg-black
- [ ] Border radius : au moins 3 valeurs differentes utilisees
- [ ] CTA : couleur solide, pas de gradient glow
- [ ] Ombres : max 2 niveaux d'elevation, pas sur chaque card
- [ ] Texte : zero "seamless", "leverage", "empower", "delve"
- [ ] Au moins 1 layout asymetrique (ratio ≠ 1:1:1)
- [ ] Espace negatif intentionnel (sections ≥ 48px de marge)
```

### 6.2 Accessibilite (non negociable)

```
A11Y CHECKLIST :
- [ ] Contraste texte : 4.5:1 minimum (verifier les deux themes)
- [ ] Contraste texte large (≥ 18px bold) : 3:1 minimum
- [ ] Focus visible sur TOUS les elements interactifs (2px ring, 3:1 contraste)
- [ ] Touch targets : 44x44px minimum sur mobile
- [ ] Couleur seule ne communique jamais une info (+ icone ou texte)
- [ ] scroll-padding-top = hauteur du header sticky
- [ ] alt="" sur les images decoratives, alt descriptif sur les images informatives
- [ ] Heading hierarchy : H1 > H2 > H3 sans saut
```

### 6.3 Dark mode (pas un afterthought)

```
DARK MODE CHECKLIST :
- [ ] Tokens dark mode dedies (pas l'inverse du light)
- [ ] Fond : oklch, jamais #000000
- [ ] Ombres ajustees (plus douces ou remplacees par bordures)
- [ ] Images/illustrations : pas de fond blanc qui flash
- [ ] Texte muted : contraste suffisant sur fond sombre
- [ ] Composants shadcn/ui : testes en dark
```

### 6.4 Responsive (pas de surprise)

```
RESPONSIVE CHECKLIST :
- [ ] Mobile 375px : tout est lisible, touch targets OK
- [ ] Tablet 768px : layout adapte, pas juste compresse
- [ ] Desktop 1280px : utilise l'espace sans etaler
- [ ] Wide 1536px : contenu contenu (max-width), pas de lignes de 200 caracteres
- [ ] Pas de scroll horizontal a aucun breakpoint
- [ ] Images : srcset ou next/image, pas de 4000px charge sur mobile
```

> **Gate 6** : les 4 checklists passent. Zero anti-pattern AI. A11y conforme. Dark mode teste. Responsive verifie. Le design est pret.

---

## Phase 7 — DELIVER

### 7.1 Resume

```
DESIGN REPORT :
Niveau   : [Micro | Page | System]
Score    : [A: premium | B: correct | C: corrige]
Anti-AI  : [N]/13 checks pass
A11y     : [N]/8 checks pass
Dark mode: [N]/6 checks pass
Responsive: [N]/6 checks pass

Decisions cles :
- Palette : [hue] / [chroma] / [neutrals family]
- Typographie : [display] + [body]
- Layout : [technique principale]
```

### 7.2 Commit

Message conventionnel :
```
feat(ui): [description]

Design: hora-design [Niveau]
Anti-AI: [N]/13, A11y: [N]/8
```

---

## References de qualite

Quand aucune reference specifique n'est fournie, s'inspirer de :

| Reference | Ce qu'on prend | Ce qu'on laisse |
|-----------|----------------|-----------------|
| **Linear** | Dark mode, OKLCH theming, hierarchie claire | Specificite app desktop |
| **Vercel** | Typographie Geist, minimalisme, espace | Trop de blanc parfois |
| **Stripe** | Animations narratives, couleurs solides | Complexite WebGL |
| **Clerk** | Cards, dashboard layout, data density | — |
| **Resend** | Email-style simplicity, mono accent | — |
| **Cal.com** | Forms, scheduling UI, mobile-first | — |

---

## Regles absolues (non negociables)

1. **Intentionnel > Joli** — Chaque choix visuel a une raison. Si on ne peut pas la formuler, retirer l'element.
2. **Retirer > Ajouter** — Dieter Rams : "aussi peu de design que possible". L'IA ajoute, un bon designer retire.
3. **Tokens > Hardcode** — Jamais `bg-blue-500` dans un composant. Toujours `bg-primary`.
4. **Asymetrie > Symetrie** — Les grilles egales sont le signal AI numero 1. Varier les ratios.
5. **Espace > Decoration** — Le vide guide l'oeil. Les blobs le distraient.
6. **Fonction > Esthetique** — Une animation sans justification fonctionnelle est du bruit.
7. **Accessibilite = Design** — Un design inaccessible est un mauvais design. Pas negociable.
