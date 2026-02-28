# Remediation & Hardening — Reference complete

> Reference detaillee pour hora-security Phase 3 REMEDIATE et Phase 4 HARDEN.

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
