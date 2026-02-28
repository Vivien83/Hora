---
name: hora-browser
description: Browser automation tool — screenshots, visual diffs, link checking, a11y audit, form testing. Use when user says browser, screenshot, capture, visual test, check links, test page, verify deploy, a11y audit, responsive test. Do NOT use for design methodology — use hora-design. Do NOT use for screenshot analysis — use hora-vision.
metadata:
  author: HORA
  version: 1.0.0
compatibility: Claude Code. Requires Playwright (auto-installed if missing). Cross-platform macOS/Linux/Windows.
---

# Skill: hora-browser

> Browser automation pour HORA — captures, diffs visuels, liens, accessibilite.

Ce skill fournit 5 modes d'automatisation navigateur, tous executables via `npx tsx`.
Playwright est la dependance principale (auto-installee si absente).

## Invocation

```
/hora-browser capture <url>
/hora-browser diff <image1> <image2>
/hora-browser links <url> [--depth 2]
/hora-browser a11y <url>
/hora-browser fill <url> <selector> <value>
```

---

## Prerequis

Le skill detecte automatiquement si Playwright est installe. Si absent :

```bash
npm install -D playwright
npx playwright install chromium
```

Pour le mode `diff`, pixelmatch et pngjs sont necessaires :

```bash
npm install -D pixelmatch pngjs
```

Tous les scripts utilisent `npx tsx` — aucune compilation prealable requise.

---

## Mode 1 — CAPTURE (multi-viewport screenshots)

**Script** : `scripts/capture.ts`

```bash
npx tsx scripts/capture.ts <url> [output-dir]
```

Capture la page a 4 viewports :
| Viewport | Resolution |
|----------|-----------|
| mobile | 375x812 |
| tablet | 768x1024 |
| desktop | 1280x800 |
| wide | 1536x864 |

**Sortie** : `.hora/screenshots/{YYYY-MM-DD}/{timestamp}_{viewport}.png`
**stdout** : JSON avec chemins et metadonnees de chaque capture.

### Quand utiliser
- Verifier un deploy avant/apres
- Capturer l'etat visuel d'une page pour regression
- Tester le responsive d'un composant
- Fournir des screenshots a `/hora-vision` pour audit

---

## Mode 2 — VISUAL DIFF (comparaison pixel-par-pixel)

**Script** : `scripts/visual-diff.ts`

```bash
npx tsx scripts/visual-diff.ts <image1> <image2> [output-path] [threshold]
```

Compare deux images pixel par pixel via pixelmatch.
Genere une image diff avec les differences surlignees en rouge.

**Parametres** :
- `image1`, `image2` : chemins des PNG a comparer
- `output-path` : chemin de l'image diff (defaut : `diff-output.png`)
- `threshold` : sensibilite 0.0-1.0 (defaut : 0.1)

**stdout** : JSON avec total pixels, pixels differents, pourcentage.

### Quand utiliser
- Regression visuelle apres un changement CSS
- Comparer avant/apres un refactor de composant
- Valider qu'un fix n'a pas d'effets de bord visuels

---

## Mode 3 — CHECK LINKS (detection de liens casses)

**Script** : `scripts/check-links.ts`

```bash
npx tsx scripts/check-links.ts <url> [--depth 2] [--timeout 5000]
```

Crawle les liens de la page et verifie leur status HTTP.
Suit les liens internes jusqu'a la profondeur specifiee.
Utilise `fetch` natif Node 18+ — zero dependance externe.

**Sortie JSON** :
- Liens valides (2xx)
- Liens rediriges (3xx) avec la chaine de redirection
- Liens casses (4xx, 5xx)
- Liens en timeout

### Quand utiliser
- Audit SEO : trouver les liens morts
- Verification post-deploy
- Validation de documentation

---

## Mode 4 — A11Y AUDIT (accessibilite axe-core)

**Script** : `scripts/a11y-audit.ts`

```bash
npx tsx scripts/a11y-audit.ts <url> [--json]
```

Charge la page avec Playwright, injecte axe-core depuis CDN,
execute `axe.run()` et produit un rapport structure.

**Sortie** : violations groupees par impact (critical, serious, moderate, minor).
Avec `--json` : sortie JSON brute.

