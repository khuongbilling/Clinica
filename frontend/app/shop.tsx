import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { type AppRoute } from "@/src/game/routes";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BannerCard } from "@/src/components/ModeBanners";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { FeatureLockedView, useFeatureGate } from "@/src/components/FeatureGate";
import { RPGTabBar, RPGTab } from "@/src/components/RPGTabBar";
import { ShopEmblem, CommunityEmblem, SummoningEmblem } from "@/src/components/ClinicaEmblems";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { SHOP_SECTIONS, ShopSectionDef } from "@/src/game/shopHub";
import { buildGateContext, checkFeatureGate } from "@/src/game/progression";
import { playerLevelFromXp } from "@/src/game/progression";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";

export default function Shop() {
  const router = useRouter();
  const { player } = usePlayer();
  const gate = useFeatureGate("shop");
  const { isCompleted, startTutorial } = useTutorial();
  useClearTutorialOnExit();
  const [notice, setNotice]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("supplies");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  if (!gate.unlocked) return <FeatureLockedView title="The Apothecary Market" reason={gate.reason} />;

  const gateCtx    = buildGateContext(player);
  const playerLevel = player.player_level ?? playerLevelFromXp(player.xp ?? 0).level;

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
    const cls = classifySection(s);
    if (cls === "lockedActive") {
      const r = s.featureGate ? checkFeatureGate(s.featureGate, gateCtx) : null;
      flashNotice(r?.reason ?? "This stall is locked. Keep progressing to unlock it.");
      return;
    }
    if (cls === "comingSoon" || cls === "hidden") {
      flashNotice(`${s.title} is coming soon — tapping never spends currency or grants rewards.`);
      return;
    }
    if (!s.route) { flashNotice(`${s.title} has no route yet.`); return; }
    router.push(s.route as AppRoute);
  };

  const TABS: RPGTab[] = [
    { key: "supplies", label: "Supplies", emblem: (a) => <ShopEmblem      size={14} color={a ? UI.onGold : UI.gold} /> },
    { key: "exchange", label: "Exchange", emblem: (a) => <CommunityEmblem size={14} color={a ? UI.onGold : UI.gold} /> },
    { key: "locked",   label: "Locked",  icon: "lock-closed", badge: activeLocked.length || undefined },
    { key: "premium",  label: "Premium", emblem: (a) => <SummoningEmblem size={14} color={a ? UI.onGold : UI.gold} /> },
  ];

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

      <RPGTabBar tabs={TABS} activeTab={activeTab} onTabPress={setActiveTab} />

      {notice && (
        <View style={styles.notice} testID="shop-notice">
          <Ionicons name="time-outline" size={15} color={COLORS.brand} />
          <Text style={styles.noticeTxt}>{notice}</Text>
        </View>
      )}

      {/* ── SUPPLIES STALLS ── */}
      {activeTab === "supplies" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {activeUnlocked.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="storefront-outline" size={32} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.emptyTxt}>No stalls open yet. Progress to unlock market stalls.</Text>
            </View>
          ) : (
            activeUnlocked.map((s) => (
              <BannerCard
                key={s.id} mode={s}
                height={s.size === "large" ? 152 : 128}
                onPress={() => openSection(s)}
                testID={`shop-mode-${s.id}`}
              />
            ))
          )}
          <View style={styles.footNote}>
            <Ionicons name="information-circle-outline" size={13} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.footNoteTxt}>Tap any stall to browse its wares.</Text>
          </View>
        </ScrollView>
      )}

      {/* ── LOCKED STALLS ── */}
      {activeTab === "locked" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {activeLocked.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={32} color={COLORS.success} />
              <Text style={styles.emptyTxt}>All available stalls are unlocked!</Text>
            </View>
          ) : (
            <>
              <View style={styles.lockedNote}>
                <Ionicons name="lock-closed" size={13} color={COLORS.onSurfaceTertiary} />
                <Text style={styles.lockedNoteTxt}>
                  These stalls unlock as you progress. Tap to see requirements.
                </Text>
              </View>
              {activeLocked.map((s) => (
                <BannerCard
                  key={s.id} mode={s}
                  height={128} locked
                  lockLabel={lockLabelForSection(s)}
                  onPress={() => openSection(s)}
                  testID={`shop-mode-${s.id}`}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* ── EXCHANGE ── */}
      {activeTab === "exchange" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.previewNote}>
            <Ionicons name="swap-horizontal-outline" size={15} color={UI.jade} />
            <Text style={[styles.previewNoteTxt, { color: UI.jade }]}>
              Exchange — trade surplus currencies and items between stalls. Coming soon.
            </Text>
          </View>
          <View style={styles.exchangeSection}>
            <Text style={styles.exchangeHeading}>CURRENCIES</Text>
            {[
              { icon: "leaf",            color: COLORS.brand,   name: "Jade Scrolls",    how: "Earn from lessons and daily quests" },
              { icon: "star",            color: "#D4AF37",       name: "Gold Crowns",     how: "Earn from battles and chapter milestones" },
              { icon: "sparkles",        color: "#A855F7",       name: "Hero Shards",     how: "Earn from Recruitment and evolutions" },
              { icon: "shield-half",     color: "#22D3EE",       name: "Ward Tokens",     how: "Earn from Ward Defense and Boss encounters" },
            ].map((c) => (
              <View key={c.name} style={styles.currencyRow}>
                <View style={[styles.currencyIcon, { backgroundColor: c.color + "18" }]}>
                  <Ionicons name={c.icon as any} size={18} color={c.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.currencyName}>{c.name}</Text>
                  <Text style={styles.currencyHow}>{c.how}</Text>
                </View>
              </View>
            ))}
          </View>
          <Pressable style={styles.economyLink}
            onPress={() => router.push("/economy")} testID="shop-economy-guide-exchange">
            <Ionicons name="book-outline" size={16} color={COLORS.brand} />
            <Text style={styles.economyLinkTxt}>Economy Guide — how currencies work</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.brand} />
          </Pressable>
          <View style={styles.footNote}>
            <Ionicons name="information-circle-outline" size={13} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.footNoteTxt}>Exchange features expand as more stalls open.</Text>
          </View>
        </ScrollView>
      )}

      {/* ── PREMIUM PREVIEW ── */}
      {activeTab === "premium" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.previewNote}>
            <Ionicons name="telescope-outline" size={15} color={UI.lavender} />
            <Text style={styles.previewNoteTxt}>
              Preview of upcoming stalls — nothing is for sale yet. Tapping never spends currency.
            </Text>
          </View>
          {comingSoon.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTxt}>No upcoming stalls to preview right now.</Text>
            </View>
          ) : (
            comingSoon.map((s) => (
              <BannerCard
                key={s.id} mode={s}
                height={120}
                onPress={() => openSection(s)}
                testID={`shop-mode-${s.id}`}
              />
            ))
          )}
          <Pressable style={styles.economyLink}
            onPress={() => router.push("/economy")} testID="shop-economy-guide-2">
            <Ionicons name="book-outline" size={16} color={COLORS.brand} />
            <Text style={styles.economyLinkTxt}>Economy Guide — learn how currencies work</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.brand} />
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.bgBase },
  loading:   { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  kicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  title:  { color: COLORS.onSurface, fontSize: 24, fontWeight: "300", marginTop: 2 },
  notice: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    marginHorizontal: SPACING.lg, marginTop: SPACING.sm,
    padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.brandSecondary, backgroundColor: COLORS.brandTertiary + "40",
  },
  noticeTxt: { color: COLORS.brand, fontSize: 13, fontWeight: "600", flex: 1, lineHeight: 18 },
  scroll:    { padding: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  emptyState: {
    alignItems: "center", gap: SPACING.sm, padding: SPACING.xxl,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  emptyTxt: { color: COLORS.onSurfaceTertiary, fontSize: 14, textAlign: "center", lineHeight: 21 },
  lockedNote: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.sm, padding: SPACING.sm, marginBottom: SPACING.sm,
  },
  lockedNoteTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13, lineHeight: 18, flex: 1 },
  previewNote: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    backgroundColor: UI.lavender + "15",
    borderRadius: RADIUS.sm, padding: SPACING.sm, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: UI.lavender + "30",
  },
  previewNoteTxt: { color: UI.textSoft, fontSize: 13, lineHeight: 18, flex: 1 },
  footNote:      { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.xs },
  footNoteTxt:   { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18, flex: 1, fontStyle: "italic" },
  economyLink: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    padding: SPACING.md, borderRadius: RADIUS.md,
    backgroundColor: COLORS.brand + "12", borderWidth: 1, borderColor: COLORS.brand + "40",
    marginTop: SPACING.md,
  },
  economyLinkTxt: { color: COLORS.brand, fontSize: 14, fontWeight: "600", flex: 1 },

  exchangeSection: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
  },
  exchangeHeading: {
    color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "800",
    letterSpacing: 0.8, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
  },
  currencyRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  currencyIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
  },
  currencyName: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  currencyHow:  { color: COLORS.onSurfaceTertiary, fontSize: 13, marginTop: 1 },
});
