/**
 * PaintedMapPath — V4 illustrated chapter-specific path connector.
 *
 * Three visual states × five chapter stamp themes. No dashes or dots anywhere.
 *
 * States:
 *   complete   → full painted road band + vivid thematic stamps (cleared segment)
 *   available  → soft road band + dim stamp outlines (open route ahead)
 *   locked     → ghost fog road only, no stamps (unexplored territory)
 *
 * Chapter stamp shapes (aligned along path tangent via rotate(angle+90)):
 *   Ch1  Sanctuary   — jade lotus teardrop petals (slender, organic)
 *   Ch2  University  — diamond cobblestone tiles (crisp, geometric)
 *   Ch3  Garden      — wide flat oval stepping stones (perpendicular to path)
 *   Ch4  Tower       — hexagonal ward corridor tiles (angular, structured)
 *   Ch5  Community   — leaf-oval trail markers (warm, organic)
 *   Ch6+ Generic     — diamond tiles (GenericChapterVisualMap fallback)
 */
import React from "react";
import * as RNSvg from "react-native-svg";

const Svg     = (RNSvg as any).default as React.ComponentType<any>;
const SvgPath = (RNSvg as any).Path   as React.ComponentType<any>;
const SvgG    = (RNSvg as any).G      as React.ComponentType<any>;

export type PathState = "complete" | "available" | "locked";

export interface PaintedMapPathProps {
  ax:          number;
  ay:          number;
  bx:          number;
  by:          number;
  /** cleared segment, open-ahead route, or locked/unexplored */
  pathState:   PathState;
  accentColor: string;
  canvasW:     number;
  canvasH:     number;
  /** 1–10; drives stamp shape and road-surface palette */
  chapter:     number;
}

// ── Bezier math ───────────────────────────────────────────────────────────────

function getBezParams(ax: number, ay: number, bx: number, by: number) {
  const off = Math.abs(bx - ax) * 0.45;
  const cx1 = ax > bx ? ax - off : ax + off;
  const cy1 = ay + (by - ay) * 0.35;
  const cx2 = bx > ax ? bx - off : bx + off;
  const cy2 = by - (by - ay) * 0.35;
  return { cx1, cy1, cx2, cy2 };
}

function bezPathD(ax: number, ay: number, bx: number, by: number): string {
  const { cx1, cy1, cx2, cy2 } = getBezParams(ax, ay, bx, by);
  return `M ${ax} ${ay} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${bx} ${by}`;
}

/** Sample n evenly-spaced points along the bezier, each with path tangent angle. */
function bezSample(
  ax: number, ay: number, bx: number, by: number, n: number,
): { x: number; y: number; angle: number }[] {
  const { cx1, cy1, cx2, cy2 } = getBezParams(ax, ay, bx, by);
  return Array.from({ length: n }, (_, i) => {
    const t  = (i + 1) / (n + 1);
    const u  = 1 - t;
    const x  = u*u*u*ax + 3*u*u*t*cx1 + 3*u*t*t*cx2 + t*t*t*bx;
    const y  = u*u*u*ay + 3*u*u*t*cy1 + 3*u*t*t*cy2 + t*t*t*by;
    // Tangent vector for stamp rotation
    const dx = 3*u*u*(cx1-ax) + 6*u*t*(cx2-cx1) + 3*t*t*(bx-cx2);
    const dy = 3*u*u*(cy1-ay) + 6*u*t*(cy2-cy1) + 3*t*t*(by-cy2);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return { x, y, angle };
  });
}

// ── Stamp shape paths (centered at 0,0, long axis along +y) ──────────────────
// Applied rotation in JSX = tangentAngle + 90  → aligns long axis with path

function stampD(chapter: number, r: number): string {
  switch (chapter) {
    case 1:  // Jade lotus petal — slender teardrop
      return `M 0,${-r} C ${r * 0.6},${-r} ${r * 0.6},${r} 0,${r} C ${-r * 0.6},${r} ${-r * 0.6},${-r} 0,${-r} Z`;
    case 2:  // Diamond cobblestone tile
      return `M 0,${-r} L ${r},0 L 0,${r} L ${-r},0 Z`;
    case 3: { // Wide flat oval stepping stone (elongated perpendicular to path)
      const w = r * 1.15, h = r * 0.55;
      return `M 0,${-h} C ${w},${-h} ${w},${h} 0,${h} C ${-w},${h} ${-w},${-h} 0,${-h} Z`;
    }
    case 4:  // Hexagonal ward corridor tile
      return `M 0,${-r} L ${r * 0.85},${-r * 0.5} L ${r * 0.85},${r * 0.5} L 0,${r} L ${-r * 0.85},${r * 0.5} L ${-r * 0.85},${-r * 0.5} Z`;
    case 5:  // Leaf-oval trail marker (organic, slightly wide)
      return `M 0,${-r} C ${r * 0.75},${-r * 0.65} ${r * 0.75},${r * 0.65} 0,${r} C ${-r * 0.75},${r * 0.65} ${-r * 0.75},${-r * 0.65} 0,${-r} Z`;
    default: // Diamond fallback for Ch6-10
      return `M 0,${-r} L ${r},0 L 0,${r} L ${-r},0 Z`;
  }
}

