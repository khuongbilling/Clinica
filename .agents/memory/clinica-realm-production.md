---
name: Clinica Realm production & hero assignment
description: How Realm producer buildings accrue points over real time and how heroes boost them
---

# Realm production & hero assignment

Realm producer buildings (Clinica University → Knowledge Points, Research Library
→ Codex Shards, Sanctuary Bank → Insight Crystals) passively accrue points over
real time, lazily (like stamina). Assigning owned heroes to a building's slots
boosts its rate. Model lives in `realm.ts` (`RealmProduction`, `production?` on
`RealmBuilding`, `HERO_ASSIGNMENT_RATE_BONUS=0.25`, helpers `productionRatePerHour`
/`productionCap`/`computeAccruedPoints`/`assignedHeroCount`). PlayerState fields:
`realm_assignments` (buildingId → heroId[] with "" for empty slots) and
`realm_production` (buildingId → {points, updatedAt}). Both mirrored on backend
Player + PlayerUpdate.

## The clock-start trap (critical)
`computeAccruedPoints` derives elapsed time from `stored.updatedAt`. With **no
snapshot it falls back to `nowMs`, so elapsed = 0 forever** — a placed producer
would read 0 permanently and passive generation would appear broken (looks like
it only works after assigning a hero, because assignment writes the first
snapshot).

**Rule:** a producer must always have a `{points, updatedAt}` snapshot the moment
it is placed & unlocked. Two seed sites keep this true:
- `normalize` in store.tsx seeds `{points:0, updatedAt:now}` for every currently
  placed producer lacking a snapshot (backfills legacy saves + onboarding
  auto-placed University).
- `setRealmLayout` (re)starts the clock on placement and, on removal, settles
  accrued points and freezes `updatedAt=now`.

**Why:** production only earns while the building is on the board. Without the
placement/removal settle, a building stored for hours would back-pay all that
time on re-placement. On placement we keep existing points but reset updatedAt so
no unplaced time is credited.

## Reassignment settle
`setRealmAssignment` settles accrual at the OLD hero count before writing the new
slot array (otherwise a rate change would retroactively re-rate past elapsed
time). `collectRealmProduction` floors accrued to the wallet currency and keeps
the fractional remainder.
