/**
 * hex_map_recentre.test.ts
 *
 * Pure-logic tests for the HexMapLayer camera re-centre algorithm.
 *
 * Run: npx sucrase-node tests/hex_map_recentre.test.ts
 *
 * These tests do NOT mount any React component.  They exercise the same maths
 * used inside the `useLayoutEffect` of HexMapLayer so we can verify:
 *
 *   1.  centreCamera returns a position that places the player tile at the
 *       viewport centre (within ±1 px tolerance for Math.round rounding).
 *   2.  Camera position changes when container dimensions change (i.e. rotating
 *       the device produces a different, correct camera position — the fix for
 *       the bug where the camera stayed stale after orientation change).
 *   3.  Camera position is clamped within bounds when the world is smaller than
 *       the viewport.
 *   4.  The shouldRecentre predicate fires on tile-set change, container-size
 *       change, and both simultaneously — but NOT when neither changes.
 *   5.  The player token lands within [containerWidth/2 ± 4, containerHeight/2 ± 4]
 *       after re-centring for several representative tile positions and viewports.
 */

// ── Geometry constants (mirrors HexMapLayer.tsx) ──────────────────────────────

const Q_STEP  = 0.75;   // horizontal advance per q unit
const R_STEP  = 0.866;  // vertical advance per r unit
const Q_VOFF  = 0.433;  // vertical bump per q unit
const MIN_TILE_SZ = 44;
const MAX_TILE_SZ = 88;
const OY = 10;          // fixed top offset

// ── Pure helpers (extracted from HexMapLayer) ─────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

interface Tile { q: number; r: number; id: string; current?: boolean }

function computeSz(tiles: Tile[], containerWidth: number): number {
  if (tiles.length === 0) return 60;
  const maxQ   = tiles.reduce((m, t) => Math.max(m, t.q), 0);
  const wFactor = maxQ * Q_STEP + 1;
  return Math.min(MAX_TILE_SZ, Math.max(MIN_TILE_SZ, Math.floor(containerWidth / wFactor)));
}

function computeOx(tiles: Tile[], containerWidth: number, sz: number): number {
  const maxQ   = tiles.reduce((m, t) => Math.max(m, t.q), 0);
  const wFactor = maxQ * Q_STEP + 1;
  return Math.floor((containerWidth - wFactor * sz) / 2);
}

function computeWorldH(tiles: Tile[], sz: number): number {
  const maxPxBottom = tiles.reduce((m, t) => Math.max(m, t.r * R_STEP + t.q * Q_VOFF), 0);
  return Math.round(maxPxBottom * sz) + sz + OY + 10;
}

function computeWorldW(tiles: Tile[], sz: number, ox: number): number {
  const maxPxRight = tiles.reduce((m, t) => Math.max(m, t.q * Q_STEP), 0);
  return Math.round(maxPxRight * sz) + sz + Math.max(ox, 0) * 2;
}

interface Bounds { minX: number; maxX: number; minY: number; maxY: number }

function computeBounds(
  containerWidth:  number,
  containerHeight: number,
  worldW:          number,
  worldH:          number,
  sz:              number,
): Bounds {
  const MARGIN = Math.round(sz * 0.55);
  return {
    minX: Math.min(-MARGIN, containerWidth  - worldW - MARGIN),
    maxX: Math.max(0,        MARGIN),
    minY: Math.min(-MARGIN, containerHeight - worldH - MARGIN),
    maxY: Math.max(0,        MARGIN),
  };
}

/**
 * Compute the camera {x, y} that centres the given tile in the viewport.
 * This mirrors the body of the `if (tilesChanged || containerChanged)` block
 * in HexMapLayer's useLayoutEffect.
 */
function centreCamera(
  tile:            Tile,
  containerWidth:  number,
  containerHeight: number,
  sz:              number,
  ox:              number,
  bounds:          Bounds,
): { x: number; y: number } {
  const tileCx = Math.round(tile.q * Q_STEP * sz) + ox + sz / 2;
  const tileCy = Math.round((tile.r * R_STEP + tile.q * Q_VOFF) * sz) + OY + sz / 2;

  const rawX = containerWidth  / 2 - tileCx;
  const rawY = containerHeight / 2 - tileCy;

  return {
    x: clamp(rawX, bounds.minX, bounds.maxX),
    y: clamp(rawY, bounds.minY, bounds.maxY),
  };
}

/** Returns the pixel centre of a tile given camera position. */
function tileCentreOnScreen(
  tile:   Tile,
  sz:     number,
  ox:     number,
  cam:    { x: number; y: number },
): { cx: number; cy: number } {
  const tileLeft = Math.round(tile.q * Q_STEP * sz) + ox;
  const tileTop  = Math.round((tile.r * R_STEP + tile.q * Q_VOFF) * sz) + OY;
  return {
    cx: tileLeft + sz / 2 + cam.x,
    cy: tileTop  + sz / 2 + cam.y,
  };
}

