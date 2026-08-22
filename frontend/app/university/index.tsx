import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { ROUTES, dynRoute, type AppRoute } from "@/src/game/routes";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { ModeCard } from "@/src/components/ModeCard";
import { BannerCard } from "@/src/components/ModeBanners";
import { LotusLessonsEmblem, ShiftEmblem, HeroesEmblem, SummoningEmblem } from "@/src/components/ClinicaEmblems";
import { MessageDialog } from "@/src/components/WebAlert";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { RPGTabBar, RPGTab } from "@/src/components/RPGTabBar";
import { useTutorial, useHighlightTarget } from "@/src/game/tutorialStore";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { useWebBackToHub } from "@/src/hooks/useWebBackToHub";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { FeatureLockedView, useFeatureGate } from "@/src/components/FeatureGate";
import { ModeCardDef, UNIVERSITY_FUTURE_MODES } from "@/src/game/modeHub";
import { firstIncompleteLotusNode, isLotusNodeComplete } from "@/src/game/lotusLessons";
import { getChainProgress, ChainProgress } from "@/src/game/chainProgress";
import { TutorialQuestPanel } from "@/src/components/university/TutorialQuestPanel";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";
import {
  completeObjective,
  getObjectiveProgress,
  markObjectiveXpGranted,
  isObjectiveXpGranted,
  ObjectiveId,
} from "@/src/game/objectiveProgress";
import { playerLevelFromXp } from "@/src/game/progression";

// ── Next-in-chain hero banner ─────────────────────────────────────────────────
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
    kicker: "TUTORIAL CASE CHAIN · STEP 1 OF 3", title: "The Fading Apprentice",
    sub: "Find what others missed — spot the clinical cues.",
    badge: "START HERE", badgeIcon: "eye-outline",
    ctaLabel: "Start Cue Hunt", accentColor: "#2DD4BF",
    gradientColors: ["#0D3B38", "#1B5550", "#0D2E2B"],
    testID: "university-banner-cue-hunt",
  },
  triage: {
    kicker: "TUTORIAL CASE CHAIN · STEP 2 OF 3", title: "The Fading Apprentice",
    sub: "Cue Hunt complete ✓ — now sort patients by urgency.",
    badge: "NEXT IN CHAIN", badgeIcon: "flash-outline",
    ctaLabel: "Start Rapid Triage", accentColor: "#F59E0B",
    gradientColors: ["#2D1F06", "#3D2A08", "#1E1504"],
    testID: "university-banner-rapid-triage",
  },
  stabilize: {
    kicker: "TUTORIAL CASE CHAIN · STEP 3 OF 3", title: "The Fading Apprentice",
    sub: "Triage complete ✓ — build the care sequence to save Wei.",
    badge: "FINAL STEP", badgeIcon: "layers-outline",
    ctaLabel: "Start Stabilize Stack", accentColor: "#22D3EE",
    gradientColors: ["#071A24", "#0A2535", "#051018"],
    testID: "university-banner-stabilize",
  },
  done: {
    kicker: "TUTORIAL CASE CHAIN COMPLETE", title: "The Fading Apprentice",
    sub: "You guided the Apprentice through every phase of care.",
    badge: "COMPLETE ✓", badgeIcon: "ribbon-outline",
    ctaLabel: "Review Chain", accentColor: "#D4AF37",
    gradientColors: ["#1C1500", "#2A1F00", "#110E00"],
    testID: "university-banner-done",
  },
};

