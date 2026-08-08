---
name: Fog-map encounter wiring
description: Push 12 encounter resolution architecture — battle routing, return flow, pure resolution functions, modal pattern.
---

## Key design decisions

### Pure resolution layer
`encounterResolution.ts` owns all tile-state mutations. All functions are idempotent and side-effect-free. Caller persists via `repo.saveRun()`.

### Battle return flow (three-file chain)
1. `fog-map.tsx` → `router.replace('/battle', { journeyReturn:'1', journeyChapterId, journeyTileId, journeyIsAreaBoss, journeyIsChapterBoss })`
2. `battle.tsx` → reads those params + threads them into `router.replace('/result', { ...all_battle_params, journeyReturn, journeyChapterId, journeyTileId, journeyIsAreaBoss, journeyIsChapterBoss })`
3. `result.tsx` → detects `journeyReturn==='1'`, routes CLAIM/VIEW buttons to `dynRoute.chapterFogMap(journeyChapterId)` with `{ resolvedTileId, outcome, journeyIsAreaBoss, journeyIsChapterBoss }` params
4. `fog-map.tsx` on remount → reads those params, fires `useEffect` gated by `battleResultApplied` ref (prevents double-resolution), calls the right resolve fn.

**Why:** Expo Router replaces don't preserve component state; threaded params are the only reliable way to communicate battle outcome back to the map.

### Dynamic route name
`dynRoute.chapterFogMap(id)` — NOT `dynRoute.fogMap`. TypeScript catches this at compile time.

### Gate interaction
- Tapping the gate TILE on the hex map → `handleGateTap()` (no stamina cost, no movement).
- "ENTER CHAPTER BOSS" button in the gate section panel also calls `handleGateTap()`.
- Gate tile validation is short-circuited before `validateMove` — never runs through the stamina + movement pipeline.

### Encounter dispatch order (handleTilePress)
1. `isGate` → `handleGateTap()` + return
2. `none` → `resolveNone` inline (no modal)
3. `battle` / `areaBoss` → `navigateToBattle()` + return (saveRun before navigating)
4. `treasure` → `setTreasureModalTileId` + return
5. `merchant` → `resolveMerchantVisit` (marks resolved) + `setMerchantModalTileId` + return

### Modal placement
TreasureModal and MerchantModal are mounted OUTSIDE the ScrollView, below BottomNav, inside the root `<View>`. They use React Native `<Modal>` (full-screen, transparent, animationType="fade") so they correctly overlay the map on both web and native.

### Enemy derivation
`deriveEnemyId(runSeed, tileId, chapterId)` — FNV-1a hash of `"${seed}:${tileId}"` → index into chapter pool. Same triple always gives same enemy (no reroll). Chapter pools are hardcoded by difficulty range. `getAreaBossEnemyId`/`getChapterBossEnemyId` return fixed per-chapter enemies.

**Why:** Storing enemyId on the tile would require a schema migration; derivation is stable and cheaper.

### `battleResultApplied` ref guard
Without this, the `useEffect([run, resolvedTileId, outcome, ...])` would re-fire on every re-render after run loads. The ref is reset on component unmount (natural cleanup). Double-resolution is also idempotent in the pure fns, so this is belt-and-suspenders.

### Treasure rewards pipe
`resolveTreasureClaim(run, tileId)` returns `{ run, rewards }`. Caller calls `applyRewards({ xp, crowns, codexShards: shards, ... })` separately. This keeps the pure layer independent from the store.

## Test coverage
37 pure-function tests in `tests/encounters.test.ts`. Total suite: 124/124.
