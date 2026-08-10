---
name: Journey map visibility rename
description: Push 15 rename of TileVisibility states + transparent hex interiors spec; all files that must stay in sync listed here.
---

## Rule
TileVisibility now has three spec-aligned names:
- `'unexplored'` (was `'hidden'`) — not in view, never visited
- `'visibleNow'` (was `'frontier'`) — within REVEAL_RADIUS of current tile
- `'exploredButOutOfVision'` (was `'revealed'`) — visited, permanently uncovered

`REVEAL_RADIUS = 1` is exported from `fogCalculator.ts` — pass as optional 3rd arg to computeInitialFog/computeFogAfterMove to override per-class/skill.

**Why:** Spec rule 5 (Presentation Adjustment Directive) required named states that match visual intent; configurable radius is required for future class/skill bonuses (spec rule 4).

**How to apply:** Any new code that reads tile.visibility must use the new names. Any new test that creates JourneyTile literals must use the new names. The movement gate (`validateMove`) allows visibleNow OR exploredButOutOfVision — never unexplored.

## Files that contain the state strings (must stay in sync)
- `frontend/src/game/journeyMap/types.ts` — TileVisibility type
- `frontend/src/game/journeyMap/fogCalculator.ts` — all logic + REVEAL_RADIUS
- `frontend/src/game/journeyMap/movement.ts` — validateMove gate
- `frontend/src/game/journeyMap/validate.ts` — exploredTileCount derivation
- `frontend/src/game/journeyMap/createRun.ts` — initial tile setup
- `frontend/src/game/journeyMap/fixture.ts` — static fixture + debug generator
- `frontend/src/game/journeyMap/journeyRunLifecycle.ts` — buildInitialJourneyRun
- `frontend/src/components/journey/HexMapLayer.tsx` — renderer
- `frontend/app/journey/chapter/[chapterId]/fog-map.tsx` — gate visibility check
- `frontend/tests/fog_calculator.test.ts`, `movement.test.ts`, `journey_run_lifecycle.test.ts`, `journey_map_create_run.test.ts`, `encounters.test.ts` — test files

## HexTile rendering model (Push 16+17 — SVG transparent hex overlay)
hex-revealed / hex-frontier terrain images are NO LONGER rendered per-tile.
The chapter background image IS the environment floor. Hex cells are SVG outlines.

- `current`                → jade glow image + SVG border ring (stroke rgba(90,230,205,0.82) w=1.8 inset=0.87)
- `exploredButOutOfVision` → SVG hairline polygon (fill=transparent, stroke rgba(255,255,255,0.17) w=0.8)
- `visibleNow`             → SVG jade edge glow (fill rgba(80,220,196,0.07), stroke rgba(100,230,208,0.58) w=1.4)
- `unexplored`             → `TILE_BASE.hidden` + fog overlay at `FOG_LOCAL_OPACITY = 0.88`
- `FOG_ATMO_SCALE = 2.40`  — wider bleed → seamless fog across unexplored region
- `FOG_ATMO_OPACITY = 0.38`
- `ResolvedTileVis` now has only 2 fields: `terrainCurrent` + `fogInterior`
- `HexMapLayerProps.tileVisuals` Pick is `'terrainCurrent' | 'fogInterior'` only
- `terrainBase` / `terrainFrontier` remain in `ChapterShiftVisuals` registry (unused by renderer)
- `hexPoints(sz, inset=0.89)` utility: flat-top hex polygon string for SVG Polygon
- `react-native-svg` Svg+Polygon wrapped in `<View style={[s.overlay,{pointerEvents:'none'}]}>` (style form, not deprecated prop form)
- Push 3: `visionConfig.ts` owns BASE_VISION_RADIUS=1, MAX_VISION_RADIUS=4, VisionBonus types, computeEffectiveVisionRadius, resolveVisionBonuses
- `applyMoveToRun(run, destId, visionRadius=REVEAL_RADIUS)` — third arg threads radius into computeFogAfterMove
- `buildInitialJourneyRun` accepts optional `visionRadius` → passes to computeInitialFog
- `fog-map.tsx`: useMemo computes effectiveVisionRadius from player.class_tree_id; passed to applyMoveToRun on every move
- CLASS_VISION_BONUSES registry in visionConfig.ts (commented examples): add classTreeId→value to grant vision passives; no other file changes needed
- `computeInitialFog`/`computeFogAfterMove` radius params must be typed `number =` not inferred from `1 as const` or callers with `number` type fail TS

