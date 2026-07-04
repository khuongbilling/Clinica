---
name: Ward Defense unit collection + gacha + loadout
description: How the Ward Defense roster became an owned collection with a Crown gacha and a pre-run loadout, and the invariants that keep it safe.
---

# Ward Defense unit collection

Ward Defense units are a persistent collection, not a fixed hand.

- **Single source of truth for the roster**: `frontend/src/game/units.ts` holds display meta
  (name/color/apCost/category/role) in `WARD_UNIT_META`. `ward-defense.tsx` keeps only
  battle-only stats (`UNIT_BATTLE`: damage/attackSpeed/range/aoe/strong/weak/concept/flavor/artsName)
  and merges the two into `UNIT_DATA`. **Why:** the shop and the battle screen must agree on the
  roster; duplicating meta in both drifts. **How to apply:** to add/edit a unit's name/cost/role,
  edit `WARD_UNIT_META`; to tune battle numbers, edit `UNIT_BATTLE`. Never re-add meta fields to
  `UNIT_BATTLE`.

- **Two independent progression axes — do not conflate them**: permanent **Mastery Level** (1-15,
  stored in `owned_units: Record<id, level>`) vs temporary in-battle **Merge Rank** (1-5, named
  Novice→Ascended via `mergeRankName()`, reset every run, stored only on `DeployedUnit.level`).
  Mastery is raised via `upgradeUnitMastery` spending `unit_shards` (from gacha dupes) + crowns
  ("Ward Coins") per `getMasteryRequirement`. Merge Rank is raised by combining two same-rank
  deployed copies mid-battle (`findMergePair`, capped at `MERGE_RANK_CAP`=5). Combat damage in
  `getScaledStats(def, mergeRank, masteryLevel)` multiplies BOTH independently
  (`MERGE_RANK_DMG_MULT[rank-1]` × `1 + UNIT_LEVEL_DMG_STEP*(masteryLevel-1)`). **Why:** the user
  explicitly required these stay separate systems so permanent collection progress and one-run
  tactical merging both matter. **How to apply:** any new unit-power feature must decide which axis
  it belongs to and never write mastery data into a `DeployedUnit`, or vice versa.

- **Role-specific stats + milestones**: `UNIT_STAT_BLOCKS[typeId]` defines per-unit stat keys with a
  `base` + `perLevel` growth curve; `getMasteryStats(typeId, level)` computes current values,
  `unlockedMilestones(typeId, level)` returns milestone unlocks at levels 5/10/15. Shown in the
  shop's per-unit info modal (Overview/Stats/Merge/Milestones/Counters/Lore tabs).

- **Loadout invariant — sanitize on BOTH read and run, never trust stored data**: a persisted
  `ward_loadout` can be malformed (duplicates, unowned ids, or longer than `LOADOUT_SIZE`=5).
  `sanitizeLoadout(ids, owned)` (dedupe + owned-only + cap 5) must run in `normalizeProgression`
  (read path, always — not just when empty) and again in `startGame` before battle. **Why:** a code
  review caught that filtering-but-not-capping in `startGame` let >5 units be deployable, breaking the
  "up to 5" rule. **How to apply:** any new entry point that turns stored loadout into a playable set
  must pass it through `sanitizeLoadout`, then fall back to `STARTER_UNIT_IDS` if empty.

- **Battle gating**: `GS.loadout` (+`GS.unitLevels` = mastery levels) are seeded in
  `freshState(boost, loadout, unitLevels)`. `HandPanel` renders `loadout` (falls back to all types
  only if empty); `deployUnit` rejects any `selectedUnit` not in `GS.loadout`. Lobby picker toggles
  up to `LOADOUT_SIZE` via `setWardLoadout`.

- **Pages that gate on `player` differ**: `shop.tsx` blocks its entire render behind
  `if (!player) return <Loading/>` (stuck forever if no local/backend player exists yet — e.g. a
  fresh browser profile that hasn't gone through onboarding's "Begin Healing"/"Quick Start").
  `ward-defense.tsx` instead reads `player` optionally and falls back to `STARTER_UNIT_IDS`/defaults
  so the lobby still renders without one. **Why:** this is intentional, not a bug — don't "fix" shop
  to match ward-defense's fallback behavior without checking with the user first.
