/**
 * sceneryPropTypes — canonical catalog of freestanding scenery props
 *
 * These are the physical environmental objects that occupy scenery zones
 * on the chapter map.  They are NEVER baked into the raster background;
 * instead they are placed as a runtime layer above the clean floor art and
 * depth-sorted against the player and encounter sprites.
 *
 * Contract
 * ────────
 * - Props may ONLY be placed outside the walkable safety mask.
 * - Props depth-sort by axialDepth (`r + q / 2`) within WORLD_CONTENT_BASE–MAX.
 * - The `collisionRadiusTiles` is the half-width of the prop's footprint in
 *   tile-size units, used for the safety-buffer check.
 * - `sizeTiles` is the visual width/height in tile-size units.
 * - Shift variants share the SAME positions — only lighting/tint changes.
 *
 * Scenery vs encounter objects
 * ────────────────────────────
 * SceneryProps are PRESENTATION only.  They are separate from treasure,
 * merchant, Ward Event, enemy, and Area Boss sprites.  Encounter
 * randomisation is unchanged. Starting with Chapter 6, a finished map raster
 * cannot ship unless every blocking scenery zone is also backed by real runtime
 * prop art (see obstaclePresentationContract.ts).
 */

// ── Prop types ────────────────────────────────────────────────────────────────

export type SceneryPropType =
  | 'SIMULATION_BED'
  | 'EXAM_TABLE'
  | 'MEDICAL_CONSOLE'
  | 'SUPPLY_CART'
  | 'WORKSTATION'
  | 'OBSERVATION_TERMINAL'
  | 'ACADEMY_PLANTER'
  | 'BENCH'
  | 'TRAINING_MACHINE'
  | 'MEDICAL_DISPLAY'
  | 'DECORATIVE_COLUMN';

// ── Prop sizing categories ────────────────────────────────────────────────────

export type PropSizeCategory = 'small' | 'normal' | 'large';

// ── Prop definition ───────────────────────────────────────────────────────────

export interface SceneryPropDef {
  /** Canonical type identifier. */
  type: SceneryPropType;

  /** Human-readable label for diagnostics. */
  label: string;

  /** Size category — drives safety-buffer distance from walkable bed. */
  sizeCategory: PropSizeCategory;

  /**
   * Visual footprint in tile-size units (width × height of the rendered image).
   * Used for centering and shadow anchor.
   */
  sizeTiles: { w: number; h: number };

  /**
   * Collision footprint half-extent in tile-size units.
   * The prop is rejected if any point within this radius (Manhattan) overlaps
   * the walkable safety mask.
   */
  collisionRadiusTiles: number;

  /**
   * Additional safety buffer in tile-size units beyond the hard collision radius.
   * Applied per spec §6:
   *   normal prop  → 0.15–0.20 × tile
   *   large prop   → 0.25–0.35 × tile
   */
  safetyBufferTiles: number;

  /**
   * Asset require() module number.  null = generate placeholder colored box in
   * DEV mode.  Populated once actual PNG art is generated.
   */
  asset: number | null;

  /**
   * Tint color used for the DEV placeholder box when asset is null.
   * Chosen to be visually distinct per prop category.
   */
  devPlaceholderColor: string;

  /**
   * Whether this prop is collision-blocking (cannot overlap walkable bed).
   * All props in this catalog are blocking; non-blocking surface detail
   * (floor inlays, circuit traces) is baked directly into the background.
   */
  isBlocking: true;
}

// ── Prop catalog ──────────────────────────────────────────────────────────────

