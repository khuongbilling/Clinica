---
name: Daily Ward Rounds
description: How the free daily engagement loop (streak + 3 objectives + weekly goal) is wired across the pure module, store fold points, and hub.
---

# Daily Ward Rounds

Free daily engagement: escalating login streak (once/calendar-day, resets on miss),
3 rotating daily objectives drawn only from gate-unlocked modes, and a weekly goal
(complete all objectives N days/week). Only existing currencies (Crowns / Codex
Shards / Insight Crystals) — never a new currency.

## Architecture
`dailyRounds.ts` is the pure logic (types, DAILY_OBJECTIVE_POOL, roll/ensureFresh/
checkIn/recordObjectiveProgress/claim*). It reuses `dateKey`/`weekKey` from
`wellness.ts`. The store holds the only impure wiring.

**Objective progress is credited by threading `foldDailyProgress(state, event)` into
the EXISTING reward-granting action handlers — not a parallel event bus.** Fold points
live in applyRewards (`ward_shift_win`), recordWardWaves (`ward_defense_wave`),
completeLesson (`university_lesson`), logWellnessActivity (`wellness_log`), and the
hero actions summon/recruit/evolve/train (`hero_action`). Adding a new event type
means adding a fold call at its action handler.

**Why:** keeps daily progress consistent with actual rewarded actions and avoids a
second source of truth that can drift.

## Non-obvious rules
- Objectives roll seeded by `hashSeed(playerId + ':' + dateKey)` so they're stable
  per player per day; the pool is filtered to modes passing `checkFeatureGate` first,
  so fewer than 3 appear if fewer modes are unlocked.
- The **weekly goal is credited inside `recordObjectiveProgress`** the first time all
  of a day's objectives complete, guarded by `weekly_credited_dates` (once/day).
  Login check-in alone does NOT credit the weekly goal — you must complete the duties.
- Hub "Rounds" entry (left sideCol in `app/(tabs)/index.tsx`) is gated on
  `!isNewLearner` (>=1 lesson) to respect the University-first onboarding; the panel
  auto-checks-in on open and shows a red count badge for pending check-in + claims.
- Static "Daily Orders" preview card in `events.tsx` graduates by intercepting
  `openEventInfo` for id `daily-orders` and routing to `/(tabs)` instead of the dialog.
- **Recurring lesson still applies:** `daily_rounds` had to be added to backend
  Player + PlayerUpdate + normalize backfill + defaultPlayer, or refresh wipes it.
  Pydantic `DailyRoundsState`/`DailyObjectiveState` field names must match the TS
  interfaces exactly.
