# Audit : HORA (Hybrid Orchestrated Reasoning Architecture)
> Derniere mise a jour : 2026-02-25

## Architecture

HORA est un meta-framework auto-apprenant pour Claude Code. Il transforme un outil stateless en assistant intelligent avec memoire persistante, securite en couches, et automatisation par hooks/skills.

### Structure
```
hora 2/
├── README.md                    # 51KB documentation complete
├── install.sh                   # 34KB installer bash (backup verse, PAI cleanup)
├── install.ps1                  # 6.9KB PowerShell entry point (Windows)
├── claude/
│   ├── CLAUDE.md                # 18KB instructions globales (injecte au startup)
│   ├── settings.json            # Config hooks + statusline
│   ├── statusline.sh            # 34KB status temps reel (context%, git, usage)
│   ├── hooks/                   # 19 hooks TypeScript (3677 LOC)
│   │   ├── prompt-submit.ts     # 810 LOC — injection MEMORY + thread au startup
│   │   ├── session-end.ts       # 861 LOC — extraction profil, sentiment, erreurs
│   │   ├── hora-security.ts     # 563 LOC — defense en couches (PreToolUse)
│   │   ├── backup-monitor.ts    # 445 LOC — detection backup necessaire
│   │   ├── context-checkpoint.ts # 239 LOC — recovery apres compaction
│   │   ├── doc-sync.ts          # 202 LOC — suivi changements structurels
│   │   ├── snapshot.ts          # 206 LOC — snapshots project-scoped
│   │   ├── librarian-check.ts   # 108 LOC — validation library-first
│   │   ├── hora-session-name.ts # 183 LOC — nommage auto sessions
│   │   └── tool-use.ts          # 53 LOC — telemetrie outils
│   ├── agents/                  # 7 protocoles de routage (md)
│   ├── skills/                  # 13 workflows parametres (SKILL.md)
│   └── dashboard/               # React 19 + Vite 6 + Recharts
│       ├── src/                 # 12 composants + plugin HMR + hook useHoraData
│       └── lib/collectors.ts    # Collecte centralisee MEMORY + .hora/
└── .hora/                       # Etat project-scoped
    ├── project-id               # UUID stable
    ├── backup-state.json        # Strategie + dernier backup
    └── snapshots/               # manifest.jsonl + fichiers .bak
```

### Philosophie
- **Zero deps runtime** : hooks utilisent uniquement Node.js stdlib + tsx
- **Security-first** : 3 couches (IA proactive + hook validation + audit trail)
- **Library-first** : jamais recoder ce qui existe en librairie maintenue
- **Session isolation** : fichiers scopes par session (sid8), pas de cross-contamination
- **Project-scoped** : chaque projet a son propre .hora/ (snapshots, backup, knowledge)

## Stack

| Couche | Technologie | Version |
|---|---|---|
| Installation | Bash + PowerShell | Cross-platform |
| Hooks runtime | Node.js 18+ + tsx | TypeScript strict |
| Dashboard | React 19 + Vite 6 + Recharts 2.15 | chokidar 5 (HMR) |
| Tests | Vitest | session-paths.test.ts |
| Shell | Bash (statusline.sh) | macOS/Linux/Windows |

## Failles identifiees

