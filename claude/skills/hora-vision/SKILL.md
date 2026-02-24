---
name: hora-vision
description: Audit visuel d'interface — detection automatique des anti-patterns design issus de HORA. USE WHEN vision, screenshot, audit UI, review design, anti-patterns, interface, analyse visuelle.
---

# Skill: hora-vision

> Audit visuel d'interface — detection automatique des anti-patterns design.

Ce skill analyse une image d'interface et verifie systematiquement les 23 checks design
definis dans HORA. Lecture seule. Aucun fichier modifie.

## Invocation

```
/hora-vision <chemin-screenshot>
/hora-vision --url <url>
/hora-vision --compare <avant> <apres>
```

---

## Phase 1 — CAPTURE

- L'utilisateur fournit un chemin de fichier image ou une URL.
- Si chemin fichier : utiliser `Read` pour charger l'image (Claude est multimodal).
- Si URL : utiliser le Browser skill pour capturer un screenshot, puis analyser.
- Verifier que l'image est lisible. Si > 5 MB ou illisible, demander une version reduite.

Afficher :
```
VISION AUDIT — {nom du fichier ou URL}
Image chargee. Analyse en cours sur 23 checks.
```

---

## Phase 2 — ANALYZE

Analyser l'image en verifiant **chaque point** de la checklist ci-dessous.
Ne pas sauter de point. Chaque point produit soit un `PASS` soit un `FAIL` avec detail.

### Checklist anti-patterns AI (10 points)

| # | Check |
|---|-------|
| 1 | Gradient bleu-violet / indigo (couleurs par defaut Tailwind : `from-indigo-*`, `from-purple-*`, etc.) |
| 2 | Inter comme seule police sur l'ensemble de l'interface |
| 3 | Layout "3 colonnes d'icones symetriques" (features section classique) |
| 4 | Glassmorphism / cards transparentes floues sans justification fonctionnelle |
| 5 | Blobs SVG decoratifs flottants (cercles flous, formes amorphes de fond) |
| 6 | Hero > 100vh avec H1 centre + sous-titre + CTA sans montrer le produit |
| 7 | Fond noir pur `#000000` (devrait etre `#0A0A0B` ou une valeur OKLCH) |
| 8 | `rounded-2xl` applique partout sans variation de border-radius |
| 9 | CTA gradient avec effet glow (couleur en bordure/ombre du bouton) |
| 10 | Ombres identiques sur chaque card sans hierarchie d'elevation |

### Checklist typographie (3 points)

| # | Check |
|----|-------|
| 11 | Plus de 2 familles de polices utilisees simultanement |
| 12 | Body weight < 400 (texte trop fin, contraste insuffisant) |
| 13 | Headings sans tracking serre ou line-height > 1.3 (aspect relache) |

### Checklist accessibilite (4 points)

| # | Check |
|----|-------|
| 14 | Contraste texte estimé < 4.5:1 (texte normal) ou < 3:1 (texte large ≥ 18px bold) |
| 15 | Touch targets visiblement < 44x44px (boutons/liens trop petits pour mobile) |
| 16 | Information communiquee par la couleur seule (sans icone ni texte complementaire) |
| 17 | Focus visible absent ou supprime (impossible de verifier visuellement sur screenshot) |

### Checklist spacing & layout (3 points)

| # | Check |
|----|-------|
| 18 | Spacing irregulier — pas de grille 8px coherente (valeurs arbitraires visibles) |
| 19 | Padding inconsistant entre sections similaires |
| 20 | Absence de hierarchie visuelle — elements au meme niveau perceptuel |

### Checklist couleurs (3 points)

| # | Check |
|----|-------|
| 21 | Plus d'une teinte de marque utilisee (deux couleurs d'accent en competition) |
| 22 | Couleurs de statut (success, warning, error) = couleur de marque (confusion semantique) |
| 23 | Dark mode : inversion simple du light mode (memes valeurs inversees, pas de tokens dedies) |

---

## Phase 3 — REPORT

Produire le rapport complet en tableau :

```
| # | Check | Verdict | Severite | Detail |
|---|-------|---------|----------|--------|
| 1 | Gradient bleu-violet | PASS | — | Aucun gradient indigo detecte |
| 2 | Police unique Inter | FAIL | haute | Inter utilise seul sur tout le texte |
| ... | ... | ... | ... | ... |
```

Puis afficher le score :
```
Score : X/23 checks passes
Anti-patterns : X/10 | Typographie : X/3 | A11y : X/4 | Spacing : X/3 | Couleurs : X/3

Niveau : [A: premium | B: correct | C: generique | D: template AI]
```

### Niveaux de severite

| Niveau | Definition |
|--------|-----------|
| **critique** | Viole l'accessibilite WCAG 2.2 ou rend l'UI inutilisable |
| **haute** | Anti-pattern AI flagrant — donne un aspect generique/template immediatement reconnaissable |
| **moyenne** | Inconsistance design, manque de polish, dette visuelle |
| **basse** | Suggestion d'amelioration, pas un vrai probleme bloquant |

### Grille de notation

| Score | Niveau | Signification |
|-------|--------|---------------|
| 20-23 | A — premium | Design intentionnel, aucun signal AI visible |
| 15-19 | B — correct | Quelques points a regler, base solide |
| 10-14 | C — generique | Anti-patterns visibles, ressemble a un template |
| 0-9 | D — template AI | Output AI non travaille, refonte necessaire |

---

## Phase 4 — RECOMMEND (si findings haute+)

Pour chaque finding de severite haute ou critique :

1. **Probleme** : description precise de ce qui est detecte.
2. **Fix Tailwind/CSS** : snippet concret de correction.
3. **Token HORA** : reference au token semantique appropriate (`--background`, `--primary`, `--muted`, etc.).
4. **Delegation** : si le fix implique plusieurs composants → signaler que `/hora-design` est adapte pour une refonte complete.

Exemple de recommendation :
```
Finding #2 — Police unique Inter (haute)
Probleme : Inter utilise seul sur tout le texte, heading = body, aucune differentiation.
Fix :
  /* Ajouter une police display pour les headings */
  --font-display: "Plus Jakarta Sans", sans-serif;
  --font-body: "Inter", sans-serif;

  h1, h2, h3 { font-family: var(--font-display); font-weight: 700; letter-spacing: -0.025em; }
  body { font-family: var(--font-body); font-weight: 400; }

Token HORA : --font-display, --font-body
```

---

## Mode --compare

Quand deux chemins sont fournis (`--compare <avant> <apres>`) :

1. Charger les deux images separement.
2. Executer la Phase 2 sur chacune independamment.
3. Produire un diff des findings :

```
COMPARE : avant vs apres

Resolus (presents dans avant, absents dans apres) :
- #2 Police unique Inter — RESOLU
- #9 CTA gradient glow — RESOLU

Nouveaux (absents dans avant, presents dans apres) :
- #18 Spacing irregulier — NOUVEAU (regression)

Persistants (presents dans les deux) :
- #7 Fond noir pur — PERSISTANT (haute)

Score avant : X/23 | Score apres : Y/23 | Delta : +/-Z
```

---

## Ce que le skill ne fait PAS

- Ne modifie aucun fichier (lecture seule + rapport uniquement).
- Ne lance pas de build, de serveur, ou de processus.
- Ne remplace pas `/hora-design` — il detecte les problemes, `/hora-design` les resout.
- Ne peut pas verifier le focus visible (etat interactif) sur un screenshot statique — noter UNKNOWN pour le check 17.
