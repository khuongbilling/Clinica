---
name: Class tree battle bonus pattern
description: How Push 11 wires the 6-class combat bonus system into battle — pre-computation in battle.tsx, BattleState fields, and per-handler activation points.
---

## Pattern
`ClassTreeBattleBonus` is **pre-computed in `battle.tsx`** from `player.class_tree_id` + `player.class_progress[classId]` using `getClassTreeBattleBonuses()`, then passed as `InitBattleOptions.classTreeBonus`. `battle.ts` seeds it into `BattleState.classBonus` at `initBattle` and reads `s.classBonus` in every action handler — it never imports `classTree.ts` directly.

**Why:** Keeps the dependency graph clean (classTree → battle is a one-way optional dependency).

## New BattleState fields (Push 11)
- `classBonus: ClassTreeBattleBonus | null` — set once at initBattle, never mutated
- `classFirstScoutUsed: boolean` — Seer's first-scout extra-reveal fires once per battle; set true on first scout action
- `classStabilizeUsedThisTurn: boolean` — Caretaker combo flag; set true when a stabilize skill fires; reset false in `endPlayerTurn`

## Per-handler activation map
| Handler | Slots/fields activated |
|---|---|
| `applySkill` strikeMods | `playerClassMod: cb?.strikeMod` |
| `applySkill` stabMods | `playerClassMod: cb?.stabilizeMod` |
| `applySkill` shieldMods | `playerClassMod: cb?.shieldMod` |
| `applySkill` scout reveal | `scoutRevealBonus` + `scoutFirstActionRevealBonus` (first-scout guard) |
| `applySkill` stabilize block | sets `classStabilizeUsedThisTurn = true` |
| `applySkill` Reassess chainRole | Caretaker combo: `reassessAfterStabilizeBonus` if `classStabilizeUsedThisTurn` |
| `applyResolutionToState` chain completion | `careChainMod` scales both `fullChainCorruptionDamage` and `fullChainStabilityBonus` |
| `useItem` itemStrikeMods + itemStabMods | `playerClassMod: itemCb?.itemMod` |
| `applyCard` cardStrikeMods | `playerClassMod: cardCb?.strikeMod` |
| `applyCard` cardStabMods | `playerClassMod: cardCb?.stabilizeMod` |
| `answerClinicalCue` correct | `cueBonusStabilize += cueBonusFlatBonus` (Scholar) |
| `endPlayerTurn` damage calc | `incomingDamageReduction` reduces `reduced` before stability loss (Guardian) |
| `endPlayerTurn` next state | resets `classStabilizeUsedThisTurn: false` |

## apBonus startApBonus (Medic)
Added in `battle.tsx` initBattle opts: `+ (!isPrologueLoanerBattle ? (classTreeBonus?.startApBonus ?? 0) : 0)`

## UI
`describeClassBattleBonuses(getClassTreeBattleBonuses(activeId, progress))` renders the "ACTIVE BATTLE BONUSES" card on `class-tree.tsx`. Shows bonuses for whichever class is currently being previewed (not just the player's active class).

## Prologue guard
`classTreeBonus = null` for `isPrologueLoanerBattle` — all bonus slots fall back to neutral (1.0 or 0) via optional-chaining defaults.

## How to apply
- New class bonus type: add a field to `ClassTreeBattleBonus`, implement in `getClassTreeBattleBonuses`, wire in the appropriate handler(s), add a line to `describeClassBattleBonuses`.
- `playerClassMod` and `careChainMod` slots in `SkillModifiers` are now active; `careChainMod` was the last "future" slot (equipmentMod is Push 10, still pending).
