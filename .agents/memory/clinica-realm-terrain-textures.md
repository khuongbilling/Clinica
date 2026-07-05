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
