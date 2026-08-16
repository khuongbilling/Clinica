/**
 * journeyMap/chapterMapTemplate.types.ts — Push 2: Navigation Blueprint
 *
 * Shared types for the ChapterMapTemplate + ChapterMapBlueprint system.
 *
 * These types describe the STATIC authored layout of a chapter's hex map.
 * They are distinct from the runtime JourneyRun / JourneyTile types, which
 * carry per-run encounter assignments, fog state, and player progress.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CANONICAL CHAPTER GENERATION ORDER  (enforced, not aspirational)
 * ═══════════════════════════════════════════════════════════════════
 *  1. Choose Chapter archetype           ← chapterMapBlueprint.ts
 *  2. Generate logical walkable lanes    ← topology.ts / authored coords
 *  3. Generate / open clearings          ← chapterMapBlueprint.ts
 *  4. Validate connected terrain         ← chapterMapTemplates.ts validator
 *  5. Reserve obstacle-free space        ← obstacleZones in blueprint
 *  6. Generate background art from blueprint  ← art layer reads blueprint
 *  7. Place hex grid on walkableCells    ← journeyRunLifecycle.ts
 *  8. Assign encounters to eligible cells ← canonicalEncounters.ts
 *
 *  Background art MUST NEVER be step 1.
 *  The blueprint is invisible gameplay-authoring data; the art layer
 *  must consume it, not drive it.
 *
 * TILE ROLES
 * ──────────
 * start          — the tile where every run begins.
 * gate           — the Chapter Boss Gate tile.  One per chapter, always at
 *                  a meaningful graph distance from start.
 * normal         — an ordinary traversable tile with no fixed semantic.
 * storyReserved  — reserved for a future authored story beat or cutscene;
 *                  encounter generator treats it like 'normal' until wired.
 *
 * TILE TAGS  (optional, for future encounter-placement hints)
 * ─────────────────────────────────────────────────────────
 * Tags are guidance for the encounter generator, NOT enforced constraints.
 * A tile may carry zero or more tags.
 *
 * edge              — near the perimeter of the map footprint.
 * central           — near the geometric centre.
 * alcove            — reachable via only one neighbour (dead-end).
 * intersection      — has four or more neighbours (hub tile).
 * quiet             — preferred for non-combat encounters (treasure, merchant).
 * bossPreferred     — good candidate for an area-boss encounter.
 * treasurePreferred — good candidate for a treasure encounter.
 * merchantPreferred — good candidate for a traveling-merchant encounter.
 */

import type { AxialCoord } from './topology';

export type ChapterTileRole =
  | 'start'
  | 'gate'
  | 'normal'
  | 'storyReserved';

export type ChapterTileTag =
  | 'edge'
  | 'central'
  | 'alcove'
  | 'intersection'
  | 'quiet'
  | 'bossPreferred'
  | 'treasurePreferred'
  | 'merchantPreferred';

export interface ChapterMapTemplateTile {
  /** Canonical key for this tile: the string `"${q},${r}"`. */
  id: string;
  q:  number;
  r:  number;

  /** Semantic role of this tile in the authored layout. */
  role: ChapterTileRole;

  /** Optional placement hints for the encounter generator. */
  tags?: ChapterTileTag[];
}

/**
 * A fully validated, authored layout description for one Chapter.
 *
 * Invariants enforced by getChapterMapTemplate() before returning:
 *   • all tile ids are unique
 *   • all (q, r) coordinate pairs are unique
 *   • exactly one tile has role === 'start'
 *   • exactly one tile has role === 'gate'
 *   • every tile touches at least one other tile (no orphan nodes)
 *   • all playable tiles form one connected component
 *   • gate is reachable from start
 *   • tile count equals the canonical count for this chapter
 *     (30 / 35 / 40 / 45 / 50 … per the chapter band table)
 *   • startTileId and gateTileId reference tiles that exist in `tiles`
 */
export interface ChapterMapTemplate {
  /**
   * Chapter identifier as a string, matching the chapterId used throughout
   * the journey-run system (e.g. "1", "4", "10").
   */
  chapterId: string;

  /**
   * Overall footprint shape — descriptive label, not a strict geometric
   * classification.  'irregular' is the default for organically-grown maps.
   */
  shape: 'rectangular' | 'square' | 'circular' | 'irregular';

  /** All playable tiles in this chapter's fixed layout. */
  tiles: ChapterMapTemplateTile[];

  /** id of the tile with role === 'start'. */
  startTileId: string;

  /** id of the tile with role === 'gate'. */
  gateTileId: string;

  /**
   * Environment / biome identifier used for art and ambient selection.
   * Matched against the asset registry when per-environment artwork ships.
   */
  environmentId: string;
}

// ── DNA / Topology-Grammar types (Push 3) ────────────────────────────────────

