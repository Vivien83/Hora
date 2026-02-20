---
name: hora-parallel-research
description: Recherche multi-angles simultanee HORA. USE WHEN parallel research, hora research, compare, benchmark, evalue, quelles sont les, what are the best.
---

# Skill: hora-parallel-research

Recherche multi-angles simultanee. Chaque researcher couvre un angle different, synthesizer agrege.

## Invocation

```
/hora-parallel-research "sujet a rechercher"
```

## Protocol

### 1. Decomposition des angles
Identifie 3-5 angles de recherche complementaires et non-redondants.

Exemples pour "choisir une base de donnees" :
- Angle 1 : Performance et scalabilite
- Angle 2 : Ecosysteme et tooling
- Angle 3 : Cout et licensing
- Angle 4 : Cas d'usage similaires au projet

### 2. AUDIT (ghost failures)
Avant de dispatcher les researchers, verifier :
- Angles redondants ou avec overlap significatif ? (gaspillage d'agents)
- Sources potentiellement biaisees ou contradictoires ?
- Hypotheses non verifiees sur la disponibilite/qualite des sources ?
- Risque de synthese superficielle si trop d'angles (profondeur vs couverture) ?

Si ghost failure critique → reduire ou ajuster les angles avant dispatch.
Si aucun → documenter pourquoi.

### 3. Dispatch (researcher x N)
Lance un agent researcher par angle via Task :

```
Task: "Tu es un researcher couvrant l'angle [X] sur le sujet [Y].
Recherche uniquement sur cet angle. Produis un output structure
avec findings, sources, points cles, et limites."
```

### 4. Agregation (synthesizer)
Une fois tous les researchers termines, passe leurs outputs a synthesizer.

### 5. Rapport final

```
## Research — [sujet]

Angles couverts : N
Sources consultees : ~X

[Output du synthesizer]

## Sources primaires
[liste des sources les plus importantes]
```

## Quand l'utiliser

- Comparaison technologique (framework A vs B vs C)
- Due diligence avant decision technique
- Veille sur un domaine nouveau
- Analyse de marche ou de concurrents
