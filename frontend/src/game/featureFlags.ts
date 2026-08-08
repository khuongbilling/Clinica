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
 *
 * Snapshot: Push 0 (canonical V1 freeze)
 *   System ownership and rollback procedures are documented in
 *   docs/freeze-journey-combat-v1.md.
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

// ── Journey — Canonical V1 ──────────────────────────────────────────────────
//
// Enabled: Push 4 (canonical run persistence).
//
// When true, new chapter runs are generated with assignCanonicalEncounters()
// (shift-weighted, density-capped, one-roll-per-tile) instead of the legacy
// assignJourneyEncounters() generator.  The run schema now stores shift,
// callTeam, cards, blessings, and pressure on every new run.
//
// wardEvent encounter tiles are gated separately by WARD_EVENTS_V1 — until
// that flag is true, canonical ward event rolls are silently downgraded to
// 'none' so the EncounterType union stays stable.
//
// Rollback: set to false.  Existing runs are loaded as-is; new runs fall back
// to the legacy generator.  See docs/freeze-journey-combat-v1.md.
export const JOURNEY_CANONICAL_V1 = true;

// ── Combat — Multi-Threat V1 ────────────────────────────────────────────────
//
// Guards the multi-threat combat system (future push):
//   - multiple simultaneous enemy threats per encounter
//   - threat-priority targeting UI
//   - painted threat-portrait asset slots per enemy
//
// Default: false — current single-threat battle system is unchanged.
// Rollback: set to false.  All existing battle.ts logic continues to run.
export const MULTI_THREAT_COMBAT_V1 = false;

// ── Journey — Ward Events V1 ────────────────────────────────────────────────
//
// Guards the wardEvent encounter type (Push 17):
//   - wardEvent added to EncounterType union
//   - seeded assignment in encounters.ts
//   - WardEventModal component with painted asset slot
//   - resolveWardEventVisit in encounterResolution.ts
//
// Default: false — wardEvent tiles are not generated until this is enabled.
// Rollback: set to false.  Existing runs have no wardEvent tiles to render.
export const WARD_EVENTS_V1 = false;
