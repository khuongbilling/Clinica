/**
 * sceneryPropPlacer — deterministic placement of scenery props in scenery-safe space
 *
 * Converts a ChapterSceneryLayout into a list of PlacedSceneryProp instances
 * whose collision footprints never intersect the walkable safety mask.
 *
 * CONTRACT (per production spec)
 * ─────────────────────────────
 * 1. Every prop footprint ∩ walkableSafetyMask = empty.
 * 2. Large props maintain 0.25–0.35 × tile buffer from walkable bed.
 *    Normal props maintain 0.15–0.20 × tile buffer.
 * 3. Clearing interiors remain mostly empty — props placed on perimeter only.
 * 4. Prop positions are seeded from `chapter blueprint seed + scenery layout version`
 *    and are IDENTICAL across day/evening/night shifts.
 * 5. If a placement fails all candidate positions, the prop is silently dropped.
 */

import {
  SCENERY_PROP_DEFS,
  ZONE_TYPE_TO_PROPS,
  type PlacedSceneryProp,
  type SceneryPropType,
} from './sceneryPropTypes';
import { isBlockingSceneryZone } from './sceneryClassification';
import type { SceneryLayout, SceneryZone } from './chapterMapTemplate.types';
import type { HexWorldCoords } from '../../components/journey/hexWorldCoords';

// ── Versioning ────────────────────────────────────────────────────────────────
// Bump whenever placement algorithm changes that would move existing props.
export const SCENERY_PROP_LAYOUT_VERSION = 'v1';

// ── Placement constants ───────────────────────────────────────────────────────

/** Maximum props placed per scenery zone (hero + secondaries). */
const MAX_PROPS_PER_ZONE = 3;

/**
 * Clearing zones: only allow props in the outer ring (beyond this fraction
 * of the zone's bounding radius from its centroid).  Keeps clearing interiors open.
 */
const CLEARING_PERIMETER_RATIO = 0.55;

// ── Seeded PRNG (fast, deterministic) ─────────────────────────────────────────

function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

// ── Safety check ─────────────────────────────────────────────────────────────

/**
 * Returns true if the proposed world-space prop center (cx, cy) is safe
 * to place given the walkable safety mask.  Checks a grid of sample points
 * within the collision radius + safety buffer.
 */
function isSafeToPlace(
  cxWorld: number,
  cyWorld: number,
  propType: SceneryPropType,
  sz: number,
  walkableSafetyMaskKeys: ReadonlySet<string>,
  coords: HexWorldCoords,
): boolean {
  const def = SCENERY_PROP_DEFS[propType];
  const totalRadius = (def.collisionRadiusTiles + def.safetyBufferTiles) * sz;

  // Sample a grid within the bounding box to check safety.
  // Step size = half a tile; coarse but conservative.
  const step = sz * 0.5;
  const n = Math.ceil(totalRadius / step);

  for (let dxi = -n; dxi <= n; dxi++) {
    for (let dyi = -n; dyi <= n; dyi++) {
      const wx = cxWorld + dxi * step;
      const wy = cyWorld + dyi * step;

      // Convert world pixel to approximate axial coords.
      // Invert: left = q*Q_STEP*sz + ox, top = (r*R_STEP + q*Q_VOFF)*sz + oy
      const { worldOriginX, worldOriginY } = coords;
      const Q_STEP = 0.72;
      const R_STEP = 0.79;
      const Q_VOFF = 0.395;

      const q = Math.round((wx - worldOriginX) / (Q_STEP * sz));
      const rRaw = ((wy - worldOriginY) / sz - q * Q_VOFF) / R_STEP;
      const r = Math.round(rRaw);

      if (walkableSafetyMaskKeys.has(`${q},${r}`)) {
        return false;
      }
    }
  }
  return true;
}

// ── World position from axial centroid ───────────────────────────────────────

function zoneCenterWorld(
  zone: SceneryZone,
  coords: HexWorldCoords,
): { cx: number; cy: number } {
  const { cx, cy } = coords.axialToWorld(zone.centroid.q, zone.centroid.r);
  return { cx, cy };
}

// ── Candidate positions for perimeter placement ───────────────────────────────

function perimeterCandidates(
  zone: SceneryZone,
  coords: HexWorldCoords,
  sz: number,
  rand: () => number,
  count: number,
): Array<{ cx: number; cy: number }> {
  // Sample cells from the zone excluding those within CLEARING_PERIMETER_RATIO
  // of the centroid.
  const { cx: cCx, cy: cCy } = zoneCenterWorld(zone, coords);
  const maxRadius = zone.cells.length > 0
    ? sz * Math.sqrt(zone.cells.length) * 0.5
    : sz;
  const minDist = maxRadius * CLEARING_PERIMETER_RATIO;

  const candidates: Array<{ cx: number; cy: number }> = [];

  for (const cell of zone.cells) {
    const { cx, cy } = coords.axialToWorld(cell.q, cell.r);
    const dist = Math.sqrt((cx - cCx) ** 2 + (cy - cCy) ** 2);
    if (dist >= minDist) {
      candidates.push({ cx, cy });
    }
  }

  // If no perimeter candidates (small zone), fall back to all cells.
  if (candidates.length === 0) {
    for (const cell of zone.cells) {
      const { cx, cy } = coords.axialToWorld(cell.q, cell.r);
      candidates.push({ cx, cy });
    }
  }

  // Shuffle and return first `count`.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, count);
}

