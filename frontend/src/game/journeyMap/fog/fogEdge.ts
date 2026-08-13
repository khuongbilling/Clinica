/**
 * fog/fogEdge.ts — Layer 3.5 Organic Reveal-Edge Fog (Push 6)
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png  (REFERENCE ONLY)
 *
 * ── What this module does ─────────────────────────────────────────────────────
 *
 * Places sparse fog_edge sprites ONLY at the boundary between VISIBLE_NOW
 * and UNEXPLORED / EXPLORED terrain.  Its sole purpose is to disguise the
 * mathematical shape of the player's vision radius — no circles, no hex
 * outlines, no rectangles should be inferred from the result.
 *
 * ── Placement strategy ────────────────────────────────────────────────────────
 *
 *   1. Find every VISIBLE_NOW tile that has at least one fog-facing neighbour
 *      (a neighbour tile that is NOT visibleNow).  Those are "boundary tiles".
 *
 *   2. For each boundary tile, select up to 2 fog-facing directions
 *      (deterministically from the run seed + tile ID).
 *
 *   3. For each selected direction, draw 1 edge sprite centred just past
 *      the boundary (0.85–1.30 × hex-spacing into the fog side) with
 *      seeded jitter, rotation, and opacity.
 *
 * ── Why no visibility mask ────────────────────────────────────────────────────
 *
 *   The visibility mask erases with a radius of sz × 2.45 around every
 *   VISIBLE_NOW tile.  Edge sprites are placed only 0.7–1.1 × sz from the
 *   visible centre — squarely inside that erase radius — so applying the full
 *   mask would erase the sprites before the player ever sees them.
 *
 *   Instead, edge sprites are self-managing: placement code ensures they only
 *   appear near the boundary.  A small amount peeking into the clear zone is
 *   intentional — at 0.25–0.50 opacity it reads as wispy tendrils, not solid fog.
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web only — HTML5 Canvas 2D.
 */

import { Asset } from 'expo-asset';
import { JOURNEY_ASSETS } from '../assets';
// Push 3: applyEdgeTaper removed — MapViewport clips edges; import dropped.
import type { HexMapTile } from '../fixture';
import type { HexWorldCoords } from '../../../components/journey/hexWorldCoords';

// ── Asset source ───────────────────────────────────────────────────────────────
const FOG_EDGE_DAY_SOURCE = JOURNEY_ASSETS.fog.edgeDay;

// ── Layout constants ───────────────────────────────────────────────────────────

/** Matches Base and Mid fog padding so all three layers bleed identically. */
/**
 * @deprecated Push 3: canvas is now exactly worldWidth × worldHeight at origin 0,0.
 * Kept as 0 so existing import references compile without changes.
 */
export const FOG_EDGE_PADDING = 0;

/** Minimum rendered width of one edge instance (× sz). */
const EDGE_W_MIN_TILES = 2.5;

/** Maximum rendered width of one edge instance (× sz). */
const EDGE_W_MAX_TILES = 4.5;

/** Aspect ratio of the fog_edge image (assumed 1536 × 1024 — same gen settings). */
const EDGE_ASPECT = 1536 / 1024;

/**
 * Maximum fog-facing directions to use per boundary tile.
 * Keeping this at 2 limits sprite count and prevents isolated tiles from
 * becoming over-decorated when they have 5–6 fog-facing neighbours.
 */
const MAX_DIRS_PER_TILE = 2;

// ── Axial hex neighbour directions (flat-top) ─────────────────────────────────
const HEX_DIRS: ReadonlyArray<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
];

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FogEdgeParams {
  worldWidth:             number;
  worldHeight:            number;
  /** All tiles in the active run (needed for q/r and neighbour lookup). */
  tiles:                  readonly HexMapTile[];
  coords:                 HexWorldCoords;
  /** Tile IDs currently within the player's field of vision. */
  visibleNowIds:          ReadonlySet<string>;
  /** JourneyRun seed — drives deterministic sprite placement. */
  runSeed:                string;
}

// ── Seeded random ─────────────────────────────────────────────────────────────

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223;
    s = s >>> 0;
    return s / 0x100000000;
  };
}

// ── Image cache ────────────────────────────────────────────────────────────────

const imageCache = new Map<string, Promise<HTMLImageElement>>();

async function loadBundledImage(source: number): Promise<HTMLImageElement> {
  const asset = Asset.fromModule(source);
  if (!asset.uri) await asset.downloadAsync();
  const uri = asset.uri ?? '';

  const cached = imageCache.get(uri);
  if (cached) return cached;

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    if (!uri) { reject(new Error(`fogEdge: asset URI unavailable`)); return; }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`fogEdge: failed to load ${uri}`));
    img.src     = uri;
  });
  imageCache.set(uri, p);
  return p;
}

