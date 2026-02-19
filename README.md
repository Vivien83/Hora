# HORA
### Hybrid Orchestrated Reasoning Architecture

> Systeme d'IA personnel auto-apprenant pour Claude Code.
> Vierge au depart. Se construit a l'usage. Aucun template a remplir.

---

## Philosophie

**HORA** fusionne le meilleur de [PAI](https://github.com/danielmiessler/Personal_AI_Infrastructure) et [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) en un systeme natif Claude Code, sans dependances externes.

| Inspiration PAI | Inspiration OMC | Apport Hora |
|---|---|---|
| Memoire persistante | Multi-agents paralleles | Auto-apprentissage silencieux |
| Algorithm OBSERVE→VERIFY | Routing Haiku/Sonnet/Opus | Self-bootstrapping (0 config) |
| Hooks lifecycle | Skills/commands | Natif Claude Code, 0 plugin |
| Securite allow/deny/ask | Agents specialises | Vierge → riche par l'usage |

---

## Installation

```bash
git clone https://github.com/[ton-user]/hora.git
cd hora
bash install.sh
```

**Prerequis** : Claude Code + Node.js 18+ + jq

---

## Demarrage

Lance Claude Code normalement :

```bash
claude
```

**Premiere session** : Hora pose 3 questions minimales, ensuite il apprend seul.

**Sessions suivantes** : le contexte accumule est injecte automatiquement.

---

## Features

### 1. Securite (defense en couches)

Protection automatique de chaque operation via le hook `hora-security.ts`.

```
Couche 1 : L'IA demande confirmation (proactif)
Couche 2 : Le hook valide et bloque (filet de securite)
Couche 3 : Audit trail complet (MEMORY/SECURITY/)
```

**Niveaux :**

| Niveau | Action | Exemples |
|---|---|---|
| BLOQUE | Operation interdite | `rm -rf /`, `gh repo delete` |
| CONFIRMER | Demande a l'utilisateur | `git push --force`, `DROP TABLE` |
| ALERTE | Logue mais autorise | `curl \| bash`, `sudo` |

Patterns personnalisables dans `~/.claude/.hora/patterns.yaml`.

### 2. Extraction de lecons (SessionEnd)

A la fin de chaque session significative :

- **Profil** : extrait identite, projets, preferences
- **Erreurs** : detecte erreurs, blocages, corrections
- **Sentiment** : analyse le ton (1-5)
- **Archive** : resume de session

Tout dans `MEMORY/LEARNING/` — jamais de lecons perdues.

### 3. Nommage automatique des sessions

Le premier prompt de chaque session genere un nom 2-3 mots :

```
"Refonte page congés" → "Refonte Conges Session"
"Fix the login bug"   → "Login Session"
```

Stocke dans `MEMORY/STATE/session-names.json`.

### 4. Snapshots pre-edit

Chaque Write/Edit/MultiEdit sauvegarde le fichier AVANT modification.
Fonctionne avec ou sans git. Filet de securite universel.

### 5. Backup automatique

Le hook `backup-monitor` detecte quand un backup est necessaire :
- **Remote** : commit + push sur branche miroir `hora/backup/[branche]`
- **Local** : bundle git dans `.hora/backups/`

### 6. Spinner verbs personnalises

50 messages en francais au lieu des generiques Claude Code :
"Reflexion profonde", "Cartographie du code", "Tissage des liens"...

---

## Skills

| Commande | Usage |
|---|---|
| `/hora:plan "objectif"` | Planification + ISC avant execution |
| `/hora:autopilot "objectif"` | Execution autonome bout en bout |
| `/hora:parallel-code "tache"` | Multi-agents sur codebase |
| `/hora:parallel-research "sujet"` | Recherche multi-angles simultanee |
| `/hora:backup` | Sauvegarde immediate |

Les skills se declenchent aussi en **langage naturel** — Hora detecte l'intention.

---

## Agents

| Agent | Modele | Role |
|---|---|---|
| architect | Opus | Decisions structurelles, design systeme |
| executor | Sonnet | Implementation, debug, refactoring |
| researcher | Sonnet | Recherche, analyse, documentation |
| reviewer | Haiku | Review rapide, validation |
| synthesizer | Haiku | Agregation multi-sources |
| backup | Haiku | Backup git automatique |

---

## Structure `~/.claude/`

```
~/.claude/
+-- CLAUDE.md              <- Algorithm central (The Brain)
+-- settings.json          <- Hooks + spinnerVerbs
|
+-- .hora/
|   +-- patterns.yaml      <- Regles de securite (personnalisable)
|   +-- snapshots/         <- Sauvegardes pre-edit
|   +-- backups/           <- Bundles git locaux
|
+-- MEMORY/
|   +-- PROFILE/           <- Profil appris (vierge au depart)
|   |   +-- identity.md
|   |   +-- projects.md
|   |   +-- preferences.md
|   |   +-- vocabulary.md
|   +-- LEARNING/
|   |   +-- FAILURES/      <- Erreurs et lecons extraites
|   |   +-- ALGORITHM/     <- Sentiments et patterns
|   |   +-- SYSTEM/        <- Problemes techniques
|   +-- SESSIONS/          <- Archives de sessions
|   +-- SECURITY/          <- Audit trail securite
|   +-- STATE/             <- Etat courant (noms de sessions, etc.)
|   +-- WORK/              <- Travaux en cours
|
+-- hooks/                 <- 7 hooks lifecycle TypeScript
|   +-- snapshot.ts        <- PreToolUse: sauvegarde avant edit
|   +-- hora-security.ts   <- PreToolUse: validation securite
|   +-- tool-use.ts        <- PreToolUse: observation des outils
|   +-- backup-monitor.ts  <- PostToolUse: detection backup
|   +-- prompt-submit.ts   <- UserPromptSubmit: contexte + routing
|   +-- hora-session-name.ts <- UserPromptSubmit: nommage auto
|   +-- session-end.ts     <- Stop: extraction lecons + profil
|
+-- agents/                <- 6 agents specialises
+-- skills/                <- 5 skills principaux
```

---

## Hooks lifecycle

```
UserPromptSubmit
  +-- prompt-submit.ts       (contexte MEMORY, routing hints, suggestion branche)
  +-- hora-session-name.ts   (nommage de session au 1er prompt)

PreToolUse
  +-- snapshot.ts            (sauvegarde avant Write/Edit/MultiEdit)
  +-- hora-security.ts       (validation securite Bash/Edit/Write/Read)
  +-- tool-use.ts            (observation/logging)

PostToolUse
  +-- backup-monitor.ts      (detection + execution backup git)

Stop
  +-- session-end.ts         (extraction profil + lecons + sentiment)
```

---

## Comment fonctionne l'apprentissage

```
Session 1 : vierge -> 3 questions -> MEMORY/PROFILE/ commence a se remplir
Session 2 : contexte recharge -> Hora sait qui tu es
Session N : profil riche -> reponses de plus en plus pertinentes
```

**Tout est silencieux.** Hora n'interrompt pas ton flow.

---

## Comparaison

| Critere | PAI | OMC | **HORA** |
|---|---|---|---|
| Setup initial | Templates a remplir | Plugin a configurer | **Aucun — 3 questions** |
| Memoire long terme | Riche | Basique | **Auto-construite** |
| Securite | Allow/deny/ask | Aucune | **Defense en couches** |
| Learning extraction | A chaque session | Non | **Erreurs + sentiment** |
| Session naming | IA inference | Non | **Deterministe rapide** |
| Multi-agents | Oui | Oui (focus) | **Oui** |
| Routing modeles | Non | Oui | **Oui** |
| Dependances | Bun, plugin PAI | Plugin OMC | **Aucune** |
| Spinner custom | 696 verbes | Non | **50 verbes FR** |

---

## Personnalisation

### Regles de securite

Edite `~/.claude/.hora/patterns.yaml` pour ajouter/modifier les patterns.

### Spinner verbs

Edite la section `spinnerVerbs` dans `~/.claude/settings.json`.

### Agents

Copie et modifie les fichiers dans `~/.claude/agents/`.

### Skills

Copie et modifie les fichiers dans `~/.claude/skills/`.

---

## License

MIT — Libre, open-source, forever.
