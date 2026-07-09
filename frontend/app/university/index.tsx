import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { goBack } from "@/src/utils/navigation";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { ModeCard } from "@/src/components/ModeCard";
import { BannerCard } from "@/src/components/ModeBanners";
import { NarratorGuide } from "@/src/components/NarratorGuide";
import { MessageDialog } from "@/src/components/WebAlert";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { FeatureLockedView, useFeatureGate } from "@/src/components/FeatureGate";
import { ModeCardDef, UNIVERSITY_FUTURE_MODES } from "@/src/game/modeHub";
import { firstIncompleteLotusNode } from "@/src/game/lotusLessons";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { OnboardingProgressBar } from "@/src/components/onboarding/OnboardingProgressBar";
import { SceneTransition } from "@/src/components/onboarding/SceneTransition";

// The primary "begin here" learning banner — the heart of the University.
const LESSONS_BANNER: ModeCardDef = {
  id: "uni-lessons",
  title: "Lotus Lessons",
  subtitle: "Short, gentle lessons that teach real care — and reward your first heroes.",
  icon: "book",
  accentColor: COLORS.brand,
  status: "active",
  size: "large",
  imageKey: "uni-lessons",
  route: "/university/lessons",
  rewardPreview: "Start here · earn your first heroes",
  artBrief: "",
};

// Grow-your-healers banners.
const GROW_BANNERS: ModeCardDef[] = [
  {
    id: "uni-recruit",
    title: "University Recruitment",
    subtitle: "Enroll new healers with Hero Shards, Trainees, and Credits.",
    icon: "sparkles",
    accentColor: "#F59E0B",
    status: "active",
    size: "medium",
    imageKey: "uni-recruit",
    route: "/university/recruit",
    artBrief: "",
  },
  {
    id: "uni-training",
    title: "Training Hall",
    subtitle: "Level up your healers toward their Certification Star's cap.",
    icon: "trending-up",
    accentColor: "#5B9BD5",
    status: "active",
    size: "medium",
    imageKey: "uni-training",
    route: "/university/training",
    artBrief: "",
  },
];

// Knowledge-and-paths banners.
const KNOWLEDGE_BANNERS: ModeCardDef[] = [
  {
    id: "uni-library",
    title: "Research Library",
    subtitle: "Browse the Great Codex — knowledge, battle mechanics, field notes.",
    icon: "library",
    accentColor: "#22D3EE",
    status: "active",
    size: "medium",
    imageKey: "uni-library",
    route: "/(tabs)/codex",
    artBrief: "",
  },
  {
    id: "uni-classtree",
    title: "Class Tree",
    subtitle: "Choose a Player Class and unlock its ability tree as you level.",
    icon: "git-network",
    accentColor: "#A78BFA",
    status: "active",
    size: "medium",
    imageKey: "uni-classtree",
    route: "/class-tree",
    artBrief: "",
  },
];

