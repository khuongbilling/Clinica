import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Modal, Pressable, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APTITUDE_INFO, HEROES, RANKS } from "@/src/game/content";
import { getHeroSprite } from "@/src/components/HeroSprites";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { NarratorGuide } from "@/src/components/NarratorGuide";
import { getBannerImage } from "@/src/components/ModeBanners";
import { usePlayer } from "@/src/game/store";
import { useTestSession } from "@/src/game/testSession";
import { useTutorial } from "@/src/game/tutorialStore";
import { getSystemIdentity } from "@/src/game/systemNarrator";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { UI, UI_RADIUS, GLOW } from "@/src/theme/ui";
import { PrimaryButton } from "@/src/components/ui/PrimaryButton";
import { playerLevelFromXp, isFeatureUnlocked, buildGateContext, checkFeatureGate } from "@/src/game/progression";
import { ACTIVE_WORLD_EVENT, WORLD_EVENT_ACTIVE } from "@/src/game/worldEvent";
import { DailyRoundsPanel } from "@/src/components/DailyRoundsPanel";
import { Lv2UnlockModal } from "@/src/components/Lv2UnlockModal";
import { ensureFreshDailyRounds, claimableCount, checkInAvailable } from "@/src/game/dailyRounds";
import { nextAutoStoryScene, nextUnseenSideScene } from "@/src/game/storyScenes";
import { getObjectiveProgress, getCurrentObjective, OBJECTIVES, type ObjectiveDef } from "@/src/game/objectiveProgress";

const DAILY_ROUNDS_MODES = ["ward_shift", "ward_defense", "university", "lotus_journal", "hall_of_heroes"];
function dailyRoundsUnlockedModes(player: any): string[] {
  const ctx = buildGateContext(player);
  return DAILY_ROUNDS_MODES.filter((m) => checkFeatureGate(m, ctx).unlocked);
}

const INTRO_KEY = "clinica.intro.seen";
const WORLD_EVENT_BANNER_KEY = `clinica.worldEventBanner.dismissed.${ACTIVE_WORLD_EVENT.id}`;

/* ── Arena scene definitions — element accent + orb colors for props ── */
const ARENA_SCENES: Record<string, {
  name: string;
  accent: string;
  orb1: string;
  orb2: string;
}> = {
  River:      { name: "Grand Ward Atrium",      accent: COLORS.river,      orb1: "#06B6D4", orb2: "#0e7490" },
  Air:        { name: "Healer's Garden Spire",  accent: COLORS.air,        orb1: "#B0DEFF", orb2: "#60A5FA" },
  Fire:       { name: "Alchemical Forge",       accent: COLORS.fire,       orb1: "#F97316", orb2: "#DC2626" },
  Mind:       { name: "Neural Observatory",     accent: COLORS.mind,       orb1: "#A78BFA", orb2: "#7C3AED" },
  Forge:      { name: "Osseous Hall",           accent: COLORS.forge,      orb1: "#D97706", orb2: "#92400E" },
  Energy:     { name: "Metabolic Sanctum",      accent: COLORS.energy,     orb1: "#FBBF24", orb2: "#D97706" },
  Storm:      { name: "Storm Observatory",      accent: COLORS.storm,      orb1: "#8B5CF6", orb2: "#4C1D95" },
  Filter:     { name: "Renal Depths",           accent: COLORS.filter,     orb1: "#22D3EE", orb2: "#0891B2" },
  Protection: { name: "Restoration Hall",       accent: COLORS.protection, orb1: "#34D399", orb2: "#059669" },
  Growth:     { name: "Endocrine Garden",       accent: COLORS.growth,     orb1: "#F472B6", orb2: "#BE185D" },
};

const FALLBACK_SCENE = ARENA_SCENES.River;

// ── Hub guide helpers — pure functions, no hooks ───────────────────────────
// These drive the objective-aware NarratorGuide banner shown on the main hub
// while the player is working through the early 12-step tutorial chain.
// Steps 8-10 (obj_cue_hunt_done / obj_triage_done / obj_stabilize_done) were
// removed from OBJECTIVES in Fix 4; they are internal sub-step IDs only and
// will never appear as `currentObjective`, so no switch cases needed for them.

