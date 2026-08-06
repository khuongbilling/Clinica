# @workspace/clinica-ds

**Clinica Design System — Token Foundation**

This package is the single source of truth for the Clinica visual language.
It exports:

- `src/styles.css` — Tailwind v4 `@theme` block with all colour, typography,
  geometry, shadow, motion, and state tokens.
- `src/tokens.ts` — Typed TypeScript constants re-exporting every token value
  for use in component logic.

See `docs/AGENTS.md` for the full class-name and token reference.

## Usage (mockup sandbox)

```tsx
// styles.css of your ds-entry already imports this:
@import '@workspace/clinica-ds/styles.css';
```

```ts
// In component logic:
import { COLOR_JADE, DURATION_BASE } from '@workspace/clinica-ds/tokens';
```