## Push 5 — exploredButOutOfVision visual treatment

**Rule:** exploredButOutOfVision tiles must sit at zIndex 5050 (above fog SVG at 5000, below visibleNow at 5100+). Memory veil is applied tile-side as a hex-polygon SVG fill — NOT via any fog SVG element.

**Memory veil constants (HexMapLayer.tsx):**
- `FOG_VEIL_FILL = 'rgba(6,10,22,0.38)'` — hex-shaped dark fill; terrain at ~62% brightness
- `FOG_VEIL_STROKE = 'rgba(255,255,255,0.32)'` — brighter hairline than unexplored (0.17 was invisible)
- `FOG_VEIL_STROKE_W = 0.9`

**Why tile-side:** fog SVG blobs (unexplored, 2.80×sz radius, 0.94 opacity) bleed up to 2.80×sz from each unexplored tile — they would cover explored tiles at zIndex 1–3000 entirely (explored tiles are only 0.72×sz away from the nearest unexplored tile, well within the flat zone of the gradient). Elevating explored tiles above the fog is the only architecture that guarantees they remain visible.

**How to apply:** Any future "explored tile" visual changes go in Layer 2b of HexTile (the `isExplored` polygon). The fog SVG renders ONLY unexplored blobs. Haze blobs for explored tiles were removed.

## Push 12 — Tactical map polish: painted environment + interaction grid

**Explored veil (exploredButOutOfVision) — split into two polygons in one SVG:**
- Inner body at `hexPoints(sz, 0.82)` fill=veilFill, no stroke — inset so background bleeds through ~18% margin; adjacent bodies no longer double-darken at tile edges → terrain feels contiguous, not card-gridded
- Outer hairline at `hexPoints(sz, 0.96)` transparent fill, veilStroke — visited-territory signal as an architectural line, not a filled border

**visibleNow frontier — triple-element movement cell:**
- Interior tint: `hexPoints(sz, 0.84)`, fill=frontierFill, no stroke
- Outer glow ring: `hexPoints(sz, 0.96)`, stroke=frontierStroke, strokeWidth=1.8
- Inner accent ring: `hexPoints(sz, 0.78)`, stroke=frontierStroke, strokeWidth=0.8, strokeOpacity=0.40

**Current tile — double ring "you are here":**
- Outer halo: `hexPoints(sz, 0.97)`, stroke=currentRing, strokeWidth=1.2, strokeOpacity=0.45
- Inner sharp ring: `hexPoints(sz, 0.82)`, stroke=currentRing, strokeWidth=2.6, strokeOpacity=0.88

**Encounter object sizing:** areaBoss 0.92→0.86, treasure 0.62→0.66

**Contact shadow:** SHADOW_RY_FRAC 0.055→0.068, SHADOW_COLOR opacity 0.50→0.62

**Frontier color boosts (all themes):** frontierFill +0.04–0.05, frontierStroke +0.12–0.16

**SVG `strokeOpacity` prop** — confirmed valid on Polygon/Ellipse in react-native-svg; use it to control per-element opacity without encoding it in the color string.

## Push 11 — Strengthen concealment of unexplored terrain

**Two mechanisms combined:**

1. **Base fill rect** — `<Rect width={worldW} height={worldH} fill={fogTheme.baseFill} />` is the FIRST child of the fog SVG (before gradient circles). Covers the entire world with a flat ~58–62% opacity tint. Explored tiles (zIndex 5050+) sit above the SVG and are completely unaffected. This is the concealment floor — even where only one blob's thin edge reaches, the background is still blocked.

2. **Tighter gradient stops** — blob gradient now: `[0%: opacity, 65%: opacity×0.95, 75%: opacity×0.50, 100%: 0]`. Previous stop at 52% left a long semi-transparent ramp (52%–100%) where a single blob made background readable. New stops keep the dense cap to 65% of blob radius before a steeper fall-off.

