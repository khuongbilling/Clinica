import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { ROUTES, dynRoute, type AppRoute } from "@/src/game/routes";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Modal, Pressable, StyleSheet, Text, View,
} from "react-native";
import { SanctuaryShortcutCard } from "@/src/components/sanctuary/SanctuaryShortcutCard";
import { SafeAreaView } from "react-native-safe-area-context";

import { APTITUDE_INFO, HEROES, RANKS } from "@/src/game/content";
import { getHeroSprite } from "@/src/components/HeroSprites";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { NarratorGuide } from "@/src/components/NarratorGuide";
import { LocationHeader } from "@/src/components/sanctuary/LocationHeader";
import { SystemObjectiveCard } from "@/src/components/sanctuary/SystemObjectiveCard";
import { HeroAffinityCard } from "@/src/components/sanctuary/HeroAffinityCard";
import { getAffinityMedallion, TREASURE_CHEST } from "@/src/game/affinityArtwork";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { useReducedMotion } from "@/src/hooks/useReducedMotion";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { UI, UI_RADIUS, GLOW } from "@/src/theme/ui";
import { PrimaryButton } from "@/src/components/ui/PrimaryButton";
import { EnterWardButton } from "@/src/components/ui";
import { ACTIVE_WORLD_EVENT, WORLD_EVENT_ACTIVE } from "@/src/game/worldEvent";
import { DailyRoundsPanel } from "@/src/components/DailyRoundsPanel";
import { Lv2UnlockModal } from "@/src/components/Lv2UnlockModal";
import { ensureFreshDailyRounds, claimableCount, checkInAvailable } from "@/src/game/dailyRounds";
import { nextAutoStoryScene } from "@/src/game/storyScenes";
import { getObjectiveProgress, getCurrentObjective, OBJECTIVES, type ObjectiveDef } from "@/src/game/objectiveProgress";
import { getHeroPortrait } from "@/src/components/HeroPortraits";
import { playerLevelFromXp, isFeatureUnlocked, buildGateContext, checkFeatureGate, heroXpCostForLevel } from "@/src/game/progression";
import { getProgress } from "@/src/game/evolution";
import { levelCapForStar } from "@/src/game/university";
import { useNewHeroCount } from "@/src/game/heroSeenStore";
import { useNewBagCount } from "@/src/game/bagSeenStore";
import { useNewRealmBuildingCount } from "@/src/game/realmSeenStore";
import { REALM_BUILDINGS, getAtriumLevel } from "@/src/game/realm";

