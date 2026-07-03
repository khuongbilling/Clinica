---
name: Clinica corruption ↔ treatment-correlation algorithm
description: How disease Corruption responds to treatment appropriateness, and the two independent effect pipelines (corruption vs stability)
---

# Two independent effect pipelines in battle.ts action functions
Every action (applySkill/useItem/useTempAction/applyCard) resolves a clinical
`status` then applies effects through TWO separate modifier paths — do not conflate:
- **Stability / stabilize** effects use `res.modifier` (the generic clinical modifier,
  which IS softened by chapter forgiveness via `applyChapterForgivenessToStatus`).
- **Corruption / strike** effects use `getCorruptionOutcome(status).reductionMult`
  (a dedicated corruption curve that deliberately BYPASSES chapter forgiveness).

**Why:** the disease (Corruption) must respond to treatment↔disease correlation
independently of patient survival (Stability). Correct treatment cuts corruption hard;
wrong treatment must be able to worsen it — chapter forgiveness would blunt that lesson.
**How to apply:** if you add a new corruption-mutating effect, route its clinicalMod
through `getCorruptionOutcome`, NOT `res.modifier`. New stability effects keep `res.modifier`.

# getCorruptionOutcome(status) mapping (clinical.ts)
- strong (recommended/correlated): big reduction — reductionMult 1.6
- appropriate (correct): reductionMult 1.0
- weak (related but off-target): minimal — reductionMult 0.3
- inappropriate (totally unrelated): NO reduction, WORSENS — +corruption, -stability
- unsafe (contraindicated): NO reduction, +corruption (stability -10 already applied)

# Where worsening lives
Worsening (corruption up + stability down for inappropriate/unsafe) is applied ONCE,
centrally, in `applyResolutionToState` (the shared pre-step). The strike branches
compute 0 reduction (reductionMult 0 → Math.max(0,…)=0), so there is no double penalty.

# High corruption accelerates stability loss
`getEnemyDamage(corruption, baseInstability, accelScale=1)` is a stepped multiplier
(>=85:1.8, >=70:1.55, >=55:1.35, >=40:1.2, >=25:1.08, else 1.0) feeding enemy-turn
stability damage. accelScale blends ONLY the corruption-driven extra portion
(`scaledMult = 1 + (mult-1)*accelScale`), never the base. This stacks with
`getStabilizationModifier` (high corruption also damps stabilizing). Net: sick
patient spirals faster — intentional.

# Progressive harshness: chapter + difficulty mode (single knob)
`getCorruptionPenaltyScale(chapter, difficulty)` = `getChapterCorruptionScale(chapter)`
× `getCorruptionModeMultiplier(difficulty)`, clamped [0.5, 1.8]. This is the ONE knob
that tunes how brutal the corruption algorithm is.
- Chapter curve (clinical.ts): ch1 0.6 (gentle for new players), ch2 0.85, ch3 1.0, ch4 1.1, ch5+ 1.2.
- Difficulty mode (difficulty.ts): CorruptionMode normal/hard/chaos mapped from the
  existing DifficultyLevel (guided/standard→normal, clinical/nclex→hard, expert→chaos);
  multipliers normal 1.0 / hard 1.3 / chaos 1.55. No separate mode selector — the
  player's difficulty choice drives it.
Applied in TWO places only: (1) `getCorruptionOutcome(status, penaltyScale)` scales
ONLY worsenBase+stabilityPenalty (reductionMult stays flat so correct-play reward is
constant; scaleFlat floors any nonzero penalty to ≥1); (2) enemy-turn `getEnemyDamage`
accelScale. The 4 strike/reduction call sites keep the default scale (unaffected).
**Why:** review flagged the original flat penalties as too harsh + bypassing chapter
forgiveness; this restores gentle early game while letting hard/chaos escalate.
**Note:** enemy damage gets chapter influence twice (accelScale on corruption-extra +
`getChapterForgiveness().enemyDamageMultiplier` on the whole hit) — intended, not a bug.
