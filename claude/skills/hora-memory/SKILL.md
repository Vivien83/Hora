# /hora-memory — Memory Update & Management

> Mise a jour complete de toute la memoire HORA en une commande.

## Trigger

`/hora-memory` ou `/memory`

## Protocol

### 1. Diagnostic rapide

Executer le health check pour connaitre l'etat actuel :

```bash
npx tsx ~/.claude/skills/hora-memory/scripts/memory-update.ts --check
```

Afficher un resume de l'etat memoire (tiers, graph, embeddings, dernier GC).

### 2. Update complet

Executer la mise a jour complete :

```bash
npx tsx ~/.claude/skills/hora-memory/scripts/memory-update.ts --update
```

Le script execute dans l'ordre :

| # | Action | Librairie | Effet |
|---|--------|-----------|-------|
| 1 | **Expire T2** | `memory-tiers.expireT2()` | Archive sessions >30j, tronque logs |
| 2 | **Promote T3** | `memory-tiers.promoteToT3()` | Cristallise patterns, recurring failures |
| 3 | **Graph build** | `graph-builder.buildGraphFromSession()` | Extrait entites/faits de la session courante |
| 4 | **Expire facts** | `activation-model` | Oublie les faits avec activation < -2.0 |
| 5 | **Dream cycle** | `dream-cycle.runDreamCycle()` | Consolide episodes recents en patterns |
| 6 | **Auto-embed** | `embeddings.embedBatch()` | Genere les embeddings manquants |
| 7 | **Save** | `HoraGraph.save()` | Sauvegarde atomique du graph |

### 3. Sous-commandes

| Commande | Description |
|----------|-------------|
| `--check` | Diagnostic rapide (lecture seule) |
| `--update` | Mise a jour complete (defaut) |
| `--embed` | Generer les embeddings manquants uniquement |
| `--gc` | Garbage collection T2 uniquement |
| `--dream` | Dream cycle uniquement |
| `--graph` | Rebuild graph depuis la session courante uniquement |
| `--repair` | Valider et reparer les JSONL corrompus |

### 4. Report

Afficher le rapport au format HORA :

```
| HORA | Memory Update
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1/7] Expire T2           ✓ 3 sessions archivees, sentiment tronque a 90j
[2/7] Promote T3          ✓ 2 patterns cristallises, 1 failure recurrente
[3/7] Graph build         ✓ +5 entites, +8 faits, 1 episode
[4/7] Expire facts        ✓ 2 faits oublies (activation < -2.0)
[5/7] Dream cycle         ✓ 3 episodes consolides, 1 pattern distille
[6/7] Auto-embed          ✓ 12 embeddings generes (384-dim MiniLM-L6-v2)
[7/7] Save                ✓ Graph sauvegarde (entities: 47, facts: 89)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Memoire a jour. Prochaine maintenance automatique dans ~6h.
```

### 5. Quand utiliser

- **Apres un long travail** — pour forcer la consolidation sans attendre la fin de session
- **Apres un git pull** — pour regenerer les embeddings et consolider
- **Debug memoire** — pour voir l'etat et reparer les problemes
- **Avant une demo** — pour s'assurer que le graph est a jour

## Architecture

```
~/.claude/skills/hora-memory/
  SKILL.md                    # Ce fichier — protocol du skill
  scripts/
    memory-update.ts          # Script principal, retourne JSON sur stdout
```

## Dependances

- `tsx` (installe par HORA)
- `~/.claude/hooks/lib/memory-tiers.ts` — expireT2, promoteToT3, getMemoryHealth
- `~/.claude/hooks/lib/knowledge-graph.ts` — HoraGraph
- `~/.claude/hooks/lib/graph-builder.ts` — buildGraphFromSession
- `~/.claude/hooks/lib/dream-cycle.ts` — runDreamCycle
- `~/.claude/hooks/lib/embeddings.ts` — embed, embedBatch, disposeEmbedder
- `~/.claude/hooks/lib/activation-model.ts` — computeActivation, shouldExpire
- `~/.claude/MEMORY/` — donnees memoire
