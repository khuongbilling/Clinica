import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { goBack } from "@/src/utils/navigation";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { ModeCard } from "@/src/components/ModeCard";
import { MessageDialog } from "@/src/components/WebAlert";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { FeatureLockedView, useFeatureGate } from "@/src/components/FeatureGate";
import { RewardPreview } from "@/src/components/RewardPreview";
import { UNIVERSITY_FUTURE_MODES } from "@/src/game/modeHub";
import { firstIncompleteLotusNode } from "@/src/game/lotusLessons";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { OnboardingProgressBar } from "@/src/components/onboarding/OnboardingProgressBar";
import { SceneTransition } from "@/src/components/onboarding/SceneTransition";

const MENU: { id: string; title: string; desc: string; icon: string; route?: string }[] = [
  {
    id: "recruit",
    title: "University Recruitment",
    desc: "Enroll new healers, earn Hero Shards, Class Trainees, and University Credits.",
    icon: "sparkles",
    route: "/university/recruit",
  },
  {
    id: "certification",
    title: "Hero Certification",
    desc: "Raise a hero's Certification Star in the Hall of Heroes.",
    icon: "ribbon",
    route: "/(tabs)/heroes",
  },
  {
    id: "training",
    title: "Training Hall",
    desc: "Level up your heroes toward their Certification Star's level cap.",
    icon: "trending-up",
    route: "/university/training",
  },
  {
    id: "schools",
    title: "Department Schools",
    desc: "Specialized schools for each role. More opening soon.",
    icon: "business",
    route: "/university/schools",
  },
  {
    id: "lessons",
    title: "Lessons & Simulations",
    desc: "Quick lessons, quizzes, and simulation cases that translate real health concepts into battle skills.",
    icon: "book",
    route: "/university/lessons",
  },
  {
    id: "library",
    title: "Research Library",
    desc: "Browse the Great Codex — unlocked clinical knowledge, battle mechanics, and enemy field notes.",
    icon: "library",
    route: "/(tabs)/codex",
  },
  {
    id: "class-tree",
    title: "Class Tree",
    desc: "Pick a Player Class and unlock its ability tree as you level up.",
    icon: "git-network",
    route: "/class-tree",
  },
];

