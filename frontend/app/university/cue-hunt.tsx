/**
 * Cue Hunt — The Fading Apprentice
 *
 * A visual patient scene where the player taps clinical clues hidden in a
 * hand-drawn donghua Lotus-infirmary illustration (single painted image; the
 * dehydration cues — dry lips, sweat, weak posture, empty tipped flask — are
 * part of the art itself). Chibi art appears ONLY as small feedback accents.
 *
 * Required clues (3):   dry_lips · weak_posture · water_flask
 * Distractors (3):      window · books · scroll
 *
 * Tutorial: cueHuntIntro (forced, System-narrated). Step 1 primes the player
 * with "Before you treat, learn to see. Tap the dry lips." Step 2 blocks all
 * taps via TutorialOverlay scrim and highlights only clue_dry_lips (zIndex 9500).
 */

import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { RewardBurst } from "@/src/components/university/RewardBurst";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { playRewardCue } from "@/src/game/cues";
import { markChainStep, checkAndMarkFirstPerfect, getChainProgress } from "@/src/game/chainProgress";
import { useTutorial, useHighlightTarget } from "@/src/game/tutorialStore";
import { useBlockBack } from "@/src/hooks/useBlockBack";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { usePlayer } from "@/src/game/store";
import { MilestoneRewardItem } from "@/src/components/onboarding/MilestoneReward";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { completeObjective } from "@/src/game/objectiveProgress";
import { playerLevelFromXp } from "@/src/game/progression";

// ─────────────────────────────────────────────────────────────────────────────
// Zone definitions
// All positions are FRACTIONS OF scW (scene width), not percentages of scH.
// scH is always scW * SCENE_RATIO. Using a single linear unit keeps the layout
// pixel-perfect regardless of actual screen size.
// ─────────────────────────────────────────────────────────────────────────────

// Aspect-locked to the scene illustration's EXACT pixel ratio (896×1280).
// If the image is ever regenerated at other dimensions, update this ratio
// AND re-measure every ZONES entry against the new art.
const SCENE_RATIO = 1280 / 896; // scH = scW * SCENE_RATIO ≈ 1.4286
const REQUIRED_COUNT = 3;

interface ZoneDef {
  id: string;
  label: string;
  feedback: string;
  isRequired: boolean;
  cx: number; // center x as fraction of scW
  cy: number; // center y as fraction of scW  (NOT scH)
  r: number;  // radius as fraction of scW
  color: string;
}

