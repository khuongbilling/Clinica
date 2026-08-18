/**
 * journeyMap/walkableBedGenerator.ts — Push 6: Walkable Bed Generator
 *
 * Converts the canonical HexLaneLayout blueprint into a WalkableBed — the
 * authoritative geometry specification fed to the AI background image generator.
 *
 * Architecture rule (canonical):
 *   Blueprint → Walkable Bed → Scenery Dressing → Final Raster Background
 *
 * The walkable bed describes exactly where the floor is.  The AI must render
 * the background to match the bed — not the other way around.
 *
 * ── Pipeline ──────────────────────────────────────────────────────────────────
 *   HexLaneLayout (clearingZones + laneSegments + startCell + gateCell)
 *     ↓
 *   One WalkableBedZone per ClearingZone + one per LaneSegment
 *     ↓
 *   Adjacency graph across zones
 *     ↓
 *   bedPromptFragment  (geometry-authoritative AI text)
 *   sceneryConstraintFragment  (negative-space constraint text)
 *
 * ── Imports ───────────────────────────────────────────────────────────────────
 *   Only imports from chapterHexLayout and chapterMapTemplate.types.
 *   No import from canonicalMapArtifact — that module imports this one
 *   (indirectly via backgroundAuthoringManifest) and adding the reverse edge
 *   would create a circular dependency.
 */

import { getChapterHexLayout } from './chapterHexLayout';
import {
  BLOCKING_SCENERY_TYPES,
  NON_BLOCKING_SCENERY_TYPES,
  sceneryTypeLabel,
} from './sceneryClassification';
import type { AxialCoord }     from './topology';
import type {
  HexLaneLayout,
  WalkableBed,
  WalkableBedZone,
  WalkableBedZoneRole,
} from './chapterMapTemplate.types';

// ── Hex geometry helpers ───────────────────────────────────────────────────────

const HEX_DIRS: AxialCoord[] = [
  { q: 1, r: 0 }, { q: -1, r: 0 },
  { q: 0, r: 1 }, { q: 0, r: -1 },
  { q: 1, r: -1 }, { q: -1, r: 1 },
];

function cellKey(c: AxialCoord): string {
  return `${c.q},${c.r}`;
}

function computeCentroid(cells: AxialCoord[]): { q: number; r: number } {
  if (cells.length === 0) return { q: 0, r: 0 };
  const sumQ = cells.reduce((acc, c) => acc + c.q, 0);
  const sumR = cells.reduce((acc, c) => acc + c.r, 0);
  return {
    q: Math.round(sumQ / cells.length),
    r: Math.round(sumR / cells.length),
  };
}

function computeBBox(cells: AxialCoord[]): { wHex: number; hHex: number } {
  if (cells.length === 0) return { wHex: 1, hHex: 1 };
  let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  for (const c of cells) {
    if (c.q < minQ) minQ = c.q;
    if (c.q > maxQ) maxQ = c.q;
    if (c.r < minR) minR = c.r;
    if (c.r > maxR) maxR = c.r;
  }
  return {
    wHex: Math.max(1, maxQ - minQ + 1),
    hHex: Math.max(1, maxR - minR + 1),
  };
}

/**
 * Classifies a centroid's world position relative to the full layout bounds.
 * Returns strings like 'west', 'center', 'east', 'north', 'south-east', etc.
 */
function describeWorldPosition(
  centroidQ: number,
  centroidR: number,
  allCells: AxialCoord[],
): string {
  if (allCells.length === 0) return 'central';
  let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  for (const c of allCells) {
    if (c.q < minQ) minQ = c.q;
    if (c.q > maxQ) maxQ = c.q;
    if (c.r < minR) minR = c.r;
    if (c.r > maxR) maxR = c.r;
  }
  const qSpan = maxQ - minQ || 1;
  const rSpan = maxR - minR || 1;

  // Three equal horizontal thirds
  const qWest   = minQ + qSpan * 0.33;
  const qEast   = minQ + qSpan * 0.67;
  // Three equal vertical thirds
  const rNorth  = minR + rSpan * 0.33;
  const rSouth  = minR + rSpan * 0.67;

  const h =
    centroidQ < qWest ? 'west' :
    centroidQ > qEast ? 'east' : 'center';
  const v =
    centroidR < rNorth ? 'north' :
    centroidR > rSouth ? 'south' : 'middle';

  if (h === 'center' && v === 'middle') return 'central';
  if (h === 'center') return v;          // 'north' / 'south'
  if (v === 'middle') return h;          // 'west' / 'east'
  return `${v}-${h}`;                    // 'north-west', 'south-east', etc.
}

