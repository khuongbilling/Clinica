import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ROUTES, dynRoute } from "@/src/game/routes";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BannerCard } from "@/src/components/ModeBanners";
import { ModeCard } from "@/src/components/ModeCard";
import { StaminaPill } from "@/src/components/StaminaPill";
import { SystemNarratorBar } from "@/src/components/SystemNarratorBar";
import { InlineNotice, useInlineNotice } from "@/src/components/WebAlert";
import { DailyRoundsPanel } from "@/src/components/DailyRoundsPanel";
import { DailyRhythmCard } from "@/src/components/DailyRhythmCard";
import { RPGTabBar, RPGTab } from "@/src/components/RPGTabBar";
import { ShiftEmblem, UniversityEmblem, BossWardEmblem, LotusJournalEmblem } from "@/src/components/ClinicaEmblems";
import { usePlayer } from "@/src/game/store";
import { ensureFreshDailyRounds, claimableCount, checkInAvailable } from "@/src/game/dailyRounds";
import { useTutorial } from "@/src/game/tutorialStore";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { useWebBackToHub } from "@/src/hooks/useWebBackToHub";
import { isFeatureUnlocked, playerLevelFromXp, checkFeatureGate, type CompoundGateContext } from "@/src/game/progression";
import {
  CLINICAL_CHALLENGE_MODES, ModeCardDef, nextComingSoonMode,
  UNIVERSITY_HUB_MODE, WARD_SHIFT_MODE, WELLNESS_MODES,
} from "@/src/game/modeHub";
import { ROUTES } from "@/src/game/routes";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";

const DAILY_ROUNDS_MODES = ["ward_shift", "ward_defense", "university", "lotus_journal", "hall_of_heroes"];
function dailyRoundsUnlockedModes(player: any): string[] {
  const ctx = {
    level: playerLevelFromXp(player?.xp ?? 0).level,
    firstWardShiftDone: (player?.runs_completed ?? 0) > 0,
    lessonsStarted: (player?.lessons_completed?.length ?? 0) > 0,
  };
  return DAILY_ROUNDS_MODES.filter((m) => checkFeatureGate(m, ctx).unlocked);
}

