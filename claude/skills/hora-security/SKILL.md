---
name: hora-security
description: Audit de securite systematique OWASP 2025. Chaque categorie verifiee, chaque finding classe et corrige. USE WHEN security, hora security, securite, audit, owasp, vulnerabilite, faille, pentest, xss, injection, auth, csrf, cwe.
---

# Skill: hora-security

> "La securite n'est pas une feature. C'est une propriete du systeme entier." — OWASP

Audit de securite systematique ou **chaque categorie OWASP est verifiee** sur le code source. Pas de scan superficiel — une verification fichier par fichier, pattern par pattern, avec classification CWE et remediation testee.

Inspire de : OWASP Top 10 2025, CWE/SANS Top 25 2025, OWASP Code Review Guide, NIST SP 800-53, Microsoft SDL.

## Invocation

```
/hora-security [-a] [-f] [-s] [-e] <scope optionnel : fichier, module, ou "full">
```

## Flags

| Flag | Description |
|------|-------------|
| `-a` | **Autonome** : skip les confirmations (sauf findings CRITICAL) |
| `-f` | **Full** : audit complet de la codebase (pas seulement les fichiers modifies) |
| `-s` | **Save** : persiste le rapport dans `.hora/security/{timestamp}/` |
| `-e` | **Economy** : pas de sous-agents, outils directs uniquement |

> **Il n'existe PAS de flag pour ignorer une categorie OWASP.** C'est intentionnel.

---

## Phase 0 — SCOPE (definir la surface d'audit)

### 0.1 Mode d'audit

| Mode | Declencheur | Ce qui est audite |
|------|-------------|-------------------|
| **Cible** | Fichier(s) ou module specifie | Seulement le scope indique |
| **Delta** | Pas de scope specifie (defaut) | Fichiers modifies depuis le dernier commit/PR |
| **Full** | Flag `-f` | Toute la codebase |

### 0.2 Cartographier la surface d'attaque

```
SURFACE D'ATTAQUE :
- [ ] Endpoints publics (API routes, Server Actions, webhooks)
- [ ] Formulaires et inputs utilisateur
- [ ] Auth flows (login, register, reset, OAuth callbacks)
- [ ] Upload de fichiers
- [ ] Requetes base de donnees
- [ ] Appels API externes
- [ ] Variables d'environnement
- [ ] Dependencies tierces (package.json, lock file)
- [ ] Middleware et guards
- [ ] Cron jobs / background tasks
```

Afficher :
```
SECURITY AUDIT [{mode}] — {scope}
Surface : {N} endpoints, {N} forms, {N} auth flows, {N} deps
```

> **Gate 0** : la surface d'attaque est cartographiee. On sait ce qu'on audite.

---

## Phase 1 — SCAN (10 categories OWASP 2025)

Scanner chaque categorie systematiquement. Ne pas sauter une categorie meme si elle "semble" non pertinente.

### A01 — Broken Access Control

Le #1 depuis 2021. 94% des applications testees ont des failles de controle d'acces.

**Verifier :**

| Check | Pattern a chercher | CWE |
|-------|-------------------|-----|
| Auth sur chaque route protegee | Routes sans middleware auth / `getServerSession` | CWE-862 |
| RBAC/ABAC verifie cote serveur | Roles verifies uniquement cote client | CWE-285 |
| IDOR (Insecure Direct Object Reference) | `params.id` utilise sans verifier l'ownership | CWE-639 |
| Path traversal | Concatenation de chemins avec input utilisateur | CWE-22 |
| CORS trop permissif | `Access-Control-Allow-Origin: *` | CWE-942 |
| Force browsing | Pages admin sans auth gate | CWE-425 |
| JWT non valide | Token non verifie cote serveur, expiration ignoree | CWE-347 |

```bash
# Detection automatique
grep -rn "params\." --include="*.ts" --include="*.tsx" src/app/api/
grep -rn "searchParams" --include="*.ts" --include="*.tsx" src/
```

### A02 — Security Misconfiguration

**Verifier :**

| Check | Pattern | CWE |
|-------|---------|-----|
| Headers de securite | Pas de CSP, HSTS, X-Frame-Options | CWE-1021 |
| Mode debug en prod | `NODE_ENV !== "production"` non verifie | CWE-489 |
| Erreurs detaillees exposees | Stack traces dans les reponses API | CWE-209 |
| Permissions par defaut | Fichiers/routes accessibles sans restriction | CWE-276 |
| HTTPS non force | Redirections HTTP acceptees | CWE-319 |

```typescript
// next.config.js — headers de securite recommandes
headers: [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // CSP a adapter au projet
]
```

### A03 — Software Supply Chain Failures

Nouveau en 2025. Les attaques via dependencies sont en explosion.

**Verifier :**