/**
 * Computes the dominant direction of a lane from its cell distribution.
 * Primary measure: bounding-box Q-span vs R-span ratio.
 */
function computeLaneDirection(
  cells: AxialCoord[],
): 'horizontal' | 'vertical' | 'diagonal' {
  if (cells.length < 2) return 'horizontal';
  const bbox = computeBBox(cells);
  const qSpan = bbox.wHex - 1;
  const rSpan = bbox.hHex - 1;
  if (qSpan > rSpan * 1.5) return 'horizontal';
  if (rSpan > qSpan * 1.5) return 'vertical';
  return 'diagonal';
}

// ── Adjacency graph ────────────────────────────────────────────────────────────

/**
 * Computes which pairs of zones share at least one hex-neighbour edge.
 * O(|zones|² × max_cells_per_zone) — fast for typical zone counts (5–20).
 */
function computeAdjacency(zones: WalkableBedZone[]): Map<string, string[]> {
  // Build per-zone neighbour-expanded key set: zone cells + their 6 neighbours
  const expandedSets = new Map<string, Set<string>>();
  for (const zone of zones) {
    const exp = new Set<string>();
    for (const c of zone.cells) {
      exp.add(cellKey(c));
      for (const d of HEX_DIRS) exp.add(cellKey({ q: c.q + d.q, r: c.r + d.r }));
    }
    expandedSets.set(zone.id, exp);
  }

  const adjacency = new Map<string, string[]>();
  for (const zone of zones) adjacency.set(zone.id, []);

  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i];
      const b = zones[j];
      const aExp = expandedSets.get(a.id)!;
      let adjacent = false;
      for (const c of b.cells) {
        if (aExp.has(cellKey(c))) { adjacent = true; break; }
      }
      if (adjacent) {
        adjacency.get(a.id)!.push(b.id);
        adjacency.get(b.id)!.push(a.id);
      }
    }
  }
  return adjacency;
}

// ── Zone nearest to a cell ──────────────────────────────────────────────────────

/**
 * Returns the zone that contains `target`, or (if none) the zone whose centroid
 * is nearest (hex-distance) to `target`.
 */
function findNearestZone(
  target: AxialCoord,
  zones: WalkableBedZone[],
): WalkableBedZone | null {
  if (zones.length === 0) return null;
  const key = cellKey(target);

  // Prefer exact containment
  for (const z of zones) {
    if (z.cells.some(c => cellKey(c) === key)) return z;
  }

  // Fall back to centroid distance
  let best: WalkableBedZone | null = null;
  let bestDist = Infinity;
  for (const z of zones) {
    const dq = z.centroidQ - target.q;
    const dr = z.centroidR - target.r;
    const dist = Math.sqrt(dq * dq + dr * dr);
    if (dist < bestDist) { bestDist = dist; best = z; }
  }
  return best;
}

// ── AI Prompt fragments ────────────────────────────────────────────────────────

// Target raster size for all generated chapter backgrounds (matches
// chapterBackgroundSpec TARGET_WIDTH/HEIGHT — kept literal here to avoid a
// circular import; chapterBackgroundSpec imports this module).
const TARGET_IMAGE_PX = 1024;

// The generated raster covers the walkable bed bounding box plus the 1-ring
// safety mask and the ~4-tile scenery margin on each side (see
// chapterSceneryLayout world-bounds rule) ≈ +10 tiles across each axis.
const WORLD_MARGIN_TILES = 10;

/**
 * Rough per-hex radius in image pixels for a 1024×1024 raster covering the
 * full world bounds.  Injected into the prompt so the generator understands
 * the physical scale of one walkable cell.
 */
function estimateHexRadiusPx(allCells: AxialCoord[]): number {
  const bbox = computeBBox(allCells);
  const span = Math.max(bbox.wHex, bbox.hHex) + WORLD_MARGIN_TILES;
  return Math.max(8, Math.round(TARGET_IMAGE_PX / span / 2));
}

