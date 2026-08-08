---
name: Fog-map chapter progress and challenge flow
description: Push 13 chapter summary card — live data, active/cleared branches, Challenge Chapter confirmation flow.
---

## exploredTileCount / tileCount

`exploredTileCount` = tiles where `visited === true` — set by `applyMoveToRun` only when the player physically steps on a tile. Frontier tiles never count. The denominator `tileCount` excludes the gate tile (see `buildInitialJourneyRun`: `tileCount = topology.tiles.length - 1`).

Both fields are already tracked correctly; no new math needed.

## isCleared check

```typescript
const isCleared = run?.status === 'cleared';
```

`status === 'cleared'` is the authoritative field. `chapterBossDefeated` is a supporting flag but `status` is set by `resolveChapterBossWin` immediately (in-memory) and confirmed by `repo.markRunCleared()` (async). They stay in sync.

## Challenge Chapter flow (no navigation)

After `challengeChapter(playerId, chapterId, repo)` resolves:
- Call `setRun(newRun)` directly — the component re-renders with the new active run immediately.
- No `router.replace()` needed — the same mounted component handles both active and cleared states.
- Reset refs: `battleResultApplied.current = false`, `movingRef.current = false`.
- State machine: `'idle' | 'confirming' | 'creating' | 'error'` — never trigger on load.
- Use inline confirmation panel (NOT `Alert.alert` — unreliable on web per memory).

## TREASURE_REWARDS import

`TREASURE_REWARDS` is a named export from `encounterResolution.ts`. It must be explicitly added to the import statement — it is NOT re-exported automatically when the file is imported.

## Chapter accent color

```typescript
const accentColor = chapter?.accentColor ?? UI.jade;
```

Used for the cleared badge, stat values, Challenge button border/bg. `C` palette in chapterJourney.ts provides one color per chapter number.

## Reward accounting

- `chapter.completionXp` is the boss-clear XP bonus (granted in post-battle effect via `applyRewards`).
- Chest totals computed from `run.tiles` filtered by `rewardClaimed === true`, summed through `TREASURE_REWARDS[tier]`.
- Battle rewards are tracked by the battle system — summary card shows chest + completion bonus only.

## Cleared state timing

`resolveChapterBossWin(run)` sets `status: 'cleared'` in-memory immediately. The `isCleared` branch renders as soon as `setRun(updated)` fires. Backend confirmation (`markRunCleared`) is async and best-effort.
