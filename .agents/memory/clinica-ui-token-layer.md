---
name: Clinica UI token layer
description: The app now has TWO theme layers — legacy dark COLORS and the newer warm-dark luminous UI tokens; know which to import.
---

# Clinica has two coexisting theme layers

- `frontend/src/theme/colors.ts` — **legacy** dark tokens (`COLORS` near-black
  surface, gold brand, element colors, `SPACING`, `RADIUS`, `FONTS`). Most
  screens still import this.
- `frontend/src/theme/ui.ts` — **new** "warm-dark luminous" refresh layer
  (`UI`, `UI_RADIUS`, `GLOW`, `GRADIENTS`, `TEXT`). Deep plum/indigo base (not
  black), gold + healing-teal glow, ivory text. It **layers on top** of
  colors.ts (re-uses SPACING/RADIUS) and does NOT modify `COLORS`.

**Why:** a full theme flip would break ~15 unconverted dark screens. The refresh
is intentionally a per-screen migration, not a global swap.

**How to apply:** refreshed screens/components import from `theme/ui` and use the
shared primitives in `frontend/src/components/ui/` (Panel, PrimaryButton,
SecondaryButton, SectionHeader, QuestCard, RewardCard, NarrativePanel). When
converting another screen, swap `COLORS.*` surfaces/text for `UI.*` and use the
`ui/` primitives; leave element/accent colors from `COLORS` as-is. Don't delete
colors.ts — both layers must coexist until every screen is migrated.

**Gotcha:** `GRADIENTS`/ramps are `as const` tuples — pass them straight to
`LinearGradient colors={...}`; do NOT cast to `string[]` (that breaks the
readonly-tuple overload). Stacked tap targets (e.g. a tappable panel + a button
inside it) need a debounce guard on the shared handler or a single tap at the
seam fires twice.
