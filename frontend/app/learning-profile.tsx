import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { learningProfileLabel } from "@/src/game/firstWeekPath";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { goBack } from "@/src/utils/navigation";

interface ProfileOption {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  whoItsFor: string;
  depthLabel: string;
  clueLabel: string;
  icon: string;
  accentColor: string;
}

const PROFILE_OPTIONS: ProfileOption[] = [
  {
    id: "curious",
    label: "New Learner",
    subtitle: "Just getting started with health & medicine",
    description:
      "Clinica uses friendly, everyday language with fantasy-medical framing. More visible clues, richer step-by-step guidance. Great if health topics are new to you, or you're here for the story and gameplay.",
    whoItsFor: "Curious explorers, gamers, general public, teens",
    depthLabel: "Fantasy & everyday language",
    clueLabel: "More clues visible",
    icon: "sparkles",
    accentColor: "#5EEAD4",
  },
  {
    id: "nursing_student",
    label: "Health Student",
    subtitle: "Pre-nursing, allied health, or early nursing programs",
    description:
      "Balanced clinical terminology alongside clear explanations. Nursing process framing (assess → plan → intervene → evaluate) with moderate clue visibility. Grows your medical vocabulary while you play.",
    whoItsFor: "Pre-nursing students, allied health learners, medical assistants",
    depthLabel: "Clinical terms with explanations",
    clueLabel: "Moderate clue visibility",
    icon: "school-outline",
    accentColor: "#60A5FA",
  },
  {
    id: "nclex",
    label: "NCLEX Prep",
    subtitle: "Priority-setting, nursing-process focus, exam-style",
    description:
      "Cases framed around NCLEX-style clinical reasoning: priority assessment, delegation, safety. Fewer automatic hints — you're expected to reason it out. Concise rationales reinforce exam thinking.",
    whoItsFor: "Nursing students preparing for NCLEX-RN or NCLEX-PN",
    depthLabel: "Exam-style clinical language",
    clueLabel: "Fewer hints — reason it out",
    icon: "clipboard-outline",
    accentColor: "#F59E0B",
  },
  {
    id: "professional",
    label: "Clinician Review",
    subtitle: "Licensed clinician, advanced student, or educator",
    description:
      "Full clinical language with minimal hand-holding. Clues are hidden by default; pathophysiology reasoning is front and center. Use Clinica as a quick-play clinical refresher or teaching tool.",
    whoItsFor: "RNs, APNs, MDs, PhDs, health educators, advanced students",
    depthLabel: "Full clinical detail, concise",
    clueLabel: "Hidden clues — advanced reasoning",
    icon: "briefcase-outline",
    accentColor: "#A78BFA",
  },
];

export default function LearningProfileScreen() {
  const router = useRouter();
  const { player, setLearningProfile } = usePlayer();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const current = player?.learning_profile ?? null;
  const currentLabel = learningProfileLabel(current);

  async function handleSelect(profileId: string) {
    if (busy || profileId === current) return;
    setBusy(true);
    try {
      await setLearningProfile(profileId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero}>
        <LinearGradient
          colors={[COLORS.brandTertiary, COLORS.surface]}
          style={StyleSheet.absoluteFillObject}
        />
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/university")}
          testID="learning-profile-back"
        >
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>PERSONALIZATION</Text>
        <Text style={styles.title}>How Do You Want to Learn?</Text>
        <Text style={styles.sub}>
          Clinica adjusts explanation depth and clue visibility so the same case can teach different learners. You can change this anytime.
        </Text>
        {current && (
          <View style={styles.currentPill}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.brand} />
            <Text style={styles.currentTxt}>Currently: {currentLabel}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {saved && (
          <View style={styles.savedBanner}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            <Text style={styles.savedTxt}>Learning style saved!</Text>
          </View>
        )}

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.noticeTxt}>
            Choosing a style does not affect rewards, progression, or game balance — only how Clinica explains clinical concepts and how many clues are visible during encounters.
          </Text>
        </View>

        {PROFILE_OPTIONS.map((opt) => {
          const isSelected = current === opt.id ||
            (opt.id === "curious" && ["nonmedical", "rpg", "cozy", "teen"].includes(current ?? "")) ||
            (opt.id === "nursing_student" && ["nursingStudent", "preNursing", "medical_learner"].includes(current ?? "")) ||
            (opt.id === "nclex" && current === "nclexPrep") ||
            (opt.id === "professional" && current === "healthcareProfessional");

          return (
            <Pressable
              key={opt.id}
              style={[
                styles.optionCard,
                isSelected && { borderColor: opt.accentColor, borderWidth: 2 },
              ]}
              onPress={() => handleSelect(opt.id)}
              disabled={busy}
              testID={`learning-profile-${opt.id}`}
            >
              <View style={[styles.optionHeader, { borderBottomColor: opt.accentColor + "30" }]}>
                <View style={[styles.optionIcon, { backgroundColor: opt.accentColor + "20" }]}>
                  <Ionicons name={opt.icon as any} size={20} color={opt.accentColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, isSelected && { color: opt.accentColor }]}>{opt.label}</Text>
                  <Text style={styles.optionSubtitle}>{opt.subtitle}</Text>
                </View>
                {isSelected && (
                  <View style={[styles.selectedBadge, { backgroundColor: opt.accentColor + "20" }]}>
                    <Ionicons name="checkmark" size={14} color={opt.accentColor} />
                    <Text style={[styles.selectedBadgeTxt, { color: opt.accentColor }]}>ACTIVE</Text>
                  </View>
                )}
              </View>

              <View style={styles.optionBody}>
                <Text style={styles.optionDesc}>{opt.description}</Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaChip}>
                    <Ionicons name="book-outline" size={11} color={COLORS.onSurfaceTertiary} />
                    <Text style={styles.metaChipTxt}>{opt.depthLabel}</Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Ionicons name="eye-outline" size={11} color={COLORS.onSurfaceTertiary} />
                    <Text style={styles.metaChipTxt}>{opt.clueLabel}</Text>
                  </View>
                </View>

                <Text style={styles.whoTxt}>
                  <Text style={{ fontWeight: "700" }}>Best for: </Text>
                  {opt.whoItsFor}
                </Text>
              </View>
            </Pressable>
          );
        })}

        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footerTxt}>
            You can change your learning style at any time from Profile → Settings or by returning to this screen. Your choice has no effect on rewards, currencies, or game progression.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: 4 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)", marginBottom: SPACING.sm,
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 12, marginTop: 2, lineHeight: 17 },
  currentPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginTop: SPACING.sm, alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: COLORS.brand + "18", borderWidth: 1, borderColor: COLORS.brand + "40",
  },
  currentTxt: { color: COLORS.brand, fontSize: 11, fontWeight: "700" },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },

  savedBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.success + "20", borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.success + "40",
  },
  savedTxt: { color: COLORS.success, fontSize: 13, fontWeight: "700" },

  notice: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, backgroundColor: COLORS.surfaceSecondary,
  },
  noticeTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 15 },

  optionCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
  },
  optionHeader: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.md, borderBottomWidth: 1,
  },
  optionIcon: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
  },
  optionLabel: { color: COLORS.onSurface, fontSize: 16, fontWeight: "700" },
  optionSubtitle: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  selectedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  selectedBadgeTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  optionBody: { padding: SPACING.md, gap: SPACING.sm },
  optionDesc: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },
  metaRow: { flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap" },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.border,
  },
  metaChipTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "600" },
  whoTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 16 },

  footer: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, backgroundColor: COLORS.surfaceSecondary,
    marginTop: SPACING.sm,
  },
  footerTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 15 },
});
