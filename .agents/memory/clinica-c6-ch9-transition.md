---
name: Clinica C6 — Chapter 9 Real-Ward Transition
description: Architecture decisions for the simulation→real-ward boundary and Chapter 9 enemy system.
---

## Rules

### Enemy difficulty MUST equal chapter.number
`ChapterJourneyMap.tsx` counts battles as: `ENEMIES.filter(e => e.difficulty === chapter.number && !e.worldBoss)`. Any Chapter 9 enemy MUST have `difficulty: 9` or it silently appears in the wrong chapter's battle-cleared counter.

**Why:** The filter was already there pre-C6. Discovered when drought_river_shade and confusion_veil were set to difficulty:8 — they would have counted as Ch8 enemies.

**How to apply:** All future chapter-N enemies must use `difficulty: N` regardless of intended combat difficulty. Adjust perceived difficulty via stats (corruption/instability/stabilityResistance/hiddenClues ratio), not the `difficulty` field.

### simulationEra flag pattern
`Chapter` interface has `simulationEra?: boolean`. Chapters 1-8 are tagged `simulationEra: true`. `ChapterJourneyMap` renders a muted SIMULATION badge for these. Chapter 9 gets `realWorldTransition: true` (REAL WARD badge, existing). Chapter 10 gets `phaseFinale: true` (PHASE FINALE badge).

**How to apply:** Any future "era" grouping uses this same optional-flag + conditional badge pattern. Do not add a free-form enum; keep flags independent.

### chapterGate field (advisory only)
`Enemy.chapterGate?: number` documents which chapter first introduces an enemy. It is NOT currently enforced by any pool logic — `pickDailyShift()` is hardcoded and does not read chapterGate. If a future dynamic shift pool is added, filter `e.chapterGate <= playerChapter` there.

### Story scene art stand-in
Story scenes require `art: number` (required field, a `require()` image). When a dedicated asset doesn't exist, reuse the closest thematic existing asset and note it in a comment. Chapter 9 uses `chapter_01_opening.png` (ward corridor). Future: commission `chapter_09_opening.png`.

### simulationCounterpart link
All Ch9 enemies carry `simulationCounterpart: 'source_id'`. This is metadata for future UI (e.g., a "you faced the simulation version of this" note on the result screen). Not read by any game logic today.
