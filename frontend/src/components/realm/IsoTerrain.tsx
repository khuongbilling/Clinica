import * as RNSvg from "react-native-svg";
import type { PlotCell } from "@/src/game/realmGrid";
import { ISO_TILE_W, ISO_TILE_H, IsoCanvas } from "@/src/game/realmIso";

// react-native-svg 15.x ships class-component typings that React 19's stricter
// JSX checker rejects ("cannot be used as a JSX component"). Runtime is fine, so
// we alias the primitives through React.ComponentType to satisfy tsc.
const Svg = RNSvg.default as unknown as React.ComponentType<any>;
const Polygon = RNSvg.Polygon as unknown as React.ComponentType<any>;
const Circle = RNSvg.Circle as unknown as React.ComponentType<any>;
const Ellipse = RNSvg.Ellipse as unknown as React.ComponentType<any>;
const Line = RNSvg.Line as unknown as React.ComponentType<any>;
const G = RNSvg.G as unknown as React.ComponentType<any>;

// Height (in px) of the extruded 3D block below each ground tile's top face.
// The top face stays exactly where the flat tile used to be, so buildings still
// anchor correctly — the block only adds visible thickness downward.
const BLOCK_H = 13;

// Per-terrain top-face color. Side faces are derived by darkening this so every
// tile reads as a solid 3D cube of earth/rock/water rather than a flat sticker.
const TOP: Record<string, string> = {
  grass: "#57b45f",
  dirt: "#c19a5e",
  water: "#3f8ac8",
  mountain: "#6b7280",
  stone: "#565b66",
};
const ROAD_TOP = "#d3ab6c";

function parse(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function shade(hex: string, f: number): string {
  const [r, g, b] = parse(hex);
  return toHex(r * f, g * f, b * f);
}
function vary(hex: string, d: number): string {
  const [r, g, b] = parse(hex);
  return toHex(r + d, g + d, b + d);
}

// Deterministic per-cell PRNG so terrain variation & scattered objects are
// randomized-looking but stable across every re-render (no flicker).
function makeRng(row: number, col: number) {
  let s = ((row * 73856093) ^ (col * 19349663)) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function IsoTerrain({
  cells, canvas, roadSet, unlocked,
}: {
  cells: PlotCell[];
  canvas: IsoCanvas;
  roadSet: Set<string>;
  unlocked: (cell: PlotCell) => boolean;
}) {
  const hw = ISO_TILE_W / 2;
  const hh = ISO_TILE_H / 2;
  const px = (u: number, v: number) => (v - u) * hw + canvas.originX;
  const py = (u: number, v: number) => (v + u) * hh + canvas.topPad;

  return (
    <Svg width={canvas.width} height={canvas.height} style={{ position: "absolute", left: 0, top: 0 }} pointerEvents="none">
      {cells.map((cell) => {
        const isRoad = roadSet.has(cell.id) && cell.plotType !== "blocked";
        const locked = cell.isExpansion && !unlocked(cell);
        const rng = makeRng(cell.row, cell.col);

        const r = cell.row, c = cell.col;
        const A = [px(r, c), py(r, c)];        // top (back)
        const B = [px(r, c + 1), py(r, c + 1)];    // right
        const C = [px(r + 1, c + 1), py(r + 1, c + 1)]; // bottom (front)
        const D = [px(r + 1, c), py(r + 1, c)];    // left
        const cx = px(r + 0.5, c + 0.5);
        const cy = py(r + 0.5, c + 0.5);

        const baseTop = isRoad ? ROAD_TOP : TOP[cell.terrain];
        // subtle per-tile lightness jitter for a natural, non-uniform field
        const topCol = vary(baseTop, Math.round((rng() - 0.5) * 18));
        const leftCol = shade(baseTop, 0.72);
        const rightCol = shade(baseTop, 0.55);

        const topPts = `${A[0]},${A[1]} ${B[0]},${B[1]} ${C[0]},${C[1]} ${D[0]},${D[1]}`;
        const leftPts = `${D[0]},${D[1]} ${C[0]},${C[1]} ${C[0]},${C[1] + BLOCK_H} ${D[0]},${D[1] + BLOCK_H}`;
        const rightPts = `${C[0]},${C[1]} ${B[0]},${B[1]} ${B[0]},${B[1] + BLOCK_H} ${C[0]},${C[1] + BLOCK_H}`;

        // scatter objects only on planted ground, never on roads/water/rock
        const canScatter = !isRoad && (cell.terrain === "grass" || cell.terrain === "dirt");
        const scatter: React.ReactNode[] = [];
        if (canScatter) {
          const n = Math.floor(rng() * 3.2); // 0..3 clumps
          for (let i = 0; i < n; i++) {
            const ox = (rng() - 0.5) * hw * 0.9;
            const oy = (rng() - 0.5) * hh * 0.9;
            const gx = cx + ox;
            const gy = cy + oy;
            const kind = rng();
            if (cell.terrain === "grass" && kind < 0.6) {
              // grass tuft: 3 blades
              const gc = rng() < 0.5 ? "#3f9a49" : "#6cc971";
              scatter.push(
                <G key={`g${i}`}>
                  <Line x1={gx} y1={gy} x2={gx - 2} y2={gy - 6} stroke={gc} strokeWidth={1.4} strokeLinecap="round" />
                  <Line x1={gx} y1={gy} x2={gx} y2={gy - 7.5} stroke={gc} strokeWidth={1.4} strokeLinecap="round" />
                  <Line x1={gx} y1={gy} x2={gx + 2} y2={gy - 6} stroke={gc} strokeWidth={1.4} strokeLinecap="round" />
                </G>
              );
            } else if (cell.terrain === "grass" && kind < 0.78) {
              // little flower
              const fc = ["#f2c14e", "#e8737d", "#c98be0", "#f2f2f2"][Math.floor(rng() * 4)];
              scatter.push(
                <G key={`f${i}`}>
                  <Line x1={gx} y1={gy} x2={gx} y2={gy - 5} stroke="#3f9a49" strokeWidth={1.2} strokeLinecap="round" />
                  <Circle cx={gx} cy={gy - 6} r={2} fill={fc} />
                </G>
              );
            } else {
              // pebble / dirt clod
              const pc = cell.terrain === "dirt" ? "#9c7b4b" : "#8b8f98";
              scatter.push(<Ellipse key={`p${i}`} cx={gx} cy={gy} rx={3} ry={1.8} fill={pc} />);
            }
          }
        }

        return (
          <G key={cell.id} opacity={locked ? 0.4 : 1}>
            <Polygon points={leftPts} fill={leftCol} />
            <Polygon points={rightPts} fill={rightCol} />
            <Polygon points={topPts} fill={topCol} stroke={shade(baseTop, 0.6)} strokeWidth={0.5} />
            {isRoad && (
              <Polygon
                points={`${px(r + 0.15, c + 0.15)},${py(r + 0.15, c + 0.15)} ${px(r + 0.15, c + 0.85)},${py(r + 0.15, c + 0.85)} ${px(r + 0.85, c + 0.85)},${py(r + 0.85, c + 0.85)} ${px(r + 0.85, c + 0.15)},${py(r + 0.85, c + 0.15)}`}
                fill={vary(ROAD_TOP, 20)}
              />
            )}
            {scatter}
          </G>
        );
      })}
    </Svg>
  );
}
