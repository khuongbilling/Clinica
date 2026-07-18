/**
 * MapNodeShape — V5 illustrated 2.5D map node.
 *
 * Each node type displays a unique transparent-bg illustrated PNG.
 * The PNG IS the node — no circle container, no square icon box.
 *
 * Node type → illustrated asset mapping:
 *   memory_fragment / story         → Glowing lotus memory shard
 *   challenge / chain / minigame    → Triage assessment desk + cue cards
 *   battle / ward_defense / arena   → Healer ward gate archway
 *   stabilize / realm               → Protected ward cot + shield glow
 *   reflection / lesson / community → Open lotus journal scroll
 *   mini_boss                       → Corrupted lotus gate with dark seal
 *   reward                          → Ornate medical supply chest
 *
 * Visual states:
 *   locked       → ghost mist (opacity 0.18) + small LOCKED pill
 *   available    → full opacity, no container ring
 *   next/current → outer glow ring + accent border + ▶ START tag
 *   complete     → softly dimmed (0.88) + gold ✦ lotus seal badge
 *
 * Boss/trial (mini_boss): crimson dual-aura ring; layout data already
 * gives boss nodes a larger r value so no size override needed here.
 */
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

export type MapNodeStatus = "complete" | "next" | "available" | "placeholder";

interface MapNodeShapeProps {
  type:         string;
  status:       MapNodeStatus;
  accentColor:  string;
  r:            number;
  isActionable: boolean;
  onPress?:     () => void;
  testID?:      string;
}

// ── V5 illustrated node PNG assets ───────────────────────────────────────────
// All PNGs were generated with removeBackground:true → transparent bg.
// The illustration IS the node shape; no circular container is drawn.

const NODE_ICON: Record<string, ReturnType<typeof require>> = {
  // Memory nodes → Glowing lotus memory shard
  memory_fragment: require("@/assets/map-nodes/node_memory_lotus_shard.png"),
  story:           require("@/assets/map-nodes/node_memory_lotus_shard.png"),

  // Rapid Triage / Challenge → Assessment desk with cue cards + magnifier
  challenge:       require("@/assets/map-nodes/node_rapid_triage_assessment_desk.png"),
  chain:           require("@/assets/map-nodes/node_rapid_triage_assessment_desk.png"),
  minigame:        require("@/assets/map-nodes/node_rapid_triage_assessment_desk.png"),

  // Ward Shift / Battle → Healer ward gate archway
  battle:          require("@/assets/map-nodes/node_ward_shift_gate.png"),
  ward_defense:    require("@/assets/map-nodes/node_ward_shift_gate.png"),
  mode_preview:    require("@/assets/map-nodes/node_ward_shift_gate.png"),
  arena:           require("@/assets/map-nodes/node_ward_shift_gate.png"),

  // Stabilize / Support → Protected ward cot + shield glow
  stabilize:       require("@/assets/map-nodes/node_stabilize_ward_shield.png"),
  realm:           require("@/assets/map-nodes/node_stabilize_ward_shield.png"),

  // Reflection / Lesson → Open lotus journal scroll
  reflection:      require("@/assets/map-nodes/node_reflection_lotus_journal.png"),
  lesson:          require("@/assets/map-nodes/node_reflection_lotus_journal.png"),
  community:       require("@/assets/map-nodes/node_reflection_lotus_journal.png"),

  // Trial / Boss → Corrupted lotus gate with dark miasma seal
  mini_boss:       require("@/assets/map-nodes/node_trial_corrupted_gate.png"),

  // Reward → Ornate medical supply chest
  reward:          require("@/assets/map-nodes/node_reward_medical_chest.png"),
};

const FALLBACK_ICON = require("@/assets/map-nodes/node_reflection_lotus_journal.png");

// ── Ionicon names kept for legacy callers (not used in V5 rendering) ──────────
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

// ── Component ─────────────────────────────────────────────────────────────────

