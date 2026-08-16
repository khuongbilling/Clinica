---
name: Background Spec Pipeline (Push 7)
description: getChapterBackgroundSpec — synthesises DNA + HexLaneLayout + SceneryLayout into a structured per-chapter/per-shift image-generation specification (ChapterBackgroundSpec).
---

## Rule
The code pipeline generates blueprints, masks, and geometry (Pushes 1–6). Actual environment art must be real raster assets (PNG/WebP) — never CSS, SVG, or procedural vector art. `chapterBackgroundSpec.ts` is the bridge that produces the structured specification consumed by an AI image generator.

**Why:** Push 7 makes the spatial data actionable for art production without baking procedural art into the renderer. The spec is deterministic, cached, and testable.

## How to apply
- File: `frontend/src/game/journeyMap/chapterBackgroundSpec.ts`
- Public API: `getChapterBackgroundSpec(ch)` (cached), `getChapterBackgroundSpecRange(from, to)`, `getChapterGenerationPrompts(ch)`
- Input chain: `getChapterMapDNA` + `getChapterHexLayout` + `getChapterSceneryLayout` → `buildChapterBackgroundSpec`
- Output: `ChapterBackgroundSpec` with `shifts: Record<TimeOfDay, ShiftBackgroundSpec>`

## Asset path convention
Matches `chapterMapVisuals.ts` Ch1 convention exactly:
- Filesystem: `assets/ui/journey/map/map-platform-background-ch{N}-{shift}.png`
- Metro: `@/assets/ui/journey/map/map-platform-background-ch{N}-{shift}.png`
- Target dimensions: always 1024×1024 (square, used with contentFit="cover" + transform)

## Geometry invariant (across shifts)
Day / Evening / Night share the SAME lanes, clearings, obstacles, landmarks, and world footprint. Only lighting, atmosphere, window glow, and ambient detail change. Buildings and paths never move. The `geometryInvariantNote` field in the spec encodes this constraint for the art generator.

## Environment type mapping (topology family → ChapterEnvironmentType)
- open_plaza → SIMULATION_PLAZA (Ch1)
- academic_quad → ACADEMIC_QUAD (Ch2)
- simulation_complex → CLINICAL_SKILLS_COMPLEX (Ch3)
- hub_and_spoke → EMERGENCY_SIMULATION_CENTER (Ch4)
- twin_hub → MOCK_WARD_CAMPUS (Ch5)
- campus_promenade → MOCK_WARD_CAMPUS (Ch6)
- braided_pathways → DIAGNOSTIC_CENTER (Ch7)
- staggered_academic_blocks → ANATOMY_GARDEN (Ch8)
- serpentine_campus_walk → CLINICAL_SKILLS_COMPLEX (Ch9)
- multi_court_campus → CAPSTONE_CAMPUS (Ch10)

## Shift prompt keywords (must appear in aiPrompt, tested)
- day: 'morning', 'sunlight', 'golden'
- evening: 'amber', 'lantern', 'evening'  ← 'evening' must be literal in the string
- night: 'navy', 'night', 'bioluminescent'  ← 'night' must be literal in the string

## Test file
`frontend/tests/journey_map_background_spec.test.ts` — 46 tests across 11 sections.
All prior suites (config 272, templates 297, blueprint 588, dna 306, pathway_graph 550, hex_layout 59, scenery_layout 51) remain green.
Total tests as of Push 7: 2,169 passed, 0 failed.
