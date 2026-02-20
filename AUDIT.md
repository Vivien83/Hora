# HORA — Contexte pour audit

## Qu'est-ce que Hora ?

Hora est une infrastructure personnelle pour Claude Code, installee dans `~/.claude/`.
C'est une infrastructure native pour Claude Code, legere et auto-apprenante.

Objectif : transformer Claude Code en assistant personnel auto-apprenant,
avec memoire persistante entre sessions, hooks intelligents, securite integree et statusline de monitoring.

---

## Structure des fichiers

```
~/.claude/
+-- CLAUDE.md                    <- Instructions systeme chargees a chaque session
+-- settings.json                <- Configuration Claude Code (hooks + statusLine + spinnerVerbs)
+-- statusline.sh                <- Script bash affiche en bas de Claude Code
+-- .hora/
|   +-- patterns.yaml            <- Regles de securite (personnalisable)
|   +-- snapshots/               <- Sauvegardes pre-edit (manifest.jsonl + .bak)
|   +-- backups/                 <- Bundles git locaux
+-- MEMORY/
|   +-- PROFILE/                 <- Profil utilisateur (identity, projects, preferences, vocabulary)
|   +-- LEARNING/
|   |   +-- FAILURES/            <- Erreurs et lecons extraites par session
|   |   +-- ALGORITHM/           <- Sentiments et patterns comportementaux
|   |   +-- SYSTEM/              <- Problemes techniques
|   +-- SESSIONS/                <- Resumes de sessions passees
|   +-- SECURITY/                <- Audit trail des operations de securite
|   +-- STATE/                   <- Etat courant (session-names.json, session-state.json)
|   +-- WORK/                    <- Travaux en cours / contexte projets
+-- hooks/
|   +-- snapshot.ts              <- PreToolUse (Write|Edit|MultiEdit) : sauvegarde avant modification
|   +-- hora-security.ts         <- PreToolUse (Bash|Edit|Write|Read|MultiEdit) : validation securite
|   +-- tool-use.ts              <- PreToolUse (*) : observation/logging des outils
|   +-- backup-monitor.ts        <- PostToolUse (*) : surveille modifications, backup auto
|   +-- prompt-submit.ts         <- UserPromptSubmit : injecte MEMORY/, routing hints, suggestion branche
|   +-- hora-session-name.ts     <- UserPromptSubmit : nommage automatique de session
|   +-- session-end.ts           <- Stop : extraction profil + lecons + sentiment + archive
+-- agents/
|   +-- architect.md             <- Agent architecture systeme (opus)
|   +-- executor.md              <- Agent implementation / debug (sonnet)
|   +-- researcher.md            <- Agent recherche / analyse (sonnet)
|   +-- reviewer.md              <- Agent review rapide (haiku)
|   +-- synthesizer.md           <- Agent agregation multi-sources (haiku)
|   +-- backup.md                <- Agent git backup (haiku)
+-- skills/
    +-- plan.md                  <- /hora:plan — planification avec ISC
    +-- autopilot.md             <- /hora:autopilot — execution autonome multi-etapes
    +-- parallel-code.md         <- /hora:parallel-code — codebase multi-agents
    +-- parallel-research.md     <- /hora:parallel-research — recherche multi-angles
    +-- backup.md                <- /hora:backup — sauvegarde git immediate
```

---

## Architecture des hooks (settings.json)

```
UserPromptSubmit
  +-- prompt-submit.ts           (contexte MEMORY/ si 1er message + routing hints)
  +-- hora-session-name.ts       (nommage de session au 1er prompt)

PreToolUse
  +-- snapshot.ts                (Write|Edit|MultiEdit — sauvegarde fichier avant edit)
  +-- hora-security.ts           (Bash|Edit|Write|Read|MultiEdit — validation securite)
  +-- tool-use.ts                (* — observation/logging)

PostToolUse
  +-- backup-monitor.ts          (Write|Edit|MultiEdit — surveillance backup)

Stop
  +-- session-end.ts             (extraction profil + erreurs + sentiment + archive)

SubagentStop
  +-- session-end.ts --subagent  (skip extraction pour les sous-agents)

statusLine
  +-- statusline.sh              (barre de contexte + timer + etat backup)
```

---

## Systeme de securite (hora-security.ts)