| Check | Pattern | CWE |
|-------|---------|-----|
| `npm audit` clean | Vulnerabilites connues dans les deps | CWE-1395 |
| Lock file present et commite | `package-lock.json` ou `pnpm-lock.yaml` absent | CWE-829 |
| Deps obsoletes | Packages > 12 mois sans update | CWE-1104 |
| Scripts d'installation | `postinstall` suspects dans les deps | CWE-506 |
| Typosquatting | Noms de packages proches de packages connus | CWE-829 |

```bash
npm audit --audit-level=high
npx npm-check-updates --target minor
```

### A04 — Cryptographic Failures

**Verifier :**

| Check | Pattern | CWE |
|-------|---------|-----|
| Secrets hardcodes | Tokens, cles API dans le code source | CWE-798 |
| Hashing faible | MD5, SHA-1 pour passwords | CWE-328 |
| Pas de hashing | Passwords stockes en clair | CWE-256 |
| Donnees sensibles en clair | PII dans les logs, URLs, local storage | CWE-312 |
| Randomness faible | `Math.random()` pour des tokens | CWE-330 |

```bash
# Chercher les secrets potentiels
grep -rn "password\s*=" --include="*.ts" --include="*.tsx" --include="*.env*" .
grep -rn "secret\|api_key\|apikey\|token" --include="*.ts" --include="*.tsx" src/
```

**Hashing correct** : bcrypt (cost 12+) ou argon2id. Jamais MD5, SHA-1, SHA-256 seul pour les passwords.

### A05 — Injection

**Verifier :**

| Check | Pattern | CWE |
|-------|---------|-----|
| SQL injection | Concatenation de strings dans les requetes DB | CWE-89 |
| XSS | `dangerouslySetInnerHTML`, input non sanitise | CWE-79 |
| Command injection | `exec()`, `spawn()` avec input utilisateur | CWE-78 |
| SSRF | URLs construites a partir d'input utilisateur | CWE-918 |
| Template injection | Variables injectees dans des templates | CWE-1336 |
| Header injection | Headers HTTP construits avec input utilisateur | CWE-113 |

```bash
# XSS
grep -rn "dangerouslySetInnerHTML" --include="*.tsx" --include="*.jsx" src/

# SQL injection (si raw queries)
grep -rn "sql\`\|\.raw(" --include="*.ts" src/

# Command injection
grep -rn "exec(\|execSync(\|spawn(" --include="*.ts" src/
```

**Protection** : Zod valide les entrees. Drizzle ORM parametrise les requetes. React echappe par defaut (sauf `dangerouslySetInnerHTML`).

### A06 — Insecure Design

**Verifier :**

| Check | Pattern | CWE |
|-------|---------|-----|
| Rate limiting absent | Endpoints publics sans throttle | CWE-770 |
| Brute force possible | Login sans limite de tentatives | CWE-307 |
| Enumeration d'utilisateurs | Messages d'erreur differents selon l'existence du compte | CWE-204 |
| Business logic bypass | Etapes de workflow contournables | CWE-840 |
| Pas de validation serveur | Validation uniquement cote client | CWE-602 |

### A07 — Authentication Failures

**Verifier :**

| Check | Pattern | CWE |
|-------|---------|-----|
| Session fixation | Session ID non regenere apres login | CWE-384 |
| Token expiration | JWT sans expiration ou trop longue (> 24h) | CWE-613 |
| Password policy faible | Pas de longueur minimale (< 8 chars) | CWE-521 |
| OAuth state parameter | Pas de state dans le flow OAuth | CWE-352 |
| Credential stuffing | Pas de protection MFA / CAPTCHA | CWE-307 |

### A08 — Software and Data Integrity Failures

**Verifier :**

| Check | Pattern | CWE |
|-------|---------|-----|
| Deserialization non securisee | `JSON.parse()` sur input non valide | CWE-502 |
| SRI absent | Scripts externes sans Subresource Integrity | CWE-353 |
| CI/CD non securise | Secrets dans les logs CI, workflows modifiables | CWE-829 |
| Auto-update non verifie | Updates sans verification de signature | CWE-494 |

### A09 — Security Logging and Alerting Failures

**Verifier :**

| Check | Pattern | CWE |
|-------|---------|-----|
| Pas de logging d'auth events | Login/logout/echecs non logues | CWE-778 |
| Donnees sensibles dans les logs | Passwords, tokens, PII logues | CWE-532 |
| Pas d'alerting | Echecs d'auth en serie non detectes | CWE-223 |
| Logs non proteges | Logs accessibles publiquement | CWE-778 |

### A10 — Mishandling of Exceptional Conditions

Nouveau en 2025. Les erreurs mal gerees sont un vecteur d'attaque.

**Verifier :**

