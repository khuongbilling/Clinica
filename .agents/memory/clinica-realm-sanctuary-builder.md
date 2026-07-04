---
name: Clinica Realm Sanctuary Builder
description: How the Realm/Kingdom feature was reframed from a Clash-of-Clans-style base into a non-PvP "Sanctuary Builder"; guardrails for future Realm work.
---

The Realm (`frontend/src/game/realm.ts` + `frontend/app/(tabs)/kingdom.tsx`) is explicitly a
non-combat base-builder: build, heal, research, and customize — never attack/defend/raid/steal.

**Why:** an earlier pass modeled it too closely on Clash-of-Clans (attack/defense framing, implied
PvP). The correction pass rewrote headers, purpose strings, and tutorial copy to remove any
war-base language, and re-gated plot placement so new realms start mostly empty (only the Atrium
is `prebuilt: true`) instead of pre-populated.

**How to apply:**
- `RealmPlot.prebuilt` (not `defaultBuildingId` alone) gates what exists on a brand-new layout —
  `defaultBuildingId` is now just a reference for `isPlotUnlocked`/`plotUnlockLabel`, not for
  pre-placement. Existing saved player layouts are untouched by this change.
- `RealmPlot.plotType` / `PLOT_TYPE_META` / `getPlotTypeMeta()` classify plots by function
  (landmark/care/scholar/wellness/commerce/defenseSupport/diplomacy/decoration) — `defenseSupport`
  means "Ward Defense prep," never combat on the Realm itself.
- `HeroAssignmentSlot.slotType` ("hero" | "trainee" | "mentor") extends the old hero-only slot
  system; every building's `heroSlots` entries need this field or a normalize/tsc mismatch occurs.
- Building construction now has two flows in `kingdom.tsx`: `BuildingPickerModal` (construct a new
  building on an empty plot via `availableBuildingsForPlot`) alongside the pre-existing
  `DecorationPickerModal` (cosmetic-only). Both are reachable from Build Sanctuary mode or from
  `EmptyPlotPanel`.
- When editing Realm copy (purpose strings, tutorial text, legend/customize modals), grep for
  attack/raid/steal/troop/war-base language before finishing — none of it should describe live
  mechanics (guardrail-negation sentences like "not to raid or defend against other players" are
  fine).
- Art regeneration for the map/building PNGs was treated as a separate, deliberately out-of-scope
  step in this pass — don't assume map art was touched just because the data/UI layer was.
