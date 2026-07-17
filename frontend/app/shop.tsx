import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BannerCard } from "@/src/components/ModeBanners";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { FeatureLockedView, useFeatureGate } from "@/src/components/FeatureGate";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { SHOP_SECTIONS, ShopSectionDef } from "@/src/game/shopHub";
import { buildGateContext, checkFeatureGate } from "@/src/game/progression";
import { playerLevelFromXp } from "@/src/game/progression";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function Shop() {
  const router = useRouter();
  const { player } = usePlayer();
  const gate = useFeatureGate("shop");
  const { isCompleted, startTutorial } = useTutorial();
  useClearTutorialOnExit();
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The System narrates the Market only after the guided flow reaches it.
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
  // Block direct navigation into a still-locked Shop (tab hidden, route alive).
  if (!gate.unlocked) return <FeatureLockedView title="The Apothecary Market" reason={gate.reason} />;

  // ── P24: Per-section gate classification ──────────────────────────────────
  // Build gate context once to avoid per-section hook calls.
  const gateCtx = buildGateContext(player);
  const playerLevel = player.player_level ?? playerLevelFromXp(player.xp ?? 0).level;

  // Classify each section:
  //   hidden       — minLevelToShow not met; hide entirely (no Coming Soon clutter)
  //   lockedActive — status=active but featureGate not met; show as disabled card
  //   visibleActive — status=active and gate met; show as interactive card
  //   comingSoon   — status=coming_soon and minLevelToShow met; tease in Coming Soon
  type SectionClass = "hidden" | "lockedActive" | "visibleActive" | "comingSoon";

  function classifySection(s: ShopSectionDef): SectionClass {
    if (s.minLevelToShow && playerLevel < s.minLevelToShow) return "hidden";
    if (s.status === "coming_soon") return "comingSoon";
    if (s.featureGate) {
      const r = checkFeatureGate(s.featureGate, gateCtx);
      if (!r.unlocked) return "lockedActive";
    }
    return "visibleActive";
  }

  function lockLabelForSection(s: ShopSectionDef): string | undefined {
    if (!s.featureGate) return undefined;
    const r = checkFeatureGate(s.featureGate, gateCtx);
    if (r.unlocked) return undefined;
    // Derive a short label from the feature id for the lock pill on the banner.
    const featureLabels: Record<string, string> = {
      ward_defense: "Unlocks at Level 4 — Ward Defense",
      realm:        "Unlocks at Level 5 — Realm",
      world_event:  "Unlocks at Level 7 — World Events",
      boss:         "Unlocks at Level 9 — Boss Encounters",
    };
    return featureLabels[s.featureGate] ?? `Locked — ${r.reason ?? "keep progressing"}`;
  }

  const activeUnlocked = SHOP_SECTIONS.filter((s) => classifySection(s) === "visibleActive");
  const activeLocked   = SHOP_SECTIONS.filter((s) => classifySection(s) === "lockedActive");
  const comingSoon     = SHOP_SECTIONS.filter((s) => classifySection(s) === "comingSoon");

  function flashNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  }

  const openSection = (s: ShopSectionDef) => {
    // P24: hard-block any attempt to open a locked or coming-soon section.
    const cls = classifySection(s);
    if (cls === "lockedActive") {
      const r = s.featureGate ? checkFeatureGate(s.featureGate, gateCtx) : null;
      flashNotice(r?.reason ?? "This stall is locked. Keep progressing to unlock it.");
      return;
    }
    if (cls === "comingSoon" || cls === "hidden") {
      flashNotice(
        `${s.title} is coming soon — this stall is still being stocked. Nothing is spent and no wares are for sale yet.`,
      );
      return;
    }
    if (!s.route) {
      flashNotice(`${s.title} has no route yet.`);
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
          Each stall opens its own market. Spend your Crowns on supplies, or exchange currencies.
        </Text>

        {/* ── Open stalls ── */}
        {activeUnlocked.length > 0 && (
          <>
            <Text style={styles.section}>Open Stalls</Text>
            {activeUnlocked.map((s) => (
              <BannerCard
                key={s.id}
                mode={s}
                height={s.size === "large" ? 152 : 128}
                onPress={() => openSection(s)}
                testID={`shop-mode-${s.id}`}
              />
            ))}
          </>
        )}

        {/* ── P24: Locked stalls — active sections gated behind a feature ── */}
        {activeLocked.length > 0 && (
          <>
            <Text style={styles.section}>Locked Stalls</Text>
            <View style={styles.lockedNote}>
              <Ionicons name="lock-closed" size={13} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.lockedNoteTxt}>
                These stalls unlock as you progress. Tap any locked card to see the full requirement.
              </Text>
            </View>
            {activeLocked.map((s) => (
              <BannerCard
                key={s.id}
                mode={s}
                height={128}
                locked
                lockLabel={lockLabelForSection(s)}
                onPress={() => openSection(s)}
                testID={`shop-mode-${s.id}`}
              />
            ))}
          </>
        )}

        {/* ── Coming Soon stalls (content-pending, not feature-gated) ── */}
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
            Locked stalls unlock as you level up and unlock new game modes. Coming Soon stalls are
            placeholders only — tapping them never spends currency or grants rewards.
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
  lockedNote: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.sm, padding: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  lockedNoteTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 17, flex: 1 },
  footNote: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.sm },
  footNoteTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18, flex: 1, fontStyle: "italic" },
});
