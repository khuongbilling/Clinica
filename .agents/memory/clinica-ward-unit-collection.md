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

- **Two persisted PlayerState fields**: `owned_units: Record<id, level>` and `ward_loadout: id[]`.
  Both MUST exist on backend `Player` AND `PlayerUpdate` (see general clinica memory) or refresh
  wipes them. Starters = `STARTER_UNIT_IDS` (3). Dupes level a unit up to `MAX_UNIT_LEVEL` (5);
  each level adds `UNIT_LEVEL_DMG_STEP` (+8%) damage via `getScaledStats(def, deployLevel, unitLevel)`.

- **Loadout invariant — sanitize on BOTH read and run, never trust stored data**: a persisted
  `ward_loadout` can be malformed (duplicates, unowned ids, or longer than `LOADOUT_SIZE`=5).
  `sanitizeLoadout(ids, owned)` (dedupe + owned-only + cap 5) must run in `normalizeProgression`
  (read path, always — not just when empty) and again in `startGame` before battle. **Why:** a code
  review caught that filtering-but-not-capping in `startGame` let >5 units be deployable, breaking the
  "up to 5" rule. **How to apply:** any new entry point that turns stored loadout into a playable set
  must pass it through `sanitizeLoadout`, then fall back to `STARTER_UNIT_IDS` if empty.

- **Battle gating**: `GS.loadout` (+`GS.unitLevels`) are seeded in `freshState(boost, loadout, unitLevels)`.
  `HandPanel` renders `loadout` (falls back to all types only if empty); `deployUnit` rejects any
  `selectedUnit` not in `GS.loadout`. Lobby picker toggles up to `LOADOUT_SIZE` via `setWardLoadout`.