export default function UniversityHubScreen() {
  const router = useRouter();
  const { player } = usePlayer();
  const gate = useFeatureGate("university");
  const heroesGate = useFeatureGate("hall_of_heroes");
  const [info, setInfo] = useState<{ title: string; message: string } | null>(null);

  if (!player) return null;
  // Block direct navigation into a still-locked University.
  if (!gate.unlocked) return <FeatureLockedView title="Clinica University" reason={gate.reason} />;

  const nextLotusNode = firstIncompleteLotusNode(player);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PlayerHeader player={player} />
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/(tabs)")} hitSlop={10} testID="university-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>CLINICA UNIVERSITY</Text>
        <Text style={styles.title}>Where Your Story Begins</Text>
        <Text style={styles.sub}>Learn the way of the healer, one living case at a time.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SceneTransition trigger="university-arrival">
        {nextLotusNode && (player.lessons_completed?.length ?? 0) === 0 && (
          <OnboardingProgressBar step="University" />
        )}
        <View style={styles.mentorBox}>
          <Ionicons name="sparkles-outline" size={16} color={COLORS.brand} />
          <Text style={styles.mentorTxt}>
            "You were not recalled because you were ready. You were recalled because you can still
            learn. Every patient here is a chapter — begin with a single lesson, and the ward will
            teach you the rest."
          </Text>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Codex Shards" value={String(player.codex_shards || 0)} icon="diamond" />
          <Stat label="University Credits" value={String(player.university_credits || 0)} icon="school" />
        </View>

        <RewardPreview mode="Clinica University" />

        {nextLotusNode && (
          <Pressable
            style={styles.startHereCard}
            onPress={() => router.push("/university/lessons" as any)}
            testID="university-start-here"
          >
            <View style={styles.startHereBadge}>
              <Text style={styles.startHereBadgeTxt}>START HERE</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.md }}>
              <View style={styles.startHereIcon}>
                <Ionicons name="school" size={24} color={COLORS.onBrand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.startHereTitle}>Lotus Lessons: {nextLotusNode.title}</Text>
                <Text style={styles.startHereDesc}>
                  A short, simple path to get you back on your feet — the ward will still be there after.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.onBrand} />
            </View>
          </Pressable>
        )}
        </SceneTransition>

        {MENU.map((m) => {
          // Certification lives in the Hall of Heroes, which has its own gate.
          // Lock this link (rather than navigating into a locked screen) until
          // the Hall unlocks, so the guided-onboarding order is respected.
          const locked = m.id === "certification" && !heroesGate.unlocked;
          return (
            <Pressable
              key={m.id}
              style={[styles.card, locked && styles.cardLocked]}
              disabled={locked}
              onPress={() => m.route && router.push(m.route as any)}
              testID={`university-menu-${m.id}`}
            >
              <View style={styles.cardIcon}>
                <Ionicons name={m.icon as any} size={22} color={COLORS.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{m.title}</Text>
                <Text style={styles.cardDesc}>
                  {locked ? (heroesGate.reason ?? m.desc) : m.desc}
                </Text>
              </View>
              <Ionicons
                name={locked ? "lock-closed" : "chevron-forward"}
                size={18}
                color={COLORS.onSurfaceTertiary}
              />
            </Pressable>
          );
        })}

        <Text style={styles.sectionHeading}>Future Learning</Text>
        <View style={{ gap: SPACING.sm }}>
          {UNIVERSITY_FUTURE_MODES.map((m) => (
            <ModeCard
              key={m.id}
              mode={m}
              testID={`university-future-${m.id}`}
              onPress={() =>
                setInfo({
                  title: `${m.title} — Coming Soon`,
                  message: m.subtitle + "\n\nThis feature is still in development.",
                })
              }
            />
          ))}
        </View>

        <View style={styles.footNote}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footNoteTxt}>
            Clinica University is a game progression system only. It does not offer CME/CE credit
            or real-world continuing education certification.
          </Text>
        </View>
      </ScrollView>

      <MessageDialog
        visible={!!info}
        title={info?.title ?? ""}
        message={info?.message ?? ""}
        confirmLabel="Got it"
        onConfirm={() => setInfo(null)}
        testID="university-info-dialog"
      />
    </SafeAreaView>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon as any} size={16} color={COLORS.brand} />
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
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
  title: { color: COLORS.onSurface, fontSize: 26, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  mentorBox: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    borderWidth: 1, borderColor: COLORS.brand + "40", borderRadius: RADIUS.md,
    padding: SPACING.md, backgroundColor: COLORS.brand + "10",
  },
  mentorTxt: { flex: 1, color: COLORS.onSurface, fontSize: 13, lineHeight: 19, fontStyle: "italic" },
  startHereCard: {
    borderWidth: 1, borderColor: COLORS.brand, borderRadius: RADIUS.md,
    padding: SPACING.md, backgroundColor: COLORS.brand, gap: 4,
  },
  startHereBadge: {
    alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4,
  },
  startHereBadgeTxt: { color: COLORS.onBrand, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  startHereIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  startHereTitle: { color: COLORS.onBrand, fontSize: 15, fontWeight: "700" },
  startHereDesc: { color: COLORS.onBrand, fontSize: 11, marginTop: 2, opacity: 0.9 },
  statsRow: { flexDirection: "row", gap: SPACING.md },
  stat: {
    flex: 1, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: "center", gap: 4, borderWidth: 1, borderColor: COLORS.border,
  },
  statVal: { color: COLORS.onSurface, fontSize: 18, fontWeight: "300" },
  statLbl: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 0.5, textAlign: "center" },
  card: {
    flexDirection: "row", gap: SPACING.md, alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  cardLocked: { opacity: 0.5 },
  cardIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.brand + "40",
  },
  cardTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  cardDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  footNote: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.sm },
  footNoteTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 15 },
  sectionHeading: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginTop: SPACING.md },
});