**baseFill values per shift:** night `rgba(6,10,22,0.62)`, day `rgba(195,210,230,0.60)`, evening `rgba(28,18,52,0.58)`.

**Rule:** `Rect` must be imported from react-native-svg (added Push 11). The `FogTheme` type has a `baseFill` field — omitting it from a new shift entry is a type error.

## Push 10 — Shift-locked SVG fog and overlay color themes

**Architecture:** `timeOfDay?: 'day' | 'evening' | 'night'` prop added to `HexMapLayer`. Internally, `FOG_THEMES` constant (keyed by shift) drives every SVG atmospheric color — fog blobs, memory veil, frontier edge glow, current-tile ring. fog-map.tsx passes `mapShift` (= `run.shift`, frozen at run creation). Falls back to 'night' when absent (fixture/debug mode).

**Night** — exact Push 4–5 values unchanged (deep ink-blue fog, navy veil, white hairlines, teal jade accents).

**Day** — pale blue-white cloud mist (`rgb(200,220,238)`, opacity 0.85), warm cream parchment veil (`rgba(200,185,155,0.26)`), antique-gold hairlines (`rgba(140,110,55,0.40)`), warm jade frontier glow.

**Evening** — deep indigo-purple dusk fog (`rgb(28,18,52)`, opacity 0.91), indigo veil (`rgba(28,18,52,0.30)`), amber hairlines (`rgba(200,155,70,0.44)`) — lanterns starting to matter — amber frontier edge.

**Key rule:** All shift differentiation lives in `FOG_THEMES` inside HexMapLayer. `ChapterShiftVisuals` stays a pure raster-asset registry (no color fields). New shifts or retuning = edit `FOG_THEMES` only.

## Push 9 — Treasure tier visible on frontier tiles

**Visibility exception:** `encounterMapNode()` now shows treasure chests on `visibleNow` (frontier) tiles. This is the only encounter type with this exception — battle/merchant/areaBoss remain hidden until explored. The privacy gate logic reads: `!tile.current && vis !== 'exploredButOutOfVision' && !isTreasureFrontier`.

**Tier-specific glow pools:** `EncounterMapNode` gains `shadowColor?: string`. Treasure returns:
- gold → `rgba(220,170,0,0.55)` warm amber pool
- silver → `rgba(90,140,255,0.45)` cool blue pool
- bronze → `undefined` (uses default dark `SHADOW_COLOR`)
Layer 2c reads `node.shadowColor ?? SHADOW_COLOR`.

**a11yLabel()** — `visibleNow` treasure now announces "Nearby tile — Treasure (silver)" etc. instead of the generic "Nearby tile, not yet explored".

**Fixture:** t07 updated to `visibleNow` silver treasure to exercise the frontier-chest path in `?debug=N` view.

## Push 8 — 2.5D depth sorting and grounding shadows

**overflow:'visible' on s.tile** — required so sprites that extend beyond sz×sz bounds (area boss −4 %, player −36 %) are not clipped. Depth ordering unchanged (tileZ formula already correct).

**Shadow constants** (`SHADOW_COLOR`, `SHADOW_RY_FRAC`, `SHADOW_RX_MUL`, `CHR_SHADOW_*`):
- All shadows: `rgba(0,5,20,0.50)` ink-navy (Ink & Mist palette)
- Node shadows: rx = sizeMul × SHADOW_RX_MUL × sz; ry flat at 0.055 × sz; cy = 88 % tile height
- Player shadow: fixed CHR_SHADOW_RX/RY/CY fractions (same floor level as jade glow)

**Layer 2c** — dark Ellipse in new View before Layer 3 (encounter node contact shadow).
**Layer 4a** — shadow Ellipse painted FIRST in SVG before jade glow Ellipse (painters order → glow sits on top, shadow visible at edges where glow fades to transparent).

## Push 7 — 2.5D world-object encounter props

