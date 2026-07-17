import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MessageDialog } from "@/src/components/WebAlert";
import { useTutorial } from "@/src/game/tutorialStore";
import { TUTORIAL_LABELS, TUTORIALS, type TutorialId } from "@/src/game/tutorials";
import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// Route to navigate to after marking a tutorial for replay, so the overlay
// actually fires on the correct screen.
const REPLAY_ROUTES: Partial<Record<TutorialId, string>> = {
  prologueBattle:   "/battle?enemyId=dehydration_wisp&training=1&prologue=tutorial&replay=1",
  firstBattle:      "/shift",
  firstKingdom:     "/(tabs)/kingdom",
  firstSummon:      "/university/recruit",
  firstWardDefense: "/ward-defense",
  firstHeroTeam:    "/(tabs)/heroes",
  firstLotusEntry:  "/lotus-journal",
  systemWardHub:    "/shift",
  systemShops:      "/shop",
  cueHuntIntro:     "/university/cue-hunt",
  rapidTriageIntro: "/university/rapid-triage",
  stabilizeIntro:   "/university/stabilize-stack",
  mealcraftIntro:   "/mealcraft",
};

// Grouped list of tutorials. System onboarding (systemHubIntro) is a
// one-time story beat that re-runs only via a full account reset, so it is
// omitted intentionally; all others are replayable.
interface TutorialGroup {
  label: string;
  ids: TutorialId[];
}

const TUTORIAL_GROUPS: TutorialGroup[] = [
  {
    label: "Onboarding",
    ids: ["prologueBattle", "firstBattle", "systemWardHub", "systemShops"],
  },
  {
    label: "Heroes & Recruitment",
    ids: ["firstHeroTeam", "firstSummon"],
  },
  {
    label: "University Mini-Games",
    ids: ["cueHuntIntro", "rapidTriageIntro", "stabilizeIntro", "mealcraftIntro"],
  },
  {
    label: "Game Modes",
    ids: ["firstWardDefense"],
  },
  {
    label: "Realm & Wellness",
    ids: ["firstKingdom", "firstLotusEntry"],
  },
];

const TUTORIAL_DESC: Partial<Record<TutorialId, string>> = {
  prologueBattle:   "The guided first shift — Scout, Stabilize, Counter, Reassess.",
  firstBattle:      "Care Chain basics: matching skills to what the patient needs.",
  systemWardHub:    "The System introduces the Ward and sends you to the University.",
  systemShops:      "The System introduces the Apothecary Market and currency spending.",
  firstHeroTeam:    "Hall of Heroes — setting up your active team for clinical shifts.",
  firstSummon:      "Recruitment Hall — calling new healers with Summoning Shards.",
  cueHuntIntro:     "Spot three hidden clinical cues in the scene; tap each one.",
  rapidTriageIntro: "Sort three patients by urgency — Emergency, Urgent, or Routine.",
  stabilizeIntro:   "Arrange three care steps in the correct safe sequence.",
  mealcraftIntro:   "Build a balanced plate starting with protein.",
  firstWardDefense: "Deploy healer units, manage AP, and synthesize stronger units.",
  firstKingdom:     "Sanctuary basics: inventory, placing a building, realm growth.",
  firstLotusEntry:  "Lotus Plate Journal — logging your first meal or check-in.",
};

export default function TutorialCenterScreen() {
  const router = useRouter();
  const { completed, replayTutorial, resetTutorials } = useTutorial();
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function handleReplay(id: TutorialId) {
    await replayTutorial(id);
    const route = REPLAY_ROUTES[id] ?? "/(tabs)";
    router.replace(route as any);
  }

  async function doResetAll() {
    setConfirmReset(false);
    setResetting(true);
    try {
      await resetTutorials();
    } finally {
      setResetting(false);
    }
  }

  const allIds = TUTORIAL_GROUPS.flatMap((g) => g.ids);
  const doneCount = allIds.filter((id) => completed[id]).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router, "/(tabs)/profile")} style={styles.backBtn} hitSlop={10} testID="tutorial-center-back">
            <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>SETTINGS</Text>
            <Text style={styles.title}>Tutorial Replay Center</Text>
          </View>
          <View style={styles.progressPill}>
            <Text style={styles.progressPillTxt}>{doneCount}/{allIds.length} done</Text>
          </View>
        </View>

        <Text style={styles.note}>
          Replaying a tutorial only re-shows its coach marks — it never rewards, resets, or
          changes anything about your saved healer.
        </Text>

        {TUTORIAL_GROUPS.map((group) => (
          <View key={group.label}>
            <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text>
            <View style={styles.list}>
              {group.ids.map((id, i) => (
                <View key={id}>
                  <View style={styles.row} testID={`tutorial-center-row-${id}`}>
                    <View style={[styles.statusDot, { backgroundColor: completed[id] ? COLORS.success : COLORS.onSurfaceTertiary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{TUTORIAL_LABELS[id]}</Text>
                      <Text style={styles.rowDesc}>{TUTORIAL_DESC[id]}</Text>
                      <Text style={styles.rowMeta}>
                        {TUTORIALS[id].length} step{TUTORIALS[id].length !== 1 ? "s" : ""}
                        {" · "}
                        {completed[id] ? "✓ Completed" : "Not yet completed"}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.replayBtn}
                      onPress={() => handleReplay(id)}
                      testID={`tutorial-center-replay-${id}`}
                    >
                      <Ionicons name="play" size={13} color={COLORS.onBrand} />
                      <Text style={styles.replayBtnTxt}>Replay</Text>
                    </Pressable>
                  </View>
                  {i < group.ids.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.dangerZone}>
          <Text style={styles.dangerLabel}>RESET</Text>
          <Pressable
            style={styles.resetBtn}
            onPress={() => setConfirmReset(true)}
            disabled={resetting}
            testID="tutorial-center-reset-all"
          >
            <Ionicons name="refresh" size={14} color={COLORS.error} />
            <Text style={styles.resetTxt}>Reset All Tutorials</Text>
          </Pressable>
        </View>
      </ScrollView>

      <MessageDialog
        visible={confirmReset}
        title="Reset All Tutorials?"
        message="This re-arms every coach-mark tutorial so it shows again. Your class, heroes, progress, and everything else in your save stay exactly as they are."
        cancelLabel="Cancel"
        confirmLabel="Reset Tutorials"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={doResetAll}
        testID="tutorial-center-reset-dialog"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.xs },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceSecondary },
  kicker: { color: COLORS.brand, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 22, fontWeight: "700" },
  progressPill: { backgroundColor: COLORS.brand + "20", borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.brand + "40" },
  progressPillTxt: { color: COLORS.brand, fontSize: 11, fontWeight: "700" },
  note: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18 },
  groupLabel: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginTop: SPACING.sm, marginBottom: 4 },
  list: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, alignSelf: "flex-start" },
  rowTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700" },
  rowDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2, lineHeight: 15 },
  rowMeta: { color: COLORS.onSurfaceTertiary, fontSize: 10, marginTop: 4, letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.md },
  replayBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.brand,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.sm,
  },
  replayBtnTxt: { color: COLORS.onBrand, fontSize: 11, fontWeight: "700" },
  dangerZone: { borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.error + "35", backgroundColor: COLORS.error + "08" },
  dangerLabel: { color: COLORS.error, fontSize: 9, letterSpacing: 2, fontWeight: "700", paddingTop: SPACING.sm, paddingHorizontal: SPACING.md },
  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: SPACING.md },
  resetTxt: { color: COLORS.error, fontSize: 12, fontWeight: "600" },
});
