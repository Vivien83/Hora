---
name: hora-design
description: Anti-AI web design workflow — intentional, premium design. Detects and eliminates generic AI patterns. Use when user says design, UI, UX, landing page, component, layout, redesign, style, theme, dark mode, branding. Do NOT use for design system audit only — use hora-vision for screenshot analysis.
metadata:
  author: HORA
  version: 2.1.0
compatibility: Claude Code. Works with Tailwind CSS + shadcn/ui projects.
---

# Skill: hora-design

> "L'IA ajoute. Un bon designer retire." — Dieter Rams, adapte.

Workflow de design web ou **chaque choix visuel est intentionnel**. Le but n'est pas de produire du "joli" — c'est de produire du design qu'un humain reconnait comme craft, pas comme output.

Inspire de : Dieter Rams (10 principes), Bauhaus (form follows function), Swiss/International Typographic Style (Linear, Vercel), Ma japonais (espace actif), wabi-sabi (imperfection intentionnelle), Apple HIG, Stripe (animation narrative).

## Agent Designer (obligatoire)

**Tout le code UI est ecrit par l'agent Designer** (`~/.claude/agents/Designer.md`).
Ce skill definit le workflow (phases, gates, checklists). L'agent Designer execute le code.
Quand `/hora-design` est invoque, lancer l'agent Designer avec le contexte du brief + la phase courante.

## Invocation

```
/hora-design [-a] [-d] [-s] [-e] <description de la tache>
```

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

### Questions obligatoires

| Question | Pourquoi |
|----------|----------|
| **Quel est le produit/service ?** | Le design sert le produit, pas l'inverse |
| **Qui est l'utilisateur cible ?** | Developer? CEO? Grand public? Change tout |
| **Quel est l'objectif de cette page/composant ?** | Une seule action principale par ecran |
| **References visuelles ?** | Sites que le client admire (pas "fais comme Apple") |
| **Contraintes existantes ?** | Design system en place ? Couleurs de marque ? Polices imposees ? |

### Classifier la tache

| Niveau | Signal | Profondeur design |
|--------|--------|-------------------|
| **Micro** | Un composant, un etat | Token check + coherence |
| **Page** | Une page ou section complete | + Layout + hierarchie + responsive |
| **System** | Theme, design system, branding | + Tokens complets + documentation + multi-pages |

> **Gate 0** : le brief est compris. L'objectif utilisateur est clair. On ne dessine pas "pour que ce soit beau" — on dessine pour resoudre un probleme.

---

## Phase 1 — AUDIT (detecter le generique)

Scanner le code existant pour identifier les patterns AI a eliminer.

### Scan anti-patterns

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

### Analyse du design system existant

- [ ] Tokens de couleur : semantiques ou hardcodes ?
- [ ] Typographie : combien de familles ? scale coherente ?
- [ ] Spacing : grille 8px respectee ou valeurs arbitraires ?
- [ ] Composants shadcn/ui : customises ou defaut ?
- [ ] Dark mode : tokens dedies ou simple inversion ?
- [ ] Responsive : breakpoints coherents ou patchwork ?

### Verdict

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

Couleurs OKLCH (3 couches obligatoires), typographie intentionnelle (2 familles max), spacing grille 8px stricte, border radius hierarchise, ombres limitees a 2 niveaux, dark mode avec tokens dedies.

**See `references/design-foundations.md` for complete OKLCH color system, typography choices, fluid type scale, spacing grid, border radius hierarchy, shadow tokens, and dark mode CSS examples.**

> **Gate 2** : les fondations sont posees. Aucun token hardcode dans les composants.

---

## Phase 3 — LAYOUT (la structure raconte une histoire)

### Asymetrie deliberee

L'IA produit des layouts symetriques par defaut. L'asymetrie est le signal visuel le plus fort de design humain. Utiliser des ratios editoriaux (2:1, 3:2, grille 12 colonnes libre) au lieu de colonnes egales.

### Hierarchie visuelle — 3 niveaux max

Chaque ecran a **un seul point focal** :

| Niveau | Poids visuel | Exemples |
|--------|--------------|----------|
| **Primaire** | Le plus grand, le plus contrastant | Titre principal, CTA, donnee cle |
| **Secondaire** | Taille moyenne, contraste moyen | Sous-titres, texte descriptif, navigation |
| **Tertiaire** | Petit, faible contraste (muted) | Metadata, timestamps, labels, footnotes |

