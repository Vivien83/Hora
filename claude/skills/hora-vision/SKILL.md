---
name: hora-vision
description: Visual UI audit — automatic detection of AI design anti-patterns from HORA checklist (23 checks). Use when user says vision, screenshot, audit UI, review design, anti-patterns, interface, visual analysis. Do NOT use for implementing design fixes — use hora-design for that. Do NOT use for code-level CSS review — this analyzes screenshots only.
metadata:
  author: HORA
  version: 2.0.0
compatibility: Claude Code. Requires image file or URL. Uses Claude multimodal vision.
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
| 1 | Gradient bleu-violet / indigo |
| 2 | Inter comme seule police |
| 3 | Layout "3 colonnes d'icones symetriques" |
| 4 | Glassmorphism sans justification fonctionnelle |
| 5 | Blobs SVG decoratifs flottants |
| 6 | Hero > 100vh avec H1 centre + sous-titre + CTA sans produit |
| 7 | Fond noir pur #000000 |
| 8 | rounded-2xl applique partout sans variation |
| 9 | CTA gradient avec effet glow |
| 10 | Ombres identiques sur chaque card |

### Checklist typographie (3 points)

| # | Check |
|----|-------|
| 11 | Plus de 2 familles de polices |
| 12 | Body weight < 400 |
| 13 | Headings sans tracking serre ou line-height > 1.3 |

### Checklist accessibilite (4 points)

| # | Check |
|----|-------|
| 14 | Contraste texte < 4.5:1 (normal) ou < 3:1 (large) |
| 15 | Touch targets < 44x44px |
| 16 | Information par couleur seule |
| 17 | Focus visible absent (noter UNKNOWN sur screenshot) |

### Checklist spacing & layout (3 points)

| # | Check |
|----|-------|
| 18 | Spacing irregulier (pas de grille 8px) |
| 19 | Padding inconsistant entre sections similaires |
| 20 | Absence de hierarchie visuelle |

### Checklist couleurs (3 points)

| # | Check |
|----|-------|
| 21 | Plus d'une teinte de marque |
| 22 | Couleurs de statut = couleur de marque |
| 23 | Dark mode = simple inversion du light mode |

---

## Phase 3 — REPORT

```
| # | Check | Verdict | Severite | Detail |
|---|-------|---------|----------|--------|
| 1 | Gradient bleu-violet | PASS | — | Aucun gradient indigo |
| 2 | Police unique Inter | FAIL | haute | Inter seul partout |
| ... | ... | ... | ... | ... |

Score : X/23 checks passes
Anti-patterns : X/10 | Typographie : X/3 | A11y : X/4 | Spacing : X/3 | Couleurs : X/3

Niveau : [A: premium | B: correct | C: generique | D: template AI]
```

### Grille de notation

| Score | Niveau | Signification |
|-------|--------|---------------|
| 20-23 | A — premium | Design intentionnel, aucun signal AI |
| 15-19 | B — correct | Quelques points a regler, base solide |
| 10-14 | C — generique | Anti-patterns visibles, template feel |
| 0-9 | D — template AI | Output AI non travaille, refonte necessaire |

---

## Phase 4 — RECOMMEND (si findings haute+)

Pour chaque finding haute ou critique :
1. **Probleme** : description precise
2. **Fix Tailwind/CSS** : snippet concret de correction
3. **Token HORA** : reference au token semantique
4. **Delegation** : si multi-composants → recommander `/hora-design`

---

## Mode --compare

Quand deux images fournies (`--compare <avant> <apres>`) :
1. Executer Phase 2 sur chacune
2. Produire un diff : Resolus / Nouveaux / Persistants
3. Score avant vs apres + delta

---

## Examples

Example 1: Quick screenshot audit
```
User: "/hora-vision ~/Desktop/screenshot.png"
→ Charge l'image, lance les 23 checks
→ Score: 16/23 — Niveau B
→ 3 findings haute : fond #000, rounded-2xl uniforme, pas de hierarchie
```

Example 2: Before/after comparison
```
User: "/hora-vision --compare avant.png apres.png"
→ Avant: 12/23 (C) | Apres: 19/23 (B)
→ 5 resolus, 1 nouveau, 2 persistants
```

## Ce que le skill ne fait PAS

- Ne modifie aucun fichier (lecture seule + rapport)
- Ne lance pas de build ou de serveur
- Ne remplace pas `/hora-design` — il detecte, hora-design resout
- Ne peut pas verifier le focus visible sur un screenshot statique
