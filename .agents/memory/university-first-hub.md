---
name: University-first onboarding hub
description: How Clinica University is surfaced as the prominent first destination (narrator + banners + reduced clutter)
---

# University-first onboarding

Clinica University is the intended FIRST place a new player goes. The pattern:

- **NarratorGuide** (`frontend/src/components/NarratorGuide.tsx`) is the reusable
  System narrator (single System persona; mentor art removed).
  Two layouts: `bgImage` = full illustrated-banner variant (used on hub), else a
  compact portrait+message panel. Renders portrait + directive message + Objective
  chip + CTA button. Reuse this component for any guided directive; do NOT re-add
  the old stacked SystemNarratorBar + mentor quote + start-here card trio.

- **Main hub** (`frontend/app/(tabs)/index.tsx`): new learners detected via
  `lessons_completed.length === 0` see a prominent illustrated University onboarding
  NarratorGuide (bgImage = `getBannerImage("university")`) before the arena. It
  disappears once they complete their first lesson.

- **University hub** (`frontend/app/university/index.tsx`): options are illustrated
  `BannerCard`s grouped into sections — BEGIN HERE (Lotus Lessons), GROW YOUR
  HEALERS (Recruitment, Training), KNOWLEDGE & PATHS (Library, Class Tree).
  Secondary items (Hero Certification, Department Schools) are demoted to compact
  "MORE AT UNIVERSITY" rows; Future Learning is behind a collapse toggle. This
  reduction is deliberate anti-overwhelm — keep the option count low.

- Banner images live in `assets/images/banner_uni_*.png` + `banner_university.png`,
  registered in `BANNER_IMAGES` in `frontend/src/components/ModeBanners.tsx`
  (keys: university, uni-lessons, uni-recruit, uni-training, uni-library,
  uni-classtree). Section cards are `ModeCardDef` objects (require `artBrief`, set "").

**Why:** the request was to make University the prominent first part of the game and
to cut content that overwhelms new players. Adding options back or restoring the
stacked guidance elements undoes that intent.

**Gotcha:** Deep-linking `/university` in a fresh browser leaves `player` null (the
store only bootstraps via the entry flow), so it shows the loading fallback
(spinner + icon + text) — that is intended, not a crash. Also Metro runs with CI=1
(reloads disabled), so edits require a workflow restart to appear.