function hubGuideMessage(obj: ObjectiveDef): string {
  switch (obj.id) {
    case "obj_prologue_done":
      return "Your story has begun. The System is here. Explore the hub — your stamina, currencies, and first heroes are waiting.";
    case "obj_lotus_recall":
    case "obj_identity_done":
    case "obj_diagnostic_done":
    case "obj_class_result":
    case "obj_memory_seen":
      return "Your onboarding is in progress. Head to Clinica University when you are ready — your path begins there.";
    case "obj_university_arrived":
      return "Your path begins at Clinica University. The Fading Apprentice case chain is waiting — complete all three challenges to earn your foundation.";
    case "obj_fading_apprentice_done":
      return "Complete The Fading Apprenticeship at Clinica University — three challenges that build clinical thinking: Cue Hunt, Rapid Triage, and Stabilize Stack.";
    case "obj_lotus_visited":
      return "The Fading Apprentice is saved! Continue Chapter 1 — open Lotus Lessons in the University to reinforce your knowledge.";
    case "obj_lotus_first_lesson":
      return "You are in the University. Complete your first Lotus Lesson to deepen your understanding of the case.";
    case "obj_recruit_preview":
      return "Lesson done. Visit the Recruitment Hall in University and see which healers are ready to answer the call.";
    case "obj_ward_shift_first":
      return "Ward Shift is now unlocked. Your first simulation is waiting — step into the ward and face your first clinical challenge.";
    default:
      return "Your path continues. The System is watching.";
  }
}

function hubGuideCta(obj: ObjectiveDef): string {
  switch (obj.id) {
    case "obj_prologue_done":
      return "Explore the Hub";
    case "obj_lotus_recall":
    case "obj_identity_done":
    case "obj_diagnostic_done":
    case "obj_class_result":
    case "obj_memory_seen":
      return "Enter Clinica University";
    case "obj_university_arrived":
      return "Enter Clinica University";
    case "obj_fading_apprentice_done":
      return "Open University";
    case "obj_lotus_visited":
      return "Open Lotus Lessons";
    case "obj_lotus_first_lesson":
      return "Start First Lotus Lesson";
    case "obj_recruit_preview":
      return "Visit Recruitment Hall";
    case "obj_ward_shift_first":
      return "Enter Ward Shift";
    default:
      return "Continue";
  }
}

function hubGuideRoute(obj: ObjectiveDef): string {
  switch (obj.id) {
    // Step 1 — "Explore the Hub" dismisses the card locally (handled in the
    // onPress handler below); returning an empty string here signals no navigation.
    case "obj_prologue_done":
      return "";
    case "obj_lotus_recall":
    case "obj_identity_done":
    case "obj_diagnostic_done":
    case "obj_class_result":
    case "obj_memory_seen":
      return "/university";
    case "obj_university_arrived":
    case "obj_fading_apprentice_done":
    case "obj_lotus_visited":
    case "obj_recruit_preview":
      return "/university";
    case "obj_lotus_first_lesson":
      return "/university/lotus-lesson/recognizing-cues-hydration";
    case "obj_ward_shift_first":
      return "/shift";
    default:
      return "/(tabs)";
  }
}

