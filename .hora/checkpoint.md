---
session: 86b5164c
timestamp: 2026-02-25T09:33:33.688Z
context_pct: 80
---
# Objectif en cours
Dashboard HORA v2 — Thread History enrichi + filtrage projet

# Etat actuel
- Thread filtré par projet courant (32 entrées au lieu de 50 mélangées)
- Composant compact : 2 entrées/groupe, expandable, groupé par session
- Noms sessions, sentiment, newlines préservés
- Toutes les sessions visibles sans scroll excessif

# Decisions prises
- Filtrage projet dans collectAll() : garder entries du projet + entries sans projet (backward compat)
- Max 2 entrées visibles par groupe, bouton expand
- MAX_USER_SUMMARY 200, MAX_THREAD_ENTRIES 20

# Prochaines etapes
- Commit + push
- Mémoire court/moyen/long terme (demande user en attente)
