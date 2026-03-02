# HORA Securite (defense en couches)

Protection automatique via `hora-security.ts` (PreToolUse).
Patterns dans `.hora/patterns.yaml`.

## Couches
1. **L'IA** utilise AskUserQuestion pour ops dangereuses (proactif)
2. **Le hook** valide et bloque si l'IA oublie (filet)
3. **Audit** : evenements logues dans `MEMORY/SECURITY/`

## Severite
| Niveau | Action | Exemples |
|---|---|---|
| **BLOQUE** | exit 2 | `rm -rf /`, `gh repo delete` |
| **CONFIRMER** | prompt user | `git push --force`, `DROP TABLE` |
| **ALERTE** | logue | `curl \| bash`, `sudo` |

## Chemins proteges
| Type | Effet | Exemples |
|---|---|---|
| zeroAccess | Aucun acces | `~/.ssh/id_*`, `credentials.json` |
| readOnly | Lecture seule | `/etc/**` |
| confirmWrite | Ecriture = confirm | `settings.json`, `.env` |
| noDelete | Delete interdit | `hooks/`, `skills/`, `.git/` |