export default function RunHome() {
  const router  = useRouter();
  const { player, loading, openRoundsSignal, markLv2UnlockSeen } = usePlayer();
  const { logEvent } = useTestSession();
  const { isCompleted, markDone } = useTutorial();
  const [showIntro, setShowIntro] = useState(false);
  const [showRounds, setShowRounds] = useState(false);
  const [showLv2Modal, setShowLv2Modal] = useState(false);
  // Locally dismiss the obj_prologue_done guide card for this session
  // (tapping "Explore the Hub" on that card stays on the hub without navigating).
  const [localDismissGuide, setLocalDismissGuide] = useState(false);
  const roundsSignalSeen = useRef(0);

  // Objective-driven first-session guide — reloads whenever the hub gains focus
  // so returning from University / lessons always shows the freshest step.
  const [currentObjective, setCurrentObjective] = useState<ObjectiveDef | null | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      getObjectiveProgress().then((done) => setCurrentObjective(getCurrentObjective(done)));
    }, []),
  );

  // Leaving mid-tutorial must never leak the overlay onto the next screen.
  useClearTutorialOnExit();

  // A daily-progress cue (e.g. the "all duties complete" toast) can ask the hub
  // to open the Rounds panel; honour the latest request once.
  useEffect(() => {
    if (openRoundsSignal > roundsSignalSeen.current) {
      roundsSignalSeen.current = openRoundsSignal;
      setShowRounds(true);
    }
  }, [openRoundsSignal]);
  const [eventBannerDismissed, setEventBannerDismissed] = useState<boolean | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem(INTRO_KEY).then((v) => { if (!v) setShowIntro(true); });
  }, []);

  // C5 — Level 2 "Apprentice Path Opened" celebration. Fire once the player
  // reaches Level 2 and hasn't yet seen the unlock moment. The intro modal
  // is dismissed first (stacking guard via showIntro).
  useEffect(() => {
    if (!player || loading || showIntro) return;
    const lvl = playerLevelFromXp(player.xp ?? 0).level;
    if (lvl >= 2 && !player.seen_lv2_unlock) {
      setShowLv2Modal(true);
    }
  }, [player?.id, player?.xp, player?.seen_lv2_unlock, loading, showIntro]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    AsyncStorage.getItem(WORLD_EVENT_BANNER_KEY).then((v) => setEventBannerDismissed(!!v));
  }, []);

  const dismissEventBanner = async () => {
    setEventBannerDismissed(true);
    await AsyncStorage.setItem(WORLD_EVENT_BANNER_KEY, "1");
  };

  // The System hub orientation is now handled by the inline SystemHubOrientationPanel
  // (rendered in JSX below). It shows when !isCompleted("systemHubIntro") &&
  // player.seen_reminiscence — no TutorialOverlay is used for this tutorial because
  // the hub previously had no <TutorialOverlay /> and the 3-step modal chain was
  // invisible and could never complete.

  // Manhwa story layer — chapter scenes auto-play once when their chapter
  // milestone is reached. Deferred until the welcome intro and the System's
  // hub introduction are done so forced overlays never stack, and guarded so
  // at most one scene is pushed per hub mount (the "seen" flag written on
  // exit prevents any replay).
  const autoScenePushed = useRef(false);
  useEffect(() => {
    if (loading || !player || showIntro) return;
    if (!isCompleted("systemHubIntro")) return;
    if (autoScenePushed.current) return;
    const scene = nextAutoStoryScene(player);
    if (scene) {
      autoScenePushed.current = true;
      const t = setTimeout(() => router.push(`/story-scene?sceneId=${scene.id}` as any), 400);
      return () => clearTimeout(t);
    }
  }, [loading, player, showIntro, isCompleted, router]);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.25, duration: 850, useNativeDriver: false }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 850, useNativeDriver: false }),
      Animated.delay(1600),
    ])).start();
  }, []);

  const dismissIntro = async () => {
    await AsyncStorage.setItem(INTRO_KEY, "1");
    setShowIntro(false);
  };

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: UI.bgDeep }} />;
  }

  if (!player) {
    return <View style={{ flex: 1, backgroundColor: UI.bgDeep }} />;
  }

  const apt      = APTITUDE_INFO[player.aptitude];
  const nextRank = RANKS[player.rank_index + 1];
  const progress = nextRank
    ? Math.min(1, (player.xp - RANKS[player.rank_index].xpRequired) /
                  (nextRank.xpRequired - RANKS[player.rank_index].xpRequired))
    : 1;

  // Player Level (account-wide progression, independent of Hero Level/Rank
  // shown below) is now surfaced by the global PlayerHeader. See
  // progression.ts playerLevelFromXp.
  const playerLevelInfo = playerLevelFromXp(player.xp);

  const leadHeroId   = player.active_team?.[0] ?? "novice_guardian";
  const leadHero     = HEROES.find((h) => h.id === leadHeroId);
  const heroSprite   = getHeroSprite(leadHeroId);
  const elementColor = ELEMENT_COLORS[leadHero?.element ?? "River"] ?? COLORS.river;
  const bossUnlocked = playerLevelInfo.level >= 7;
  // World Events (Miasma Bloom) are later-game content — gated at Player Level 10.
  const worldEventUnlocked = isFeatureUnlocked("world_event", playerLevelInfo.level);

  const scene = ARENA_SCENES[leadHero?.element ?? "River"] ?? FALLBACK_SCENE;

  // C5 — Daily/Weekly Rounds and Summoning Hall are Level 2 unlocks.
  const roundsUnlocked = playerLevelInfo.level >= 2;
  const summonUnlocked = playerLevelInfo.level >= 2;

  // Daily Ward Rounds — free daily engagement loop. Hidden until the player has
  // begun (post-University), then shows a badge for pending check-in/claims.
  const roundsFresh = ensureFreshDailyRounds(player.daily_rounds, dailyRoundsUnlockedModes(player), player.id).state;
  const roundsBadge = claimableCount(roundsFresh) + (checkInAvailable(roundsFresh) ? 1 : 0);

  // Manhwa story layer — a newly unlocked side scene surfaces as a one-time
  // "new memory" prompt; it disappears once the scene is watched (or skipped).
  const newMemory = nextUnseenSideScene(player);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>

      {/* ── TUTORIAL SHORTCUT — kept above the global header so it stays reachable ── */}
      <View style={styles.tutorialRow}>
        <Pressable
          style={styles.headerBtn}
          onPress={() => router.push("/tutorial")}
          hitSlop={10}
          testID="run-tutorial-button"
        >
          <Ionicons name="help-circle-outline" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
      </View>

      {/* ── GLOBAL PLAYER HEADER — identity/stamina/currencies/EXP (Push 3.5) ── */}
      <PlayerHeader player={player} />

      {/* ── SCENE LOCATION LABEL ── */}
      <View style={styles.sceneLabelRow}>
        <View style={[styles.sceneDot, { backgroundColor: scene.accent }]} />
        <Text style={[styles.sceneLabel, { color: scene.accent }]}>{scene.name.toUpperCase()}</Text>
      </View>

      {/* ── WORLD EVENT BANNER — dismissible, links to the live event preview ── */}
      {WORLD_EVENT_ACTIVE && worldEventUnlocked && eventBannerDismissed === false && (
        <Pressable
          style={styles.eventBanner}
          onPress={() => router.push(ACTIVE_WORLD_EVENT.route as any)}
          testID="home-world-event-banner"
        >
          <View style={styles.eventBannerIcon}>
            <Ionicons name="earth" size={22} color={ACTIVE_WORLD_EVENT.accentColor} />
            <View style={[styles.eventLiveDot, { backgroundColor: ACTIVE_WORLD_EVENT.accentColor }]} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <View style={styles.eventBannerTopRow}>
              <Text style={styles.eventBannerKicker}>WORLD EVENT · LIVE</Text>
              <View style={styles.eventBannerBadge}>
                <Text style={styles.eventBannerBadgeTxt}>{ACTIVE_WORLD_EVENT.badge.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.eventBannerTitle}>{ACTIVE_WORLD_EVENT.title}</Text>
            <Text style={styles.eventBannerSub} numberOfLines={1}>{ACTIVE_WORLD_EVENT.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={ACTIVE_WORLD_EVENT.accentColor} />
          <Pressable
            style={styles.eventBannerClose}
            onPress={dismissEventBanner}
            hitSlop={10}
            testID="home-world-event-dismiss"
          >
            <Ionicons name="close" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
        </Pressable>
      )}

      {/* ── NEW MEMORY PROMPT — a side story scene has unlocked ── */}
      {newMemory && (
        <Pressable
          style={styles.memoryBanner}
          onPress={() => router.push(`/story-scene?sceneId=${newMemory.id}` as any)}
          testID="home-new-memory-banner"
        >
          <Ionicons name="sparkles" size={18} color="#E0B45C" />
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={styles.memoryBannerKicker}>NEW MEMORY REMEMBERED</Text>
            <Text style={styles.memoryBannerTitle} numberOfLines={1}>
              {newMemory.kicker} — {newMemory.title}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#E0B45C" />
        </Pressable>
      )}

      {/* ── SYSTEM HUB ORIENTATION — one-time panel after reminiscence ─────────
           Replaces the NarratorGuide while the player hasn't yet acknowledged
           the hub orientation. The 3-step systemHubIntro TutorialOverlay flow
           was never visible on the hub (no <TutorialOverlay /> here), so we
           render a dedicated two-button card instead.                          */}
      {!isCompleted("systemHubIntro") && player.seen_reminiscence && !showIntro ? (
        <View style={styles.uniOnboard}>
          <SystemHubOrientationPanel
            player={player}
            onGoToUniversity={() => {
              markDone("systemHubIntro");
              router.push("/university" as any);
            }}
            onExploreHub={() => {
              markDone("systemHubIntro");
            }}
          />
        </View>
      ) : (
        /* ── OBJECTIVE-DRIVEN FIRST-SESSION GUIDE ───────────────────────────
             Shows while the player is working through the early tutorial chain
             (steps 1–11).  Content updates every time the hub gains focus so it
             always reflects the current step rather than a stale/hardcoded state.
             The obj_prologue_done card (step 1, pre-reminiscence) uses a local
             dismiss so tapping "Explore the Hub" doesn't route to the same page. */
        !localDismissGuide && currentObjective && currentObjective.step <= 15 && (
          <View style={styles.uniOnboard}>
            <NarratorGuide
              bgImage={getBannerImage("university")}
              message={hubGuideMessage(currentObjective)}
              objective={`Step ${currentObjective.step} of ${OBJECTIVES.length} — ${currentObjective.title}`}
              ctaLabel={hubGuideCta(currentObjective)}
              onPress={() => {
                const route = hubGuideRoute(currentObjective);
                if (!route) {
                  setLocalDismissGuide(true);
                } else {
                  router.push(route as any);
                }
              }}
              testID="home-objective-guide"
            />
          </View>
        )
      )}

      {/* ── MAIN ARENA — layered: scenic bg → side cols → hero portrait ── */}
      <View style={styles.arena}>

        {/* LAYER 1 — full-width scenic background (drawn behind everything) */}
        <SceneBg element={leadHero?.element ?? "River"} scene={scene} />

        {/* LAYER 2 — side columns (float above bg, transparent backgrounds) */}

        {/* LEFT COLUMN — Daily Ward Rounds + Journey Map */}
        <View style={styles.sideCol}>
          {roundsUnlocked ? (
            <FeatureButton
              icon="today"
              label="Rounds"
              color={COLORS.brand}
              badge={roundsBadge}
              onPress={() => setShowRounds(true)}
              testID="home-float-rounds"
            />
          ) : (
            <FeatureButton
              icon="lock-closed"
              label="Rounds"
              color={COLORS.brand}
              locked
              lockText="Lv.2"
              onPress={() => {}}
              testID="home-float-rounds-locked"
            />
          )}
          <FeatureButton
            icon="map-outline"
            label="Journey"
            color={COLORS.river}
            onPress={() => router.push("/journey")}
            testID="home-float-journey"
          />
          <FeatureButton
            icon="gift-outline"
            label="Milestones"
            color="#D4AF37"
            onPress={() => router.push("/milestones" as any)}
            testID="home-float-milestones"
          />
        </View>

        {/* CENTER — hero portrait (plain, no frame, no pedestal, no blob) */}
        <Pressable
          style={styles.heroCenter}
          onPress={() => router.push("/hero-select")}
          testID="home-portrait-tap"
        >
          {heroSprite ? (
            <Image
              source={heroSprite}
              style={styles.heroImg}
              contentFit="contain"
              contentPosition="center"
            />
          ) : (
            <View style={styles.heroPlaceholder} />
          )}

          {/* Tap hint — minimal pill bottom-right */}
          <Animated.View style={[styles.tapPulse, { opacity: pulseAnim }]}>
            <View style={[styles.tapDot, { backgroundColor: elementColor }]} />
            <Text style={styles.tapLabel}>tap to change</Text>
          </Animated.View>
        </Pressable>

        {/* RIGHT COLUMN — active gameplay events/quests */}
        <View style={styles.sideCol}>
          <FeatureButton
            icon={summonUnlocked ? "sparkles" : "lock-closed"}
            label="Summon"
            color="#D4AF37"
            locked={!summonUnlocked}
            lockText="Lv.2"
            onPress={() => { if (summonUnlocked) router.push("/university/recruit" as any); }}
            testID="home-float-summon"
          />
          <FeatureButton
            icon={worldEventUnlocked ? "calendar-outline" : "lock-closed"}
            label="Events"
            color={COLORS.air}
            live={WORLD_EVENT_ACTIVE && worldEventUnlocked}
            locked={!worldEventUnlocked}
            lockText="Lv.10"
            onPress={() => { if (worldEventUnlocked) router.push("/events"); }}
            testID="home-float-events"
          />
          <FeatureButton
            icon={bossUnlocked ? "skull" : "lock-closed"}
            label="Boss"
            color={COLORS.error}
            locked={!bossUnlocked}
            lockText="Lv.7"
            onPress={() => { if (bossUnlocked) router.push("/boss"); }}
            testID="home-float-boss"
          />
        </View>
      </View>

      {/* ── HERO INFO PANEL ── */}
      <Pressable
        style={[styles.infoPanel, { borderColor: elementColor + "35" }]}
        onPress={() => router.push("/hero-select")}
      >
        <View style={[styles.elementBadge, { borderColor: elementColor + "80", backgroundColor: elementColor + "15" }]}>
          <Text style={[styles.elementTxt, { color: elementColor }]}>{leadHero?.element ?? "River"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroName}>{leadHero?.name ?? "Your Hero"}</Text>
          <Text style={styles.heroTitle}>{leadHero?.title ?? apt?.title ?? ""}</Text>
        </View>
        <View style={styles.xpCol}>
          <View style={styles.xpBg}>
            <View style={[styles.xpBar, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: elementColor }]} />
          </View>
          <Text style={styles.xpTxt}>{nextRank ? `${player.xp}/${nextRank.xpRequired} XP` : "MAX"}</Text>
        </View>
      </Pressable>

      {/* ── START SHIFT ── */}
      <PrimaryButton
        label="ENTER THE WARD"
        icon="medical"
        onPress={() => { logEvent("shifting_ward_opened", "home", {}); router.push("/shift"); }}
        style={styles.startBtn}
        testID="run-random-encounter"
      />

      {/* ── INTRO MODAL ── */}
      <Modal visible={showIntro} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.introOverlay}>
          <View style={styles.introPanel}>
            <View style={styles.introHandle} />
            <Text style={styles.introKicker}>A KINGDOM SHAPED LIKE THE BODY</Text>
            <Text style={styles.introTitle}>Welcome to Clinica</Text>
            <Text style={styles.introBody}>
              Five great regions — Air, River, Fire, Mind, Stone — each a living body system.{"\n\n"}
              Your healer team reads patient clues, keeps Stability above zero, and drives Corruption to zero.{"\n\n"}
              <Text style={{ color: COLORS.brand }}>Fight disease. Restore the body. Learn medicine through play.</Text>
            </Text>
            <View style={styles.introSystems}>
              {[
                { name: "Air",   desc: "Lungs",  color: COLORS.air   },
                { name: "River", desc: "Heart",  color: COLORS.river },
                { name: "Fire",  desc: "Immune", color: COLORS.fire  },
                { name: "Mind",  desc: "Neuro",  color: COLORS.mind  },
                { name: "Stone", desc: "Bone",   color: COLORS.forge },
              ].map((s) => (
                <View key={s.name} style={styles.sysPill}>
                  <View style={[styles.sysDot, { backgroundColor: s.color }]} />
                  <Text style={[styles.sysName, { color: s.color }]}>{s.name}</Text>
                  <Text style={styles.sysDesc}>{s.desc}</Text>
                </View>
              ))}
            </View>
            <Pressable style={styles.introCta} onPress={dismissIntro} testID="intro-dismiss">
              <Text style={styles.introCtaTxt}>BEGIN THE JOURNEY</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── DAILY WARD ROUNDS PANEL ── */}
      <DailyRoundsPanel visible={showRounds} onClose={() => setShowRounds(false)} />

      {/* ── C5 LEVEL 2 UNLOCK CELEBRATION ── */}
      <Lv2UnlockModal
        visible={showLv2Modal}
        onDismiss={() => {
          setShowLv2Modal(false);
          markLv2UnlockSeen();
        }}
      />
    </SafeAreaView>
  );
}

