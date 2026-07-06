---
name: Clinica Push 5 reminiscence + onboarding gating
description: How the one-time memory-reminiscence scene and Lotus Lessons are gated/wired, and the alternate createPlayer entry point to watch for.
---

The one-time "seen it once" boolean pattern (`seen_reminiscence`) needs three coordinated checks, not just a store setter: (1) backward-compat backfill in `normalizeProgression` so existing players get `true` (skip) instead of suddenly seeing new content, (2) an explicit default in `createPlayer` args for genuinely new players (`false`, so they do see it), and (3) a boot-time resume check (e.g. in the root `index.tsx` gate) so closing the app mid-scene resumes correctly instead of soft-locking or skipping.

**Why:** A field added only to the backend/store types without wiring all three sites either forces existing players to replay onboarding content unexpectedly, or leaves brand-new players never seeing it (since most flags in `createPlayer` default to `true`/"already done" for legacy reasons).

**How to apply:** When adding any new "runs once for new players" gate, grep every `createPlayer(` call site first. `frontend/app/onboarding.tsx` is a second, currently-unreached (no in-app route links to `/onboarding`) player-creation entry point that bypasses prologue/post-recall entirely and jumps straight to battle — if it's ever wired up again, any one-time-gate flags defaulted in the main `createPlayer` object apply there too, so re-check onboarding-gate interactions before re-enabling that route.

Lotus Lessons (Duolingo-style path under University) reuses the existing earned-only currency set (Insight Crystals / Ward Coins / University Credits / XP) via `completeLotusLessonNode` — never grants paid currency, and wrong answers only show feedback (no fail-out), consistent with the rest of Clinica's non-punitive lesson design.

**Push 6 motion-comic upgrade:** `reminiscence.tsx` was rebuilt as a 9-panel illustrated donghua/manhwa-style cutscene (tap-to-advance, skip after panel 1) using a small reusable primitive set in `frontend/src/components/reminiscence/` (`MotionPanel` for fade/zoom/pan/pulse on a still image via the Animated API, `LotusPetalOverlay` for drifting particles, `LotusRecallBurst` for a one-shot flash, `TypedText` for typewriter "SYSTEM:" lines). All gating/routing described above is unchanged — only the in-scene presentation changed. It intentionally uses a local bright ivory/sky-blue/jade/lotus-pink/gold palette constant instead of the app-wide dark `COLORS` theme, since global `COLORS` is dark-only and this scene needs to read as a bright cutscene.
