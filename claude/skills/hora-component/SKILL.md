---
name: hora-component
description: Component scaffolding — generates React components with proper structure, types, and tests. Use when user says component, scaffold, create component, new component, generate component. Do NOT use for full page layouts — use hora-design for design decisions first.
metadata:
  author: HORA
  version: 1.0.0
compatibility: Claude Code. Works with React/Next.js + shadcn/ui + Tailwind. Cross-platform.
---

# Skill: hora-component

> "Un composant bien structure au depart evite 10 refactors plus tard."

Scaffolding intelligent de composants React. Detecte la structure du projet, les conventions en place, et genere des fichiers coherents avec l'existant.

## Invocation

```
/hora-component <ComponentName> [--mode] [options]
```

| Mode | Description |
|------|-------------|
| (defaut) | Composant simple avec types |
| `--full` | Composant + test + types exportes |
| `--form` | Composant formulaire avec react-hook-form + Zod |

| Flag | Description |
|------|-------------|
| `--dir` | Sous-dossier cible (defaut: detecte automatiquement) |
| `--client` | Force `"use client"` (defaut: Server Component) |
| `--story` | Genere aussi un fichier Storybook |
| `--variants` | Genere avec CVA (class-variance-authority) |

---

## Protocol

### Phase 1 — DETECT

1. Executer `scripts/detect-structure.ts` sur le projet
2. Identifier le repertoire composants, la convention de nommage, la presence de tests
3. Detecter shadcn/ui et Tailwind

### Phase 2 — SCAFFOLD

Selon le mode choisi, generer les fichiers :

#### Mode basique
```
components/
  ComponentName.tsx       # Composant avec interface Props typee
```

#### Mode `--full`
```
components/
  ComponentName/
    ComponentName.tsx     # Composant
    ComponentName.test.tsx # Tests Vitest + Testing Library
    index.ts              # Re-export
```

#### Mode `--form`
```
components/
  ComponentName/
    ComponentName.tsx     # Formulaire avec useForm + zodResolver
    ComponentName.schema.ts  # Schema Zod
    ComponentName.test.tsx   # Tests
    index.ts              # Re-export
```

### Phase 3 — GENERATE

Pour chaque fichier, respecter les conventions :
- **TypeScript strict** : interface pour les props, pas de `any`
- **Named exports** : `export function ComponentName` (pas de default)
- **Server Component** par defaut, `"use client"` seulement si `--client` ou `--form`
- **Tailwind** : classes utilitaires, pas de CSS-in-JS
- **shadcn/ui** : utiliser les primitives si disponibles (Button, Input, Card, etc.)
- **Tests** : Vitest + Testing Library, tester le rendu et les interactions

### Phase 4 — REPORT

Afficher la liste des fichiers generes et les prochaines etapes.

---

## Exemples

### 1. Composant simple

```
/hora-component UserAvatar
```

Genere `components/UserAvatar.tsx` avec une interface `UserAvatarProps` et un export nomme.

### 2. Composant complet avec tests

```
/hora-component DataTable --full --client
```

Genere `components/DataTable/DataTable.tsx`, `DataTable.test.tsx`, `index.ts` avec `"use client"`.

### 3. Formulaire avec validation

```
/hora-component LoginForm --form
```

Genere le formulaire avec `useForm`, `zodResolver`, le schema Zod separe, et les tests.

---

## Templates

### Composant basique

```tsx
import { type ComponentPropsWithoutRef } from "react";

interface ComponentNameProps {
  // Props here
}

export function ComponentName({ ...props }: ComponentNameProps) {
  return (
    <div>
      {/* Content */}
    </div>
  );
}
```

### Test basique

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ComponentName } from "./ComponentName";

describe("ComponentName", () => {
  it("renders without crashing", () => {
    render(<ComponentName />);
    // Assertions
  });
});
```

### Formulaire

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type z } from "zod";
import { componentNameSchema } from "./ComponentName.schema";

type FormData = z.infer<typeof componentNameSchema>;

interface ComponentNameProps {
  onSubmit: (data: FormData) => void;
}

export function ComponentName({ onSubmit }: ComponentNameProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(componentNameSchema),
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Fields */}
    </form>
  );
}
```

---

## Scripts

| Script | Usage |
|--------|-------|
| `scripts/detect-structure.ts` | `npx tsx scripts/detect-structure.ts [project-dir]` |

---

## Troubleshooting

### Le repertoire composants n'est pas detecte
- Creer manuellement `src/components/` ou `components/` et relancer
- Utiliser `--dir` pour specifier le chemin

### Les imports shadcn/ui ne sont pas reconnus
- Verifier la presence de `components/ui/` dans le projet
- Verifier que shadcn est initialise (`components.json` present)

---

## Regles

1. **Detect before scaffold** — Toujours analyser la structure existante avant de generer
2. **Server first** — Server Component par defaut, `"use client"` est un opt-in
3. **Named exports** — Jamais de default exports (sauf si convention detectee)
4. **No any** — Tous les props sont types avec des interfaces
