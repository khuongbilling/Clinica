---
name: Centralized skill effect calculation
description: skillCalc.ts owns the SkillModifiers bag and three calc functions used by all four battle handlers; future modifier slots are pre-wired at ×1.00.
---

## Rule
All skill effect resolution (strike / stabilize / shield) goes through `frontend/src/game/skillCalc.ts`. Do not call `combineFinalEffect` from `battle.ts` — it is no longer imported there.

## Architecture
- `SkillModifiers` interface: one field per modifier, every future slot already present.
- `neutralModifiers()`: all fields at ×1.00 (or 0 for additive bonuses). Spread + override only what differs.
- `calcStrikeEffect(base, mods)` — element bonus is a fraction (0.3) applied as `base × (1 + elementBonus)` before the multiply chain.
- `calcStabilizeEffect(base, mods)` — `cueBonusFlat` added AFTER core multiply but BEFORE `stabilityGainMod × enemyResistanceMod` (preserves historical position).
- `calcShieldEffect(base, mods)` — no clinical/affinity/cast; future hero-stat slots only.

## Handler-specific notes (preserved inconsistencies)
| Handler | castMult | chapterMod (treatMod) | elementBonus |
|---|---|---|---|
| `applySkill` | ✅ | ✅ | ✅ |
| `useItem` | ❌ (1.0) | ✅ strike only | ❌ |
| `applyTempAction` | ❌ (1.0) | ❌ | ❌ |
| `applyCard` | ❌ (1.0) | ❌ | ❌ |

These gaps were pre-existing and intentionally preserved. If a future push normalises them, update all four handlers together.

## Future modifier activation (Push 3+)
- `heroStatMod`, `heroLevelMod`, `playerClassMod`, `careChainMod`, `clinicalCueMod` → `calcStrikeEffect` and `calcStabilizeEffect` already multiply them; just set real values when building the mod bag.
- `equipmentMod`, `leaderBonusMod` → same.
- `calcShieldEffect` includes `heroStat/level/equipment/leader/class/chain` but NOT `clinical/affinity/cast` — shield remains a hard percentage.

**Why:** Kept `skillCalc.ts` import-free from `battle.ts` to avoid circular deps. Builder calls live inside `battle.ts` (which already imports from `clinical.ts`).
