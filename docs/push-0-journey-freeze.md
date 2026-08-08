# PUSH 0 — Journey Freeze & Fog Map Scaffold

**Git tag:** `journey-snapshot-pre-fogmap`
**Date:** 2026-08-08

## Purpose

Freeze the current Journey implementation in a known-good state before Fog Map
development begins. No visible changes to the live app. New dev route exists
behind a disabled flag only.

---

## Files controlling the Journey system

| Area | File(s) | Notes |
|------|---------|-------|
| **Journey tab landing** | `frontend/app/(tabs)/journey.tsx` | Banner hub: University / Chapters / Memories |
| **Chapter map screen** | `frontend/app/journey.tsx` | `JourneyScreen` — per-chapter VisualMap, node selection, gating |
| **Chapter data / nodes** | `frontend/src/game/journeyRewards.ts` | `JOURNEY_NODES`, `getJourneyNodeDef`, reward computation |
| **Chapter definitions** | `frontend/src/game/chapterJourney.ts` | `CHAPTERS`, `ChapterPartType`, `ChapterPart` |
| **Chapter routing** | `frontend/src/game/routes.ts` | `ROUTES.JOURNEY = "/journey"`, `ROUTES.JOURNEY_TAB = "/(tabs)/journey"`, `dynRoute.chapterFogMap()` |
| **Map components** | `frontend/src/components/Chapter1VisualMap.tsx` … `Chapter5VisualMap.tsx`, `GenericChapterVisualMap.tsx` | Per-chapter illustrated node maps |
| **Map primitives** | `frontend/src/components/MapNodeShape.tsx`, `PaintedMapPath.tsx`, `HeroMapToken.tsx`, `VisualMapHooks.ts` | Shared node/path/token rendering |
| **Mission popup** | `frontend/src/components/MissionPopupModal.tsx` | Pre-battle "Prepare Team" entry point |
| **Stamina data** | `frontend/src/game/stamina.ts` | `MAX_STAMINA`, `ENCOUNTER_COST`, `regen`, `maxStaminaForPlayer` |
| **Stamina display** | `frontend/src/components/StaminaPill.tsx` | Stamina pill used throughout the hub |
| **Player progression** | `frontend/src/game/progression.ts` | `playerLevelFromXp`, `isFeatureUnlocked`, `checkFeatureGate`, level caps |
| **Bottom navigation** | `frontend/app/(tabs)/_layout.tsx` | Tab order: Journey · Heroes · Home · Bag · Shop; badge dot support |
| **Chapter completion** | `frontend/src/game/store.tsx` → `claimJourneyNode` | Writes claimed nodes, battle stars, XP, rewards to PlayerState |
| **Battle-route transition** | `frontend/app/journey.tsx` → `MissionPopupModal` → `frontend/app/mission-loadout.tsx` → `frontend/app/battle.tsx` | Full flow: node tap → popup → loadout → `ROUTES.BATTLE` |
| **Persistence / backend** | `frontend/src/game/store.tsx`, `frontend/src/api/client.ts`, `backend/server.py` | AsyncStorage + backend reconciliation via `api.updatePlayer` |
| **Fog tile data (proto)** | `frontend/src/game/fogTileMap.ts`, `frontend/src/components/FogboundTileMap.tsx` | Existing prototype data contracts; NOT yet wired to navigation |

---

## Feature flag

```ts
// frontend/src/game/featureFlags.ts
export const FEATURE_FLAG_JOURNEY_FOG_MAP_V1 = false;   // ← keep false until Fog Map V1 push
```

Set to `true` only when actively building the fog map. The flag gates the new
route at call sites — the route file itself always exists in the filesystem.

---

## New dev route

| | |
|-|-|
| **URL pattern** | `/journey/chapter/:chapterId/fog-map` |
| **File** | `frontend/app/journey/chapter/[chapterId]/fog-map.tsx` |
| **Route helper** | `dynRoute.chapterFogMap(chapterId)` in `routes.ts` |
| **Current state** | Diagnostic shell only — shows flag status, chapter ID, back button |
| **Reachable?** | Not from any in-app navigation. Direct URL bar only in dev. |

---

## Stamina icon assets

Two assets exist — use the **hub emblem** for Journey/hub contexts:

| Asset | Path | Use |
|-------|------|-----|
| **Hub yellow emblem** | `frontend/assets/ui-icons/hub/stamina-emblem.png` | Hub shortcut cards, Sanctuary stamina display |
| **Generic icon** | `frontend/assets/ui-icons/icon_stamina.png` | Inline pill labels, battle HUD |

**Rule:** The Journey fog-map screen must import `hub/stamina-emblem.png` for
any Sanctuary-style stamina display. Do not generate a new stamina asset.

---

## Baseline screenshots

Captured at tag `journey-snapshot-pre-fogmap`:

| Screen | File |
|--------|------|
| Hub home (nav bar) | `screenshots/push0-hub-home.jpg` |
| Journey map (loading) | `screenshots/push0-journey-map.jpg` |
| Sanctuary + stamina tab | `screenshots/push0-sanctuary-stamina.jpg` |

---

## Rollback

```bash
git checkout journey-snapshot-pre-fogmap
```

Or restore via Replit checkpoint created at the same moment.

---

## Acceptance checklist

- [x] Git tag `journey-snapshot-pre-fogmap` created
- [x] All Journey files documented above
- [x] `FEATURE_FLAG_JOURNEY_FOG_MAP_V1 = false` in `featureFlags.ts`
- [x] `/journey/chapter/:chapterId/fog-map` route exists as diagnostic shell
- [x] `dynRoute.chapterFogMap()` helper in `routes.ts`
- [x] Existing `/journey` and `/(tabs)/journey` routes untouched
- [x] Stamina asset paths documented
- [x] Baseline screenshots captured
- [x] TypeScript + route validator pass with no errors
