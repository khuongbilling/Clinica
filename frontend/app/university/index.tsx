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

const RECRUIT_BANNER: ModeCardDef = {
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
};

const TRAINING_BANNER: ModeCardDef = {
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
};

const LIBRARY_BANNER: ModeCardDef = {
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
};

const CLASSTREE_BANNER: ModeCardDef = {
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
};

export default function UniversityHubScreen() {
  const router = useRouter();
  const { player } = usePlayer();
  const gate = useFeatureGate("university");
  const heroesGate = useFeatureGate("hall_of_heroes");
  const { isCompleted, startTutorial } = useTutorial();
  const [info, setInfo] = useState<{ title: string; message: string } | null>(null);
  const [showFuture, setShowFuture] = useState(false);

  useEffect(() => {
    if (!isCompleted("firstLesson")) {
      const t = setTimeout(() => startTutorial("firstLesson"), 700);
      return () => clearTimeout(t);
    }
  }, []);

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
  if (!gate.unlocked) return <FeatureLockedView title="Clinica University" reason={gate.reason} />;

  const nextLotusNode = firstIncompleteLotusNode(player);
  const lessonsCompleted = player.lessons_completed?.length ?? 0;
  const isNewLearner = lessonsCompleted === 0;
  const heroCount = player.heroes_owned?.length ?? 0;
  // Show Recruitment once the player has completed at least one lesson.
  const showRecruitment = !isNewLearner;
  // Show Training Hall once the player has at least 2 heroes to train.
  const showTraining = heroCount >= 2;
  // Show Codex link as an optional reference once any lesson is done.
  const showCodex = !isNewLearner;
  // Class Tree is display-only until Level 5 and not useful to new learners early.
  const showClassTree = (player.player_level ?? 1) >= 5;
  // Career Explorer is informational; surface it at Level 3 or after 3+ lessons.
  const showCareerExplorer = (player.player_level ?? 1) >= 3 || lessonsCompleted >= 3;
  // Hall of Heroes is gated by its own feature gate.
  const showHeroes = heroesGate.unlocked;
  // "More" section is relevant once the player has progressed beyond the first lesson.
  const showMore = !isNewLearner;

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

          <NarratorGuide
            message={
              isNewLearner
                ? "…This is the University. You were recalled not because you were ready — but because you can still learn. Begin with a single lesson. I will be watching your reasoning grow."
                : "You return to study. Good. Take a lesson to sharpen your reasoning, recruit and train your healers, or consult the Codex. The choice is yours."
            }
            ctaLabel={nextLotusNode ? "Begin a Lesson" : undefined}
            onPress={nextLotusNode ? () => router.push("/university/lessons" as any) : undefined}
            testID="university-narrator"
          />
        </SceneTransition>

        {/* BEGIN HERE — always shown, the primary learning path */}
        <Text style={styles.sectionHeading}>BEGIN HERE</Text>
        <BannerCard
          mode={LESSONS_BANNER}
          height={158}
          onPress={() => router.push("/university/lessons" as any)}
          testID="university-banner-lessons"
        />

        {/* GROW YOUR HEALERS — revealed progressively */}
        {(showRecruitment || showTraining) && (
          <Text style={styles.sectionHeading}>GROW YOUR HEALERS</Text>
        )}
        {showRecruitment && (
          <BannerCard
            mode={RECRUIT_BANNER}
            height={120}
            onPress={() => router.push("/university/recruit" as any)}
            testID="university-banner-uni-recruit"
          />
        )}
        {showTraining && (
          <BannerCard
            mode={TRAINING_BANNER}
            height={120}
            onPress={() => router.push("/university/training" as any)}
            testID="university-banner-uni-training"
          />
        )}

        {/* KNOWLEDGE & PATHS — revealed after first lesson */}
        {(showCodex || showClassTree) && (
          <Text style={styles.sectionHeading}>KNOWLEDGE & PATHS</Text>
        )}
        {showCodex && (
          <BannerCard
            mode={LIBRARY_BANNER}
            height={120}
            onPress={() => router.push("/(tabs)/codex" as any)}
            testID="university-banner-uni-library"
          />
        )}
        {showClassTree && (
          <BannerCard
            mode={CLASSTREE_BANNER}
            height={120}
            onPress={() => router.push("/class-tree" as any)}
            testID="university-banner-uni-classtree"
          />
        )}

        {/* MORE — revealed after first lesson */}
        {showMore && (
          <>
            <Text style={styles.sectionHeading}>MORE AT UNIVERSITY</Text>
            {showHeroes && (
              <MoreRow
                icon="ribbon"
                title="Hall of Heroes"
                desc="Certify heroes and raise their star."
                onPress={() => router.push("/(tabs)/heroes" as any)}
                testID="university-more-heroes"
              />
            )}
            {showCareerExplorer && (
              <MoreRow
                icon="compass"
                title="Career Explorer"
                desc="Healthcare is not one road. Discover the many paths a healer can walk."
                onPress={() => router.push("/university/career-explorer" as any)}
                testID="university-more-career-explorer"
              />
            )}
            <MoreRow
              icon="options-outline"
              title="Learning Style"
              desc="Personalize explanation depth and clue visibility to match how you learn."
              onPress={() => router.push("/learning-profile" as any)}
              testID="university-more-learning-profile"
            />

            {/* Future Learning — collapsed by default */}
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
          </>
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
