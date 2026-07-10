import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTutorial } from "@/src/game/tutorialStore";
import { usePlayer } from "@/src/game/store";
import { getSystemIdentity, MASTER_BAI, type SystemIdentity } from "@/src/game/systemNarrator";
import { isForcedTutorial, isSystemTutorial } from "@/src/game/tutorials";
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
  const { currentStep, stepIndex, totalSteps, advanceStep, skipTutorial, activeTutorialId, setGuidedReserve } = useTutorial();
  const insets = useSafeAreaInsets();
  const { player } = usePlayer();
  const [instant, setInstant] = useState(false);

  const stepId = currentStep?.id;
  useEffect(() => {
    setInstant(false);
  }, [stepId]);

  // Called by TypewriterText when all characters are visible. Switches instant
  // to true so the box becomes passthrough and the highlighted button is tappable.
  const handleTypewriterComplete = useCallback(() => setInstant(true), []);

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
  // Forced tutorials can't be skipped: the prologue battle and the System's
  // one-time hub-onboarding beats.
  const allowSkip = !isForcedTutorial(activeTutorialId);

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
    const showChevron = currentStep.requireAction;
    const arrowUp = placement === "bottom";
    const accent = narrator.color;

    // Once all text is visible (instant=true) on a requireAction step, the box
    // becomes passthrough so the player can tap the highlighted button directly.
    // Banner steps keep pointerEvents:auto because they need the NEXT button.
    const boxPassthrough = !!(currentStep.requireAction && !currentStep.banner && instant);

    return (
      <View style={[StyleSheet.absoluteFillObject, styles.actionOverlay, { justifyContent: justify, pointerEvents: "box-none" }]}>
        <Pressable
          // While text is animating, tap the box to reveal all text instantly.
          // Once passthrough, onPress is removed so touches fall through to the
          // highlighted button; pointerEvents:box-none keeps Skip tappable.
          onPress={boxPassthrough ? undefined : () => setInstant(true)}
          onLayout={placement === "bottom" && currentStep.requireAction
            ? (e) => setGuidedReserve(e.nativeEvent.layout.height + insets.bottom + SPACING.xxl)
            : undefined}
          style={[
            styles.narrativeBox,
            { borderColor: accent, shadowColor: accent },
            placement === "top" && { marginTop: insets.top + SPACING.xs },
            placement === "bottom" && { marginBottom: insets.bottom + SPACING.md },
            boxPassthrough
              ? { pointerEvents: "box-none", opacity: 0.88 }
              : { pointerEvents: "auto" },
          ]}
        >
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
              <>
                {currentStep.nextText ? (
                  <Text style={[styles.tapPrompt, { color: accent }]} numberOfLines={1}>▸ {currentStep.nextText}</Text>
                ) : <View style={{ flex: 1 }} />}
                {allowSkip && (
                  <Pressable onPress={skipTutorial} hitSlop={8} style={{ pointerEvents: "auto" }}>
                    <Text style={styles.skipTxt}>Skip</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
          {showChevron && !arrowUp && <PointerChevron dir="down" />}
        </Pressable>
      </View>
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
        <Pressable style={[styles.popover, { borderColor: accent + "80" }]} onPress={() => setInstant(true)}>
          <Text style={styles.popoverTitle}>{currentStep.title}</Text>
          <TypewriterText text={currentStep.body} style={styles.popoverBody} instant={instant} />

          <View style={styles.popoverActions}>
            {allowSkip && (
              <Pressable onPress={skipTutorial} style={styles.skipBtn} hitSlop={8}>
                <Text style={styles.skipBtnTxt}>SKIP</Text>
              </Pressable>
            )}
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
  skipBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  skipBtnTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
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

  // ── Guided action narrative box (positioned near the highlighted control) ──
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
  skipTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textDecorationLine: "underline",
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
