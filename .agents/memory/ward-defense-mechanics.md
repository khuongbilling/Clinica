---
name: Ward Defense Mechanics (v2)
description: All 5 new mechanics + Serpentine Descent path; how they're wired and where to extend.
---

## Serpentine Descent path (Option B)
- 12 waypoints (N_SEGS=11): gate → left down → sweep right above row 1 → drop to row 2 → sweep left through center pad → drop to row 3 → sweep right → bottom → right outer lane → lantern
- PATH_WPS **must stay identical** in `ward-defense.tsx` and `WardBoardV2.tsx`

## Status affliction (condition badges)
- `ENEMY_CONDITION` maps each enemy type → `ConditionId` (breathless/feverish/septic/toxic/agitated/altered/airborne)
- Assigned at spawn; stored as `ActiveEnemy.condition`
- `CONDITION_BONUS_UNITS` maps condition → unit type IDs that get +20% damage bonus (applied in projectile hit loop, after getMatchQuality/applyDmg)
- Visual: small colored pill below enemy name in `EnemyOnPath`

## Corruption spread
- On each enemy that leaks past the lantern: nearest unoccupied, uncorrupted tile locked for `CORRUPTED_TILE_TICKS` (160 ticks = 80s)
- `GS.corruptedTiles: Record<number, number>` — tileIndex → remaining ticks; decays every tick
- `deployUnit` checks `corruptedTiles[tileIdx]` and blocks with a feedback message
- Visual: purple overlay + skull + countdown in `StonePad` (isCorrupted / corruptedTicks props)

## Code Blue surge
- Each tick counts path enemies (not air-lane) inside `CENTER_ZONE = {xMin:0.20, xMax:0.80, yMin:0.30, yMax:0.70}`
- If count ≥ `CODE_BLUE_THRESHOLD` (5) and not already active: set `codeBlueActive=true`, `codeBlueTicks=CODE_BLUE_TICKS` (200)
- While active: all enemies get `codeBlueMul = CODE_BLUE_SPEED_MULT` (1.25) on their speed
- Decays each tick; once `codeBlueTicks=0` the surge ends
- Visual: red border + "CODE BLUE — SURGE ACTIVE" overlay in `WardBoardV2` (zIndex 18, pointerEvents none)

## Triage tap
- `triageTarget(enemyUid)` handler: tap enemy → set `priorityTargetUid`; tap again → clear
- Unit attack target loop: if `s.priorityTargetUid` enemy exists and is in range, prefer it over nearest
- Priority target uid is cleared when enemy is killed (in post-survEnemies block)
- Visual: glowing red ring around enemy (`isPriority` prop), "🎯 TRIAGE" badge below sprite

## Air-lane enemies (spore_drift)
- `spore_drift` in `ENEMY_DATA` — `speed: 0.012` (0→1 in ~83 ticks = 42s)
- Spawned with `isAirLane: true`, `airProgress: 0`; `condition: "airborne"`
- Movement: ignores PATH_WPS; `airProgress += speed * codeBlueMul` per tick; reaches lantern when ≥1.0
- Position: lerp from `AIR_LANE_FROM=[0.122,0.13]` to `AIR_LANE_TO=[0.825,0.13]` (straight across the top)
- `getEnemyPosFrac` and `getEnemyFrac` (WardBoardV2) both branch on `e.isAirLane`
- Visual: semi-transparent smaller sprite (36×36), trailing glow halo, always faces right, no name label

## Extension notes
- Add a new air-lane enemy: set `isAirLane` would need to be a field on `EnemyDef` (currently hardcoded `typeId === "spore_drift"` in spawn logic) — add `isAirLane?: boolean` to `EnemyDef` if more air lane types are added
- Add more conditions: extend `ConditionId` union, `CONDITION_DEF`, `ENEMY_CONDITION`, `CONDITION_BONUS_UNITS`, `CONDITION_COLOR`, `CONDITION_ICON` (WardBoardV2)
- Code Blue visual could be enhanced with a pulsing animation using `Animated.loop`
