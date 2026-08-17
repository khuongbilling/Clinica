---
name: Canonical map artifact bridge
description: How chapters are migrated from authored circular blobs to the blueprint pipeline; wiring pattern, map identity persistence, staleness discipline, and spatial encounter placement.
---

# Canonical Map Artifact — Production Bridge

## Rule
A chapter is "on the pipeline" when it appears in `BLUEPRINT_PIPELINE_CHAPTERS` (config.ts). That set currently contains `{1}`.

- `generateRunData()` in `journeyRunLifecycle.ts` checks this set FIRST, before `isAuthoredChapter()`.
- When the chapter is in the set, `getCanonicalChapterMapArtifact(chapter)` is called and its geometry replaces the authored blob. Zone metadata flows into every `JourneyTile`.
- Ch2–10 still use authored circular geometry. Ch11+ use procedural BFS.

## Map geometry identity (Push 2)
`JourneyRun` now carries `mapLayoutVersion`, `mapBlueprintHash`, `topologyFamily?` — set at creation, never mutated.

`getActiveRun()` in `journeyRunRepository.ts` checks these for blueprint chapters:
- Stale run (hash='', version='legacy'): abandoned → rechallenge lifecycle runs
- Current run (hash matches artifact.blueprintHash, version matches): accepted
- Tile count check runs FIRST (fast path), then identity check for blueprint chapters

Identity field values by chapter type:
- Blueprint (BLUEPRINT_PIPELINE_CHAPTERS): version='v1', hash=artifact.blueprintHash, family=dna.topologyFamily
- Authored (Ch2-10): version='authored', hash=fnv1a32(sorted tile keys), family=undefined
- Procedural (Ch11+): version='procedural', hash=fnv1a32(seed+sorted tile keys), family=undefined
- Legacy (pre-Push-2 runs read from backend): version='legacy', hash='' (from ?? fallback in fromWire)

`generateRunData` returns `GenerateRunDataResult` with all 3 identity fields. `_buildNewRun` in repository destructs and threads them through `buildInitialJourneyRun` → `JourneyRun`.

Backend: `JourneyRunCreate` in server.py has `map_layout_version`, `map_blueprint_hash`, `topology_family` with defaults. Stored via model_dump() automatically. `JourneyRunSave` does NOT include them (immutable).

`createRun.ts` is a legacy factory bypassing generateRunData — it computes identity inline using fnv1a32 directly.

## Spatial encounter placement (Push 3)
`encounterSpatialWeights.ts` is a pure module that computes per-tile weight multipliers based on zone metadata. These multipliers are applied to `liveWeights` in `assignCanonicalEncounters()` AFTER hard caps and BEFORE the weighted roll.

**Key rules enforced:**
- `areaBoss`: multiplier = 0 on lane/transition tiles (CLEARING ONLY); 2.0× on clearing to partially compensate
- `merchant`: multiplier = 0 on primary lane (FORBIDDEN); 0.15 on secondary lane; 3.0× on clearing
- `battle`: 0.65× on clearing (open space); 1.15–1.20× on lane (conflict zone)
- `treasure`: 1.80× on clearing; 0.50× on primary lane; dead-end floor = 2.5×
- `wardEvent`: 2.50× on clearing; 0.30× on primary lane; dead-end floor = 1.5×
- `none` is NEVER multiplied — absorbs redistribution naturally

**What is NOT changed:** `canonicalConfig.ts` rate tables. Encounter percentages (30% battle, 5% treasure, etc.) remain as defined.

**For non-blueprint chapters** (authored/procedural): `computeSpatialMultipliers` returns `{}` → all weights unchanged → behaviour identical to pre-Push-3.

**Integration discipline:** Spatial multipliers apply to `liveWeights` only; they don't affect the PRNG stream (rolls happen after multipliers, using the same stream). Determinism is fully preserved.

## Migration discipline
1. Add the chapter to `BLUEPRINT_PIPELINE_CHAPTERS` only after DNA and pipeline outputs are accepted.
2. NEVER remove a chapter once players have active runs on it (stale-run guard abandons old runs, which is acceptable, but rolling back would re-expose the old blob).
3. Bump `MAP_LAYOUT_VERSION` in `canonicalMapArtifact.ts` whenever any geometry-affecting module changes.

## Ch1 / Ch2 DNA swap (Push 1)
Ch1 was `open_plaza` (circular blob), now `academic_quad` (campus lanes, 2 loops, 2 hubs, diagonal start-gate).
Ch2 was `academic_quad`, now `open_plaza` (wide, 1 loop, 1 hub, opposite start-gate).
Swap was required to avoid two consecutive chapters sharing the same topologyFamily (diversity rule).

## Key files
- `canonicalMapArtifact.ts` — single production entry point; composes DNA→Graph→HexLayout→Scenery→BackgroundSpec; caches per-chapter; exports `getCanonicalChapterMapArtifact`, `MAP_LAYOUT_VERSION`, `CanonicalChapterMapArtifact`
- `config.ts` — `BLUEPRINT_PIPELINE_CHAPTERS = new Set<number>([1])`
- `encounterSpatialWeights.ts` — **Push 3** pure module; `computeSpatialMultipliers(SpatialWeightInput)` returns `Partial<Record<string, number>>`; `none` never included; empty object for non-blueprint tiles
- `canonicalEncounters.ts` — imports `computeSpatialMultipliers`; extends `EligibleEntry` with zone fields; builds `tileCoordSet` for dead-end detection (degree=1); applies spatial multipliers after hard caps
- `topology.ts` — `HexTileZoneMeta` type; optional `zoneMeta?: Map<string, HexTileZoneMeta>` on `HexTopology`
- `types.ts` — `JourneyTile` optional zone fields; `JourneyRun` required `mapLayoutVersion`/`mapBlueprintHash`, optional `topologyFamily?`
- `journeyRunLifecycle.ts` — `generateRunData` returns `GenerateRunDataResult` with identity fields; `buildInitialJourneyRun` carries them; `BuildRunOptions` includes all 3
- `journeyRunRepository.ts` — WireRun optional snake_case zone identity fields; fromWire fallbacks; toWire sends all 3; getActiveRun blueprint identity check; `_buildNewRun` destructs all 3
- `createRun.ts` — legacy factory; computes identity inline with fnv1a32
- `backend/server.py` — `JourneyRunCreate` has the 3 identity fields with defaults
- Tests: `journey_map_canonical_artifact.test.ts` (26), `journey_map_run_identity.test.ts` (24), `journey_map_spatial_weights.test.ts` (29) — all wired into `npm run test`

## Next push candidate
Production Bridge Push 4: Replace the static chapter 1 background PNG with blueprint-driven art (wire `BackgroundSpec.aiPrompt` to generate/load the correct background). Remove the "BACKGROUND NOT YET SYNCED" DevDiagnostics warning when done.
