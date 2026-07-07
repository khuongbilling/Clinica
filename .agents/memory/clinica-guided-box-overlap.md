---
name: Clinica guided tutorial box vs action buttons overlap
description: The bottom-placed guided TutorialOverlay box can cover and block the battle button it points to; reserve its measured height in the layout rather than relocating it or guessing a fixed number.
---

# Guided narrative box blocks the very button it points to

The battle screen is a fixed flex column (no outer scroll) whose action/skill
buttons sit in the bottom zone. The guided `TutorialOverlay` renders an absolute
overlay; a `placement: "bottom"` box (dark bg, `pointerEvents: auto`) lands over
that same bottom zone and swallows taps on the highlighted control.

**Fix pattern:** reserve empty layout space at the bottom of the battle column
while a bottom-placed guided step is active, so the buttons render *above* the
box and taps pass through the `box-none` overlay container. Do NOT relocate the
box to `top` (that hides the patient stats the tutorial is teaching you to watch).

**Why a fixed reserve is not enough:** the box's real footprint varies by
device — safe-area insets (Android nav bar) push it higher and long/wrapped text
makes it taller, so a hardcoded pixel reserve overlapped again on Android.
Measure the box (`onLayout` height + `insets.bottom` + spacing), publish it
through the tutorial store, and have the screen reserve exactly that. Clear the
reserve to 0 when the box isn't a bottom guided box (and on unmount) or dead
bottom padding lingers in normal battle.

**How to apply:** any new bottom-placed guided `requireAction` step whose target
lives in the bottom action zone is handled automatically. Keep a small first-frame
fallback (pre-measurement) so there's no flash of zero reserve.
