---
name: Clinica Realm terrain textures
description: How the Realm/Sanctuary map renders donghua textured tiles per-player instead of flat SVG vector diamonds.
---

# Realm terrain textures (per-player)

Realm map tiles are painterly donghua textures (grass/meadow/path/water/forest/mountain/stone),
NOT flat SVG-vector fills. Textures live in `frontend/assets/realm/terrain/*.png` (7 seamless PNGs).

**Rendering:** `IsoTerrain.tsx` uses react-native-svg `<Defs>`+`<Pattern>` (one per terrain key,
tiled screen-space at TEX_TILE=128px) and fills each diamond top-face `<Polygon>` with `url(#terr-<key>)`.
SVG Pattern image-fill DOES render correctly on Expo web (react-native-svg-web) — contrary to plain RN
`<Image>` which fails silently on web. 3D skirt + lock dimming (0.42) + build-mode gold outline retained.

**Coherence rules (so land "makes sense", no random rock in grass):** buildable open ground picks
ONLY grass/meadow (soft value-noise regions) — no random `path`/dirt speckles (worn dirt only ever
appears as auto-generated roads between buildings). Inland blocked cells pick ONLY water/forest
(ponds & groves) — NEVER `mountain`/rock inland (a lone rock tile amid grass was the "random stone
block" complaint). `mountain`/rock appears only as the top/bottom border ridge; side edges are a
water moat. The central sanctuary `stone` plaza stays stone.

**Seam melding (tiles looked like disconnected plots via lines):** in normal play, stroke each
top-face polygon with its OWN pattern paint (`url(#terr-<key>)`, strokeWidth 1) instead of a dark
outline — the textured stroke bleeds ~1px past the edge and hides the hairline antialias cracks
between adjacent SVG polygons, so a same-terrain field reads as one continuous painting. Only in
build mode switch to the crisp gold outline for footprint legibility. **Why:** the old faint dark
per-tile stroke drew a visible grid; removing it left antialias seams, so a same-paint stroke both
removes the grid AND closes the seams.

**Per-player randomization:** each player gets a `realm_seed` (int). Backend `Player`/`PlayerUpdate`/
`create_player` (random.randint) + frontend `types.ts`, `store.tsx` defaultPlayer AND normalizeProgression
backfill (any missing PlayerState field must be added to backend Player+PlayerUpdate or refresh wipes it).
`generatePlayerTerrain(seed)` in `realmGrid.ts` is deterministic value-noise; it ONLY sets cosmetic
`terrain`, NEVER mutates `plotType` (fairness — same buildable/blocked layout for everyone). `kingdom.tsx`
recomputes `sortedCells` via useMemo keyed on `player?.realm_seed`.

**Verifying visually:** `/kingdom` is blank with no player (onboarding is on `/`, can't click through in
screenshot browser). Temporarily add an auto-create player in `store.tsx` refresh() `if(!local)` branch,
restart the frontend workflow (CI=1 disables Metro reloads — edits need a workflow restart), screenshot,
then REVERT the bypass.
