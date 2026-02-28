# OWASP Top 10 2025 — Reference complete

> Reference detaillee pour hora-security Phase 1 SCAN.
> Chaque categorie contient : description, table de checks avec CWE, patterns de detection, commandes bash.

---

## A01 — Broken Access Control

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

---

## A02 — Security Misconfiguration

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

---

## A03 — Software Supply Chain Failures

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

---

## A04 — Cryptographic Failures

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

---

## A05 — Injection

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

---

## A06 — Insecure Design

**Verifier :**

| Check | Pattern | CWE |
|-------|---------|-----|
| Rate limiting absent | Endpoints publics sans throttle | CWE-770 |
| Brute force possible | Login sans limite de tentatives | CWE-307 |
| Enumeration d'utilisateurs | Messages d'erreur differents selon l'existence du compte | CWE-204 |
| Business logic bypass | Etapes de workflow contournables | CWE-840 |
| Pas de validation serveur | Validation uniquement cote client | CWE-602 |

---

## A07 — Authentication Failures

**Verifier :**

| Check | Pattern | CWE |
|-------|---------|-----|
| Session fixation | Session ID non regenere apres login | CWE-384 |
| Token expiration | JWT sans expiration ou trop longue (> 24h) | CWE-613 |
| Password policy faible | Pas de longueur minimale (< 8 chars) | CWE-521 |
| OAuth state parameter | Pas de state dans le flow OAuth | CWE-352 |
| Credential stuffing | Pas de protection MFA / CAPTCHA | CWE-307 |

---

## A08 — Software and Data Integrity Failures

**Verifier :**

| Check | Pattern | CWE |
|-------|---------|-----|
| Deserialization non securisee | `JSON.parse()` sur input non valide | CWE-502 |
| SRI absent | Scripts externes sans Subresource Integrity | CWE-353 |
| CI/CD non securise | Secrets dans les logs CI, workflows modifiables | CWE-829 |
| Auto-update non verifie | Updates sans verification de signature | CWE-494 |

---

## A09 — Security Logging and Alerting Failures

**Verifier :**

| Check | Pattern | CWE |
|-------|---------|-----|
| Pas de logging d'auth events | Login/logout/echecs non logues | CWE-778 |
| Donnees sensibles dans les logs | Passwords, tokens, PII logues | CWE-532 |
| Pas d'alerting | Echecs d'auth en serie non detectes | CWE-223 |
| Logs non proteges | Logs accessibles publiquement | CWE-778 |

---

## A10 — Mishandling of Exceptional Conditions

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