export function MapNodeShape({
  type,
  status,
  accentColor,
  r,
  isActionable,
  onPress,
  testID,
}: MapNodeShapeProps) {
  const icon     = NODE_ICON[type] ?? FALLBACK_ICON;
  const SIZE     = r * 2;
  const isBoss   = type === "mini_boss";
  const isLocked = status === "placeholder";
  const isDone   = status === "complete";
  const isNext   = status === "next";

  // Boss nodes use dark crimson glow; others use per-chapter accent
  const glowColor = isBoss ? "#C0392B" : accentColor;

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
      {/* ── Boss: wide dark aura ring (always for mini_boss when not locked) ── */}
      {isBoss && !isLocked && (
        <View
          style={{
            position:        "absolute",
            width:           SIZE + 48,
            height:          SIZE + 48,
            borderRadius:    (SIZE + 48) / 2,
            borderWidth:     1,
            borderColor:     "#C0392B38",
            backgroundColor: "#C0392B0A",
            top:             -24,
            left:            -24,
            pointerEvents:   "none",
          } as any}
        />
      )}

      {/* ── Next/current OR boss: inner glow ring ── */}
      {(isNext || (isBoss && !isLocked)) && (
        <View
          style={{
            position:        "absolute",
            width:           SIZE + 26,
            height:          SIZE + 26,
            borderRadius:    (SIZE + 26) / 2,
            borderWidth:     2,
            borderColor:     glowColor + "88",
            backgroundColor: glowColor + "16",
            top:             -13,
            left:            -13,
            pointerEvents:   "none",
          } as any}
        />
      )}

      {/* ── Main illustrated 2.5D node — the art IS the node ── */}
      <Image
        source={icon}
        style={{
          width:   SIZE,
          height:  SIZE,
          opacity: isLocked ? 0.18 : isDone ? 0.88 : 1,
        }}
        contentFit="contain"
      />

      {/* ── LOCKED: ghost mist pill with lock icon ── */}
      {isLocked && (
        <View
          style={{
            position:          "absolute",
            bottom:            2,
            alignSelf:         "center",
            backgroundColor:   "#1A2A3A99",
            borderRadius:      8,
            paddingHorizontal: 5,
            paddingVertical:   2,
            flexDirection:     "row",
            alignItems:        "center",
            gap:               3,
            pointerEvents:     "none",
          } as any}
        >
          <Ionicons name="lock-closed" size={7} color="#8AABB8" />
          <Text style={{
            fontSize:    6,
            color:       "#8AABB8",
            fontWeight:  "700",
            letterSpacing: 0.3,
          }}>
            LOCKED
          </Text>
        </View>
      )}

      {/* ── COMPLETE: gold lotus seal badge ── */}
      {isDone && (
        <View
          style={{
            position:        "absolute",
            bottom:          -4,
            right:           -4,
            width:           22,
            height:          22,
            borderRadius:    11,
            backgroundColor: "#E8C868",
            alignItems:      "center",
            justifyContent:  "center",
            shadowColor:     "#E8C868",
            shadowOpacity:   0.95,
            shadowRadius:    6,
            elevation:       6,
            pointerEvents:   "none",
          } as any}
        >
          <Text style={{
            fontSize:   11,
            color:      "#0B1020",
            fontWeight: "900",
            lineHeight: 14,
          }}>
            ✦
          </Text>
        </View>
      )}

      {/* ── NEXT/CURRENT: ▶ START play tag below node ── */}
      {isNext && isActionable && (
        <View
          style={{
            position:          "absolute",
            bottom:            -18,
            backgroundColor:   accentColor,
            borderRadius:      4,
            paddingHorizontal: 6,
            paddingVertical:   2,
            flexDirection:     "row",
            alignItems:        "center",
            pointerEvents:     "none",
          } as any}
        >
          <Text style={{
            fontSize:     7,
            color:        "#fff",
            fontWeight:   "900",
            letterSpacing: 0.5,
          }}>
            ▶ START
          </Text>
        </View>
      )}
    </Pressable>
  );
}
