---
name: Clinica web modal z-index stacking
description: On Expo web, full-screen modals need explicit high zIndex to sit above the guided TutorialOverlay; native paint-order does not translate to web.
---

# Web vs native modal stacking in battle

On React Native **native**, later-in-JSX siblings paint on top, so a modal
rendered after another element is interactive. On **web** (react-native-web),
stacking follows CSS: an element with a higher `zIndex` wins regardless of DOM
order, and an absolutely-positioned overlay with `zIndex` auto (0) can be
covered by an earlier sibling that has a positive `zIndex`.

**Concrete case:** the guided `TutorialOverlay` action layer sits at
`zIndex: 9000`. Any full-screen battle modal that must be clickable *while a
guided tutorial step is active* (the prologue's guided cue step is the first
battle every new web player hits) must carry an explicit `zIndex >= 9500`, or
on web it renders beneath the tutorial layer and swallows all clicks — while
working fine on native.

**Why:** the cue *feedback* card (`cueFeedbackWrap`) already had `zIndex: 9500`
for exactly this reason; the cue *question* modal was missed and shipped at
`zIndex` auto, so on web its answer buttons were unclickable during the guided
prologue cue. Fix added a `cueModalOverlay` style (`zIndex: 9500`).

**How to apply:** when adding/reviewing any battle overlay that can co-exist
with a guided tutorial step, give it an explicit high `zIndex` (match the 9500
convention). Trade-off: raising the modal above the tutorial hides the guidance
narrative box behind the modal's dark scrim on web — acceptable and consistent
with how the feedback card already behaves.

## ScrollView traps the highlighted target's zIndex on web

Two extra requirements for the mini-game forced-step pattern
(`useHighlightTarget` → target at `zIndex 9500` above the blocking scrim):

1. **The screen must render `<TutorialOverlay />` itself** (sibling of its
   content). If it doesn't, the narration/scrim either never appears or comes
   from another mounted screen's instance in a foreign stacking context, and
   the target can never rise above it.
2. **RN-web `ScrollView` has base style `transform: translateZ(0)`** (hardware
   compositing hint), which creates a CSS stacking context that traps ANY
   descendant `zIndex` below a sibling scrim — so a highlighted card inside a
   ScrollView is unclickable on web even at `zIndex 9500`. Fix: pass
   `style={{ transform: "none" }}` (web only; RN-web ≥0.19 passes string
   transforms through, and the user style merges after the base style).
   Non-scrolling screens (rapid-triage, mealcraft) never hit this.