/* ── SceneBg wrapper — five-environment compositor ── */
function SceneBg({
  element, scene,
}: {
  element: string;
  scene: { accent: string; orb1: string; orb2: string };
}) {
  const o = scene.orb1;
  const elementTint: Record<string, string> = {
    River: "#60A5FA28", Air: "#A78BFA22", Fire: "#F9731625", Mind: "#7C3AED25",
  };

  return (
    <>
      {/* LAYER 1 — Illustrated donghua/anime scene background */}
      <Image
        source={require("../../assets/images/home_hub_bg.png")}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />

      {/* LAYER 2 — Subtle element identity tint (personalises shared scene per hero element) */}
      <View style={[StyleSheet.absoluteFillObject, {
        backgroundColor: elementTint[element] ?? "#6B728015",
      }]} />

      {/* LAYER 3a — hero ground shadow */}
      <LinearGradient
        colors={["#00000000", "rgba(4,6,10,0.55)"]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "38%" }}
      />
      <View style={{ position: "absolute", bottom: "1%", left: "28%", right: "28%", height: 18,
        borderRadius: 999, backgroundColor: "rgba(4,6,10,0.50)" }} />

      {/* LAYER 3b — edge depth vignette */}
      <LinearGradient colors={["rgba(4,6,10,0.45)", "rgba(4,6,10,0.0)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sc.edgeLeft} />
      <LinearGradient colors={["rgba(4,6,10,0.0)", "rgba(4,6,10,0.45)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sc.edgeRight} />

      {/* LAYER 3c — top vignette */}
      <LinearGradient colors={["rgba(4,6,10,0.40)", "rgba(4,6,10,0.0)"]} style={sc.topVignette} />
    </>
  );
}

// ── SystemHubOrientationPanel ─────────────────────────────────────────────────
// One-time System narrator orientation card shown on the first hub visit after
// reminiscence. Has two CTAs: "GO TO UNIVERSITY" (primary) and "EXPLORE THE HUB"
// (secondary dismiss). Replaces the broken 3-step TutorialOverlay flow that was
// starting silently because the hub had no <TutorialOverlay /> renderer.
function SystemHubOrientationPanel({
  player,
  onGoToUniversity,
  onExploreHub,
}: {
  player: any;
  onGoToUniversity: () => void;
  onExploreHub: () => void;
}) {
  const playerLevel = player?.player_level ?? playerLevelFromXp(player?.xp ?? 0).level;
  const identity = getSystemIdentity(playerLevel, player?.aptitude);
  const accent = identity.color;

  return (
    <View style={oriStyles.card}>
      {/* Narrator row */}
      <View style={oriStyles.row}>
        <View style={[oriStyles.portrait, { borderColor: accent + "AA" }]}>
          <Image source={identity.art} style={oriStyles.portraitImg} contentFit="cover" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={oriStyles.nameRow}>
            <Ionicons name="sparkles" size={11} color={accent} />
            <Text style={[oriStyles.name, { color: accent }]}>{identity.name.toUpperCase()}</Text>
          </View>
          <Text style={oriStyles.message}>
            Recall sequence stabilized.{"\n"}
            Main ward interface restored. This is your command screen — study, train, run simulations, and return to the ward when ready.
          </Text>
        </View>
      </View>

      {/* Objective chip */}
      <View style={oriStyles.objectiveChip}>
        <Ionicons name="flag" size={12} color={COLORS.brand} />
        <Text style={oriStyles.objectiveTxt}>
          <Text style={oriStyles.objectiveLabel}>OBJECTIVE  </Text>
          Begin corrective training at Clinica University
        </Text>
      </View>

      {/* Two-button row */}
      <View style={oriStyles.btnRow}>
        <Pressable style={oriStyles.secondaryBtn} onPress={onExploreHub} testID="orientation-explore-hub">
          <Text style={oriStyles.secondaryBtnTxt}>EXPLORE THE HUB</Text>
        </Pressable>
        <Pressable style={[oriStyles.primaryBtn, { backgroundColor: accent }]} onPress={onGoToUniversity} testID="orientation-go-university">
          <Text style={oriStyles.primaryBtnTxt}>GO TO UNIVERSITY</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.onBrand} />
        </Pressable>
      </View>
    </View>
  );
}

const oriStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: COLORS.brand + "55",
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.brand + "10",
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.md },
  portrait: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: "#0B1420",
    flexShrink: 0,
  },
  portraitImg: { width: 54, height: 54 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  message: { color: COLORS.onSurface, fontSize: 13, lineHeight: 18 },
  objectiveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(212,175,55,0.12)",
    borderWidth: 1,
    borderColor: COLORS.brand + "50",
    borderRadius: RADIUS.md,
    paddingVertical: 7,
    paddingHorizontal: SPACING.sm,
  },
  objectiveTxt: { flex: 1, color: COLORS.onSurface, fontSize: 12, lineHeight: 16 },
  objectiveLabel: { color: COLORS.brand, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  btnRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 2,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: COLORS.brand + "60",
    borderRadius: RADIUS.pill,
    paddingVertical: 9,
    paddingHorizontal: SPACING.md,
  },
  secondaryBtnTxt: {
    color: COLORS.brand,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: RADIUS.pill,
    paddingVertical: 9,
    paddingHorizontal: SPACING.md,
  },
  primaryBtnTxt: {
    color: COLORS.onBrand,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
});

