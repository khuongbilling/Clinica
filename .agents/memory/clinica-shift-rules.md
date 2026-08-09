---
name: Chapter shift rules & canonical shift
description: How Journey run TimeOfDay is chosen, persisted, and threaded to battle (Book I canon)
---

# Chapter shift rules (Book I canon)

- `chapterShiftRules.ts` is the ONLY place that decides a run's shift: Ch1-3 fixed day; Ch4 choice day/evening; Ch5-6 inherit Ch4; Ch7 choice all; Ch8 inherits Ch7; Ch9 choice; Ch10 finale (all). `availableShifts()` (bookOneUnlocks) is player unlock only — never route-determining.
- **Never use the device clock** (`getCurrentShift`) for run creation — it's kept for ambience only. Repository `create*` methods take an explicit `shift` resolved by the caller.
- Canonical shift = first clear of a choice chapter, persisted in `PlayerState.canonical_shifts` (write-once store action `setCanonicalShift`; backend Player+PlayerUpdate `canonical_shifts`). Recorded in fog-map at chapter-boss clear via `isCanonicalChoiceChapter`.
- Pre-clear rechallenge + recovery inherit the prior run's `shift`; post-clear challenge defaults to prior/canonical shift.
- Battle bridge: run.shift → `journeyShift` route param → `InitBattleOptions.shift` → `BattleState.shift`, and MUST be forwarded battle→result→fog-map return params or the round-trip drops it. Pass-through only so far; `shiftOrchestration.ts` behaviors not yet wired into battle.ts.
- fog-map reads canonical/param values through always-fresh refs (`canonicalShiftsRef`/`requestedShiftRef`) — effects there have deliberately narrow dep arrays; don't switch back to closure reads.

**Why:** review found stale-closure run creation and shift loss on battle return; clock-derived shifts conflicted with canon.
**How to apply:** any new run-creation path or battle-return param set must thread shift explicitly.
