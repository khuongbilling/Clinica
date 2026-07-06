import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BannerCard } from "@/src/components/ModeBanners";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { SHOP_SECTIONS, ShopSectionDef } from "@/src/game/shopHub";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function Shop() {
  const router = useRouter();
  const { player } = usePlayer();
  const { isCompleted, startTutorial } = useTutorial();
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The System narrates the Market only after the guided flow reaches it:
  // hub intro → ward hub → first University lessons. Firing it out of order
  // (e.g. before lessons) would break the intended onboarding sequence, so we
  // require the ward-hub beat done AND the first lessons started.
  const lessonsStarted = (player?.lessons_completed?.length ?? 0) > 0;
  useEffect(() => {
    if (!player) return;
    if (isCompleted("systemWardHub") && lessonsStarted && !isCompleted("systemShops")) {
      const t = setTimeout(() => startTutorial("systemShops"), 500);
      return () => clearTimeout(t);
    }
  }, [player, lessonsStarted, isCompleted, startTutorial]);

  if (!player) {
    return (
      <SafeAreaView style={[styles.container, styles.loading]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  const active = SHOP_SECTIONS.filter((s) => s.status === "active");
  const comingSoon = SHOP_SECTIONS.filter((s) => s.status !== "active");

  function flashNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  }

  const openSection = (s: ShopSectionDef) => {
    if (s.status !== "active" || !s.route) {
      flashNotice(`${s.title} is coming soon — this stall is still being stocked. Nothing is spent and no wares are for sale yet.`);
      return;
    }
    router.push(s.route as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PlayerHeader player={player} />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>APOTHECARY MARKET</Text>
          <Text style={styles.title}>Choose a Stall</Text>
        </View>
        <Pressable onPress={() => router.push("/economy")} hitSlop={10} testID="shop-economy-guide">
          <Ionicons name="help-circle-outline" size={22} color={COLORS.onSurfaceSecondary} />
        </Pressable>
      </View>

      {notice && (
        <View style={styles.notice} testID="shop-notice">
          <Ionicons name="time-outline" size={16} color={COLORS.brand} />
          <Text style={styles.noticeTxt}>{notice}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          Each stall opens its own market. Spend your Crowns on supplies, summon healers, or exchange currencies.
        </Text>

        <Text style={styles.section}>Market Stalls</Text>
        {active.map((s) => (
          <BannerCard
            key={s.id}
            mode={s}
            height={s.size === "large" ? 152 : 128}
            onPress={() => openSection(s)}
            testID={`shop-mode-${s.id}`}
          />
        ))}

        {comingSoon.length > 0 && (
          <>
            <Text style={styles.section}>Coming Soon</Text>
            {comingSoon.map((s) => (
              <BannerCard
                key={s.id}
                mode={s}
                height={120}
                onPress={() => openSection(s)}
                testID={`shop-mode-${s.id}`}
              />
            ))}
          </>
        )}

        <View style={styles.footNote}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footNoteTxt}>
            Coming Soon stalls are placeholders only — tapping them never spends currency or grants rewards.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  kicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300", marginTop: 2 },
  notice: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    marginHorizontal: SPACING.lg, marginTop: SPACING.sm,
    padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.brandSecondary, backgroundColor: COLORS.brandTertiary + "40",
  },
  noticeTxt: { color: COLORS.brand, fontSize: 12, fontWeight: "600", flex: 1, lineHeight: 16 },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  lead: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 22, fontStyle: "italic", marginBottom: SPACING.xs },
  section: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginTop: SPACING.sm, marginBottom: 2 },
  footNote: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.sm },
  footNoteTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18, flex: 1, fontStyle: "italic" },
});