const EMBLEM_IMAGES = {
  dailyRounds: require("../../assets/ui-icons/emblems/daily-rounds.png"),
  goals:       require("../../assets/ui-icons/emblems/goals.png"),
  recruit:     require("../../assets/ui-icons/emblems/recruit.png"),
  defense:     require("../../assets/ui-icons/emblems/defense.png"),
  supplies:    require("../../assets/ui-icons/emblems/supplies.png"),
  // Study + Realm moved off the nav bar to hub shortcut icons — reuse their
  // painted tab artwork so the design language stays consistent.
  study:       require("../../assets/ui-icons/tab-inventory.png"),
  realm:       require("../../assets/ui-icons/tab-realm.png"),
} as const;

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
      return "The System is online. Explore the hub — your stamina, currencies, and first heroes are here.";
    case "obj_lotus_recall":
    case "obj_identity_done":
    case "obj_diagnostic_done":
    case "obj_class_result":
    case "obj_memory_seen":
      return "Head to Clinica University — your clinical path begins there.";
    case "obj_university_arrived":
      return "The Fading Apprentice case is waiting — three clinical challenges, one chain.";
    case "obj_fading_apprentice_done":
      return "Complete The Fading Apprentice — Cue Hunt → Rapid Triage → Stabilize Stack.";
    case "obj_recruit_preview":
      return "Case chain complete. Build your team — visit the Recruitment Hall and enlist your first healer before entering Ward Shift.";
    case "obj_lotus_visited":
      return "Team assembled. Open Lotus Lessons — completing one will unlock Ward Shift simulations.";
    case "obj_lotus_first_lesson":
      return "Complete your first Lotus Lesson to unlock Ward Shift.";
    case "obj_ward_shift_first":
      return "Ward Shift unlocked — step into the ward for your first simulation.";
    default:
      return "Your path continues.";
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
      return "/university";
    case "obj_recruit_preview":
      return "/university/recruit";
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
  const reduceMotion = useReducedMotion();
  const { player, loading, openRoundsSignal, markLv2UnlockSeen } = usePlayer();
  const { isCompleted, markDone, startTutorial, activeTutorialId } = useTutorial();
  const [showIntro, setShowIntro] = useState(false);
  const [showRounds, setShowRounds] = useState(false);
  const [showLv2Modal, setShowLv2Modal] = useState(false);
  // Locally dismiss the obj_prologue_done guide card for this session
  // (tapping "Explore the Hub" on that card stays on the hub without navigating).
  const [localDismissGuide, setLocalDismissGuide] = useState(false);
  const roundsSignalSeen = useRef(0);
  // P6: return-session motivation card (session-scoped, resets each app open)
  const [showReturnCard, setShowReturnCard] = useState(false);
  const returnCardInitRef = useRef(false);

  // Objective-driven first-session guide — reloads whenever the hub gains focus
  // so returning from University / lessons always shows the freshest step.
  const [currentObjective, setCurrentObjective] = useState<ObjectiveDef | null | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      getObjectiveProgress().then((done) => setCurrentObjective(getCurrentObjective(done)));
    }, []),
  );

  // ── Hub shortcut card notification badges (hooks must be before early returns) ──
  // Recruit: badge when new heroes are owned but not yet viewed in the Heroes screen.
  const newHeroCount  = useNewHeroCount(player?.heroes_owned ?? []);
  const recruitBadge  = newHeroCount > 0 ? newHeroCount : undefined;
  // Supplies: badge when inventory has new items not yet viewed in the Bag screen.
  const newBagCount   = useNewBagCount(Object.keys(player?.inventory ?? {}));
  const suppliesBadge = newBagCount > 0 ? newBagCount : undefined;
  // Realm: badge when buildings unlock at the current atrium level but haven't been seen yet.
  const unlockedRealmIds = REALM_BUILDINGS
    .filter((b) => b.atriumLevelRequired <= getAtriumLevel(player?.kingdom_levels ?? {}))
    .map((b) => b.id);
  const newRealmCount = useNewRealmBuildingCount(unlockedRealmIds);
  const realmBadge    = newRealmCount > 0 ? newRealmCount : undefined;

  // P6: return-session motivation card — shown once per app session for Lv2+ players
  // who have finished the systemHubIntro orientation. Does NOT repeat on re-focus.
  useFocusEffect(
    useCallback(() => {
      if (returnCardInitRef.current || loading || !player) return;
      returnCardInitRef.current = true;
      const lvl = playerLevelFromXp(player.xp ?? 0).level;
      if (lvl >= 2 && player.seen_reminiscence && isCompleted("systemHubIntro")) {
        setShowReturnCard(true);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, player?.id, player?.xp, player?.seen_reminiscence]),
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

  // Push 26 — post-prologue orientation cleanup.
  // Players who reach the hub via the full flow always have seen_reminiscence=true.
  // Auto-dismiss the "Welcome to Clinica" intro modal so it never fires on top of
  // the NarratorGuide objective chain. systemHubIntro is handled separately below.
  // For edge-case players without seen_reminiscence (shouldn't reach hub), fall back
  // to the legacy INTRO_KEY check so the modal still shows.
  useEffect(() => {
    if (player?.seen_reminiscence) {
      AsyncStorage.setItem(INTRO_KEY, "1");
      return;
    }
    AsyncStorage.getItem(INTRO_KEY).then((v) => { if (!v) setShowIntro(true); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // systemHubIntro: play once on first hub visit after prologue (seen_reminiscence=true).
  // Fires for ALL players who have not yet seen it, regardless of chapter_progress.
  // Previously a chapterProgress >= 2 branch silently called markDone() here, which
  // permanently locked out the tutorial for players who advanced past Chapter 1 before
  // ever seeing the welcome sequence. That branch is removed: startTutorial's own
  // guards (completed / dismissed) prevent double-firing; the overlay runs at most once
  // per account unless replayed via Tutorial Encyclopedia.
  // The tutorial-center replay path (replayTutorial) always bypasses these guards.
  const systemHubIntroCompleted = isCompleted("systemHubIntro");
  useEffect(() => {
    if (!player || !player.seen_reminiscence) return;
    if (systemHubIntroCompleted) return;
    const t = setTimeout(() => startTutorial("systemHubIntro"), 700);
    return () => clearTimeout(t);
  }, [player?.seen_reminiscence, systemHubIntroCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const t = setTimeout(() => router.push(dynRoute.storyScene(scene.id)), 400);
      return () => clearTimeout(t);
    }
  }, [loading, player, showIntro, isCompleted, router]);

  useEffect(() => {
    if (reduceMotion) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.25, duration: 850, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 850, useNativeDriver: true }),
      Animated.delay(1600),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const hasRecruitedHeroes = (player.heroes_owned?.length ?? 0) > 0;
  const leadHeroId   = hasRecruitedHeroes ? (player.active_team?.[0] ?? player.heroes_owned?.[0] ?? null) : null;
  const leadHero     = leadHeroId ? HEROES.find((h) => h.id === leadHeroId) : null;
  const heroSprite   = leadHeroId ? getHeroSprite(leadHeroId) : null;
  const elementColor = ELEMENT_COLORS[leadHero?.element ?? "River"] ?? COLORS.river;

  // Hero-level XP (separate track from player rank XP shown in PlayerHeader)
  const heroProg     = leadHeroId != null ? getProgress(player.hero_progression, leadHeroId) : null;
  const heroLevel    = heroProg?.level ?? 1;
  const heroLvCap    = heroProg ? levelCapForStar(heroProg.star) : 10;
  const heroXpBanked = heroProg?.xp ?? 0;
  const heroXpNeeded = heroXpCostForLevel(heroLevel);
  const atHeroCap    = heroLevel >= heroLvCap;
  const heroXpPct    = atHeroCap ? 1 : Math.min(1, heroXpBanked / heroXpNeeded);

  const bossUnlocked = playerLevelInfo.level >= 7;
  // World Events (Miasma Bloom) are later-game content — gated at Player Level 10.
  const worldEventUnlocked = isFeatureUnlocked("world_event", playerLevelInfo.level);

  const scene = ARENA_SCENES[leadHero?.element ?? "River"] ?? FALLBACK_SCENE;

  // Progressive feature reveal — fix 10
  // Rounds / Summoning Hall unlock at Level 2.
  const roundsUnlocked   = playerLevelInfo.level >= 2;
  const summonUnlocked   = playerLevelInfo.level >= 2;
  // Ward Defense unlocks at Level 4.
  const wardDefUnlocked  = isFeatureUnlocked("ward_defense", playerLevelInfo.level);
  const realmUnlocked    = isFeatureUnlocked("realm",        playerLevelInfo.level);
  // Ward Shift requires first University lesson (narrative gate).
  const wardShiftGate    = checkFeatureGate("ward_shift", buildGateContext(player));

  // Daily Ward Rounds — free daily engagement loop. Hidden until the player has
  // begun (post-University), then shows a badge for pending check-in/claims.
  const roundsFresh = ensureFreshDailyRounds(player.daily_rounds, dailyRoundsUnlockedModes(player), player.id).state;
  const roundsBadge = claimableCount(roundsFresh) + (checkInAvailable(roundsFresh) ? 1 : 0);

  // Push 26 — Community board banner is hidden while the tutorial chain is active.
  // `currentObjective === null` is the signal that all 12 steps are done.
  // While `currentObjective` is `undefined` (still loading) or a live step,
  // the banner stays hidden so it never competes with the NarratorGuide card.
  const tutorialChainDone = currentObjective === null;
  const showCommunityBanner = WORLD_EVENT_ACTIVE && eventBannerDismissed === false
    && tutorialChainDone
    && (worldEventUnlocked || playerLevelInfo.level >= 3);

  return (
    <View style={styles.rootWrap}>
      {/* ── Full-screen environment background — renders behind SafeAreaView so the
           Sanctuary scene continues behind the player bar, location title, and
           System card (Push 3: removes the black upper slab). ── */}
      <SceneBg element={leadHero?.element ?? "River"} scene={scene} />
      {/* Top gradient — darkens the header zone for text readability without
           creating a hard edge. Covers status-bar → PlayerHeader → System card. */}
      <LinearGradient
        colors={["rgba(4,6,10,0.92)", "rgba(4,6,10,0.50)", "rgba(4,6,10,0.0)"]}
        style={styles.topGradient}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.root} edges={["top"]}>

      {/* ── TUTORIAL SHORTCUT — kept above the global header so it stays reachable ── */}
      <View style={styles.tutorialRow}>
        {realmUnlocked && (
          <Pressable
            style={styles.headerBtn}
            onPress={() => router.push(ROUTES.KINGDOM)}
            hitSlop={10}
            testID="home-realm-button"
            accessibilityLabel="Open Realm"
            accessibilityRole="button"
          >
            <Image source={EMBLEM_IMAGES.realm} style={{ width: 22, height: 22 }} contentFit="contain" />
          </Pressable>
        )}
        <Pressable
          style={styles.headerBtn}
          onPress={() => router.push(ROUTES.tutorial)}
          hitSlop={10}
          testID="run-tutorial-button"
          accessibilityLabel="Open tutorial"
          accessibilityRole="button"
        >
          <Ionicons name="help-circle-outline" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
      </View>

      {/* ── GLOBAL PLAYER HEADER — identity/stamina/currencies/EXP (Push 3.5) ── */}
      <PlayerHeader player={player} />

      {/* ── SCENE LOCATION HEADER — Ink & Mist style with diamond decorators ── */}
      <LocationHeader
        sceneName={scene.name}
        subtitle={leadHero ? `${leadHero.element} Affinity · Active Ward` : "A place of healing and learning."}
      />

      {/* ── WORLD EVENT / COMMUNITY BOARD BANNER ─────────────────────────────
           Lv10+ (unlocked): full "WORLD EVENT · LIVE" banner linking to the
           active event dashboard.
           Lv1–9 (pre-unlock): softer "COMMUNITY HEALTH BOARD · READ-ONLY"
           banner linking to the same /world-event route, which already shows
           the rich public-health education view for pre-unlock players.
           Both states are dismissible with the same per-event key.          */}
      {showCommunityBanner && (
        <Pressable
          style={[styles.eventBanner, !worldEventUnlocked && styles.eventBannerBoard]}
          onPress={() => router.push(ACTIVE_WORLD_EVENT.route as AppRoute)}
          testID="home-world-event-banner"
          accessibilityLabel={worldEventUnlocked ? `World event: ${ACTIVE_WORLD_EVENT.title}` : "Community Health Board — read-only preview"}
          accessibilityRole="button"
        >
          <View style={styles.eventBannerIcon}>
            <Ionicons
              name={worldEventUnlocked ? "earth" : "newspaper-outline"}
              size={22}
              color={ACTIVE_WORLD_EVENT.accentColor}
            />
            {worldEventUnlocked && (
              <View style={[styles.eventLiveDot, { backgroundColor: ACTIVE_WORLD_EVENT.accentColor }]} />
            )}
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <View style={styles.eventBannerTopRow}>
              <Text style={styles.eventBannerKicker}>
                {worldEventUnlocked ? "WORLD EVENT · LIVE" : "COMMUNITY HEALTH BOARD"}
              </Text>
              <View style={[styles.eventBannerBadge, !worldEventUnlocked && styles.eventBannerBadgeBoard]}>
                <Text style={styles.eventBannerBadgeTxt}>
                  {worldEventUnlocked ? ACTIVE_WORLD_EVENT.badge.toUpperCase() : "READ-ONLY"}
                </Text>
              </View>
            </View>
            <Text style={styles.eventBannerTitle}>
              {worldEventUnlocked ? ACTIVE_WORLD_EVENT.title : "Public Health Watch"}
            </Text>
            <Text style={styles.eventBannerSub} numberOfLines={1}>
              {worldEventUnlocked
                ? ACTIVE_WORLD_EVENT.subtitle
                : "Follow the Miasma Bloom — learn how communities fight outbreaks."}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={ACTIVE_WORLD_EVENT.accentColor} />
          <Pressable
            style={styles.eventBannerClose}
            onPress={(e) => { e.stopPropagation?.(); dismissEventBanner(); }}
            hitSlop={10}
            testID="home-world-event-dismiss"
            accessibilityLabel="Dismiss banner"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
        </Pressable>
      )}

      {/* ── OBJECTIVE-DRIVEN FIRST-SESSION GUIDE ─────────────────────────────
           Single step-by-step card that drives the player through the 12-step
           tutorial chain.  Content refreshes on every hub focus so returning
           from University / lessons always shows the current step.
           systemHubIntro and the intro modal are auto-dismissed in the
           useEffect above for all post-prologue players (seen_reminiscence=true),
           so this card is the ONLY orientation layer a new player sees.         */}
      {/* ── MAIN ARENA — side cols + hero portrait float above the full-screen bg ── */}
      <View style={styles.arena}>

      {/* The System guide + return card float OVER the arena (absolute overlay)
           so they never push the hero avatar / side shortcuts down. */}
      {!localDismissGuide && !activeTutorialId && currentObjective && currentObjective.step <= 15 && (
        <View style={styles.guideOverlay} pointerEvents="box-none">
          <SystemObjectiveCard
            message={hubGuideMessage(currentObjective)}
            objective={`Step ${currentObjective.step} of ${OBJECTIVES.length} — ${currentObjective.title}`}
            ctaLabel={hubGuideCta(currentObjective)}
            onPress={() => {
              const route = hubGuideRoute(currentObjective);
              if (!route) {
                setLocalDismissGuide(true);
              } else {
                router.push(route as AppRoute);
              }
            }}
            onDismiss={currentObjective.id === "obj_prologue_done" ? () => setLocalDismissGuide(true) : undefined}
            defaultOpen={true}
            testID="home-objective-guide"
          />
        </View>
      )}

      {/* P6: return-session motivation card — once per session for Lv2+ returning players */}
      {showReturnCard && isCompleted("systemHubIntro") && !(currentObjective && currentObjective.step <= 15) && (
        <View style={styles.guideOverlay} pointerEvents="box-none">
          <ReturnSessionCard
            roundsBadge={roundsBadge}
            onRounds={() => { setShowRounds(true); setShowReturnCard(false); }}
            onJourney={() => { router.push(ROUTES.JOURNEY); setShowReturnCard(false); }}
            onDismiss={() => setShowReturnCard(false)}
          />
        </View>
      )}

        {/* LAYER 2 — side columns (float above bg, transparent backgrounds) */}

        {/* LEFT COLUMN — Study · Rounds · Goals · Recruit (locked shortcuts are hidden, not dimmed) */}
        <View style={styles.sideCol}>
          <SanctuaryShortcutCard
            emblem={EMBLEM_IMAGES.study}
            label="Study"
            available
            onPress={() => router.push(ROUTES.UNIVERSITY)}
            testID="home-float-study"
          />
          {roundsUnlocked && (
            <SanctuaryShortcutCard
              emblem={EMBLEM_IMAGES.dailyRounds}
              label="Rounds"
              badge={roundsBadge}
              onPress={() => setShowRounds(true)}
              testID="home-float-rounds"
            />
          )}
          {roundsUnlocked && (
            <SanctuaryShortcutCard
              emblem={EMBLEM_IMAGES.goals}
              label="Goals"
              available
              onPress={() => router.push(ROUTES.MILESTONES)}
              testID="home-float-goals"
            />
          )}
          {summonUnlocked && (
            <SanctuaryShortcutCard
              emblem={EMBLEM_IMAGES.recruit}
              label="Recruit"
              available={!recruitBadge}
              badge={recruitBadge}
              onPress={() => router.push(ROUTES.UNI_RECRUIT)}
              testID="home-float-recruit"
            />
          )}
        </View>

        {/* CENTER — hero portrait (plain, no frame, no pedestal, no blob) */}
        <Pressable
          style={styles.heroCenter}
          onPress={() => router.push(hasRecruitedHeroes ? ROUTES.heroSelect : summonUnlocked ? ROUTES.UNI_RECRUIT : ROUTES.UNIVERSITY)}
          testID="home-portrait-tap"
          accessibilityLabel={hasRecruitedHeroes ? "Change active hero" : summonUnlocked ? "Recruit your first hero" : "Go to University to unlock recruitment"}
          accessibilityRole="button"
        >
          {hasRecruitedHeroes && heroSprite ? (
            <Image
              source={heroSprite}
              style={styles.heroImg}
              contentFit="contain"
              contentPosition="center"
            />
          ) : hasRecruitedHeroes ? (
            <View style={styles.heroPlaceholder} />
          ) : (
            /* No heroes yet — prompt only shown once summoning is unlocked */
            <View style={styles.heroEmptyState}>
              <Ionicons name="people-outline" size={36} color="rgba(255,255,255,0.18)" />
              <Text style={styles.heroEmptyTxt}>No healer recruited</Text>
              {summonUnlocked && (
                <View style={styles.heroEmptyBtn}>
                  <Text style={styles.heroEmptyBtnTxt}>RECRUIT NOW</Text>
                </View>
              )}
            </View>
          )}

          {/* Tap hint — shown only when a hero is active */}
          {hasRecruitedHeroes && (
            <Animated.View pointerEvents="none" style={[styles.tapPulse, { opacity: pulseAnim }]}>
              <View style={[styles.tapDot, { backgroundColor: elementColor }]} />
              <Text style={styles.tapLabel}>tap to change</Text>
            </Animated.View>
          )}
        </Pressable>

        {/* RIGHT COLUMN — Realm · Defense · Supplies (locked shortcuts are hidden, not dimmed) */}
        <View style={styles.sideCol}>
          {realmUnlocked && (
            <SanctuaryShortcutCard
              emblem={EMBLEM_IMAGES.realm}
              label="Realm"
              available
              badge={realmBadge}
              onPress={() => router.push(ROUTES.KINGDOM)}
              testID="home-float-realm"
            />
          )}
          {wardDefUnlocked && (
            <SanctuaryShortcutCard
              emblem={EMBLEM_IMAGES.defense}
              label="Defense"
              available
              onPress={() => router.push(ROUTES.WARD_DEFENSE)}
              testID="home-float-ward-defense"
            />
          )}
          {roundsUnlocked && (
            <SanctuaryShortcutCard
              emblem={EMBLEM_IMAGES.supplies}
              label="Supplies"
              badge={suppliesBadge}
              onPress={() => router.push(ROUTES.ITEM_BAG)}
              testID="home-float-supplies"
            />
          )}
        </View>
      </View>

      {/* ── HERO INFO PANEL — only when a hero is recruited ── */}
      {hasRecruitedHeroes && leadHero ? (
        <View style={styles.infoPanelWrap}>
          <HeroAffinityCard
            hero={{
              name:              leadHero.name,
              profession:        leadHero.title ?? "",
              level:             heroLevel,
              affinity:          leadHero.element,
              affinityArtwork:   getAffinityMedallion(leadHero.element),
              currentXP:         heroXpBanked,
              requiredXP:        heroXpNeeded,
              nextRewardArtwork: TREASURE_CHEST,
              atLevelCap:        atHeroCap,
            }}
            accentColor={elementColor}
            onPress={() => leadHeroId && router.push(`/hero/${leadHeroId}` as any)}
            testID="home-hero-card"
          />
        </View>
      ) : summonUnlocked ? (
        /* No heroes + hall unlocked — compact recruit prompt below the arena */
        <Pressable
          style={styles.infoPanelRecruit}
          onPress={() => router.push(ROUTES.UNI_RECRUIT)}
          testID="home-recruit-prompt"
          accessibilityLabel="Your first healer awaits — visit the Recruitment Hall"
          accessibilityRole="button"
        >
          <Ionicons name="sparkles" size={18} color={UI.gold} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={styles.infoPanelRecruitTitle} numberOfLines={1}>Your first healer awaits</Text>
            <Text style={styles.infoPanelRecruitSub} numberOfLines={2}>Visit the Recruitment Hall to summon your team</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={UI.gold} />
        </Pressable>
      ) : null}

      {/* ── START SHIFT — gated: first University lesson required ── */}
      {wardShiftGate.unlocked ? (
        <EnterWardButton
          onPress={() => router.push(ROUTES.shift)}
          style={styles.startBtn}
          heightScale={0.75}
          testID="run-random-encounter"
        />
      ) : (
        <View style={styles.wardLockedCard}>
          <View style={styles.wardLockedIconWrap}>
            <Ionicons name="lock-closed" size={20} color={UI.jade} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.wardLockedCardTitle} numberOfLines={1}>WARD SHIFT · LOCKED</Text>
            <Text style={styles.wardLockedCardSub} numberOfLines={2}>
              {wardShiftGate.reason ?? "Finish your first Clinica University lesson to unlock the ward."}
            </Text>
          </View>
          <Pressable
            style={styles.wardLockedCardCta}
            onPress={() => router.push(ROUTES.UNIVERSITY)}
            accessibilityLabel="Go to University to unlock Ward Shift"
            accessibilityRole="button"
          >
            <Text style={styles.wardLockedCardCtaTxt}>TRAIN</Text>
            <Ionicons name="arrow-forward" size={12} color="#082019" />
          </Pressable>
        </View>
      )}

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
            <Pressable
              style={styles.introCta}
              onPress={dismissIntro}
              testID="intro-dismiss"
              accessibilityLabel="Begin the journey"
              accessibilityRole="button"
            >
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
    </View>
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
      {/* Shifted up ~10% so the circular stone platform in the artwork sits
           right under the hero portrait's feet; the uncovered strip at the
           bottom hides behind the ground-shadow gradient and info panels. */}
      <Image
        source={require("../../assets/images/home_hub_bg_v4.png")}
        style={{ position: "absolute", left: 0, right: 0, top: "-10%", height: "100%" }}
        contentFit="cover"
      />
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "10%",
        backgroundColor: UI.sanctuaryBg }} />

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


// ── ReturnSessionCard ─────────────────────────────────────────────────────────
// P6: compact dismissible card shown once per app session for Lv2+ returning players.
// Surfaces the highest-value next action (claim rounds → continue journey).
function ReturnSessionCard({
  roundsBadge, onRounds, onJourney, onDismiss,
}: {
  roundsBadge: number;
  onRounds: () => void;
  onJourney: () => void;
  onDismiss: () => void;
}) {
  const hasRewards = roundsBadge > 0;
  return (
    <View style={rcStyles.card}>
      <Pressable style={rcStyles.dismiss} onPress={onDismiss} hitSlop={10}>
        <Ionicons name="close" size={14} color={COLORS.onSurfaceTertiary} />
      </Pressable>
      <View style={rcStyles.row}>
        <View style={rcStyles.iconWrap}>
          <Ionicons
            name={hasRewards ? "gift-outline" : "map-outline"}
            size={16}
            color={COLORS.brand}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={rcStyles.label}>
            {hasRewards ? "Daily rewards ready to claim" : "Continue your chapter journey"}
          </Text>
          <Text style={rcStyles.sub}>
            {hasRewards
              ? `${roundsBadge} unclaimed reward${roundsBadge > 1 ? "s" : ""} in Ward Rounds`
              : "Open the Journey Map to advance"}
          </Text>
        </View>
        <Pressable
          style={rcStyles.btn}
          onPress={hasRewards ? onRounds : onJourney}
          accessibilityLabel={hasRewards ? "Claim daily rewards" : "Open Journey Map"}
          accessibilityRole="button"
        >
          <Text style={rcStyles.btnTxt}>GO</Text>
          <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const rcStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: UI.jade + "50",
    borderRadius: RADIUS.md,
    backgroundColor: UI.sanctuaryCard,
    padding: SPACING.sm,
    position: "relative",
  },
  dismiss: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingRight: 20,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.brand + "1A",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.onSurface,
    lineHeight: 18,
  },
  sub: {
    fontSize: 11,
    color: COLORS.onSurfaceTertiary,
    lineHeight: 15,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: UI.jade,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexShrink: 0,
  },
  btnTxt: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
});


