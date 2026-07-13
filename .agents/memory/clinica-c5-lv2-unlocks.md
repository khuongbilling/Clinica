---
name: C5 Level 2 unlocks
description: Summoning Hall and Daily/Weekly Rounds gate at Level 2; seen_lv2_unlock one-time modal pattern.
---

## Rule
- `hall_of_heroes` in FEATURE_UNLOCKS: Level **2** (was Level 3). The `lessonsStarted` narrative gate was removed entirely — Level 2 is sufficient.
- `daily_rounds` added to FEATURE_UNLOCKS at Level **2**.
- Hub `Rounds` button gate: `playerLevel >= 2` (was `!isNewLearner` = lessons done).
- Hub `Summon` button: right column, gold sparkles, Level 2 gate.

## seen_lv2_unlock flag
Three required wiring sites (same pattern as all one-time seen flags):
1. `types.ts` — `seen_lv2_unlock?: boolean`
2. `server.py` — `Player.seen_lv2_unlock: bool = False` AND `PlayerUpdate.seen_lv2_unlock: Optional[bool] = None`
3. `store.tsx` normalize backfill — backfill as `true` for existing Level 2+ players (they skip the modal), `false` for Level 1 players; `createPlayer` default = `false`

**Why:** Backfilling Level 2+ players as `seen=true` prevents the celebration modal from surprising returning players who were already past Level 2 before C5 shipped.

## Lv2UnlockModal stacking guard
The modal useEffect in hub index.tsx is gated on `!showIntro` so it never stacks with the intro welcome modal (both are hub-level bottom sheets).

## Currency simplification
PlayerHeader's progressive reveal already handles this correctly:
- Level 1: Stamina + Ward Coins only
- Level 2 (shop gate): Refined Lotus Gems chip appears
- Paid gems: only if balance > 0
No additional wiring needed for C5.

## Five canonical currencies
Ward Coins, University Credits, Summoning Shards (was "Codex Shards" in UI — renamed label only, field stays `player.codex_shards`), Refined Lotus Gems, Lotus Gems (paid).
