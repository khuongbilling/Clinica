# Rollback Procedure — Fogbound Journey Map V1

**Feature:** Randomised fogbound chapter maps  
**Release:** Push 15  
**Flag:** `FEATURE_FLAG_JOURNEY_FOG_MAP_V1` in `frontend/src/game/featureFlags.ts`

---

## When to roll back

Roll back if:
- Chapter taps on the Journey screen produce crashes or blank screens that a hotfix cannot address within the release window.
- Journey run data is being corrupted or lost on load.
- The fog-map route is causing a broad navigation regression (bottom tabs broken, battle exit fails, etc.).
- A blocker is confirmed in production with no same-day fix path.

---

## Rollback steps

### Step 1 — Disable the feature flag (30 seconds)

Open `frontend/src/game/featureFlags.ts` and change:

```typescript
// BEFORE (current production state)
export const FEATURE_FLAG_JOURNEY_FOG_MAP_V1 = true;

// AFTER (rollback state)
export const FEATURE_FLAG_JOURNEY_FOG_MAP_V1 = false;
```

This single change is sufficient. When the flag is `false`, tapping a chapter tab in `journey.tsx` calls `setSelectedChapterIdx(idx)` (the original local-state path) and renders the per-chapter `ChapterPage` visual map inline, exactly as it did before Push 15.

### Step 2 — Redeploy

Commit the flag change with message:

```
revert(journey): disable fog-map flag — rolling back to visual chapter maps
```

Deploy via the Replit publish workflow. The fog-map route `/journey/chapter/:chapterId/fog-map` remains in the filesystem but is no longer reachable from any in-app navigation.

### Step 3 — Verify

After deployment:

1. Open Journey → tap any unlocked chapter tab → confirm the old per-chapter visual map renders (not the fog-map route).
2. Confirm battle, Ward Defense, and bottom-nav behaviour are unchanged.
3. Confirm Journey tab is still active on the chapter screen.

---

## Data safety

- Journey run records in MongoDB are **not** deleted or altered by this rollback.
- Players who already explored a fog-map run keep their saved state; it simply becomes inaccessible from the UI until the flag is re-enabled.
- No migration is required in either direction.

---

## Re-enabling after a hotfix

1. Apply the fix in a separate branch / push.
2. Set the flag back to `true`.
3. Redeploy with message:

```
release(journey): re-enable fog-map after hotfix
```

---

## Preserved fallback routes

| Route | Status after rollback |
|---|---|
| `/journey` | ✅ Fully functional (original visual maps) |
| `/journey/chapter/:chapterId/fog-map` | 🔒 Exists but unreachable from in-app navigation |
| `/battle`, `/result` | ✅ Unchanged |
| Bottom navigation | ✅ Unchanged |