// ── Main draw function ─────────────────────────────────────────────────────────

/**
 * Draws organic edge-fog sprites around the VISIBLE_NOW / fog boundary.
 *
 * Web only.  Callers must guard with `Platform.OS === 'web'` before calling.
 */
export async function drawFogEdge(
  canvas: HTMLCanvasElement,
  params: FogEdgeParams,
): Promise<void> {
  const { worldWidth, worldHeight, tiles, coords, visibleNowIds, runSeed } = params;
  const { sz } = coords;

  const edgeImg = await loadBundledImage(FOG_EDGE_DAY_SOURCE);

  // ── Size canvas: exact world dimensions, DPR-backed ─────────────────────────
  // Push 3: canvas is exactly worldWidth × worldHeight at origin 0,0.
  const DPR = typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1;
  canvas.width  = Math.ceil(worldWidth  * DPR);
  canvas.height = Math.ceil(worldHeight * DPR);
  canvas.style.width  = `${worldWidth}px`;
  canvas.style.height = `${worldHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(DPR, DPR);

  // ── Build tile lookup tables ───────────────────────────────────────────────
  // tileCenters: id → world-space centre point (no padding offset yet)
  // tileByCoord: "q,r" key for O(1) neighbour existence checks
  const tileCenters  = new Map<string, { cx: number; cy: number }>();
  const tileByCoord  = new Set<string>(); // just for existence

  for (const tile of tiles) {
    const { left, top } = coords.axialToWorld(tile.q, tile.r);
    tileCenters.set(tile.id, { cx: left + sz / 2, cy: top + sz / 2 });
    tileByCoord.add(tile.id); // tile.id === `${q},${r}` per fogCalculator contract
  }

  // ── Find boundary tiles and draw sprites ──────────────────────────────────
  ctx.save();
  // Push 3: no translate — sprites are drawn directly in world coords.

  for (const tile of tiles) {
    if (!visibleNowIds.has(tile.id)) continue; // only boundary of VISIBLE_NOW

    const center = tileCenters.get(tile.id);
    if (!center) continue;

    // Collect fog-facing directions for this tile
    const fogDirs: { dx: number; dy: number }[] = [];
    for (const [dq, dr] of HEX_DIRS) {
      const neighborId = `${tile.q + dq},${tile.r + dr}`;
      if (!visibleNowIds.has(neighborId) && tileByCoord.has(neighborId)) {
        // Neighbour exists in the run but is NOT visible — fog side
        const nc = tileCenters.get(neighborId);
        if (nc) {
          fogDirs.push({ dx: nc.cx - center.cx, dy: nc.cy - center.cy });
        }
      }
    }

    if (fogDirs.length === 0) continue; // interior tile — skip

    // Deterministic per-tile seed: same run + same tile → same placement
    const rand = seededRandom(hashString(runSeed + ':fogedge:' + tile.id));

    // Shuffle fogDirs in-place (Fisher-Yates with this tile's rand)
    for (let i = fogDirs.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [fogDirs[i], fogDirs[j]] = [fogDirs[j], fogDirs[i]];
    }

    // Use at most MAX_DIRS_PER_TILE fog-facing directions
    const selected = fogDirs.slice(0, MAX_DIRS_PER_TILE);

    for (const { dx, dy } of selected) {
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx  = dx / len; // normalised toward fog
      const ny  = dy / len;

      // Place sprite 85–130% of the way to the fog neighbour
      // (just past the boundary, slightly into the fog).
      const t   = 0.85 + rand() * 0.45;
      const spx = center.cx + dx * t;
      const spy = center.cy + dy * t;

      // Perpendicular jitter — breaks any repeating radial pattern
      const jitter = (rand() - 0.5) * sz * 0.7;
      const jx     = spx + (-ny) * jitter;
      const jy     = spy + nx    * jitter;

      const wTiles = EDGE_W_MIN_TILES + rand() * (EDGE_W_MAX_TILES - EDGE_W_MIN_TILES);
      const w      = sz * wTiles;
      const h      = w  / EDGE_ASPECT;

      // Rotation ±15° — slightly more than Base/Mid for irregular silhouettes
      const angle  = (rand() * 30 - 15) * (Math.PI / 180);

      // Opacity 0.25–0.50 — light; these are edge wisps, not concealment
      const alpha  = 0.25 + rand() * 0.25;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(jx, jy);
      ctx.rotate(angle);
      ctx.drawImage(edgeImg, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  ctx.restore();

  // Push 3: applyEdgeTaper removed — MapViewport clips edges; taper not needed.
  // No visibility mask applied to edge sprites (see module docstring).
}
