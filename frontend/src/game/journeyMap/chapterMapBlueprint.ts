/**
 * journeyMap/chapterMapBlueprint.ts — Push 2: Navigation-First Blueprint
 *
 * Generates the LOGICAL NAVIGATION BLUEPRINT for each chapter before any
 * background art decisions are made.  The blueprint is invisible
 * gameplay-authoring data that the art layer must read and conform to.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CANONICAL CHAPTER GENERATION ORDER  (enforced, not aspirational)
 * ═══════════════════════════════════════════════════════════════════
 *  1. Choose Chapter archetype           ← archetypeFor() in this file
 *  2. Generate logical walkable lanes    ← authored coords / topology.ts
 *  3. Generate / open clearings          ← buildClearings() in this file
 *  4. Validate connected terrain         ← chapterMapTemplates.ts validator
 *  5. Reserve obstacle-free space        ← obstacleZones (art pipeline fills)
 *  6. Generate background art from blueprint  ← art layer reads this file
 *  7. Place hex grid on walkableCells    ← journeyRunLifecycle.ts
 *  8. Assign encounters to eligible cells ← canonicalEncounters.ts
 *
 *  ⚠  Background art MUST NEVER be step 1.
 *
 * PERSISTENCE GUARANTEE
 * ─────────────────────
 * For authored chapters (1–10) the blueprint is derived deterministically
 * from checked-in literal coordinate data (AUTHORED_CHAPTER_MAPS).
 * It never changes across rechallenges, seeds, or TimeOfDay shifts.
 *
 * Rechallenging must NOT regenerate:
 *   • pathways / walkableCells   • clearings / obstacleZones
 *   • gate location              • physical chapter footprint / archetype
 *
 * Rechallenging may regenerate:
 *   • enemies · treasure · merchant · Ward Events · Area Boss allocation
 *
 * Day / Evening / Night share the SAME navigation blueprint.
 * Only lighting / environment treatment changes.
 */

import { getChapterMapTemplate, isAuthoredChapter } from './chapterMapTemplates';
import { bfsDistances }                              from './topology';
import type { AxialCoord }                           from './topology';
import type {
  ChapterMapTemplateTile,
  MapArchetype,
  ClearingPurpose,
  MapClearing,
  WorldZone,
  WorldMargins,
  ChapterMapBlueprint,
} from './chapterMapTemplate.types';

// ── Hex geometry helpers ──────────────────────────────────────────────────────

const AXIAL_DIRS: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
];

function buildAdj(tiles: ChapterMapTemplateTile[]): Map<string, string[]> {
  const idSet = new Set(tiles.map(t => t.id));
  const adj   = new Map<string, string[]>();
  for (const t of tiles) {
    adj.set(t.id, AXIAL_DIRS
      .map(([dq, dr]) => `${t.q + dq},${t.r + dr}`)
      .filter(k => idSet.has(k)));
  }
  return adj;
}

function coordOf(id: string): AxialCoord {
  const [q, r] = id.split(',').map(Number);
  return { q: q!, r: r! };
}

/** Geometric centroid: tile in `cells` closest to the mean (q, r). */
function centroidOf(cells: AxialCoord[]): AxialCoord {
  if (cells.length === 0) return { q: 0, r: 0 };
  const meanQ = cells.reduce((s, c) => s + c.q, 0) / cells.length;
  const meanR = cells.reduce((s, c) => s + c.r, 0) / cells.length;
  return cells.reduce((best, c) => {
    const dBest = Math.abs(best.q - meanQ) + Math.abs(best.r - meanR);
    const dCur  = Math.abs(c.q  - meanQ) + Math.abs(c.r  - meanR);
    return dCur < dBest ? c : best;
  }, cells[0]!);
}

// ── Archetype assignment (Book I chapters 1–10, then cycles) ─────────────────

const CHAPTER_ARCHETYPES: Readonly<Record<number, MapArchetype>> = {
  1:  'simulation_plaza',    // Atrium Approach
  2:  'academic_quad',       // Teaching Ward
  3:  'simulation_complex',  // Procedure Hall
  4:  'simulation_plaza',    // Emergency Simulation
  5:  'academic_quad',       // Sanctuary Courtyard
  6:  'simulation_complex',  // Outer Ward Transition
  7:  'simulation_plaza',    // Outbreak Ward
  8:  'academic_quad',       // Broken Handoff Floor
  9:  'simulation_complex',  // Judgment Corridor
  10: 'simulation_plaza',    // First Oath Capstone
};

const ARCHETYPE_CYCLE: MapArchetype[] = [
  'simulation_plaza',
  'academic_quad',
  'simulation_complex',
];

function archetypeFor(chapter: number): MapArchetype {
  return CHAPTER_ARCHETYPES[chapter]
    ?? ARCHETYPE_CYCLE[(chapter - 1) % ARCHETYPE_CYCLE.length]!;
}

// ── Clearing builder ──────────────────────────────────────────────────────────

/**
 * Derives three clearings from the fixed authored geometry:
 *
 *  "start"  (general)   — tiles within ≤ 2 hops of the start tile.
 *  "mid"    (encounter) — tiles at roughly half the start→gate distance,
 *                         not overlapping start or gate zones.
 *  "gate"   (boss)      — tiles within ≤ 2 hops of the gate tile.
 *
 * Clearings never contain tiles outside the walkable set.
 * All three are derived purely from graph distances so they are fully
 * deterministic for authored chapters (no random input).
 */
