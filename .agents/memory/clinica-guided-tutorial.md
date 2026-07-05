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

## Other gotchas
- Cue modal is gated during prologue to only show on the cue step (`activeTutorialId !== "prologueBattle" || guidedCueStep`); wrong cue answers are rejected.
- Outcome modal is suppressed while `activeTutorialId === "prologueBattle"` so the final `prologue_done` tutorial card shows before the win screen.
- `TutorialOverlay` must render AFTER the cue modals in JSX so its top require-action banner sits above the cue overlay.
- Skip is hidden during the prologue (`allowSkip = activeTutorialId !== "prologueBattle"`) so the forced flow can't be bypassed.
- The old per-battle "tap anywhere to start" mission-briefing overlay was removed entirely (was shown at every battle).
