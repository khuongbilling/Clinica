---
name: Clinica System Narrator onboarding flow
description: How the "the System" guided onboarding, feature gating, and lesson→hero grant fit together
---

# System Narrator guided onboarding (Task #9 family)

The guided new-player flow is a chain of one-time, non-skippable tutorials
narrated by "the System" (donghua portrait, dark shadow until player level 10,
then colored by aptitude). Sequence: hub intro → ward hub → University (via a
ward-hub banner) → shops (after first lessons + level 2).

**Trigger wiring pattern:** each System tutorial is a `TutorialId`
(`systemHubIntro` / `systemWardHub` / `systemShops`) started from a screen
`useEffect` with `setTimeout(startTutorial, ~500ms)`. Ordering is enforced by
gating each trigger on the PRIOR beat being complete (e.g. `systemWardHub` only
fires after `systemHubIntro`; `systemShops` only after `systemWardHub` AND
`lessons_completed.length > 0`). Do NOT fire a System beat on bare mount — it
will run out of order.

**Feature gates** live in `progression.ts` `checkFeatureGate(id, ctx)` with
`CompoundGateContext { level, firstWardShiftDone, lessonsStarted }`:
- `university`: Player-Level-only (L3). MUST NOT require `lessonsStarted` — it's
  where lessons are taken, so a lessons gate would be circular.
- `hall_of_heroes`: L3 + `lessonsStarted` (first 2 heroes come from lessons).
- `realm`: L3 + `firstWardShiftDone`.

**Tab gating is UI-only** (`(tabs)/_layout.tsx` uses `Tabs.Screen href:null`),
which hides tabs but does NOT block direct `router.push` to a route. Some
in-app links (e.g. University menu → `/(tabs)/heroes`) can bypass a gate. This
is the app's established pattern; route-level enforcement inside each screen is
a separate, deliberate follow-up, not part of the narrator work.

**Lesson → hero grant:** `LotusLessonRewards.grantHeroes?: string[]` grants the
first units. `completeLotusLessonNode` must mirror `applyRewards`: dedupe into
`heroes_owned` via `Array.from(new Set(...))` AND seed a `defaultProgress()`
`hero_progression` entry per new hero so persisted state is coherent
immediately (normalizeProgression also backfills on load, but seed at grant).

**Why:** these are the constraints that were non-obvious / caused rework —
circular university gate, out-of-order System triggers, and missing
hero_progression seeding on lesson grants.
