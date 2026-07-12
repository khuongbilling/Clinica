---
name: Clinica back-navigation guard & tutorial exit cleanup
description: How gameplay/onboarding screens block back navigation and clean up tutorial overlays on exit
---

**Rule:** Gameplay/onboarding screens use two shared hooks: `useBlockBack` (blocks browser back via a popstate sentinel, Android hardware back via BackHandler, and iOS swipe-back/in-app pops via `beforeRemove` filtered to GO_BACK/POP/POP_TO_TOP action types only) and `useClearTutorialOnExit` (blur cleanup calling `clearActiveTutorial()`, which clears the overlay WITHOUT marking the tutorial done).

**Why:** Mid-game back navigation skipped scripted prologue beats and stranded tutorial overlays/scrims on the next screen. Filtering `beforeRemove` by action type means `router.replace`/`push` forward exits always pass — no allow-flag needed for replaces. On native-stack iOS, `beforeRemove` preventDefault cannot cancel an in-progress swipe-dismiss gesture, so the hook also sets `navigation.setOptions({ gestureEnabled: false })` while active (and restores it when `active` flips false); `beforeRemove` stays as defense-in-depth for programmatic pops.

**How to apply:**
- Blocked screens' in-app back arrows must use `router.replace(hub)` (a pop would be swallowed by the guard).
- For a deliberate `router.back()` exit on a blocked screen (story-scene `leave()`), call the returned `allowNextBack()` first.
- Conditional blocking via `{ active }` option (story scenes block only while `!player?.prologue_complete`).
- Hooks must run before any early `return null` (simulation/[id], university hub) or React hook-order breaks.
- Hub screens that host tutorials (shift, lotus-journal, tabs, university pages) get `useClearTutorialOnExit` only — back stays normal there.
- **Back-arrow pop vs replace rule:** any screen that is itself a `router.replace` TARGET of a gameplay flow (shift ← result/ward-defense, mode/[id] ← ward-defense, university ← mini-game complete screens, lotus-journal ← mealcraft, world-event ← pushed from result) must use `router.replace(parent)` for its back arrow — a pop there walks through stale battle entries or duplicate history. Simple detail screens whose pusher is always fresh keep the `goBack(router, fallback)` pop helper. When adding a new `router.replace("/somewhere")` exit from a game screen, check that "/somewhere"'s back arrow replaces too.
