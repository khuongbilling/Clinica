---
name: Clinica guided tutorial box vs action buttons overlap
description: On short/web viewports the bottom-placed TutorialOverlay narrative box (pointerEvents auto) covers and blocks the battle action buttons it points to; reserve layout space instead of relocating the box.
---

# Guided narrative box blocks the very button it points to

The battle screen is a fixed flex column with no outer scroll: patient stats →
scene → heroes/AP/tabs → action/skill area (the last zone is `flex:1` and sits
at the very bottom). The guided `TutorialOverlay` renders an absolute overlay;
for `placement: "bottom"` steps its narrative box sits at the bottom of the
screen with `pointerEvents: auto`.

**Problem:** the skill buttons the guided step tells the user to tap live in the
bottom action zone — the SAME region the bottom box overlays. On a tall native
phone the zone has slack so the buttons sit above the box, but on a short web
(phone-mirror iframe) viewport the zone is compressed and the box lands on top
of the buttons, swallowing the tap. So the guided step becomes impossible to
complete on web only.

**Fix pattern:** do NOT relocate the box to `top` (that hides the patient
stats the tutorial is teaching you to watch). Instead reserve empty layout
space at the bottom of the battle column while a bottom-placed guided step is
active, so the action buttons render *above* the box's region and the box
floats over the reserved empty gap. Concretely: a conditional
`marginBottom` on the action zone, gated on `guidedStep?.placement === "bottom"`.
The overlay container is already `pointerEvents: box-none`, so once the buttons
are outside the box's rectangle, taps pass straight through.

**Why:** keeps both the buttons tappable and the top stats visible, works on
every viewport size, and touches no battle/tutorial logic — pure layout.

**How to apply:** any new bottom-placed guided `requireAction` step whose target
control lives in the bottom action zone is covered automatically by the reserve.
Caveat: the reserve is a fixed constant sized for the short prologue copy; if a
step's body text grows a lot (localization) the box could exceed it — then
switch to a measured/dynamic box height rather than bumping the constant blindly.
Top-placed steps (e.g. the cue step) don't get the reserve and don't need it.