function buildClearings(
  tiles:   ChapterMapTemplateTile[],
  startId: string,
  gateId:  string,
  adj:     Map<string, string[]>,
): MapClearing[] {
  const fromStart = bfsDistances(adj, startId);
  const fromGate  = bfsDistances(adj, gateId);

  const gateDistFromStart = fromStart.get(gateId) ?? 0;
  const midTargetDist     = Math.round(gateDistFromStart / 2);

  // --- start zone -----------------------------------------------------------
  const startCells = tiles
    .filter(t => (fromStart.get(t.id) ?? Infinity) <= 2)
    .map(t => ({ q: t.q, r: t.r } as AxialCoord));

  // --- gate zone ------------------------------------------------------------
  const gateCells = tiles
    .filter(t => (fromGate.get(t.id) ?? Infinity) <= 2)
    .map(t => ({ q: t.q, r: t.r } as AxialCoord));

  // --- mid zone: half-way band between start and gate, non-overlapping ------
  const startZoneIds = new Set(
    tiles.filter(t => (fromStart.get(t.id) ?? Infinity) <= 2).map(t => t.id),
  );
  const gateZoneIds = new Set(
    tiles.filter(t => (fromGate.get(t.id) ?? Infinity) <= 2).map(t => t.id),
  );
  const midCells = tiles
    .filter(t => {
      const d = fromStart.get(t.id) ?? Infinity;
      return (
        Math.abs(d - midTargetDist) <= 1 &&
        !startZoneIds.has(t.id) &&
        !gateZoneIds.has(t.id)
      );
    })
    .map(t => ({ q: t.q, r: t.r } as AxialCoord));

  const clearings: MapClearing[] = [
    {
      id:                 'start',
      purpose:            'general' as ClearingPurpose,
      cells:              startCells,
      center:             coordOf(startId),
      minimumOpenRadius:  1,
    },
    {
      id:                 'gate',
      purpose:            'boss' as ClearingPurpose,
      cells:              gateCells,
      center:             coordOf(gateId),
      minimumOpenRadius:  1,
    },
  ];

  // Only add the mid clearing if it has cells (always true for authored maps
  // with ≥ 7 tiles gate-distance, but guard anyway for procedural edge cases).
  if (midCells.length > 0) {
    clearings.splice(1, 0, {
      id:                 'mid',
      purpose:            'encounter' as ClearingPurpose,
      cells:              midCells,
      center:             centroidOf(midCells),
      minimumOpenRadius:  1,
    });
  }

  return clearings;
}

// ── World margin builder ──────────────────────────────────────────────────────

/** Two tile-widths of margin around the walkable footprint on every side. */
const MARGIN_TILES = 2;

function buildMargins(tiles: ChapterMapTemplateTile[]): WorldMargins {
  const qs = tiles.map(t => t.q);
  const rs = tiles.map(t => t.r);
  return {
    minQ:        Math.min(...qs) - MARGIN_TILES,
    maxQ:        Math.max(...qs) + MARGIN_TILES,
    minR:        Math.min(...rs) - MARGIN_TILES,
    maxR:        Math.max(...rs) + MARGIN_TILES,
    marginTiles: MARGIN_TILES,
  };
}

// ── Blueprint seed ────────────────────────────────────────────────────────────

/**
 * Returns the deterministic seed string that was used to derive this
 * chapter's navigation blueprint.
 *
 * Authored chapters use a stable per-chapter constant that is
 * intentionally different from any per-run seed, so the blueprint can
 * never be accidentally overwritten by encounter randomisation.
 *
 * Procedural chapters share the same deterministic seed used by
 * chapterMapTemplates.ts (so the topology and blueprint always agree).
 */
function blueprintSeedFor(chapter: number): string {
  return isAuthoredChapter(chapter)
    ? `blueprint-authored-ch${chapter}`
    : `clinica-authored-ch${chapter}`;
}

// ── Core builder ─────────────────────────────────────────────────────────────

function buildBlueprint(chapter: number): ChapterMapBlueprint {
  const template = getChapterMapTemplate(chapter);
  const { tiles, startTileId, gateTileId } = template;

  const adj = buildAdj(tiles);

  // Obstacle and scenic zones are empty for now — the art pipeline will
  // populate them once per-environment dressing data ships.  They are
  // typed and reserved so callers never need to null-check them.
  const obstacleZones: WorldZone[] = [];
  const scenicZones:   WorldZone[] = [];

  return {
    chapterId:       chapter,
    archetype:       archetypeFor(chapter),
    tileCount:       tiles.length,
    walkableCells:   tiles.map(t => ({ q: t.q, r: t.r })),
    clearings:       buildClearings(tiles, startTileId, gateTileId, adj),
    obstacleZones,
    scenicZones,
    startCell:       coordOf(startTileId),
    gateCell:        coordOf(gateTileId),
    worldMarginTiles: buildMargins(tiles),
    seed:            blueprintSeedFor(chapter),
  };
}

// ── Cache + public API ────────────────────────────────────────────────────────

const blueprintCache = new Map<number, ChapterMapBlueprint>();

/**
 * Returns the navigation blueprint for the given chapter number.
 *
 * The result is computed once (from the validated ChapterMapTemplate) and
 * cached for the lifetime of the process.  The blueprint is immutable:
 * callers must not mutate any nested arrays or objects.
 *
 * Calling this with the same chapter number always returns the same object.
 */
export function getChapterMapBlueprint(chapter: number): ChapterMapBlueprint {
  const cached = blueprintCache.get(chapter);
  if (cached) return cached;

  const blueprint = buildBlueprint(chapter);
  blueprintCache.set(chapter, blueprint);
  return blueprint;
}
