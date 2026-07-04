// Realm Isometric Projection — pure 2D "faux-isometric" math for the visual
// layer only. This file NEVER touches grid logic, placement rules, footprints,
// or road generation (see realmGrid.ts) — it only converts (row, col) grid
// coordinates into angled diamond-grid screen coordinates so kingdom.tsx can
// render a Clash-of-Clans-style angled base instead of a flat square grid.

export const ISO_TILE_W = 48;
export const ISO_TILE_H = 24;

export interface IsoPoint { x: number; y: number; }

// Raw projection before origin/padding offsets are applied. u = row, v = col
// (may be fractional, e.g. row+0.5 for a cell center, or an integer grid line
// for a footprint corner).
function project(u: number, v: number): IsoPoint {
  return {
    x: (v - u) * (ISO_TILE_W / 2),
    y: (v + u) * (ISO_TILE_H / 2),
  };
}

export interface IsoCanvas {
  width: number;
  height: number;
  originX: number;
  topPad: number;
}

// Computes the pixel size of the full diamond-grid canvas, plus the X offset
// needed to keep every projected point positive (so it can be laid out with
// simple absolute positioning), and a top padding buffer so tall building
// sprites near row 0 don't get clipped.
export function computeIsoCanvas(rows: number, cols: number, opts?: { buildingBuffer?: number; topPad?: number }): IsoCanvas {
  const buildingBuffer = opts?.buildingBuffer ?? 170;
  const topPad = opts?.topPad ?? 36;
  const minX = project(rows, 0).x;
  const maxX = project(0, cols).x;
  const maxY = project(rows, cols).y;
  return {
    width: maxX - minX,
    height: maxY + topPad + buildingBuffer,
    originX: -minX,
    topPad,
  };
}

export function cellCenterIso(row: number, col: number, canvas: IsoCanvas): IsoPoint {
  const p = project(row + 0.5, col + 0.5);
  return { x: p.x + canvas.originX, y: p.y + canvas.topPad };
}

export interface IsoFootprint {
  center: IsoPoint;
  bottom: IsoPoint;
  width: number;
  height: number;
}

// Projects a building/decoration footprint (origin cell + w x h in cells)
// into the bounding diamond of its ground shadow: the "bottom" point is the
// exact front-most corner (nearest the viewer), which is where a sprite
// should be bottom-anchored so it appears to stand on the ground.
export function footprintIso(
  origin: { row: number; col: number },
  footprint: { w: number; h: number },
  canvas: IsoCanvas
): IsoFootprint {
  const top = project(origin.row, origin.col);
  const bottom = project(origin.row + footprint.h, origin.col + footprint.w);
  const left = project(origin.row + footprint.h, origin.col);
  const right = project(origin.row, origin.col + footprint.w);
  return {
    center: {
      x: (left.x + right.x) / 2 + canvas.originX,
      y: (top.y + bottom.y) / 2 + canvas.topPad,
    },
    bottom: { x: bottom.x + canvas.originX, y: bottom.y + canvas.topPad },
    width: right.x - left.x,
    height: bottom.y - top.y,
  };
}

// Depth key for painter's-algorithm sorting (draw back-to-front). Entities
// anchored at a deeper/further-forward cell (higher row+col) must render
// after (visually on top of / in front of) shallower ones.
export function cellDepth(row: number, col: number): number {
  return row + col;
}

export function footprintDepth(origin: { row: number; col: number }, footprint: { w: number; h: number }): number {
  return origin.row + footprint.h - 1 + (origin.col + footprint.w - 1);
}
