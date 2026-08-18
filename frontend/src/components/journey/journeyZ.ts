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
 *   FOG_WISP       5300      Fine surface wisps — topmost fog layer
 *   DEV_MASK      14500      Dev fog-mask debug canvas (__DEV__ only)
 *   DEV_OVERLAY   19000      Dev per-tile text/dot overlays (__DEV__ only)
 *   DEV_DIAGNOSTICS 19999   Diagnostics HUD panel (__DEV__ only)
 *
 * ── FOG_EDGE removed ───────────────────────────────────────────────────────
 *
 * FogEdgeLayer (previously z 5300) has been removed from the runtime stack.
 * The organic reveal edge is now produced procedurally by FogBase + FogMid
 * via eraseOrganicFogCluster() (fogMask.ts).  FogWisp fills the slot at 5300.
 * Do not re-add FogEdge or reference fog_edge_day_01.png in production draws.
 *
 * ── Design rationale ───────────────────────────────────────────────────────
 *
 * World content (player, encounters) lives BELOW FogBase.  Fog concealment
 * is achieved via canvas transparency (destination-out) punching organic
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

  /**
   * Blueprint Push: developed environment reveal canvas.
   * Sits just above the BlueprintHexLayer background (0) so the environment
   * painting is progressively composited over the blueprint as tiles are
   * explored.  Still below all terrain tiles (100+) and world content.
   */
  ENV_REVEAL:          1,

  TERRAIN_BASE:      100,

  WORLD_CONTENT_BASE: 3000,
  WORLD_CONTENT_MAX:  4900,

  FOG_BASE:          5000,

  GATE:              5100,

  FOG_MID:           5200,
  // FOG_EDGE slot (5300) retired — organic edge now produced by Base + Mid.
  FOG_WISP:          5300,

  DEV_MASK:         14500,
  DEV_OVERLAY:      19000,
  DEV_DIAGNOSTICS:  19999,
} as const;