### Architecture
Le hook `hora-security.ts` valide chaque operation Bash/Edit/Write/Read/MultiEdit
AVANT execution, en utilisant les patterns definis dans `.hora/patterns.yaml`.

### Niveaux
| Niveau | Sortie hook | Effet |
|---|---|---|
| BLOQUE | exit(2) | Operation interdite, loguee |
| CONFIRMER | `{"decision":"ask","message":"..."}` | Prompt utilisateur |
| ALERTE | `{"continue":true}` + log | Autorise, loguee |
| AUTORISE | `{"continue":true}` | Silencieux |

### Patterns (`.hora/patterns.yaml`)
- **bash.blocked** : `rm -rf /`, `diskutil eraseDisk`, `gh repo delete`
- **bash.confirm** : `git push --force`, `DROP TABLE`, `terraform destroy`
- **bash.alert** : `curl | bash`, `sudo`, `chmod 777`
- **paths.zeroAccess** : `~/.ssh/id_*`, `credentials.json`
- **paths.readOnly** : `/etc/**`
- **paths.confirmWrite** : `settings.json`, `.env`
- **paths.noDelete** : `hooks/`, `skills/`, `.git/`

### Audit trail
Chaque evenement non-allow est logue dans :
`MEMORY/SECURITY/YYYY/MM/security-{slug}-{timestamp}.jsonl`

---

## Systeme de learning (session-end.ts)

### Declenchement
A chaque Stop, si `messageCount >= 3` et extraction pas deja faite pour cette session.

### Extractions
1. **Profil** : regex sur messages user (nom, domaine, langages, frameworks)
   → `MEMORY/PROFILE/{identity,projects,preferences}.md`
2. **Erreurs** : detection de patterns error/failure/blocage/correction dans tout le transcript
   → `MEMORY/LEARNING/FAILURES/YYYY-MM/{timestamp}_{slug}.md`
3. **Sentiment** : score 1-5 base sur mots positifs/negatifs dans les messages user
   → `MEMORY/LEARNING/ALGORITHM/YYYY-MM/{timestamp}_LEARNING_sentiment-rating-{N}.md`
4. **Archive** : resume avec metadata + 5000 premiers chars du transcript
   → `MEMORY/SESSIONS/{timestamp}_{sessionId}.md`

---

## Session auto-naming (hora-session-name.ts)

### Declenchement
UserPromptSubmit — premier prompt uniquement (skip si session deja nommee).

### Algorithme
1. Nettoie le prompt (supprime UUIDs, chemins, URLs, tags XML)
2. Filtre les mots-cles (>= 4 lettres, pas dans la liste de bruit FR/EN)
3. Prend les 2-3 premiers mots substantiels
4. Capitalise en Topic Case
5. Stocke dans `MEMORY/STATE/session-names.json`

### Pas d'inference IA
Choix delibere : extraction deterministe pour eviter la latence et les dependances.

---

## Ce qui fonctionne

- [x] Install script (install.sh) avec backup/restore des sessions Claude
- [x] Nettoyage automatique des hooks tiers lors de l'installation
- [x] Merge intelligent de settings.json (pas d'ecrasement des hooks existants)
- [x] statusline.sh connecte via le mecanisme natif Claude Code
- [x] CLAUDE.md avec section securite, learning, session naming
- [x] Snapshots pre-edit (sauvegarde avant Write/Edit/MultiEdit)
- [x] Backup automatique (remote git ou bundle local)
- [x] Securite defense en couches (blocked/confirm/alert)
- [x] Extraction de lecons en fin de session
- [x] Nommage automatique des sessions
- [x] Spinner verbs francais (50 messages)

## Contraintes importantes

- Hooks doivent etre **rapides** (< 5s) sinon Claude Code timeout
- `system_reminder` en JSON stdout = visible dans le contexte Claude
- Texte brut stdout sur hook `Stop` = capture par Claude Code, non affiche
- `stderr` = affiche dans le terminal mais pas dans l'interface
- `npx tsx` = interpreteur TypeScript sans compilation
- La memoire doit rester **legere** : injection bornee a ~1500 chars max au total
- `exit(2)` dans PreToolUse = blocage dur de l'operation
- `{"decision":"ask","message":"..."}` = prompt utilisateur avant execution
