---
name: hora-dashboard
description: Dashboard visuel HORA pour visualiser sessions, sentiment, usage outils, profil et knowledge graph. Use when user says dashboard, hora dashboard, visualiser, stats, sessions, sentiment, voir memoire, graph. Do NOT use for memory chat or data export — use MEMORY/ files directly.
metadata:
  author: HORA
  version: 1.0.0
compatibility: Claude Code only. Requires Node.js, tsx, and ~/.claude/dashboard/ installed.
---

# Skill: hora-dashboard

Lance le dashboard visuel HORA pour visualiser l'etat interne du systeme.

## Invocation

```
/hora-dashboard
```

## Lancement

```bash
cd ~/.claude/dashboard
npx tsx scripts/collect-data.ts && npm run dev
```

Ouvre ensuite : http://localhost:3847

## Ce que le dashboard affiche

- **Stats** : nombre de sessions, sentiment moyen, snapshots, etat du backup
- **Profil utilisateur** : identity, projets, preferences extraits de MEMORY/PROFILE/
- **Sessions recentes** : tableau avec nom, date, sentiment colore, SID
- **Evolution du sentiment** : graphe lineaire Recharts (1 = positif, 5 = tendu)
- **Usage des outils** : top 10 des outils les plus utilises (BarChart)
- **Knowledge graph** : carte neuronale interactive des entites et faits
- **Memory diff** : comparaison avant/apres des changements memoire
- **Session replay** : relecture des transcripts de sessions passees
- **Hook telemetry** : heatmap et sparklines d'utilisation des hooks

## Prerequis

- Node.js installe
- `tsx` disponible (installe par HORA — sinon : `npm install -g tsx`)
- Dependances : `cd ~/.claude/dashboard && npm install`

## Rafraichir les donnees

Les donnees sont statiques (generees par `collect-data.ts`).
Relancer la commande pour mettre a jour.

## Examples

Example 1: Lancer le dashboard
```
User: "montre moi le dashboard"
→ Claude lance collect-data.ts puis npm run dev
→ Affiche le lien http://localhost:3847
```

Example 2: Verifier le sentiment
```
User: "comment se sont passees mes sessions recemment ?"
→ Lance le dashboard, pointe vers l'onglet sentiment
```

## Troubleshooting

Error: "Cannot find module tsx"
Cause: tsx not installed globally
Solution: `npm install -g tsx`

Error: "ENOENT data.json"
Cause: collect-data.ts not run before dev server
Solution: Always run `npx tsx scripts/collect-data.ts` before `npm run dev`

Error: Port 3847 already in use
Cause: Previous dashboard instance still running
Solution: `lsof -ti:3847 | xargs kill` then retry

## Architecture

```
~/.claude/dashboard/
  scripts/collect-data.ts   # Lit MEMORY/ → produit public/data.json
  public/data.json          # Donnees statiques
  src/
    App.tsx                 # Layout principal
    StatCard.tsx            # Cartes de stats
    SessionsTable.tsx       # Tableau des sessions
    SentimentChart.tsx      # LineChart sentiment
    ToolUsageChart.tsx      # BarChart outils
    NeuralMemoryMap.tsx     # Knowledge graph interactif
    MemoryDiff.tsx          # Diff avant/apres memoire
    SessionReplay.tsx       # Relecture de sessions
    HookTelemetry.tsx       # Heatmap hooks
    MemoryChat.tsx          # Chat avec la memoire
    types.ts                # Types TypeScript
```