**Test de la "vision floue"** : plisse les yeux devant l'ecran. Si tout parait au meme niveau → la hierarchie est plate.

### Espace negatif — Ma

L'espace vide n'est pas une absence. C'est un element de composition actif.

- Marges genereuses entre sections (48-64px minimum)
- Un seul element focal par viewport
- Plus l'element est important, plus il a d'espace autour de lui
- **Ne jamais remplir le vide avec des decorations** (blobs, patterns, gradients)
- Le vide guide l'oeil vers le contenu

### Responsive — fluid, pas breakpoints

Privilegier `clamp()`, `auto-fit/minmax()`, Container Queries (`@container`). Tester : mobile (375px), tablet (768px), desktop (1280px), wide (1536px).

> **Gate 3** : le layout utilise au moins un ratio asymetrique. La hierarchie est claire sur 3 niveaux. L'espace negatif est intentionnel. Zero decoration de remplissage.

---

## Phase 4 — COMPONENTS (craft, pas assemblage)

shadcn/ui customise via CSS variables + wrappers + CVA. Chaque composant interactif a 7 etats (default, hover, focus, active, disabled, loading, error). Hierarchie des boutons (1 primary par ecran). Cards avec variations. Forms avec labels visibles et validation inline.

**See `references/design-foundations.md` (Phase 4 section) for component states table, button hierarchy, card variations, form rules, and table guidelines.**

> **Gate 4** : chaque composant modifie a ses 7 etats definis.

---

## Phase 5 — MOTION (animation fonctionnelle, pas decorative)

Principe Stripe : chaque animation repond a Quoi/Ou/Pourquoi. Si aucune reponse → pas d'animation. Durees strictes (100-150ms hover, 150-200ms modals, jamais > 400ms). `prefers-reduced-motion` obligatoire.

**See `references/design-foundations.md` (Phase 5 section) for duration table, CSS patterns (hover, fade-in-up, shimmer), and reduced motion media query.**

> **Gate 5** : chaque animation a une justification fonctionnelle. Zero animation purement decorative.

---

## Phase 6 — VERIFY (le design passe ou il ne passe pas)

4 checklists obligatoires : anti-AI (13 points), accessibilite (8 points), dark mode (6 points), responsive (6 points).

**See `references/design-checklists.md` for all 4 checklists and the Phase 7 DELIVER report template.**

> **Gate 6** : les 4 checklists passent. Zero anti-pattern AI. A11y conforme. Dark mode teste. Responsive verifie.

---

## Phase 7 — DELIVER

Resume + commit. **See `references/design-checklists.md` (Phase 7 section) for report template and commit message format.**

---

## Regles absolues (non negociables)

1. **Intentionnel > Joli** — Chaque choix visuel a une raison. Si on ne peut pas la formuler, retirer l'element.
2. **Retirer > Ajouter** — Dieter Rams : "aussi peu de design que possible". L'IA ajoute, un bon designer retire.
3. **Tokens > Hardcode** — Jamais `bg-blue-500` dans un composant. Toujours `bg-primary`.
4. **Asymetrie > Symetrie** — Les grilles egales sont le signal AI numero 1. Varier les ratios.
5. **Espace > Decoration** — Le vide guide l'oeil. Les blobs le distraient.
6. **Fonction > Esthetique** — Une animation sans justification fonctionnelle est du bruit.
7. **Accessibilite = Design** — Un design inaccessible est un mauvais design. Pas negociable.

---

## References de qualite

| Reference | Ce qu'on prend | Ce qu'on laisse |
|-----------|----------------|-----------------|
| **Linear** | Dark mode, OKLCH theming, hierarchie claire | Specificite app desktop |
| **Vercel** | Typographie Geist, minimalisme, espace | Trop de blanc parfois |
| **Stripe** | Animations narratives, couleurs solides | Complexite WebGL |
| **Clerk** | Cards, dashboard layout, data density | — |
| **Resend** | Email-style simplicity, mono accent | — |
| **Cal.com** | Forms, scheduling UI, mobile-first | — |