/** Shared structural styles for SceneBg */
const sc = StyleSheet.create({
  edgeLeft:    { position: "absolute", top: 0, bottom: 0, left: 0,  width: "18%" },
  edgeRight:   { position: "absolute", top: 0, bottom: 0, right: 0, width: "18%" },
  topVignette: { position: "absolute", top: 0, left: 0, right: 0,   height: "22%" },
});

/* ── FeatureButton ── */
function FeatureButton({
  icon, label, color, locked, lockText, live, badge, onPress, testID,
}: {
  icon: string; label: string; color: string;
  locked?: boolean; lockText?: string; live?: boolean; badge?: number;
  onPress: () => void; testID?: string;
}) {
  return (
    <Pressable style={[styles.featBtn, locked && { opacity: 0.5 }]} onPress={onPress} testID={testID} hitSlop={6}>
      <View style={[styles.featCircle, {
        borderColor: locked ? COLORS.border : color + "70",
        backgroundColor: locked ? COLORS.surfaceTertiary : color + "18",
      }]}>
        <Ionicons name={icon as any} size={22} color={locked ? COLORS.onSurfaceTertiary : color} />
        {live && !locked ? <View style={styles.featLiveDot} /> : null}
        {!locked && badge && badge > 0 ? (
          <View style={styles.featBadge}>
            <Text style={styles.featBadgeTxt}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.featLabel, { color: locked ? COLORS.onSurfaceTertiary : color }]}>{label}</Text>
      {live && !locked ? <Text style={styles.featLiveTxt}>LIVE</Text> : null}
      {locked && lockText ? <Text style={styles.featLock}>{lockText}</Text> : null}
    </Pressable>
  );
}

