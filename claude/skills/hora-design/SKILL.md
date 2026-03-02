---
name: hora-design
description: Premium web design workflow — intentional, creative, state-of-the-art. Based on the proven Insights v6 design language. Use when user says design, UI, UX, landing page, component, layout, redesign, style, theme, dark mode, branding. Do NOT use for design system audit only — use hora-vision for screenshot analysis.
metadata:
  author: HORA
  version: 3.0.0
compatibility: Claude Code. Works with React + Tailwind CSS + Vite projects.
---

# Skill: hora-design

> "L'IA ajoute. Un bon designer retire. Un excellent designer innove." — adapte de Dieter Rams

Workflow de design web ou chaque choix visuel est **intentionnel et creatif**. Le but : produire du design premium qu'un humain reconnait comme du craft, tout en innovant constamment.

## Agent Designer (obligatoire)

**Tout le code UI est ecrit par l'agent Designer** (`~/.claude/agents/Designer.md`).
Ce skill definit le workflow (phases, gates). L'agent Designer execute le code.
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

---

## Phase 0 — BRIEF (comprendre avant de dessiner)

Avant de toucher au moindre composant, comprendre le contexte.

### Questions cles

| Question | Pourquoi |
|----------|----------|
| **Quel est le produit/service ?** | Le design sert le produit |
| **Qui est l'utilisateur cible ?** | Change les choix visuels |
| **Quel est l'objectif de cette page/composant ?** | Une action principale par ecran |
| **References visuelles ?** | Sites admires, mood, direction |
| **Contraintes existantes ?** | Design system, couleurs, polices imposees |

### Classifier la tache

| Niveau | Signal | Profondeur |
|--------|--------|------------|
| **Micro** | Un composant, un etat | Coherence avec le design language |
| **Page** | Une page ou section complete | + Layout + hierarchie + responsive |
| **System** | Theme, design system, branding | + Tokens + documentation + multi-pages |

> **Gate 0** : le brief est compris. L'objectif utilisateur est clair.

---

## Phase 1 — EXPLORE (s'inspirer)

Scanner le code existant ET chercher l'inspiration.

### Audit interne
- Lire `Insights.tsx` comme reference du design language etabli
- Identifier ce qui existe deja dans le dashboard (composants, patterns, couleurs)
- Reperer les incoherences avec le design language

### Inspiration externe
- Chercher les meilleurs exemples actuels (Dribbble, Awwwards, sites de reference)
- Identifier les techniques CSS/React modernes applicables
- Noter les idees creatives qui pourraient enrichir le resultat

> **Gate 1** : on sait ce qui existe et ce qu'on peut faire de mieux.

---

## Phase 2 — FOUNDATION (decisions cles)

Le design language de base est documente dans `Designer.md`. A cette phase :

1. **Confirmer ou adapter** la palette pour ce contexte specifique
2. **Choisir** la structure layout (bento grid, editorial, dashboard, etc.)
3. **Identifier** les elements innovants a integrer (nouveau pattern, technique CSS recente, animation creative)

> **Gate 2** : les decisions fondamentales sont prises. On sait ou on va.

---

## Phase 3 — BUILD (coder le design)

L'agent Designer code directement en React avec :
- Les patterns prouves (frosted glass, serif typo, staggered animations, inline spacing)
- Les innovations choisies en Phase 2
- La structure typique : page wrapper + noise + blobs + content grid

### Regles techniques

| Regle | Raison |
|-------|--------|
| **Inline styles pour spacing** | Tailwind classes causaient des troncatures (lecon validee) |
| **`<style>` tag pour animations composant** | Plus simple, scope au composant |
| **Constantes JS pour couleurs** | Flexibilite, lisibilite |
| **Pas de `overflow: hidden` sur les cards** | Les effets fondent naturellement |
| **Pas de classe `truncate` sauf intentionnel** | Cause du texte coupe invisible |

### Creativite bienvenue

- Nouveaux patterns de data viz
- Techniques CSS modernes (`color-mix()`, `@container`, scroll-driven, View Transitions)
- Layouts experimentaux
- Micro-interactions innovantes
- Typographie creative

> **Gate 3** : le code est ecrit, le design est visible.

---

## Phase 4 — VERIFY (le design passe ou il ne passe pas)

### Checklist rapide

```
VISUEL     : [ ] Hierarchie claire (3 niveaux) [ ] Pas de texte tronque [ ] Contraste OK
TECHNIQUE  : [ ] Inline spacing [ ] Pas de overflow-hidden [ ] Animations fluides
A11Y       : [ ] Contraste 4.5:1 min [ ] Focus visible [ ] Reduced motion gere
RESPONSIVE : [ ] Pas de scroll horizontal [ ] Lisible sur mobile
```

> **Gate 4** : la checklist passe. Le design est pret.

---

## Phase 5 — DELIVER

Resume + commit. Format :

```
design: [composant/page] — [description courte]

- [Ce qui a ete fait]
- [Technique(s) notable(s)]
- [Innovation(s) si applicable]
```

---

## Regles absolues (non negociables)

1. **Intentionnel > Joli** — Chaque choix a une raison
2. **Retirer > Ajouter** — En cas de doute, simplifier
3. **Innover > Conformer** — Si un meilleur pattern existe, l'utiliser
4. **Inline spacing** — Non negociable (lecon apprise a la dure)
5. **Accessibilite = Design** — Un design inaccessible est un mauvais design

---

## References de qualite

| Reference | Ce qu'on prend |
|-----------|----------------|
| **Linear** | Dark mode, hierarchie, animations |
| **Vercel** | Typographie, minimalisme, espace |
| **Stripe** | Animations narratives, pedagogie visuelle |
| **Raycast** | Performance UI, shortcuts, data density |
| **Arc Browser** | Innovation UI, boosts, spaces |
| **Figma** | Canvas, layers, collaboration patterns |
| **Insights v6** | Notre reference interne — frosted glass, serif, warm light |
