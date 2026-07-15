import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { ModeCard } from "@/src/components/ModeCard";
import { BannerCard } from "@/src/components/ModeBanners";
import { MessageDialog } from "@/src/components/WebAlert";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { useTutorial } from "@/src/game/tutorialStore";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { useWebBackToHub } from "@/src/hooks/useWebBackToHub";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { FeatureLockedView, useFeatureGate } from "@/src/components/FeatureGate";
import { ModeCardDef, UNIVERSITY_FUTURE_MODES } from "@/src/game/modeHub";
import { firstIncompleteLotusNode, isLotusNodeComplete } from "@/src/game/lotusLessons";
import { getChainProgress, ChainProgress } from "@/src/game/chainProgress";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import {
  completeObjective,
  getObjectiveProgress,
  markObjectiveXpGranted,
  isObjectiveXpGranted,
  ObjectiveId,
} from "@/src/game/objectiveProgress";
import { playerLevelFromXp } from "@/src/game/progression";

// ── Next-in-chain hero banner ─────────────────────────────────────────────────
// Always shows whichever game is next in the chain so returning players are
// never left guessing what to do after completing a step.

interface ChainGameDef {
  kicker: string;
  title: string;
  sub: string;
  badge: string;
  badgeIcon: React.ComponentProps<typeof Ionicons>["name"];
  ctaLabel: string;
  accentColor: string;
  gradientColors: readonly [string, string, string];
  testID: string;
}

const CHAIN_GAME_DEFS: Record<"cueHunt" | "triage" | "stabilize" | "done", ChainGameDef> = {
  cueHunt: {
    kicker: "CUE HUNT · STEP 1 OF 3",
    title: "The Fading Apprentice",
    sub: "Find what others missed — spot the clinical cues.",
    badge: "START HERE",
    badgeIcon: "eye-outline",
    ctaLabel: "Start Cue Hunt",
    accentColor: "#2DD4BF",
    gradientColors: ["#0D3B38", "#1B5550", "#0D2E2B"],
    testID: "university-banner-cue-hunt",
  },
  triage: {
    kicker: "RAPID TRIAGE · STEP 2 OF 3",
    title: "The Fading Apprentice",
    sub: "Cue Hunt complete ✓ — now sort patients by urgency.",
    badge: "NEXT IN CHAIN",
    badgeIcon: "flash-outline",
    ctaLabel: "Start Rapid Triage",
    accentColor: "#F59E0B",
    gradientColors: ["#2D1F06", "#3D2A08", "#1E1504"],
    testID: "university-banner-rapid-triage",
  },
  stabilize: {
    kicker: "STABILIZE STACK · STEP 3 OF 3",
    title: "The Fading Apprentice",
    sub: "Triage complete ✓ — build the care sequence to save Wei.",
    badge: "FINAL STEP",
    badgeIcon: "layers-outline",
    ctaLabel: "Start Stabilize Stack",
    accentColor: "#22D3EE",
    gradientColors: ["#071A24", "#0A2535", "#051018"],
    testID: "university-banner-stabilize",
  },
  done: {
    kicker: "CASE CHAIN COMPLETE",
    title: "The Fading Apprentice",
    sub: "You guided the Apprentice through every phase of care.",
    badge: "COMPLETE ✓",
    badgeIcon: "ribbon-outline",
    ctaLabel: "Review Chain",
    accentColor: "#D4AF37",
    gradientColors: ["#1C1500", "#2A1F00", "#110E00"],
    testID: "university-banner-done",
  },
};