/* ── Styles ── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: UI.bgDeep },

  /* Tutorial shortcut row (identity/stamina/currencies now live in PlayerHeader) */
  tutorialRow: {
    flexDirection: "row", justifyContent: "flex-end",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
  },
  headerBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: UI.panel, borderWidth: 1, borderColor: UI.border,
    alignItems: "center", justifyContent: "center",
  },

  lockedFeatureBtn: { opacity: 0.55 },

  /* Scene label */
  sceneLabelRow: {
    flexDirection: "row", alignItems: "center",
    gap: 5, paddingHorizontal: SPACING.lg, paddingBottom: 4,
  },
  sceneDot:  { width: 5, height: 5, borderRadius: 3 },
  sceneLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 2 },

  /* University onboarding banner (prominent first step for new players) */
  uniOnboard: { marginHorizontal: SPACING.md, marginTop: SPACING.xs, marginBottom: 2 },

  /* Arena — fills remaining vertical space */
  arena: { flex: 1, flexDirection: "row", alignItems: "stretch", overflow: "hidden" },

  /* Side columns */
  sideCol: { width: 72, justifyContent: "space-evenly", alignItems: "center", paddingVertical: SPACING.sm },
  featBtn:    { alignItems: "center", gap: 4 },
  featCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  featLabel:  { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, textAlign: "center" },
  featLock:   { color: COLORS.onSurfaceTertiary, fontSize: 9 },
  featLiveDot: {
    position: "absolute", top: 2, right: 2,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: "#34D399",
    borderWidth: 1.5, borderColor: COLORS.surface,
  },
  featLiveTxt: { color: "#34D399", fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  featBadge: {
    position: "absolute", top: -3, right: -3,
    minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: COLORS.error,
    borderWidth: 1.5, borderColor: COLORS.surface,
    alignItems: "center", justifyContent: "center",
  },
  featBadgeTxt: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },

  /* World Event banner (Shift hub entry point) */
  memoryBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginTop: SPACING.xs, marginBottom: 2,
    backgroundColor: "#1A140840", borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: "#E0B45C55",
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  memoryBannerKicker: { color: "#E0B45C", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  memoryBannerTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  eventBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginTop: SPACING.xs, marginBottom: 2,
    backgroundColor: "#065F4640", borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: "#34D39955",
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  eventBannerIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#34D39922",
    alignItems: "center", justifyContent: "center",
  },
  eventLiveDot: {
    position: "absolute", top: 1, right: 1,
    width: 9, height: 9, borderRadius: 5,
    borderWidth: 1.5, borderColor: COLORS.surface,
  },
  eventBannerTopRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  eventBannerKicker: { color: "#34D399", fontSize: 8, fontWeight: "800", letterSpacing: 1.5 },
  eventBannerBadge: {
    backgroundColor: "#5B9BD522", borderWidth: 1, borderColor: "#5B9BD555",
    borderRadius: RADIUS.pill, paddingHorizontal: 5, paddingVertical: 1,
  },
  eventBannerBadgeTxt: { color: "#5B9BD5", fontSize: 7, fontWeight: "800", letterSpacing: 1 },
  eventBannerTitle: { color: "#34D399", fontSize: 15, fontWeight: "700" },
  eventBannerSub:   { color: COLORS.onSurfaceSecondary, fontSize: 10, lineHeight: 13 },
  eventBannerClose: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },

  /* Hero center — transparent, no frame or pedestal */
  heroCenter: { flex: 1, position: "relative" },
  heroImg:        { flex: 1, width: "100%" },
  heroPlaceholder:{ flex: 1, backgroundColor: "transparent" },

  /* Tap hint */
  tapPulse: {
    position: "absolute", bottom: SPACING.sm, right: SPACING.sm,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(12,14,18,0.55)",
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  tapDot:   { width: 5, height: 5, borderRadius: 3, opacity: 0.85 },
  tapLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.6 },

  /* Hero info panel */
  infoPanel: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginTop: SPACING.xs,
    backgroundColor: UI.panel,
    borderRadius: UI_RADIUS.card, padding: SPACING.md, borderWidth: 1,
  },
  elementBadge: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 4, alignSelf: "center" },
  elementTxt:   { fontSize: 9, fontWeight: "700", letterSpacing: 1.4 },
  heroName:     { color: UI.text, fontSize: 15, fontWeight: "700" },
  heroTitle:    { color: UI.textSoft, fontSize: 11, marginTop: 1 },
  xpCol:        { alignItems: "flex-end", gap: 3 },
  xpBg:         { width: 64, height: 3, borderRadius: 2, backgroundColor: UI.divider, overflow: "hidden" },
  xpBar:        { height: "100%", borderRadius: 2 },
  xpTxt:        { color: UI.textDim, fontSize: 9, letterSpacing: 0.6 },

  /* Start button — layout only; visuals come from PrimaryButton */
  startBtn: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm, marginBottom: SPACING.xs,
  },

  /* Ward Defense card */
  wardDefBtn: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.air + "40",
    backgroundColor: COLORS.surfaceSecondary,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  wardDefLeft:  { flex: 1, gap: 2 },
  wardDefNew:   { color: COLORS.air, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  wardDefTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "700" },
  wardDefSub:   { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  wardDefRight: { flexDirection: "row", alignItems: "center", gap: 4 },

  /* Lotus Plate Journal card */
  lotusBtn: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.growth + "40",
    backgroundColor: COLORS.surfaceSecondary,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  lotusNew: { color: COLORS.growth, fontSize: 9, fontWeight: "700", letterSpacing: 2 },

  /* Intro modal */
  introOverlay: { flex: 1, backgroundColor: "rgba(10,7,16,0.9)", justifyContent: "flex-end" },
  introPanel: {
    backgroundColor: UI.panel,
    borderTopLeftRadius: UI_RADIUS.xl, borderTopRightRadius: UI_RADIUS.xl,
    padding: SPACING.xl, paddingBottom: SPACING.xxxl,
    borderTopWidth: 1, borderColor: UI.borderStrong,
    gap: SPACING.md,
  },
  introHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: UI.divider, alignSelf: "center", marginBottom: SPACING.sm },
  introKicker:  { color: UI.gold, fontSize: 10, fontWeight: "800", letterSpacing: 2.5 },
  introTitle:   { color: UI.text, fontSize: 26, fontWeight: "800" },
  introBody:    { color: UI.textSoft, fontSize: 14, lineHeight: 22 },
  introSystems: { flexDirection: "row", gap: SPACING.xs, flexWrap: "wrap" },
  sysPill:  { alignItems: "center", gap: 3, minWidth: 46 },
  sysDot:   { width: 8, height: 8, borderRadius: 4 },
  sysName:  { fontSize: 11, fontWeight: "700" },
  sysDesc:  { color: UI.textDim, fontSize: 9 },
  introCta: {
    backgroundColor: UI.gold, borderRadius: UI_RADIUS.pill,
    paddingVertical: SPACING.md + 2, alignItems: "center", marginTop: SPACING.sm,
    ...GLOW.gold,
  },
  introCtaTxt: { color: UI.onGold, fontSize: 13, fontWeight: "800", letterSpacing: 2 },
});