export default function UniversityHubScreen() {
  const router = useRouter();
  const { player } = usePlayer();
  const gate = useFeatureGate("university");
  const heroesGate = useFeatureGate("hall_of_heroes");
  const { isCompleted, startTutorial, onRequiredAction } = useTutorial();
  const [info, setInfo] = useState<{ title: string; message: string } | null>(null);
  const [showFuture, setShowFuture] = useState(false);

  useEffect(() => {
    if (!isCompleted("firstLesson")) {
      const t = setTimeout(() => startTutorial("firstLesson"), 700);
      return () => clearTimeout(t);
    }
  }, []);

  // Deep links reboot the app; render nothing heavy but never a blank crash.
  if (!player) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loading}>
          <Ionicons name="school-outline" size={28} color={COLORS.brand} />
          <ActivityIndicator size="small" color={COLORS.brand} style={{ marginTop: 4 }} />
          <Text style={styles.loadingTxt}>Opening Clinica University…</Text>
        </View>
      </SafeAreaView>
    );
  }
  // Block direct navigation into a still-locked University.
  if (!gate.unlocked) return <FeatureLockedView title="Clinica University" reason={gate.reason} />;

  const nextLotusNode = firstIncompleteLotusNode(player);
  const isNewLearner = (player.lessons_completed?.length ?? 0) === 0;

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
          {isNewLearner && nextLotusNode && <OnboardingProgressBar step="University" />}

          {/* The System — the single narrator voice of the game. */}
          <NarratorGuide
            message={
              isNewLearner
                ? "…This is the University. You were recalled not because you were ready — but because you can still learn. Begin with a single lesson. I will be watching your reasoning grow."
                : "You return to study. Good. Take a lesson to sharpen your reasoning, recruit and train your healers, or consult the Codex. The choice is yours."
            }
            objective={
              isNewLearner && nextLotusNode
                ? `Complete your first lesson — “${nextLotusNode.title}” — to earn your first heroes.`
                : undefined
            }
            ctaLabel={nextLotusNode ? "Begin a Lesson" : undefined}
            onPress={nextLotusNode ? () => router.push("/university/lessons" as any) : undefined}
            testID="university-narrator"
          />
        </SceneTransition>

        {/* BEGIN HERE — the primary learning path */}
        <Text style={styles.sectionHeading}>BEGIN HERE</Text>
        <BannerCard
          mode={LESSONS_BANNER}
          height={158}
          onPress={() => router.push("/university/lessons" as any)}
          testID="university-banner-lessons"
        />

        {/* GROW YOUR HEALERS */}
        <Text style={styles.sectionHeading}>GROW YOUR HEALERS</Text>
        {GROW_BANNERS.map((m) => (
          <BannerCard
            key={m.id}
            mode={m}
            height={120}
            onPress={() => m.route && router.push(m.route as any)}
            testID={`university-banner-${m.id}`}
          />
        ))}

        {/* KNOWLEDGE & PATHS */}
        <Text style={styles.sectionHeading}>KNOWLEDGE & PATHS</Text>
        {KNOWLEDGE_BANNERS.map((m) => (
          <BannerCard
            key={m.id}
            mode={m}
            height={120}
            onPress={() => m.route && router.push(m.route as any)}
            testID={`university-banner-${m.id}`}
          />
        ))}

        {/* MORE — compact secondary links to keep the page uncluttered */}
        <Text style={styles.sectionHeading}>MORE AT UNIVERSITY</Text>
        <MoreRow
          icon="ribbon"
          title="Hall of Heroes"
          desc={heroesGate.unlocked ? "Certify heroes and raise their star." : (heroesGate.reason ?? "Unlocks soon.")}
          locked={!heroesGate.unlocked}
          onPress={() => router.push("/(tabs)/heroes" as any)}
          testID="university-more-heroes"
        />
        <MoreRow
          icon="business"
          title="Department Schools"
          desc="Specialized schools for each role. More opening soon."
          onPress={() => router.push("/university/schools" as any)}
          testID="university-more-schools"
        />
        <MoreRow
          icon="compass"
          title="Career Explorer"
          desc="Healthcare is not one road. Discover the many paths a healer can walk."
          onPress={() => router.push("/university/career-explorer" as any)}
          testID="university-more-career-explorer"
        />
        <MoreRow
          icon="map-outline"
          title="Academy Orientation Path"
          desc="Your first-week journey — milestones, next steps, and day-by-day guidance."
          onPress={() => router.push("/academy-path" as any)}
          testID="university-more-academy-path"
        />
        <MoreRow
          icon="options-outline"
          title="Learning Style"
          desc="Personalize explanation depth and clue visibility to match how you learn."
          onPress={() => router.push("/learning-profile" as any)}
          testID="university-more-learning-profile"
        />

        {/* FUTURE LEARNING — collapsed by default to reduce clutter */}
        <Pressable style={styles.futureToggle} onPress={() => setShowFuture((v) => !v)} testID="university-future-toggle">
          <Ionicons name="time-outline" size={14} color={COLORS.onSurfaceSecondary} />
          <Text style={styles.futureToggleTxt}>Future Learning ({UNIVERSITY_FUTURE_MODES.length})</Text>
          <Ionicons name={showFuture ? "chevron-up" : "chevron-down"} size={16} color={COLORS.onSurfaceTertiary} />
        </Pressable>
        {showFuture && (
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
        )}

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

      <TutorialOverlay />
    </SafeAreaView>
  );
}

function MoreRow({
  icon, title, desc, locked, onPress, testID,
}: {
  icon: string; title: string; desc: string; locked?: boolean; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable
      style={[styles.moreRow, locked && styles.moreRowLocked]}
      disabled={locked}
      onPress={onPress}
      testID={testID}
    >
      <View style={styles.moreIcon}>
        <Ionicons name={icon as any} size={18} color={COLORS.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.moreTitle}>{title}</Text>
        <Text style={styles.moreDesc}>{desc}</Text>
      </View>
      <Ionicons name={locked ? "lock-closed" : "chevron-forward"} size={16} color={COLORS.onSurfaceTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm },
  loadingTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13 },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: 4 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)", marginBottom: SPACING.sm,
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 26, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  sectionHeading: {
    color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "800",
    letterSpacing: 1.5, marginTop: SPACING.sm,
  },
  moreRow: {
    flexDirection: "row", gap: SPACING.md, alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  moreRowLocked: { opacity: 0.5 },
  moreIcon: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.brand + "40",
  },
  moreTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  moreDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  futureToggle: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, marginTop: SPACING.sm,
  },
  futureToggleTxt: { flex: 1, color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  footNote: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.sm },
  footNoteTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 15 },
});