const ZONES: readonly ZoneDef[] = [
  // ── Required ─────────────────────────────────────────────────────────────
  {
    id: "clue_dry_lips",
    label: "Dry lips",
    feedback: "Cracked and pale — dehydration sign.",
    isRequired: true,
    cx: 0.500, cy: 0.850, r: 0.062,
    color: "#2DD4BF",
  },
  {
    id: "clue_weak_posture",
    label: "Weak posture",
    feedback: "Slumped shoulders — low energy, muscle weakness.",
    isRequired: true,
    cx: 0.500, cy: 1.010, r: 0.100,
    color: "#2DD4BF",
  },
  {
    id: "clue_water_flask",
    label: "Empty flask",
    feedback: "Almost empty — not been drinking enough.",
    isRequired: true,
    cx: 0.868, cy: 0.800, r: 0.085,
    color: "#D4AF37",
  },
  // ── Distractors ───────────────────────────────────────────────────────────
  {
    id: "distractor_window",
    label: "",
    feedback: "",
    isRequired: false,
    cx: 0.492, cy: 0.255, r: 0.115,
    color: "#F59E0B",
  },
  {
    id: "distractor_books",
    label: "",
    feedback: "",
    isRequired: false,
    cx: 0.110, cy: 0.995, r: 0.088,
    color: "#7C3AED",
  },
  {
    id: "distractor_scroll",
    label: "",
    feedback: "",
    isRequired: false,
    cx: 0.078, cy: 1.205, r: 0.080,
    color: "#D97706",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ClueZone — single tappable zone in the scene
// ─────────────────────────────────────────────────────────────────────────────

interface ClueZoneProps {
  zone: ZoneDef;
  scW: number;
  found: boolean;
  onCorrect: (z: ZoneDef) => void;
  onWrong: () => void;
}

function ClueZone({ zone, scW, found, onCorrect, onWrong }: ClueZoneProps) {
  const { isHighlighted, isTutorialBlocked, onTargetPress } = useHighlightTarget(zone.id);

  const rPx = zone.r * scW;
  const dPx = rPx * 2;
  const leftPx = zone.cx * scW - rPx;
  const topPx = zone.cy * scW - rPx; // cy is also a fraction of scW

  // Pulse ring for unfound zones
  const pulse = useRef(new Animated.Value(0)).current;
  // One-shot glow burst on found
  const burstScale = useRef(new Animated.Value(1)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;
  // Shake for wrong taps
  const shakeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (found) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [found, pulse]);

  useEffect(() => {
    if (!found) return;
    burstScale.setValue(1);
    burstOpacity.setValue(0.85);
    Animated.parallel([
      Animated.spring(burstScale, { toValue: 2.5, speed: 3, useNativeDriver: true }),
      Animated.timing(burstOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, [found, burstScale, burstOpacity]);

  const handlePress = useCallback(() => {
    // Block wrong zones while a tutorial step requires a specific target.
    if (isTutorialBlocked) return;
    if (zone.isRequired) {
      // Advance the tutorial step first — even if the zone was already found
      // (pre-tapped before the 700ms tutorial-start delay). Without this guard
      // swap, a pre-found zone causes the tutorial to get permanently stuck.
      if (isHighlighted) onTargetPress();
      if (found) return;
      onCorrect(zone);
    } else {
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -8, duration: 48, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 8, duration: 48, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -5, duration: 48, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 5, duration: 48, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 48, useNativeDriver: true }),
      ]).start();
      onWrong();
    }
  }, [zone, found, isHighlighted, isTutorialBlocked, onTargetPress, onCorrect, onWrong, shakeX]);

  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.40] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.10] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: leftPx,
        top: topPx,
        width: dPx,
        height: dPx,
        transform: [{ translateX: shakeX }],
        zIndex: isHighlighted ? 9500 : 1,
      }}
    >
      {/* Glow burst — runs once on found */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: dPx, height: dPx, borderRadius: rPx,
          borderWidth: 2.5, borderColor: zone.color,
          transform: [{ scale: burstScale }],
          opacity: burstOpacity,
        }}
      />

      {/* Tutorial highlight aura — shown when this zone is the forced target */}
      {isHighlighted && !found && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: dPx + 16, height: dPx + 16,
            left: -8, top: -8,
            borderRadius: rPx + 8,
            borderWidth: 2.5, borderColor: "#2DD4BF",
            backgroundColor: "#2DD4BF14",
            shadowColor: "#2DD4BF",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.95,
            shadowRadius: 16,
          }}
        />
      )}

      {/* Pulsing ring — unfound, not highlighted */}
      {!found && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: dPx, height: dPx, borderRadius: rPx,
            borderWidth: isHighlighted ? 2.5 : 1.5,
            borderColor: isHighlighted ? "#2DD4BF" : zone.color,
            opacity: isHighlighted ? 0.88 : pulseOpacity,
            transform: [{ scale: isHighlighted ? 1.08 : pulseScale }],
          }}
        />
      )}

      {/* Solid ring + checkmark — found state */}
      {found && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: dPx, height: dPx, borderRadius: rPx,
            borderWidth: 2.5, borderColor: zone.color,
            backgroundColor: zone.color + "22",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="checkmark" size={dPx * 0.38} color={zone.color} />
        </View>
      )}

      {/* Hit area — transparent Pressable over the full zone */}
      <Pressable
        style={{
          position: "absolute",
          width: dPx, height: dPx, borderRadius: rPx,
        }}
        onPress={handlePress}
        testID={`zone-${zone.id}`}
      />

      {/* Label badge below the zone, visible when found */}
      {found && !!zone.label && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: dPx + 5,
            alignSelf: "center",
            backgroundColor: zone.color + "22",
            borderRadius: RADIUS.pill,
            borderWidth: 1, borderColor: zone.color + "55",
            paddingHorizontal: 7, paddingVertical: 3,
          }}
        >
          <Text
            style={{ color: zone.color, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}
          >
            {zone.label}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InfirmaryScene — the full visual room layout
// scW is the actual scene container width (in pixels). All positions use scW
// as the base unit. scH is implicit (= scW * SCENE_RATIO).
// ─────────────────────────────────────────────────────────────────────────────

interface SceneProps {
  scW: number;
  found: Set<string>;
  onCorrect: (z: ZoneDef) => void;
  onWrong: () => void;
}

function InfirmaryScene({ scW, found, onCorrect, onWrong }: SceneProps) {
  const U = scW; // base unit shorthand

  return (
    <View style={{ width: U, height: U * SCENE_RATIO, overflow: "hidden" }}>
      {/* ══════════════════════════════════════════════════════════════
          HAND-DRAWN DONGHUA SCENE ILLUSTRATION
          A single painted donghua illustration (896×1280) of the Lotus
          infirmary: moonlit arch window, twin amber lanterns, carved
          lotus emblem, and the Fading Apprentice in bed showing all
          dehydration cues in the art itself — pale fatigued face, dry
          lips, sweat on brow, slumped shoulders, and a tipped, nearly
          empty water flask spilling off the bedside table.
          SCENE_RATIO is aspect-locked to the image's exact pixel ratio
          (1280/896) so clue zones never drift against the art.
      ══════════════════════════════════════════════════════════════ */}
      <ExpoImage
        source={require("../../assets/images/cue_hunt_infirmary_scene.png")}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={200}
      />

      {/* Soft edge vignette — blends the illustration into the app frame */}
      <LinearGradient
        colors={["#0B1A1466", "transparent"]}
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: U * 0.070,
        }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["transparent", "#0B1A1466"]}
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: U * 0.070,
        }}
        pointerEvents="none"
      />

      {/* ══════════════════════════════════════════════════════════════
          CLUE ZONES — always rendered on top of the illustration
      ══════════════════════════════════════════════════════════════ */}
      {ZONES.map((zone) => (
        <ClueZone
          key={zone.id}
          zone={zone}
          scW={scW}
          found={found.has(zone.id)}
          onCorrect={onCorrect}
          onWrong={onWrong}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CueHuntScreen — main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function CueHuntScreen() {
  const router = useRouter();
  const { player, updateState } = usePlayer();
  const { startTutorial, isCompleted, activeTutorialId } = useTutorial();

  const [scW, setScW] = useState(0);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [wrongTaps, setWrongTaps] = useState(0);
  const [phase, setPhase] = useState<"playing" | "complete">("playing");
  const [toastText, setToastText] = useState("");
  const [creditsEarned, setCreditsEarned] = useState(0);
  const [milestoneItems, setMilestoneItems] = useState<MilestoneRewardItem[] | undefined>();
  const creditedRef = useRef(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Back navigation is blocked while playing — the back links are the
  // deliberate exits (forward replace to the University hub, never a pop).
  useBlockBack();
  // Leaving mid-tutorial must never leak the overlay onto the next screen.
  useClearTutorialOnExit();

  // Lock: if already completed, bounce back to University immediately.
  useEffect(() => {
    getChainProgress().then((prog) => {
      if (prog.cueHuntDone) {
        router.replace("/university" as any);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const requiredFound = [...found].filter(
    (id) => ZONES.find((z) => z.id === id)?.isRequired,
  ).length;

  // Auto-start tutorial once (delayed to avoid hydration race)
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isCompleted("cueHuntIntro") && !activeTutorialId) {
        startTutorial("cueHuntIntro");
      }
    }, 700);
    return () => clearTimeout(t);
  }, []);

  // Transition to complete when all required clues found; persist chain step
  useEffect(() => {
    if (requiredFound >= REQUIRED_COUNT && phase === "playing") {
      markChainStep("cueHuntDone");
      setTimeout(() => setPhase("complete"), 450);
    }
  }, [requiredFound, phase]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setScW(e.nativeEvent.layout.width);
  }, []);

  const showToast = useCallback(
    (msg: string) => {
      if (!msg) return;
      setToastText(msg);
      toastOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1100),
        Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setToastText(""));
    },
    [toastOpacity],
  );

  const handleCorrect = useCallback(
    (zone: ZoneDef) => {
      setFound((prev) => {
        if (prev.has(zone.id)) return prev;
        return new Set([...prev, zone.id]);
      });
      playRewardCue();
      showToast(zone.feedback);
    },
    [showToast],
  );

  const handleWrong = useCallback(() => {
    setWrongTaps((n) => n + 1);
  }, []);

  // Award University Credits + C1 objective XP once on completion
  useEffect(() => {
    if (phase !== "complete" || creditedRef.current) return;
    creditedRef.current = true;
    const credits = wrongTaps === 0 ? 30 : wrongTaps === 1 ? 20 : 15;
    setCreditsEarned(credits);
    const isPerfect = wrongTaps === 0;
    (async () => {
      // C1: grant 10 Player XP for completing Cue Hunt (once only)
      const isObjNew = await completeObjective("obj_cue_hunt_done");
      const objXp = isObjNew ? 10 : 0;

      if (isPerfect) {
        const isFirst = await checkAndMarkFirstPerfect("cueHunt");
        if (isFirst) {
          const bonus = 15;
          setMilestoneItems([
            { icon: "school", label: "Uni Credits", amount: String(bonus) },
            { icon: "trophy", label: "First Perfect Bonus" },
            ...(isObjNew ? [{ icon: "star-outline" as const, label: "+10 XP — Cue Hunt", amount: "10" }] : []),
          ]);
          if (player && updateState) {
            const newXp = (player.xp ?? 0) + objXp;
            const { level: newLevel } = playerLevelFromXp(newXp);
            await updateState({
              ...player,
              university_credits: (player.university_credits || 0) + credits + bonus,
              xp: newXp,
              player_level: newLevel,
            });
          }
          return;
        }
      }
      if (player && updateState) {
        const newXp = (player.xp ?? 0) + objXp;
        const { level: newLevel } = playerLevelFromXp(newXp);
        await updateState({
          ...player,
          university_credits: (player.university_credits || 0) + credits,
          xp: newXp,
          player_level: newLevel,
        });
      }
    })();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const dots = Array.from({ length: REQUIRED_COUNT }, (_, i) => i < requiredFound);

  // ── Complete: full-screen reward burst ────────────────────────────────────
  if (phase === "complete") {
    const grade =
      wrongTaps === 0
        ? { label: "Healer's Eye",     color: "#2DD4BF", icon: "eye"    as const }
        : wrongTaps === 1
          ? { label: "Sharp Eye",      color: "#22C55E", icon: "eye-outline" as const }
          : { label: "Good Eye",       color: "#F59E0B", icon: "eye-outline" as const };
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <RewardBurst
          grade={grade}
          score={REQUIRED_COUNT - Math.min(wrongTaps, REQUIRED_COUNT)}
          total={REQUIRED_COUNT}
          observation={
            wrongTaps === 0
              ? '"You noticed dry lips, weakness, and the tipped water flask — no false alarms."'
              : `"You found all three cues${wrongTaps === 1 ? ", with one false alarm" : " through some false starts"}."`
          }
          clinicalNote="These clinical cues signal dehydration — often missed until it's serious."
          chainHint="Next: decide how quickly she needs help"
          bgColors={["#162C24", "#0E2018", "#091614"]}
          creditsEarned={creditsEarned}
          milestoneItems={milestoneItems}
          onFinish={() => router.replace("/university")}
          onLearnMore={() => router.push("/university/cue-hunt-lesson" as any)}
          onContinue={() => router.replace("/university/rapid-triage" as any)}
          continueLabel="Next: Rapid Triage →"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#162C24", "#0E2018", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.replace("/university")}
          hitSlop={10}
          testID="cue-hunt-back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.kicker}>CUE HUNT</Text>
          <Text style={styles.caseName}>The Fading Apprentice</Text>
        </View>
        {/* Progress dots — teal when found */}
        <View style={styles.dotRow}>
          {dots.map((filled, i) => (
            <View key={i} style={[styles.dot, filled && styles.dotFilled]} />
          ))}
        </View>
      </View>

      {/* ── OBJECTIVE STRIP ───────────────────────────────────────────── */}
      <View style={styles.objectiveRow}>
        <Ionicons name="eye-outline" size={13} color="#2DD4BF" />
        <Text style={styles.objectiveTxt}>
          Find 3 clues · {requiredFound}/3 found
        </Text>
      </View>

      {/* ── PURPOSE STRIP ─────────────────────────────────────────────── */}
      <View style={styles.purposeStrip}>
        <Ionicons name="sparkles-outline" size={12} color="#D4AF37" />
        <Text style={styles.purposeTxt}>
          Good healers notice what others overlook. Tap the signs you see.
        </Text>
      </View>

      {/* ── SCENE ─────────────────────────────────────────────────────── */}
      <View style={styles.sceneOuter}>
        {/* The scene container has a fixed aspect ratio so the Lotus
            infirmary room always renders at the same proportions.
            onLayout gives us the actual width, which we use as the base
            unit (scW) for all scene element positions. */}
        <View
          style={styles.sceneContainer}
          onLayout={handleLayout}
        >
          {scW > 0 && (
            <InfirmaryScene
              scW={scW}
              found={found}
              onCorrect={handleCorrect}
              onWrong={handleWrong}
            />
          )}

          {/* Short feedback toast, positioned inside scene at the bottom */}
          {toastText !== "" && (
            <Animated.View
              style={[styles.toast, { opacity: toastOpacity }]}
              pointerEvents="none"
            >
              {/* Chibi healer accent — feedback popups only, never the scene */}
              <ExpoImage
                source={require("../../assets/images/cue_hunt_chibi_healer.png")}
                style={styles.toastChibi}
                contentFit="contain"
              />
              <Text style={styles.toastTxt}>{toastText}</Text>
            </Animated.View>
          )}
        </View>
      </View>

      {/* ── BOTTOM: completion reward OR back link ────────────────────── */}
      {phase !== "complete" && (
        <Pressable
          style={styles.backToUni}
          onPress={() => router.replace("/university")}
          testID="cue-hunt-return"
        >
          <Ionicons name="chevron-back" size={15} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.backToUniTxt}>Back to University</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

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
  kicker: { color: "#2DD4BF", fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  caseName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "300", letterSpacing: 0.4 },
  dotRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.border },
  dotFilled: { backgroundColor: "#2DD4BF" },

  objectiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  objectiveTxt: {
    color: "#2DD4BF",
    fontSize: 12, fontWeight: "700", letterSpacing: 0.5,
  },

  sceneOuter: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    alignItems: "center",
  },
  sceneContainer: {
    // Fixed aspect ratio keeps the Lotus infirmary room proportional on all sizes.
    // scW * SCENE_RATIO = height, so aspectRatio (w/h) = 1/SCENE_RATIO.
    aspectRatio: 1 / SCENE_RATIO,
    width: "100%",
    maxWidth: 480,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2DD4BF18",
  },

  toast: {
    position: "absolute",
    bottom: SPACING.md,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(13,59,56,0.92)",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: "#2DD4BF40",
  },
  toastTxt: { color: "#2DD4BF", fontSize: 12, fontWeight: "600", flexShrink: 1 },
  toastChibi: { width: 30, height: 30 },
  completeChibi: { width: 44, height: 44, marginLeft: "auto" },

  completionCard: {
    margin: SPACING.lg,
    marginTop: 0,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: "#2DD4BF30",
    overflow: "hidden",
  },
  completeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  completeIconWrap: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#2DD4BF18",
    borderWidth: 1, borderColor: "#2DD4BF40",
    alignItems: "center", justifyContent: "center",
  },
  completeKicker: {
    color: "#2DD4BF",
    fontSize: 9, fontWeight: "700", letterSpacing: 2,
  },
  observationTxt: {
    color: COLORS.onSurface,
    fontSize: 15, fontStyle: "italic", fontWeight: "300",
    lineHeight: 22,
  },
  clinicalTxt: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  completeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginTop: SPACING.xs ?? 4,
  },
  learnWhyBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#2DD4BF",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.lg, paddingVertical: 14,
    minHeight: 44,
  },
  learnWhyTxt: { color: "#0B1A18", fontSize: 13, fontWeight: "800" },
  completeBackTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13, fontWeight: "600",
  },

  backToUni: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: SPACING.md, paddingBottom: SPACING.xl,
  },
  backToUniTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },

  // Purpose strip — shown below the progress dots
  purposeStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 7,
    backgroundColor: "#D4AF370C",
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: "#D4AF3720",
  },
  purposeTxt: {
    color: "#D4AF37CC",
    fontSize: 12,
    fontStyle: "italic",
    flex: 1,
    lineHeight: 17,
  },

  // Chain next-step hint in completion card
  nextHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  nextHintTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12,
    fontStyle: "italic",
  },
});
