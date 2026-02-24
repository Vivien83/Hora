# Skill : /hora-dashboard

Lance le dashboard visuel HORA pour visualiser l'etat interne du systeme.

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

## Prerequis

- Node.js installe
- `tsx` disponible (installe par HORA — sinon : `npm install -g tsx`)
- Dependances : `cd ~/.claude/dashboard && npm install`

## Rafraichir les donnees

Les donnees sont statiques (generees par `collect-data.ts`).
Relancer la commande pour mettre a jour.

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
    types.ts                # Types TypeScript
```
