import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const DAILY_ROUNDS_MODES = ["ward_shift", "ward_defense", "university", "lotus_journal", "hall_of_heroes"];
function dailyRoundsUnlockedModes(player: any): string[] {
  const ctx = { level: playerLevelFromXp(player?.xp ?? 0).level, firstWardShiftDone: (player?.runs_completed ?? 0) > 0, lessonsStarted: (player?.lessons_completed?.length ?? 0) > 0 };
  return DAILY_ROUNDS_MODES.filter((m) => checkFeatureGate(m, ctx).unlocked);
}

export default function ShiftPage() {
  const router = useRouter();
  const { player } = usePlayer();
  const { isCompleted, startTutorial } = useTutorial();
  const { notice, flashNotice } = useInlineNotice();
  const [showRounds, setShowRounds] = useState(false);

  // Leaving mid-tutorial must never leak the overlay onto the next screen.
  useClearTutorialOnExit();
  // Browser back mirrors the in-app arrow instead of popping stale gameplay screens.
  useWebBackToHub("/(tabs)");

  const playerLevel = player ? (player.player_level ?? playerLevelFromXp(player.xp ?? 0).level) : 1;
  const roundsFresh = player ? ensureFreshDailyRounds(player.daily_rounds, dailyRoundsUnlockedModes(player), player.id).state : null;
  const roundsBadge = roundsFresh ? claimableCount(roundsFresh) + (checkInAvailable(roundsFresh) ? 1 : 0) : 0;

  const gateCtx: CompoundGateContext = {
    level: playerLevel,
    firstWardShiftDone: (player?.runs_completed ?? 0) > 0,
    lessonsStarted: (player?.lessons_completed?.length ?? 0) > 0,
  };
  const universityGate = checkFeatureGate("university", gateCtx);
  // Ward Shift is gated behind the first University lesson (School first), not
  // a level — so use the narrative gate. Ward Defense / Boss stay level-gated.
  const wardShiftGate = checkFeatureGate("ward_shift", gateCtx);
  const wardShiftUnlocked = wardShiftGate.unlocked;
  const wardDefenseUnlocked = isFeatureUnlocked("ward_defense", playerLevel);
  const bossUnlocked = isFeatureUnlocked("boss", playerLevel);

  // The System narrates the Ward hub once, pointing at the University banner.
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
  const nextUp = nextComingSoonMode(player.chapter_progress ?? 1);

  const openIntro = (mode: ModeCardDef) => {
    if (mode.status === "coming_soon" || mode.status === "locked") {
      const when = mode.unlockChapter ? ` Opens in Chapter ${mode.unlockChapter}.` : "";
      flashNotice(
        `${mode.title} — Coming Soon.${when} Still in development — nothing is spent and no rewards are given yet.`,
      );
      return;
    }
    router.push(`/mode/${mode.id}` as any);
  };

  // Show a System narrator bar for new/low-level players, pointing them to University first.
  const showUniversityPrompt = !wardShiftUnlocked;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.replace("/(tabs)")} hitSlop={10} testID="shift-back">
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>WARD OPERATIONS</Text>
          <Text style={styles.title}>Choose Your Mode</Text>
        </View>
        <StaminaPill player={player} />
        {/* Quest sticker — opens Daily Rounds / Journey panel */}
        <Pressable
          style={styles.questSticker}
          onPress={() => setShowRounds(true)}
          hitSlop={6}
          testID="shift-quest-sticker"
        >
          <Ionicons name="list" size={18} color={COLORS.brand} />
          <Text style={styles.questStickerTxt}>Quests</Text>
          {roundsBadge > 0 && (
            <View style={styles.questBadge}>
              <Text style={styles.questBadgeTxt}>{roundsBadge > 9 ? "9+" : roundsBadge}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          Pick a mode to read its briefing, then step in. New modes open as you progress.
        </Text>

        <InlineNotice notice={notice} icon="lock-closed" testID="shift-notice" />

        {/* P3: Daily rhythm at-a-glance strip — Level 2+ only */}
        <DailyRhythmCard
          player={player}
          onPress={() => setShowRounds(true)}
        />

        {/* System narrator + Go to first Lotus Lesson CTA — shown when Ward Shift is still locked */}
        {showUniversityPrompt && (
          <>
            <SystemNarratorBar
              message="The ward will not open until your first lesson stabilizes your foundation. Complete your first Lotus Lesson at Clinica University — it takes only a few minutes and unlocks Ward Shift immediately."
              testID="shift-narrator-university"
            />
            <Pressable
              style={styles.universityCtaBtn}
              onPress={() => router.push("/university/lotus-lesson/recognizing-cues-hydration" as any)}
              testID="shift-go-to-university"
            >
              <Ionicons name="leaf" size={16} color={COLORS.onBrand} />
              <Text style={styles.universityCtaTxt}>Start First Lotus Lesson</Text>
              <Ionicons name="arrow-forward" size={15} color={COLORS.onBrand} />
            </Pressable>
          </>
        )}

        {/* ── Learn — Clinica University is the first mode that opens, so it
            leads the hub ahead of every clinical challenge. ── */}
        <Text style={styles.section}>Learn</Text>
        <BannerCard
          mode={UNIVERSITY_HUB_MODE}
          height={168}
          locked={!universityGate.unlocked}
          lockLabel={!universityGate.unlocked ? "Keep progressing to unlock" : undefined}
          onPress={() => {
            if (!universityGate.unlocked) {
              flashNotice(universityGate.reason || "Clinica University is locked — keep progressing to unlock.");
              return;
            }
            router.push("/university" as any);
          }}
          testID="ward-hub-university"
        />

        {/* ── Clinical Challenges — ordered by when they open:
            Ward Shift (first lesson) → Ward Defense (Lv 4) → Boss Ward (Lv 7). ── */}
        <Text style={styles.section}>Clinical Challenges</Text>

        {/* Ward Shift — University simulation, opens after the first lesson */}
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
            openIntro(WARD_SHIFT_MODE);
          }}
          testID="mode-ward-shift"
        />

        {activeClinical.map((m) => {
          // Ward Defense opens at Level 4; the Realm opens at Level 5 (before the
          // Boss); Boss Ward unlocks at Level 9 (P23 — bumped from 7).
          const isWardDefense = m.id === "ward-defense";
          const isBossWard = m.id === "boss-ward";
          const modeLocked =
            (isWardDefense && !wardDefenseUnlocked) ||
            (isBossWard && !bossUnlocked);
          const modeLockLabel = isWardDefense && !wardDefenseUnlocked
            ? "Unlocks at Level 4 — replay shifts & daily quests to advance"
            : isBossWard && !bossUnlocked
              ? "Unlocks at Level 9 — keep progressing through chapters"
              : undefined;
          return (
            <BannerCard
              key={m.id}
              mode={m}
              height={128}
              locked={modeLocked}
              lockLabel={modeLockLabel}
              onPress={() => {
                if (modeLocked) {
                  flashNotice(
                    isWardDefense
                      ? "Ward Defense unlocks at Player Level 4. Replay cleared shifts, complete University practice, and finish daily quests to gain XP."
                      : "Boss Encounters unlock at Player Level 9. Continue chapter progression, daily quests, and Realm production to reach this milestone.",
                  );
                  return;
                }
                openIntro(m);
              }}
              testID={`mode-${m.id}`}
            />
          );
        })}

        {/* ── Off-Shift wellness ── */}
        <Text style={styles.section}>Off-Shift</Text>
        {activeWellness.map((m) => (
          <BannerCard key={m.id} mode={m} height={120} onPress={() => openIntro(m)} testID={`mode-${m.id}`} />
        ))}

        {/* ── Event Hub ── */}
        <Text style={styles.section}>Events & Offers</Text>
        <Pressable
          style={styles.eventBanner}
          testID="ward-hub-events"
          onPress={() => router.push("/events" as any)}
        >
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
            <Text style={styles.eventSub}>
              Sneak peek at upcoming event tracks and future support-the-Sanctuary offers. Nothing
              is active yet — no purchases, billing, or gameplay effects.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.onSurfaceTertiary} />
        </Pressable>

        {/* Coming Soon — only the single next event/content gated by chapter */}
        {nextUp && (
          <>
            <Text style={styles.section}>Coming Soon</Text>
            <View style={styles.smallGrid}>
              <ModeCard mode={nextUp} onPress={() => openIntro(nextUp)} testID={`mode-${nextUp.id}`} />
            </View>
            <View style={styles.footNote}>
              <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.footNoteTxt}>
                {nextUp.unlockChapter
                  ? `Next up in Chapter ${nextUp.unlockChapter}. It's just a preview — tapping never spends Shift Challenges or grants rewards.`
                  : "This is just a preview — tapping never spends Shift Challenges or grants rewards."}
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Daily Rounds / Journey panel — triggered by Quest sticker button */}
      <DailyRoundsPanel visible={showRounds} onClose={() => setShowRounds(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg, paddingBottom: SPACING.sm },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  kicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300", marginTop: 2 },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  lead: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 22, fontStyle: "italic", marginBottom: SPACING.xs },
  section: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginTop: SPACING.sm, marginBottom: 2 },
  eventBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.brand + "45",
    padding: SPACING.md,
  },
  eventIcon: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: COLORS.brand + "18",
    alignItems: "center", justifyContent: "center",
  },
  eventTitleRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  eventTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: "700" },
  eventPreviewBadge: { backgroundColor: COLORS.brand + "22", borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 2 },
  eventPreviewBadgeTxt: { color: COLORS.brand, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  eventSub: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  smallGrid: { gap: SPACING.sm },
  footNote: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.sm },
  footNoteTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18, flex: 1, fontStyle: "italic" },
  universityCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.brand,
    borderRadius: RADIUS.md,
    paddingVertical: 13,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.xs,
  },
  universityCtaTxt: {
    color: COLORS.onBrand,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  questSticker: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.brand + "18",
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.brand + "50",
    paddingHorizontal: 10, paddingVertical: 6,
    position: "relative",
  },
  questStickerTxt: { color: COLORS.brand, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  questBadge: {
    position: "absolute", top: -5, right: -6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.error, alignItems: "center", justifyContent: "center",
  },
  questBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "800" },
});
