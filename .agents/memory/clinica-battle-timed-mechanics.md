---
name: Clinica battle timed/gated mechanics
description: How Perfect Cast timing, skill cards, ultimates, and clinical cue modals are layered onto BattleState/battle.ts.
---

Battle mechanics that add a "resolve later" step (timing ring, question modal) are implemented as optional params/flags on the existing apply* functions rather than new functions, so the Care Chain/matchup/grading pipeline (`applyResolutionToState`, `combineFinalEffect`, `generateBattleMessage`) stays a single source of truth.

**Why:** Clinica's grading, mastery, and post-battle rewards all read off BattleState fields produced by that one pipeline. Branching the pipeline per-feature risks silently breaking Care Chain progress or clinical-matchup scoring.

**How to apply:** When adding a new "modifier" to an action (e.g. cast quality, a buff), thread it through as a multiplier/param into the existing `eff`/`stabEff` calculation closures in `applySkill`-style functions, not as a parallel effect computed outside the pipeline. Modal/UI state (pending question, timing ring position) lives in local React state or as a plain nullable field on BattleState (`pendingCue`), resolved by a dedicated `answer*`/`apply*` function that returns the normal `ApplyResult` shape.
