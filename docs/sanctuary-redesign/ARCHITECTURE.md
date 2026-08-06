# Sanctuary Redesign — Architecture Baseline (Push 0)

Date: 2026-08-06 · Agent 1 (Repository Audit / QA)

This document maps the UI architecture relevant to the Sanctuary hub redesign so
subsequent pushes can change files with known blast radius.

---

## 1. Sanctuary Page File Map

| Concern | File | Notes |
|---|---|---|
| Hub route/screen | `frontend/app/(tabs)/index.tsx` | `RunHome` — the route IS the screen (~900+ lines). No separate Sanctuary component. |
| Player state | `frontend/src/game/store.tsx` | `usePlayer()` context. |
| Tutorial gating | `frontend/src/game/tutorialStore.tsx` | Guided-step overlays. |
| Unlock gates | `frontend/src/game/progression.ts` | Feature/level gates. |
| Daily rounds | `frontend/src/game/dailyRounds.ts` | Streak/objectives panel data. |
| Objective strip | `frontend/src/game/objectiveProgress.ts` | 15-step objective chain. |
| World event | `frontend/src/game/worldEvent.ts` | Event banner data. |
| Static content | `frontend/src/game/content.ts` | |
| Route constants | `frontend/src/game/routes.ts` | Use these, never raw strings. |

Local-only components inside `index.tsx`: `HubEmblem`, `FeatureButton`,
`ReturnSessionCard`, `SceneBg`.

## 2. Navigation File Map

| Concern | File | Notes |
|---|---|---|
| Live bottom tab bar | `frontend/app/(tabs)/_layout.tsx` | Expo Router `Tabs`; icon PNG map lines ~13–22, `mkTabIcon` ~51–61, tab defs ~109–158. Hidden tabs use `href: null`. |
| Custom nav (UNUSED) | `frontend/src/components/HubBottomNav.tsx` | Defined, **not imported by the hub**. Has `accessibilityLabel`s. Candidate for deletion or promotion. |

Tab icon assets: `frontend/assets/ui-icons/tab-{home,study,shift,heroes,shop,realm,guild,profile}.png` (1024×1024 painterly PNGs).

## 3. Route Map (redesign-relevant)

| Nav concept | Existing route |
|---|---|
| Sanctuary (hub) | `frontend/app/(tabs)/index.tsx` |
| Journey | `frontend/app/journey.tsx` (top-level, not a tab) |
| Heroes | `frontend/app/(tabs)/heroes.tsx` |
| Inventory | **none** — closest: `frontend/app/item-bag.tsx`, `frontend/app/materials.tsx` |
| Shop | `frontend/app/(tabs)/shop.tsx` (+ standalone `frontend/app/shop.tsx`) |
| Other tabs in layout | `kingdom`, `faction`, `profile`, `codex`, study/university routes |

To promote a top-level screen into the tab bar without duplicating logic:
re-export it into `(tabs)/` and use `href` visibility (established pattern).

## 4. Shared Component Inventory (used by the hub)

| Component | File | Shared? |
|---|---|---|
| `PlayerHeader` | `frontend/src/components/PlayerHeader.tsx` | Yes — all hub-scope screens (never battle/Profile) |
| `NarratorGuide` | `frontend/src/components/NarratorGuide.tsx` | Yes |
| `getBannerImage` / ModeBanners | `frontend/src/components/ModeBanners.tsx` | Yes — banner-hub pattern (Shift & Shop) |
| `PrimaryButton` | `frontend/src/components/ui/PrimaryButton.tsx` | Yes — widely |
| `DailyRoundsPanel` | `frontend/src/components/DailyRoundsPanel.tsx` | Hub-specific |
| `Lv2UnlockModal` | `frontend/src/components/Lv2UnlockModal.tsx` | Hub-specific |
| `getHeroSprite` | `frontend/src/components/HeroSprites.ts` | Yes |

## 5. Theme / Token Inventory

Two coexisting layers — per-screen migration policy, never a global swap:

