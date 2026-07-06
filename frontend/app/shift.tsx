import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BannerCard } from "@/src/components/ModeBanners";
import { ModeCard } from "@/src/components/ModeCard";
import { StaminaPill } from "@/src/components/StaminaPill";
import { usePlayer } from "@/src/game/store";
import { goBack } from "@/src/utils/navigation";
import {
  CLINICAL_CHALLENGE_MODES, ModeCardDef, nextComingSoonMode,
  WARD_SHIFT_MODE, WELLNESS_MODES,
} from "@/src/game/modeHub";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function ShiftPage() {
  const router = useRouter();
  const { player } = usePlayer();

  const bossUnlocked = (player?.bosses_defeated?.length ?? 0) > 0 || (player?.runs_completed ?? 0) >= 1;

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

        {/* Off-Shift wellness */}
        <Text style={styles.section}>Off-Shift</Text>
        {activeWellness.map((m) => (
          <BannerCard key={m.id} mode={m} height={120} onPress={() => openIntro(m)} testID={`mode-${m.id}`} />
        ))}

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
  section: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginTop: SPACING.sm, marginBottom: 2 },
  smallGrid: { gap: SPACING.sm },
  footNote: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.sm },
  footNoteTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18, flex: 1, fontStyle: "italic" },
});