| Check | Pattern | CWE |
|-------|---------|-----|
| try/catch vide | `catch {}` ou `catch (e) {}` sans traitement | CWE-390 |
| Erreur silencieuse | `.catch(() => null)` sur des ops critiques | CWE-391 |
| Stack trace exposee | Erreur complete renvoyee au client | CWE-209 |
| Error boundary absent | Pages React sans Error Boundary | CWE-755 |
| Promise non geree | Promise sans .catch() ni await dans try | CWE-755 |

```bash
# Catch vides
grep -rn "catch\s*{" --include="*.ts" --include="*.tsx" src/
grep -rn "catch\s*(\s*)" --include="*.ts" --include="*.tsx" src/

# Erreurs silencieuses
grep -rn "\.catch.*=>.*null\|\.catch.*=>.*undefined" --include="*.ts" src/
```

> **Gate 1** : les 10 categories OWASP sont auditees. Chaque finding est documente avec son CWE.

---

## Phase 2 — CLASSIFY (trier par severite)

### 2.1 Classification des findings

| Severite | Critere | Action | Delai |
|----------|---------|--------|-------|
| **CRITICAL** | Exploit actif possible, acces aux donnees | Fix IMMEDIAT avant merge | 0 |
| **HIGH** | Vulnerability exploitable avec effort modere | Fix avant merge | 0 |
| **MEDIUM** | Vulnerability theorique, defense en profondeur | Fix dans le sprint | Sprint |
| **LOW** | Best practice manquante, hardening | Backlog | Planifie |
| **INFO** | Observation, suggestion d'amelioration | Note | Optionnel |

### 2.2 Matrice des findings

```
SECURITY FINDINGS :
| # | OWASP | CWE | Severite | Fichier:ligne | Description | Statut |
|---|-------|-----|----------|---------------|-------------|--------|
| 1 | A01 | CWE-862 | CRITICAL | src/api/users/[id]/route.ts:15 | No auth check | OPEN |
| 2 | A05 | CWE-79 | HIGH | src/components/Comment.tsx:42 | dangerouslySetInnerHTML | OPEN |
| ...
```

> **Gate 2** : chaque finding a une severite, un CWE, et une localisation precise.

---

## Phase 3 — REMEDIATE (corriger avec preuves)

### 3.1 Ordre de correction

1. **CRITICAL** d'abord — exploit actif, 0 delai
2. **HIGH** ensuite — vulnerability exploitable
3. **MEDIUM** si dans le scope du sprint
4. **LOW/INFO** — documenter pour plus tard

### 3.2 Pour chaque finding CRITICAL/HIGH

```
1. Ecrire un test qui REPRODUIT la vulnerabilite
   (Test d'abord — meme discipline que hora-forge)

2. Implementer le fix MINIMAL
   (Pas de refactoring opportuniste — fix de securite pur)

3. Verifier que le test passe

4. Verifier qu'aucun test existant ne casse

5. Micro-commit :
   fix(security): [CWE-XXX] [description courte]
```

### 3.3 Patterns de remediation Next.js

| Vulnerability | Fix standard |
|---------------|-------------|
| Missing auth | Middleware + `getServerSession()` check |
| IDOR | Verifier `session.user.id === resource.ownerId` |
| XSS | Retirer `dangerouslySetInnerHTML`, utiliser DOMPurify si necessaire |
| SQL injection | Drizzle ORM (queries parametrisees par defaut) |
| Missing rate limit | `@upstash/ratelimit` ou similaire |
| Missing CSP | `next.config.js` headers + nonce pour scripts inline |
| Secrets hardcodes | `.env.local` + Zod validation dans `env.ts` |
| Missing CSRF | Next.js Server Actions (CSRF built-in) ou `csrf` package |
| Weak hashing | `bcrypt` (cost 12) ou `argon2id` |
| Missing error boundary | `error.tsx` dans chaque route layout |

### 3.4 Regles de remediation

- **Ne pas melanger fix de securite et feature** — commit separe, PR separee si necessaire
- **Ne pas "fix forward"** — si le fix introduit une regression, UNDO et repenser
- **Documenter le fix** — commentaire `// Security: CWE-XXX` si le code n'est pas auto-explicatif
- **Principe du moindre privilege** — ne donner que les permissions necessaires

> **Gate 3** : chaque finding CRITICAL/HIGH a un test de reproduction et un fix verifie. Les tests existants passent.

---

## Phase 4 — HARDEN (defense en profondeur)

Au-dela des findings, verifier les couches de defense structurelles.

### 4.1 Headers de securite

```typescript
// next.config.ts — headers recommandes
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
```

### 4.2 Validation des entrees

