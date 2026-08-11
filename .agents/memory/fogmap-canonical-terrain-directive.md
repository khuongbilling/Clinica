---
name: Fog-map canonical terrain directive (Pushes 1–26)
description: Global rules for the Journey map controlled repair — what is preserved, what is fixed terrain vs seeded content, rendering model, shape constraints, and asset rules.
---

## What this covers
The authoritative directive for all Journey map repair pushes (1–26).
Read this before touching any fog-map, journeyMap, or HexMapLayer file.

---

## PRESERVE — do not touch

- `TimeOfDay`: day / evening / night shift system
- Seeded encounter generation and probability tables (`config.ts` encounter rates)
- Ward Event generation and subtypes
- Area Boss generation
- 3 Chapter Boss Key requirement and chapter-level boss key persistence
- `JourneyRun` persistence
- Stamina movement rules
- Fixed chapter progression
- Battle integration (journeyReturn + journeyTileId param flow)
- Bottom navigation
- Canonical shift choices (`chapterShiftRules.ts`)

---

## CANONICAL MAP MODEL — terrain vs content split

**Terrain geometry is FIXED. It never rerolls.**

Each chapter owns exactly:
- Hex coordinates (checked-in literal data in `chapterMapTemplates.ts`)
- Terrain cell count (from `getChapterTileCount` in `config.ts`)
- Fixed start cell (role: 'start')
- Fixed Chapter Boss Gate anchor cell (role: 'gate')
- Fixed map footprint and environmental composition

**The JourneyRun seed randomises CONTENT only:**
- Battles / Area Bosses / Treasure / Merchant / Ward Events / Ward Event subtypes
- Chest tier
- Temporary chapter rewards
- Fog state

**Never randomise terrain geometry.**

---

## TERRAIN CELL COUNTS

| Chapters | Terrain cells |
|---|---|
| 1–5   | 30 |
| 6–10  | 35 |
| 11–20 | 40 |
| 21–30 | 45 |
| 31–40 | 50 |
| 41–50 | 55 |
| +10ch | +5 |

Formula (ch 11+): `40 + 5 × floor((chapter − 11) / 10)` — matches `getChapterTileCount`.

---

## CANONICAL COUNT DEFINITION

The count is the TOTAL PHYSICAL TERRAIN CELLS including start and gate.

**Chapter 1 example:**
```
terrainCellCount         = 30
encounterEligibleCount   = 28   (30 − start − gate)
```

Exploration UI must display: **X / 30 terrain explored**
Never display 29 as the Chapter 1 denominator.
The gate cell may be discovered before it becomes enterable.

---

## MAP SHAPE RULES

**Use:** dense, contiguous hex terrain
- Circular-ish / oval / rounded-square
- Compact, dense
- One contiguous terrain mass
- Irregular natural perimeter

**Do NOT use:**
- Thin linear paths
- Floating islands
- Separate bridge graphics
- Sparse node chains
- Detached encounter platforms
- Square board-game background blocks

NO-ENCOUNTER tiles are ordinary traversable terrain (not visually distinct platforms).

---

## RENDERING MODEL

All world-space elements in ONE movable MapWorld:

```
1. Painted environment (raster background, per-shift PNG/WebP)
2. Hex terrain field
3. 2.5D world objects (raster PNG/WebP sprites)
4. Continuous atmospheric fog system (raster PNG/WebP)
5. Fixed UI (outside MapWorld)
```

---

## DAY / EVENING / NIGHT

All three shifts share identical:
- Terrain coordinates, count, start, gate, footprint

Each shift has different:
- Painted environmental theme
- Fog artwork
- Ward Event flavour
- Encounter distribution (existing `config.ts` tables)
- Battle pressure mechanics

Current dark visual direction = **NIGHT**.

---

## ASSET RULES — GLOBAL, APPLIES TO ALL PUSHES 1–26

Final fog and illustrated map objects MUST be **raster PNG/WebP assets**.

**NEVER** replace illustrated artwork with:
- CSS drawings
- SVG primitives
- Emoji
- Generic icon libraries

This is a hard global directive for every push in this sequence.

---

## PUSH DISCIPLINE

After every push:
1. Run tests (`cd frontend && npm run validate` or `npx tsc --noEmit`)
2. Inspect mobile screenshot
3. Verify no regression
4. Commit with descriptive message
5. Stop and report back

Do NOT combine pushes.