| # | Severite | Description | Impact | Solution | Status |
|---|---|---|---|---|---|
| 1 | **critique** | Race condition sur manifest.jsonl (snapshots) — sessions concurrentes peuvent corrompre l'index | Perte de snapshots silencieuse | File locking (flock Unix / mutex Windows) ou manifests per-session | OUVERT |
| 2 | **critique** | Checkpoint stale si 2 compactions en <30min — le 2eme relit le checkpoint du 1er | Code incorrect injecte apres compaction | Verifier session_id dans le checkpoint, pas juste le timestamp | OUVERT |
| 3 | **haute** | Backup-monitor detecte des fichiers modifies d'une session precedente → faux positifs | Backups inutiles, bruit dans les logs | Tracker les modifications per-session (hash baseline) | OUVERT |
| 4 | **haute** | Doc-sync injecte "audit recommende" meme pour des changements triviaux | Pollution du contexte, fausse urgence | Guard : ne declencher la staleness note qu'une fois par session | OUVERT |
| 5 | **haute** | Tous les hooks silent-exit sur erreurs parse/fs (`try {} catch {}`) | Bugs invisibles, impossible a debugger | Logging structure vers MEMORY/SECURITY/ + stderr en mode DEBUG | OUVERT |
| 6 | **haute** | Settings merge (install.sh) ne valide pas l'existence des fichiers hook references | Hooks fantomes preserves silencieusement | Verifier chaque commande hook → fichier existe avant merge | OUVERT |
| 7 | **moyenne** | Parseur YAML regex dans hora-security.ts — fragile, pas de validation schema | Pattern de securite potentiellement bypasse | Utiliser js-yaml ou valider le schema a l'installation | OUVERT |
| 8 | **moyenne** | Pas de coordination entre hooks concurrents (snapshot + backup + doc-sync) | I/O redondant (multiple git status), pas de shared state | Store de session partage ou hook primaire qui broadcast | OUVERT |
| 9 | **moyenne** | Snapshot cleanup inline bloque l'execution du hook si manifest volumineux | Timeout hook, outil bloque | Cleanup async en background ou lazy au prochain demarrage | OUVERT |
| 10 | **moyenne** | session-end hook extrait des "failures" en matchant le mot "error" dans le texte | Faux positifs massifs dans LEARNING/FAILURES/ | Detecter les patterns user-only ("j'ai une erreur") pas le texte assistant | **CORRIGE** — 9 patterns conversationnels FR/EN, user-only, skip code blocks, type correction ajouté |
| 11 | **basse** | Tests hooks incomplets — seul session-paths.test.ts a une couverture correcte | Regressions non detectees | Ajouter tests : snapshot cleanup, doc-sync transitions, checkpoint | OUVERT |
| 12 | **basse** | Statusline lit les credentials a chaque invocation (pas de cache session) | Latence, acces Keychain frequent | Cache token en session avec TTL | OUVERT |

## Dette technique

- **Parseur YAML custom** dans hora-security.ts : a remplacer par une lib validee
- **Logging silencieux** : tous les hooks swallow les erreurs → ajouter structured logging
- **Tests d'integration** : hooks individuels testes mais pas les interactions
- **Dashboard data collection** : reactive (chokidar + HMR). collectors.ts lit JSONL en priorite, fallback legacy .md. session-end.ts produit du JSONL fiable (failures-log.jsonl)
- **Statusline** : 34KB bash monolithique, profiling necessaire pour garantir <100ms

## Points positifs

| Force | Evidence |
|---|---|
| **Architecture securite 3 couches** | IA proactive + hook validation + audit trail. patterns.yaml extensible. |
| **Zero deps runtime** | Hooks = Node.js stdlib uniquement. Surface d'attaque minimale. |
| **Session isolation** | Fichiers scopes par sid8(), test suite valide. Pas de cross-contamination. |
| **Cross-platform** | install.sh + install.ps1 + statusline.sh couvrent macOS/Linux/Windows nativement. |
| **Snapshots project-scoped** | Chaque projet a son historique. Manifest + cleanup atomique. |
| **Extraction profil intelligente** | Hybride env + linguistique avec attribution de source. |
| **Checkpoint recovery** | Detection compaction + injection checkpoint = prevention perte de travail. |
| **Dashboard temps reel** | chokidar + HMR + fallback polling. Zero commande supplementaire. |
| **Documentation** | README 51KB, SKILL.md standardise, agents/*.md explicites. |
| **Conventions solides** | Library-first, Zod partout, TypeScript strict, design intentionnel. |
