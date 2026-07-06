---
name: Clinica guided prologue tutorial
description: How the forced "Your First Shift" battle tutorial pins exact skills/actions and stays winnable
---

# Guided prologue battle tutorial (prologueBattle)

The prologue battle is a fully *forced* hand-held tutorial: the player can only tap the one action each step demands, ending in a 3-star care chain that wins on the last step.

## How a step pins an action
- `TutorialStep` supports two independent pins: `requiredSkillId` (exact skill) and `requiredActionType` (`"cue"` / `"endTurn"` / a skill `type`).
- `tutorialStore.onRequiredAction(actionType, skillId?)` advances ONLY when the tap matches: if `requiredSkillId` is set it must equal `skillId`, else it falls back to `requiredActionType`.
- In `battle.tsx`, `guidedStep` gates EVERY action handler (skills, cards, items, calls, temp actions, ultimate, care attempt, premature end-turn). Non-matching taps call `tutorialNudge()` and return. The required skill is highlighted (`guidedHighlight`), others dimmed (`guidedDim`), the owning hero is auto-selected + Actions tab opened via an effect keyed on `guidedSkillId`. Cast-timing minigame is bypassed for guided skills.

## Chain roles are NOT skill.type
**Why:** care-chain advancement uses `SKILL_CLINICAL[id].chainRoles`, matched against `enemy.treatmentChain[progress]` in `canAdvanceChain`. A skill's `type` (scout/stabilize/support/strike) is unrelated. e.g. `guardians_touch` (type support) fills the **Stabilize** step; `breath_of_dawn` (type stabilize) fills the **Counter** step; `reassess` (type scout) fills **Reassess**.
**How to apply:** when forcing/verifying a chain, read `chainRoles` for each skill, and confirm `canAdvanceChain`'s secondary gate (tag/system/Universal match) also passes for that enemy.

## Keeping it deterministically winnable
- Give the tutorial enemy its own `ENEMY_CLINICAL` entry whose allowed/strong/inappropriate tags make all forced skills resolve "appropriate", plus `treatmentChain` = the intended role order and the right `weaknesses`.
- Tune enemy `corruption` so the forced sequence lands the win exactly on the final step (chain-complete bonus of -20 is applied on completion). Cue answered correctly grants +1 AP and a stabilize bonus.
- A cue exists at battle init (set in `initBattle`), so a "answer the cue" first step always has something to show.

## Non-blocking overlays: use style.pointerEvents, NOT the prop
**Why:** On this Expo-web target (RN 0.81 / react-native-web) the `pointerEvents="box-none"` *prop* is DEPRECATED (console warns "props.pointerEvents is deprecated. Use style.pointerEvents"). The proven non-blocking overlay here (`TutorialOverlay`'s guided banner) uses `style={{ pointerEvents: 'box-none' }}` and taps still pass through to the skills underneath. `box-none` = the View is never the touch target but its children are, so an absolute-fill wrapper can float a card while the game stays tappable.
**How to apply:** For any float-over-game overlay, put `pointerEvents: 'box-none'` in the wrapper's STYLE (children get touches by default). Do not "fix" it back to the prop form — that reintroduces the deprecation and doesn't match the working pattern.

## Cue feedback is non-blocking; the cue QUESTION still blocks
- The unanswered Clinical Cue modal (`state.pendingCue && !cueFeedback`) stays a full-screen blocking `modalOverlay` — the player must answer it.
- The ANSWERED-cue feedback (`cueFeedback`) is a bottom-anchored card (`cueFeedbackWrap` absolute-fill + style.pointerEvents box-none; `cueFeedbackCard` the visible ScrollView) so reading the rationale never freezes the shift. Auto-continues after 3s (`setTimeout` in `handleCueAnswer`) or via CONTINUE.

## Long-press hint is a tutorial step, not a separate coachmark
- The old standalone `LongPressCoachmark` component was deleted. Its "tap to use / long-press for full nursing+NCLEX detail" message now lives as the one-time non-action step `prologue_skills` in `TUTORIALS.prologueBattle` (between the cue step and the scout step). Don't re-add a separate coachmark.

## Every guided step highlights its control — including END TURN
- Skills use `guidedHighlight`/`guidedDim`; the END TURN button now does too: `guidedEndTurnStep && styles.guidedHighlight`, and `guidedStep && !guidedEndTurnStep && styles.guidedDim`. Keep END TURN in sync with the skill highlight logic when touching guided styling.

## Other gotchas
- Cue modal is gated during prologue to only show on the cue step (`activeTutorialId !== "prologueBattle" || guidedCueStep`); wrong cue answers are rejected.
- Outcome modal is suppressed while `activeTutorialId === "prologueBattle"` so the final `prologue_done` tutorial card shows before the win screen.
- `TutorialOverlay` must render AFTER the cue modals in JSX so its top require-action banner sits above the cue overlay.
- Skip is hidden during the prologue (`allowSkip = activeTutorialId !== "prologueBattle"`) so the forced flow can't be bypassed.
- The old per-battle "tap anywhere to start" mission-briefing overlay was removed entirely (was shown at every battle).

## Force-start the prologue tutorial — do NOT gate it on isCompleted
**Why:** Tutorial completion (`clinica.tutorials.v1`) lives in **device-local AsyncStorage**, but the prologue battle is only reachable while the **backend-owned** `prologue_complete` flag is false. Gating the auto-start on `!isCompleted("prologueBattle")` meant a device that ran the prologue once kept the flag `true` locally, so a fresh backend player silently got NO guided walkthrough (no forcing, no highlights) on that phone — while a fresh web session worked. This is exactly why "works in the subagent/web but not in Expo Go".
**How to apply:** In `battle.tsx`'s auto-start effect, `isPrologueTutorial` always calls `startTutorial("prologueBattle")` unconditionally. Reaching the prologue battle is itself proof the player still needs it. Only the non-prologue `firstBattle` tutorial is gated on device-local `isCompleted`. Never re-add an `isCompleted` guard around the prologue start.