```
CHECKLIST VALIDATION :
- [ ] Chaque API route valide ses inputs avec Zod
- [ ] Chaque Server Action valide ses inputs avec Zod
- [ ] Les schemas Zod ont des limites (maxLength, max, etc.)
- [ ] Les types TypeScript ne suffisent PAS — Zod valide au runtime
- [ ] Les fichiers uploades sont valides (type MIME, taille max)
```

### 4.3 Variables d'environnement

```
CHECKLIST ENV :
- [ ] env.ts existe et valide toutes les variables au demarrage (Zod)
- [ ] .env.local n'est PAS commite (.gitignore)
- [ ] .env.example existe avec les cles sans valeurs
- [ ] Pas de secrets dans le code source
- [ ] Pas de secrets dans les logs
- [ ] Variables de production differentes du dev
```

### 4.4 Dependencies

```bash
# Audit des vulnerabilites
npm audit --audit-level=high

# Verifier les licenses
npx license-checker --failOn "GPL-3.0;AGPL-3.0"

# Lock file integrite
npm ci  # echoue si package-lock.json est inconsistant
```

> **Gate 4** : les couches de defense structurelles sont en place. Headers, validation, env, dependencies.

---

## Phase 5 — REPORT (documentation des findings)

### 5.1 Rapport de securite

```
SECURITY AUDIT REPORT
Date  : {YYYY-MM-DD}
Scope : {mode} — {fichiers/modules audites}
Auditeur : hora-security (methodologie OWASP Top 10 2025)

RESUME :
- Surface d'attaque : {N} endpoints, {N} forms, {N} auth flows
- Findings : {N} CRITICAL, {N} HIGH, {N} MEDIUM, {N} LOW, {N} INFO
- Corriges : {N} / {N total CRITICAL+HIGH}
- Statut : {PASS | FAIL (findings CRITICAL/HIGH ouverts)}

MATRICE DES FINDINGS :
| # | OWASP | CWE | Severite | Description | Statut |
|---|-------|-----|----------|-------------|--------|
| 1 | ... | ... | ... | ... | FIXED / OPEN / ACCEPTED |

HARDENING :
- Headers : {OK | MISSING}
- Validation : {OK | PARTIAL | MISSING}
- Env : {OK | PARTIAL | MISSING}
- Dependencies : {N} vulnerabilites connues

RECOMMANDATIONS :
1. {action prioritaire}
2. {action secondaire}
```

### 5.2 Commit

```
fix(security): audit OWASP — {N} findings corriges

Fixed: CWE-XXX (description), CWE-YYY (description)
Open: {N} MEDIUM, {N} LOW (documented)
Audit: OWASP Top 10 2025, {N} categories verified
```

### 5.3 PR (si combinee avec hora-forge `-pr`)

```bash
gh pr create --title "fix(security): OWASP audit — {scope}" --body "$(cat <<'EOF'
## Security Audit Report
- Methodology: OWASP Top 10 2025
- Scope: {description}
- Findings: {N} CRITICAL, {N} HIGH, {N} MEDIUM, {N} LOW

## Fixes Applied
| CWE | Severity | Description | Fix |
|-----|----------|-------------|-----|
| ... | ... | ... | ... |

## Hardening
- [x] Security headers configured
- [x] Input validation (Zod) on all endpoints
- [x] Environment variables validated at startup
- [x] Dependencies audited (npm audit clean)

## Open Items
{MEDIUM/LOW findings documented for future sprints}
EOF
)"
```

> **Gate 5** : le rapport est complet. Zero finding CRITICAL/HIGH ouvert. Les couches de defense sont documentees.

---

## Integration avec les autres skills

| Contexte | Integration |
|----------|-------------|
| `/hora-forge` | La phase EXAMINE de Forge inclut deja un scan securite. hora-security va plus loin (10 categories completes). |
| `/hora-refactor` | Apres un refactoring, relancer hora-security sur le scope modifie. |
| `/hora-design` | Les choix design impactent la securite (CSP pour inline styles, CORS pour fonts externes). |

---

## Regles absolues (non negociables)

1. **10 categories, pas 9** — Chaque categorie OWASP est verifiee. Sauter une categorie "non pertinente" est exactement la ou les failles se cachent.
2. **CWE obligatoire** — Chaque finding a un identifiant CWE. Pas de "c'est pas bien" sans reference.
3. **Test de reproduction** — Chaque fix CRITICAL/HIGH a un test qui prouve que la vulnerabilite existait et est corrigee.
4. **Fix pur** — Un fix de securite ne contient QUE le fix. Pas de refactoring, pas de feature, pas de cleanup.
5. **Moindre privilege** — Chaque permission, acces, token a la portee MINIMALE necessaire.
6. **Defense en profondeur** — Jamais une seule couche. Validation client + serveur. Auth middleware + route check. Headers + CSP.
7. **Secrets = zero trust** — Aucun secret dans le code, les logs, les URLs, le local storage. Jamais.