/**
 * Twelve structural topology families that describe the HIGH-LEVEL GEOMETRY
 * of a chapter map.  A family is a GENERATION FAMILY, not a fixed layout.
 * Two maps in the same family may differ substantially in aspect ratio,
 * branch count, clearing arrangement, hub position, symmetry, and path loops.
 *
 * A. open_plaza               — broad traversal field, many route choices
 * B. academic_quad            — crossing lanes wrapping garden/academic blocks
 * C. simulation_complex       — directional progression, training wings
 * D. hub_and_spoke            — central hub connected to multiple wings
 * E. twin_hub                 — two large clearing areas, multiple cross-routes
 * F. braided_pathways         — 2–3 broad routes crossing/reconnecting toward gate
 * G. campus_promenade         — consecutive open plazas, linear spine (60–70 tile)
 * H. radial_training_center   — asymmetric spokes radiating from an offset hub
 * I. staggered_academic_blocks — irregular street network from non-walkable blocks
 * J. clustered_training_bays  — open rooms connected via shared circulation halls
 * K. serpentine_campus_walk   — broad winding route with branches/loops at each bend
 * L. multi_court_campus       — several courtyards connected through corridors
 */
export type MapTopologyFamily =
  | 'open_plaza'
  | 'academic_quad'
  | 'simulation_complex'
  | 'hub_and_spoke'
  | 'twin_hub'
  | 'braided_pathways'
  | 'campus_promenade'
  | 'radial_training_center'
  | 'staggered_academic_blocks'
  | 'clustered_training_bays'
  | 'serpentine_campus_walk'
  | 'multi_court_campus';

/** How clearings are distributed across the map footprint. */
export type ClearingPattern =
  | 'scattered'    // clearings spread throughout the footprint
  | 'clustered'    // clearings concentrated in 1–2 regions
  | 'linear'       // clearings arranged along the main route spine
  | 'radial'       // clearings arranged around a central hub
  | 'twin_pole';   // two anchor clearing zones (start-side and gate-side)

/** How non-walkable obstacle zones are distributed (for future art pipeline). */
export type ObstaclePattern =
  | 'none'     // no obstacle zones reserved
  | 'islands'  // small scattered environmental islands
  | 'walls'    // longer barrier-style obstacles
  | 'blocks'   // large building / garden blocks
  | 'mixed';   // combination of islands + blocks

/** Route-flow personality of the map. */
export type RouteBias =
  | 'open'         // all routes accessible, minimal chokepoints
  | 'branching'    // many branches, moderate chokepoints
  | 'looping'      // loops dominate, multiple return paths
  | 'progressive'  // strong directional flow toward the gate
  | 'mixed';       // balanced combination

/**
 * Structural DNA of a chapter's map.
 *
 * The DNA is the SOURCE DOCUMENT for map generation.
 * It is authored once (or generated deterministically from a per-chapter seed)
 * and must never be regenerated on rechallenge.
 *
 * SEED FORMULA
 * ─────────────
 *   seed = `${sagaId}|${bookId}|${chapterId}|map-layout-v1`
 *
 * DIVERSITY RULES (within a Book)
 * ─────────────────────────────────
 * • No consecutive chapters share the same topologyFamily.
 * • No topologyFamily appears more than twice in chapters 1–10.
 * • Newly generated DNA is rejected (and regenerated) if its
 *   MapStructureSignature matches an existing chapter on ≥ 5 dimensions.
 */
export interface ChapterMapDNA {
  /** Chapter number (1-based). */
  chapterId: number;
  /**
   * The seed string used to derive this DNA.
   * Equals `${sagaId}|${bookId}|${chapterId}|map-layout-v1`.
   */
  seed: string;
  /** Human-readable thematic identity for this chapter's environment. */
  themeName: string;
  topologyFamily: MapTopologyFamily;
  aspectRatio: 'wide' | 'portrait' | 'balanced';
  symmetry: 'none' | 'partial' | 'strong';
  /** Width in tiles of the primary traversal lanes. */
  primaryLaneWidth: number;
  /** Width in tiles of secondary / branch lanes. */
  secondaryLaneWidth: number;
  /** Number of distinct branch paths departing from the main spine. */
  branchCount: number;
  /** Number of path loops (routes that reconnect to the same spine). */
  loopCount: number;
  /** Number of open hub / interchange nodes. */
  hubCount: number;
  clearingPattern: ClearingPattern;
  obstaclePattern: ObstaclePattern;
  /** Spatial relationship between the start tile and the gate tile. */
  startGateRelationship: 'opposite' | 'diagonal' | 'offset' | 'indirect';
  routeBias: RouteBias;
}

/**
 * Compressed structural fingerprint used for diversity comparison.
 *
 * Two maps are considered "too similar" when their signatures match
 * on ≥ SIMILARITY_REJECT_THRESHOLD dimensions (currently 5 out of 7).
 * A too-similar candidate is rejected and a new one generated.
 */
