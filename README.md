# HORA
### Hybrid Orchestrated Reasoning Architecture

> Systeme d'IA personnel auto-apprenant pour Claude Code.
> Vierge au depart. Se construit a l'usage. Aucun template a remplir.

---

## Philosophie

**HORA** fusionne le meilleur de [PAI](https://github.com/danielmiessler/Personal_AI_Infrastructure) et [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) en un systeme natif Claude Code, sans dependances runtime externes.

| Inspiration PAI | Inspiration OMC | Apport Hora |
|---|---|---|
| Memoire persistante | Multi-agents paralleles | Auto-apprentissage silencieux |
| Algorithm OBSERVE→VERIFY | Routing Haiku/Sonnet/Opus | Self-bootstrapping (0 config) |
| Hooks lifecycle | Skills/commands | Natif Claude Code, 0 plugin |
| Securite allow/deny/ask | Agents specialises | Vierge → riche par l'usage |

---

## Installation

```bash
git clone https://github.com/Vivien83/Hora.git
cd Hora
bash install.sh
```

**Prerequis** : Claude Code + Node.js 18+ + tsx + jq

Le script installe `tsx` automatiquement s'il est absent. Pour jq : `brew install jq` (macOS) ou `apt install jq` (Linux).

### Ce que fait install.sh

1. **Sauvegarde** les donnees Claude Code existantes (sessions, todos, history, credentials)
2. **Cree** l'arborescence `~/.claude/` (MEMORY/, hooks/, agents/, skills/, .hora/)
3. **Merge** CLAUDE.md (preserve le contenu existant, insere le bloc HORA entre marqueurs)
4. **Merge** settings.json (supprime les hooks PAI s'ils existent, fusionne sans ecraser les hooks tiers)
5. **Copie** hooks, agents, skills, patterns de securite, statusline
6. **Preserve** le profil MEMORY/ s'il est deja rempli (ne remet pas a zero)
7. **Verifie** l'integrite des donnees Claude apres installation

En cas d'erreur : `bash install.sh --restore` restaure le backup.

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
| BLOQUE | Operation interdite | `rm -rf /`, `gh repo delete`, `diskutil eraseDisk` |
| CONFIRMER | Demande a l'utilisateur | `git push --force`, `DROP TABLE`, `terraform destroy` |
| ALERTE | Logue mais autorise | `curl \| bash`, `sudo`, `chmod 777` |

**Chemins proteges :**

| Type | Effet | Exemples |
|---|---|---|
| zeroAccess | Aucun acces | `~/.ssh/id_*`, `credentials.json`, `.env.production` |
| readOnly | Lecture seule | `/etc/**` |
| confirmWrite | Ecriture = confirmation | `settings.json`, `.env`, `~/.zshrc` |
| noDelete | Suppression interdite | `hooks/`, `skills/`, `.hora/`, `.git/` |

Patterns personnalisables dans `~/.claude/.hora/patterns.yaml`.

### 2. Extraction de lecons (SessionEnd)

A la fin de chaque session significative (3+ messages) :

- **Profil** : extrait identite, projets, preferences, langages (regex sur messages user)
- **Erreurs** : detecte erreurs, blocages, corrections (contexte 5 lignes)
- **Sentiment** : analyse le ton (score 1-5)
- **Archive** : resume de session + 5000 premiers chars du transcript

Tout dans `MEMORY/` — jamais de lecons perdues.

### 3. Continuite cross-session

Le systeme de **thread persistence** maintient la conversation entre sessions :

- Chaque message utilisateur est sauvegarde en attente (`pending`)
- En fin de session, la derniere reponse assistant est resumee
- Au prochain prompt, les deux sont apparies dans un historique continu
- Hora injecte automatiquement les 10 derniers echanges + les 3 dernieres sessions

Resultat : Hora se souvient de ce qu'on faisait et le mentionne des le premier message.

### 4. Nommage automatique des sessions

Le premier prompt de chaque session genere un nom deterministe (2-3 mots) :

```
"Refonte page conges" → "Refonte Conges Session"
"Fix the login bug"   → "Login Session"
```

Pas d'inference IA — extraction par regex rapide. Stocke dans `MEMORY/STATE/session-names.json`.

### 5. Snapshots pre-edit

Chaque Write/Edit/MultiEdit sauvegarde le fichier AVANT modification.
Fonctionne avec ou sans git. Filet de securite universel.

- Manifest append-only (JSONL) : `.hora/snapshots/manifest.jsonl`
- Fichiers : `.hora/snapshots/YYYY-MM-DD/HH-MM-SS-mmm_fichier.ext.bak`
- Limites : 100 derniers snapshots, max 5 Mo par fichier, skip binaires

### 6. Backup automatique

Le hook `backup-monitor` surveille les modifications et declenche un backup :

- **Seuils** : 15 min ecoulees avec fichiers modifies, ou 3+ fichiers dans la session
- **Remote** : commit + push sur branche miroir `hora/backup/[branche]`
- **Local** (fallback) : bundle git dans `.hora/backups/` (10 derniers gardes)
- **Cooldown** : 30s entre checks complets

### 7. Statusline

Barre de statut riche affichee en bas de Claude Code (637 lignes, 3 modes responsive) :

```
-- | HORA | -------------------------
 CONTEXTE : [gradient bar] XX%  | Xm
 USAGE : 5H: XX% (reset Xh) | WK: XX%
 GIT : branch | ~/path | Modif:X Nouv:X | Backup: R Xmin
 COMMITS : [mark] hash subject (x3)
 SNAP: X proteges | MODELE : name
--------------------------------------
```

**Donnees affichees :**
- Contexte window avec barre gradient (emeraude → or → terracotta → rose)
- Usage API Anthropic 5h et 7 jours (via OAuth, cache 60s)
- Branche git, chemin projet, fichiers modifies/staged/non-suivis
- 3 derniers commits (vert = pushed, orange = non pushed)
- Etat backup (strategie R/L, anciennete, alerte si >20 min)
- Nombre de snapshots proteges, modele actif

### 8. Routing intelligent

Le hook `prompt-submit` detecte les intentions dans le message et suggere le skill adapte :

| Mots detectes | Suggestion |
|---|---|
| refactor, refonte, migration, v2 | `/hora:parallel-code` |
| compare, analyse, recherche | `/hora:parallel-research` |
| planifie, architecture, roadmap | `/hora:plan` |

Detection aussi des nouveaux projets (mots-cles "from scratch", "refonte") avec suggestion de branche.

### 9. Spinner verbs personnalises

50 messages en francais au lieu des generiques Claude Code :
"Reflexion profonde", "Cartographie du code", "Tissage des liens", "Delegation aux agents"...

### 10. Tool usage logging

Chaque utilisation d'outil est logguee silencieusement dans `MEMORY/.tool-usage.jsonl` pour analytics (nom de l'outil, timestamp, session).

### 11. Context Checkpoint System (anti-compact)

Quand Claude Code compresse le contexte (compaction), Hora detecte et recupere automatiquement :

```
[Avant compact]  statusline ecrit context % → hook stocke 85%
[Compact]        Claude Code compresse → contexte tombe a ~20%
[Recovery]       hook detecte chute >40pts → injecte checkpoint + activity log
```

**Composants :**

| Composant | Role |
|---|---|
| `statusline.sh` | Persiste `context-pct.txt` (ecriture atomique, >0 seulement) |
| `context-checkpoint.ts` | PreToolUse: detecte compact, injecte recovery via `additionalContext` |
| `prompt-submit.ts` | A 70% contexte, demande a Claude d'ecrire un checkpoint semantique |
| `MEMORY/WORK/checkpoint.md` | Checkpoint semantique (objectif, etat, decisions, prochaines etapes) |

**Ghost failures adresses :** faux positifs au demarrage (GF-2), changement de session (GF-3), checkpoints stale (GF-4), race conditions (GF-6), double injection (GF-11), fichier absent (GF-12).

---

## Skills

| Commande | Usage |
|---|---|
| `/hora:plan "objectif"` | Planification OBSERVE→THINK→PLAN + ISC verifiables |
| `/hora:autopilot "objectif"` | Execution autonome bout en bout (ne s'arrete pas avant que tous les ISC soient valides) |
| `/hora:parallel-code "tache"` | Architect decompose, executors en parallele, reviewer global |
| `/hora:parallel-research "sujet"` | 3-5 angles, researchers en parallele, synthesizer agrege |
| `/hora:backup` | Sauvegarde immediate (delegue a l'agent backup) |

Les skills se declenchent aussi en **langage naturel** — Hora detecte l'intention.

---

## Agents

| Agent | Modele | Role |
|---|---|---|
| architect | Opus | Decisions structurelles, design systeme, propose 2-3 options |
| executor | Sonnet | Implementation, debug, refactoring (modifications chirurgicales) |
| researcher | Sonnet | Recherche multi-sources, analyse, documentation |
| reviewer | Haiku | Review rapide, verdict PASS/FAIL, severite Critical/Warning/OK |
| synthesizer | Haiku | Agregation multi-sources, elimination des doublons |
| backup | Haiku | Backup git silencieux (branche miroir ou bundle local) |

---

## Structure du repo

```
hora/
+-- README.md
+-- install.sh                 <- Script d'installation (~/.claude/)
+-- .gitignore
+-- .hora/                     <- Etat runtime du projet (ignore par git)
+-- claude/                    <- SOURCE — tout ce qui est deploye dans ~/.claude/
    +-- CLAUDE.md              <- Algorithm central (The Brain)
    +-- settings.json          <- Hooks + statusLine + spinnerVerbs
    +-- statusline.sh          <- Barre de statut (637 lignes, 3 modes)
    +-- .hora/
    |   +-- patterns.yaml      <- Regles de securite (17 blocked, 18 confirm, 6 alert)
    +-- hooks/                 <- 8 hooks TypeScript lifecycle
    |   +-- snapshot.ts        <- PreToolUse: sauvegarde avant edit
    |   +-- hora-security.ts   <- PreToolUse: validation securite (parseur YAML custom)
    |   +-- tool-use.ts        <- PreToolUse: logging silencieux
    |   +-- context-checkpoint.ts <- PreToolUse: detection compact + recovery
    |   +-- backup-monitor.ts  <- PostToolUse: detection + execution backup
    |   +-- prompt-submit.ts   <- UserPromptSubmit: contexte + routing + thread + checkpoint reminder
    |   +-- hora-session-name.ts <- UserPromptSubmit: nommage auto
    |   +-- session-end.ts     <- Stop: extraction profil + lecons + sentiment
    +-- agents/                <- 6 agents specialises
    |   +-- architect.md       <- Opus : architecture, design systeme
    |   +-- executor.md        <- Sonnet : implementation, debug
    |   +-- researcher.md      <- Sonnet : recherche, analyse
    |   +-- reviewer.md        <- Haiku : review, validation
    |   +-- synthesizer.md     <- Haiku : agregation multi-sources
    |   +-- backup.md          <- Haiku : backup git
    +-- skills/                <- 5 skills principaux
    |   +-- plan.md            <- /hora:plan
    |   +-- autopilot.md       <- /hora:autopilot
    |   +-- parallel-code.md   <- /hora:parallel-code
    |   +-- parallel-research.md <- /hora:parallel-research
    |   +-- backup.md          <- /hora:backup
    +-- MEMORY/                <- Memoire persistante (vierge au depart)
        +-- PROFILE/           <- identity.md, projects.md, preferences.md, vocabulary.md
        +-- LEARNING/
        |   +-- FAILURES/      <- Erreurs et lecons extraites
        |   +-- ALGORITHM/     <- Sentiments et patterns
        |   +-- SYSTEM/        <- Problemes techniques
        +-- SESSIONS/          <- Archives de sessions
        +-- SECURITY/          <- Audit trail securite
        +-- STATE/             <- Etat courant (session-names, thread-state)
        +-- WORK/              <- Travaux en cours
```

---

## Hooks lifecycle

```
UserPromptSubmit
  +-- prompt-submit.ts         (injection MEMORY/, routing hints, thread continuity)
  +-- hora-session-name.ts     (nommage de session au 1er prompt)

PreToolUse
  +-- snapshot.ts              (Write|Edit|MultiEdit — sauvegarde fichier avant edit)
  +-- hora-security.ts         (Bash|Edit|Write|Read|MultiEdit — validation securite)
  +-- tool-use.ts              (* — logging silencieux)
  +-- context-checkpoint.ts    (* — detection compact + injection recovery)

PostToolUse
  +-- backup-monitor.ts        (Write|Edit|MultiEdit — detection + backup auto)

Stop
  +-- session-end.ts           (extraction profil + erreurs + sentiment + archive)

SubagentStop
  +-- session-end.ts --subagent (skip extraction pour les sous-agents)
```

---

## Comment fonctionne l'apprentissage

```
Session 1 : vierge -> 3 questions -> MEMORY/PROFILE/ commence a se remplir
Session 2 : contexte recharge -> Hora sait qui tu es + ce qu'on faisait
Session N : profil riche + historique -> reponses de plus en plus pertinentes
```

**Tout est silencieux.** Hora n'interrompt pas ton flow.

---

## Architecture technique

### Zero dependances runtime

Tous les hooks utilisent uniquement les built-ins Node.js (fs, path, crypto). Le parseur YAML de `hora-security.ts` est custom. Aucun `npm install` requis au runtime — seul `tsx` est necessaire pour executer le TypeScript.

### Fail-safe

Chaque hook wrappe sa logique dans try/catch et sort `exit 0` en cas d'erreur. Les hooks ne bloquent **jamais** Claude Code, meme si un fichier est manquant ou corrompu.

### Deferred pairing

Les hooks ne voient pas simultanément le message user et la reponse assistant. Le systeme contourne cette limitation :
1. `prompt-submit.ts` sauvegarde le message user au moment du prompt
2. `session-end.ts` sauvegarde le resume assistant en fin de session
3. Au prochain prompt, les deux sont apparies dans l'historique continu

### macOS-specifique

La statusline extrait le token OAuth depuis le macOS Keychain (`security find-generic-password`) pour l'API usage Anthropic. Les commandes `stat` ont des fallbacks macOS.

---

## Comparaison

| Critere | PAI | OMC | **HORA** |
|---|---|---|---|
| Setup initial | Templates a remplir | Plugin a configurer | **Aucun — 3 questions** |
| Memoire long terme | Riche | Basique | **Auto-construite** |
| Securite | Allow/deny/ask | Aucune | **Defense en couches + audit** |
| Continuite cross-session | Non | Non | **Thread persistence** |
| Learning extraction | A chaque session | Non | **Profil + erreurs + sentiment** |
| Session naming | IA inference | Non | **Deterministe rapide** |
| Statusline | Non | Non | **Riche (contexte, git, usage API, backup)** |
| Compact recovery | Non | Non | **Auto-detection + checkpoint injection** |
| Multi-agents | Oui | Oui (focus) | **Oui (6 agents, 3 modeles)** |
| Routing modeles | Non | Oui | **Oui (Opus/Sonnet/Haiku)** |
| Dependances | Bun, plugin PAI | Plugin OMC | **tsx uniquement** |
| Spinner custom | 696 verbes EN | Non | **50 verbes FR** |

---

## Personnalisation

### Regles de securite

Edite `~/.claude/.hora/patterns.yaml` pour ajouter/modifier les patterns bloques, a confirmer ou en alerte.

### Spinner verbs

Edite la section `spinnerVerbs` dans `~/.claude/settings.json`.

### Agents

Modifie les fichiers dans `~/.claude/agents/`. Chaque `.md` definit le modele, les outils autorises et le protocol.

### Skills

Modifie les fichiers dans `~/.claude/skills/`. Chaque skill suit le format OBSERVE → PLAN → BUILD → VERIFY.

---

## License

MIT — Libre, open-source, forever.
