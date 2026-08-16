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
import type { TimeOfDay }  from './types';

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

// ══════════════════════════════════════════════════════════════════════════════
// Push 4 — PATHWAY GRAPH
// ══════════════════════════════════════════════════════════════════════════════
//
// The PathwayGraph is an ABSTRACT logical graph that sits BETWEEN the MapDNA
// and the hex coordinate embedding.  It has no spatial coordinates.
//
// Generation order (updated):
//   DNA → PathwayGraph → hex embedding → art / encounters
//
// PathwayGraph must pass validation before any hex work begins.

/**
 * The seven semantic roles a pathway node can carry.
 *
 * START           — the single entry point where the player begins.
 * JUNCTION        — a decision point: three or more lanes meet here.
 * CLEARING        — an open area; mandatory dead-end reward destination.
 * LANDMARK        — a named narrative or exploration landmark; dead-end ok.
 * TRANSITION      — a connector segment between two larger nodes.
 * FINAL_APPROACH  — the lane immediately before the Gate (boss encounter zone).
 * GATE            — the Chapter Boss Gate; single exit.
 */
export type PathNodeType =
  | 'START'
  | 'JUNCTION'
  | 'CLEARING'
  | 'LANDMARK'
  | 'TRANSITION'
  | 'FINAL_APPROACH'
  | 'GATE';

/** A single node in the abstract pathway graph. */
export interface PathNode {
  id: string;
  type: PathNodeType;
  /** Optional human-readable label for art / encounter guidance. */
  label?: string;
}

/**
 * An undirected traversal lane between two pathway nodes.
 *
 * `width` maps to approximate hex-tile lane widths:
 *   primary   — 2–3 hexes wide
 *   secondary — 1–2 hexes wide
 *
 * `laneLength` is the approximate number of hex tiles the lane spans
 * (before spatial embedding; used as a sizing hint for the art pipeline).
 */
export interface PathEdge {
  id: string;
  fromId: string;
  toId: string;
  width: 'primary' | 'secondary';
  laneLength: number;
}

/**
 * The complete abstract pathway graph for one chapter.
 *
 * All structural metrics are pre-computed and stored here so consumers
 * never need to re-run graph algorithms.
 */
export interface PathwayGraph {
  chapterId: number;
  /** DNA seed that generated this graph. */
  seed: string;
  nodes: PathNode[];
  edges: PathEdge[];
  startNodeId: string;
  gateNodeId: string;
  /**
   * Cycle rank: |edges| − |nodes| + 1 for a connected graph.
   * A value of 0 means the graph is a spanning tree (no loops).
   * Directive minimum: ≥ 1 loop.
   */
  loopCount: number;
  /**
   * IDs of nodes whose degree is 1, excluding START and GATE.
   * These must be CLEARING or LANDMARK nodes (reward dead ends).
   */
  deadEndNodeIds: string[];
  /** BFS edge-hop distance from start to gate along the shortest path. */
  shortestRouteLength: number;
  /** True when ≥ 2 distinct simple paths exist from start to gate. */
  hasMultipleRoutes: boolean;
  /** Maximum BFS distance from start across all reachable nodes. */
  graphDiameter: number;
}

/**
 * Result of validating a PathwayGraph against the Push-4 constraints.
 * `valid` is the conjunction of all boolean checks.
 */
export interface PathwayGraphValidation {
  valid: boolean;
  gateReachable: boolean;
  isConnected: boolean;
  hasMultipleRoutes: boolean;
  hasMinLoops: boolean;
  deadEndCount: number;
  /** All degree-1 non-START/GATE nodes are CLEARING, LANDMARK, or TRANSITION. */
  deadEndsHaveReward: boolean;
  /** shortestRouteLength ≥ ceil(0.35 × graphDiameter). */
  startGateDistanceSufficient: boolean;
  /** Human-readable list of constraint violations; empty when valid. */
  errors: string[];
}

// ══════════════════════════════════════════════════════════════════════════════
// Push 5 — HEX LANE LAYOUT
// ══════════════════════════════════════════════════════════════════════════════
//
// The HexLaneLayout expands the abstract PathwayGraph into the exact
// walkable tile footprint for a chapter.
//
// Generation pipeline (updated):
//   DNA → PathwayGraph → HexLaneLayout → art / encounters
//
// Tile budget targets (generation guidance, not rigid):
//   55–65%  Lane tiles
//   25–35%  Clearing tiles
//    5–15%  Transition / connector tiles
//
// Clearing count formula:
//   clearingCount = clamp(round(tileCount / 10), 5, 12)

