# Skill: parallel-research

Recherche multi-angles simultanée. Chaque researcher couvre un angle différent, synthesizer agrège.

## Invocation

```
/hora:parallel-research "sujet à rechercher"
```

## Protocol

### 1. Décomposition des angles
Identifie 3-5 angles de recherche complémentaires et non-redondants.

Exemples pour "choisir une base de données" :
- Angle 1 : Performance et scalabilité
- Angle 2 : Ecosystème et tooling
- Angle 3 : Coût et licensing
- Angle 4 : Cas d'usage similaires au projet

### 2. Dispatch (researcher × N)
Lance un agent researcher par angle via Task :

```
Task: "Tu es un researcher couvrant l'angle [X] sur le sujet [Y].
Recherche uniquement sur cet angle. Produis un output structuré
avec findings, sources, points clés, et limites."
```

### 3. Agrégation (synthesizer)
Une fois tous les researchers terminés, passe leurs outputs à synthesizer.

### 4. Rapport final

```
## Research — [sujet]

Angles couverts : N
Sources consultées : ~X

[Output du synthesizer]

## Sources primaires
[liste des sources les plus importantes]
```

## Quand l'utiliser

- Comparaison technologique (framework A vs B vs C)
- Due diligence avant décision technique
- Veille sur un domaine nouveau
- Analyse de marché ou de concurrents
