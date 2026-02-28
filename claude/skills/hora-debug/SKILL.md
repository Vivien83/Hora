---
name: hora-debug
description: Error analysis and root cause finding — parse stack traces, trace through code, identify root cause, suggest fixes. Use when user says debug, error, stack trace, crash, bug, exception, trace, root cause, why does this fail, what went wrong. Do NOT use for performance debugging — use hora-perf. Do NOT use for browser debugging — use hora-browser.
metadata:
  author: HORA
  version: 1.0.0
compatibility: Claude Code. TypeScript/JavaScript stack traces. Node.js / React / Next.js. Cross-platform.
---

# Skill: hora-debug

> "La plupart des bugs ne sont pas la ou ils semblent etre. Le stack trace pointe le symptome, pas la cause."

Analyse automatique des erreurs et stack traces : parsing, localisation dans le code, trace du flux d'execution, identification de la root cause, suggestion de fix minimal.

## Invocation

```
/hora-debug <mode> [options]
```

| Mode | Description |
|------|-------------|
| `analyze "<error>"` | Analyse directe du texte d'erreur ou stack trace passe en argument |
| `analyze --file <log.txt>` | Analyse depuis un fichier de log |
| `analyze --stdin` | Lit l'erreur depuis stdin (pipe-friendly) |

| Flag | Description |
|------|-------------|
| `--project` | Chemin du projet (defaut: `.`) |
| `--json` | Sortie JSON brute sur stdout |
| `--context` | Lignes de contexte autour de chaque frame (defaut: 5) |

---

## Protocol

### Phase 1 — PARSE

1. Executer `scripts/analyze-error.ts` avec le texte d'erreur
2. Extraire : type d'erreur, message, stack frames (fichier, ligne, colonne, fonction)
3. Formats supportes : Node.js, V8, React component stack, Next.js webpack-internal

### Phase 2 — LOCATE

Pour chaque frame du stack :
1. Resoudre le chemin relatif au projet (`--project`)
2. Verifier l'existence du fichier
3. Ignorer les frames `node_modules/`, `webpack-internal:///`, `<anonymous>`
4. La deepest frame dans le projet = candidat root cause

### Phase 3 — TRACE

Pour chaque frame resolu :
1. Lire les lignes autour de l'erreur (N lignes avant/apres, configurable via `--context`)
2. Construire le flux d'execution frame par frame
3. Identifier la variable ou valeur qui a provoque l'erreur

### Phase 4 — ANALYZE

Identifier la root cause :
- Quelle hypothese a echoue ? (null check manquant, type inattendu, async non attendu)
- Quel est le premier frame dans le projet qui a declenche l'erreur ?
- Pattern matching sur les messages d'erreur connus

### Phase 5 — FIX

Suggerer le fix minimal avec before/after :
- Une suggestion par pattern d'erreur reconnu
- Si pattern inconnu : pointer vers le rootCauseFrame et expliquer le flux

---

## Formats d'erreur supportes

| Format | Exemple |
|--------|---------|
| Node.js standard | `at functionName (file.ts:12:5)` |
| V8 anonymous | `at Object.<anonymous> (file.js:3:1)` |
| React component | `The above error occurred in the <MyComponent> component:` |
| Next.js webpack | `at eval (webpack-internal:///./src/app/page.tsx:15:10)` |
| TypeScript runtime | `TypeError: Cannot read properties of undefined (reading 'map')` |
| Unhandled rejection | `UnhandledPromiseRejectionWarning: ...` |

---

## Exemples

### 1. Analyser une erreur inline

```
/hora-debug analyze "TypeError: Cannot read properties of undefined (reading 'map')
    at UserList (src/components/UserList.tsx:23:18)
    at renderWithHooks (node_modules/react-dom/...)
    at mountIndeterminateComponent (...)"
```

Identifie que `users` est `undefined` a la ligne 23 de UserList.tsx, lit le contexte, suggere un null check ou un default value.

### 2. Analyser depuis un fichier de log

```
/hora-debug analyze --file ./error.log --project /path/to/my-app
```

Lit `error.log`, parse toutes les erreurs, analyse la premiere stack trace trouvee.

### 3. Pipe depuis une commande

```
npm run dev 2>&1 | npx tsx scripts/analyze-error.ts --stdin --project .
```

Capture la sortie de `npm run dev`, detecte automatiquement les stack traces.

---

## Scripts

| Script | Usage |
|--------|-------|
| `scripts/analyze-error.ts` | `npx tsx scripts/analyze-error.ts "<error text>" [--project dir] [--context N] [--file path] [--stdin]` |

---

## Troubleshooting

### "No frames found in project"

- Le stack trace pointe uniquement vers `node_modules/` ou du code builded
- Verifier que le projet utilise des source maps (`sourceMap: true` dans tsconfig.json)
- Pour Next.js : lancer en mode dev (`npm run dev`) pour avoir les stack traces avec les chemins source

### Le rootCauseFrame est faux

- Les stack traces minifiees n'ont pas de noms de fonctions
- Utiliser `--context 10` pour avoir plus de contexte autour du frame
- En Next.js prod : activer `productionBrowserSourceMaps: true` dans next.config

### L'analyse ne reconnait pas le format

- Coller l'erreur complete (type + message + stack), pas juste le message
- Les erreurs sans stack trace (ex: erreurs de validation Zod) : copier le `ZodError` complet avec le champ `.issues`

---

## Regles

1. **Root cause, pas symptome** — Toujours pointer le frame le plus profond dans le projet, pas le premier frame
2. **Contexte avant fix** — Lire le code avant de suggerer un fix. Pas de fix sur hypothese.
3. **Fix minimal** — Suggerer le changement le plus petit qui resout le probleme. Pas de refactor.
4. **Signaler les ambiguites** — Si plusieurs root causes possibles, les lister toutes avec leur probabilite
