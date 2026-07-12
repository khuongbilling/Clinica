import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTutorial } from "@/src/game/tutorialStore";
import { usePlayer } from "@/src/game/store";
import { getSystemIdentity, MASTER_BAI, type SystemIdentity } from "@/src/game/systemNarrator";
import { isSystemTutorial } from "@/src/game/tutorials";
import { playerLevelFromXp } from "@/src/game/progression";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

/**
 * Types the text out character-by-character like a visual-novel narrative box so
 * the player actually reads each step. Tap the box to reveal the rest instantly.
 * Calls onComplete when all characters are visible (naturally or via instant).
 */
function TypewriterText({ text, style, instant, speed = 16, onComplete }: { text: string; style?: any; instant?: boolean; speed?: number; onComplete?: () => void }) {
  const [count, setCount] = useState(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  useEffect(() => {
    if (instant) {
      setCount(text.length);
      // Fire onComplete when skipped-to-instant so box goes passthrough immediately.
      onCompleteRef.current?.();
      return;
    }
    setCount(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) {
        clearInterval(id);
        onCompleteRef.current?.();
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, instant]);
  return <Text style={style}>{text.slice(0, count)}</Text>;
}

/** A pulsing chevron that points from the narrative box toward the highlighted action. */
function PointerChevron({ dir }: { dir: "up" | "down" }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 620, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 620, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const shift = anim.interpolate({ inputRange: [0, 1], outputRange: dir === "up" ? [0, -6] : [0, 6] });
  return (
    <Animated.View style={[styles.chevron, dir === "up" ? styles.chevronUp : styles.chevronDown, { transform: [{ translateY: shift }] }]}>
      <Ionicons name={dir === "up" ? "chevron-up" : "chevron-down"} size={22} color={COLORS.brand} />
    </Animated.View>
  );
}

/**
 * Large avatar cut-in of the current narrator — a tall figure "speaking to"
 * the player beside the dialogue text, visual-novel style, instead of a tiny
 * circular portrait. Tinted by the narrator's accent color.
 */
function NarratorFigure({ art, color, width, height }: { art: any; color: string; width: number; height: number }) {
  return (
    <View style={[styles.narratorFigure, { width, height, borderColor: color }]}>
      <ExpoImage
        source={art}
        style={{ width, height }}
        contentFit="cover"
        contentPosition="top center"
        transition={200}
      />
    </View>
  );
}

export function TutorialOverlay() {
  const { currentStep, stepIndex, totalSteps, advanceStep, activeTutorialId, setGuidedReserve } = useTutorial();
  const insets = useSafeAreaInsets();
  const { player } = usePlayer();
  const [instant, setInstant] = useState(false);
  // When true the narrative box is hidden; only the dim scrim + highlighted
  // button remain visible (requireAction steps only).
  const [boxDismissed, setBoxDismissed] = useState(false);

  const stepId = currentStep?.id;
  useEffect(() => {
    setInstant(false);
    setBoxDismissed(false);
  }, [stepId]);

  // True when the current step requires tapping a specific game element
  // (mini-game tutorial step, not a battle/hub step).
  const isMiniGameRequired = !!(currentStep?.requireAction && currentStep?.requiredTargetId);

  // Animation complete: text is fully visible.
  const handleTypewriterComplete = useCallback(() => {
    setInstant(true);
  }, []);

  // Tap handler for the narrative box:
  //   On mini-game required steps: tapping the box only makes the typewriter
  //     instant. The box stays visible as a hint until the player taps the
  //     highlighted game element, which calls onTargetTap → markDone →
  //     activeTutorialId = null → overlay clears naturally.
  //   On battle requireAction steps: 1st tap → reveal; 2nd tap → dismiss box.
  //   On banner/non-action steps: 1st tap → reveal; 2nd tap → advance step.
  const handleBoxTap = useCallback(() => {
    if (!instant) {
      setInstant(true);
      return;
    }
    if (currentStep?.requireAction) {
      if (!isMiniGameRequired) {
        // Battle tutorials only — dismiss the box so the highlighted skill
        // is directly tappable without an overlay in the way.
        setBoxDismissed(true);
      }
      // Mini-game steps: box stays visible until the player taps the card.
    } else {
      advanceStep();
    }
  }, [instant, currentStep, isMiniGameRequired, advanceStep]);

  // Reserve is only meaningful while a bottom-placed guided box is showing.
  // Clear it whenever we're not (top/center box, banner, or overlay hidden) so
  // screens don't keep dead bottom padding after the step advances.
  const isBottomGuidedBox = !!(currentStep?.requireAction && currentStep?.placement === "bottom");
  useEffect(() => {
    if (!isBottomGuidedBox) setGuidedReserve(0);
    return () => setGuidedReserve(0);
  }, [isBottomGuidedBox, setGuidedReserve]);

  if (!activeTutorialId || !currentStep) return null;

  const progress = totalSteps > 1 ? `${stepIndex + 1} / ${totalSteps}` : "";
  const isSystem = isSystemTutorial(activeTutorialId);

  // Resolve the System narrator's identity (dark silhouette until Player L10,
  // then colored by aptitude). Level is derived from xp, matching the rest of
  // the app, falling back to the stored player_level if present.
  const playerLevel = player
    ? (player.player_level ?? playerLevelFromXp(player.xp ?? 0).level)
    : 1;
  const identity = getSystemIdentity(playerLevel, player?.aptitude);

  // Timeline-aware narrator: the guided prologue battle is voiced by Master
  // Bai (the System doesn't exist until the Recall); everything else is the
  // System.
  const narrator = isSystem
    ? { name: identity.name, color: identity.color, art: identity.art }
    : MASTER_BAI;

  // Positioned narrative box: used for real gameplay steps (requireAction) AND
  // for the System's informational forced banners (banner) that point at live
  // on-screen UI. Banners advance via their own Next button instead of a game
  // action.
  const usesBox = currentStep.requireAction || currentStep.banner;

  if (usesBox) {
    const placement = currentStep.placement;
    const justify = placement === "bottom" ? "flex-end" : placement === "center" ? "center" : "flex-start";
    const accent = narrator.color;
    const isBattleTutorial = activeTutorialId === "prologueBattle" || activeTutorialId === "firstBattle";
    // Battle tutorials use a blocking scrim while the narrator box is visible so
    // the player cannot interact with live battle UI mid-narration. Mini-game
    // tutorials do NOT use a scrim — wrong-tap blocking is handled by
    // isTutorialBlocked in each game screen's press handler.
    const isMiniGameStep = !!currentStep.requiredTargetId;
    const showScrim = isBattleTutorial && currentStep.requireAction;

    // After the box dismisses: battle tutorials keep a dim visual-only scrim
    // so the player sees the highlighted skill is still the target. Mini-game
    // tutorials return null — isTutorialBlocked in each game screen already
    // blocks wrong-element taps, so a scrim here is both redundant and actively
    // harmful (it becomes an accidental touch-absorber on web if the deprecated
    // pointerEvents prop is silently ignored).
    if (boxDismissed) {
      if (!isBattleTutorial) return null;
      return (
        <View
          style={[styles.battleScrim, { zIndex: 9000, pointerEvents: "none" }]}
        />
      );
    }

    const showChevron = currentStep.requireAction;
    const arrowUp = placement === "bottom";

    // Shared inner content for the narrative Pressable (used in both paths below).
    const narrativeInner = (
      <>
        {showChevron && arrowUp && <PointerChevron dir="up" />}
        <View style={styles.narrativeRow}>
          <NarratorFigure art={narrator.art} color={accent} width={64} height={92} />
          <View style={styles.narrativeContent}>
            <View style={styles.narrativeHead}>
              <Text style={[styles.narrativeTitle, { color: accent }]} numberOfLines={1}>{narrator.name}</Text>
              {progress ? <Text style={styles.progressTxt}>{progress}</Text> : null}
            </View>
            <Text style={styles.systemStepTitle}>{currentStep.title}</Text>
            <TypewriterText
              text={currentStep.body}
              style={styles.narrativeBody}
              instant={instant}
              onComplete={handleTypewriterComplete}
            />
          </View>
        </View>
        <View style={styles.narrativeFoot}>
          {currentStep.banner ? (
            <>
              <View style={{ flex: 1 }} />
              <Pressable onPress={advanceStep} style={[styles.nextBtn, { backgroundColor: accent }]}>
                <Text style={styles.nextBtnTxt}>{currentStep.nextText || "NEXT"}</Text>
              </Pressable>
            </>
          ) : (
            <Text style={[styles.tapPrompt, { color: instant ? accent : COLORS.onSurfaceTertiary }]} numberOfLines={1}>
              {isMiniGameRequired
                ? `▸ ${currentStep.nextText || "tap the highlighted card"}`
                : instant
                  ? "▸ tap to continue"
                  : currentStep.nextText
                    ? `▸ ${currentStep.nextText}`
                    : "▸ tap to reveal"}
            </Text>
          )}
        </View>
        {showChevron && !arrowUp && <PointerChevron dir="down" />}
      </>
    );

    // ── Mini-game required steps ────────────────────────────────────────────────
    // For steps that require tapping a specific game element (e.g. Stabilize
    // Stack, Cue Hunt, Rapid Triage), the narrative box is rendered as a
    // THIN-STRIP absolutely-positioned container that only covers the top or
    // bottom edge of the screen — never the card / game area.
    //
    // This is the definitive fix for the tap-lock bug: instead of an
    // absoluteFillObject wrapper with `pointerEvents:"box-none"` (whose CSS
    // translation in React Native Web can interfere with ScrollView touch
    // routing), we simply don't render any full-screen overlay at all.
    // Nothing can block the cards because there is nothing over the cards.
    if (isMiniGameRequired) {
      const edgeStyle =
        placement === "bottom"
          ? { bottom: 0, paddingBottom: insets.bottom + SPACING.md }
          : { top: 0, paddingTop: insets.top + SPACING.xs };
      return (
        <View style={[styles.miniGameNarratorWrap, edgeStyle]}>
          <Pressable
            onPress={handleBoxTap}
            onLayout={placement === "bottom" && currentStep.requireAction
              ? (e) => setGuidedReserve(e.nativeEvent.layout.height + insets.bottom + SPACING.xxl)
              : undefined}
            style={[styles.narrativeBox, { borderColor: accent, shadowColor: accent }]}
          >
            {narrativeInner}
          </Pressable>
        </View>
      );
    }

    // ── Battle tutorials and banner steps ──────────────────────────────────────
    // These use the full absoluteFillObject wrapper. Battle scrims block the
    // live battle UI while the narrator speaks; banner steps appear over hub
    // screens that have no scrollable game content to protect.
    return (
      <>
        {showScrim && (
          <View style={[styles.battleScrim, { pointerEvents: "auto" }]} />
        )}
        <View style={[StyleSheet.absoluteFillObject, styles.actionOverlay, { justifyContent: justify, pointerEvents: "box-none" }]}>
          <Pressable
            onPress={handleBoxTap}
            onLayout={placement === "bottom" && currentStep.requireAction
              ? (e) => setGuidedReserve(e.nativeEvent.layout.height + insets.bottom + SPACING.xxl)
              : undefined}
            style={[
              styles.narrativeBox,
              { borderColor: accent, shadowColor: accent },
              placement === "top" && { marginTop: insets.top + SPACING.xs },
              placement === "bottom" && { marginBottom: insets.bottom + SPACING.md },
              { pointerEvents: "auto" },
            ]}
          >
            {narrativeInner}
          </Pressable>
        </View>
      </>
    );
  }

  const accent = narrator.color;
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        {/* Large avatar cut-in rising above the dialogue box — the narrator
            "stands" over the box, speaking to the player, VN style. */}
        <View style={styles.cutinWrap}>
          <NarratorFigure art={narrator.art} color={accent} width={128} height={172} />
          <View style={styles.cutinNameWrap}>
            <Text style={[styles.systemName, { color: accent }]}>{narrator.name}</Text>
            {progress ? <Text style={styles.progressTxtDark}>{progress}</Text> : null}
          </View>
        </View>
        {/* Tap anywhere on the popover to reveal text (1st tap) or advance
            (2nd tap). The NEXT button always advances immediately. */}
        <Pressable
          style={[styles.popover, { borderColor: accent + "80" }]}
          onPress={handleBoxTap}
        >
          <Text style={styles.popoverTitle}>{currentStep.title}</Text>
          <TypewriterText
            text={currentStep.body}
            style={styles.popoverBody}
            instant={instant}
            onComplete={handleTypewriterComplete}
          />
          <View style={styles.popoverActions}>
            <Pressable onPress={advanceStep} style={[styles.nextBtn, { backgroundColor: accent }]}>
              <Text style={styles.nextBtnTxt}>{currentStep.nextText || "NEXT"}</Text>
            </Pressable>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.70)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  popover: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: COLORS.brand + "60",
    gap: SPACING.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 24,
  },
  cutinWrap: {
    width: "100%",
    maxWidth: 360,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACING.sm,
    marginBottom: -SPACING.sm,
    zIndex: 2,
  },
  cutinNameWrap: {
    flex: 1,
    paddingBottom: SPACING.md + SPACING.xs,
  },
  progressTxtDark: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    fontWeight: "600",
  },
  popoverTitle: {
    color: COLORS.onSurface,
    fontSize: 20,
    fontWeight: "400",
    lineHeight: 24,
    marginTop: SPACING.xs,
  },
  popoverBody: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 19,
    minHeight: 57,
  },
  popoverActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  nextBtn: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
  },
  nextBtnTxt: {
    color: COLORS.onBrand,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  // Full-screen scrim rendered below the tutorial box during battle tutorials.
  // zIndex 8999 sits below the box (9000) but above the battle UI (0),
  // blocking taps on enemy panels, header, and any non-skill area.
  battleScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8999,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  // ── Guided action narrative box (positioned near the highlighted control) ──
  // Mini-game steps: thin-strip wrapper anchored to top or bottom edge only.
  // Does NOT cover the card/game area — nothing can block game touches.
  miniGameNarratorWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9000,
    paddingHorizontal: SPACING.sm,
    alignItems: "center",
  },
  actionOverlay: {
    zIndex: 9000,
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
  },
  narrativeBox: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.brand,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    width: "100%",
    maxWidth: 460,
    gap: 6,
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 16,
  },
  narratorFigure: {
    overflow: "hidden",
    borderWidth: 2,
    borderRadius: RADIUS.md,
    backgroundColor: "#0B1420",
  },
  narrativeRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "flex-start",
  },
  narrativeContent: {
    flex: 1,
    gap: 4,
  },
  systemStepTitle: {
    color: COLORS.onSurface,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginTop: 2,
  },
  systemName: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  narrativeHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  narrativeTitle: {
    flex: 1,
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  narrativeBody: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 40,
  },
  narrativeFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  tapPrompt: {
    flex: 1,
    color: COLORS.brand,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  progressTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    fontWeight: "600",
  },
  chevron: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  chevronUp: {
    marginTop: -SPACING.sm,
    marginBottom: 2,
  },
  chevronDown: {
    marginBottom: -SPACING.sm,
    marginTop: 2,
  },
});
