import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { goBack } from "@/src/utils/navigation";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { ModeCard } from "@/src/components/ModeCard";
import { BannerCard } from "@/src/components/ModeBanners";
import { NarratorGuide } from "@/src/components/NarratorGuide";
import { MessageDialog } from "@/src/components/WebAlert";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { useTutorial } from "@/src/game/tutorialStore";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { FeatureLockedView, useFeatureGate } from "@/src/components/FeatureGate";
import { ModeCardDef, UNIVERSITY_FUTURE_MODES } from "@/src/game/modeHub";
import { firstIncompleteLotusNode, isLotusNodeComplete } from "@/src/game/lotusLessons";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { OnboardingProgressBar } from "@/src/components/onboarding/OnboardingProgressBar";
import { SceneTransition } from "@/src/components/onboarding/SceneTransition";

// ── Cue Hunt featured hero banner ────────────────────────────────────────────
// Shown above every other University section so the first tap a new learner
// makes leads to a visual, playable hook rather than a reading passage.
function CueHuntHeroBanner({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.cueCard} onPress={onPress} testID="university-banner-cue-hunt">
      <LinearGradient
        colors={["#0D3B38", "#1B5550", "#0D2E2B"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* subtle radial glow top-right */}
      <View style={styles.cueGlow} pointerEvents="none" />

      <View style={styles.cueTop}>
        <View style={styles.cueBadge}>
          <Ionicons name="eye-outline" size={11} color="#2DD4BF" />
          <Text style={styles.cueBadgeTxt}>PLAY FIRST</Text>
        </View>
      </View>

      <View style={styles.cueBody}>
        <Text style={styles.cueKicker}>CUE HUNT</Text>
        <Text style={styles.cueTitle}>The Fading Apprentice</Text>
        <Text style={styles.cueSub}>Find what others missed.</Text>
      </View>

      <View style={styles.cueCtaRow}>
        <View style={styles.cueCtaBtn}>
          <Text style={styles.cueCtaTxt}>Start Cue Hunt</Text>
          <Ionicons name="arrow-forward" size={13} color="#0B1A18" />
        </View>
      </View>
    </Pressable>
  );
}

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
  const { activeTutorialId } = useTutorial();
  const [info, setInfo] = useState<{ title: string; message: string } | null>(null);
  const [showFuture, setShowFuture] = useState(false);

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
  // True once the player finishes the full Fading Apprentice chain (Step 9 reward screen)
  const chainComplete = isLotusNodeComplete(player, "recognizing-cues-hydration");
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
        {/* Only show the step-tracker and System narrator card when no tutorial
            overlay is active — the overlay already provides the active instruction
            and stacking a second guide card on top creates redundant guidance. */}
        {!activeTutorialId && (
          <SceneTransition trigger="university-arrival">
            {isNewLearner && nextLotusNode && <OnboardingProgressBar step="University" />}

            <NarratorGuide
              message={
                isNewLearner
                  ? "…This is the University. Start with Cue Hunt above — a live case where you tap the clues a real patient is showing. Or take a Lotus Lesson to study the reasoning. Both paths reward heroes."
                  : "You return to study. Good. Run a Cue Hunt, take a lesson, recruit healers, or consult the Codex. The choice is yours."
              }
              ctaLabel={isNewLearner ? "Start Cue Hunt" : undefined}
              onPress={isNewLearner ? () => router.push("/university/cue-hunt" as any) : undefined}
              testID="university-narrator"
            />
          </SceneTransition>
        )}

        {/* CUE HUNT — featured first, the primary first-click for new learners */}
        <CueHuntHeroBanner onPress={() => router.push("/university/cue-hunt" as any)} />

        {/* Chain track — shows the 4 steps of The Fading Apprentice case chain */}
        <ChainTrack chainDone={chainComplete} />

        {/* LESSONS — available below, not removed */}
        <Text style={styles.sectionHeading}>LESSONS</Text>
        <BannerCard
          mode={LESSONS_BANNER}
          height={120}
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
            <MoreRow
              icon="layers-outline"
              title="Stabilize Stack: ABCDE"
              desc="A second ordering challenge — a different patient, different stakes."
              onPress={() => router.push("/university/stabilize-stack" as any)}
              testID="university-more-stabilize-abcde"
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