function buildBedPromptFragment(
  zones: WalkableBedZone[],
  startZone:     WalkableBedZone | null,
  gateZone:      WalkableBedZone | null,
  startPosition: string,
  gatePosition:  string,
  allCells:      AxialCoord[],
): string {
  const clearings     = zones.filter(z => z.role === 'clearing');
  const primaryLanes  = zones.filter(z => z.role === 'primaryLane');
  const secondaryLanes = zones.filter(z => z.role === 'secondaryLane');

  const parts: string[] = [];

  // ── Header ────────────────────────────────────────────────────────────────
  parts.push(
    'WALKABLE FLOOR BED — AUTHORITATIVE BLUEPRINT GEOMETRY: ' +
    'every region below is COMPLETELY OPEN NAVIGABLE STONE FLOOR; ' +
    'NO tree, planter, pillar, fountain, wall, statue, garden, step, or building ' +
    'may be placed inside any bed region — not even partially',
  );

  // ── Clearings ──────────────────────────────────────────────────────────────
  if (clearings.length > 0) {
    const entries = clearings.map(cz => {
      const typeLabel  = (cz.clearingType  ?? 'clearing').replace(/_/g, ' ').toLowerCase();
      const shapeLabel = (cz.clearingShape ?? 'open court').replace(/_/g, ' ').toLowerCase();
      const sizeLabel  = cz.clearingSize ?? 'normal';
      const exits      = cz.exitCount ?? 2;
      const roles: string[] = [];
      if (startZone?.id === cz.id) roles.push('CHAPTER START ENTRANCE — open welcoming threshold');
      if (gateZone?.id  === cz.id) roles.push('GATE DESTINATION — landmark sealed archway');
      const roleStr = roles.length > 0 ? ` (${roles.join('; ')})` : '';
      return (
        `${typeLabel} at ${cz.worldPosition}${roleStr}: ` +
        `${shapeLabel}, ${sizeLabel}, ${cz.cells.length} tiles, ${exits} exits; ` +
        `COMPLETELY BARE open floor — centre and perimeter both empty`
      );
    });
    parts.push(
      `OPEN COURTS (${clearings.length} clearings — every interior is BARE stone floor): ` +
      entries.join('; '),
    );
  }

  // ── Primary lanes ──────────────────────────────────────────────────────────
  if (primaryLanes.length > 0) {
    const entries = primaryLanes.map(lane => {
      const roles: string[] = [];
      if (lane.isStartLane) roles.push('START END');
      if (lane.isGateLane)  roles.push('GATE END');
      const roleStr = roles.length > 0 ? ` [${roles.join('+')}]` : '';
      return (
        `${lane.laneDirection ?? 'horizontal'} at ${lane.worldPosition}${roleStr}: ` +
        `${lane.cells.length} tiles, 2–3 hex widths — BARE PAVED STONE`
      );
    });
    parts.push(
      `PRIMARY CORRIDORS (${primaryLanes.length} broad thoroughfares): ` +
      entries.join('; '),
    );
  }

  // ── Secondary lanes ────────────────────────────────────────────────────────
  if (secondaryLanes.length > 0) {
    const entries = secondaryLanes.map(lane => {
      const roles: string[] = [];
      if (lane.isStartLane) roles.push('START END');
      if (lane.isGateLane)  roles.push('GATE END');
      const roleStr = roles.length > 0 ? ` [${roles.join('+')}]` : '';
      return (
        `${lane.laneDirection ?? 'diagonal'} at ${lane.worldPosition}${roleStr}: ` +
        `${lane.cells.length} tiles, 1–2 hex widths — BARE PAVED STONE`
      );
    });
    parts.push(
      `SECONDARY PASSAGES (${secondaryLanes.length} circulation paths): ` +
      entries.join('; '),
    );
  }

  // ── Start / gate callouts ──────────────────────────────────────────────────
  parts.push(
    `ENTRANCE (${startPosition}): open welcoming threshold — flat bare paved approach, ` +
    `clearly readable as the chapter start`,
  );
  parts.push(
    `GATE (${gatePosition}): grand sealed landmark archway visible across the map — ` +
    `positioned as the eastern chapter destination`,
  );

  // ── Scenery hint ───────────────────────────────────────────────────────────
  parts.push(
    'FRAMING SCENERY: all buildings, teaching wings, gardens, trees, pillars, ' +
    'planters, fountains, statues, and observation structures exist ONLY in the ' +
    'negative space BETWEEN bed regions above — they frame the floor, never obstruct it',
  );

  // ── Task 766: bed scale + continuous-surface note ──────────────────────────
  const hexRadiusPx = estimateHexRadiusPx(allCells);
  parts.push(
    `BED SCALE: the walkable bed contains exactly ${allCells.length} hex cells; ` +
    `at the ${TARGET_IMAGE_PX}×${TARGET_IMAGE_PX} target resolution each hex cell has an ` +
    `approximate radius of ${hexRadiusPx} pixels; the floor inside the bed must remain ` +
    `a single CONTINUOUS TRAVERSABLE SURFACE at all scale levels — no gaps, drops, ` +
    `steps, or breaks anywhere within the bed`,
  );

  // ── Task 766: FORBIDDEN ZONE — blocking scenery types ──────────────────────
  const blockingLabels = [...BLOCKING_SCENERY_TYPES].map(sceneryTypeLabel).join(', ');
  parts.push(
    `FORBIDDEN ZONE (hard constraint): the following blocking scenery types — ` +
    `${blockingLabels} — are physical obstacles and must not appear inside or ` +
    `touching the walkable bed; every one of them belongs strictly to the ` +
    `negative space outside the bed regions listed above`,
  );

  // ── Task 766: SCENERY ZONE — negative-space-only environment types ─────────
  const nonBlockingLabels = [...NON_BLOCKING_SCENERY_TYPES].map(sceneryTypeLabel).join(', ');
  parts.push(
    `SCENERY ZONE: all environment set pieces — the blocking types above plus small ` +
    `decorative elements (${nonBlockingLabels}) — belong to negative-space scenery ` +
    `zones ONLY, grouped tightly at zone boundaries between and around the bed regions; ` +
    `no scenery element of any kind is drawn inside the walkable bed`,
  );

  return parts.join('; ');
}

