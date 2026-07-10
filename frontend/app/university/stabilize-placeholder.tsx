/**
 * Stabilize Stack — The Fading Apprentice
 *
 * University mini-game: tap-to-order puzzle.
 * Player builds a 3-action care chain by tapping tiles in the correct order.
 *
 * Correct sequence (either order for first two):
 *   1. Check vitals | Assess mental status
 *   2. The other of the pair above
 *   3. Offer oral fluids if safe
 *
 * Tutorial: stabilizeIntro (global system, forced once).
 *   Step 1 — center dialogue: "Act in order. First, check how unstable the patient is."
 *   Step 2 — requireAction: highlight action_assess_mental_status
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { playRewardCue } from "@/src/game/cues";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { useTutorial, useHighlightTarget } from "@/src/game/tutorialStore";
import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type ActionId =
  | "action_check_vitals"
  | "action_assess_mental"
  | "action_offer_fluids"
  | "action_give_medication"
  | "action_send_back"
  | "action_ignore"
  | "action_reassess";

interface ActionTileDef {
  id: ActionId;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accent: string;
  bg: string;
  targetId: string;
  wrongMsg?: string;
}

const FIRST_PAIR: ActionId[] = ["action_check_vitals", "action_assess_mental"];

const TILES: ActionTileDef[] = [
  {
    id: "action_check_vitals",
    label: "Check vitals",
    icon: "pulse-outline",
    accent: "#38BDF8",
    bg: "#38BDF810",
    targetId: "action_check_vitals",
  },
  {
    id: "action_assess_mental",
    label: "Assess mental status",
    icon: "scan-outline",
    accent: "#A78BFA",
    bg: "#A78BFA10",
    targetId: "action_assess_mental_status",
  },
  {
    id: "action_offer_fluids",
    label: "Offer oral fluids if safe",
    icon: "water-outline",
    accent: "#2DD4BF",
    bg: "#2DD4BF10",
    targetId: "action_offer_fluids",
    wrongMsg: "Confirm she can swallow safely first.",
  },
  {
    id: "action_give_medication",
    label: "Give random medication",
    icon: "medkit-outline",
    accent: "#EF4444",
    bg: "#EF444410",
    targetId: "action_give_medication",
    wrongMsg: "Assess first — never medicate without knowing what's wrong.",
  },
  {
    id: "action_send_back",
    label: "Send back to training",
    icon: "arrow-undo-outline",
    accent: "#EF4444",
    bg: "#EF444410",
    targetId: "action_send_back",
    wrongMsg: "She needs attention, not dismissal.",
  },
  {
    id: "action_ignore",
    label: "Ignore symptoms",
    icon: "eye-off-outline",
    accent: "#F59E0B",
    bg: "#F59E0B10",
    targetId: "action_ignore",
    wrongMsg: "Ignoring symptoms risks a collapse. Always check first.",
  },
  {
    id: "action_reassess",
    label: "Reassess after fluids",
    icon: "refresh-circle-outline",
    accent: "#F59E0B",
    bg: "#F59E0B10",
    targetId: "action_reassess",
    wrongMsg: "Reassess comes after treatment, not before.",
  },
];

const STABILITY_START = 38;
const STABILITY_CORRECT_GAIN = 21;
const STABILITY_WRONG_LOSS = 9;

// ─────────────────────────────────────────────────────────────────────────────
// getWrongMsg — context-aware correction text
// ─────────────────────────────────────────────────────────────────────────────
function getWrongMsg(tile: ActionTileDef, chainLen: number): string {
  if (tile.wrongMsg) return tile.wrongMsg;
  if (tile.id === "action_offer_fluids") return "Assess stability first, then offer fluids.";
  if (tile.id === "action_check_vitals" && chainLen === 1)
    return "Good — check vitals next.";
  if (tile.id === "action_assess_mental" && chainLen === 1)
    return "Good — assess mental status next.";
  return "That order can harm the patient. Think — what must you know first?";
}

// ─────────────────────────────────────────────────────────────────────────────
// isCorrectTap
// ─────────────────────────────────────────────────────────────────────────────
function isCorrectTap(chain: ActionId[], id: ActionId): boolean {
  const pos = chain.length;
  if (pos === 0) return FIRST_PAIR.includes(id);
  if (pos === 1) return FIRST_PAIR.includes(id) && !chain.includes(id);
  if (pos === 2) return id === "action_offer_fluids";
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionTile — own component so useHighlightTarget hooks at top level
// ─────────────────────────────────────────────────────────────────────────────
interface ActionTileProps {
  tile: ActionTileDef;
  inChain: boolean;
  disabled: boolean;
  isShaking: boolean;
  shakeAnim: Animated.Value;
  onPress: (tile: ActionTileDef) => void;
}

function ActionTile({ tile, inChain, disabled, isShaking, shakeAnim, onPress }: ActionTileProps) {
  const { isHighlighted, onTargetPress, highlightStyle } =
    useHighlightTarget(tile.targetId);

  const handlePress = useCallback(() => {
    if (disabled || inChain) return;
    if (isHighlighted) onTargetPress();
    onPress(tile);
  }, [disabled, inChain, isHighlighted, onTargetPress, onPress, tile]);

  return (
    <Animated.View
      style={[
        isShaking && { transform: [{ translateX: shakeAnim }] },
      ]}
    >
      <Pressable
        style={({ pressed }) => [
          styles.tile,
          { backgroundColor: tile.bg, borderColor: tile.accent + "40" },
          inChain && styles.tileInChain,
          inChain && { borderColor: tile.accent + "88" },
          isHighlighted && highlightStyle,
          pressed && !disabled && !inChain && { opacity: 0.78 },
        ]}
        onPress={handlePress}
        disabled={disabled && !isHighlighted}
        testID={tile.targetId}
      >
        <View style={[styles.tileIcon, { backgroundColor: tile.accent + "18" }]}>
          <Ionicons
            name={inChain ? "checkmark" : tile.icon}
            size={18}
            color={inChain ? "#22C55E" : tile.accent}
          />
        </View>
        <Text
          style={[
            styles.tileLabel,
            { color: inChain ? COLORS.onSurfaceTertiary : tile.accent },
          ]}
          numberOfLines={2}
        >
          {tile.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainSlot
// ─────────────────────────────────────────────────────────────────────────────
function ChainSlot({ index, filledTile }: { index: number; filledTile?: ActionTileDef }) {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (filledTile) {
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.7, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      glowAnim.setValue(0);
    }
  }, [filledTile]);

  const glowStyle = filledTile
    ? {
        opacity: glowAnim,
        borderColor: filledTile.accent,
        backgroundColor: filledTile.bg,
      }
    : {};

  return (
    <Animated.View style={[styles.chainSlot, glowStyle]}>
      {filledTile ? (
        <>
          <Ionicons name={filledTile.icon} size={14} color={filledTile.accent} />
          <Text style={[styles.chainSlotLabel, { color: filledTile.accent }]} numberOfLines={1}>
            {filledTile.label}
          </Text>
          <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
        </>
      ) : (
        <Text style={styles.chainSlotEmpty}>{index + 1}</Text>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function StabilizeStackScreen() {
  const router = useRouter();
  const { startTutorial, isCompleted, activeTutorialId } = useTutorial();

  const [chain, setChain] = useState<ActionId[]>([]);
  const [stability, setStability] = useState(STABILITY_START);
  const [feedback, setFeedback] = useState<{ text: string; correct: boolean } | null>(null);
  const [shakingId, setShakingId] = useState<ActionId | null>(null);
  const [completed, setCompleted] = useState(false);

  const stabilityAnim = useRef(new Animated.Value(STABILITY_START)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const feedbackFade = useRef(new Animated.Value(0)).current;
  const completeFade = useRef(new Animated.Value(0)).current;

  // Tutorial — auto-start once after 600ms hydration guard
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isCompleted("stabilizeIntro") && !activeTutorialId) {
        startTutorial("stabilizeIntro");
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stability bar animation
  const animateStability = useCallback(
    (next: number) => {
      Animated.timing(stabilityAnim, {
        toValue: Math.max(5, Math.min(100, next)),
        duration: 420,
        useNativeDriver: false,
      }).start();
    },
    [stabilityAnim],
  );

  // Feedback fade
  useEffect(() => {
    Animated.timing(feedbackFade, {
      toValue: feedback ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [feedback, feedbackFade]);

  // Shake helper
  const runShake = useCallback(
    (id: ActionId) => {
      setShakingId(id);
      shakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 9, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -9, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 7, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -5, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start(() => setShakingId(null));
    },
    [shakeAnim],
  );

  // Tile tap handler
  const handleTileTap = useCallback(
    (tile: ActionTileDef) => {
      if (feedback || completed || chain.includes(tile.id as ActionId)) return;

      const correct = isCorrectTap(chain, tile.id as ActionId);

      if (correct) {
        playRewardCue();
        const nextChain = [...chain, tile.id as ActionId];
        setChain(nextChain);
        const nextStab = Math.min(100, stability + STABILITY_CORRECT_GAIN);
        setStability(nextStab);
        animateStability(nextStab);
        setFeedback(null);

        if (nextChain.length === 3) {
          // Puzzle complete
          setCompleted(true);
          Animated.timing(completeFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
          setTimeout(() => {
            router.replace("/university/stabilize-complete" as any);
          }, 2000);
        }
      } else {
        runShake(tile.id as ActionId);
        const nextStab = Math.max(5, stability - STABILITY_WRONG_LOSS);
        setStability(nextStab);
        animateStability(nextStab);
        setFeedback({ text: getWrongMsg(tile, chain.length), correct: false });
        setTimeout(() => setFeedback(null), 2600);
      }
    },
    [feedback, completed, chain, stability, animateStability, runShake, completeFade, router],
  );

  // Tutorial active → lock all tiles not highlighted
  const tutorialActive = !!activeTutorialId;

  const barWidth = stabilityAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  const stabilityColor = stability >= 70 ? "#22C55E" : stability >= 40 ? "#F59E0B" : "#EF4444";

  const tileMap = Object.fromEntries(TILES.map((t) => [t.id, t]));

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Sky-blue-teal gradient — distinct from purple Triage */}
      <LinearGradient
        colors={["#0A1C2E", "#071420", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/university")}
          hitSlop={10}
          testID="stabilize-back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.kicker}>STABILIZE STACK</Text>
          <Text style={styles.subtitle}>The Fading Apprentice</Text>
        </View>
        <Text style={styles.chainCounter}>{chain.length}/3</Text>
      </View>

      {/* ── PATIENT PANEL ──────────────────────────────────────────────── */}
      <View style={styles.patientPanel}>
        <LinearGradient
          colors={["#0F2236", "#091A2B"]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.avatarWrap}>
          <Ionicons name="person" size={28} color="#38BDF8" />
        </View>
        <View style={styles.patientInfo}>
          <Text style={styles.patientRole}>APPRENTICE · Ward Trainee</Text>
          <Text style={styles.patientPrompt}>
            Dizzy and weak after training. Choose your first three actions.
          </Text>
        </View>
      </View>

      {/* ── STABILITY BAR ──────────────────────────────────────────────── */}
      <View style={styles.stabilityRow}>
        <Text style={styles.stabilityLabel}>STABILITY</Text>
        <View style={styles.stabilityTrack}>
          <Animated.View
            style={[
              styles.stabilityFill,
              { width: barWidth, backgroundColor: stabilityColor },
            ]}
          />
        </View>
        <Text style={[styles.stabilityPct, { color: stabilityColor }]}>{stability}%</Text>
      </View>

      {/* ── CARE CHAIN ─────────────────────────────────────────────────── */}
      <View style={styles.chainRow}>
        {[0, 1, 2].map((i) => (
          <ChainSlot key={i} index={i} filledTile={chain[i] ? tileMap[chain[i]] : undefined} />
        ))}
      </View>

      {/* ── FEEDBACK STRIP ─────────────────────────────────────────────── */}
      <Animated.View
        style={[styles.feedbackStrip, { opacity: feedbackFade }]}
        pointerEvents="none"
      >
        {feedback && (
          <>
            <Ionicons name="information-circle" size={13} color="#F59E0B" />
            <Text style={styles.feedbackTxt}>{feedback.text}</Text>
          </>
        )}
      </Animated.View>

      {/* ── ACTION TILES ───────────────────────────────────────────────── */}
      <ScrollView
        style={styles.tilesScroll}
        contentContainerStyle={styles.tilesGrid}
        showsVerticalScrollIndicator={false}
      >
        {TILES.map((tile, idx) => (
          <View key={tile.id} style={idx === TILES.length - 1 && TILES.length % 2 !== 0 ? styles.tileFullWidth : styles.tileHalf}>
            <ActionTile
              tile={tile}
              inChain={chain.includes(tile.id as ActionId)}
              disabled={tutorialActive || completed}
              isShaking={shakingId === tile.id}
              shakeAnim={shakeAnim}
              onPress={handleTileTap}
            />
          </View>
        ))}
      </ScrollView>

      {/* ── COMPLETE OVERLAY ───────────────────────────────────────────── */}
      <Animated.View
        style={[styles.completeOverlay, { opacity: completeFade }]}
        pointerEvents={completed ? "auto" : "none"}
      >
        <LinearGradient
          colors={["#071420EE", "#0A1C2EEE"]}
          style={StyleSheet.absoluteFillObject}
        />
        <Ionicons name="shield-checkmark" size={52} color="#22C55E" />
        <Text style={styles.completeTxt}>Patient Stabilised</Text>
        <Text style={styles.completeSubTxt}>Good order — assess before you treat.</Text>
      </Animated.View>

      {/* Tutorial overlay (global, System-voiced) */}
      <TutorialOverlay />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, gap: 1 },
  kicker: { color: "#38BDF8", fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  subtitle: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: "300" },
  chainCounter: { color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: "700" },

  // Patient panel
  patientPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#38BDF820",
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    overflow: "hidden",
  },
  avatarWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#38BDF814",
    borderWidth: 1, borderColor: "#38BDF830",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  patientInfo: { flex: 1, gap: 3 },
  patientRole: { color: "#38BDF8", fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  patientPrompt: {
    color: COLORS.onSurface,
    fontSize: 13, lineHeight: 18, fontWeight: "300",
  },

  // Stability
  stabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  stabilityLabel: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10, fontWeight: "700", letterSpacing: 1.5,
    width: 66,
  },
  stabilityTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: "#1E2A38",
    overflow: "hidden",
  },
  stabilityFill: { height: "100%", borderRadius: 4 },
  stabilityPct: { fontSize: 11, fontWeight: "700", width: 36, textAlign: "right" },

  // Care chain
  chainRow: {
    flexDirection: "row",
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  chainSlot: {
    flex: 1, flexDirection: "row", alignItems: "center",
    gap: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5, borderColor: "#2A3A4A",
    borderStyle: "dashed",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    minHeight: 44,
  },
  chainSlotLabel: { flex: 1, fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
  chainSlotEmpty: { color: "#2A3A4A", fontSize: 13, fontWeight: "700", margin: "auto" as any },

  // Feedback
  feedbackStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 6,
    minHeight: 32,
  },
  feedbackTxt: {
    color: "#F59E0B",
    fontSize: 12, fontWeight: "600", lineHeight: 16, flex: 1,
  },

  // Tiles
  tilesScroll: { flex: 1 },
  tilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  tileHalf: { width: "47.5%" },
  tileFullWidth: { width: "100%" },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    padding: SPACING.md,
    minHeight: 60,
  },
  tileInChain: {
    opacity: 0.5,
  },
  tileIcon: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  tileLabel: {
    flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 16,
  },

  // Complete overlay
  completeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  completeTxt: {
    color: "#22C55E",
    fontSize: 24, fontWeight: "700", letterSpacing: 0.3,
  },
  completeSubTxt: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 14, fontWeight: "300",
    textAlign: "center",
    paddingHorizontal: SPACING.xxl,
  },
});
