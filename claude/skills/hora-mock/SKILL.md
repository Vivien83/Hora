---
name: hora-mock
description: Instant mock API server — scan existing routes and generate a mock server with realistic fake data. Use when user says mock, mock server, fake API, mock API, stub, dev server, frontend without backend, test API. Do NOT use for production API — this generates fake data only. Do NOT use for API testing — use hora-api-test.
metadata:
  author: HORA
  version: 1.0.0
compatibility: Claude Code. Next.js App Router / Pages Router / Express / Hono. Node.js 18+. Cross-platform.
---

# Skill: hora-mock

> "Ton frontend n'a pas a attendre que le backend existe."

Scan automatique des routes API du projet, generation de handlers mock avec donnees realistes, serveur HTTP local avec hot-reload. Frontend debloque instantanement.

## Invocation

```
/hora-mock <commande> [options]
```

| Commande | Description |
|----------|-------------|
| `scan [dir]` | Scanne le projet et liste les routes detectees |
| `start` | Lance le serveur mock (necessite un scan prealable) |
| `stop` | Arrete le serveur mock en cours |

| Flag | Defaut | Description |
|------|--------|-------------|
| `--port` | `4000` | Port du serveur mock |
| `--delay` | `0` | Latence artificielle par requete (ms) |
| `--error-rate` | `0` | Taux d'erreurs aleatoires 500 (0.0 a 1.0) |
| `--dir` | `.` | Repertoire du projet a scanner |

---

## Protocol

### Phase 1 — SCAN

1. Executer `scripts/scan-api.ts` sur le repertoire du projet
2. Detecter les routes selon le framework :
   - **Next.js App Router** : `app/**/route.ts` ou `app/**/route.js`
   - **Next.js Pages Router** : `pages/api/**/*.ts` ou `pages/api/**/*.js`
   - **Express / Hono** : grep `app.get(`, `app.post(`, `router.get(`, etc.
3. Pour chaque route : extraire path, methodes HTTP, presence de schema Zod
4. Afficher le rapport de scan sur stderr

### Phase 2 — CONFIGURE

Pour chaque route detectee :
1. Si schema Zod trouve dans le fichier → extraire la forme
2. Sinon → utiliser le shape generique `{ data: [], message: "OK" }`
3. Preparer les handlers mock avec generation de donnees

### Phase 3 — GENERATE

Generer les reponses mock :
- `string` → lorem ipsum court
- `number` → entier aleatoire 1-1000
- `boolean` → aleatoire
- `date` → ISO 8601 recent
- `id` / `_id` → UUID-like string
- `email` → `user@example.com`
- `name` → prenom nom genere
- `url` → `https://example.com/...`
- `array` → 3 items du type de base

### Phase 4 — SERVE

1. Executer `scripts/mock-server.ts`
2. Monter tous les handlers detectes
3. Endpoints speciaux :
   - `GET /__hora/routes` — liste les routes mockees
   - `POST /__hora/stop` — arrete proprement le serveur
4. CORS active par defaut
5. Ecrire l'etat dans `/tmp/hora-mock-session.json`
6. Logger chaque requete sur stderr

---

## Exemples

### 1. Scanner et demarrer un mock Next.js

```
/hora-mock scan
/hora-mock start --port 4000
```

Detecte toutes les routes dans `app/api/`, monte un serveur mock sur `http://localhost:4000`.
Le frontend peut maintenant pointer `NEXT_PUBLIC_API_URL=http://localhost:4000`.

### 2. Simuler la lenteur reseau

```
/hora-mock start --delay 800 --port 4001
```

Chaque reponse arrive apres 800ms — ideal pour tester les loading states et les skeletons.

### 3. Tester la resilience frontend

```
/hora-mock start --error-rate 0.3 --port 4002
```

30% des requetes retournent HTTP 500. Verifie que ton frontend gere les erreurs proprement.

---

## Scripts

| Script | Usage |
|--------|-------|
| `scripts/scan-api.ts` | `npx tsx scripts/scan-api.ts [project-dir]` |
| `scripts/mock-server.ts` | `npx tsx scripts/mock-server.ts [--port 4000] [--delay 0] [--error-rate 0]` |

---

## Troubleshooting

### Le scan ne trouve aucune route
- Next.js App Router : les fichiers doivent s'appeler `route.ts` ou `route.js`
- Next.js Pages Router : verifier que `pages/api/` existe
- Express/Hono : verifier que les patterns `app.get(` ou `router.get(` sont dans les fichiers scannes
- Essayer avec `--dir src/` ou `--dir app/`

### Port deja utilise
- Changer le port avec `--port 4001`
- Verifier avec `lsof -i :4000` (macOS/Linux) ou `netstat -ano | findstr 4000` (Windows)
- Stopper un mock precedent avec `/hora-mock stop`

### Les donnees generees ne correspondent pas aux types attendus
- Ajouter un schema Zod dans le fichier de route — hora-mock l'utilisera automatiquement
- Voir `GET /__hora/routes` pour inspecter les shapes detectes

---

## Regles

1. **Scan avant start** — Toujours scanner d'abord pour voir ce qui sera mocke
2. **Dev uniquement** — Ne jamais exposer le mock server en dehors de localhost
3. **Pas de mutation de donnees** — Les POST/PUT/DELETE renvoient un succes fake, rien n'est stocke
4. **CORS ouvert** — Le mock accepte toutes les origines par design (dev only)