// ── ChainTrack ──────────────────────────────────────────────────────────────
// Shows the 4-step "Fading Apprentice" case chain below the hero banner.
// When chainDone is true all steps glow and a completion badge appears.
const CHAIN_STEPS = [
  { icon: "eye-outline" as const, label: "Cue Hunt", color: "#2DD4BF" },
  { icon: "flash-outline" as const, label: "Triage", color: "#F59E0B" },
  { icon: "layers-outline" as const, label: "Stabilize", color: "#38BDF8" },
  { icon: "ribbon-outline" as const, label: "Reward", color: "#D4AF37" },
];

function ChainTrack({ chainDone }: { chainDone: boolean }) {
  return (
    <View style={chainStyles.wrap}>
      <View style={chainStyles.headerRow}>
        <Text style={chainStyles.chainLabel}>THE FADING APPRENTICE · CASE CHAIN</Text>
        {chainDone && (
          <View style={chainStyles.doneBadge}>
            <Ionicons name="checkmark-circle" size={11} color="#22C55E" />
            <Text style={chainStyles.doneTxt}>COMPLETE</Text>
          </View>
        )}
      </View>

      <View style={chainStyles.stepsRow}>
        {CHAIN_STEPS.map((step, i) => (
          <React.Fragment key={step.label}>
            <View style={chainStyles.stepWrap}>
              <View
                style={[
                  chainStyles.stepCircle,
                  {
                    borderColor: chainDone ? step.color + "88" : step.color + "38",
                    backgroundColor: chainDone ? step.color + "18" : "transparent",
                  },
                ]}
              >
                <Ionicons
                  name={step.icon}
                  size={13}
                  color={chainDone ? step.color : COLORS.onSurfaceTertiary}
                />
              </View>
              <Text
                style={[
                  chainStyles.stepLabel,
                  { color: chainDone ? step.color : COLORS.onSurfaceTertiary },
                ]}
              >
                {step.label}
              </Text>
            </View>
            {i < CHAIN_STEPS.length - 1 && (
              <View
                style={[
                  chainStyles.connector,
                  chainDone && { backgroundColor: "#2DD4BF30" },
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>

      {!chainDone && (
        <Text style={chainStyles.hint}>
          Start Cue Hunt above — each step unlocks the next.
        </Text>
      )}
    </View>
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

  // ── Cue Hunt featured hero banner ────────────────────────────────────────
  cueCard: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    height: 172,
    borderWidth: 1.5,
    borderColor: "#2DD4BF35",
  },
  cueGlow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#2DD4BF18",
  },
  cueTop: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },
  cueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2DD4BF20",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#2DD4BF40",
  },
  cueBadgeTxt: {
    color: "#2DD4BF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  cueBody: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    justifyContent: "center",
    gap: 2,
  },
  cueKicker: {
    color: "#2DD4BF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  cueTitle: {
    color: COLORS.onSurface,
    fontSize: 20,
    fontWeight: "300",
    letterSpacing: 0.3,
  },
  cueSub: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  cueCtaRow: {
    padding: SPACING.md,
    paddingTop: SPACING.sm,
    alignItems: "flex-start",
  },
  cueCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2DD4BF",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  cueCtaTxt: {
    color: "#0B1A18",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  // ── Rapid Triage compact row ──────────────────────────────────────────────
  triageCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "#F59E0B25",
  },
  triageIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  triageInfo: { flex: 1, gap: 2 },
  triageTitle: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: "700",
  },
  triageSub: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 11,
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

// ── ChainTrack styles ────────────────────────────────────────────────────────
const chainStyles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#2DD4BF20",
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chainLabel: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  doneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#22C55E18",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: "#22C55E30",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  doneTxt: {
    color: "#22C55E",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepWrap: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  connector: {
    height: 1.5,
    width: 12,
    backgroundColor: "#2A3A4A",
    marginBottom: 16,
    flexShrink: 0,
  },
  hint: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
    paddingTop: 2,
  },
});
