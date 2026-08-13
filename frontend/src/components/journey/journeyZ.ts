/**
 * journeyZ — canonical z-index table for all Journey / chapter-map layers.
 *
 * ── Layer order (bottom → top) ─────────────────────────────────────────────
 *
 *   BACKGROUND        0      Chapter environment painting (fills worldW × worldH)
 *   TERRAIN_BASE    100      Hex-tile Pressables (rings, shadows) — y-depth sorted
 *   WORLD_CONTENT  3000–4900 Player sprite, encounter nodes, treasure, gate-objects
 *   FOG_BASE       5000      Primary canvas fog — covers terrain + world content
 *   GATE           5100      Gate landmark — rises above base fog, veiled by upper mist
 *   FOG_MID        5200      Atmospheric density variation above gate
 *   FOG_EDGE       5300      Organic reveal-edge sprites at the visibility boundary
 *   FOG_WISP       5400      Fine surface wisps — topmost fog layer
 *   DEV_MASK      14500      Dev fog-mask debug canvas (__DEV__ only)
 *   DEV_OVERLAY   19000      Dev per-tile text/dot overlays (__DEV__ only)
 *   DEV_DIAGNOSTICS 19999   Diagnostics HUD panel (__DEV__ only)
 *
 * ── Design rationale ───────────────────────────────────────────────────────
 *
 * World content (player, encounters) lives BELOW FogBase.  Fog concealment
 * is achieved via canvas transparency (destination-in compositing) punching
 * clear holes at visibleNow / exploredButOutOfVision tile centres.  Objects
 * on unexplored tiles are hidden by the opaque fog canvas — no z-poke-through.
 *
 * The gate sits BETWEEN FogBase and FogMid so it visually rises through the
 * lowest fog mass while still being veiled by the upper atmospheric layers.
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *
 *   import { JOURNEY_Z } from './journeyZ';
 *
 *   // Terrain tile:
 *   zIndex: JOURNEY_Z.TERRAIN_BASE + Math.round(worldY * TERRAIN_DEPTH)
 *
 *   // World object (clamped so nothing escapes below fog):
 *   zIndex: Math.min(
 *     JOURNEY_Z.WORLD_CONTENT_MAX,
 *     JOURNEY_Z.WORLD_CONTENT_BASE + Math.round(worldY * OBJECT_DEPTH),
 *   )
 */

export const JOURNEY_Z = {
  BACKGROUND:          0,

  TERRAIN_BASE:      100,

  WORLD_CONTENT_BASE: 3000,
  WORLD_CONTENT_MAX:  4900,

  FOG_BASE:          5000,

  GATE:              5100,

  FOG_MID:           5200,
  FOG_EDGE:          5300,
  FOG_WISP:          5400,

  DEV_MASK:         14500,
  DEV_OVERLAY:      19000,
  DEV_DIAGNOSTICS:  19999,
} as const;
