---
name: Clinica ChapterPartType exhaustiveness
description: Adding a new ChapterPartType value requires updating ALL Record<ChapterPartType,...> maps.
---

## Rule

`ChapterPartType` is a union type in `chapterJourney.ts`. `ChapterJourneyMap.tsx` has two exhaustive `Record<ChapterPartType, string>` maps: `PART_TYPE_LABEL` and `PART_TYPE_COLOR`. TypeScript will error if a new type value is missing from either map.

**Why:** TypeScript enforces exhaustiveness on `Record<K, V>` when K is a union — missing keys are compile errors. Caught in Push 1 when `memory_fragment` and `challenge` were added.

**How to apply:** Whenever a new value is added to `ChapterPartType`, immediately add matching entries to both `PART_TYPE_LABEL` and `PART_TYPE_COLOR` in `ChapterJourneyMap.tsx`.

## Co-ownership: chapterJourney.ts ↔ journeyRewards.ts

Node IDs (e.g. `c1n1`…`c1n6`) are defined in `chapterJourney.ts` but also appear as keys in `journeyRewards.ts` (reward defs) and `SCENE_TO_NODE` map. When chapter structure changes, **both files must be updated in the same pass** or rewards silently miss.

Also update `store.tsx` `normalizeProgression` to map any renamed legacy IDs for existing players.