function NextChainBanner({ chainProg, onPress }: { chainProg: ChainProgress; onPress: () => void }) {
  const key: keyof typeof CHAIN_GAME_DEFS =
    chainProg.stabilizeDone ? "done"
    : chainProg.rapidTriageDone ? "stabilize"
    : chainProg.cueHuntDone ? "triage"
    : "cueHunt";
  const def = CHAIN_GAME_DEFS[key];
  const ac = def.accentColor;
  return (
    <Pressable style={[styles.cueCard, { backgroundColor: def.gradientColors[0] }]} onPress={onPress} testID={def.testID}>
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

function FaCompleteChip() {
  return (
    <View style={[faChipStyles.wrap, { backgroundColor: "#1C1500" }]}>
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
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    borderRadius: RADIUS.md, overflow: "hidden", borderWidth: 1,
    borderColor: "#D4AF3730", padding: SPACING.md,
  },
  title:    { color: "#D4AF37", fontSize: 13, fontWeight: "700" },
  sub:      { color: "#A09060", fontSize: 13 },
  badge:    {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#22C55E18", borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: "#22C55E30",
    paddingHorizontal: 8, paddingVertical: 4,
  },
  badgeTxt: { color: "#22C55E", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
});

const LESSONS_BANNER: ModeCardDef = {
  id: "uni-lessons", title: "Lotus Lessons",
  subtitle: "Short, gentle lessons that teach real care — and reward your first heroes.",
  icon: "book", accentColor: COLORS.brand, status: "active", size: "large",
  imageKey: "uni-lessons", route: "/university/lessons", rewardPreview: "Start here · earn your first heroes", artBrief: "",
};
const RECRUIT_BANNER: ModeCardDef = {
  id: "uni-recruit", title: "University Recruitment",
  subtitle: "Enroll new healers with Hero Shards, Trainees, and Credits.",
  icon: "sparkles", accentColor: "#F59E0B", status: "active", size: "medium",
  imageKey: "uni-recruit", route: "/university/recruit", artBrief: "",
};
const TRAINING_BANNER: ModeCardDef = {
  id: "uni-training", title: "Training Hall",
  subtitle: "Level up your healers toward their Certification Star's cap.",
  icon: "trending-up", accentColor: "#5B9BD5", status: "active", size: "medium",
  imageKey: "uni-training", route: "/university/training", artBrief: "",
};
const SKILL_ACADEMY_BANNER: ModeCardDef = {
  id: "uni-skill-academy", title: "Hero Skill Academy",
  subtitle: "Upgrade hero skills into stronger combat abilities.",
  icon: "flash", accentColor: "#A855F7", status: "active", size: "medium",
  imageKey: "uni-training", route: "/university/skill-academy", artBrief: "",
};
const LIBRARY_BANNER: ModeCardDef = {
  id: "uni-library", title: "Research Library",
  subtitle: "Browse the Great Codex — knowledge, battle mechanics, field notes.",
  icon: "library", accentColor: "#22D3EE", status: "active", size: "medium",
  imageKey: "uni-library", route: "/(tabs)/codex", artBrief: "",
};
const CLASSTREE_BANNER: ModeCardDef = {
  id: "uni-classtree", title: "Class Tree",
  subtitle: "Choose a Player Class and unlock its ability tree as you level.",
  icon: "git-network", accentColor: "#A78BFA", status: "active", size: "medium",
  imageKey: "uni-classtree", route: "/class-tree", artBrief: "",
};

interface PrepRec {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string; title: string; desc: string; route: string; label: string;
}
const CHAPTER_PREP: Record<number, PrepRec[]> = {
  1: [
    { icon: "eye-outline",    color: "#2DD4BF", title: "Clinical Cue Lab",    desc: "Cue recognition powers your Cue Bonus in Ward Shifts.", route: "/university/cue-lab",     label: "Practice" },
    { icon: "book-outline",   color: "#A78BFA", title: "Lotus Lessons",       desc: "Learn the disease systems you'll face in battle.",      route: "/university/lessons",      label: "Study" },
  ],
  2: [
    { icon: "flash-outline",  color: "#F59E0B", title: "Rapid Triage Hall",   desc: "Multi-enemy encounters demand fast prioritization.",    route: "/university/triage-hall", label: "Practice" },
    { icon: "eye-outline",    color: "#2DD4BF", title: "Clinical Cue Lab",    desc: "Advanced cue spotting sharpens your Cue Bonus.",        route: "/university/cue-lab",     label: "Practice" },
  ],
  3: [
    { icon: "layers-outline", color: "#22D3EE", title: "Stabilize Stack Lab", desc: "Care-sequence combos are key against tougher enemies.", route: "/university/stack-lab",   label: "Practice" },
    { icon: "flash-outline",  color: "#A855F7", title: "Hero Skill Academy",  desc: "Upgrade hero skills before facing Chapter 3 bosses.",  route: "/university/skill-academy", label: "Upgrade" },
  ],
  4: [
    { icon: "layers-outline", color: "#22D3EE", title: "Stabilize Stack Lab", desc: "Precise stacking keeps patient stability from collapsing.", route: "/university/stack-lab", label: "Practice" },
    { icon: "flash-outline",  color: "#F59E0B", title: "Rapid Triage Hall",   desc: "Combined pressure rewards sharp triage instincts.",     route: "/university/triage-hall", label: "Practice" },
    { icon: "flash-outline",  color: "#A855F7", title: "Hero Skill Academy",  desc: "Max out core skills — Ch. 4 enemies hit hard.",         route: "/university/skill-academy", label: "Upgrade" },
  ],
};
const PREP_FALLBACK: PrepRec[] = [
  { icon: "eye-outline",    color: "#2DD4BF", title: "Clinical Cue Lab",    desc: "Keep cue recognition sharp at every chapter.",    route: "/university/cue-lab",       label: "Practice" },
  { icon: "layers-outline", color: "#22D3EE", title: "Stabilize Stack Lab", desc: "Precise stacking is the endgame healer's skill.", route: "/university/stack-lab",     label: "Practice" },
  { icon: "flash-outline",  color: "#A855F7", title: "Hero Skill Academy",  desc: "Max skill ranks before the final boss.",          route: "/university/skill-academy", label: "Upgrade"  },
];

function JourneyPrepSection({ chapterProgress, onJourneyPress, onLabPress }: {
  chapterProgress: number; onJourneyPress: () => void; onLabPress: (route: string) => void;
}) {
  const recs = CHAPTER_PREP[chapterProgress] ?? PREP_FALLBACK;
  return (
    <View style={prepS.card}>
      <View style={prepS.header}>
        <Ionicons name="map-outline" size={14} color="#D4AF37" />
        <Text style={prepS.headerTxt}>Chapter {chapterProgress} Battle Preparation</Text>
        <Pressable onPress={onJourneyPress} hitSlop={8} style={prepS.mapBtn}>
          <Text style={prepS.mapBtnTxt}>Journey Map</Text>
          <Ionicons name="arrow-forward" size={11} color="#D4AF37" />
        </Pressable>
      </View>
      <View style={prepS.divider} />
      {recs.map((rec) => (
        <Pressable key={rec.route + rec.title} style={prepS.row} onPress={() => onLabPress(rec.route)}>
          <View style={[prepS.iconWrap, { backgroundColor: rec.color + "18" }]}>
            <Ionicons name={rec.icon} size={15} color={rec.color} />
          </View>
          <View style={prepS.rowText}>
            <Text style={prepS.rowTitle}>{rec.title}</Text>
            <Text style={prepS.rowDesc}>{rec.desc}</Text>
          </View>
          <View style={[prepS.labelChip, { backgroundColor: rec.color + "20" }]}>
            <Text style={[prepS.labelTxt, { color: rec.color }]}>{rec.label}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function MoreRow({ icon, title, desc, locked, onPress, testID }: {
  icon: string; title: string; desc: string; locked?: boolean; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable style={[styles.moreRow, locked && styles.moreRowLocked]} disabled={locked} onPress={onPress} testID={testID}>
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

// ── University Intro Panel ────────────────────────────────────────────────────
// Shown once on first University visit. Re-openable via the help button (?)
// in the University hero header. Positioned at z5000 — above normal content
// but below TutorialOverlay (z9000) so the tutorial is never blocked.

const UNI_PILLARS: { icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; title: string; desc: string }[] = [
  { icon: "book-outline",    color: "#5ECBC8", title: "Lotus Lessons",
    desc: "Each lesson teaches a clinical cue, concept, or patient care insight — one idea at a time." },
  { icon: "shield-outline",  color: "#F59E0B", title: "Simulations",
    desc: "Safe training wards where you practice battle mechanics and Care Pathway skills without stakes." },
  { icon: "flask-outline",   color: "#A78BFA", title: "Research",
    desc: "Investigate the Sanctuary archive to discover new items and cards for future battles." },
  { icon: "diamond-outline", color: "#D4AF37", title: "University Credits",
    desc: "Earned by completing lessons and labs. Spend them on research, upgrades, and future unlocks." },
  { icon: "ribbon-outline",  color: "#34D399", title: "Badges",
    desc: "Show your clinical mastery. Some badges unlock progression gates and hero evolution paths." },
];

function UniversityIntroPanel({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Pressable style={uniStyles.overlay} onPress={onDismiss} testID="uni-intro-overlay">
      <Pressable style={uniStyles.sheet} onPress={(e) => e.stopPropagation()} testID="uni-intro-panel">
        {/* Header */}
        <View style={uniStyles.header}>
          <View style={{ flex: 1 }}>
            <Text style={uniStyles.headerKicker}>CLINICA UNIVERSITY</Text>
            <Text style={uniStyles.headerTitle}>Your Learning Realm</Text>
          </View>
          <Pressable hitSlop={12} onPress={onDismiss} testID="uni-intro-close">
            <Ionicons name="close" size={22} color={COLORS.onSurfaceSecondary} />
          </Pressable>
        </View>
        <Text style={uniStyles.headerSub}>
          Five systems work together to grow your healer — inside and outside the ward.
        </Text>

        {/* Pillar rows */}
        <View style={uniStyles.pillars}>
          {UNI_PILLARS.map((p) => (
            <View key={p.title} style={uniStyles.pillarRow}>
              <View style={[uniStyles.pillarIcon, { backgroundColor: p.color + "18" }]}>
                <Ionicons name={p.icon} size={18} color={p.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[uniStyles.pillarTitle, { color: p.color }]}>{p.title}</Text>
                <Text style={uniStyles.pillarDesc}>{p.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <Pressable style={uniStyles.ctaBtn} onPress={onDismiss} testID="uni-intro-cta">
          <Text style={uniStyles.ctaTxt}>ENTER THE UNIVERSITY</Text>
          <Ionicons name="arrow-forward" size={14} color="#0B1A18" />
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

export default function UniversityHubScreen() {
  const router = useRouter();
  const { player, applyRewards, markUniversityIntroSeen } = usePlayer();
  const gate       = useFeatureGate("university");
  const heroesGate = useFeatureGate("hall_of_heroes");
  const { activeTutorialId, onRequiredAction } = useTutorial();
  const [info, setInfo]         = useState<{ title: string; message: string } | null>(null);
  const [showFuture, setShowFuture] = useState(false);
  const [activeTab, setActiveTab]   = useState("lessons");
  const [showUniIntro, setShowUniIntro] = useState(false);
  const [chainProg, setChainProg] = useState<ChainProgress>({
    cueHuntDone: false, rapidTriageDone: false, stabilizeDone: false,
    cueHuntFirstPerfect: false, triageFirstPerfect: false, stabilizeFirstPerfect: false,
  });
  const [completedObjectives, setCompletedObjectives] = useState<Set<ObjectiveId>>(new Set());

  useFocusEffect(
    useCallback(() => {
      getChainProgress().then(setChainProg);
      getObjectiveProgress().then(setCompletedObjectives);
      onRequiredAction("navigateToUniversity"); // satisfies systemWardHub › system_ward_university (requiredActionType:"navigateToUniversity") — fires on focus so it catches both direct nav and replay
    }, [onRequiredAction]),
  );

  const objGrantedRef = React.useRef(false);
  useEffect(() => {
    if (!player || objGrantedRef.current) return;
    objGrantedRef.current = true;
    (async () => {
      let bonus = 0;
      const isUnivNew = await completeObjective("obj_university_arrived");
      if (isUnivNew) { await markObjectiveXpGranted("obj_university_arrived"); bonus += 10; }
      const catchupIds: ObjectiveId[] = [
        "obj_prologue_done", "obj_lotus_recall", "obj_identity_done",
        "obj_diagnostic_done", "obj_class_result", "obj_memory_seen",
        "obj_lotus_visited", "obj_lotus_first_lesson", "obj_recruit_preview", "obj_ward_shift_first",
      ];
      const doneSet = await getObjectiveProgress();
      for (const id of catchupIds) {
        if (doneSet.has(id)) {
          const alreadyPaid = await isObjectiveXpGranted(id);
          if (!alreadyPaid) { await markObjectiveXpGranted(id); bonus += 10; }
        }
      }
      const prog = await getChainProgress();
      if (prog.stabilizeDone) {
        const isFANew = await completeObjective("obj_fading_apprentice_done");
        if (isFANew) { await markObjectiveXpGranted("obj_fading_apprentice_done"); bonus += 10; }
      }
      if (bonus > 0) await applyRewards({ xp: bonus });
    })();
  }, [player?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // P5 — auto-show the University intro panel once on the player's first visit.
  // Skip if the tutorial system has an active guided step (it takes priority).
  // Guard with a session ref so changing activeTutorialId after the intro was
  // already shown doesn't trigger a second appearance.
  const introShownRef = React.useRef(false);
  useEffect(() => {
    if (!player || player.seen_university_intro) return;
    if (activeTutorialId) return;
    if (introShownRef.current) return;
    introShownRef.current = true;
    const t = setTimeout(() => setShowUniIntro(true), 400);
    return () => clearTimeout(t);
  }, [player?.id, player?.seen_university_intro, activeTutorialId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismissUniIntro = useCallback(() => {
    setShowUniIntro(false);
    markUniversityIntroSeen();
  }, [markUniversityIntroSeen]);

  // Objective guide (objGuideUniversity/objGuideApprentice final step):
  // the chain banner is the highlighted target that completes the guide.
  const chainTarget = useHighlightTarget("university-chain-banner");

  const handleChainEntry = useCallback(() => {
    if (chainProg.stabilizeDone) return;
    chainTarget.onTargetPress(); // completes an active objective guide
    if (chainProg.rapidTriageDone)      router.push(ROUTES.UNI_STABILIZE_STACK);
    else if (chainProg.cueHuntDone)     router.push(ROUTES.UNI_RAPID_TRIAGE);
    else                                router.push(ROUTES.UNI_CUE_HUNT);
  }, [chainProg, router, chainTarget]);

  useClearTutorialOnExit();
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

  const nextLotusNode    = firstIncompleteLotusNode(player);
  const lessonsCompleted = player.lessons_completed?.length ?? 0;
  const isNewLearner     = lessonsCompleted === 0;
  const heroCount        = player.heroes_owned?.length ?? 0;
  const showRecruitment  = !isNewLearner;
  const showTraining     = heroCount >= 2;
  const showCodex        = !isNewLearner;
  const showClassTree    = (player.player_level ?? 1) >= 5;
  const showCareerExplorer = (player.player_level ?? 1) >= 3 || lessonsCompleted >= 3;
  const showHeroes       = heroesGate.unlocked;
  const showMore         = !isNewLearner;

  const TABS: RPGTab[] = [
    { key: "lessons",     label: "Lessons",     emblem: (a) => <LotusLessonsEmblem size={14} color={a ? UI.onGold : UI.gold} /> },
    { key: "schools",     label: "Schools",     emblem: (a) => <HeroesEmblem       size={14} color={a ? UI.onGold : UI.gold} />, locked: isNewLearner },
    { key: "simulations", label: "Simulations", emblem: (a) => <ShiftEmblem        size={14} color={a ? UI.onGold : UI.gold} />, locked: isNewLearner },
    { key: "badges",      label: "Badges",      emblem: (a) => <SummoningEmblem    size={14} color={a ? UI.onGold : UI.gold} />, locked: isNewLearner },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PlayerHeader player={player} />

      <View style={[styles.hero, { backgroundColor: COLORS.brandTertiary }]}>
        <View style={styles.heroTopRow}>
          <Pressable style={styles.backBtn} onPress={() => router.replace(ROUTES.tabs)} hitSlop={10} testID="university-back">
            <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
          </Pressable>
          <Pressable style={styles.helpBtn} onPress={() => setShowUniIntro(true)} hitSlop={10} testID="university-help">
            <Ionicons name="help-circle-outline" size={20} color={COLORS.onSurfaceSecondary} />
          </Pressable>
        </View>
        <Text style={styles.kicker}>CLINICA UNIVERSITY</Text>
        <Text style={styles.title}>Where Your Story Begins</Text>
      </View>

      <RPGTabBar tabs={TABS} activeTab={activeTab} onTabPress={setActiveTab} />

      {/* ── LESSONS TAB ── */}
      {activeTab === "lessons" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {chainProg.stabilizeDone ? <FaCompleteChip /> : (
            <>
              <View style={chainTarget.isHighlighted ? chainTarget.highlightStyle : undefined}>
                <NextChainBanner chainProg={chainProg} onPress={handleChainEntry} />
              </View>
              <TutorialQuestPanel
                chainProg={chainProg}
                completed={completedObjectives}
                onPressTask={(key) => {
                  if (key === "cueHunt") router.push(ROUTES.UNI_CUE_HUNT);
                  else if (key === "triage") router.push(ROUTES.UNI_RAPID_TRIAGE);
                  else router.push(ROUTES.UNI_STABILIZE_STACK);
                }}
              />
            </>
          )}

          {chainProg.stabilizeDone && (
            <>
              <Text style={styles.sectionHeading}>CHAPTER 1 JOURNEY</Text>
              <Pressable style={styles.ch1JourneyCard} onPress={() => router.push(ROUTES.JOURNEY)} testID="university-ch1-journey">
                <View style={styles.ch1JourneyLeft}>
                  <View style={styles.ch1Badge}><Text style={styles.ch1BadgeTxt}>CH. 1</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ch1Title}>The Fading Apprenticeship</Text>
                    <Text style={styles.ch1Sub}>5 parts · Learn to see before you heal</Text>
                  </View>
                </View>
                <Ionicons name="arrow-forward" size={16} color="#D4AF37" />
              </Pressable>
            </>
          )}

          <Text style={styles.sectionHeading}>LOTUS LESSONS</Text>
          <BannerCard
            mode={LESSONS_BANNER} height={120}
            onPress={() => router.push(ROUTES.UNI_LESSONS)}
            testID="university-banner-lessons"
          />

          {nextLotusNode && (
            <Pressable style={styles.nextLessonCard}
              onPress={() => router.push(dynRoute.lotusLesson(nextLotusNode.id))}
              testID="university-next-lesson">
              <View style={styles.nextLessonIcon}>
                <Ionicons name="play-circle" size={22} color={COLORS.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nextLessonKicker}>UP NEXT</Text>
                <Text style={styles.nextLessonTitle}>{nextLotusNode.title}</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={COLORS.brand} />
            </Pressable>
          )}

          <View style={styles.footNote}>
            <Ionicons name="information-circle-outline" size={13} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.footNoteTxt}>
              Clinica University is a game progression system only — not CME/CE credit.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ── SIMULATIONS TAB ── */}
      {activeTab === "simulations" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {showMore && (
            <>
              <Text style={styles.sectionHeading}>PRACTICE CURRICULUM</Text>
              <Pressable style={pracStyles.curriculumCard}
                onPress={() => router.push(ROUTES.UNI_PRACTICE)}
                testID="university-practice-curriculum">
                <View style={pracStyles.curriculumLeft}>
                  <View style={pracStyles.curriculumBadge}>
                    <Ionicons name="school" size={14} color="#2DD4BF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={pracStyles.curriculumKicker}>STRUCTURED TRAINING</Text>
                    <Text style={pracStyles.curriculumTitle}>Practice Curriculum</Text>
                    <Text style={pracStyles.curriculumSub}>3 tracks · Assessment · Priority · Sequencing</Text>
                  </View>
                </View>
                <Ionicons name="arrow-forward" size={16} color="#2DD4BF" />
              </Pressable>

              <Text style={styles.sectionHeading}>PRACTICE LABS</Text>
              <View style={labsStyles.grid}>
                <Pressable style={labsStyles.labCard} onPress={() => router.push(ROUTES.UNI_CUE_LAB)} testID="university-lab-cue">
                  <View style={[labsStyles.labIcon, { backgroundColor: "#2DD4BF18" }]}>
                    <Ionicons name="eye-outline" size={20} color="#2DD4BF" />
                  </View>
                  <Text style={labsStyles.labTitle}>Cue Lab</Text>
                  <Text style={labsStyles.labDesc}>Spot the most important clinical cue</Text>
                  <View style={labsStyles.labChip}>
                    <Ionicons name="refresh-outline" size={9} color="#2DD4BF" />
                    <Text style={[labsStyles.labChipTxt, { color: "#2DD4BF" }]}>REPEATABLE</Text>
                  </View>
                </Pressable>
                <Pressable style={labsStyles.labCard} onPress={() => router.push(ROUTES.UNI_TRIAGE_HALL)} testID="university-lab-triage">
                  <View style={[labsStyles.labIcon, { backgroundColor: "#F59E0B18" }]}>
                    <Ionicons name="flash-outline" size={20} color="#F59E0B" />
                  </View>
                  <Text style={labsStyles.labTitle}>Triage Hall</Text>
                  <Text style={labsStyles.labDesc}>Choose who needs care first</Text>
                  <View style={labsStyles.labChip}>
                    <Ionicons name="refresh-outline" size={9} color="#F59E0B" />
                    <Text style={[labsStyles.labChipTxt, { color: "#F59E0B" }]}>REPEATABLE</Text>
                  </View>
                </Pressable>
                <Pressable style={labsStyles.labCard} onPress={() => router.push(ROUTES.UNI_STACK_LAB)} testID="university-lab-stack">
                  <View style={[labsStyles.labIcon, { backgroundColor: "#22D3EE18" }]}>
                    <Ionicons name="layers-outline" size={20} color="#22D3EE" />
                  </View>
                  <Text style={labsStyles.labTitle}>Stack Lab</Text>
                  <Text style={labsStyles.labDesc}>Arrange care steps in the right order</Text>
                  <View style={labsStyles.labChip}>
                    <Ionicons name="refresh-outline" size={9} color="#22D3EE" />
                    <Text style={[labsStyles.labChipTxt, { color: "#22D3EE" }]}>REPEATABLE</Text>
                  </View>
                </Pressable>
              </View>
              <View style={labsStyles.labFooter}>
                <Text style={labsStyles.labFooterTxt}>Earn scrolls and credits. Milestone rewards unlock automatically.</Text>
                <View style={labsStyles.labMoreRow}>
                  <Pressable style={labsStyles.labMoreBtn} onPress={() => router.push(ROUTES.UNI_MILESTONES)}>
                    <Ionicons name="trophy-outline" size={13} color="#D4AF37" />
                    <Text style={labsStyles.labMoreBtnTxt}>Milestones</Text>
                  </Pressable>
                  <Pressable style={labsStyles.labMoreBtn} onPress={() => router.push(ROUTES.UNI_SHOP)}>
                    <Ionicons name="storefront-outline" size={13} color="#2DD4BF" />
                    <Text style={[labsStyles.labMoreBtnTxt, { color: "#2DD4BF" }]}>Uni Shop</Text>
                  </Pressable>
                  <Pressable style={labsStyles.labMoreBtn} onPress={() => router.push(ROUTES.UNI_SKILL_ACADEMY)}>
                    <Ionicons name="flash-outline" size={13} color="#A855F7" />
                    <Text style={[labsStyles.labMoreBtnTxt, { color: "#A855F7" }]}>Skills</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={styles.sectionHeading}>BATTLE {"&"} JOURNEY SUPPORT</Text>
              <JourneyPrepSection
                chapterProgress={player.chapter_progress ?? 1}
                onJourneyPress={() => router.push(ROUTES.JOURNEY)}
                onLabPress={(route) => router.push(route as AppRoute)}
              />
            </>
          )}

          {isNewLearner && (
            <View style={styles.lockedTabCard}>
              <Ionicons name="flask-outline" size={32} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.lockedTabTitle}>Simulations</Text>
              <Text style={styles.lockedTabSub}>Complete your first Lotus Lesson to unlock practice labs and simulations.</Text>
              <Pressable style={styles.lockedTabCta} onPress={() => setActiveTab("lessons")}>
                <Text style={styles.lockedTabCtaTxt}>Start Lessons</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── SCHOOLS TAB ── */}
      {activeTab === "schools" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {isNewLearner ? (
            <View style={styles.lockedTabCard}>
              <Ionicons name="school-outline" size={32} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.lockedTabTitle}>Schools & Departments</Text>
              <Text style={styles.lockedTabSub}>Finish your first Lotus Lesson to unlock recruitment, training, and the codex.</Text>
              <Pressable style={styles.lockedTabCta} onPress={() => setActiveTab("lessons")}>
                <Text style={styles.lockedTabCtaTxt}>Start Lessons</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {(showRecruitment || showTraining) && (
                <>
                  <Text style={styles.sectionHeading}>GROW YOUR HEALERS</Text>
                  {showRecruitment && (
                    <BannerCard mode={RECRUIT_BANNER} height={120}
                      onPress={() => router.push(ROUTES.UNI_RECRUIT)}
                      testID="university-banner-uni-recruit" />
                  )}
                  {showTraining && (
                    <BannerCard mode={TRAINING_BANNER} height={120}
                      onPress={() => router.push(ROUTES.UNI_TRAINING)}
                      testID="university-banner-uni-training" />
                  )}
                  <BannerCard mode={SKILL_ACADEMY_BANNER} height={120}
                    onPress={() => router.push(ROUTES.UNI_SKILL_ACADEMY)}
                    testID="university-banner-skill-academy" />
                </>
              )}

              {(showCodex || showClassTree) && (
                <>
                  <Text style={styles.sectionHeading}>KNOWLEDGE {"&"} PATHS</Text>
                  {showCodex && (
                    <BannerCard mode={LIBRARY_BANNER} height={120}
                      onPress={() => router.push(ROUTES.CODEX)}
                      testID="university-banner-uni-library" />
                  )}
                  {showClassTree && (
                    <BannerCard mode={CLASSTREE_BANNER} height={120}
                      onPress={() => router.push(ROUTES.CLASS_TREE)}
                      testID="university-banner-uni-classtree" />
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── BADGES TAB ── */}
      {activeTab === "badges" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {isNewLearner ? (
            <View style={styles.lockedTabCard}>
              <Ionicons name="ribbon-outline" size={32} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.lockedTabTitle}>Badges & Progress</Text>
              <Text style={styles.lockedTabSub}>Complete your first lesson to unlock badges and milestone tracking.</Text>
              <Pressable style={styles.lockedTabCta} onPress={() => setActiveTab("lessons")}>
                <Text style={styles.lockedTabCtaTxt}>Start Lessons</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.sectionHeading}>MILESTONES</Text>
              <MoreRow icon="trophy-outline" title="University Milestones" desc="Track lab completions and earn milestone rewards."
                onPress={() => router.push(ROUTES.UNI_MILESTONES)} testID="university-badges-milestones" />
              <MoreRow icon="storefront-outline" title="University Shop" desc="Spend scrolls on items and bonuses."
                onPress={() => router.push(ROUTES.UNI_SHOP)} testID="university-badges-shop" />

              <Text style={styles.sectionHeading}>YOUR PATH</Text>
              {showClassTree && (
                <MoreRow icon="git-network-outline" title="Class Tree" desc="Choose your Player Class and unlock abilities."
                  onPress={() => router.push(ROUTES.CLASS_TREE)} testID="university-badges-classtree" />
              )}
              {showHeroes && (
                <MoreRow icon="people-outline" title="Hall of Heroes" desc="Certify heroes and raise their star rank."
                  onPress={() => router.push(ROUTES.HEROES)} testID="university-badges-heroes" />
              )}
              {showCareerExplorer && (
                <MoreRow icon="compass-outline" title="Career Explorer" desc="Discover the many paths a healer can walk."
                  onPress={() => router.push(ROUTES.UNI_CAREER_EXPLORER)} testID="university-badges-career" />
              )}

              <Text style={styles.sectionHeading}>SETTINGS</Text>
              <MoreRow icon="options-outline" title="Learning Style" desc="Adjust explanation depth and clue visibility."
                onPress={() => router.push(ROUTES.LEARNING_PROFILE)} testID="university-badges-learning-profile" />

              <Pressable style={styles.futureToggle} onPress={() => setShowFuture((v) => !v)} testID="university-future-toggle">
                <Ionicons name="time-outline" size={14} color={COLORS.onSurfaceSecondary} />
                <Text style={styles.futureToggleTxt}>Future Learning ({UNIVERSITY_FUTURE_MODES.length})</Text>
                <Ionicons name={showFuture ? "chevron-up" : "chevron-down"} size={16} color={COLORS.onSurfaceTertiary} />
              </Pressable>
              {showFuture && (
                <View style={{ gap: SPACING.sm }}>
                  {UNIVERSITY_FUTURE_MODES.map((m) => (
                    <ModeCard key={m.id} mode={m} testID={`university-future-${m.id}`}
                      onPress={() => setInfo({ title: `${m.title} — Coming Soon`, message: m.subtitle + "\n\nThis feature is still in development." })} />
                  ))}
                </View>
              )}

              <View style={styles.footNote}>
                <Ionicons name="information-circle-outline" size={13} color={COLORS.onSurfaceTertiary} />
                <Text style={styles.footNoteTxt}>
                  Clinica University is a game progression system only — not CME/CE credit.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      )}

      {showUniIntro && <UniversityIntroPanel onDismiss={handleDismissUniIntro} />}

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.sanctuaryBg },
  loading:   { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm },
  loadingTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13 },
  hero: { padding: SPACING.lg, paddingTop: SPACING.md, gap: 4 },
  heroTopRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: SPACING.sm,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  helpBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.20)",
  },
  kicker: { color: COLORS.brand, fontSize: 12, letterSpacing: 1, fontWeight: "700" },
  title:  { color: COLORS.onSurface, fontSize: 22, fontWeight: "300" },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  sectionHeading: { color: UI.jade, fontSize: 13, fontWeight: "800", letterSpacing: 0.8, marginTop: SPACING.xs },

  ch1JourneyCard: {
    flexDirection: "row", alignItems: "center", borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: "#D4AF3740", backgroundColor: "#D4AF3708",
    padding: SPACING.md, gap: SPACING.sm,
  },
  ch1JourneyLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  ch1Badge: {
    backgroundColor: "#D4AF3720", borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: "#D4AF3750",
    paddingHorizontal: 7, paddingVertical: 4,
  },
  ch1BadgeTxt: { color: "#D4AF37", fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },
  ch1Title:    { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  ch1Sub:      { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 1 },

  nextLessonCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: UI.sanctuaryPanel, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.brand + "30", padding: SPACING.md,
  },
  nextLessonIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.brand + "15", alignItems: "center", justifyContent: "center",
  },
  nextLessonKicker: { color: COLORS.brand, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  nextLessonTitle:  { color: COLORS.onSurface, fontSize: 15, fontWeight: "700", marginTop: 2 },

  lockedTabCard: {
    alignItems: "center", gap: SPACING.md, padding: SPACING.xxl,
    backgroundColor: UI.sanctuaryPanel, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: UI.sanctuaryBorder,
  },
  lockedTabTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: "700" },
  lockedTabSub:   { color: COLORS.onSurfaceTertiary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  lockedTabCta:   { backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: 11, paddingHorizontal: SPACING.xl },
  lockedTabCtaTxt: { color: COLORS.onBrand, fontSize: 15, fontWeight: "700" },

  cueCard: {
    borderRadius: RADIUS.lg, overflow: "hidden", height: 172,
    borderWidth: 1.5, borderColor: "#2DD4BF35",
  },
  cueGlow: {
    position: "absolute", top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
  },
  cueTop: { padding: SPACING.md, flexDirection: "row", alignItems: "center" },
  cueBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
  },
  cueBadgeTxt: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  cueBody:     { flex: 1, paddingHorizontal: SPACING.md, justifyContent: "center", gap: 2 },
  cueKicker:   { fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  cueTitle:    { color: COLORS.onSurface, fontSize: 20, fontWeight: "300", letterSpacing: 0.3 },
  cueSub:      { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18, marginTop: 1 },
  cueCtaRow:   { padding: SPACING.md, paddingTop: SPACING.sm, alignItems: "flex-start" },
  cueCtaBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 8,
  },
  cueCtaTxt: { color: "#0B1A18", fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },

  moreRow:       { flexDirection: "row", gap: SPACING.md, alignItems: "center", backgroundColor: UI.sanctuaryPanel, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: UI.sanctuaryBorder },
  moreRowLocked: { opacity: 0.5 },
  moreIcon:      { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: UI.sanctuaryCard, borderWidth: 1, borderColor: COLORS.brand + "40" },
  moreTitle:     { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  moreDesc:      { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  futureToggle:  {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: UI.sanctuaryPanel, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderWidth: 1, borderColor: UI.sanctuaryBorder, marginTop: SPACING.sm,
  },
  futureToggleTxt: { flex: 1, color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  footNote:     { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.sm },
  footNoteTxt:  { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 16 },
});

const labsStyles = StyleSheet.create({
  grid: { flexDirection: "row", gap: SPACING.sm },
  labCard: {
    flex: 1, backgroundColor: UI.sanctuaryPanel, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: UI.sanctuaryBorder, padding: SPACING.sm, gap: 4, alignItems: "center",
  },
  labIcon: { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  labTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700", textAlign: "center" },
  labDesc:  { color: COLORS.onSurfaceTertiary, fontSize: 11, textAlign: "center", lineHeight: 15 },
  labChip: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: UI.sanctuaryCard, marginTop: 2 },
  labChipTxt:   { fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  labFooter:    { backgroundColor: UI.sanctuaryPanel, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: UI.sanctuaryBorder, padding: SPACING.sm, gap: SPACING.sm },
  labFooterTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15 },
  labMoreRow:   { flexDirection: "row", gap: SPACING.sm },
  labMoreBtn:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1, borderColor: UI.sanctuaryBorder, borderRadius: RADIUS.sm, paddingVertical: 7 },
  labMoreBtnTxt: { color: "#D4AF37", fontSize: 11, fontWeight: "700" },
});

const pracStyles = StyleSheet.create({
  curriculumCard: {
    flexDirection: "row", alignItems: "center",
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: "#2DD4BF30",
    backgroundColor: "#0D2E38",
    padding: SPACING.md, gap: SPACING.sm, overflow: "hidden",
  },
  curriculumLeft:  { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1 },
  curriculumBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#2DD4BF18", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  curriculumKicker: { color: "#2DD4BF", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  curriculumTitle:  { color: COLORS.onSurface, fontSize: 16, fontWeight: "800" },
  curriculumSub:    { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 1 },
});

const prepS = StyleSheet.create({
  card:   { backgroundColor: UI.sanctuaryPanel, borderRadius: RADIUS.md, borderWidth: 1, borderColor: "#D4AF3730", overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: "#D4AF3708" },
  headerTxt: { flex: 1, color: "#D4AF37", fontSize: 12, fontWeight: "700" },
  mapBtn:    { flexDirection: "row", alignItems: "center", gap: 3 },
  mapBtnTxt: { color: "#D4AF37", fontSize: 11, fontWeight: "600" },
  divider:   { height: 1, backgroundColor: UI.sanctuaryBorder },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: UI.sanctuaryBorder },
  iconWrap:  { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  rowText:   { flex: 1, gap: 1 },
  rowTitle:  { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  rowDesc:   { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15 },
  labelChip: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  labelTxt:  { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
});

const uniStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
    zIndex: 5000,
  },
  sheet: {
    backgroundColor: COLORS.surfaceSecondary,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  headerKicker: {
    color: COLORS.brand,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: COLORS.onSurface,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
  },
  headerSub: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: -4,
  },
  pillars: {
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: SPACING.sm,
  },
  pillarRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  pillarIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pillarTitle: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  pillarDesc: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  ctaBtn: {
    backgroundColor: "#D4AF37",
    borderRadius: RADIUS.pill,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: SPACING.xs,
  },
  ctaTxt: {
    color: "#0B1A18",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
