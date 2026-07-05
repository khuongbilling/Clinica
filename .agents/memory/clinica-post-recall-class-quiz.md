---
name: Clinica post-recall class quiz
description: Where the LIVE post-recall diagnostic/quiz + class-result/registration screen lives, its current scope boundary, and what still needs wiring in a future push.
---

The diagnostic runs AFTER the tutorial: prologue battle (dehydration_wisp)
→ result → boss (silent_infarct, scripted loss) → lotus-recall → **post-recall**
(name entry, then the 5-question quiz or "Automated Class Assignment", then the
result/registration screen). It is NOT part of initial player creation.

- **Live quiz + result UI:** `frontend/app/post-recall.tsx`. Phases derived from persisted
  flags every render (reload mid-flow resumes correctly): `identity_restored === false`
  → name entry; else `diagnostic_intro_seen === false` → diagnostic (intro → question →
  assigning → result → chooser → confirming); else redirect `/(tabs)`.
- **Single source of truth for questions/scoring/lore:** `frontend/src/game/classQuiz.ts` —
  5 questions (`QUIZ_QUESTIONS`), each choice carries `classWeights` (some dual-class)
  + a resonance string. `computeQuizResult(answers)` → deterministic primary/second-closest
  class + primary resonance, with `DEFAULT_ANSWERS` fallback so skipped questions never
  break scoring. `computeAutomatedAssignment()` picks uniformly among the 6 valid classes
  only (Guardian/Seer/Caretaker/Scholar/Alchemist/Medic), never invalid, primary≠secondary.
  Also holds Push 4's lore/flavor content: `CLASS_FLAVOR_TITLE`, `CLASS_WHY_FITS`,
  `getFuturePathHint()` (resonance → flavor-only future path name, no mechanics gated on it),
  `resonanceForPreview()` (which resonance to show for whichever class is being previewed),
  and the `classIdFromFantasyClass`/`fantasyClassFromClassId` two-way mapping into
  `classTree.ts`'s `ClassId` (works because ClassId is exactly the lowercase form of
  FantasyClass — both lists are hand-kept in sync).
- **Registration (Push 4, live):** the result screen lets the player preview the
  recommended class, the second-closest fit, or any of the 6 classes manually (via a
  `chooser` grid sourced from `classTree.ts`'s `CLASS_IDENTITIES`/`CLASS_IDS`), then tap
  REGISTER to run a staged SYSTEM confirmation message sequence (`confirming` view) before
  calling `store.confirmClassDiagnostic(classId)`. That store method writes ONLY
  `class_tree_id` + `diagnostic_intro_seen` in one atomic update — the exact same
  `class_tree_id` field already read by Profile/PlayerHeader/Class Tree — and deliberately
  does not touch aptitude/learning_profile/heroes_owned, keeping the choice forgiving and
  freely re-switchable later from the Class Tree screen. Starting-trait text is read live
  from `classTree.ts`'s `getClassTree(classId)[0]`, never duplicated.
- **`completeDiagnosticIntro()`** and **`applyClassDiagnostic(ClassDiagnosticInput)`** in
  `store.tsx` are now reserved/unused by the live flow (superseded by
  `confirmClassDiagnostic`) — `applyClassDiagnostic` remains the pre-built "full identity
  switch" method (aptitude/class/hero grant/class_tree_id realign) for if the 6-class →
  3-aptitude mapping is ever needed. Check `post-recall.tsx` first before assuming either is wired up.
- No "Quick Start" wording anywhere in the live flow — replaced by "Automated Class
  Assignment" (subtext: "Let the System assign a starting pathway from unstable soul data.").
- **Gotcha:** raw JSX text nodes do NOT interpret `\u2014`-style escapes (only JS string/
  template literals do) — use the literal `—` character directly in JSX text, escapes only
  inside backticks/quotes.

**Dead code — do not edit for live flow:** `frontend/app/onboarding.tsx` is a legacy,
UNLINKED create-new-player screen with its OWN duplicate quiz copy (still uses old
"Quick Start" wording internally, but is unreachable — no route links to it, confirmed
via grep for `/onboarding` across the app). Leave as-is unless a push explicitly asks to
delete it; don't confuse it with `frontend/src/game/onboarding.ts` (a different module,
hint/depth-label helpers, which IS actively imported by battle/result/codex screens).

**Enemy sprite gotcha:** every enemy id referenced by a battle route MUST exist in
`frontend/src/components/EnemySprites.ts` or the battle letter-boxes (silent fallback).
`dehydration_wisp` (tutorial enemy) was the missing one.
