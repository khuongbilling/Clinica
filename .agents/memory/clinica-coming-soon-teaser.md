---
name: Clinica coming-soon teaser (chapter-gated)
description: How future/placeholder content is surfaced — one teaser at a time, gated by chapter.
---

# Coming-soon content is teased ONE at a time, gated by chapter

The Ward Operations (Shift) hub does NOT list every future mode. It surfaces only the single next event/content via `nextComingSoonMode(chapter_progress)` in `src/game/modeHub.ts`.

- Each `coming_soon` `ModeCardDef` carries an `unlockChapter` (rollout order). `COMING_SOON_MODES` = all coming_soon modes sorted by `unlockChapter`.
- `nextComingSoonMode(ch)` returns the earliest mode whose `unlockChapter > ch` (else `undefined`, and the whole "Coming Soon" section disappears).
- `player.chapter_progress` (optional number, defaults 1; advanced via `Math.max` in `store.tsx`) is the gate.

**Why:** User asked to hide all not-yet-unlocked placeholders and show only the next event/content based on chapter, instead of a cluttered wall of ~6 "coming soon" cards.

**How to apply:** To add a future mode, set `status: "coming_soon"` + an `unlockChapter` and it slots into the rollout automatically. Do NOT re-introduce a full placeholder list on the hub. `unlockChapter` is a display/teaser gate only — these modes have no route and never actually activate. If this one-at-a-time behavior is ever wanted on other surfaces (shop stalls, kingdom buildings, university future modes), reuse `nextComingSoonMode`-style logic rather than duplicating.
