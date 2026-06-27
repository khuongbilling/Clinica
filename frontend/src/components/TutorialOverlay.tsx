import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTutorial } from "@/src/game/tutorialStore";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export function TutorialOverlay() {
  const { currentStep, stepIndex, totalSteps, advanceStep, skipTutorial, activeTutorialId } = useTutorial();
  const insets = useSafeAreaInsets();

  if (!activeTutorialId || !currentStep) return null;

  const progress = totalSteps > 1 ? `${stepIndex + 1} / ${totalSteps}` : "";

  if (currentStep.requireAction) {
    return (
      <View
        style={[StyleSheet.absoluteFillObject, styles.actionOverlay, { pointerEvents: 'box-none' }]}
      >
        <View style={[styles.actionBanner, { marginTop: insets.top + SPACING.xs, pointerEvents: 'auto' }]}>
          <View style={styles.bannerRow}>
            <View style={styles.bannerIcon}>
              <Ionicons name="arrow-down" size={14} color={COLORS.onBrand} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.bannerTitleRow}>
                <Text style={styles.bannerTitle}>{currentStep.title.toUpperCase()}</Text>
                {progress ? <Text style={styles.progressTxt}>{progress}</Text> : null}
              </View>
              <Text style={styles.bannerBody}>{currentStep.body}</Text>
            </View>
          </View>
          <Pressable onPress={skipTutorial} style={styles.skipInline} hitSlop={8}>
            <Text style={styles.skipTxt}>Skip tutorial</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.popover}>
          <View style={styles.popoverHead}>
            <View style={styles.codexBadge}>
              <Ionicons name="book" size={11} color={COLORS.onBrand} />
              <Text style={styles.codexBadgeTxt}>CODEX GUIDE</Text>
            </View>
            {progress ? <Text style={styles.progressTxtDark}>{progress}</Text> : null}
          </View>

          <Text style={styles.popoverTitle}>{currentStep.title}</Text>
          <Text style={styles.popoverBody}>{currentStep.body}</Text>

          <View style={styles.popoverActions}>
            <Pressable onPress={skipTutorial} style={styles.skipBtn} hitSlop={8}>
              <Text style={styles.skipBtnTxt}>SKIP</Text>
            </Pressable>
            <Pressable onPress={advanceStep} style={styles.nextBtn}>
              <Text style={styles.nextBtnTxt}>{currentStep.nextText || "NEXT"}</Text>
            </Pressable>
          </View>
        </View>
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

  actionOverlay: {
    zIndex: 9000,
    justifyContent: "flex-start",
    alignItems: "stretch",
    paddingHorizontal: SPACING.sm,
  },
  actionBanner: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.brand + "80",
    padding: SPACING.md,
    gap: SPACING.sm,
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  bannerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  bannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  bannerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  bannerTitle: {
    color: COLORS.brand,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    flex: 1,
  },
  progressTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    fontWeight: "600",
  },
  bannerBody: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  skipInline: {
    alignSelf: "flex-end",
  },
  skipTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    textDecorationLine: "underline",
  },
});
