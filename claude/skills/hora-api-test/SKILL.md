---
name: hora-api-test
description: Automated API endpoint testing — scans routes, generates requests, validates responses against Zod schemas. Use when user says api test, test endpoints, test routes, validate API, test API, integration test API. Do NOT use for unit tests — use hora-forge. Do NOT use for browser testing — use hora-browser.
metadata:
  author: HORA
  version: 1.0.0
compatibility: Claude Code. Works with Next.js App Router and Express/Hono APIs. Cross-platform.
---

# Skill: hora-api-test

> "Un endpoint non teste est un endpoint casse que personne n'a encore remarque."

Scan automatique des routes API, generation de requetes de test, validation des reponses contre les schemas Zod. Detecte les routes mortes, les erreurs silencieuses et les reponses mal typees.

## Invocation

```
/hora-api-test <mode> [options]
```

| Mode | Description |
|------|-------------|
| `scan` | Liste toutes les routes API detectees dans le projet |
| `run` | Teste toutes les routes (ou une route specifique) |
| `run /api/users` | Teste uniquement le endpoint `/api/users` |
| `stress` | Test de charge basique (requetes sequentielles rapides) |

| Flag | Description |
|------|-------------|
| `--base-url` | URL de base (defaut: `http://localhost:3000`) |
| `--timeout` | Timeout par requete en ms (defaut: 5000) |
| `--count` | Nombre de requetes pour le mode stress (defaut: 50) |
| `--header` | Header additionnel (repetable) |

---

## Protocol

### Phase 1 — SCAN

1. Executer `scripts/scan-routes.ts` sur le projet
2. Detecter toutes les routes dans `app/api/` (Next.js App Router)
3. Pour chaque route : HTTP methods exportees, params dynamiques, presence de validation Zod
4. Afficher le rapport de scan

### Phase 2 — GENERATE

Pour chaque route detectee :
1. Determiner le type de requete (GET = pas de body, POST/PUT/PATCH = body necessaire)
2. Si un schema Zod est detecte, generer un payload conforme
3. Si pas de schema, generer un payload generique minimal
4. Preparer les headers (Content-Type, Authorization si detecte)

### Phase 3 — RUN

Pour chaque requete generee :
1. Executer via `scripts/test-endpoint.ts`
2. Mesurer le temps de reponse
3. Valider : status code, Content-Type, structure JSON
4. Si schema Zod disponible : valider la reponse contre le schema
5. Collecter les resultats

### Phase 4 — REPORT

Generer un rapport JSON :
```json
{
  "timestamp": "2026-02-28T12:00:00Z",
  "baseUrl": "http://localhost:3000",
  "total": 12,
  "passed": 10,
  "failed": 2,
  "routes": [
    {
      "path": "/api/users",
      "method": "GET",
      "status": 200,
      "timing": 45,
      "passed": true,
      "validation": "schema_match"
    }
  ]
}
```

---

## Exemples

### 1. Scanner les routes d'un projet Next.js

```
/hora-api-test scan
```

Sortie : liste de toutes les routes avec methodes, params et validation.

### 2. Tester un endpoint specifique

```
/hora-api-test run /api/users --header 'Authorization: Bearer test-token'
```

Teste GET /api/users avec le header d'auth, mesure le temps de reponse, valide la structure.

### 3. Test de charge basique

```
/hora-api-test stress /api/health --count 100
```

Envoie 100 requetes sequentielles a /api/health, mesure les temps min/max/avg/p95.

---

## Scripts

| Script | Usage |
|--------|-------|
| `scripts/scan-routes.ts` | `npx tsx scripts/scan-routes.ts [project-dir]` |
| `scripts/test-endpoint.ts` | `npx tsx scripts/test-endpoint.ts <url> [--method POST] [--body '{}'] [--header 'K: V']` |

---

## Troubleshooting

### Le scan ne trouve aucune route
- Verifier que le projet utilise Next.js App Router (`app/api/` et non `pages/api/`)
- Verifier que les fichiers s'appellent `route.ts` ou `route.js`
- Verifier que les methodes HTTP sont exportees (pas de default export)

### Les tests echouent avec ECONNREFUSED
- Le serveur de dev doit tourner (`npm run dev` ou `next dev`)
- Verifier le port avec `--base-url http://localhost:PORT`
- Verifier que le firewall n'est pas en cause

### Timeout sur certaines routes
- Augmenter le timeout avec `--timeout 10000`
- Les routes avec acces DB peuvent etre lentes en dev
- Verifier que la DB est accessible

---

## Regles

1. **Scan avant run** — Toujours scanner d'abord pour comprendre la surface API
2. **Serveur actif requis** — Le mode `run` necessite un serveur en cours d'execution
3. **Pas de mutations en prod** — Ne jamais executer POST/PUT/DELETE contre un environnement de production
4. **Validation optionnelle** — Si pas de schema Zod, on teste quand meme status + structure basique
