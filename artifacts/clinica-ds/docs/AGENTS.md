# Clinica Design System — Agent Reference

This document is the authoritative guide for any agent or developer working
with the Clinica DS token layer. Read this before adding, modifying, or
removing any visual property in mockups that sit under
`artifacts/mockup-sandbox/src/ds/clinica-ds/`.

---

## 1. Importing the design system

### In a ds-entry (mockup sandbox)
The ds-entry's `styles.css` already does this — **do not add another import**:
```css
@import '@workspace/clinica-ds/styles.css';
```

### In component logic (JS/TS values)
```ts
import { COLOR_JADE, DURATION_BASE, RADIUS_MD } from '@workspace/clinica-ds/tokens';
```

---

## 2. Colour tokens

All colours are exposed as Tailwind utility classes **and** as CSS custom
properties under `--color-*`.

| Token name         | Hex        | CSS variable                   | Tailwind bg/text class         |
|--------------------|------------|--------------------------------|-------------------------------|
| `background`       | `#07141D`  | `--color-background`           | `bg-background` / `text-background` |
| `panel`            | `#0B1C25`  | `--color-panel`                | `bg-panel`                    |
| `panel-raised`     | `#102A31`  | `--color-panel-raised`         | `bg-panel-raised`             |
| `panel-objective`  | `#16343B`  | `--color-panel-objective`      | `bg-panel-objective`          |
| `jade` (primary)   | `#82D5BA`  | `--color-jade`                 | `bg-jade` / `text-jade`       |
| `teal-bright`      | `#55C8B7`  | `--color-teal-bright`          | `bg-teal-bright`              |
| `gold-antique`     | `#C7A15D`  | `--color-gold-antique`         | `text-gold-antique`           |
| `gold-bright`      | `#E1C27C`  | `--color-gold-bright`          | `text-gold-bright`            |
| `ivory`            | `#F0E7D5`  | `--color-ivory`                | `text-ivory`                  |
| `muted`            | `#9DA8AA`  | `--color-muted`                | `text-muted`                  |

### shadcn/ui semantic slots (auto-inherited)
These shadcn/ui components inherit Clinica colours automatically — no override
needed: `Button`, `Card`, `Dialog`, `Popover`, `Badge`, `Input`, `Select`,
`Separator`, `Switch`, `Tabs`, `Tooltip`.

Components that may need explicit class overrides (because they use their own
inline styles or hard-coded colours): `Toast` (use `className` prop),
`Progress` (set `className` on the indicator), chart colours
(`--chart-1..5` are not mapped — set them per-chart with inline CSS vars).

---

## 3. Typography utilities

| Class          | Font family   | Usage                                                  |
|----------------|---------------|--------------------------------------------------------|
| `font-display` | Marcellus     | Screen titles, hub headings, hero names                |
| `font-ui`      | Source Sans 3 | All body copy, labels, buttons, stats (default body)   |
| `font-cinzel`  | Cinzel        | Large uppercase chapter / section headings **only** — use sparingly, never for body copy |

> **Cinzel discipline**: Cinzel reads as ceremonial/archaic. Reserve it for
> major chapter dividers, boss names, and section banners — NOT for buttons,
> labels, or any text below 18 px.

---

## 4. Shadow / glow utilities

Apply as Tailwind utility classes:

| Class            | Effect                                       | When to use                         |
|------------------|----------------------------------------------|--------------------------------------|
| `shadow-teal`    | Teal/jade radial glow                        | Selected item, heal action, jade CTA |
| `shadow-gold`    | Gold radial glow                             | Gold reward, active border highlight |
| `shadow-ambient` | Deep dark drop shadow                        | Floating panels, modals              |
| `shadow-panel`   | Subtle dark shadow                           | All surface cards                    |

---

## 5. Geometry tokens

Access via CSS variable or JS constant:

| Token              | Value  | CSS var                | JS constant          |
|--------------------|--------|------------------------|----------------------|
| Radius small       | 6 px   | `--radius-sm`          | `RADIUS_SM`          |
| Radius medium      | 12 px  | `--radius-md`          | `RADIUS_MD`          |
| Radius large       | 18 px  | `--radius-lg`          | `RADIUS_LG`          |
| Radius extra-large | 24 px  | `--radius-xl`          | `RADIUS_XL`          |
| Radius pill        | 999 px | `--radius-pill`        | `RADIUS_PILL`        |
| Shortcut card W    | 88 px  | `--shortcut-card-w`    | `SHORTCUT_CARD_W`    |
| Shortcut card H    | 96 px  | `--shortcut-card-h`    | `SHORTCUT_CARD_H`    |
| Page gutter        | 16 px  | `--page-gutter`        | `PAGE_GUTTER`        |
| Min touch target   | 44 px  | `--touch-min`          | `TOUCH_MIN`          |

---

## 6. Motion tokens

| Token          | Value   | CSS var              | JS constant       |
|----------------|---------|----------------------|-------------------|
| Fast           | 120 ms  | `--duration-fast`    | `DURATION_FAST`   |
| Base           | 220 ms  | `--duration-base`    | `DURATION_BASE`   |
| Slow           | 400 ms  | `--duration-slow`    | `DURATION_SLOW`   |
| Scene          | 650 ms  | `--duration-scene`   | `DURATION_SCENE`  |
| Ease default   | `cubic-bezier(0.4,0,0.2,1)` | `--ease-default` | `EASE_DEFAULT` |

---

## 7. State class recipes

### Navigation tab — active
```html
<div class="nav-active shadow-teal">...</div>
```
Effect: `color: var(--color-jade)`, `opacity: 1`, teal glow.

### Navigation tab — inactive
```html
<div class="nav-inactive">...</div>
```
Effect: `color: var(--color-muted)`, `opacity: 0.55`.

### Disabled
```html
<button class="disabled-state" disabled>...</button>
```
Effect: `opacity: 0.38`, `pointer-events: none`, `cursor: not-allowed`.

### Focus ring
```html
<button class="focus-ring focus:focus-ring">...</button>
```
Effect: `outline: 2px solid var(--color-jade)`, `outline-offset: 2px`.

### Border variants
```html
<div class="border-gold">...</div>      <!-- gold-antique, default panels -->
<div class="border-gold-bright">...</div> <!-- active / focused border -->
<div class="border-jade">...</div>      <!-- selected / confirmed -->
```

---

## 8. Out of scope for this package

- **Game sprite logic** — hero/enemy sprite positioning, flipping, and FX
  choreography. Those live in `frontend/src/` battle/ward screens.
- **Reanimated animations** — React Native animation drivers. This package
  covers web/CSS motion tokens only.
- **Component library** — no Button, Card, or Modal components are defined
  here. This is a token layer only. Components belong in the mockup-sandbox
  or future component packages.
- **`frontend/src/theme/colors.ts` or `ui.ts`** — do NOT import or modify
  these files from here. They are the native-side token files.
- **Chart colours** (`--chart-1..5`) — set per-chart with inline CSS vars;
  not mapped to Clinica tokens.

---

## 9. Adding new tokens

1. Add the CSS custom property to `src/styles.css` inside `@theme {}`.
2. Add the corresponding TypeScript constant to `src/tokens.ts`.
3. Update this file's tables.
4. If it's a new utility class, add it with `@utility` in `src/styles.css`.
