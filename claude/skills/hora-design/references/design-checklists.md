# Design Checklists — hora-design Phase 6 & 7

> Le design passe ou il ne passe pas. Zero compromis.

---

## 6.1 Checklist anti-AI (13 points)

Le design ne sort pas si un seul de ces points echoue :

```
ANTI-AI CHECKLIST :
- [ ] Zero gradient indigo/violet/bleu-violet
- [ ] Typographie : 2 familles max, heading != body (weight ou famille)
- [ ] Pas de "3 colonnes d'icones" symetriques
- [ ] Zero glassmorphism sans justification fonctionnelle
- [ ] Zero blob/forme decorative SVG
- [ ] Hero : montre le produit ou < 80vh, pas de H1 centre generique
- [ ] Fond sombre : oklch, jamais #000000 ou bg-black
- [ ] Border radius : au moins 3 valeurs differentes utilisees
- [ ] CTA : couleur solide, pas de gradient glow
- [ ] Ombres : max 2 niveaux d'elevation, pas sur chaque card
- [ ] Texte : zero "seamless", "leverage", "empower", "delve"
- [ ] Au moins 1 layout asymetrique (ratio != 1:1:1)
- [ ] Espace negatif intentionnel (sections >= 48px de marge)
```

---

## 6.2 Accessibilite (non negociable)

```
A11Y CHECKLIST :
- [ ] Contraste texte : 4.5:1 minimum (verifier les deux themes)
- [ ] Contraste texte large (>= 18px bold) : 3:1 minimum
- [ ] Focus visible sur TOUS les elements interactifs (2px ring, 3:1 contraste)
- [ ] Touch targets : 44x44px minimum sur mobile
- [ ] Couleur seule ne communique jamais une info (+ icone ou texte)
- [ ] scroll-padding-top = hauteur du header sticky
- [ ] alt="" sur les images decoratives, alt descriptif sur les images informatives
- [ ] Heading hierarchy : H1 > H2 > H3 sans saut
```

---

## 6.3 Dark mode (pas un afterthought)

```
DARK MODE CHECKLIST :
- [ ] Tokens dark mode dedies (pas l'inverse du light)
- [ ] Fond : oklch, jamais #000000
- [ ] Ombres ajustees (plus douces ou remplacees par bordures)
- [ ] Images/illustrations : pas de fond blanc qui flash
- [ ] Texte muted : contraste suffisant sur fond sombre
- [ ] Composants shadcn/ui : testes en dark
```

---

## 6.4 Responsive (pas de surprise)

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