export default function ShiftPage() {
  const router = useRouter();
  const { player } = usePlayer();
  const { isCompleted, startTutorial } = useTutorial();
  const { notice, flashNotice } = useInlineNotice();
  const [showRounds, setShowRounds] = useState(false);
  const [activeTab, setActiveTab]   = useState("cases");

  useClearTutorialOnExit();
  useWebBackToHub("/(tabs)");

  const playerLevel = player ? (player.player_level ?? playerLevelFromXp(player.xp ?? 0).level) : 1;
  const roundsFresh = player ? ensureFreshDailyRounds(player.daily_rounds, dailyRoundsUnlockedModes(player), player.id).state : null;
  const roundsBadge = roundsFresh ? claimableCount(roundsFresh) + (checkInAvailable(roundsFresh) ? 1 : 0) : 0;

  const gateCtx: CompoundGateContext = {
    level: playerLevel,
    firstWardShiftDone: (player?.runs_completed ?? 0) > 0,
    lessonsStarted: (player?.lessons_completed?.length ?? 0) > 0,
  };
  const universityGate    = checkFeatureGate("university", gateCtx);
  const wardShiftGate     = checkFeatureGate("ward_shift", gateCtx);
  const wardShiftUnlocked = wardShiftGate.unlocked;
  // Push 5 — if Ward Shift is unlocked but the player hasn't done their second
  // tutorial summon and still has fewer than 2 heroes, prompt them to visit the
  // Recruitment Ceremony before entering their first shift.
  const needsSecondSummon = wardShiftUnlocked
    && !(player?.tutorial_summon_2_done ?? false)
    && (player?.heroes_owned?.length ?? 0) < 2;
  const wardDefenseUnlocked = isFeatureUnlocked("ward_defense", playerLevel);
  const bossUnlocked        = isFeatureUnlocked("boss", playerLevel);

  useEffect(() => {
    if (!player) return;
    if (isCompleted("systemHubIntro") && !isCompleted("systemWardHub")) {
      const t = setTimeout(() => startTutorial("systemWardHub"), 500);
      return () => clearTimeout(t);
    }
  }, [player, isCompleted, startTutorial]);

  if (!player) {
    return (
      <SafeAreaView style={[styles.root, styles.loading]} edges={["top", "bottom"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  const activeClinical = CLINICAL_CHALLENGE_MODES.filter((m) => m.status === "active");
  const activeWellness = WELLNESS_MODES.filter((m) => m.status === "active");
  const nextUp         = nextComingSoonMode(player.chapter_progress ?? 1);
  const showUniversityPrompt = !wardShiftUnlocked;

  const openIntro = (mode: ModeCardDef) => {
    if (mode.status === "coming_soon" || mode.status === "locked") {
      const when = mode.unlockChapter ? ` Opens in Chapter ${mode.unlockChapter}.` : "";
      flashNotice(`${mode.title} — Coming Soon.${when}`);
      return;
    }
    router.push(dynRoute.mode(mode.id));
  };

  const TABS: RPGTab[] = [
    { key: "cases",    label: "Cases",    emblem: (a) => <ShiftEmblem        size={14} color={a ? UI.onGold : UI.gold} /> },
    { key: "practice", label: "Practice", emblem: (a) => <UniversityEmblem   size={14} color={a ? UI.onGold : UI.gold} /> },
    { key: "boss",     label: "Boss",     emblem: (a) => <BossWardEmblem     size={14} color={a ? UI.onGold : UI.gold} />, locked: !bossUnlocked },
    { key: "journal",  label: "Journal",  emblem: (a) => <LotusJournalEmblem size={14} color={a ? UI.onGold : UI.gold} />, badge: roundsBadge || undefined },
  ];

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.replace(ROUTES.tabs)} hitSlop={10} testID="shift-back">
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>WARD OPERATIONS</Text>
          <Text style={styles.title}>Choose Your Mode</Text>
        </View>
        <StaminaPill player={player} />
      </View>

      <RPGTabBar tabs={TABS} activeTab={activeTab} onTabPress={setActiveTab} />

      <InlineNotice notice={notice} icon="lock-closed" testID="shift-notice" />

      {/* ── CASES — Ward Shift simulations ── */}
      {activeTab === "cases" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <DailyRhythmCard player={player} onPress={() => setShowRounds(true)} />

          {showUniversityPrompt && (
            <>
              <SystemNarratorBar
                message="Complete your first Lotus Lesson at Clinica University to unlock Ward Shift."
                testID="shift-narrator-university"
              />
              <Pressable
                style={styles.universityCtaBtn}
                onPress={() => router.push(dynRoute.lotusLesson("recognizing-cues-hydration"))}
                testID="shift-go-to-university"
              >
                <Ionicons name="leaf" size={16} color={COLORS.onBrand} />
                <Text style={styles.universityCtaTxt}>Start First Lotus Lesson</Text>
                <Ionicons name="arrow-forward" size={15} color={COLORS.onBrand} />
              </Pressable>
            </>
          )}

          {needsSecondSummon && (
            <>
              <SystemNarratorBar
                message="Complete your second Recruitment Ceremony to enter Ward Shift with a full team."
                testID="shift-narrator-summon2"
              />
              <Pressable
                style={styles.universityCtaBtn}
                onPress={() => router.push(ROUTES.UNI_RECRUIT)}
                testID="shift-go-to-recruit"
              >
                <Ionicons name="sparkles" size={16} color={COLORS.onBrand} />
                <Text style={styles.universityCtaTxt}>Complete Recruitment Ceremony</Text>
                <Ionicons name="arrow-forward" size={15} color={COLORS.onBrand} />
              </Pressable>
            </>
          )}

          <Text style={styles.section}>Ward Shift</Text>
          <BannerCard
            mode={WARD_SHIFT_MODE}
            height={156}
            locked={!wardShiftUnlocked}
            lockLabel={!wardShiftUnlocked ? "Complete your first Lotus Lesson" : undefined}
            onPress={() => {
              if (!wardShiftUnlocked) {
                flashNotice("Complete your first Lotus Lesson to unlock Ward Shift simulations.");
                return;
              }
              if (needsSecondSummon) {
                router.push(ROUTES.UNI_RECRUIT);
                return;
              }
              openIntro(WARD_SHIFT_MODE);
            }}
            testID="mode-ward-shift"
          />

          <Text style={styles.section}>Ward Defense</Text>
          {activeClinical
            .filter((m) => m.id === "ward-defense")
            .map((m) => {
              const locked = !wardDefenseUnlocked;
              return (
                <BannerCard
                  key={m.id} mode={m} height={128}
                  locked={locked}
                  lockLabel={locked ? "Unlocks at Level 4" : undefined}
                  onPress={() => {
                    if (locked) { flashNotice("Ward Defense unlocks at Player Level 4."); return; }
                    openIntro(m);
                  }}
                  testID={`mode-${m.id}`}
                />
              );
            })}

          {nextUp && (
            <>
              <Text style={styles.section}>Coming Soon</Text>
              <View style={styles.smallGrid}>
                <ModeCard mode={nextUp} onPress={() => openIntro(nextUp)} testID={`mode-${nextUp.id}`} />
              </View>
              <View style={styles.footNote}>
                <Ionicons name="information-circle-outline" size={13} color={COLORS.onSurfaceTertiary} />
                <Text style={styles.footNoteTxt}>
                  {nextUp.unlockChapter
                    ? `Preview — opens in Chapter ${nextUp.unlockChapter}. Tapping never spends resources.`
                    : "Preview only — tapping never spends resources."}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ── PRACTICE — University + Cue Lab ── */}
      {activeTab === "practice" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.section}>Clinica University</Text>
          <BannerCard
            mode={UNIVERSITY_HUB_MODE}
            height={168}
            locked={!universityGate.unlocked}
            lockLabel={!universityGate.unlocked ? "Keep progressing to unlock" : undefined}
            onPress={() => {
              if (!universityGate.unlocked) {
                flashNotice(universityGate.reason || "Clinica University is locked.");
                return;
              }
              router.push(ROUTES.UNIVERSITY);
            }}
            testID="ward-hub-university"
          />

          <Text style={styles.section}>Other Clinical Challenges</Text>
          {activeClinical
            .filter((m) => m.id !== "ward-defense")
            .map((m) => {
              const isBossWard = m.id === "boss-ward";
              const locked = isBossWard && !bossUnlocked;
              return (
                <BannerCard
                  key={m.id} mode={m} height={128}
                  locked={locked}
                  lockLabel={locked ? "Unlocks at Level 9" : undefined}
                  onPress={() => {
                    if (locked) { flashNotice("Boss Encounters unlock at Player Level 9."); return; }
                    openIntro(m);
                  }}
                  testID={`mode-${m.id}`}
                />
              );
            })}
        </ScrollView>
      )}

      {/* ── BOSS — Boss Encounters ── */}
      {activeTab === "boss" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {!bossUnlocked ? (
            <View style={styles.lockedTabCard}>
              <Ionicons name="skull" size={36} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.lockedTabTitle}>Boss Encounters</Text>
              <Text style={styles.lockedTabSub}>
                Unlocks at Player Level 9. Continue chapter progression and daily quests to reach this milestone.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.section}>Active Boss</Text>
              {activeClinical
                .filter((m) => m.id === "boss-ward")
                .map((m) => (
                  <BannerCard key={m.id} mode={m} height={156} onPress={() => openIntro(m)} testID={`mode-${m.id}`} />
                ))}
              <Text style={styles.section}>Events & Offers</Text>
              <Pressable style={styles.eventBanner} onPress={() => router.push(ROUTES.EVENTS)} testID="ward-hub-events">
                <View style={styles.eventIcon}>
                  <Ionicons name="calendar" size={26} color={COLORS.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.eventTitleRow}>
                    <Text style={styles.eventTitle}>Event Hub</Text>
                    <View style={styles.eventPreviewBadge}>
                      <Text style={styles.eventPreviewBadgeTxt}>PREVIEW</Text>
                    </View>
                  </View>
                  <Text style={styles.eventSub}>Upcoming event tracks and future offers.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.onSurfaceTertiary} />
              </Pressable>
            </>
          )}
        </ScrollView>
      )}

      {/* ── JOURNAL — Off-Shift wellness ── */}
      {activeTab === "journal" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <DailyRhythmCard player={player} onPress={() => setShowRounds(true)} />

          <Pressable style={styles.questSticker} onPress={() => setShowRounds(true)} testID="shift-quest-sticker">
            <Ionicons name="list" size={18} color={COLORS.brand} />
            <Text style={styles.questStickerTxt}>Open Daily Rounds</Text>
            {roundsBadge > 0 && (
              <View style={styles.questBadge}>
                <Text style={styles.questBadgeTxt}>{roundsBadge > 9 ? "9+" : roundsBadge}</Text>
              </View>
            )}
          </Pressable>

          <Text style={styles.section}>Off-Shift Wellness</Text>
          {activeWellness.map((m) => (
            <BannerCard key={m.id} mode={m} height={120} onPress={() => openIntro(m)} testID={`mode-${m.id}`} />
          ))}

          <Pressable style={styles.eventBanner} onPress={() => router.push(ROUTES.EVENTS)} testID="ward-hub-events-journal">
            <View style={styles.eventIcon}>
              <Ionicons name="calendar" size={24} color={COLORS.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventTitle}>Event Hub</Text>
              <Text style={styles.eventSub}>Upcoming events and Sanctuary offers.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.onSurfaceTertiary} />
          </Pressable>
        </ScrollView>
      )}

      <DailyRoundsPanel visible={showRounds} onClose={() => setShowRounds(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: UI.bgBase },
  loading: { alignItems: "center", justifyContent: "center" },
  header:  {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.lg, paddingBottom: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center",
  },
  kicker: { color: COLORS.brand, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  title:  { color: COLORS.onSurface, fontSize: 24, fontWeight: "700", marginTop: 2 },

  scroll:  { padding: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  section: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "700", letterSpacing: 0.5, marginTop: SPACING.sm, marginBottom: 2 },

  universityCtaBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    backgroundColor: COLORS.brand, borderRadius: RADIUS.md,
    paddingVertical: 13, paddingHorizontal: SPACING.md, marginTop: SPACING.xs,
  },
  universityCtaTxt: { color: COLORS.onBrand, fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center", letterSpacing: 0.2 },

  smallGrid: { gap: SPACING.sm },
  footNote:  { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.sm },
  footNoteTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18, flex: 1, fontStyle: "italic" },

  lockedTabCard: {
    alignItems: "center", gap: SPACING.md, padding: SPACING.xxl,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, marginTop: SPACING.sm,
  },
  lockedTabTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: "700" },
  lockedTabSub:   { color: COLORS.onSurfaceTertiary, fontSize: 14, lineHeight: 21, textAlign: "center" },

  eventBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.brand + "45",
    padding: SPACING.md,
  },
  eventIcon: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: COLORS.brand + "18", alignItems: "center", justifyContent: "center",
  },
  eventTitleRow:   { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  eventTitle:      { color: COLORS.onSurface, fontSize: 17, fontWeight: "700" },
  eventPreviewBadge:    { backgroundColor: COLORS.brand + "22", borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 2 },
  eventPreviewBadgeTxt: { color: COLORS.brand, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  eventSub:        { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19, marginTop: 2 },

  questSticker: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.brand + "18",
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.brand + "50",
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    position: "relative", alignSelf: "flex-start",
  },
  questStickerTxt: { color: COLORS.brand, fontSize: 14, fontWeight: "700" },
  questBadge: {
    backgroundColor: COLORS.error, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
  },
  questBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
