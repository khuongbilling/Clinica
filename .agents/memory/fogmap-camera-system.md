---
name: Fog-map camera system
description: How the hex-map camera drag, bounds, and recenter are implemented — patterns to preserve for future pushes.
---

## Camera architecture

- **World container**: `Animated.View` holding all tiles at absolute positions; `cameraAnim.getTranslateTransform()` applied as style.
- **Viewport**: outer `View` (`StyleSheet.absoluteFill`) carries `panResponder.panHandlers`; `overflow:hidden` inherited from `mapOuter` in fog-map.tsx.
- **Animation driver**: `Animated.ValueXY` with `useNativeDriver:false` (layout property — native driver cannot drive translateX/Y on web).

## Gesture (PanResponder)

- `onStartShouldSetPanResponder: () => false` — lets tile `Pressable` events through on tap.
- `onMoveShouldSetPanResponder: Math.abs(dx|dy) > 5` — steals gesture at ≥5 px movement; this naturally suppresses tile `onPress` during a drag (gesture released on panResponder, not tile).
- PanResponder is created **once** (`useMemo(fn, [])`) to avoid recreation; all mutable values (bounds, camera position) are read from refs at call-time.

## Stale-closure-free refs pattern

```
boundsRef     — always-current camera bounds; updated in useLayoutEffect on resize
initialCamRef — camera position to return to on recenter
camRef        — current camera position (kept in sync after every setValue / spring)
drag.current  — drag gesture state (moved flag, camX0/Y0 start)
```

PanResponder handlers read these refs, never closed-over component-scope values.

## Bounds formula

```
MARGIN = sz × 0.55
minX = min(-MARGIN, containerWidth  - worldW - MARGIN)
maxX = max(0, MARGIN)
minY = min(-MARGIN, containerHeight - worldH - MARGIN)
maxY = max(0, MARGIN)
```
Keeps at least MARGIN px of world visible at every edge.

## Initial camera centering

Set once (`initialized.current` flag); fires in `useLayoutEffect` after first non-trivial `containerWidth`/`containerHeight`. Centers viewport on the player tile (`isCurrent:true`), then clamps to bounds.

## Recenter animation

```typescript
Animated.spring(cameraAnim, { toValue: initialCamRef.current, useNativeDriver: false, friction: 7, tension: 120 })
```

## Debug fixtures

`generateDebugFixture(N)` in `fixture.ts` — BFS from (8,8), normalized to (0,0) origin. Access via `?debug=N` URL param. Validated sizes: 30, 35, 40, 45, 50, 55.

**Why:** Testing camera bounds on larger maps before live run-state tiles are wired.

## Tile size derivation

```
wFactor = maxCol × 0.75 + 1   (flat-top col-step fraction)
sz = min(MAX_TILE_SZ=88, max(MIN=36, floor(containerWidth / wFactor)))
ox = floor((containerWidth - wFactor × sz) / 2)   // horizontal centering margin
```

Computed synchronously from `containerWidth` prop — no state needed; changes trigger re-render anyway.
