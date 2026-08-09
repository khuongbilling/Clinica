# Fogbound Journey Map — Permanent (Flag Retired)

**Feature:** Randomised fogbound chapter maps  
**Release:** Push 15  
**Status:** Flag `FEATURE_FLAG_JOURNEY_FOG_MAP_V1` was retired in Push 16.
The fog-map is now the **only** chapter-navigation path. The prior SVG visual-map
components (`Chapter1-5VisualMap`, `GenericChapterVisualMap`, `ChapterJourneyMap`,
etc.) and their backing assets have been deleted from the codebase.

---

## There is no flag-based rollback

The feature flag and the visual-map components it protected have both been removed.
Rolling back requires reverting to a git checkpoint taken before the asset deletion.

---

## If a production incident requires a fast rollback

1. Open Replit Checkpoints and roll back to the commit before the visual-map
   deletion (`Remove unused SVG chapter visual maps …`).
2. Redeploy from that checkpoint.
3. Journey chapter taps will resume routing through the old SVG visual maps.

---

## Data safety

- Journey run records in MongoDB are **not** affected by any rollback.
- Players who already explored a fog-map run keep their saved state; it simply
  becomes inaccessible from the UI if a checkpoint rollback is applied.
- No migration is required in either direction.

---

## Current navigation flow (post-retirement)

| Route | Status |
|---|---|
| `/journey` | Loading bridge — immediately replaces history with fog-map |
| `/journey/chapter/:chapterId/fog-map` | ✅ Primary chapter map screen |
| `/battle`, `/result` | ✅ Unchanged |
| Bottom navigation | ✅ Unchanged |
