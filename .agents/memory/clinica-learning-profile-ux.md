---
name: Clinica learning profile UX
description: How setLearningProfile is wired, canonical profile IDs, and where learningProfileLabel lives.
---

# Clinica Learning Profile UX

## The rule
`setLearningProfile(profileId)` is the one write path for `player.learning_profile`. It lives in store.tsx (Ctx type + useCallback impl + value/deps). Call it via `usePlayer().setLearningProfile`.

**Why:** The field already existed in PlayerState (types.ts). It was write-orphaned — only createPlayer/applyClassDiagnostic set it. B12 adds the explicit setter so any screen can update it without re-opening the full class diagnostic flow.

**How to apply:** Any future screen that lets the player change their learning style should use `setLearningProfile` from `usePlayer()`. Do not patch `learning_profile` through `applyClassDiagnostic` just to change the profile; that overwrites too many other fields.

## Canonical profile IDs (B12 picker)
| UI label | Profile ID | ExplanationLayer |
|---|---|---|
| New Learner | `curious` | `fantasy` |
| Health Student | `nursing_student` | `nursing` |
| NCLEX Prep | `nclex` | `nclex` |
| Clinician Review | `professional` | `professional` |

Legacy IDs (`nonmedical`, `rpg`, `cozy`, `teen`, `preNursing`, `nursingStudent`, `nclexPrep`, `healthcareProfessional`) still map to `getExplanationLayer()` correctly — never crash on old players.

## learningProfileLabel helper
Lives in `frontend/src/game/firstWeekPath.ts`. Maps any profile ID (canonical or legacy) to a human-readable label. Imported by `profile.tsx` and `learning-profile.tsx`. Do NOT duplicate this mapping.

## Entry points
- University → MORE AT UNIVERSITY → "Learning Style" MoreRow → `/learning-profile`
- Profile → Settings → "Learning Style" row (shows current label inline) → `/learning-profile`
