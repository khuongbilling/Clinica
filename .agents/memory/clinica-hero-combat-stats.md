---
name: Hero combat stats data layer
description: HeroCombatStats on Hero+RosterHero; five stats on all 124 heroes; data-only for now (not wired to battle calculations yet).
---

## Rule
`HeroCombatStats` is a **required** field on both `Hero` (content.ts) and `RosterHero` (heroRoster.ts). Any new hero added must include all five stats or TypeScript will reject it.

## Five stats
| Stat | Definition | Role that benefits |
|---|---|---|
| `insight` | Scout, cue reveal, weakness discovery | Scout, Assessor, Analyst, SystemsLeader |
| `carePower` | Stability restoration and recovery | Stabilizer, Restorer |
| `intervention` | Corruption reduction from Treat/Counter | Striker, Specialist |
| `guard` | Stability loss prevention, Instability reduction | Preventer, Coordinator |
| `coordination` | AP efficiency, leader effects, cards, items, Call | Coordinator, SystemsLeader, Educator |

## Rarity ranges
| Rarity | Range |
|---|---|
| common | 5–12 |
| uncommon | 8–16 |
| rare | 12–22 |
| epic | 18–30 |
| legendary (rarity 5 prologue loaners) | 30–45 |
| mythic (rarity 6 The Prodigy) | 38–55 |

## Role emphasis algorithm
- **Primary stat** → upper 35 % of range (e.g. Stabilizer primary = carePower)
- **Secondary stat** → upper 40 % of range (e.g. Stabilizer secondary = guard)
- **Other stats** → lower 65 % of range

Values are seeded from `heroId + ':' + statKey` for determinism. Regenerate with `scripts/add-hero-stats.js`.

## Enemy defense scaling activated in Push 7
Six new optional fields on Enemy (types.ts): `enemyLevel`, `corruptionResistance`, `stabilityPressure`, `hiddenDefense`, `affinityResistance`, `bossGuard`.
Data: scripts/add-enemy-defense-stats.js — lookup table by enemy id, fallback by difficulty tier; bossGuard=true only on verdantha/lord_imbalance/silent_infarct.
Wiring:
- `corruptionResistanceMod = 1 - enemy.corruptionResistance` → strikeMods only (parallel to enemyResistanceMod for stabilize).
- `hiddenDefenseMod = 1 − hiddenDefense × (hiddenClueIds.length / totalHiddenClues)` → all 3 bags; progressive reveal via Scout/Reassess.
- `bossGuard`: caps single-hit corruption reduction to `Math.min(rawAmt, Math.max(1, floor(corruption × 0.40)))` post-calcStrikeEffect.
- `stabilityPressure`: multiplies rawBaseDmg in endPlayerTurn: `baseDmg = ceil(rawBaseDmg × (1 + pressure))`.
- `affinityResistance`: 5th param of calcAffinityFamilyMod; dampens strong-match bonus: `1 + 0.15 × (1 − resistance)`.
Battle logs: bossGuard cap fires "resilience limits impact"; hiddenDefense fires once on turnsTaken===0 if hiddenDefenseMod<0.99.

## Affinity multiplier activated in Push 6
`calcAffinityFamilyMod(heroStrong, heroWeak, enemyPrimary, enemySecondary)` in skillCalc.ts.
×1.15 strong / ×0.90 weak / ×1.00 neutral. Both enemy affinity slots checked (primary + secondary).
Wired into strikeMods/stabMods/shieldMods in `applySkill` only (items/cards/temp stay ×1.00 — no hero ref).
Battle log: '✅ Affinity advantage — effect increased.' / '⚠️ Weak affinity — effect reduced.' (neutral = no log).
Fails safely to ×1.00 when Push-5 data is absent on either side.

## Affinity data added in Push 5 — data layer only
`AffinityFamily` (11-value union) in types.ts. Optional fields on Hero, Enemy, RosterHero.
Heroes get strongAffinities (1-2 entries), weakAffinities (1 entry), roleTags (3 entries) derived from element+role.
Enemies get primaryAffinity, secondaryAffinity?, resistanceTags (2), weaknessTags (3) derived from primarySystem/secondarySystem.
All fields optional (no crash on missing); 124 heroes and 34 enemy objects populated.
No multipliers activated — pure data for future push to wire affinityMod.

## Wired in Push 4 — active modifiers
`statToMultiplier(stat)` and `statForSkillType(type, stats)` in skillCalc.ts.
`heroStatMod` is now live in `applySkill` only (items/cards/temp stay ×1.00).
Shield always uses `hero.stats.guard` via a separate `shieldMods` bag regardless of skill.type.
Skill type → stat: scout/analyze→insight, stabilize/support/cleanse→carePower, strike/counter→intervention, shield→guard, command→coordination.

**Formula:** `×mult = clamp(0.90, 1.35, 1.0 + (stat − 10) / 100)` — every +10 stat = +0.10×.
