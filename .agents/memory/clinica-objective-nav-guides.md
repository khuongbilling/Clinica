---
name: Objective navigation guides
description: Forced-tap wayfinding tutorials (objGuide*) that walk players to the control advancing the onboarding objective chain.
---

Pattern: `objGuide*` TutorialIds are forced-tap navigation guides launched from the hub via `replayTutorial` (bypasses completed/dismissed so they keep forcing until the objective completes).

Rules:
- `clearActiveTutorial` skips `objGuide*` ids unless called with `force=true` — guides must survive navigation (hub → Journey → Memories). The hub launcher effect is the recovery point: it force-clears any active guide that no longer matches the current objective.
- **Why:** without the exemption, `useClearTutorialOnExit` on the hub kills the guide the moment the player follows it; without the forced-clear reconcile, a stale guide blocks tab navigation forever.
- TutorialOverlay is mounted PER SCREEN, not globally — any screen where a guide step must show needs its own `<TutorialOverlay />` (hub and journey gained one for this feature).
- Tab bar forcing lives in `(tabs)/_layout.tsx`: guide-required tab reports `onTargetTap` in its `tabPress` listener; other tabs `preventDefault` while a guide is active; Home is never blocked (recovery point).
- journey.tsx is a redirect bridge to the fog map — it must skip the redirect while the guide requires the Memories tab or the required target unmounts and strands the guide.
- Hub Pressables are individually gated (`if (guideActive) return;`) because TutorialOverlay renders no blocking scrim after the box is dismissed on required-target steps.
