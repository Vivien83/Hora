---
name: hora-parallel-research
description: Multi-angle simultaneous research — each researcher covers a different angle, synthesizer aggregates. Use when user says parallel research, hora research, compare, benchmark, evaluate, what are the best, quelles sont les, due diligence. Do NOT use for single-source lookup — use WebSearch directly. Do NOT use for code exploration — use hora-parallel-code instead.
metadata:
  author: HORA
  version: 2.0.0
compatibility: Claude Code. Spawns researcher and synthesizer agents.
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

## Examples

Example 1: Technology comparison
```
User: "/hora-parallel-research Next.js vs Remix vs Nuxt pour un SaaS B2B"
→ 4 angles : performance, DX, ecosystem, production readiness
→ 4 researchers en parallele
→ Synthesizer: tableau comparatif + recommendation argumentee
```

Example 2: Library evaluation
```
User: "/hora-parallel-research meilleure lib de charts pour React"
→ 3 angles : features/API, performance/bundle size, community/maintenance
→ 3 researchers
→ Synthesizer: shortlist avec pros/cons + recommendation
```

Example 3: Due diligence technique
```
User: "/hora-parallel-research est-ce que Drizzle est pret pour la prod"
→ 3 angles : stabilite/bugs connus, adoption/temoignages, alternatives
→ Synthesizer: verdict argumente avec sources
```

## Quand l'utiliser

- Comparaison technologique (framework A vs B vs C)
- Due diligence avant decision technique
- Veille sur un domaine nouveau
- Analyse de marche ou de concurrents

## Troubleshooting

Problem: Researchers return redundant information
Cause: Angles too similar or poorly defined
Solution: Ensure each angle has a unique focus — overlap < 20%

Problem: Synthesizer produces shallow summary
Cause: Too many angles (> 5) dilute depth
Solution: Limit to 3-4 angles for deeper coverage

Problem: Research takes too long
Cause: Researchers doing excessive web searches
Solution: Set clear scope boundaries in the dispatch prompt
