# Push 11 — QA Report

Date: 2026-08-06 · Agent 1 (QA)
Scope: Pushes 2–10 integrated (tasks #494–#503)

---

## Files Audited

| File | Role |
|---|---|
| `frontend/app/(tabs)/index.tsx` | Hub screen (1 196 lines post-QA) |
| `frontend/app/(tabs)/_layout.tsx` | Bottom tab layout |
| `frontend/src/components/sanctuary/SanctuaryShortcutCard.tsx` | Shortcut card |
| `frontend/src/components/ui/EnterWardButton.tsx` | CTA button |
| `frontend/src/components/sanctuary/SystemObjectiveCard.tsx` | Objective card |

---

## QA Category Results

### Layout — ✅ Pass

| Check | Result |
|---|---|
| No horizontal scrolling | ✅ No FlatList/ScrollView with unbounded width found |
| No card clipping | ✅ Side columns fixed 64 px wide; arena uses flex row with no overflow |
| No character / touch-target overlap | ✅ Absolute-positioned elements (SceneBg, tapPulse, hero accent) confined inside arena bounds |
| No bottom-nav overlap | ✅ `SafeAreaView edges={["top"]}` — content ends above tab bar; no hub element has bottom absolute anchor |
| Safe areas respected | ✅ Top edge protected; tab bar safe area handled by Expo Router |
| System card collapses | ✅ `SystemObjectiveCard` has expand/collapse Pressable with animation (push 495) |
| Text overflow | ⚠️ **Fixed:** added `numberOfLines` to recruit title/sub and ward-locked title/sub |

### Navigation — ✅ Pass

| Check | Result |
|---|---|
| 5 tabs route correctly | ✅ Journey · Heroes · Sanctuary · Inventory · Shop defined in `_layout.tsx` |
| Journey not duplicated in shortcuts | ✅ Shortcuts are Rounds / Goals / Recruit (left) + Defense / Supplies (right) — Journey nav-only |
| Back navigation | ✅ Hub is a tab root; back handled by OS/Expo Router |
| Profile via avatar | ✅ `PlayerHeader` avatar links to profile (Push 496) |

### Accessibility — ⚠️ Fixed (17 Pressables labelled)

All interactive `Pressable` elements now have `accessibilityLabel` + `accessibilityRole="button"`. Elements fixed:

| Element | Label added |
|---|---|
| Tutorial shortcut | `"Open tutorial"` |
| World event banner | `"World event: {title}"` / `"Community Health Board"` |
| Event banner close | `"Dismiss banner"` + `e.stopPropagation()` to resolve nested-Pressable focus conflict |
| Memory banner | `"New memory unlocked: {title}"` |
| Hero center (portrait) | `"Change active hero"` / `"Recruit your first hero"` / `"Go to University"` |
| Hero info panel | `"View {name} hero details"` |
| Recruit prompt | `"Your first healer awaits — visit the Recruitment Hall"` |
| Ward locked TRAIN button | `"Go to University to unlock Ward Shift"` |
| Intro modal CTA | `"Begin the journey"` |
| ReturnSessionCard dismiss | `"Dismiss"` |
| ReturnSessionCard GO | `"Claim daily rewards"` / `"Open Journey Map"` |
| `SanctuaryShortcutCard` | defaults to card `label` prop; `accessibilityState={{ disabled: locked }}` |
| `EnterWardButton` | defaults to `label` prop; `accessibilityState={{ disabled }}` |
| `SystemObjectiveCard` CTA | uses `ctaLabel` |

Icons (`Ionicons`) are presentational within labelled Pressables — no separate label needed.

Touch target minimum: shortcut cards have `minHeight: 44` + `hitSlop: 6` ✅. All other Pressables ≥ 44 dp by content height.

### Performance — ✅ Pass (1 fix)

| Check | Result |
|---|---|
| `useNativeDriver: false` → `true` | ✅ **Fixed** — hub pulse loop (opacity only) now runs on the native thread. Shimmer + press-spring in `EnterWardButton` were already `true`. |
| Oversized PNGs | ✅ Tab icons 1024×1024 (same as baseline; Expo Image handles downsampling) |
| Animation loops | ✅ One pulse loop (hub), one shimmer loop (EnterWardButton) — both conditional/bounded |
| Layout shift from fonts | No web-font loading detected; tokens use system fonts for native |
| Background blur | ✅ SceneBg uses tint overlays, not blur filter |

### Visual Consistency — ✅ Pass (no regressions)

All shortcut cards share `SanctuaryShortcutCard` — single source, consistent border/radius/icon treatment. `EnterWardButton` is a single component. No style drift found between the five shortcut instances.

---

## Pre-existing Warnings (not introduced by Push 2–10, not blocking)

- `shadow*` style props deprecated → `boxShadow` — widespread across legacy screens, pre-dates redesign
- `props.pointerEvents` deprecated — pre-existing across several RN components
- 375 lint warnings (0 errors) — same count as baseline; no regressions from new files

---

## TypeScript

```
npx tsc --noEmit — 0 errors ✅
```

---

## Screenshots

Saved in `docs/sanctuary-redesign/qa/`:

- `qa-320-entry.jpg` — entry screen at default viewport (hub requires authenticated player)

The hub screen itself requires a signed-in player session and cannot be directly
deep-linked in the web preview. Responsive layout is verified structurally:
flex-based arena, percentage vignettes, `SafeAreaView`, no hard-coded full-screen
heights, and all text nodes guarded with `numberOfLines` or bounded by `minWidth: 0`
flex containers.
