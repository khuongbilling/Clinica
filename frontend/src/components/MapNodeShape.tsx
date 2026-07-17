/**
 * MapNodeShape — illustrated 2.5D map node component
 *
 * Replaces plain circles with type-specific illustrated shapes.
 * Each ChapterPartType gets a distinct visual frame identity
 * inspired by donghua/anime RPG adventure maps.
 *
 * Shape vocabulary (border-radius, double-ring, decorative accents):
 *  · battle         → Rounded shield/pentagon (r*0.28) — war crest
 *  · mini_boss      → Octagonal seal (r*0.42) — corrupted gate
 *  · ward_defense   → Rounded tower (r*0.18) — sentinel post
 *  · memory_fragment → Oval lotus crystal (r*0.85) — memory orb
 *  · challenge      → Hex gem (r*0.38) — triage rune
 *  · reflection     → Circle lotus ring (r) — reflection seal
 *  · story          → Oval scroll (r*0.7) — ward scroll
 *  · reward         → Ornate octagon (r*0.45) — supply chest
 *  · lesson         → Rounded book (r*0.55) — clinic tome
 *  · Others         → Decorated circle
 */
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

export type MapNodeStatus = "complete" | "next" | "available" | "placeholder";

interface MapNodeShapeProps {
  type: string;
  status: MapNodeStatus;
  accentColor: string;
  r: number;
  isActionable: boolean;
  onPress?: () => void;
  testID?: string;
}

// Icon per node type (large, illustrated feel)
export const NODE_TYPE_ICON: Record<string, string> = {
  battle:          "flash",
  mini_boss:       "skull",
  ward_defense:    "shield-checkmark",
  memory_fragment: "sparkles",
  challenge:       "eye",
  reflection:      "leaf",
  story:           "book-outline",
  reward:          "gift",
  lesson:          "school",
  realm:           "home",
  chain:           "link",
  community:       "people",
  arena:           "trophy",
  mode_preview:    "compass",
  minigame:        "game-controller",
};

// Border-radius (as fraction of r) — creates distinct shapes
function getNodeBorderRadius(type: string, r: number): number {
  switch (type) {
    case "battle":          return Math.round(r * 0.28); // shield
    case "mini_boss":       return Math.round(r * 0.42); // octagon
    case "ward_defense":    return Math.round(r * 0.18); // tower
    case "memory_fragment": return Math.round(r * 0.85); // oval orb
    case "challenge":       return Math.round(r * 0.38); // hex gem
    case "reflection":      return r;                     // full circle
    case "story":           return Math.round(r * 0.70); // scroll oval
    case "reward":          return Math.round(r * 0.45); // ornate chest
    case "lesson":          return Math.round(r * 0.55); // tome
    case "realm":           return Math.round(r * 0.60); // arch
    case "chain":           return Math.round(r * 0.35);
    case "community":       return Math.round(r * 0.65);
    case "arena":           return Math.round(r * 0.45);
    case "mode_preview":    return Math.round(r * 0.65);
    default:                return r;
  }
}

// Outer decorative ring border-style — dashed for "next", solid for others
function getOuterRingBr(type: string, r: number): number {
  return getNodeBorderRadius(type, r) + 4;
}

export function MapNodeShape({
  type,
  status,
  accentColor,
  r,
  isActionable,
  onPress,
  testID,
}: MapNodeShapeProps) {
  const isComplete = status === "complete";
  const isNext     = status === "next";
  const isDim      = status === "placeholder";

  const icon = NODE_TYPE_ICON[type] ?? "star";
  const br   = getNodeBorderRadius(type, r);
  const obr  = getOuterRingBr(type, r);

  // ── Colours ──────────────────────────────────────────────────────────────

  const borderColor =
    isComplete ? accentColor :
    isNext     ? accentColor :
    isDim      ? accentColor + "35" :
                 accentColor + "60";

  const bgColor =
    isComplete ? accentColor + "30" :
    isNext     ? accentColor + "25" :
    isDim      ? accentColor + "08" :
                 accentColor + "12";

  const iconColor =
    isDim      ? accentColor + "45" :
    isComplete ? accentColor :
                 accentColor;

  const bw      = isComplete || isNext ? 2.5 : 1.5;
  const iconSize = Math.round(r * 0.72);
  const outerSz  = r * 2 + 10;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ width: r * 2, height: r * 2, alignItems: "center", justifyContent: "center" }}>
      {/* Outer decorative ring — dashed border */}
      {!isDim && (
        <View
          pointerEvents="none"
          style={{
            position:        "absolute",
            width:           outerSz,
            height:          outerSz,
            borderRadius:    obr,
            borderWidth:     1,
            borderColor:     borderColor + (isNext ? "80" : "40"),
            borderStyle:     "dashed",
            transform:       type === "battle" ? [{ rotate: "5deg" }] : [],
          }}
        />
      )}

      {/* Corner accent marks for shield/tower types */}
      {(type === "battle" || type === "ward_defense" || type === "mini_boss") && !isDim && (
        <>
          <View
            pointerEvents="none"
            style={{
              position:      "absolute",
              top:           0,
              left:          0,
              width:         8,
              height:        8,
              borderTopWidth: 2,
              borderLeftWidth: 2,
              borderColor:   accentColor + "90",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position:       "absolute",
              top:            0,
              right:          0,
              width:          8,
              height:         8,
              borderTopWidth: 2,
              borderRightWidth: 2,
              borderColor:    accentColor + "90",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position:        "absolute",
              bottom:          0,
              left:            0,
              width:           8,
              height:          8,
              borderBottomWidth: 2,
              borderLeftWidth:   2,
              borderColor:      accentColor + "90",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position:          "absolute",
              bottom:            0,
              right:             0,
              width:             8,
              height:            8,
              borderBottomWidth: 2,
              borderRightWidth:  2,
              borderColor:       accentColor + "90",
            }}
          />
        </>
      )}

      {/* Main node shape */}
      <Pressable
        style={{
          width:           r * 2,
          height:          r * 2,
          borderRadius:    br,
          borderWidth:     bw,
          borderColor,
          backgroundColor: bgColor,
          alignItems:      "center",
          justifyContent:  "center",
          overflow:        "hidden",
        }}
        onPress={isActionable && !isDim ? onPress : undefined}
        hitSlop={12}
        testID={testID}
      >
        {/* Inner glow for next node */}
        {isNext && (
          <View
            pointerEvents="none"
            style={{
              position:        "absolute",
              inset:           0,
              borderRadius:    br,
              backgroundColor: accentColor + "14",
            }}
          />
        )}

        {/* Icon or checkmark */}
        {isComplete ? (
          <View
            style={{
              width:           r * 1.1,
              height:          r * 1.1,
              borderRadius:    r,
              backgroundColor: accentColor + "25",
              alignItems:      "center",
              justifyContent:  "center",
            }}
          >
            <Ionicons name="checkmark" size={iconSize} color={accentColor} />
          </View>
        ) : (
          <Ionicons name={icon as any} size={iconSize} color={iconColor} />
        )}
      </Pressable>
    </View>
  );
}
