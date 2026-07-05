---
name: Clinica post-recall class quiz
description: Where the LIVE class-selection quiz lives and how it applies onto an existing player after the tutorial.
---

The class-selection quiz runs AFTER the tutorial: prologue battle (dehydration_wisp)
→ result → boss (silent_infarct, scripted loss) → lotus-recall → **post-recall**
(name entry, then the 5-question quiz). It is NOT part of initial player creation.

- **Live quiz UI:** `frontend/app/post-recall.tsx`. Two phases derived from persisted
  flags: `identity_restored === false` → name entry; else `diagnostic_intro_seen === false`
  → quiz; else redirect `/(tabs)`. Phase is re-derived every render, so reload mid-flow resumes correctly.
- **Single source of truth for questions/mappings:** `frontend/src/game/classQuiz.ts`
  (`QUIZ_QUESTIONS`, `computeClassProfile(answers)` → aptitude/player_class/learning_profile/
  difficulty/system_affinity/explanation_style/codex_depth + display fields).
- **Apply step:** store method `applyClassDiagnostic(ClassDiagnosticInput)` mutates ONLY
  class-relevant fields on the EXISTING player, grants the aptitude's starting hero
  (APTITUDE_STARTING_HERO, deduped into heroes_owned + active_team), sets class_tree_id
  via classIdForAptitude, and sets diagnostic_intro_seen=true. No new PlayerState fields,
  so backend normalize won't wipe anything.

**Dead code — do not edit for live flow:** `frontend/app/onboarding.tsx` is a legacy,
UNLINKED create-new-player screen with its OWN duplicate quiz copy. `store.completeDiagnosticIntro`
is legacy (marks seen without assigning a class) and is no longer called by any screen.

**Enemy sprite gotcha:** every enemy id referenced by a battle route MUST exist in
`frontend/src/components/EnemySprites.ts` or the battle letter-boxes (silent fallback).
`dehydration_wisp` (tutorial enemy) was the missing one.