/** Semantic purpose of a clearing zone (spatial opportunity, not encounter). */
export type ClearingType =
  | 'GENERAL_CLEARING'
  | 'JUNCTION_CLEARING'
  | 'SIDE_CLEARING'
  | 'MAJOR_CLEARING'
  | 'FINAL_CLEARING';

/** Visual/spatial shape of a clearing zone. */
export type ClearingShape =
  | 'oval'
  | 'crescent'
  | 'widened_intersection'
  | 'court'
  | 'offset_plaza'
  | 'irregular_bay';

/**
 * One named open region in the hex footprint.
 *
 * Sizes:
 *   small  — 3–5 cells
 *   normal — 5–8 cells
 *   major  — 8–12 cells  (MAJOR_CLEARING / FINAL_CLEARING)
 *
 * `exitCount` reflects how many distinct lane segments enter/exit this
 * clearing; influences encounter selection (central nodes: 2–4 exits,
 * side nodes: 1 exit, major junctions: 3–5 exits).
 */
export interface ClearingZone {
  id: string;
  /** References the PathwayGraph node that this clearing expands from. */
  nodeId: string;
  type: ClearingType;
  shape: ClearingShape;
  center: AxialCoord;
  size: 'small' | 'normal' | 'major';
  cells: AxialCoord[];
  exitCount: number;
}

/**
 * One lane corridor in the hex footprint.
 *
 * `cells` includes the center-line tiles plus perpendicular width expansion.
 * Tiles near a clearing node are widened further as a transition zone.
 *
 * `width` mirrors the PathEdge width:
 *   primary   — 2–3 hexes wide (halfWidth expansion = 1)
 *   secondary — 1–2 hexes wide (halfWidth expansion = 0 or 1)
 */
export interface LaneSegment {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  cells: AxialCoord[];
  width: 'primary' | 'secondary';
}

/**
 * The fully expanded hex tile footprint for one chapter.
 *
 * Guaranteed properties:
 *   • `actualTileCount === targetTileCount`
 *   • All tiles form one connected component (verified by BFS from `startCell`).
 *   • `startCell` and `gateCell` are present in `cells`.
 *   • No duplicate coords in `cells`.
 *   • `clearingZones.length` ≈ clamp(round(targetTileCount/10), 5, 12).
 */
