---
name: Clinica realm building sprites
description: How the 2.5D isometric realm-builder building sprites are generated and wired
---

Realm builder (kingdom.tsx) renders buildings as billboard PNG sprites keyed by building id via a BUILDING_SPRITES require() map; regenerating art in place (same filenames under frontend/assets/realm/buildings/) needs no code change, just a Metro restart.

**Rule:** generate these sprites with `removeBackground: true` AND a strong negative prompt excluding "checkerboard pattern, colored box, picture frame, border, light beams". 
**Why:** an earlier batch came back with baked-in opaque backgrounds (white/checkerboard boxes, sun-ray beams, black borders) — the transparency indicator got flattened into real pixels, so an ugly square floated around each building in-app.
**How to apply:** target look is Clash of Clans / Palworld — true 30° isometric three-quarter angle, each building on a small square isometric stone base platform with blue crystal accents, thick outlines, gold trim, isolated on plain white bg. Keep the angle/base consistent across all buildings so they line up on the diamond grid.
