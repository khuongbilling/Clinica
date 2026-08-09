---
name: Authored chapter map templates
description: Journey map geometry is fixed authored data per chapter; run seed randomizes encounters only; per-shift map backgrounds are dedicated raster assets.
---

**Rule:** Each chapter owns ONE fixed hex-map geometry (coords, shape, count, start, boss gate). Ch1–10 are checked-in literal data in `chapterMapTemplates.ts` (`AUTHORED_CHAPTER_MAPS`) — NEVER edit a shipped entry, it redraws the canonical map for every player. Ch11+ fall back to a fixed per-chapter design seed; snapshot into the literal table when they ship.

**Why:** A seed-derived template is only deterministic for one code version — any generator/PRNG/tile-count change would silently redraw shipped maps. Checked-in data survives code changes.

**How to apply:**
- `generateRunData` and legacy `createRun.ts` take geometry from `getChapterMapTemplate(chapter)`; the run seed feeds ONLY the encounter layer. Never reintroduce seed-derived topology on a run-creation path.
- `getChapterMapTemplate` returns a defensive copy every call — keep it that way; callers mutate the result freely.
- All shifts share the same geometry; shift changes only encounter distribution + presentation. Fog-map background is selected by `run.shift` from dedicated raster webp assets (`map-platform-background-{day,evening}.webp`; the original dark webp = NIGHT). Final shift art must be raster, never CSS filters.
- Tests: `tests/journey_map_templates.test.ts` (in `npm test` chain) asserts geometry identical across seeds/shifts, encounters vary, connectivity, mutation immunity.
