---
name: Clinica adaptive system
description: Two-axis personalization — ExplanationLayer controls language depth; DifficultyLevel controls clue visibility. Fully independent.
---

## Rule
ExplanationLayer and DifficultyLevel are always computed and used independently.

## ExplanationLayer
- Derived from `player.learning_profile` via `getExplanationLayer()` in `explanationLayers.ts`
- Values: fantasy | simpleMedical | nursing | nclex | professional
- Controls: mission briefing text, action feedback, objective strip language, victory summary, skill descriptions

## DifficultyLevel  
- Stored on `player.difficulty`, passed to `initBattle()` as `opts.difficulty`
- Values: guided | standard | clinical | nclex | expert
- Controls: number of visible clues (via `getDifficultyModifier().visibleClues`), reward multiplier
- `expert_later` quiz answer → stored as `clinical`

## Key files
- `src/game/explanationLayers.ts` — all layer-keyed text constants + getObjectiveStrip(), getVictorySummary()
- `src/game/difficulty.ts` — DifficultyLevel, DIFFICULTY_MODIFIERS, getDifficultyModifier(), OBJECTIVE_BY_DIFFICULTY
- `app/onboarding.tsx` — 5-question Codex Awakening quiz (welcome→name→quiz→result)
- `app/battle.tsx` — passes `difficulty` to initBattle; uses layer for showFeedback, objective strip, briefing
- `app/result.tsx` — shows adaptive victory summary + difficulty reward note

**Why:** Different players (curious learners vs NCLEX students vs professionals) need different language AND different challenge levels. Decoupling them lets any combination work.
