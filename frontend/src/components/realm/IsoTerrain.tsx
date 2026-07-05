import * as RNSvg from "react-native-svg";
import type { PlotCell, TerrainType } from "@/src/game/realmGrid";
import { ISO_TILE_W, ISO_TILE_H, IsoCanvas } from "@/src/game/realmIso";

// react-native-svg 15.x ships class-component typings that React 19's stricter
// JSX checker rejects ("cannot be used as a JSX component"). Runtime is fine, so
// we alias the primitives through React.ComponentType to satisfy tsc.
const Svg = RNSvg.default as unknown as React.ComponentType<any>;
const Polygon = RNSvg.Polygon as unknown as React.ComponentType<any>;
const G = RNSvg.G as unknown as React.ComponentType<any>;
const Defs = RNSvg.Defs as unknown as React.ComponentType<any>;
const Pattern = RNSvg.Pattern as unknown as React.ComponentType<any>;
const SvgImage = RNSvg.Image as unknown as React.ComponentType<any>;

// Donghua-style painted terrain textures. These REPLACE the old flat SVG color
// fills — each diamond plot is now filled with a hand-painted illustration
// (grass, flowery meadow, dirt path, water, forest canopy, rock, stone court)
// clipped to the tile shape. The patterns are tiled in screen space so adjacent
// same-terrain tiles read as one continuous painted field, not repeated stamps.
const TEXTURES: Record<TerrainType | "road", any> = {
  grass: require("../../../assets/realm/terrain/grass.png"),
  meadow: require("../../../assets/realm/terrain/meadow.png"),
  path: require("../../../assets/realm/terrain/path.png"),
  water: require("../../../assets/realm/terrain/water.png"),
  forest: require("../../../assets/realm/terrain/forest.png"),
  mountain: require("../../../assets/realm/terrain/mountain.png"),
  stone: require("../../../assets/realm/terrain/stone.png"),
  road: require("../../../assets/realm/terrain/path.png"),
};

// Skirt (extruded 3D side face) colors — a solid earthy tone per terrain so
// every tile still reads as a chunk of ground with thickness under the painted
// top face. Chosen to sit slightly darker than the texture's midtone.
const SKIRT: Record<TerrainType | "road", string> = {
  grass: "#3f7a3f",
  meadow: "#4f7f38",
  path: "#8a6a3e",
  water: "#2f6f9a",
  forest: "#1f4d29",
  mountain: "#4a4f57",
  stone: "#6f6a5c",
  road: "#8a6a3e",
};

const BLOCK_H = 13;

// The pattern tile size in screen px. The texture repeats across the whole
// canvas at this size; larger = more zoomed-in / fewer repeats.
const TEX_TILE = 128;

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

const TERRAIN_KEYS: (TerrainType | "road")[] = [
  "grass", "meadow", "path", "water", "forest", "mountain", "stone", "road",
];

export function IsoTerrain({
  cells, canvas, roadSet, unlocked, buildMode,
}: {
  cells: PlotCell[];
  canvas: IsoCanvas;
  roadSet: Set<string>;
  unlocked: (cell: PlotCell) => boolean;
  // Visual hierarchy: the buildable grid outline is subtle during normal play
  // and drawn more prominently while the player is actively building/placing.
  buildMode?: boolean;
}) {
  const hw = ISO_TILE_W / 2;
  const hh = ISO_TILE_H / 2;
  const px = (u: number, v: number) => (v - u) * hw + canvas.originX;
  const py = (u: number, v: number) => (v + u) * hh + canvas.topPad;

  return (
    <Svg width={canvas.width} height={canvas.height} style={{ position: "absolute", left: 0, top: 0 }} pointerEvents="none">
      <Defs>
        {TERRAIN_KEYS.map((k) => (
          <Pattern
            key={k}
            id={`terr-${k}`}
            patternUnits="userSpaceOnUse"
            width={TEX_TILE}
            height={TEX_TILE}
          >
            <SvgImage
              href={TEXTURES[k]}
              x={0}
              y={0}
              width={TEX_TILE}
              height={TEX_TILE}
              preserveAspectRatio="xMidYMid slice"
            />
          </Pattern>
        ))}
      </Defs>
      {cells.map((cell) => {
        const isRoad = roadSet.has(cell.id) && cell.plotType !== "blocked";
        const locked = cell.isExpansion && !unlocked(cell);
        const key = (isRoad ? "road" : cell.terrain) as TerrainType | "road";

        const r = cell.row, c = cell.col;
        const A = [px(r, c), py(r, c)];              // top (back)
        const B = [px(r, c + 1), py(r, c + 1)];      // right
        const C = [px(r + 1, c + 1), py(r + 1, c + 1)]; // bottom (front)
        const D = [px(r + 1, c), py(r + 1, c)];      // left

        const skirt = SKIRT[key];
        const leftCol = shade(skirt, 0.82);
        const rightCol = shade(skirt, 0.6);

        const topPts = `${A[0]},${A[1]} ${B[0]},${B[1]} ${C[0]},${C[1]} ${D[0]},${D[1]}`;
        const leftPts = `${D[0]},${D[1]} ${C[0]},${C[1]} ${C[0]},${C[1] + BLOCK_H} ${D[0]},${D[1] + BLOCK_H}`;
        const rightPts = `${C[0]},${C[1]} ${B[0]},${B[1]} ${B[0]},${B[1] + BLOCK_H} ${C[0]},${C[1] + BLOCK_H}`;

        // Grid outline: nearly invisible during normal play so the map reads as
        // continuous painted terrain; crisp gold on buildable cells while
        // placing so the player can see where a footprint will land.
        const showBuildOutline = buildMode && cell.plotType === "buildable";

        return (
          <G key={cell.id} opacity={locked ? 0.42 : 1}>
            <Polygon points={leftPts} fill={leftCol} />
            <Polygon points={rightPts} fill={rightCol} />
            <Polygon
              points={topPts}
              fill={`url(#terr-${key})`}
              // In normal play, stroke each tile with its OWN texture (not a dark
              // line) so the painted fill bleeds ~1px past the polygon edge and
              // closes the hairline antialiasing seams between neighbours — the
              // field reads as one continuous painting, not a grid of plots.
              // While building, switch to a crisp gold outline so footprints are
              // legible.
              stroke={showBuildOutline ? "#f2c14e" : `url(#terr-${key})`}
              strokeWidth={showBuildOutline ? 1.2 : 1}
              strokeOpacity={showBuildOutline ? 0.9 : 1}
            />
          </G>
        );
      })}
    </Svg>
  );
}