export const SCENERY_PROP_DEFS: Readonly<Record<SceneryPropType, SceneryPropDef>> = {
  SIMULATION_BED: {
    type:                'SIMULATION_BED',
    label:              'Simulation Bed',
    sizeCategory:       'large',
    sizeTiles:          { w: 1.2, h: 0.9 },
    collisionRadiusTiles: 0.55,
    safetyBufferTiles:  0.30,
    asset:              null,
    devPlaceholderColor: '#4a8fa8',
    isBlocking:         true,
  },
  EXAM_TABLE: {
    type:                'EXAM_TABLE',
    label:              'Exam Table',
    sizeCategory:       'normal',
    sizeTiles:          { w: 1.0, h: 0.7 },
    collisionRadiusTiles: 0.45,
    safetyBufferTiles:  0.18,
    asset:              null,
    devPlaceholderColor: '#6a8fc8',
    isBlocking:         true,
  },
  MEDICAL_CONSOLE: {
    type:                'MEDICAL_CONSOLE',
    label:              'Medical Console',
    sizeCategory:       'normal',
    sizeTiles:          { w: 0.9, h: 1.1 },
    collisionRadiusTiles: 0.40,
    safetyBufferTiles:  0.17,
    asset:              null,
    devPlaceholderColor: '#3a9fca',
    isBlocking:         true,
  },
  SUPPLY_CART: {
    type:                'SUPPLY_CART',
    label:              'Supply Cart',
    sizeCategory:       'small',
    sizeTiles:          { w: 0.7, h: 0.7 },
    collisionRadiusTiles: 0.30,
    safetyBufferTiles:  0.15,
    asset:              null,
    devPlaceholderColor: '#8ab4d0',
    isBlocking:         true,
  },
  WORKSTATION: {
    type:                'WORKSTATION',
    label:              'Workstation',
    sizeCategory:       'normal',
    sizeTiles:          { w: 1.1, h: 0.8 },
    collisionRadiusTiles: 0.45,
    safetyBufferTiles:  0.18,
    asset:              require('@/assets/map-props/academy-medical-workstation.png') as number,
    devPlaceholderColor: '#5ba0c8',
    isBlocking:         true,
  },
  OBSERVATION_TERMINAL: {
    type:                'OBSERVATION_TERMINAL',
    label:              'Observation Terminal',
    sizeCategory:       'normal',
    sizeTiles:          { w: 0.8, h: 1.0 },
    collisionRadiusTiles: 0.35,
    safetyBufferTiles:  0.17,
    asset:              require('@/assets/map-props/academy-observation-terminal.png') as number,
    devPlaceholderColor: '#4f8fc0',
    isBlocking:         true,
  },
  ACADEMY_PLANTER: {
    type:                'ACADEMY_PLANTER',
    label:              'Academy Planter',
    sizeCategory:       'small',
    sizeTiles:          { w: 0.6, h: 0.7 },
    collisionRadiusTiles: 0.28,
    safetyBufferTiles:  0.15,
    asset:              null,
    devPlaceholderColor: '#52a86a',
    isBlocking:         true,
  },
  BENCH: {
    type:                'BENCH',
    label:              'Bench',
    sizeCategory:       'small',
    sizeTiles:          { w: 0.9, h: 0.5 },
    collisionRadiusTiles: 0.35,
    safetyBufferTiles:  0.15,
    asset:              null,
    devPlaceholderColor: '#9a8070',
    isBlocking:         true,
  },
  TRAINING_MACHINE: {
    type:                'TRAINING_MACHINE',
    label:              'Training Machine',
    sizeCategory:       'large',
    sizeTiles:          { w: 1.3, h: 1.2 },
    collisionRadiusTiles: 0.60,
    safetyBufferTiles:  0.28,
    asset:              null,
    devPlaceholderColor: '#3a6fa0',
    isBlocking:         true,
  },
  MEDICAL_DISPLAY: {
    type:                'MEDICAL_DISPLAY',
    label:              'Medical Display',
    sizeCategory:       'normal',
    sizeTiles:          { w: 0.7, h: 1.1 },
    collisionRadiusTiles: 0.30,
    safetyBufferTiles:  0.17,
    asset:              null,
    devPlaceholderColor: '#5a9fca',
    isBlocking:         true,
  },
  DECORATIVE_COLUMN: {
    type:                'DECORATIVE_COLUMN',
    label:              'Decorative Column',
    sizeCategory:       'small',
    sizeTiles:          { w: 0.5, h: 0.6 },
    collisionRadiusTiles: 0.22,
    safetyBufferTiles:  0.15,
    asset:              require('@/assets/map-props/academy-decorative-column.png') as number,
    devPlaceholderColor: '#b0a090',
    isBlocking:         true,
  },
} as const;

// ── SceneryZoneType → preferred prop types ────────────────────────────────────
// Maps from the geometry-level SceneryZoneType (from chapterMapTemplate.types)
// to the set of prop types that fit that zone's environmental role.
// First entry is the primary/hero prop; subsequent entries are secondary cluster props.

import type { SceneryZoneType } from './chapterMapTemplate.types';

export const ZONE_TYPE_TO_PROPS: Readonly<Partial<Record<SceneryZoneType, readonly SceneryPropType[]>>> = {
  SIMULATION_STRUCTURE: ['SIMULATION_BED', 'MEDICAL_CONSOLE', 'TRAINING_MACHINE'],
  BUILDING_WING:        ['WORKSTATION', 'MEDICAL_DISPLAY', 'OBSERVATION_TERMINAL'],
  OBSERVATION_DECK:     ['OBSERVATION_TERMINAL', 'MEDICAL_DISPLAY'],
  GARDEN:               ['ACADEMY_PLANTER', 'BENCH'],
  PLANTER:              ['ACADEMY_PLANTER'],
  COLUMN_GROUP:         ['DECORATIVE_COLUMN', 'BENCH'],
  WATER_FEATURE:        ['ACADEMY_PLANTER', 'DECORATIVE_COLUMN'],
  ACADEMIC_STATUE:      ['DECORATIVE_COLUMN', 'ACADEMY_PLANTER'],
  ARCHITECTURE:         ['WORKSTATION', 'SUPPLY_CART', 'MEDICAL_CONSOLE'],
  DECORATIVE_LANDMARK:  ['DECORATIVE_COLUMN'],
} as const;

// ── Placed prop (runtime) ─────────────────────────────────────────────────────

/**
 * A fully resolved SceneryProp instance with world-pixel coordinates.
 * Produced by sceneryPropPlacer.ts and consumed by SceneryPropLayerView.tsx.
 */
export interface PlacedSceneryProp {
  id:          string;
  type:        SceneryPropType;
  def:         SceneryPropDef;
  /** Top-left pixel position in world space. */
  worldLeft:   number;
  worldTop:    number;
  /** Axial world depth (`r + q / 2`) used for 2.5D occlusion sorting. */
  axialDepth:  number;
  /** Pixel width of the rendered image at 1× scale. */
  pixelWidth:  number;
  /** Pixel height of the rendered image at 1× scale. */
  pixelHeight: number;
  /** Source SceneryZone id this prop belongs to. */
  zoneId:      string;
}
