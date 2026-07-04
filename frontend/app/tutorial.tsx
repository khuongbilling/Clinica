import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { CUE_SAFETY_NOTE, type LearningProfile } from "@/src/game/clinical";
import {
  TUTORIAL_SECTIONS,
  TUTORIAL_TIERS,
  getTutorialTier,
  type TutorialTier,
} from "@/src/game/tutorial";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function TutorialScreen() {
  const router = useRouter();
  const { player } = usePlayer();
  const recommendedTier = useMemo<TutorialTier>(
    () => getTutorialTier(player?.learning_profile as LearningProfile | undefined),
    [player?.learning_profile],
  );
  const [tier, setTier] = useState<TutorialTier>(recommendedTier);
  const [openId, setOpenId] = useState<string>(TUTORIAL_SECTIONS[0].id);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={close}
          style={styles.closeBtn}
          hitSlop={12}
          testID="tutorial-close"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>HOW TO PLAY</Text>
        <Text style={styles.title}>{"Healer's Manual"}</Text>
        <Text style={styles.sub}>
          A guide to the battle system, clinical chain, and every mechanic. Pick a depth that fits you.
        </Text>
      </View>

      {/* Tier selector */}
      <View style={styles.tierRow}>
        {TUTORIAL_TIERS.map((t) => {
          const active = t.id === tier;
          const isRecommended = t.id === recommendedTier;
          return (
            <Pressable
              key={t.id}
              style={[styles.tierPill, active && styles.tierPillActive]}
              onPress={() => setTier(t.id)}
              testID={`tutorial-tier-${t.id}`}
            >
              <Text style={[styles.tierLabel, active && styles.tierLabelActive]}>
                {t.label}
              </Text>
              <Text style={[styles.tierSub, active && styles.tierSubActive]} numberOfLines={1}>
                {isRecommended ? "★ " + t.sub : t.sub}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {TUTORIAL_SECTIONS.map((section) => {
          const open = section.id === openId;
          return (
            <View key={section.id} style={styles.sectionCard} testID={`tutorial-section-${section.id}`}>
              <Pressable
                style={styles.sectionHead}
                onPress={() => setOpenId(open ? "" : section.id)}
                testID={`tutorial-section-toggle-${section.id}`}
              >
                <View style={styles.sectionIcon}>
                  <Ionicons
                    name={section.icon as any}
                    size={18}
                    color={open ? COLORS.brand : COLORS.onSurfaceSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionKicker} numberOfLines={open ? 0 : 2}>
                    {section.kicker}
                  </Text>
                </View>
                <Ionicons
                  name={open ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={COLORS.onSurfaceTertiary}
                />
              </Pressable>

              {open && (
                <View style={styles.sectionBody}>
                  <Text style={styles.sectionBodyTxt}>{section.content[tier]}</Text>
                  {section.takeaways && section.takeaways.length > 0 && (
                    <View style={styles.takeawayBox}>
                      <Text style={styles.takeawayLbl}>KEY TAKEAWAYS</Text>
                      {section.takeaways.map((t, i) => (
                        <View key={i} style={styles.takeawayRow}>
                          <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
                          <Text style={styles.takeawayTxt}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.safetyBox} testID="clinical-cue-safety-note">
          <Text style={styles.safetyLbl}>ABOUT CLINICAL CUES</Text>
          <Text style={styles.safetyTxt}>{CUE_SAFETY_NOTE}</Text>
        </View>

        <View style={{ height: SPACING.xl }} />

        <Pressable style={styles.doneBtn} onPress={close} testID="tutorial-done">
          <Text style={styles.doneTxt}>BACK</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    padding: SPACING.lg,
    paddingLeft: SPACING.lg + 36,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: {
    position: "absolute",
    left: SPACING.sm,
    top: SPACING.lg,
    padding: 12,
    zIndex: 2,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 3, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 26, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 17 },

  tierRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    padding: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  tierPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 2,
  },
  tierPillActive: {
    backgroundColor: COLORS.brand + "1F",
    borderColor: COLORS.brand,
  },
  tierLabel: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  tierLabelActive: { color: COLORS.brand },
  tierSub: { color: COLORS.onSurfaceTertiary, fontSize: 9 },
  tierSubActive: { color: COLORS.brand + "DD" },

  scroll: { padding: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.sm, paddingBottom: SPACING.xxxl },

  sectionCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.md,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  sectionKicker: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  sectionBody: {
    padding: SPACING.md,
    paddingTop: 0,
    gap: SPACING.sm,
  },
  sectionBodyTxt: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  takeawayBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  takeawayLbl: {
    color: COLORS.brand,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginBottom: 2,
  },
  takeawayRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  takeawayTxt: { color: COLORS.onSurface, fontSize: 12, flex: 1 },
  safetyBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
    marginTop: SPACING.sm,
  },
  safetyLbl: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  safetyTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 16 },

  doneBtn: {
    backgroundColor: COLORS.brand,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  doneTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
});
