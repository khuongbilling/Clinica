---
name: Clinica prologue scripted-loss boss
description: How the Push 1 prologue's forced-to-lose "Silent Infarct" boss battle is kept from ever accidentally winning or granting normal rewards.
---

Some story beats require a battle the player is meant to lose no matter how well they play (e.g. a hidden/incurable pathology). Two things are required together, not just clinical difficulty tuning:

1. **A hard state-machine safety net**, independent of the normal win/loss math (stat tuning alone is not guaranteed) — e.g. a turn-count cap that force-sets `outcome: "loss"` if the fight is still `"ongoing"` past a generous number of turns.
2. **A `finish()` short-circuit** that checks the scripted-loss flag *before* any normal reward/XP/Game-Over branching runs, and routes straight to the narrative follow-up screen regardless of the computed outcome.

**Why:** Without both, a sufficiently good/lucky player can either "win" a fight that must always be lost, or trigger the normal Game Over / reward pipeline that doesn't make sense for a scripted story beat.

**How to apply:** When adding any other forced-outcome encounter, mirror this pattern: flag the enemy/encounter (e.g. `scriptedLoss: true` on the enemy definition), gate a turn-cap-forcing `useEffect` on that flag, and add an early return in the battle's `finish()` that bypasses normal reward/summary logic and routes to the intended cutscene/next screen.
