---
name: Clinica post-recall class quiz
description: Where the LIVE post-recall diagnostic/quiz lives, its current scope boundary, and what still needs wiring in a future push.
---

The diagnostic runs AFTER the tutorial: prologue battle (dehydration_wisp)
→ result → boss (silent_infarct, scripted loss) → lotus-recall → **post-recall**
(name entry, then the 5-question quiz or "Automated Class Assignment"). It is
NOT part of initial player creation.

- **Live quiz UI:** `frontend/app/post-recall.tsx`. Phases derived from persisted
  flags every render (reload mid-flow resumes correctly): `identity_restored === false`
  → name entry; else `diagnostic_intro_seen === false` → diagnostic (intro → question →
  assigning → result); else redirect `/(tabs)`.
- **Single source of truth for questions/scoring:** `frontend/src/game/classQuiz.ts` —
  5 questions (`QUIZ_QUESTIONS`), each choice carries `classWeights` (some dual-class)
  + a resonance string. `computeQuizResult(answers)` → deterministic primary/second-closest
  class + primary resonance, with `DEFAULT_ANSWERS` fallback so skipped questions never
  break scoring. `computeAutomatedAssignment()` picks uniformly among the 6 valid classes
  only (Guardian/Seer/Caretaker/Scholar/Alchemist/Medic), never invalid, primary≠secondary.
- **Scope boundary (current, Push 3):** the result screen only *displays* the computed
  class/resonance — it does NOT persist a class onto the player. "CONTINUE" calls the
  lightweight `completeDiagnosticIntro()` store method (sets `diagnostic_intro_seen=true`
  only; does not touch aptitude/class/hero fields). This is deliberate: the backend/store
  still only model 3 aptitudes (guardian/sage/warden), so mapping the 6 quiz classes onto
  aptitudes + hero grants is deferred to a future push.
- **`applyClassDiagnostic(ClassDiagnosticInput)`** in `store.tsx` is reserved/unused —
  it's the pre-built "apply quiz result onto existing player" method (aptitude/class/hero
  grant/class_tree_id realign) for whenever the 6-class → aptitude mapping is implemented.
  Do not assume it's wired to the live UI; check `post-recall.tsx`'s CONTINUE handler first.
- No "Quick Start" wording anywhere in the live flow — replaced by "Automated Class
  Assignment" (subtext: "Let the System assign a starting pathway from unstable soul data.").

**Dead code — do not edit for live flow:** `frontend/app/onboarding.tsx` is a legacy,
UNLINKED create-new-player screen with its OWN duplicate quiz copy (still uses old
"Quick Start" wording internally, but is unreachable — no route links to it, confirmed
via grep for `/onboarding` across the app). Leave as-is unless a push explicitly asks to
delete it; don't confuse it with `frontend/src/game/onboarding.ts` (a different module,
hint/depth-label helpers, which IS actively imported by battle/result/codex screens).

**Enemy sprite gotcha:** every enemy id referenced by a battle route MUST exist in
`frontend/src/components/EnemySprites.ts` or the battle letter-boxes (silent fallback).
`dehydration_wisp` (tutorial enemy) was the missing one.