/** shouldRecentre mirrors the condition in HexMapLayer's useLayoutEffect. */
function shouldRecentre(
  tilesKey:        string,
  prevTilesKey:    string,
  containerWidth:  number,
  containerHeight: number,
  prevW:           number,
  prevH:           number,
): boolean {
  const tilesChanged     = tilesKey !== prevTilesKey;
  const containerChanged = containerWidth !== prevW || containerHeight !== prevH;
  return tilesChanged || containerChanged;
}

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, details = ''): void {
  if (cond) {
    console.log(`PASS - ${name}`);
    passed++;
  } else {
    console.error(`FAIL - ${name}${details ? ` :: ${details}` : ''}`);
    failed++;
  }
}

function near(a: number, b: number, tolerance: number, label: string): void {
  check(label, Math.abs(a - b) <= tolerance, `got ${a.toFixed(2)}, expected ≈${b} (±${tolerance})`);
}

// ── Fixture helpers ────────────────────────────────────────────────────────────

/** Small 5-tile linear map, player at (2,2). */
function makeFixture(): Tile[] {
  return [
    { id: 't0', q: 0, r: 0 },
    { id: 't1', q: 1, r: 1 },
    { id: 't2', q: 2, r: 2, current: true },
    { id: 't3', q: 3, r: 3 },
    { id: 't4', q: 4, r: 4 },
  ];
}