export interface HexLaneLayout {
  chapterId: number;
  seed: string;
  /** All deduplicated tile coordinates forming the walkable footprint. */
  cells: AxialCoord[];
  startCell: AxialCoord;
  gateCell: AxialCoord;
  clearingZones: ClearingZone[];
  laneSegments: LaneSegment[];
  targetTileCount: number;
  actualTileCount: number;
  /**
   * Approximate budget fractions (values overlap and need not sum to 1.0;
   * they measure each category's share of the total, pre-overlap).
   */
  budgetFractions: {
    lane: number;
    clearing: number;
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Push 6 — SCENERY LAYOUT (non-walkable negative-space zones)
// ══════════════════════════════════════════════════════════════════════════════
//
// Derived from the HexLaneLayout (walkable footprint).
// Rule: walkable space is sacred — no scenery zone may overlap the walkable
// safety mask (walkable cells + 1-tile border).
//
// Environmental density is derived from ChapterMapDNA.obstaclePattern and
// chapter number:
//   Ch 1–3        → LOW
//   obstaclePattern 'none'   → LOW
//   obstaclePattern 'islands' → LOW / MEDIUM (by chapter)
//   obstaclePattern 'walls'  → MEDIUM
//   obstaclePattern 'blocks' → MEDIUM / HIGH (by chapter)
//   obstaclePattern 'mixed'  → HIGH

// ══════════════════════════════════════════════════════════════════════════════
// Push 8 — FULL STRUCTURAL FINGERPRINT (diversity enforcement)
// ══════════════════════════════════════════════════════════════════════════════
//
// Expands the 7-dimension MapStructureSignature (DNA-only) into a
// 12-dimension FullStructuralFingerprint that incorporates computed values
// from PathwayGraph and HexLaneLayout.
//
// Similarity threshold: reject a map when ≥ FULL_REJECT_THRESHOLD dimensions
// match an existing chapter (see chapterDiversityEnforcement.ts).
//
// Dimensions from the directive:
//   1.  topologyFamily          — DNA, exact match
//   2.  aspectRatio             — DNA, exact match
//   3.  symmetry                — DNA, exact match (was missing from MapStructureSignature)
//   4.  hubCount                — DNA, exact match
//   5.  junctionCountBand       — PathwayGraph JUNCTION node count, bucketed
//   6.  branchBand              — DNA branchCount, bucketed (inherited)
//   7.  loopBand                — DNA loopCount, bucketed (inherited)
//   8.  clearingCountBand       — HexLaneLayout.clearingZones.length, bucketed
//   9.  avgClearingSizeBand     — mean clearing zone cell count, bucketed
//  10.  primaryLaneBand         — DNA.primaryLaneWidth, bucketed
//  11.  startGateRelationship   — DNA, exact match
//  12.  deadEndBand             — PathwayGraphValidation.deadEndCount, bucketed

/** Number of JUNCTION nodes in the PathwayGraph, bucketed for similarity comparison. */
export type JunctionCountBand = 'few' | 'moderate' | 'many';
/** Mean tile-area of clearing zones, bucketed for similarity comparison. */
export type AvgClearingSizeBand = 'small' | 'medium' | 'large';
/** Primary lane width from DNA, bucketed for similarity comparison. */
export type PrimaryLaneBand = 'narrow' | 'standard' | 'wide';
/** Dead-end node count from PathwayGraphValidation, bucketed. */
export type DeadEndBand = 'none' | 'few' | 'many';
/** Clearing count from HexLaneLayout.clearingZones.length, bucketed. */
export type ClearingCountBand = 'few' | 'moderate' | 'many';

/**
 * 12-dimension structural fingerprint for diversity enforcement.
 *
 * Computed from: ChapterMapDNA + PathwayGraph + HexLaneLayout.
 * Used by `chapterDiversityEnforcement.ts` to detect structural repetition.
 *
 * Two chapters are considered "too similar" when their fingerprints match
 * on ≥ FULL_REJECT_THRESHOLD dimensions (default 8 out of 12).
 * Even with different hex coordinates, matching 8+ dimensions feels like
 * the same map in a different rotation.
 */
export interface FullStructuralFingerprint {
  chapterId:             number;
  /** 1. Core topology family (strongest differentiator — distinct across BOOK1). */
  topologyFamily:        MapTopologyFamily;
  /** 2. Aspect ratio of the map world. */
  aspectRatio:           'wide' | 'portrait' | 'balanced';
  /** 3. Spatial symmetry of the chapter layout. */
  symmetry:              'none' | 'partial' | 'strong';
  /** 4. Number of open hub / interchange nodes. */
  hubCount:              number;
  /** 5. Number of JUNCTION-type nodes in the PathwayGraph, bucketed. */
  junctionCountBand:     JunctionCountBand;
  /** 6. DNA branchCount bucketed: low=1–2, mid=3–4, high=5+. */
  branchBand:            'low' | 'mid' | 'high';
  /** 7. DNA loopCount bucketed: low=0–1, mid=2–3, high=4+. */
  loopBand:              'low' | 'mid' | 'high';
  /** 8. Number of named clearing zones, bucketed. */
  clearingCountBand:     ClearingCountBand;
  /** 9. Mean tile area of clearing zones, bucketed. */
  avgClearingSizeBand:   AvgClearingSizeBand;
  /** 10. DNA.primaryLaneWidth bucketed: narrow=3–4, standard=5–6, wide=7–8. */
  primaryLaneBand:       PrimaryLaneBand;
  /** 11. Spatial relationship between the start tile and the gate tile. */
  startGateRelationship: 'opposite' | 'diagonal' | 'offset' | 'indirect';
  /** 12. Dead-end count from PathwayGraphValidation, bucketed. */
  deadEndBand:           DeadEndBand;
}

/**
 * Report returned by `validateBookDiversity`.
 * `valid` is true only when ALL diversity constraints pass.
 */
export interface BookDiversityReport {
  /** True when all pairwise similarity checks and axis coverage checks pass. */
  valid: boolean;
  /** Chapter pairs whose similarity meets or exceeds FULL_REJECT_THRESHOLD. */
  tooSimilarPairs: Array<{ chA: number; chB: number; similarity: number }>;
  /** Consecutive chapters sharing the same topology family. */
  consecutiveFamilyViolations: Array<{ chA: number; chB: number; family: MapTopologyFamily }>;
  /** Diversity axes that are not adequately covered. */
  axisViolations: string[];
  /** All per-chapter fingerprints (for debugging). */
  fingerprints: FullStructuralFingerprint[];
}

// ══════════════════════════════════════════════════════════════════════════════
// Push 7 — BACKGROUND SPEC (art-specification bridge: data → raster art)
// ══════════════════════════════════════════════════════════════════════════════
//
// The code pipeline (Pushes 1–6) generates blueprints, masks, and geometry.
// The ACTUAL environment art must be raster-generated — never approximated
// with CSS, SVG, or procedural vector art.
//
// ChapterBackgroundSpec is the structured specification consumed by an AI image
// generator to produce each chapter's per-shift raster background.
//
// SHIFT GEOMETRY INVARIANT
// ──────────────────────────
//   Day, Evening, and Night variants share the SAME:
//     lanes · clearings · obstacles · landmarks · world footprint
//   Shift variants change ONLY:
//     lighting · atmosphere · illuminated windows · ambient detail
//   They NEVER move buildings or paths.

/** Eight canonical environment archetypes for the university/simulation world. */
export type ChapterEnvironmentType =
  | 'ACADEMIC_QUAD'
  | 'SIMULATION_PLAZA'
  | 'CLINICAL_SKILLS_COMPLEX'
  | 'MOCK_WARD_CAMPUS'
  | 'DIAGNOSTIC_CENTER'
  | 'EMERGENCY_SIMULATION_CENTER'
  | 'ANATOMY_GARDEN'
  | 'CAPSTONE_CAMPUS';

/**
 * Art specification for one shift variant (day / evening / night) of a
 * chapter background.
 *
 * Raster rule: the generated image must be a real raster asset (PNG/WebP),
 * not CSS, SVG, or procedural vector art.  The `targetAssetPath` and
 * `metroRequirePath` indicate exactly where to save the file so
 * chapterMapVisuals.ts can register it.
 */
export interface ShiftBackgroundSpec {
  shift: TimeOfDay;
  /** Lighting character for this shift ("warm morning sunlight flooding…"). */
  lightingDescription: string;
  /** Atmospheric quality ("pale jade mist, vivid greenery, clear sky above"). */
  atmosphereDescription: string;
  /** Additional detail that changes between shifts (windows lit, haze, etc.). */
  ambientDetail: string;
  /**
   * Full AI image-generation prompt.
   * Encodes: style, environment type, walkable-path visual, clearing visual,
   * scenery framing, lighting, atmosphere, and technical constraints.
   */
  aiPrompt: string;
  /**
   * Negative prompt — elements the generated image must NOT contain.
   * Always excludes: characters, UI, text, grid, CSS/SVG art shapes.
   */
  negativePrompt: string;
  /**
   * Filesystem path (relative to `frontend/`) where the generated raster
   * should be saved.
   * E.g. `assets/ui/journey/map/map-platform-background-ch1-day.png`
   */
  targetAssetPath: string;
  /**
   * Metro `require()` string for registering the generated asset in
   * `chapterMapVisuals.ts`.
   * E.g. `@/assets/ui/journey/map/map-platform-background-ch1-day.png`
   */
  metroRequirePath: string;
  /** Pixel dimensions for the generated image. */
  targetDimensions: { width: number; height: number };
}

/**
 * Complete art specification for one chapter's fog-map background.
 *
 * Sources all of: MapDNA · HexLaneLayout · SceneryLayout.
 *
 * WALKABLE REGIONS:    rendered as broad paved paths / academy flooring / courts
 * ENCOUNTER CLEARINGS: rendered as open spaces (courts, bays, pavilion floors)
 * SCENERY:             borders and frames the walkable mask — never overlaps it
 *
 * Three shift variants (day / evening / night) share the same geometry but
 * differ in lighting, atmosphere, and ambient detail.
 */
export interface ChapterBackgroundSpec {
  chapterId: number;
  /** DNA seed that produced the underlying spatial data. */
  seed: string;
  /** Canonical environment archetype for this chapter. */
  environmentType: ChapterEnvironmentType;
  /** Human-readable environment name (from ChapterMapDNA.themeName). */
  environmentName: string;
  /** Art direction paragraph describing the chapter's visual identity. */
  artDirection: string;
  /** How the walkable lanes and paths should look visually. */
  walkablePathStyle: string;
  /** How encounter clearings should appear (open space type and character). */
  clearingStyle: string;
  /**
   * How scenery zones frame and border the walkable regions.
   * Must never overlap the walkable safety mask.
   */
  sceneryFramingStyle: string;
  /**
   * Geometry invariant statement: what is IDENTICAL across all three shifts.
   * Referenced when generating each variant to prevent layout drift.
   */
  geometryInvariantNote: string;
  /** Per-shift art specifications. */
  shifts: Record<TimeOfDay, ShiftBackgroundSpec>;
}

/** Semantic type of a scenery / environmental zone. */
export type SceneryZoneType =
  | 'ARCHITECTURE'
  | 'GARDEN'
  | 'PLANTER'
  | 'COLUMN_GROUP'
  | 'BUILDING_WING'
  | 'OBSERVATION_DECK'
  | 'SIMULATION_STRUCTURE'
  | 'DECORATIVE_LANDMARK'
  | 'WATER_FEATURE'
  | 'ACADEMIC_STATUE';

/** Density of environmental scenery.  Derived from DNA + chapter number. */
export type EnvironmentalDensity = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * One named environmental zone in the non-walkable negative space.
 *
 * Placement rules:
 *   • All `cells` are outside the walkable safety mask.
 *   • `cells` form one hex-connected component.
 *   • Zones near clearings frame them (OBSERVATION_DECK, DECORATIVE_LANDMARK).
 *   • Zones enclosed by path curves contain ARCHITECTURE or GARDEN.
 *   • Zones in lane islands contain COLUMN_GROUP or PLANTER.
 *   • Some negative space intentionally stays empty (density gate).
 */
export interface SceneryZone {
  id: string;
  type: SceneryZoneType;
  cells: AxialCoord[];
  /** Rounded centroid of the cell cluster (may not be a valid tile itself). */
  centroid: AxialCoord;
  /** Number of cells in this zone. */
  area: number;
  /**
   * How many of this zone's cells are directly adjacent to the walkable
   * safety mask.  High contact → zone is "right beside" a path or clearing.
   */
  walkableContactCount: number;
  /**
   * True when > 50 % of border neighbours of this zone's cells are walkable
   * (the zone sits inside a curve or enclosed pocket of path geometry).
   */
  isEnclosed: boolean;
  /**
   * Minimum hex-graph distance from any cell in this zone to the nearest
   * clearing centre.  ≤ 2 → "frames" the clearing.
   */
  nearestClearingDist: number;
}

/**
 * The full scenery analysis for one chapter map.
 *
 * Guaranteed:
 *   • Every cell in `sceneryZones` is absent from `walkableSafetyMaskKeys`.
 *   • `walkableSafetyMaskKeys` is a superset of all HexLaneLayout.cells keys.
 *   • All world-bounds coordinates are contained in the axial bounding box
 *     `worldBounds` (with ≥ 3 tile margin around the safety mask).
 *   • `sceneryZones.length ≥ 1` (at least one zone is always produced).
 */
export interface SceneryLayout {
  chapterId: number;
  seed: string;
  /**
   * "q,r" keys of every tile in the walkable safety mask:
   *   walkable cells ∪ all immediate hex-neighbours of walkable cells.
   * Scenery must never overlap this set.
   */
  walkableSafetyMaskKeys: string[];
  /** Axial bounding box of the world space (includes scenery space margin). */
  worldBounds: { minQ: number; maxQ: number; minR: number; maxR: number };
  sceneryZones: SceneryZone[];
  environmentalDensity: EnvironmentalDensity;
}