// ── Main placement function ───────────────────────────────────────────────────

export interface SceneryPropPlacementPlan {
  readonly props: PlacedSceneryProp[];
  /** Blocking zones whose primary prop cannot safely render in production. */
  readonly unplacedRequiredZoneIds: readonly string[];
}

/**
 * Uses the same collision rules as the renderer while exposing missing required
 * blockers to the Stage 3 authoring gate. No required prop may be force-placed:
 * a failed collision check is an invalid future-map presentation, never a
 * reason to draw over a playable hex.
 */
export function planSceneryProps(
  scenery: SceneryLayout,
  coords: HexWorldCoords,
  chapterId: number,
): SceneryPropPlacementPlan {
  const sz = coords.sz;
  const walkableSafetyMaskKeys = new Set(scenery.walkableSafetyMaskKeys);

  const seed = hashString(
    `ch${chapterId}|scenery-props|${SCENERY_PROP_LAYOUT_VERSION}`,
  );
  const rand = seededRand(seed);

  const result: PlacedSceneryProp[] = [];
  const unplacedRequiredZoneIds: string[] = [];
  let propIndex = 0;

  for (const zone of scenery.sceneryZones) {
    const propTypes = ZONE_TYPE_TO_PROPS[zone.type];
    if (!propTypes || propTypes.length === 0) continue;
    const requiresPrimaryBlocker = isBlockingSceneryZone(zone.type);

    const isClearing = zone.walkableContactCount > 3;
    const maxPerZone = Math.min(MAX_PROPS_PER_ZONE, propTypes.length);

    // For each prop slot in this zone:
    const usedPositions: Array<{ cx: number; cy: number }> = [];

    for (let slot = 0; slot < maxPerZone; slot++) {
      const propType = propTypes[slot % propTypes.length];
      const def = SCENERY_PROP_DEFS[propType];
      const isRequiredPrimaryBlocker = requiresPrimaryBlocker && slot === 0;

      // Production skips null assets, so a required blocker with no real art
      // is reported to the authoring gate instead of pretending it was placed.
      if (isRequiredPrimaryBlocker && def.asset === null) {
        unplacedRequiredZoneIds.push(zone.id);
        continue;
      }

      // Candidate positions: perimeter for clearing zones, any cell otherwise.
      const candidates: Array<{ cx: number; cy: number }> = isClearing
        ? perimeterCandidates(zone, coords, sz, rand, 8)
        : (() => {
            const all: Array<{ cx: number; cy: number }> = [];
            for (const cell of zone.cells) {
              const { cx, cy } = coords.axialToWorld(cell.q, cell.r);
              all.push({ cx, cy });
            }
            // Shuffle.
            for (let i = all.length - 1; i > 0; i--) {
              const j = Math.floor(rand() * (i + 1));
              [all[i], all[j]] = [all[j], all[i]];
            }
            return all.slice(0, 6);
          })();

      // Find a safe position.
      let placed = false;
      for (const { cx, cy } of candidates) {
        // Avoid placing too close to already-placed props in this zone.
        const tooClose = usedPositions.some(p => {
          const dist = Math.sqrt((p.cx - cx) ** 2 + (p.cy - cy) ** 2);
          return dist < sz * 0.7;
        });
        if (tooClose) continue;

        if (
          isSafeToPlace(cx, cy, propType, sz, walkableSafetyMaskKeys, coords)
        ) {
          const pw = Math.round(def.sizeTiles.w * sz);
          const ph = Math.round(def.sizeTiles.h * sz);
          result.push({
            id:         `prop_${zone.id}_${slot}_${propIndex}`,
            type:       propType,
            def,
            worldLeft:  Math.round(cx - pw / 2),
            worldTop:   Math.round(cy - ph),       // ground at bottom-center
            groundY:    Math.round(cy),             // depth-sort anchor
            pixelWidth:  pw,
            pixelHeight: ph,
            zoneId:     zone.id,
          });
          usedPositions.push({ cx, cy });
          propIndex++;
          placed = true;
          break;
        }
      }

      if (!placed && isRequiredPrimaryBlocker) {
        unplacedRequiredZoneIds.push(zone.id);
      }
    }
  }

  return {
    props: result,
    unplacedRequiredZoneIds: [...new Set(unplacedRequiredZoneIds)],
  };
}

export function computeSceneryProps(
  scenery: SceneryLayout,
  coords: HexWorldCoords,
  chapterId: number,
): PlacedSceneryProp[] {
  return planSceneryProps(scenery, coords, chapterId).props;
}
