---
name: hora-security
description: Systematic OWASP 2025 security audit — all 10 categories verified, findings classified by CWE, remediation tested. Use when user says security, audit, owasp, vulnerability, faille, pentest, xss, injection, auth, csrf. Do NOT use for runtime security monitoring — this is a code-level audit skill.
metadata:
  author: HORA
  version: 2.0.0
compatibility: Claude Code. Works with any TypeScript/Next.js project.
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

> **Reference complete** : [`references/owasp-categories.md`](references/owasp-categories.md) — tables de checks, CWE, patterns de detection, commandes bash pour chaque categorie.

| Cat. | Nom | Focus |
|------|-----|-------|
| A01 | Broken Access Control | Auth manquante, IDOR, CORS, path traversal, JWT |
| A02 | Security Misconfiguration | Headers, debug mode, stack traces, HTTPS |
| A03 | Software Supply Chain Failures | npm audit, lock file, deps obsoletes, typosquatting |
| A04 | Cryptographic Failures | Secrets hardcodes, hashing faible, PII en clair, Math.random |
| A05 | Injection | SQL, XSS, command, SSRF, template, header injection |
| A06 | Insecure Design | Rate limiting, brute force, enumeration, validation serveur |
| A07 | Authentication Failures | Session fixation, token expiration, password policy, OAuth state |
| A08 | Software and Data Integrity | Deserialization, SRI, CI/CD, auto-update |
| A09 | Security Logging Failures | Auth events non logues, PII dans les logs, alerting |
| A10 | Mishandling of Exceptional Conditions | catch vides, erreurs silencieuses, error boundaries |

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

Corriger par ordre de severite : CRITICAL > HIGH > MEDIUM > LOW.
Pour chaque finding CRITICAL/HIGH : test de reproduction, fix minimal, verification, micro-commit.

> **Reference complete** : [`references/remediation-patterns.md`](references/remediation-patterns.md) — patterns de remediation Next.js, regles de remediation, process detaille.

> **Gate 3** : chaque finding CRITICAL/HIGH a un test de reproduction et un fix verifie. Les tests existants passent.

---

## Phase 4 — HARDEN (defense en profondeur)

Au-dela des findings, verifier les couches de defense structurelles : headers de securite, validation Zod sur toutes les entrees, variables d'environnement securisees, dependencies auditees.

> **Reference complete** : [`references/remediation-patterns.md`](references/remediation-patterns.md) — checklists headers, validation, env, dependencies.

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

## Regles absolues (non negociables)

1. **10 categories, pas 9** — Chaque categorie OWASP est verifiee. Sauter une categorie "non pertinente" est exactement la ou les failles se cachent.
2. **CWE obligatoire** — Chaque finding a un identifiant CWE. Pas de "c'est pas bien" sans reference.
3. **Test de reproduction** — Chaque fix CRITICAL/HIGH a un test qui prouve que la vulnerabilite existait et est corrigee.
4. **Fix pur** — Un fix de securite ne contient QUE le fix. Pas de refactoring, pas de feature, pas de cleanup.
5. **Moindre privilege** — Chaque permission, acces, token a la portee MINIMALE necessaire.
6. **Defense en profondeur** — Jamais une seule couche. Validation client + serveur. Auth middleware + route check. Headers + CSP.
7. **Secrets = zero trust** — Aucun secret dans le code, les logs, les URLs, le local storage. Jamais.

---

## Integration avec les autres skills

| Contexte | Integration |
|----------|-------------|
| `/hora-forge` | La phase EXAMINE de Forge inclut deja un scan securite. hora-security va plus loin (10 categories completes). |
| `/hora-refactor` | Apres un refactoring, relancer hora-security sur le scope modifie. |
| `/hora-design` | Les choix design impactent la securite (CSP pour inline styles, CORS pour fonts externes). |
