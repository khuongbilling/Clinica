import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BannerCard } from "@/src/components/ModeBanners";
import { ModeCard } from "@/src/components/ModeCard";
import { StaminaPill } from "@/src/components/StaminaPill";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { checkFeatureGate, playerLevelFromXp, type CompoundGateContext } from "@/src/game/progression";
import { goBack } from "@/src/utils/navigation";
import {
  CHAPTER_SIMULATION_LABELS, CLINICAL_CHALLENGE_MODES, ModeCardDef, nextComingSoonMode,
  WARD_SHIFT_MODE, WELLNESS_MODES,
} from "@/src/game/modeHub";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function ShiftPage() {
  const router = useRouter();
  const { player } = usePlayer();
  const { isCompleted, startTutorial } = useTutorial();
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bossUnlocked = (player?.bosses_defeated?.length ?? 0) > 0 || (player?.runs_completed ?? 0) >= 1;

  const gateCtx: CompoundGateContext = {
    level: player ? (player.player_level ?? playerLevelFromXp(player.xp ?? 0).level) : 1,
    firstWardShiftDone: (player?.runs_completed ?? 0) > 0,
    lessonsStarted: (player?.lessons_completed?.length ?? 0) > 0,
  };
  const universityGate = checkFeatureGate("university", gateCtx);

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

  // Active clinical banners for the hub: Ward Shift (hero) + Ward Defense + Boss Ward.
  const activeClinical = CLINICAL_CHALLENGE_MODES.filter((m) => m.status === "active");
  const activeWellness = WELLNESS_MODES.filter((m) => m.status === "active");
  // Only tease the SINGLE next event/content that opens based on chapter
  // progress. Every other not-yet-reached placeholder stays hidden until it is
  // next in line.
  const nextUp = nextComingSoonMode(player.chapter_progress ?? 1);

  const flashNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  };

  const openIntro = (mode: ModeCardDef) => {
    if (mode.status === "coming_soon" || mode.status === "locked") {
      const when = mode.unlockChapter ? `\n\nOpens in Chapter ${mode.unlockChapter}.` : "";
      Alert.alert(
        `${mode.title} — Coming Soon`,
        mode.subtitle + when + "\n\nThis mode is still in development — nothing is spent and no rewards are given yet.",
      );
      return;
    }
    // Active modes always open their intro page — including Boss Ward when its
    // shift-completion gate isn't met yet. The intro (`/mode/[id]`) owns the
    // locked-state display and disables its own CTA.
    router.push(`/mode/${mode.id}` as any);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/(tabs)")} hitSlop={10} testID="shift-back">
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>WARD OPERATIONS</Text>
          <Text style={styles.title}>Choose Your Mode</Text>
        </View>
        <StaminaPill player={player} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          Pick a mode to read its briefing, then step in. New modes open here as you progress.
        </Text>

        {notice && (
          <View style={styles.notice} testID="shift-notice">
            <Ionicons name="lock-closed" size={16} color={COLORS.brand} />
            <Text style={styles.noticeTxt}>{notice}</Text>
          </View>
        )}

        <View style={styles.simBox}>
          <Text style={styles.simTitle}>Your Story, One Case at a Time</Text>
          <Text style={styles.simSub}>
            You were summoned to heal — and every patient you meet is another chapter of that
            journey. Clinica University walks beside you, turning each case into a lesson you
            live through rather than a test you sit:
          </Text>
          <View style={{ gap: 3 }}>
            {Object.entries(CHAPTER_SIMULATION_LABELS).map(([ch, label]) => (
              <View key={ch} style={styles.simRow}>
                <Text style={styles.simChapter}>Ch.{ch}</Text>
                <Text style={styles.simLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Clinical Challenges — illustrated banners → each mode's intro */}
        <Text style={styles.section}>Clinical Challenges</Text>
        <BannerCard mode={WARD_SHIFT_MODE} height={156} onPress={() => openIntro(WARD_SHIFT_MODE)} testID="mode-ward-shift" />
        {activeClinical.map((m) => (
          <BannerCard
            key={m.id}
            mode={m}
            height={128}
            locked={m.id === "boss-ward" && !bossUnlocked}
            onPress={() => openIntro(m)}
            testID={`mode-${m.id}`}
          />
        ))}

        {/* Learn — the System points new healers here for their first lessons */}
        <Text style={styles.section}>Learn</Text>
        <Pressable
          style={[styles.uniBanner, !universityGate.unlocked && styles.uniBannerLocked]}
          testID="ward-hub-university"
          onPress={() => {
            if (!universityGate.unlocked) {
              flashNotice(universityGate.reason || "Clinica University is locked — keep progressing to unlock.");
              return;
            }
            router.push("/university" as any);
          }}
        >
          <View style={styles.uniIcon}>
            <Ionicons name={universityGate.unlocked ? "school" : "lock-closed"} size={26} color={universityGate.unlocked ? COLORS.brand : COLORS.onSurfaceTertiary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.uniKicker}>ANSWER THE CALL TO LEARN</Text>
            <Text style={styles.uniTitle}>Clinica University</Text>
            <Text style={styles.uniSub}>
              {universityGate.unlocked
                ? "Study the reasoning behind every treatment — your first lessons reward your first heroes."
                : universityGate.reason}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.onSurfaceTertiary} />
        </Pressable>

        {/* Off-Shift wellness */}
        <Text style={styles.section}>Off-Shift</Text>
        {activeWellness.map((m) => (
          <BannerCard key={m.id} mode={m} height={120} onPress={() => openIntro(m)} testID={`mode-${m.id}`} />
        ))}

        {/* Event Hub (Push 7) — preview-only events + monetization foundation */}
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

        {/* Coming Soon — only the single next event/content, gated by chapter */}
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
  notice: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.brandSecondary, backgroundColor: COLORS.brandTertiary + "40",
  },
  noticeTxt: { color: COLORS.brand, fontSize: 12, fontWeight: "600", flex: 1, lineHeight: 16 },
  section: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginTop: SPACING.sm, marginBottom: 2 },
  simBox: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md, gap: 6 },
  simTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700" },
  simSub: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17, marginBottom: 2 },
  simRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "baseline" },
  simChapter: { color: COLORS.brand, fontSize: 11, fontWeight: "800", width: 34 },
  simLabel: { color: COLORS.onSurfaceSecondary, fontSize: 12, flex: 1 },
  uniBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.brand + "45",
    padding: SPACING.md,
  },
  uniBannerLocked: { opacity: 0.6, borderColor: COLORS.border },
  uniIcon: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: COLORS.brand + "18",
    alignItems: "center", justifyContent: "center",
  },
  uniKicker: { color: COLORS.brand, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  uniTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: "700", marginTop: 1 },
  uniSub: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
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
});
