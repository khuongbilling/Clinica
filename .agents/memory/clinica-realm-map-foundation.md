---
name: Clinica Realm map foundation
description: How the Realm/Kingdom Builder map (Push 3+3.6) is structured, gated, and why Atrium defaults matter
---

The Realm screen (`app/(tabs)/kingdom.tsx`) is a pannable illustrated map with real
plot footprints, not a free-placement editor. All building copy, positions,
requirements, and unlock rules live in `frontend/src/game/realm.ts`
(`REALM_BUILDINGS`, `REALM_DISTRICTS`, `ATRIUM_UNLOCKS`, `REALM_PLOTS`,
`DECORATIONS`) — the screen only renders from that data, same pattern as the
economy foundation.

**Plot/building/decoration model (Push 3.6):** each `RealmPlot` has a `size`
(small/medium/large) and `allowedBuildingIds`/`allowedDecorationIds`; each
`RealmBuilding` has `movable`/`fixedReason`. Only cosmetic `DECORATIONS` are
player-placeable via Build Mode on empty unlocked plots — real functional buildings
still auto-unlock via `ATRIUM_UNLOCKS`/`isBuildingUnlocked`, never placed manually, to
avoid conflicting with progression. Movable buildings relocate via Move Mode
(`compatiblePlotsForBuilding` filters by allowed-building-ids + unlocked + unoccupied)
committed through `setRealmLayout`. Layout (`player.realm_layout`: buildingId→plotId)
and decor (`player.realm_decor`: plotId→decorationId) are separate maps so a plot can
only ever hold one occupant type at a time — check both before treating a plot as empty.

The Grand Ward Atrium level (`kingdom_levels.grand_ward_atrium`) gates every other
building's Realm detail/link. Some Realm buildings (Apothecary→Shop, Research
Library→Codex, Training Hall→Heroes, Clinica University→University) are the **only**
Realm-side entry point to real, pre-existing routes for some of them (University in
particular had no other nav path in the app).

**Why:** introducing the Atrium as a new gating concept with a naive default of 0
would retroactively lock existing players out of routes they already had access to
via their pre-existing `academy_of_healing`/`apothecary`/etc. building levels — a
silent regression, not a new limitation.

**How to apply:** default `grand_ward_atrium` to 3 for both new and legacy players
(covers Apothecary/Research Library/Hospital Ward at Lv.1 req and Training
Hall/Nutrition Garden/University/Sanctuary Bank at Lv.2-3 req) — set in
`defaultPlayer` (store.tsx), backend `create_player` default, AND in
`normalizeProgression` as a one-time backfill for existing players missing the key.
Before gating any existing route behind a new progression system, check whether that
route has any other reachable entry point in the nav graph.
