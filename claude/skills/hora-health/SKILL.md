# /hora-health — System Health Check

> Diagnostic complet du systeme HORA en une commande.

## Trigger

`/hora-health`

## Protocol

### 1. Collect Data

Executer le script de diagnostic :

```bash
npx tsx ~/.claude/skills/hora-health/health-check.ts
```

Le script retourne un JSON structure sur stdout contenant toutes les metriques.

### 2. Checks effectues

| # | Check | Source | Criticite |
|---|-------|--------|-----------|
| 1 | **Memory Tiers** | `getMemoryHealth()` via `memory-tiers.ts` | haute |
| 2 | **Knowledge Graph stats** | `HoraGraph.getStats()` via `knowledge-graph.ts` | haute |
| 3 | **Embeddings manquants** | Scan entities/facts avec `embedding: null` apres chargement binaire | moyenne |
| 4 | **Integrite JSONL** | Parse ligne par ligne de `entities.jsonl`, `facts.jsonl`, `episodes.jsonl` | haute |
| 5 | **Hooks enregistres** | Verification dans `~/.claude/settings.json` | haute |
| 6 | **Sous-repertoires MEMORY/** | PROFILE, INSIGHTS, LEARNING, STATE, SESSIONS, GRAPH, SECURITY | moyenne |
| 7 | **Fraicheur project-knowledge.md** | Age en jours du fichier (>7j = warning) | basse |
| 8 | **Disk usage MEMORY/** | Taille totale en MB | info |

### 3. Report

Afficher le rapport au format suivant :

```
| HORA | Health Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Memory Tiers:  T1: X items (YKB) | T2: X items (YKB) | T3: X items (YKB)
Graph:         X entities | Y facts | Z% embedded
Embeddings:    X missing (entities: Y, facts: Z)
JSONL:         ✓ All valid  OR  ✗ X errors found
Hooks:         ✓ N/N registered  OR  ✗ missing: [list]
Directories:   ✓ N/N present  OR  ✗ missing: [list]
Last GC:       Xh ago  OR  ⚠ Never run
Proj Knowledge: ✓ Fresh (Xd)  OR  ⚠ Stale (Xd)  OR  ✗ Not found
Disk:          X.XX MB total
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Alerts:        ⚠ list of issues found
```

### 4. Fix Suggestions

Pour chaque alerte detectee, proposer une action corrective :

| Alerte | Action |
|--------|--------|
| Embeddings manquants | Lancer le script d'auto-embed via le dashboard plugin ou `npx tsx /tmp/embed-new.ts` |
| JSONL corrompu | Identifier la ligne defaillante, la retirer ou la corriger |
| Hook manquant | Verifier `~/.claude/settings.json` et relancer `install.sh` |
| GC jamais execute | Lancer manuellement : `npx tsx -e "import {runMemoryLifecycle} from '~/.claude/hooks/lib/memory-tiers.js'; runMemoryLifecycle(process.env.HOME + '/.claude/MEMORY')"` |
| project-knowledge stale | Lancer `/hora-parallel-code` pour un audit frais |
| Repertoire MEMORY/ manquant | Creer le repertoire manquant avec `mkdir -p` |
| T2 surcharge | Le GC devrait s'en occuper ; sinon forcer avec `expireT2()` |

### 5. Mode silencieux

Le script supporte un flag `--json` (par defaut) pour l'integration programmatique.
Claude parse le JSON et affiche le rapport formate.

## Architecture

```
~/.claude/skills/hora-health/
  SKILL.md              # Ce fichier — protocol du skill
  health-check.ts       # Script executable, retourne JSON sur stdout
```

## Dependances

- `tsx` (installe par HORA)
- `~/.claude/hooks/lib/memory-tiers.ts` — getMemoryHealth()
- `~/.claude/hooks/lib/knowledge-graph.ts` — HoraGraph
- `~/.claude/settings.json` — hooks registres
- `~/.claude/MEMORY/` — donnees memoire
