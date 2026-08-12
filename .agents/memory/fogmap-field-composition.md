---
name: Fog-map field composition (Push 0 — stripped)
description: All fog rendering removed in Push 0; ready for a fresh implementation. Preserves tile visibility state and fogCalculator.ts.
---

# Fog-map field composition — Push 0 (clean slate)

**Rule:** All visual fog rendering has been removed. The map renders with zero fog. `fogCalculator.ts` and tile visibility state (`unexplored`/`visibleNow`/`exploredButOutOfVision`) are intentionally preserved — they are game data, not rendering.

**Why:** The previous multi-attempt fog system (canvas fillRect → SVG RadialGradient → PNG banks) never reached a satisfactory result. Push 0 strips everything so the new implementation starts clean.

**What is gone:**
- `JourneyFogField.tsx` — deleted
- All PNG/WebP fog assets in `frontend/assets/ui/journey/fog/` — deleted
- `fogInterior` / `fogEdge` fields from `ChapterShiftVisuals` interface — removed
- `FOG_INTERIOR`, `FOG_EDGE`, `CH1_DAY_FOG`, `CH1_EVE_FOG` constants — removed
- Fog dev-overlay props from `HexMapDevOverlay` — removed
- `runSeed` prop on `HexMapLayerProps` — removed
- All stale JourneyFogLayer/JourneyFogField comment references — cleaned

**What is preserved (do not remove):**
- `fogCalculator.ts` — tile visibility logic
- `tile.visibility` on `HexMapTile` — unexplored / visibleNow / exploredButOutOfVision
- `FOG_BOTTOM_PAD_PX` export in hexWorldCoords.ts — world height clearance
- `fogTheme` / `FOG_THEMES` — drives HexTile SVG state ring colours (not fog rendering)

**How to apply:** New fog slots at zIndex ~5000 inside MapWorld (moves with camera). Use `HexWorldCoords.axialToWorld(q, r)` to get tile centres for reveal-clearing math.