function buildSceneryConstraintFragment(): string {
  return (
    'SCENERY CONSTRAINT (absolute): university buildings, teaching wings, ' +
    'medicinal gardens, hedges, trees, planters, pillars, fountains, statues, ' +
    'observation platforms, balconies, and walls must be placed EXCLUSIVELY in ' +
    'the negative space between the walkable floor bed regions; ' +
    'no scenery element — not even a small planter, step, or decorative post — ' +
    'may enter any path corridor, clearing interior, entrance threshold, or ' +
    'gate approach; the playable floor must read as completely open and navigable'
  );
}

// ── Main builder ────────────────────────────────────────────────────────────────

function buildWalkableBed(layout: HexLaneLayout): WalkableBed {
  const allCells = layout.cells;
  const walkableCellKeys = allCells.map(cellKey);

  // ── Build zones from clearingZones ────────────────────────────────────────
  const clearingZones: WalkableBedZone[] = layout.clearingZones.map((cz, i) => {
    const cen  = computeCentroid(cz.cells);
    const bbox = computeBBox(cz.cells);
    return {
      id:               `clearing_${i}`,
      role:             'clearing' as WalkableBedZoneRole,
      cells:            cz.cells,
      centroidQ:        cen.q,
      centroidR:        cen.r,
      worldPosition:    describeWorldPosition(cen.q, cen.r, allCells),
      approxWidthHexes: bbox.wHex,
      approxHeightHexes: bbox.hHex,
      connectsTo:       [],  // populated after adjacency pass
      clearingType:     cz.type,
      clearingShape:    cz.shape,
      clearingSize:     cz.size,
      exitCount:        cz.exitCount,
    };
  });

  // ── Build zones from laneSegments ─────────────────────────────────────────
  //
  // Deduplicate cells across lane segments (a cell may appear in multiple
  // segments; for zone classification we pick the first segment it appears in).
  const usedCellKeys = new Set<string>(clearingZones.flatMap(z => z.cells.map(cellKey)));

  const laneZones: WalkableBedZone[] = [];
  layout.laneSegments.forEach((seg, i) => {
    const uniqueCells = seg.cells.filter(c => !usedCellKeys.has(cellKey(c)));
    // Even if all cells are shared with clearings, still create the lane zone
    // for adjacency and prompt purposes — but use all cells for centroid/bbox.
    const cells = uniqueCells.length >= 2 ? uniqueCells : seg.cells;
    cells.forEach(c => usedCellKeys.add(cellKey(c)));

    const cen  = computeCentroid(cells);
    const bbox = computeBBox(cells);
    const dir  = computeLaneDirection(cells);

    laneZones.push({
      id:               `lane_${seg.width === 'primary' ? 'p' : 's'}_${i}`,
      role:             seg.width === 'primary' ? 'primaryLane' : 'secondaryLane',
      cells,
      centroidQ:        cen.q,
      centroidR:        cen.r,
      worldPosition:    describeWorldPosition(cen.q, cen.r, allCells),
      approxWidthHexes: bbox.wHex,
      approxHeightHexes: bbox.hHex,
      connectsTo:       [],
      laneWidth:        seg.width,
      laneDirection:    dir,
      isStartLane:      false,
      isGateLane:       false,
    });
  });

  const allZones: WalkableBedZone[] = [...clearingZones, ...laneZones];

  // ── Compute adjacency ─────────────────────────────────────────────────────
  const adjacency = computeAdjacency(allZones);
  for (const zone of allZones) {
    zone.connectsTo = adjacency.get(zone.id) ?? [];
  }

  // ── Identify start / gate zones ───────────────────────────────────────────
  const startZone = findNearestZone(layout.startCell, allZones);
  const gateZone  = findNearestZone(layout.gateCell,  allZones);

  // Tag lane zones near start / gate
  if (startZone && (startZone.role === 'primaryLane' || startZone.role === 'secondaryLane')) {
    startZone.isStartLane = true;
  }
  if (gateZone && (gateZone.role === 'primaryLane' || gateZone.role === 'secondaryLane')) {
    gateZone.isGateLane = true;
  }

  // ── World positions for entrance / gate ────────────────────────────────────
  const startPosition = describeWorldPosition(layout.startCell.q, layout.startCell.r, allCells);
  const gatePosition  = describeWorldPosition(layout.gateCell.q,  layout.gateCell.r,  allCells);

  // ── Build prompt fragments ────────────────────────────────────────────────
  const bedPromptFragment       = buildBedPromptFragment(allZones, startZone, gateZone, startPosition, gatePosition, allCells);
  const sceneryConstraintFragment = buildSceneryConstraintFragment();

  // ── Derived views ─────────────────────────────────────────────────────────
  const primaryLanes   = allZones.filter(z => z.role === 'primaryLane');
  const secondaryLanes = allZones.filter(z => z.role === 'secondaryLane');

  return {
    chapterId:          layout.chapterId,
    zones:              allZones,
    clearings:          clearingZones,
    primaryLanes,
    secondaryLanes,
    startZone,
    gateZone,
    walkableCellKeys,
    bedPromptFragment,
    sceneryConstraintFragment,
  };
}

// ── Cache + public API ─────────────────────────────────────────────────────────

const bedCache = new Map<number, WalkableBed>();

/**
 * Returns the WalkableBed for the given chapter.
 *
 * The bed is the authoritative floor-geometry specification derived from the
 * canonical HexLaneLayout.  It drives the AI background generation prompt so
 * that the generated art matches the blueprint exactly.
 *
 * Results are cached for the process lifetime (same determinism guarantee as
 * getChapterHexLayout).
 */
export function getWalkableBed(chapter: number): WalkableBed {
  const cached = bedCache.get(chapter);
  if (cached) return cached;

  const layout = getChapterHexLayout(chapter);
  const bed    = buildWalkableBed(layout);
  bedCache.set(chapter, bed);
  return bed;
}

/**
 * Returns walkable beds for a range of chapters [from, to] inclusive.
 */
export function getWalkableBedRange(from: number, to: number): WalkableBed[] {
  const result: WalkableBed[] = [];
  for (let c = from; c <= to; c++) result.push(getWalkableBed(c));
  return result;
}
