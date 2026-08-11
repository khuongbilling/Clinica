---
name: Fog-map field composition (Pushes 16–17)
description: Architecture of JourneyFogField — the continuous atmospheric fog overlay for the hex chapter map.
---

## Rule
JourneyFogField is a SEPARATE component from HexTile.  Fog artwork is placed in world space once, not per-tile.

## Architecture

**Separation of concerns:**
- **Fog art** — raster PNG only (6 Image components: 2 large + 2 medium + 2 wisp, from Push 15 assets).  No cloud shapes are drawn in code.
- **Visibility mask** — code-driven: each bank's opacity is attenuated by proximity to non-unexplored tile centres.
- **Clearing layer** — SVG `RadialGradient` circles at visibleNow/current tile centres (very low opacity — atmospheric hint only).

**Opacity clearing rule:**
- Compute `clearSources` from tiles where `visibility !== 'unexplored'`.
- For each source: radius = `CLEAR_RADIUS_FACTOR[key] × sz` (current=2.8, visibleNow=2.2, exploredButOutOfVision=1.3).
- Use MAX clearing across all sources (not additive) — prevents over-clearing between adjacent visible tiles.
- Banks with `opacity <= 0.02` are filtered out (no empty Image nodes).

**z-ordering:**
- `JourneyFogField` renders at `zIndex 5000` — above unexplored Pressables (z 1–3000), below explored tiles (z 5050+) and visibleNow/current tiles (z 5100+ / 9999).
- The hard visibility boundary is enforced by HexTile z-ordering, not by the fog mask.

**timeOfDay fallback:**
- HexMapLayer passes `timeOfDay ?? 'night'` — safe default when shift is not yet resolved (dev/test paths).

**Asset requirement:**
- Metro requires static `require()` strings — all 18 PNG paths (6 banks × 3 shifts) must be literal strings in `FOG_BANKS` const at module level.
- Assets live in `frontend/assets/ui/journey/fog/` (Metro-bundled, NOT `public/`).

**Why:**
- Cross-platform alpha masking (to cut true holes through Image components) requires either `@react-native-masked-view/masked-view` (extra dep) or SVG `<image>` with URI conversion (async, complex).
- Opacity attenuation per bank centre achieves the same "fog thins near visible tiles" effect without any blend modes — works identically on web and native.

**JourneyFogLayer stub:**
- Kept in HexMapLayer.tsx as a dead function returning null (Push 13).  The call site was replaced with JourneyFogField.  The stub can be deleted in a future cleanup push.