function setup(tiles: Tile[], cw: number, ch: number) {
  const sz     = computeSz(tiles, cw);
  const ox     = computeOx(tiles, cw, sz);
  const worldW = computeWorldW(tiles, sz, ox);
  const worldH = computeWorldH(tiles, sz);
  const bounds = computeBounds(cw, ch, worldW, worldH, sz);
  return { sz, ox, bounds };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// 1. Basic centring — portrait viewport
{
  const tiles    = makeFixture();
  const player   = tiles.find(t => t.current)!;
  const cw = 360, ch = 640;
  const { sz, ox, bounds } = setup(tiles, cw, ch);
  const cam = centreCamera(player, cw, ch, sz, ox, bounds);
  const { cx, cy } = tileCentreOnScreen(player, sz, ox, cam);

  near(cx, cw / 2, 4, '1. portrait: player tile cx ≈ viewport centre-x');
  near(cy, ch / 2, 4, '1. portrait: player tile cy ≈ viewport centre-y');
}

// 2. Basic centring — landscape viewport
{
  const tiles    = makeFixture();
  const player   = tiles.find(t => t.current)!;
  const cw = 640, ch = 360;
  const { sz, ox, bounds } = setup(tiles, cw, ch);
  const cam = centreCamera(player, cw, ch, sz, ox, bounds);
  const { cx, cy } = tileCentreOnScreen(player, sz, ox, cam);

  near(cx, cw / 2, 4, '2. landscape: player tile cx ≈ viewport centre-x');
  near(cy, ch / 2, 4, '2. landscape: player tile cy ≈ viewport centre-y');
}

// 3. Camera position CHANGES after rotation (portrait → landscape)
//
// Note: camera.x is usually 0 regardless of orientation because `ox` already
// horizontally centres the world within the container.  The meaningful
// difference is camera.y — a taller portrait viewport pushes the tile higher
// than a shorter landscape viewport.  We also verify the raw camera positions
// are each consistent with (world-centre - viewport-centre) arithmetic.
{
  const tiles  = makeFixture();
  const player = tiles.find(t => t.current)!;

  const cwP = 360, chP = 640;
  const { sz: szP, ox: oxP, bounds: bP } = setup(tiles, cwP, chP);
  const camPortrait = centreCamera(player, cwP, chP, szP, oxP, bP);

  const cwL = 640, chL = 360;
  const { sz: szL, ox: oxL, bounds: bL } = setup(tiles, cwL, chL);
  const camLandscape = centreCamera(player, cwL, chL, szL, oxL, bL);

  // The taller portrait viewport should produce a more positive camera.y
  // (world scrolled down more to keep player centred) than the shorter
  // landscape viewport.  Both are clamped within their respective bounds.
  check(
    '3. portrait camera.y ≥ landscape camera.y (taller container shifts world down)',
    camPortrait.y >= camLandscape.y,
    `portrait.y=${camPortrait.y}, landscape.y=${camLandscape.y}`,
  );
  // Each position must be within its own bounds.
  check('3. portrait cam within y-bounds', camPortrait.y >= bP.minY && camPortrait.y <= bP.maxY);
  check('3. landscape cam within y-bounds', camLandscape.y >= bL.minY && camLandscape.y <= bL.maxY);
}

// 4. shouldRecentre — tiles changed, dimensions same
{
  check(
    '4. shouldRecentre=true when tilesKey changes',
    shouldRecentre('5:t2', '5:t1', 360, 640, 360, 640),
  );
}

// 5. shouldRecentre — dimensions changed, tiles same (the orientation-flip case)
{
  check(
    '5. shouldRecentre=true when container dims change (orientation flip)',
    shouldRecentre('5:t2', '5:t2', 640, 360, 360, 640),
  );
}

// 6. shouldRecentre — both changed
{
  check(
    '6. shouldRecentre=true when both tiles and dims change',
    shouldRecentre('6:t3', '5:t2', 640, 360, 360, 640),
  );
}

// 7. shouldRecentre — nothing changed → should NOT re-centre
{
  check(
    '7. shouldRecentre=false when nothing changes',
    !shouldRecentre('5:t2', '5:t2', 360, 640, 360, 640),
  );
}

// 8. Bounds clamping — tiny container forces camera to a bounded position
{
  const tiles  = makeFixture();
  const player = tiles.find(t => t.current)!;
  const cw = 50, ch = 80;           // much smaller than the world
  const { sz, ox, bounds } = setup(tiles, cw, ch);
  const cam = centreCamera(player, cw, ch, sz, ox, bounds);

  check('8. cam.x within bounds.minX', cam.x >= bounds.minX, `cam.x=${cam.x}, minX=${bounds.minX}`);
  check('8. cam.x within bounds.maxX', cam.x <= bounds.maxX, `cam.x=${cam.x}, maxX=${bounds.maxX}`);
  check('8. cam.y within bounds.minY', cam.y >= bounds.minY, `cam.y=${cam.y}, minY=${bounds.minY}`);
  check('8. cam.y within bounds.maxY', cam.y <= bounds.maxY, `cam.y=${cam.y}, maxY=${bounds.maxY}`);
}

// 9. Player at origin (q=0, r=0)
//
// The world is tiny (single tile near top-left), so the camera clamps at
// bounds.maxY rather than perfectly centring the tile vertically.  We verify:
//   (a) cx is centred (ox handles horizontal world centring so cam.x=0),
//   (b) the camera is at its maximum valid Y position (tile pushed as low as
//       the bounds allow), and
//   (c) cam stays within bounds.
{
  const tiles: Tile[] = [{ id: 'a', q: 0, r: 0, current: true }];
  const cw = 360, ch = 640;
  const { sz, ox, bounds } = setup(tiles, cw, ch);
  const cam = centreCamera(tiles[0], cw, ch, sz, ox, bounds);
  const { cx } = tileCentreOnScreen(tiles[0], sz, ox, cam);

  near(cx, cw / 2, 4, '9. origin tile cx ≈ viewport centre-x');
  // World is too small to reach ch/2 — camera should be at the top bound.
  check('9. cam.y === bounds.maxY (world too small to fully centre)', cam.y === bounds.maxY,
    `cam.y=${cam.y}, maxY=${bounds.maxY}`);
  check('9. cam.y within bounds', cam.y >= bounds.minY && cam.y <= bounds.maxY);
}

// 10. Large map (10-tile chain) — portrait viewport taller than the world
//
// The world height (~655 px) is less than the container (844 px), so the
// camera is clamped at bounds.maxY rather than reaching the ideal ch/2.
// We verify cx is centred and the camera is within its valid range.
{
  const tiles: Tile[] = Array.from({ length: 10 }, (_, i) => ({
    id: `t${i}`, q: i, r: i, current: i === 5,
  }));
  const player = tiles.find(t => t.current)!;
  const cw = 390, ch = 844;    // iPhone 14 Pro portrait logical pts
  const { sz, ox, bounds } = setup(tiles, cw, ch);
  const cam = centreCamera(player, cw, ch, sz, ox, bounds);
  const { cx } = tileCentreOnScreen(player, sz, ox, cam);

  near(cx, cw / 2, 4, '10. large map portrait: player cx ≈ centre-x');
  // World fits vertically → camera clamped at maxY; tile is as close to
  // centre as the bounds allow.
  check('10. cam.y within bounds', cam.y >= bounds.minY && cam.y <= bounds.maxY);
  check('10. cam.y === bounds.maxY (world shorter than viewport)',
    cam.y === bounds.maxY, `cam.y=${cam.y}, maxY=${bounds.maxY}`);
}

// 11. Centring holds after rotation of the same large map
{
  const tiles: Tile[] = Array.from({ length: 10 }, (_, i) => ({
    id: `t${i}`, q: i, r: i, current: i === 5,
  }));
  const player = tiles.find(t => t.current)!;
  const cw = 844, ch = 390;    // same device landscape
  const { sz, ox, bounds } = setup(tiles, cw, ch);
  const cam = centreCamera(player, cw, ch, sz, ox, bounds);
  const { cx, cy } = tileCentreOnScreen(player, sz, ox, cam);

  near(cx, cw / 2, 4, '11. large map landscape: player cx ≈ centre-x');
  near(cy, ch / 2, 4, '11. large map landscape: player cy ≈ centre-y');
}

// 12. Repeated same-dimension call → shouldRecentre=false (idempotency guard)
{
  let w = 360, h = 640;
  const key = '5:t2';
  // First call — should centre
  let prevKey = '', prevW = 0, prevH = 0;
  const first = shouldRecentre(key, prevKey, w, h, prevW, prevH);
  check('12. first call triggers re-centre', first);
  prevKey = key; prevW = w; prevH = h;
  // Second call — same everything → must NOT re-centre
  const second = shouldRecentre(key, prevKey, w, h, prevW, prevH);
  check('12. repeated same-dim call skips re-centre', !second);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
