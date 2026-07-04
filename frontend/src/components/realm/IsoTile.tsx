import { View } from "react-native";

// A single "faux-isometric" diamond tile. A square is rotated 45deg, then the
// whole rotated square is squashed vertically (scaleY) so the resulting
// bounding box matches the requested w x h diamond. This is the classic
// 2D diamond-grid trick used by many isometric-style games — no 3D transforms
// or `preserve-3d` are required, so it renders identically on web and native.
export function IsoTile({
  x, y, w, h, fill, borderColor, borderWidth = 0, opacity = 1,
}: {
  x: number; y: number; w: number; h: number;
  fill: string; borderColor?: string; borderWidth?: number; opacity?: number;
}) {
  const side = w / Math.SQRT2;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x - w / 2,
        top: y - w / 2,
        width: w,
        height: w,
        transform: [{ scaleY: h / w }],
        opacity,
      }}
    >
      <View
        style={{
          position: "absolute",
          width: side,
          height: side,
          left: (w - side) / 2,
          top: (w - side) / 2,
          transform: [{ rotate: "45deg" }],
          backgroundColor: fill,
          borderWidth,
          borderColor,
        }}
      />
    </View>
  );
}

// A beveled ground tile: a darker "edge" diamond behind a slightly smaller,
// lighter "face" diamond — reads as a subtly raised block rather than a flat
// color square, which is what sells the 2.5D terrain look at a glance.
export function IsoGroundTile({
  x, y, w, h, faceColor, edgeColor, accentColor, dimmed,
}: {
  x: number; y: number; w: number; h: number;
  faceColor: string; edgeColor: string; accentColor?: string; dimmed?: boolean;
}) {
  return (
    <>
      <IsoTile x={x} y={y + h * 0.06} w={w} h={h} fill={edgeColor} opacity={dimmed ? 0.5 : 1} />
      <IsoTile
        x={x}
        y={y}
        w={w * 0.9}
        h={h * 0.9}
        fill={faceColor}
        borderColor={accentColor}
        borderWidth={accentColor ? 1 : 0}
        opacity={dimmed ? 0.5 : 1}
      />
    </>
  );
}
