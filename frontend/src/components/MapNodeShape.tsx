/**
 * MapNodeShape — illustrated 2.5D map node using generated PNG icons.
 *
 * Each node type displays a unique painted icon badge (PNG asset).
 * Status is shown via frame glow, dimming, and overlay badges.
 *
 * Drop-in replacement for the old border-radius + Ionicons approach.
 */
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

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

// ── Node PNG assets ────────────────────────────────────────────────────────────

const NODE_ICON: Record<string, any> = {
  battle:          require("@/assets/map-nodes/node_battle.png"),
  mini_boss:       require("@/assets/map-nodes/node_miniboss.png"),
  ward_defense:    require("@/assets/map-nodes/node_ward_defense.png"),
  memory_fragment: require("@/assets/map-nodes/node_memory.png"),
  challenge:       require("@/assets/map-nodes/node_challenge.png"),
  reflection:      require("@/assets/map-nodes/node_reflection.png"),
  story:           require("@/assets/map-nodes/node_story.png"),
  reward:          require("@/assets/map-nodes/node_reward.png"),
  lesson:          require("@/assets/map-nodes/node_story.png"),
  realm:           require("@/assets/map-nodes/node_reward.png"),
  chain:           require("@/assets/map-nodes/node_challenge.png"),
  minigame:        require("@/assets/map-nodes/node_challenge.png"),
  mode_preview:    require("@/assets/map-nodes/node_story.png"),
};

const FALLBACK_ICON = require("@/assets/map-nodes/node_story.png");

// ── Exported icon map (used by legacy callers) ─────────────────────────────────
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
  mode_preview:    "compass",
  minigame:        "game-controller",
};

export function MapNodeShape({
  type,
  status,
  accentColor,
  r,
  isActionable,
  onPress,
  testID,
}: MapNodeShapeProps) {
  const icon   = NODE_ICON[type] ?? FALLBACK_ICON;
  const SIZE   = r * 2;
  const isLocked = status === "placeholder";
  const isDone   = status === "complete";
  const isNext   = status === "next";

  const frameGlowColor = isDone
    ? "#E8C868"
    : isNext
    ? accentColor
    : isLocked
    ? "#3A4A55"
    : accentColor + "80";

  const frameWidth = isDone ? 2.5 : isNext ? 2 : 1.5;

  return (
    <Pressable
      onPress={isActionable ? onPress : undefined}
      disabled={!isActionable}
      testID={testID}
      style={{
        width:          SIZE,
        height:         SIZE,
        alignItems:     "center",
        justifyContent: "center",
      }}
    >
      {/* Glow halo for next/active nodes */}
      {isNext && (
        <View
          style={{
            position:        "absolute",
            width:           SIZE + 20,
            height:          SIZE + 20,
            borderRadius:    (SIZE + 20) / 2,
            backgroundColor: accentColor + "28",
            top:             -10,
            left:            -10,
          }}
        />
      )}

      {/* Outer frame ring */}
      <View
        style={{
          width:           SIZE,
          height:          SIZE,
          borderRadius:    SIZE / 2,
          borderWidth:     frameWidth,
          borderColor:     frameGlowColor,
          alignItems:      "center",
          justifyContent:  "center",
          backgroundColor: isLocked ? "#0B1825CC" : "#0B182590",
          overflow:        "hidden",
        }}
      >
        {/* PNG icon */}
        <Image
          source={icon}
          style={{
            width:   SIZE * 0.82,
            height:  SIZE * 0.82,
            opacity: isLocked ? 0.3 : isDone ? 0.95 : 1,
          }}
          contentFit="contain"
        />

        {/* Locked dim overlay */}
        {isLocked && (
          <View
            style={{
              position:        "absolute",
              inset:           0,
              backgroundColor: "#0B1825AA",
              alignItems:      "center",
              justifyContent:  "center",
            }}
          />
        )}
      </View>

      {/* Complete — gold star badge */}
      {isDone && (
        <View
          style={{
            position:        "absolute",
            bottom:          -4,
            right:           -4,
            backgroundColor: "#E8C868",
            borderRadius:    8,
            width:           16,
            height:          16,
            alignItems:      "center",
            justifyContent:  "center",
            shadowColor:     "#E8C868",
            shadowOpacity:   0.9,
            shadowRadius:    4,
            elevation:       4,
          }}
        >
          <Text style={{ fontSize: 8, color: "#0B1020", fontWeight: "900" }}>✓</Text>
        </View>
      )}

      {/* Next — pulsing bottom tag */}
      {isNext && isActionable && (
        <View
          style={{
            position:          "absolute",
            bottom:            -14,
            backgroundColor:   accentColor,
            borderRadius:      3,
            paddingHorizontal: 4,
            paddingVertical:   1,
          }}
        >
          <Text style={{ fontSize: 7, color: "#fff", fontWeight: "900", letterSpacing: 0.5 }}>▶</Text>
        </View>
      )}
    </Pressable>
  );
}