function NextChainBanner({
  chainProg,
  onPress,
}: {
  chainProg: ChainProgress;
  onPress: () => void;
}) {
  const key: keyof typeof CHAIN_GAME_DEFS =
    chainProg.stabilizeDone ? "done"
    : chainProg.rapidTriageDone ? "stabilize"
    : chainProg.cueHuntDone ? "triage"
    : "cueHunt";

  const def = CHAIN_GAME_DEFS[key];
  const ac = def.accentColor;

  return (
    <Pressable style={styles.cueCard} onPress={onPress} testID={def.testID}>
      <LinearGradient
        colors={def.gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Accent glow top-right */}
      <View style={[styles.cueGlow, { backgroundColor: ac + "18" }]} pointerEvents="none" />

      <View style={styles.cueTop}>
        <View style={[styles.cueBadge, { backgroundColor: ac + "20", borderColor: ac + "44" }]}>
          <Ionicons name={def.badgeIcon} size={11} color={ac} />
          <Text style={[styles.cueBadgeTxt, { color: ac }]}>{def.badge}</Text>
        </View>
      </View>

      <View style={styles.cueBody}>
        <Text style={[styles.cueKicker, { color: ac }]}>{def.kicker}</Text>
        <Text style={styles.cueTitle}>{def.title}</Text>
        <Text style={styles.cueSub}>{def.sub}</Text>
      </View>

      <View style={styles.cueCtaRow}>
        <View style={[styles.cueCtaBtn, { backgroundColor: ac }]}>
          <Text style={styles.cueCtaTxt}>{def.ctaLabel}</Text>
          <Ionicons name="arrow-forward" size={13} color="#071018" />
        </View>
      </View>
    </Pressable>
  );
}

