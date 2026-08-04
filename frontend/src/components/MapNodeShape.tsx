/**
 * MapNodeShape — V6 illustrated 2.5D map node.
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
 *   next/current → soft radial glow bloom + ▶ START tag
 *   complete     → softly dimmed (0.88) + gold ✦ lotus seal badge
 *
 * V6 changes:
 *   · UI elements (labels, badges, tags) scale proportionally with r
 *   · "next" node gets a soft radial glow bloom behind the PNG art
 *   · No decorative rings/circles anywhere (removed in V5)
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

// ── Node type label shown at bottom of each illustrated icon ─────────────────
const NODE_LABEL: Record<string, string> = {
  battle:          "Ward Shift",
  mini_boss:       "Boss Trial",
  ward_defense:    "Defense",
  memory_fragment: "Memory",
  challenge:       "Challenge",
  reflection:      "Reflection",
  story:           "Story",
  reward:          "Reward",
  lesson:          "Lesson",
  realm:           "Realm",
  chain:           "Chain",
  mode_preview:    "Mode",
  minigame:        "Minigame",
  stabilize:       "Stabilize",
  community:       "Community",
  arena:           "Arena",
};

// ── Ionicon names kept for legacy callers (not used in V6 rendering) ──────────
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

  // Ink & Mist: boss nodes use dark crimson, others use gold
  const INK_GOLD  = "#D4A853";
  const glowColor = isBoss ? "#C0392B" : INK_GOLD;

  // ── Scale UI elements proportionally with node size ──────────────────────
  // Base reference: r=44 → label font 10, badge 28, lock icon 10, start font 9
  const scale      = r / 44;
  const labelFont  = Math.round(10 * scale);
  const labelPadH  = Math.round(7  * scale);
  const labelPadV  = Math.round(3  * scale);
  const labelRad   = Math.round(6  * scale);
  const badgeSize  = Math.round(28 * scale);
  const badgeFont  = Math.round(14 * scale);
  const lockIcon   = Math.max(8, Math.round(10 * scale));
  const lockFont   = Math.max(7, Math.round(8  * scale));
  const startFont  = Math.round(9  * scale);
  const startPadH  = Math.round(8  * scale);
  const startPadV  = Math.round(3  * scale);
  const startBelow = Math.round(22 * scale);
  const badgeOff   = Math.round(6  * scale);

  // Glow bloom size behind "next" node (larger soft halo, not a ring)
  const bloomSize  = SIZE + Math.round(36 * scale);

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
      {/* ── NEXT: soft radial glow bloom behind art (Ink & Mist gold pulse) ── */}
      {isNext && (
        <View
          style={{
            position:      "absolute",
            width:         bloomSize,
            height:        bloomSize,
            borderRadius:  bloomSize / 2,
            backgroundColor: glowColor + "30",
            left:          (SIZE - bloomSize) / 2,
            top:           (SIZE - bloomSize) / 2,
            pointerEvents: "none",
          } as any}
        />
      )}
      {isNext && (
        <View
          style={{
            position:      "absolute",
            width:         SIZE + Math.round(16 * scale),
            height:        SIZE + Math.round(16 * scale),
            borderRadius:  (SIZE + Math.round(16 * scale)) / 2,
            backgroundColor: glowColor + "20",
            left:          -Math.round(8 * scale),
            top:           -Math.round(8 * scale),
            pointerEvents: "none",
          } as any}
        />
      )}

      {/* ── Ink-seal backing circle (Ink & Mist umber fill + gold border) ── */}
      <View
        style={{
          position:        "absolute",
          width:           SIZE * 0.94,
          height:          SIZE * 0.94,
          borderRadius:    SIZE * 0.94 / 2,
          left:            SIZE * 0.03,
          top:             SIZE * 0.03,
          backgroundColor: isLocked ? "#1a100822" : isDone ? "#3d220844" : isNext ? "#2a1a0840" : "#20140830",
          borderWidth:     isDone ? 1.5 : 1,
          borderColor:     isDone ? "#D4A853AA" : isNext ? "#D4A85366" : isLocked ? "#3d2a1444" : "#D4A85328",
          pointerEvents:   "none",
        } as any}
      />
      {/* ── Concentric ink ring 1 ── */}
      {!isLocked && (
        <View
          style={{
            position:     "absolute",
            width:        SIZE * 0.74,
            height:       SIZE * 0.74,
            borderRadius: SIZE * 0.74 / 2,
            left:         SIZE * 0.13,
            top:          SIZE * 0.13,
            borderWidth:  0.8,
            borderColor:  isDone ? "#D4A85355" : "#D4A85522",
            pointerEvents: "none",
          } as any}
        />
      )}
      {/* ── Concentric ink ring 2 ── */}
      {!isLocked && (
        <View
          style={{
            position:     "absolute",
            width:        SIZE * 0.54,
            height:       SIZE * 0.54,
            borderRadius: SIZE * 0.54 / 2,
            left:         SIZE * 0.23,
            top:          SIZE * 0.23,
            borderWidth:  0.8,
            borderColor:  isDone ? "#D4A85340" : "#D4A85518",
            pointerEvents: "none",
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

      {/* ── LOCKED: umber ghost mist pill with lock icon ── */}
      {isLocked && (
        <View
          style={{
            position:          "absolute",
            bottom:            2,
            alignSelf:         "center",
            backgroundColor:   "#2A180E99",
            borderRadius:      labelRad,
            borderWidth:       1,
            borderColor:       "#5a3a2044",
            paddingHorizontal: labelPadH,
            paddingVertical:   labelPadV,
            flexDirection:     "row",
            alignItems:        "center",
            gap:               3,
            pointerEvents:     "none",
          } as any}
        >
          <Ionicons name="lock-closed" size={lockIcon} color="#8A6A44" />
          <Text style={{
            fontSize:      lockFont,
            color:         "#8A6A44",
            fontWeight:    "700",
            letterSpacing: 0.3,
          }}>
            LOCKED
          </Text>
        </View>
      )}

      {/* ── Node type label — caption band at bottom of art ── */}
      {!isLocked && (
        <View
          style={{
            position:          "absolute",
            bottom:            labelPadV + 2,
            alignSelf:         "center",
            backgroundColor:   "rgba(0,0,0,0.62)",
            borderRadius:      labelRad,
            paddingHorizontal: labelPadH,
            paddingVertical:   labelPadV,
            pointerEvents:     "none",
          } as any}
        >
          <Text
            style={{
              fontSize:      labelFont,
              fontWeight:    "800",
              letterSpacing: 0.8,
              color:         isDone ? accentColor + "BB" : accentColor,
              textTransform: "uppercase" as const,
            }}
            numberOfLines={1}
          >
            {NODE_LABEL[type] ?? type.replace(/_/g, " ")}
          </Text>
        </View>
      )}

      {/* ── COMPLETE: Ink & Mist gold lotus seal badge ── */}
      {isDone && (
        <View
          style={{
            position:        "absolute",
            bottom:          -badgeOff,
            right:           -badgeOff,
            width:           badgeSize,
            height:          badgeSize,
            borderRadius:    badgeSize / 2,
            backgroundColor: "#D4A853",
            borderWidth:     1,
            borderColor:     "#F0D888",
            alignItems:      "center",
            justifyContent:  "center",
            pointerEvents:   "none",
          } as any}
        >
          <Text style={{
            fontSize:   badgeFont,
            color:      "#1a0e06",
            fontWeight: "900",
            lineHeight: badgeFont * 1.2,
          }}>
            ✦
          </Text>
        </View>
      )}

      {/* ── NEXT/CURRENT: ▶ START play tag below node — Ink & Mist gold ── */}
      {isNext && isActionable && (
        <View
          style={{
            position:          "absolute",
            bottom:            -startBelow,
            backgroundColor:   "#D4A853",
            borderRadius:      5,
            borderWidth:       1,
            borderColor:       "#F0D888",
            paddingHorizontal: startPadH,
            paddingVertical:   startPadV,
            flexDirection:     "row",
            alignItems:        "center",
            pointerEvents:     "none",
          } as any}
        >
          <Text style={{
            fontSize:      startFont,
            color:         "#1a0e06",
            fontWeight:    "900",
            letterSpacing: 0.6,
          }}>
            ▶ START
          </Text>
        </View>
      )}
    </Pressable>
  );
}
