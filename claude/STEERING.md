# HORA — Steering Rules

12 regles obligatoires. Injectees en rotation (3 par message, 12 au premier).

---

## 1. Lire avant d'ecrire
**Bad**: Modifier un fichier sans l'avoir lu → bugs, duplications, regressions.
**Correct**: Toujours Read/Glob/Grep les fichiers concernes AVANT tout Edit/Write.

## 2. Chercher l'existant (SSOT)
**Bad**: Creer une nouvelle fonction `formatDate()` alors qu'il en existe deja une dans `utils/`.
**Correct**: Grep le codebase pour l'existant. Si ca existe → reutiliser. Si presque → etendre.

## 3. Library-first
**Bad**: Coder un debounce custom, un date formatter, un drag-and-drop maison.
**Correct**: Verifier npm/libraries d'abord. Si >80% du besoin couvert → utiliser la lib.

## 4. Auditer les ghost failures
**Bad**: Coder une integration API sans verifier ce qui se passe en cas de timeout ou 500.
**Correct**: Avant de coder, lister les hypotheses. Chaque hypothese non verifiee = ghost failure potentiel.

## 5. Un commit = un changement logique
**Bad**: Un commit qui ajoute une feature + fix un bug + refactor un composant.
**Correct**: Separer en commits atomiques. Chaque commit est revertable independamment.

## 6. Pas de silent failures
**Bad**: `try { ... } catch {}` sans rien logger ni remonter.
**Correct**: Chaque erreur est soit loguee, soit remontee, soit explicitement ignoree avec commentaire.

## 7. Langue de l'utilisateur
**Bad**: Repondre en anglais a un utilisateur francophone.
**Correct**: Detecter la langue du message et repondre dans la meme langue. Francais par defaut si MEMORY confirme.

## 8. Ne pas sur-commenter
**Bad**: `const name = "John"; // Set the name to John`
**Correct**: Le code parle. Commenter uniquement quand le "pourquoi" n'est pas evident.

## 9. Preferer le reversible
**Bad**: `DROP TABLE users;` sans backup prealable.
**Correct**: Toujours verifier si l'operation est reversible. Si non → demander confirmation.

## 10. Ne pas inventer de donnees
**Bad**: "D'apres votre profil, vous preferez React" alors que MEMORY/ est vide.
**Correct**: Si l'info n'est pas dans MEMORY/ → ne pas supposer. Poser la question.

## 11. Securite > Vitesse
**Bad**: Skipper la validation d'input pour aller plus vite.
**Correct**: Toujours valider les entrees (Zod). Rate limiting sur les endpoints publics. Jamais de raccourcis securite.

## 12. Minimal footprint
**Bad**: Refactorer 10 fichiers quand seuls 2 sont concernes par la demande.
**Correct**: Modifier uniquement le scope demande. Ne pas "ameliorer" le code adjacent non demande.
