---
name: Fog-map release wiring
description: Push 14/15 production changes — a11y fixes, feature flag activation, chapter tab routing, retry error fallback, and rollback procedure.
---

## Feature flag

`FEATURE_FLAG_JOURNEY_FOG_MAP_V1` in `frontend/src/game/featureFlags.ts`.
- `true` = chapter tabs on `/journey` navigate to `/journey/chapter/:id/fog-map`
- `false` = chapter tabs stay in the old visual map inline (instant rollback, no data loss)

## Chapter tab routing (journey.tsx)

```typescript
if (FEATURE_FLAG_JOURNEY_FOG_MAP_V1) {
  router.push(dynRoute.chapterFogMap(String(ch.number)) as AppRoute);
} else {
  setSelectedChapterIdx(idx);
}
```

`dynRoute.chapterFogMap` expects a **string**; `ch.number` is a number — must wrap with `String()`.

## Accessibility fixes (Push 14, HexMapLayer.tsx)

- `MIN_TILE_SZ = 44` — WCAG 2.5.5 touch target minimum; was 36.
- `hitSlop={{ top:3, bottom:3, left:3, right:3 }}` on RecenterButton — extends effective tap to 44×44 without changing the 38×38 visual size.
- `AccessibilityInfo.isReduceMotionEnabled()` checked in `recenter` before spring animation.

## Retry error fallback (fog-map.tsx)

`loadAttempt` state (init 0) is a dependency of the load `useEffect`.
Incrementing it retriggers the load without resetting run data.

```typescript
const [loadAttempt, setLoadAttempt] = useState(0);
// Retry button: onPress={() => setLoadAttempt(n => n + 1)}
// useEffect deps: [player?.id, chNum, debugTiles, loadAttempt]
```

Error logging: `console.error` (not warn) so it appears in crash dashboards.
No auto-reroll on failure — preserved saved data.

## Rollback procedure

See `docs/rollback-journey-fog-map.md` for full procedure.
TL;DR: set flag to `false`, redeploy. Journey run data in MongoDB is untouched.

**Why:** flag-gating means any production regression can be reverted in seconds without a code rollback.
**How to apply:** any time a push introduces a user-facing navigation change, gate it behind a flag so it can be disabled independently of the codebase.