/** Shared structural styles for SceneBg */
const sc = StyleSheet.create({
  edgeLeft:    { position: "absolute", top: 0, bottom: 0, left: 0,  width: "18%" },
  edgeRight:   { position: "absolute", top: 0, bottom: 0, right: 0, width: "18%" },
  topVignette: { position: "absolute", top: 0, left: 0, right: 0,   height: "22%" },
});


/* ── Styles ── */
const styles = StyleSheet.create({
  // Outermost wrapper — holds the full-screen SceneBg behind SafeAreaView
  rootWrap: { flex: 1, backgroundColor: UI.sanctuaryBg },
  // SafeAreaView is transparent; background comes from rootWrap + SceneBg
  root: { flex: 1 },
  // Gradient that darkens from top → transparent, covering header + System card zone
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },

  /* Tutorial shortcut row (identity/stamina/currencies now live in PlayerHeader) */
  tutorialRow: {
    flexDirection: "row", justifyContent: "flex-end",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
  },
  headerBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: UI.panel, borderWidth: 1, borderColor: UI.border,
    alignItems: "center", justifyContent: "center",
  },

  lockedFeatureBtn: { opacity: 0.55 },

  /* University onboarding banner (prominent first step for new players) */
  uniOnboard: { marginHorizontal: SPACING.md, marginTop: SPACING.xs, marginBottom: 2 },

  /* System guide / return card — floats over the arena instead of pushing it down */
  guideOverlay: {
    position: "absolute",
    top: SPACING.xs,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 30,
  },

  /* Arena — fills remaining vertical space */
  arena: { flex: 1, flexDirection: "row", alignItems: "stretch", overflow: "hidden" },

  /* Side columns — Pull inward so cards sit just off the hero portrait */
  sideCol: { width: 72, justifyContent: "space-evenly", alignItems: "center", paddingVertical: SPACING.sm, paddingHorizontal: 2 },

  /* World Event banner (Shift hub entry point) */
  memoryBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginTop: SPACING.xs, marginBottom: 2,
    backgroundColor: "#1A140840", borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: "#E0B45C55",
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  memoryBannerKicker: { color: "#E0B45C", fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  memoryBannerTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: "600" },
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
  eventBannerKicker: { color: "#34D399", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  eventBannerBadge: {
    backgroundColor: "#5B9BD522", borderWidth: 1, borderColor: "#5B9BD555",
    borderRadius: RADIUS.pill, paddingHorizontal: 5, paddingVertical: 1,
  },
  eventBannerBadgeTxt: { color: "#5B9BD5", fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  eventBannerBoard: {
    backgroundColor: "#065F4625", borderColor: "#34D39933",
  },
  eventBannerBadgeBoard: {
    backgroundColor: "#34D39918", borderColor: "#34D39944",
  },
  eventBannerTitle: { color: "#34D399", fontSize: 18, fontWeight: "700" },
  eventBannerSub:   { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  eventBannerClose: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },

  /* Hero center — transparent, no frame or pedestal */
  heroCenter: { flex: 1, position: "relative" },
  heroImg:        { flex: 1, width: "100%" },
  heroPlaceholder:{ flex: 1, backgroundColor: "transparent" },

  /* Empty state — no hero recruited yet */
  heroEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  heroEmptyTxt: {
    color: "rgba(255,255,255,0.30)",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  heroEmptyBtn: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: UI.gold + "55",
    backgroundColor: UI.gold + "14",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroEmptyBtnTxt: {
    color: UI.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },

  /* Tap hint */
  tapPulse: {
    position: "absolute", bottom: SPACING.sm, right: SPACING.sm,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(12,14,18,0.55)",
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  tapDot:   { width: 5, height: 5, borderRadius: 3, opacity: 0.85 },
  tapLabel: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 0.3 },

  /* Recruit prompt — shown instead of hero info panel when no heroes */
  infoPanelRecruit: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    backgroundColor: UI.gold + "0E",
    borderRadius: UI_RADIUS.card,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: UI.gold + "40",
  },
  infoPanelRecruitTitle: {
    color: UI.gold + "EE",
    fontSize: 15,
    fontWeight: "700",
  },
  infoPanelRecruitSub: {
    color: UI.textDim,
    fontSize: 12,
    lineHeight: 17,
  },

  /* Hero info panel wrapper — push-7 HeroAffinityCard sits here */
  infoPanelWrap: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
  },

  /* Start button — layout only; visuals come from PrimaryButton */
  startBtn: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm, marginBottom: SPACING.xs,
  },

  /* Ward Shift locked state — RPG locked gate card */
  wardLockedCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm, marginBottom: SPACING.xs,
    backgroundColor: UI.sanctuaryCard,
    borderWidth: 1.5, borderColor: UI.jade + "35",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  wardLockedIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: UI.jade + "18",
    borderWidth: 1.5, borderColor: UI.jade + "50",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  wardLockedCardTitle: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13, fontWeight: "700", letterSpacing: 0.5,
  },
  wardLockedCardSub: {
    color: UI.textDim, fontSize: 13, lineHeight: 20,
  },
  wardLockedCardCta: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: UI.jade,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12, paddingVertical: 8,
    flexShrink: 0,
  },
  wardLockedCardCtaTxt: {
    color: "#082019", fontSize: 13, fontWeight: "700", letterSpacing: 0.3,
  },

  /* Ward Defense card */
  wardDefBtn: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.air + "40",
    backgroundColor: UI.sanctuaryPanel,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  wardDefLeft:  { flex: 1, gap: 2 },
  wardDefNew:   { color: COLORS.air, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  wardDefTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: "700" },
  wardDefSub:   { color: COLORS.onSurfaceTertiary, fontSize: 13 },
  wardDefRight: { flexDirection: "row", alignItems: "center", gap: 4 },

  /* Lotus Plate Journal card */
  lotusBtn: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.growth + "40",
    backgroundColor: UI.sanctuaryPanel,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  lotusNew: { color: COLORS.growth, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },

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
  introKicker:  { color: UI.gold, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  introTitle:   { color: UI.text, fontSize: 30, fontWeight: "800" },
  introBody:    { color: UI.textSoft, fontSize: 15, lineHeight: 23 },
  introSystems: { flexDirection: "row", gap: SPACING.xs, flexWrap: "wrap" },
  sysPill:  { alignItems: "center", gap: 3, minWidth: 46 },
  sysDot:   { width: 8, height: 8, borderRadius: 4 },
  sysName:  { fontSize: 13, fontWeight: "700" },
  sysDesc:  { color: UI.textDim, fontSize: 13 },
  introCta: {
    backgroundColor: UI.gold, borderRadius: UI_RADIUS.pill,
    paddingVertical: SPACING.md + 2, /* +2 gives 14 px — sits between md(12) and lg; intentional larger touch target */ alignItems: "center", marginTop: SPACING.sm,
    ...GLOW.gold,
  },
  introCtaTxt: { color: UI.onGold, fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
});
