---
name: Onboarding polish shared primitives
description: Shared System-panel/progress/reward/transition components for the onboarding sequence (prologue → University → first lesson) and how they should be composed with each screen's own state-driven fade.
---

`frontend/src/components/onboarding/` holds 4 presentational-only primitives meant to
be composed into every onboarding screen so the sequence reads as one continuous
experience rather than independently-styled screens:

- `SystemPanel` — the ONE dialogue-box shape for "the System speaking" (icon badge +
  kicker + glow border). Any raw `SYSTEM: ...` text line rendered outside this
  component is a styling regression waiting to happen — wrap it instead of adding a
  new ad hoc box.
- `OnboardingProgressBar` — step dots/labels keyed off a shared `ONBOARDING_STEPS`
  list. Gate it behind "is this actually still onboarding" checks (e.g. `!isReplay`,
  `lessons_completed.length === 0`) so it doesn't reappear for players who already
  finished that beat.
- `MilestoneReward` — reward presentation card. Only show it for what a flow *actually*
  grants (e.g. class confirmation grants no currency, only identity/trait chips — don't
  invent a currency reward to fit the component).
- `SceneTransition` — fade+scale+translateY wrapper, re-triggers on a `trigger` prop
  change. Screens that already had their own hand-rolled `Animated.Value` fade (e.g.
  `post-recall.tsx`) can keep that existing per-view fade instead of forcing a swap —
  duplicating a working animation system into the shared wrapper is not required to hit
  the "cinematic transition" goal, just be consistent going forward for *new* onboarding
  screens.

**Why:** the onboarding sequence spans many independently-authored screens
(prologue/lotus-recall/post-recall/reminiscence/university/lotus-lesson); without a
shared vocabulary each screen drifts to its own dialogue box/progress dot/reward style.

**How to apply:** when touching any onboarding-adjacent screen, check whether it needs
one of these 4 primitives before hand-rolling a new box/animation/reward chip.

**Scripted-loss boss outcome:** the prologue boss (`isPrologueBoss`, Silent Infarct,
scriptedLoss) is narratively meant to lose and routes straight to Lotus Recall — it must
NOT reuse the generic "Patient Lost — review the lesson and try again" outcome modal
(implies a retry that doesn't exist). Give it its own cinematic collapse overlay
(SceneTransition + SystemPanel, CRITICAL/error accent) leading into the System's voice.
Keep the split so all *non-boss* battles keep the original outcome modal untouched.

**First Simulation Shift = the prologue tutorial WIN result screen** (`won &&
isPrologueTutorial` in result.tsx), NOT a separate route. Onboarding polish there
(OnboardingProgressBar step "First Shift" + MilestoneReward) must be scoped to that exact
condition so ordinary battle result screens are unaffected.
