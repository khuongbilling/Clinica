/**
 * featureFlags.ts — Clinica compile-time feature toggles
 *
 * Rules:
 *   - All flags default to `false` until the feature is ready for production.
 *   - Never gate user-visible features behind a flag that ships `true` without
 *     a corresponding task/push completing the full implementation.
 *   - Dev-only routes (fog-map, audit screens, etc.) must check __DEV__ in
 *     addition to the flag so they are stripped from production bundles.
 *   - Add a short comment explaining what the flag guards and its target push.
 */

// ── Journey — Fog Map V1 ────────────────────────────────────────────────────
//
// Enabled: Push 15 (production release).
//
// When true, tapping an unlocked chapter on the Journey screen navigates
// directly to /journey/chapter/:chapterId/fog-map (the randomised fogbound
// hex map).  The prior per-chapter visual maps at /journey remain fully intact
// as a rollback fallback — disabling this flag instantly restores the old flow.
//
// Rollback: set to false, redeploy.  See docs/rollback-journey-fog-map.md.
export const FEATURE_FLAG_JOURNEY_FOG_MAP_V1 = true;