**Assets added** (`frontend/assets/map-nodes/`):
- `encounter_battle.png` — dark stone pedestal with crossed scalpels + red glow
- `encounter_merchant.png` — isometric apothecary wagon, teal/gold canopy, potions
- `encounter_area_boss.png` — spectral wraith with teal eyes and crown
- `encounter_chest_bronze.png` — plain worn wood/copper chest, no glow
- `encounter_chest_silver.png` — polished silver chest with blue magic lock aura
- Gold tier reuses `node_reward_medical_chest.png` (transparent bg, gold trim, lotus emblem)

**ENCOUNTER_ICON kept for:** legend panels (`assets.ts`) and `MerchantModal.tsx` modal header.

**MAP_NODE replaces ENCOUNTER_ICON on the map surface.** `encounterMapNode()` returns `{src, sizeMul}`.

**sizeMul / floor positioning:**
- areaBoss 0.92, merchant 0.75, battle 0.68, treasure 0.62
- Bottom of bounding box at 88% tile height (hex floor) for all types
- Area boss rises 4% above tile top at max size — dominates the hex

**Ward event:** renderer-ready (switch clause accepts future type); battle pedestal placeholder until dedicated NPC/prop assets added.

## Push 6 — 2.5D player sprite on current tile

**Sprites:** `frontend/assets/map-sprites/map_sprite_<class>.png` — 6 classes (guardian/seer/caretaker/scholar/alchemist/medic). Transparent bg, built-in gray contact shadow at ~91% height. Resolved via `getMapSprite(class_tree_id)` in `illustratedAssets.ts`.

**Wiring:** `fog-map.tsx` computes `explorationCharacter = getMapSprite(player.class_tree_id)` → passed as prop to `HexMapLayer` → `HexTile` Layer 4b. Medallion fallback (`PLAYER_TOKEN`) used when `explorationCharacter == null`.

**Sizing rule** (`HexMapLayer.tsx` constants):
- `CHR_W_RATIO=1.00` (full tile width), `CHR_H_RATIO=1.32` (taller than tile), `CHR_Y_SHIFT=0.36` (rises 36% above tile top)
- Built-in shadow lands at `(1.32×0.91 − 0.36)×sz ≈ 0.84×sz` down the tile — the 2.5D floor
- Jade glow ellipse (Layer 4a): `CHR_GLOW_CY=0.83`, `CHR_GLOW_RX=0.33`, `CHR_GLOW_RY=0.11`, `CHR_GLOW_OPACITY=0.55`

**Why:** Two complementary grounding layers — sprite's gray contact shadow (realistic) + jade ambient glow ellipse (magical map presence). Both centered at the same floor position.

## Push 4 fog architecture — confirmed approach

### What does NOT work on web
- **SVG `<Mask>`**: `react-native-svg` v15 `elements.web.ts` has no Mask class — only a type-only import. Mask crashes on web silently (blank white screen). Only works on native.
- **CSS `isolation:isolate` + `mix-blend-mode:destination-out`**: Attempted but caused persistent blank white screen in react-native-web. Root cause unclear; avoid.

### Confirmed working pattern
- **Blob SVG (zIndex 5000)** at unexplored tile positions: `RadialGradient` circles radius 2.8×sz, opacity 0.94. Adjacent blobs merge → seamless fog mass.
- **Explored haze blobs** (same SVG): radius 0.72×sz, opacity 0.22. Explored tiles at zIndex 1–3000 (below fog) so terrain shows dimly through the 22% haze.
- **visibleNow tiles at zIndex 5100+** (above fog SVG at 5000): terrain renders on top of fog naturally. Adjacent visibleNow tiles overlap (tiles are sz×sz, spacing 0.72×sz) → seamless connected reveal cluster above the fog.
- **current tile at zIndex 9999** — always topmost.
- No SVG Mask, no CSS compositing, no CSS clip-path required. Works on web and native.

### HexTile tileZ formula
```ts
const tileZ = tile.current
  ? 9999
  : tile.visibility === 'visibleNow'
    ? 5100 + Math.round((tile.r + tile.q * 0.5) * 10)  // above fog
    : Math.round((tile.r + tile.q * 0.5) * 100) + 1;   // below fog
```