// ── FA Complete Chip ──────────────────────────────────────────────────────────
// Compact collapsed state shown after the full Fading Apprentice chain is done.
// Replaces the full-height NextChainBanner so it no longer dominates the page.
function FaCompleteChip() {
  return (
    <View style={faChipStyles.wrap}>
      <LinearGradient
        colors={["#1C1500", "#120F00"]}
        style={StyleSheet.absoluteFillObject}
      />
      <Ionicons name="ribbon" size={16} color="#D4AF37" />
      <View style={{ flex: 1 }}>
        <Text style={faChipStyles.title}>The Fading Apprentice</Text>
        <Text style={faChipStyles.sub}>Case chain complete · +40 XP earned</Text>
      </View>
      <View style={faChipStyles.badge}>
        <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
        <Text style={faChipStyles.badgeTxt}>COMPLETE</Text>
      </View>
    </View>
  );
}
const faChipStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D4AF3730",
    padding: SPACING.md,
  },
  title: { color: "#D4AF37", fontSize: 13, fontWeight: "700" },
  sub:   { color: "#A09060", fontSize: 11 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#22C55E18",
    borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: "#22C55E30",
    paddingHorizontal: 8, paddingVertical: 4,
  },
  badgeTxt: { color: "#22C55E", fontSize: 8, fontWeight: "800", letterSpacing: 1 },
});

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
  const { player, applyRewards } = usePlayer();
  const gate = useFeatureGate("university");
  const heroesGate = useFeatureGate("hall_of_heroes");
  const { activeTutorialId, onRequiredAction } = useTutorial();
  const [info, setInfo] = useState<{ title: string; message: string } | null>(null);
  const [showFuture, setShowFuture] = useState(false);

  // Chain progress — reload every time this screen gains focus so the banner
  // updates after the player returns from a completed mini-game.
  const [chainProg, setChainProg] = useState<ChainProgress>({
    cueHuntDone: false,
    rapidTriageDone: false,
    stabilizeDone: false,
    cueHuntFirstPerfect: false,
    triageFirstPerfect: false,
    stabilizeFirstPerfect: false,
  });

  useFocusEffect(
    useCallback(() => {
      getChainProgress().then(setChainProg);
      // ── C1: If systemWardHub tutorial is still waiting for the player to
      // navigate to University, completing that action here advances the step
      // (which marks the tutorial done, since it's the last step).
      onRequiredAction("navigateToUniversity");
    }, [onRequiredAction]),
  );

  // ── C1 objective XP grants — run once per component mount.
  // Uses a ref so we don't repeat across re-renders within the same mount.
  const objGrantedRef = React.useRef(false);
  useEffect(() => {
    if (!player || objGrantedRef.current) return;
    objGrantedRef.current = true;
    (async () => {
      let bonus = 0;

      // Step 4 — Open Clinica University (first visit grant)
      const isUnivNew = await completeObjective("obj_university_arrived");
      if (isUnivNew) {
        await markObjectiveXpGranted("obj_university_arrived");
        bonus += 10;
      }

      // Catch-up grant: early onboarding steps (1-6) fire outside a context with
      // applyRewards. Load the done-set once, then pay out any unpaid XP here.
      const catchupIds: ObjectiveId[] = [
        "obj_prologue_done",
        "obj_lotus_recall",
        "obj_identity_done",
        "obj_diagnostic_done",
        "obj_class_result",
        "obj_memory_seen",
      ];
      const doneSet = await getObjectiveProgress();
      for (const id of catchupIds) {
        if (doneSet.has(id)) {
          const alreadyPaid = await isObjectiveXpGranted(id);
          if (!alreadyPaid) {
            await markObjectiveXpGranted(id);
            bonus += 10;
          }
        }
      }

      // If the full FA chain is already done (returning player), grant step 8 too.
      const prog = await getChainProgress();
      if (prog.stabilizeDone) {
        const isFANew = await completeObjective("obj_fading_apprentice_done");
        if (isFANew) {
          await markObjectiveXpGranted("obj_fading_apprentice_done");
          bonus += 10;
        }
      }

      // applyRewards handles XP + level recalc via the public store API.
      if (bonus > 0) await applyRewards({ xp: bonus });

    })();
  }, [player?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Smart chain entry — resume from the next unfinished step rather than
  // always starting from the beginning.
  const handleChainEntry = useCallback(() => {
    if (chainProg.stabilizeDone) {
      // Full chain complete — don't loop back into any game
      return;
    } else if (chainProg.rapidTriageDone) {
      router.push("/university/stabilize-stack" as any);
    } else if (chainProg.cueHuntDone) {
      router.push("/university/rapid-triage" as any);
    } else {
      router.push("/university/cue-hunt" as any);
    }
  }, [chainProg, router]);

  // Leaving mid-tutorial must never leak the overlay onto the next screen.
  // (Must run unconditionally, before the early return below.)
  useClearTutorialOnExit();
  // Browser back mirrors the in-app arrow instead of popping stale gameplay screens.
  useWebBackToHub("/(tabs)");

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
        <Pressable style={styles.backBtn} onPress={() => router.replace("/(tabs)")} hitSlop={10} testID="university-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>CLINICA UNIVERSITY</Text>
        <Text style={styles.title}>Where Your Story Begins</Text>
        <Text style={styles.sub}>Learn the way of the healer, one living case at a time.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* CHAIN HERO BANNER — collapses to a compact chip after completion */}
        {chainProg.stabilizeDone ? (
          <FaCompleteChip />
        ) : (
          <NextChainBanner chainProg={chainProg} onPress={handleChainEntry} />
        )}


        {/* ── CHAPTER 1 JOURNEY — visible once FA chain is done or for returning players */}
        {chainProg.stabilizeDone && (
          <>
            <Text style={styles.sectionHeading}>CHAPTER 1 JOURNEY</Text>
            <Pressable
              style={styles.ch1JourneyCard}
              onPress={() => router.push("/journey" as any)}
              testID="university-ch1-journey"
            >
              <View style={styles.ch1JourneyLeft}>
                <View style={styles.ch1Badge}>
                  <Text style={styles.ch1BadgeTxt}>CH. 1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ch1Title}>The Fading Apprenticeship</Text>
                  <Text style={styles.ch1Sub}>5 parts · Learn to see before you heal</Text>
                </View>
              </View>
              <Ionicons name="arrow-forward" size={16} color="#D4AF37" />
            </Pressable>
          </>
        )}

        {/* PRACTICE LABS — J3: repeatable practice modes, visible once FA chain is started */}
        {showMore && (
          <>
            <Text style={styles.sectionHeading}>PRACTICE LABS</Text>
            <View style={labsStyles.grid}>
              <Pressable style={labsStyles.labCard} onPress={() => router.push("/university/cue-lab" as any)} testID="university-lab-cue">
                <View style={[labsStyles.labIcon, { backgroundColor: '#2DD4BF18' }]}>
                  <Ionicons name="eye-outline" size={20} color="#2DD4BF" />
                </View>
                <Text style={labsStyles.labTitle}>Cue Lab</Text>
                <Text style={labsStyles.labDesc}>Spot the most important clinical cue</Text>
                <View style={labsStyles.labChip}>
                  <Ionicons name="refresh-outline" size={9} color="#2DD4BF" />
                  <Text style={[labsStyles.labChipTxt, { color: '#2DD4BF' }]}>REPEATABLE</Text>
                </View>
              </Pressable>

              <Pressable style={labsStyles.labCard} onPress={() => router.push("/university/triage-hall" as any)} testID="university-lab-triage">
                <View style={[labsStyles.labIcon, { backgroundColor: '#F59E0B18' }]}>
                  <Ionicons name="flash-outline" size={20} color="#F59E0B" />
                </View>
                <Text style={labsStyles.labTitle}>Triage Hall</Text>
                <Text style={labsStyles.labDesc}>Choose who needs care first</Text>
                <View style={labsStyles.labChip}>
                  <Ionicons name="refresh-outline" size={9} color="#F59E0B" />
                  <Text style={[labsStyles.labChipTxt, { color: '#F59E0B' }]}>REPEATABLE</Text>
                </View>
              </Pressable>

              <Pressable style={labsStyles.labCard} onPress={() => router.push("/university/stack-lab" as any)} testID="university-lab-stack">
                <View style={[labsStyles.labIcon, { backgroundColor: '#22D3EE18' }]}>
                  <Ionicons name="layers-outline" size={20} color="#22D3EE" />
                </View>
                <Text style={labsStyles.labTitle}>Stack Lab</Text>
                <Text style={labsStyles.labDesc}>Arrange care steps in the right order</Text>
                <View style={labsStyles.labChip}>
                  <Ionicons name="refresh-outline" size={9} color="#22D3EE" />
                  <Text style={[labsStyles.labChipTxt, { color: '#22D3EE' }]}>REPEATABLE</Text>
                </View>
              </Pressable>
            </View>
            <View style={labsStyles.labFooter}>
              <Ionicons name="school-outline" size={12} color={COLORS.onSurfaceTertiary} />
              <Text style={labsStyles.labFooterTxt}>
                Practice earns Cue Scrolls, Triage Scrolls, Stabilization Scrolls and University Credits. Milestone rewards unlock automatically.
              </Text>
              <View style={labsStyles.labMoreRow}>
                <Pressable style={labsStyles.labMoreBtn} onPress={() => router.push("/university/uni-milestones" as any)}>
                  <Ionicons name="trophy-outline" size={13} color="#D4AF37" />
                  <Text style={labsStyles.labMoreBtnTxt}>Practice Milestones</Text>
                </Pressable>
                <Pressable style={labsStyles.labMoreBtn} onPress={() => router.push("/university/uni-shop" as any)}>
                  <Ionicons name="storefront-outline" size={13} color="#2DD4BF" />
                  <Text style={[labsStyles.labMoreBtnTxt, { color: '#2DD4BF' }]}>University Shop</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

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

  // ── Chapter 1 Journey card ────────────────────────────────────────────────
  ch1JourneyCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "#D4AF3740",
    backgroundColor: "#D4AF3708",
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  ch1JourneyLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  ch1Badge: {
    backgroundColor: "#D4AF3720",
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: "#D4AF3750",
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  ch1BadgeTxt: {
    color: "#D4AF37",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  ch1Title: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: "600",
  },
  ch1Sub: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 11,
    marginTop: 1,
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

// ── Practice Labs grid styles ─────────────────────────────────────────────────
const labsStyles = StyleSheet.create({
  grid: { flexDirection: "row", gap: SPACING.sm },
  labCard: {
    flex: 1, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm, gap: 4,
    alignItems: "center",
  },
  labIcon: {
    width: 44, height: 44, borderRadius: RADIUS.sm,
    alignItems: "center", justifyContent: "center", marginBottom: 2,
  },
  labTitle: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700", textAlign: "center" },
  labDesc: { color: COLORS.onSurfaceTertiary, fontSize: 10, textAlign: "center", lineHeight: 13 },
  labChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: COLORS.surfaceTertiary, marginTop: 2,
  },
  labChipTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  labFooter: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.sm, gap: SPACING.sm,
  },
  labFooterTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15 },
  labMoreRow: { flexDirection: "row", gap: SPACING.sm },
  labMoreBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm,
    paddingVertical: 7,
  },
  labMoreBtnTxt: { color: "#D4AF37", fontSize: 11, fontWeight: "700" },
});

