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
`getEnemyDamage(corruption, baseInstability)` is a stepped multiplier
(>=85:1.8, >=70:1.55, >=55:1.35, >=40:1.2, >=25:1.08, else 1.0) feeding enemy-turn
stability damage. This stacks with `getStabilizationModifier` (high corruption also
damps how much stabilizing helps). Net: a sick patient spirals faster — intentional.
