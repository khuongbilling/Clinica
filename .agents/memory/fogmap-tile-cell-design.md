---
name: Fog-map tile cell design
description: Visual architecture for hex tile overlays — cells are transparent windows into the background painting, not filled floor tiles.
---

# Fog-map tile cell design

## The rule
Hex cells are **transparent windows** into the background environment painting. No cell state ever fills the tile interior with a solid or semi-solid color. The background painting is the terrain; the hex grid is an invisible interaction layer that becomes just barely perceptible through rings and glows.

**Why:** Every interior fill — even at 0.12 opacity — registers as a floor tile when many cells are adjacent, making the map read as "hex game board" rather than "fantasy courtyard." The background-to-grid attention ratio target is 80–90% environment / 10–20% grid.

## Layer-by-layer spec (as of Push 3)

### `exploredButOutOfVision` (revealed/visited)
- **Interior:** nothing — fully transparent
- **Edge:** single hairline hex ring at inset 0.96, `fogTheme.veilStroke`, ~0.8–0.9px
- **Effect:** tile is functionally invisible; only the hairline marks the grid

### `visibleNow` (frontier/reachable)
- **Interior:** soft *circular* RadialGradient (Circle, r=0.42×sz) from `fogTheme.frontierStroke` at 0.22 → 0 opacity — circular, NOT hex-shaped polygon
- **Edge:** jade hex rim at inset 0.96, `fogTheme.frontierStroke`, 2.2px, 0.84 opacity
- **Effect:** glowing orb of light marking movement range, not a floor

### `current` (player position)
- **Interior:** very faint circular RadialGradient (Circle, r=0.44×sz, id="cur-glow") at 0.14 → 0 — ambient emanation
- **Edge:** single strong hex ring at inset 0.97, `fogTheme.currentRing`, 2.8px, 0.92 opacity — strongest of all three states
- **Ground effect:** CHR_GLOW (Layer 4a) provides a separate circular jade ground pool beneath the character sprite — rendered independently, only when `explorationCharacter != null`

## What NOT to add
- No filled Polygon inside any revealed tile state (not even at 0.05 opacity)
- No `baseFill` Rect in the fog SVG (removed in Push 2)
- No `veilFill` field in FogTheme (removed in Push 3)
- No `frontierFill` field in FogTheme (removed in Push 3)

## Player sprite sizing canon (Push 8)

Assets: 1024×1024 square PNGs, transparent bg. Feet/boots at ~90% of image height. No baked-in contact shadow.

Use a **square bounding box** (CHR_W_RATIO = CHR_H_RATIO) so `contentFit="contain"` fills exactly with no letterbox centering offset.

Target: sprite 1.0–1.25 hex widths wide; feet at lower-centre (~0.655 × sz).

Key constants (do not regress without updating all three together):
- `CHR_W_RATIO = CHR_H_RATIO = 1.15`
- `CHR_Y_SHIFT = 0.38` (feet at −0.38 + 0.90×1.15 = 0.655 × sz)
- `CHR_GLOW_CY = 0.65` (jade glow tracks feet)
- `CHR_SHADOW_CY = CHR_GLOW_CY`, `CHR_SHADOW_RX = CHR_GLOW_RX + 0.07`

The Pressable has `overflow:'visible'` so charX = −0.075×sz is safe.

## JourneyFogLayer component (Push 7)

`JourneyFogLayer` is a standalone component extracted from `HexMapLayer`. It owns ALL atmospheric fog rendering. `HexTile` carries **no fog DOM** — only interaction target, state glow/border, encounter anchor.

Props: `{ tiles, sz, ox, oy, worldW, worldH, fogTheme }`.
Placement: inside the `Animated.View` world viewport at zIndex 5000.

Dead code removed alongside this refactor:
- `ResolvedTileVis` type
- `resolvedTileVis` const (was constructed but never consumed by HexTile)
- `tileVis: ResolvedTileVis` on `HexTileProps` (was accepted, never read)

`tileVisuals` stays on `HexMapLayerProps` for backward compat with fog-map.tsx but is no longer used internally.

## Web fog implementation — Canvas 2D (not SVG)

`react-native-svg` `RadialGradient` with `gradientUnits="userSpaceOnUse"` on Expo web renders as **white rectangles** — the gradient coord system doesn't map correctly to screen space in the web backend. The fix uses a single HTML `<canvas>` element injected imperatively into a `View` ref:

1. Flood-fill canvas with `fogTheme.blobColor` at `fogTheme.blobOpacity` → one continuous fog surface
2. Switch to `globalCompositeOperation = 'destination-out'`
3. For each non-unexplored tile: draw a `createRadialGradient` circle (opaque-black center → transparent edge) → carves organic feathered hole

The canvas is appended once and reused; `useEffect` with `[tiles, sz, ox, oy, worldW, worldH, fogTheme]` deps redraws on any change.

Native keeps the SVG RadialGradient blob approach (works on Skia/RNSVG).

Pattern: `Platform.OS === 'web' ? <View ref={fogContainerRef} /> : <SVGBlobs />`

## SVG gradient ID notes
- `cur-glow` can be a fixed ID (only one current tile exists at a time, each tile has its own `<Svg>` scope on native; web IDs are document-global but only one current tile exists)
- Frontier gradient IDs MUST be unique: use `fg-${tile.q}x${tile.r}` — multiple frontier tiles coexist and SVG IDs are document-global on web

## How to apply
Any time a visual tuning push touches tile overlays, start from this spec. Resist "just a little fill" — even a transparent polygon at 0.08 creates the hex-board reading at scale.
