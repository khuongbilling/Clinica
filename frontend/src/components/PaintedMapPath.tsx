/**
 * PaintedMapPath — illustrated stone-stamp path connector.
 *
 * Replaces dashed SVG bezier lines with a chain of painted circular
 * stone stamps along the bezier curve. Gives an RPG adventure-map feel
 * (stepping stones / cobblestones / paving tiles) rather than thin vector lines.
 *
 * Usage:
 *   <PaintedMapPath
 *     ax={node1.x} ay={node1.y}
 *     bx={node2.x} by={node2.y}
 *     complete={fromDone}
 *     accentColor={chapterAccent}
 *   />
 *
 * Renders as an absoluteFill SVG — must be inside a sized parent.
 */
import React from "react";
import * as RNSvg from "react-native-svg";

const Svg      = (RNSvg as any).default   as React.ComponentType<any>;
const SvgCircle = (RNSvg as any).Circle  as React.ComponentType<any>;
const SvgPath   = (RNSvg as any).Path    as React.ComponentType<any>;
const SvgEllipse = (RNSvg as any).Ellipse as React.ComponentType<any>;

interface PaintedMapPathProps {
  ax:          number;
  ay:          number;
  bx:          number;
  by:          number;
  complete:    boolean;
  accentColor: string;
  canvasW:     number;
  canvasH:     number;
}

// ── Bezier helpers ─────────────────────────────────────────────────────────────

function bez(ax: number, ay: number, bx: number, by: number): string {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const off = Math.abs(bx - ax) * 0.45;
  const cx1 = ax > bx ? ax - off : ax + off;
  const cy1 = ay + (by - ay) * 0.35;
  const cx2 = bx > ax ? bx - off : bx + off;
  const cy2 = by - (by - ay) * 0.35;
  return `M ${ax} ${ay} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${bx} ${by}`;
}

function cubicBezierPoint(
  ax: number, ay: number,
  cx1: number, cy1: number,
  cx2: number, cy2: number,
  bx: number, by: number,
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u*u*u*ax + 3*u*u*t*cx1 + 3*u*t*t*cx2 + t*t*t*bx,
    y: u*u*u*ay + 3*u*u*t*cy1 + 3*u*t*t*cy2 + t*t*t*by,
  };
}

function bezPoints(
  ax: number, ay: number, bx: number, by: number, n = 8,
): { x: number; y: number }[] {
  const off = Math.abs(bx - ax) * 0.45;
  const cx1 = ax > bx ? ax - off : ax + off;
  const cy1 = ay + (by - ay) * 0.35;
  const cx2 = bx > ax ? bx - off : bx + off;
  const cy2 = by - (by - ay) * 0.35;
  return Array.from({ length: n }, (_, i) =>
    cubicBezierPoint(ax, ay, cx1, cy1, cx2, cy2, bx, by, (i + 1) / (n + 1)),
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PaintedMapPath({
  ax, ay, bx, by,
  complete,
  accentColor,
  canvasW,
  canvasH,
}: PaintedMapPathProps) {
  const STAMPS = complete ? 7 : 6;
  const points = bezPoints(ax, ay, bx, by, STAMPS);

  return (
    <Svg
      width={canvasW}
      height={canvasH}
      style={{ position: "absolute", top: 0, left: 0 }}
      pointerEvents="none"
    >
      {complete ? (
        <>
          {/* Glow path under completed stones */}
          <SvgPath
            d={bez(ax, ay, bx, by)}
            stroke={accentColor + "22"}
            strokeWidth={14}
            fill="none"
            strokeLinecap="round"
          />
          {/* Thin luminous spine */}
          <SvgPath
            d={bez(ax, ay, bx, by)}
            stroke={accentColor + "70"}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
          {/* Stone stamps */}
          {points.map((pt, i) => (
            <React.Fragment key={i}>
              {/* Stone shadow */}
              <SvgEllipse
                cx={pt.x + 1}
                cy={pt.y + 2}
                rx={5.5}
                ry={3.5}
                fill={"#00000033"}
              />
              {/* Stone body */}
              <SvgCircle
                cx={pt.x}
                cy={pt.y}
                r={5}
                fill={accentColor + "CC"}
              />
              {/* Stone highlight */}
              <SvgCircle
                cx={pt.x - 1.5}
                cy={pt.y - 1.5}
                r={2}
                fill={accentColor + "55"}
              />
            </React.Fragment>
          ))}
        </>
      ) : (
        <>
          {/* Dim ghost path spine */}
          <SvgPath
            d={bez(ax, ay, bx, by)}
            stroke={"#3DC4A815"}
            strokeWidth={1.5}
            strokeDasharray={"4 8"}
            fill="none"
            strokeLinecap="round"
          />
          {/* Ghost stone stamps — dim, locked look */}
          {points.map((pt, i) => (
            <React.Fragment key={i}>
              <SvgCircle
                cx={pt.x}
                cy={pt.y}
                r={4}
                fill={"#3DC4A820"}
                stroke={"#3DC4A830"}
                strokeWidth={1}
              />
            </React.Fragment>
          ))}
        </>
      )}
    </Svg>
  );
}
