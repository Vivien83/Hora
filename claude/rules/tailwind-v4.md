---
paths:
  - "**/*.tsx"
  - "**/*.css"
  - "**/*.jsx"
---

# Tailwind CSS v4 — Quick Reference

## Import Syntax (v4)
```css
/* v4 — use @import, NOT @tailwind directives */
@import "tailwindcss";
```

## CSS-First Configuration
Configuration via `@theme` directive in CSS — no tailwind.config.js:
```css
@theme {
  --color-brand: oklch(0.72 0.11 178);
  --font-sans: 'DM Sans', system-ui, sans-serif;
}
```

## Replaced Utilities (v3 → v4)
| Deprecated (v3) | Use instead (v4) |
|-----------------|------------------|
| bg-opacity-* | bg-black/50 (slash syntax) |
| text-opacity-* | text-black/50 |
| border-opacity-* | border-black/50 |
| flex-shrink-* | shrink-* |
| flex-grow-* | grow-* |
| overflow-ellipsis | text-ellipsis |
| decoration-slice | box-decoration-slice |

## Best Practices
- `gap` > margins for spacing between siblings
- Dark mode: `dark:` variant when project supports it
- Check existing patterns in sibling files before creating new ones
- Remove redundant classes, group logically
- `corePlugins` is NOT supported in v4