// ── Per-chapter road surface tints (painted beneath the accent lane) ──────────
const ROAD_SURFACE: Record<number, string> = {
  1: "#0B4030",  // jade earth bed
  2: "#1A3060",  // academy stone blue
  3: "#152A50",  // garden slate
  4: "#3A0B10",  // ward corridor stone
  5: "#0A3018",  // forest earth green
};

// ── Component ─────────────────────────────────────────────────────────────────

export function PaintedMapPath({
  ax, ay, bx, by,
  pathState,
  accentColor,
  canvasW, canvasH,
  chapter,
}: PaintedMapPathProps) {
  const d         = bezPathD(ax, ay, bx, by);
  const roadColor = ROAD_SURFACE[chapter] ?? "#1A2A3A";

  // ── LOCKED: faint ghost road only, no stamps ───────────────────────────────
  if (pathState === "locked") {
    return (
      <Svg
        width={canvasW} height={canvasH}
        style={{ position: "absolute", top: 0, left: 0 }}
        pointerEvents="none"
      >
        <SvgPath d={d} stroke={"#00000020"} strokeWidth={18} fill="none" strokeLinecap="round" />
        <SvgPath d={d} stroke={roadColor + "1E"} strokeWidth={12} fill="none" strokeLinecap="round" />
        <SvgPath d={d} stroke={"#FFFFFF07"} strokeWidth={5}   fill="none" strokeLinecap="round" />
      </Svg>
    );
  }

  const isComplete = pathState === "complete";
  const STAMP_N    = isComplete ? 6 : 5;
  const STAMP_R    = 6;
  const points     = bezSample(ax, ay, bx, by, STAMP_N);

  return (
    <Svg
      width={canvasW} height={canvasH}
      style={{ position: "absolute", top: 0, left: 0 }}
      pointerEvents="none"
    >
      {/* ── Road band layers ─────────────────────────────────────────────── */}
      {isComplete ? (
        <>
          {/* Dark earth grounding shadow */}
          <SvgPath d={d} stroke={"#00000045"} strokeWidth={24} fill="none" strokeLinecap="round" />
          {/* Painted road surface */}
          <SvgPath d={d} stroke={roadColor + "85"} strokeWidth={18} fill="none" strokeLinecap="round" />
          {/* Glowing accent lane */}
          <SvgPath d={d} stroke={accentColor + "80"} strokeWidth={7}   fill="none" strokeLinecap="round" />
          {/* Luminous center spine */}
          <SvgPath d={d} stroke={accentColor + "CC"} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* Faint earth bed */}
          <SvgPath d={d} stroke={"#00000025"} strokeWidth={18} fill="none" strokeLinecap="round" />
          {/* Soft available-ahead road surface */}
          <SvgPath d={d} stroke={roadColor + "48"} strokeWidth={13} fill="none" strokeLinecap="round" />
          {/* Dim accent lane */}
          <SvgPath d={d} stroke={accentColor + "42"} strokeWidth={5} fill="none" strokeLinecap="round" />
        </>
      )}

      {/* ── Thematic stamp markers along path ────────────────────────────── */}
      {points.map((pt, i) => {
        // Slight size variation for hand-painted, non-algorithmic look
        const r  = STAMP_R * (i % 3 === 1 ? 0.84 : i % 3 === 2 ? 1.08 : 1.0);
        // rotate(angle+90): aligns stamp long axis (+y) with path tangent
        const tf = `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}) rotate(${(pt.angle + 90).toFixed(1)})`;
        const sd = stampD(chapter, r);

        return (
          <SvgG key={i} transform={tf}>
            {isComplete ? (
              <>
                <SvgPath d={sd} fill={accentColor + "E0"} />
                {/* Inner highlight — smaller, lighter center */}
                <SvgPath d={stampD(chapter, r * 0.42)} fill={accentColor + "60"} />
              </>
            ) : (
              /* Dim outline-only — available-ahead look */
              <SvgPath d={sd} fill={accentColor + "22"} stroke={accentColor + "55"} strokeWidth={1} />
            )}
          </SvgG>
        );
      })}
    </Svg>
  );
}
