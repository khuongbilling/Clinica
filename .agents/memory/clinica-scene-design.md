---
name: Clinica scene design rules
description: Rendering constraints and design principles for the five 2.5D arena backgrounds in index.tsx
---

# Arena scene design rules (index.tsx SceneBg)

## Container constraints
- `styles.arena` has `overflow: "hidden"` — any absolute element with negative `top` % values is clipped invisible.
- All bloom/halo Views must use `top: "0%"` or higher (never negative percentages).
- SceneBg renders as a `<>` fragment inside the arena flex row; its children position relative to the arena View.

## Opacity — minimum viable values
- Hex alpha `08`–`1c` (3–11%) is essentially invisible in the dark game theme.
- Use `28`–`55` (16–33%) for large halos, `60`–`cc` (38–80%) for focal elements.
- SceneBg Layer 3 vignettes at 78% edge / 75% top crush all scene color — keep at ≤45% edge / ≤40% top.

## Organic shapes — no rectangular props
- Lanterns and prop objects must use `borderRadius: 999` (round orbs), not `borderRadius: 4` (looks like CSS boxes).
- Canopy/cloud masses: 5–6 overlapping ellipse Views with `borderRadius: 999` at varied positions.
- All foreground structural columns (architecture) are fine as rectangles — they're silhouette masses, not props.

## Scene → element mapping
- River → CentralAtrium (moonlit hall, arch portal, cyan orb lanterns)
- Air → HealerGardenScene (twilight rooftop, cherry canopy, bamboo, round orb)
- Fire → AlchemicalForgeScene (cave, forge dome, round torch orbs)
- Mind → NeuralObservatoryScene (space dome, rings, purple bloom)
- Default/Protection → RestorationHallScene (temple, rose window, green orbs)

## Debugging player state
- Player data lives in AsyncStorage key `clinica.player.v2` (browser localStorage on web).
- Backend `/api/player` POST fails without MONGO_URL — but store falls back to local.
- Without AsyncStorage data, home tab shows black screen (null player guard). This is normal.
- To preview scenes without onboarding: temporarily render SceneBg in the `!player` branch.

**Why:** These constraints were discovered through visual verification — the scenes appeared completely black or had CSS-box artifacts until these rules were applied.