export interface MapStructureSignature {
  topologyFamily:       MapTopologyFamily;
  aspectRatio:          'wide' | 'portrait' | 'balanced';
  /** Branch count bucket: low=1–2, mid=3–4, high=5+. */
  branchBand:           'low' | 'mid' | 'high';
  /** Loop count bucket: low=0–1, mid=2–3, high=4+. */
  loopBand:             'low' | 'mid' | 'high';
  hubCount:             number;
  clearingPattern:      ClearingPattern;
  startGateRelationship: 'opposite' | 'diagonal' | 'offset' | 'indirect';
}

// ── Blueprint types (Push 2: Navigation-First) ────────────────────────────────

/**
 * High-level tactical identity of a chapter's map.
 *
 * simulation_plaza    — open arena layout; wide lanes, central clearing.
 * academic_quad       — structured grid with enclosed courtyards.
 * simulation_complex  — multi-wing labyrinthine hospital complex.
 */
export type MapArchetype =
  | 'simulation_plaza'
  | 'academic_quad'
  | 'simulation_complex';

/**
 * Semantic purpose of a map clearing.
 * Used by the encounter generator to assign appropriate content.
 */
export type ClearingPurpose =
  | 'general'
  | 'encounter'
  | 'treasure'
  | 'merchant'
  | 'ward_event'
  | 'boss'
  | 'landmark';

/**
 * A named region of open, tactically significant space within the map.
 * Clearings are the primary points of encounter and narrative interest.
 *
 * `minimumOpenRadius` — number of hex steps from `center` that must
 * remain obstacle-free; enforced when the obstacle-zone layer is placed.
 */
export interface MapClearing {
  id: string;
  purpose: ClearingPurpose;
  /** All walkable cells belonging to this clearing. */
  cells: AxialCoord[];
  /** Approximate geometric centre of the clearing. */
  center: AxialCoord;
  /** Minimum obstacle-free hex radius around the center. */
  minimumOpenRadius: number;
}

/**
 * A named zone of cells reserved for a specific non-walkable purpose
 * (obstacles that break line-of-sight, scenic backdrop elements, etc.).
 *
 * Zones contain only LOGICAL position data — no art assets are stored here.
 * The art layer reads these zones and decides how to dress them.
 */
export interface WorldZone {
  id: string;
  /** Walkable cells adjacent to or surrounding this zone. */
  cells: AxialCoord[];
}

/**
 * Bounding box of the map footprint, expressed in tile coordinates.
 * `marginTiles` additional tiles of padding surround the actual footprint
 * on every side; the art layer should fill this margin with environment
 * dressing so the map never looks clipped.
 */
export interface WorldMargins {
  minQ: number;
  maxQ: number;
  minR: number;
  maxR: number;
  /** How many tile-widths of margin extend beyond the footprint edge. */
  marginTiles: number;
}

/**
 * Navigation-first logical description of a chapter's map.
 *
 * The blueprint is generated BEFORE any background art decisions.
 * Background art must read and conform to this blueprint; it must
 * NEVER be the source of truth for traversal.
 *
 * PERSISTENCE GUARANTEE
 * ─────────────────────
 * For authored chapters (1–10) the blueprint is derived deterministically
 * from checked-in literal coordinate data.  The following never change
 * across rechallenges, seeds, or shifts:
 *   • walkableCells / tileCount    • clearings / obstacleZones
 *   • startCell / gateCell         • archetype / worldMarginTiles
 *
 * The following MAY change between rechallenges (encounter layer only):
 *   • enemy assignments            • treasure placement
 *   • merchant placement           • Ward Event allocation
 *   • Area Boss allocation
 */
export interface ChapterMapBlueprint {
  chapterId: number;
  archetype: MapArchetype;
  tileCount: number;
  /** All hex coordinates that form the traversable map footprint. */
  walkableCells: AxialCoord[];
  /**
   * Named open regions used by the encounter and art generators.
   * Always contains at least: "start" (general), "mid" (encounter), "gate" (boss).
   */
  clearings: MapClearing[];
  /**
   * Zones reserved for obstacle placement (pillars, walls, machinery).
   * Currently empty for authored chapters; populated by the art pipeline.
   */
  obstacleZones: WorldZone[];
  /**
   * Zones reserved for scenic / atmospheric elements (windows, signage, flora).
   * Currently empty for authored chapters; populated by the art pipeline.
   */
  scenicZones: WorldZone[];
  startCell: AxialCoord;
  gateCell: AxialCoord;
  worldMarginTiles: WorldMargins;
  /**
   * The seed that was used to derive this blueprint.
   * For authored chapters this is a stable per-chapter constant;
   * for procedural chapters it matches the topology seed.
   */
  seed: string;
}