| Token type | Legacy | New warm-dark |
|---|---|---|
| Colors | `frontend/src/theme/colors.ts` → `COLORS`, `ELEMENT_COLORS` | `frontend/src/theme/ui.ts` → UI colors (~L18–58) |
| Spacing | `colors.ts` → `SPACING` | re-exported by `ui.ts` |
| Radius | `colors.ts` → `RADIUS` | `ui.ts` → `UI_RADIUS` |
| Shadows/glow | inline per-screen styles | `ui.ts` → `GLOW` (~L68–90) |
| Gradients | — | `ui.ts` (~L93–101) |
| Typography | generic `System`/`serif` in `colors.ts` `FONTS` | `ui.ts` → `TYPO` + presets (~L113–186) |

Fonts: only `assets/fonts/SpaceMono-Regular.ttf` bundled (loader:
`frontend/src/hooks/use-icon-fonts.ts`). The mockup's Marcellus/Source Sans 3
are Google-Fonts web-only and are **not** yet available to the native app.
Note: `COLORS` has no `background` key — use `surface`.

## 6. Asset Inventory (hub-relevant)

- Tab icons: `frontend/assets/ui-icons/tab-*.png` (8 files, 1024×1024 RGBA)
- Currency/stat: `frontend/assets/ui-icons/icon_stamina.png`, `icon_crowns.png`
- Shortcut emblems: `frontend/assets/ui-icons/emblems/{journey,daily-rounds,milestones,summoning,ward-defense,boss-ward,world-events}.png`
- All shortcut icons are **image assets** rendered by `HubEmblem` (Expo Image);
  no inline SVG or generated markup on the live hub.
- Mockup-only assets: `artifacts/mockup-sandbox/public/images/` —
  `ref-card-*.png` (reference crops), `nav-*.png` (painterly nav icons incl.
  generated `nav-inventory.png` satchel), `icon-stamina-emblem.png`.

Label mismatch to resolve during integration: live hub shortcuts are
Rounds / Journey / Milestones / Summon / Defense / Boss / Events; the approved
mockup uses Rounds / Goals / Recruit / Defense / Supplies (Journey moved to nav).

## 7. Conflict-Risk Report

1. **`frontend/app/(tabs)/index.tsx` is a hotspot** — tutorial anchors
   (`useHighlightTarget`, guided steps), narrator beats, and gate checks live in
   the same file the redesign will restructure. Any push touching it risks
   breaking the guided onboarding ladder. Mitigate: keep `testID`s and tutorial
   anchor ids stable.
2. **Parallel task merges revert visual work silently** (observed on the mockup
   Enter Ward button). Re-diff hub files after every merge.
3. **Two nav systems** — editing `HubBottomNav.tsx` does nothing visible;
   the live bar is `(tabs)/_layout.tsx`. Decide promote-or-delete early.
4. **Two theme layers** — mixing `COLORS` and `ui.ts` tokens in one component
   is the standing pattern hazard; new hub work should standardize on `ui.ts`.
5. **No Inventory route exists** — the redesigned nav needs a new
   `(tabs)/inventory` (likely re-exporting `item-bag`), touching `_layout.tsx`
   (shared with every tab) — coordinate with any other nav-touching task.
6. **Fonts** — Marcellus/Source Sans 3 need expo-font/native bundling before the
   mockup typography can graduate; web-only CSS imports won't carry over.
7. **Reanimated pin** — must stay on `react-native-reanimated ~3.16.7`
   (Expo Go constraint); redesign animations must use RN `Animated` or 3.x APIs.

## 8. Breakpoints, Accessibility, Animation (current state)

- **Breakpoints:** none. Ad-hoc `useWindowDimensions()` / `Dimensions.get` per
  screen (battle, events, recruit, hero detail, prologue cinematics). No shared
  breakpoint constants or media queries.
- **Accessibility:** no `AccessibilityInfo` or a11y helpers anywhere;
  `accessibilityLabel` only on the unused `HubBottomNav`. Live tab bar and hub
  pressables have `testID`s but no labels. Redesign should add labels.
- **Animation:** RN `Animated` only (hub pulse + tap hint; heavy use in
  battle/shop-section/cinematics). No shared-element transitions, no reanimated
  worklet usage on the hub.

## 9. Baseline Screenshots

Stored in `docs/sanctuary-redesign/baseline/`:

- `live-entry.jpg` — live app entry (fresh session lands on title/preloader; the
  hub itself requires a signed-in player, captured during QA passes in-session)
- `mockup-hub.jpg` — approved Sanctuary redesign mockup (v3, Ink & Mist spec)