### Quand utiliser
- Audit WCAG 2.2 automatise
- Verification avant mise en production
- Complement a `/hora-vision` (axe detecte ce que l'oeil ne voit pas)

---

## Mode 5 — FILL FORM (test de formulaires)

Ce mode est gere directement par Claude via Playwright dans le terminal.
Pas de script dedie — utiliser les commandes Playwright dans un script ad-hoc :

```typescript
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://example.com/form');
await page.fill('#email', 'test@example.com');
await page.fill('#password', 'SecurePass123');
await page.click('button[type="submit"]');
// Verifier le resultat
await browser.close();
```

### Quand utiliser
- Tester un formulaire d'inscription/connexion
- Valider les messages d'erreur de validation
- Verifier le comportement post-soumission

---

## Sortie et stockage

Tous les fichiers generes sont sauvegardes dans :
```
.hora/screenshots/{YYYY-MM-DD}/
```

Convention de nommage :
```
{HHMMSSmmm}_{viewport}.png     # captures
{HHMMSSmmm}_diff.png            # diffs visuels
{HHMMSSmmm}_a11y.json           # rapports a11y
{HHMMSSmmm}_links.json          # rapports liens
```

---

## Exemples

### Exemple 1 : Capturer une page en responsive
```
User: "capture mon site en responsive"
→ npx tsx scripts/capture.ts https://localhost:3000
→ 4 screenshots generes dans .hora/screenshots/2026-02-28/
→ JSON summary affiche
```

### Exemple 2 : Comparer avant/apres un changement CSS
```
User: "compare ces deux screenshots"
→ npx tsx scripts/visual-diff.ts before.png after.png
→ diff-output.png genere, 2.3% de pixels differents
→ Zones de changement surlignees en rouge
```

### Exemple 3 : Trouver les liens casses
```
User: "check links sur mon site"
→ npx tsx scripts/check-links.ts https://mysite.com --depth 2
→ 47 liens verifies, 3 casses (404), 2 redirections
→ Rapport JSON avec details
```

### Exemple 4 : Audit accessibilite
```
User: "audit a11y de ma landing page"
→ npx tsx scripts/a11y-audit.ts https://localhost:3000
→ 2 critical, 5 serious, 3 moderate violations
→ Chaque violation avec description, elements concernes, fix suggere
```

### Exemple 5 : Workflow complet capture + vision
```
User: "capture et analyse visuellement ma page"
→ /hora-browser capture https://localhost:3000
→ /hora-vision .hora/screenshots/2026-02-28/143022_desktop.png
→ Score: 18/23 — Niveau B
```

---

## Troubleshooting

### Playwright ne se lance pas
```
Error: browserType.launch: Executable doesn't exist
```
Fix : `npx playwright install chromium`

### Timeout sur la page
```
Error: page.goto: Timeout 30000ms exceeded
```
La page met trop longtemps a charger. Verifier que le serveur est demarre.
Les scripts utilisent un timeout de 30s par defaut.

### pixelmatch non trouve (mode diff)
```
Error: Cannot find module 'pixelmatch'
```
Fix : `npm install -D pixelmatch pngjs`

### Node < 18 (mode links)
```
Error: fetch is not defined
```
Le mode check-links necessite Node 18+ pour le fetch natif.
Verifier : `node --version`

### Page blanche dans les captures
La page utilise peut-etre du JavaScript cote client qui n'a pas fini de s'executer.
Les scripts attendent `networkidle` par defaut. Si le probleme persiste,
le site a peut-etre un spinner infini ou un blocage CORS.

### Permissions fichier
Les screenshots sont ecrits dans `.hora/screenshots/`. Si le dossier est en lecture seule
ou le disque plein, les scripts affichent une erreur explicite.

---

## Ce que le skill ne fait PAS

- Ne modifie aucun fichier du projet (lecture seule + generation de captures/rapports)
- Ne remplace pas `/hora-vision` — il capture, hora-vision analyse
- Ne remplace pas `/hora-design` — il detecte des problemes, hora-design les resout
- Ne gere pas les tests end-to-end complets — utiliser Playwright Test pour ca
- Ne fonctionne pas sans navigateur (pas de mode headless-only sur CI sans Xvfb)
