import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTutorial } from "@/src/game/tutorialStore";
import { usePlayer } from "@/src/game/store";
import { getSystemIdentity, type SystemIdentity } from "@/src/game/systemNarrator";
import { isForcedTutorial, isSystemTutorial } from "@/src/game/tutorials";
import { playerLevelFromXp } from "@/src/game/progression";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

/**
 * Types the text out character-by-character like a visual-novel narrative box so
 * the player actually reads each step. Tap the box to reveal the rest instantly.
 */
function TypewriterText({ text, style, instant, speed = 16 }: { text: string; style?: any; instant?: boolean; speed?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (instant) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) clearInterval(id);
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

/** Small circular donghua portrait of the System, tinted by its identity. */
function SystemPortrait({ identity, size = 40 }: { identity: SystemIdentity; size?: number }) {
  return (
    <View
      style={[
        styles.systemPortrait,
        { width: size, height: size, borderRadius: size / 2, borderColor: identity.color },
      ]}
    >
      <ExpoImage
        source={identity.art}
        style={{ width: size, height: size }}
        contentFit="cover"
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

  // Positioned narrative box: used for real gameplay steps (requireAction) AND
  // for the System's informational forced banners (banner) that point at live
  // on-screen UI. Banners advance via their own Next button instead of a game
  // action.
  const usesBox = currentStep.requireAction || currentStep.banner;

  if (usesBox) {
    const placement = currentStep.placement;
    const justify = placement === "bottom" ? "flex-end" : placement === "center" ? "center" : "flex-start";
    // The highlighted control lives outside the box: below it for a top/center
    // banner, above it for a bottom banner. Point the arrow toward it. Purely
    // informational banners don't point at a specific control.
    const showChevron = currentStep.requireAction;
    const arrowUp = placement === "bottom";
    const accent = isSystem ? identity.color : COLORS.brand;
    return (
      <View style={[StyleSheet.absoluteFillObject, styles.actionOverlay, { justifyContent: justify, pointerEvents: "box-none" }]}>
        <Pressable
          onPress={() => setInstant(true)}
          onLayout={placement === "bottom" && currentStep.requireAction
            ? (e) => setGuidedReserve(e.nativeEvent.layout.height + insets.bottom + SPACING.md + SPACING.sm)
            : undefined}
          style={[
            styles.narrativeBox,
            isSystem && { borderColor: accent, shadowColor: accent },
            placement === "top" && { marginTop: insets.top + SPACING.xs },
            placement === "bottom" && { marginBottom: insets.bottom + SPACING.md },
            { pointerEvents: "auto" },
          ]}
        >
          {showChevron && arrowUp && <PointerChevron dir="up" />}
          <View style={styles.narrativeHead}>
            {isSystem ? (
              <>
                <SystemPortrait identity={identity} size={34} />
                <Text style={[styles.narrativeTitle, { color: accent }]} numberOfLines={1}>{identity.name}</Text>
              </>
            ) : (
              <>
                <View style={styles.guideBadge}>
                  <Ionicons name="chatbubbles" size={11} color={COLORS.onBrand} />
                  <Text style={styles.guideBadgeTxt}>GUIDE</Text>
                </View>
                <Text style={styles.narrativeTitle} numberOfLines={1}>{currentStep.title}</Text>
              </>
            )}
            {progress ? <Text style={styles.progressTxt}>{progress}</Text> : null}
          </View>
          {isSystem ? <Text style={styles.systemStepTitle}>{currentStep.title}</Text> : null}
          <TypewriterText text={currentStep.body} style={styles.narrativeBody} instant={instant} />
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
                  <Text style={[styles.tapPrompt, isSystem && { color: accent }]} numberOfLines={1}>▸ {currentStep.nextText}</Text>
                ) : <View style={{ flex: 1 }} />}
                {allowSkip && (
                  <Pressable onPress={skipTutorial} hitSlop={8}>
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

  const accent = isSystem ? identity.color : COLORS.brand;
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={[styles.popover, isSystem && { borderColor: accent + "80" }]} onPress={() => setInstant(true)}>
          {isSystem ? (
            <View style={styles.systemPopoverHead}>
              <SystemPortrait identity={identity} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.systemName, { color: accent }]}>{identity.name}</Text>
                {progress ? <Text style={styles.progressTxtDark}>{progress}</Text> : null}
              </View>
            </View>
          ) : (
            <View style={styles.popoverHead}>
              <View style={styles.codexBadge}>
                <Ionicons name="book" size={11} color={COLORS.onBrand} />
                <Text style={styles.codexBadgeTxt}>CODEX GUIDE</Text>
              </View>
              {progress ? <Text style={styles.progressTxtDark}>{progress}</Text> : null}
            </View>
          )}

          <Text style={styles.popoverTitle}>{currentStep.title}</Text>
          <TypewriterText text={currentStep.body} style={styles.popoverBody} instant={instant} />

          <View style={styles.popoverActions}>
            {allowSkip && (
              <Pressable onPress={skipTutorial} style={styles.skipBtn} hitSlop={8}>
                <Text style={styles.skipBtnTxt}>SKIP</Text>
              </Pressable>
            )}
            <Pressable onPress={advanceStep} style={[styles.nextBtn, isSystem && { backgroundColor: accent }]}>
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
  popoverHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  codexBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.brand,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  codexBadgeTxt: {
    color: COLORS.onBrand,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
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
  systemPortrait: {
    overflow: "hidden",
    borderWidth: 2,
    backgroundColor: "#0B1420",
  },
  systemStepTitle: {
    color: COLORS.onSurface,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginTop: 2,
  },
  systemPopoverHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
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
  guideBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.brand,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  guideBadgeTxt: {
    color: COLORS.onBrand,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
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
