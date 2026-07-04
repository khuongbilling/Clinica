import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import {
  CURRENCIES, ECONOMY_ANCHORS, ECONOMY_HIERARCHY_NOTES,
  COSMETIC_PRICE_TIERS, COSMETIC_PRICE_EXAMPLES,
  CODEX_SHARD_RULES, GACHA_TYPES,
  MARKETPLACE_CURRENCY_RULES, MARKETPLACE_TAX_TIERS, MARKETPLACE_TAX_EXAMPLES,
  LISTING_FEE_RULES, MARKETPLACE_SAFEGUARDS, MARKETPLACE_PRICE_BOUNDS, MARKETPLACE_STATUS,
  MATERIAL_SOURCES, PLAYER_PROGRESSION_RULES, HERO_PROGRESSION_RULES,
  EVENT_ECONOMY_NOTES, ECONOMY_GUARDRAILS,
} from "@/src/game/economy";

type SectionId =
  | "currencies" | "pricing" | "recruitment" | "marketplace" | "materials" | "progression" | "events" | "guardrails";

const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: "currencies", label: "Currencies", icon: "diamond-outline" },
  { id: "pricing", label: "Pricing", icon: "pricetags-outline" },
  { id: "recruitment", label: "Recruitment", icon: "people-outline" },
  { id: "marketplace", label: "Marketplace", icon: "storefront-outline" },
  { id: "materials", label: "Materials", icon: "cube-outline" },
  { id: "progression", label: "Progression", icon: "trending-up-outline" },
  { id: "events", label: "Events", icon: "flame-outline" },
  { id: "guardrails", label: "Guardrails", icon: "shield-checkmark-outline" },
];

export default function EconomyGuideScreen() {
  const router = useRouter();
  const { player } = usePlayer();
  const [section, setSection] = useState<SectionId>("currencies");

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/profile"); }}
          hitSlop={10}
          style={styles.backBtn}
          testID="economy-back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Economy Guide</Text>
          <Text style={styles.subtitle}>Design foundation — no real payments or live trading are active</Text>
        </View>
      </View>

      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {SECTIONS.map((s) => {
            const active = section === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSection(s.id)}
                style={[styles.tab, active && styles.tabActive]}
                testID={`economy-tab-${s.id}`}
              >
                <Ionicons name={s.icon as any} size={14} color={active ? COLORS.onBrand : COLORS.onSurfaceSecondary} />
                <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {section === "currencies" && (
          <>
            <Text style={styles.blurb}>
              Free players can earn meaningful premium value through time, learning, wellness,
              events, and skill. Paying players get convenience, cosmetics, faster access, and
              luxury — never unfair power.
            </Text>
            {CURRENCIES.map((c) => (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardName}>{c.displayName}</Text>
                  <Text style={styles.pill}>{c.category.replace("-", " ")}</Text>
                </View>
                <Text style={styles.cardEffect}>{c.tagline}</Text>
                <Text style={styles.cardDesc}>Earned from: {c.earnedFrom}</Text>
                <Text style={styles.cardDesc}>Spent on: {c.spentOn}</Text>
              </View>
            ))}
            <Text style={styles.sectionLabel}>PREMIUM HIERARCHY</Text>
            {ECONOMY_HIERARCHY_NOTES.map((n) => (
              <Text key={n} style={styles.cardDesc}>• {n}</Text>
            ))}
            <Text style={styles.sectionLabel}>ANCHORS</Text>
            <Text style={styles.cardDesc}>
              {ECONOMY_ANCHORS.lotusGemsPer99Cents} Lotus Gems ≈ $0.99 · 1 Lotus Gem ≈ ${ECONOMY_ANCHORS.lotusGemPerUsd.toFixed(2)}{"\n"}
              {ECONOMY_ANCHORS.insightCrystalsPerRefinedGem} Insight Crystals = 1 Refined Lotus Gem{"\n"}
              1 Refined Lotus Gem ≈ {ECONOMY_ANCHORS.refinedGemToLotusGemValue} Lotus Gem value{"\n"}
              Refined Lotus Gem shop price = Lotus Gem price × {ECONOMY_ANCHORS.refinedGemPriceMultiplier}
            </Text>
          </>
        )}

        {section === "pricing" && (
          <>
            <Text style={styles.blurb}>
              High-end and prestige cosmetics are priced so a single $99 bundle cannot buy
              everything. Small cosmetics stay affordable for every player.
            </Text>
            <Text style={styles.sectionLabel}>PRICE TIERS</Text>
            {COSMETIC_PRICE_TIERS.map((t) => (
              <View key={t.id} style={styles.rowCard}>
                <Text style={styles.cardName}>{t.label}</Text>
                <Text style={styles.cardEffect}>
                  {t.lotusGemsMin.toLocaleString()}–{t.lotusGemsMax.toLocaleString()} Lotus Gems
                  {t.refinedAllowed ? " · Refined allowed (1.2x)" : ""}
                </Text>
                {t.note && <Text style={styles.cardDesc}>{t.note}</Text>}
              </View>
            ))}
            <Text style={styles.sectionLabel}>EXAMPLES</Text>
            {COSMETIC_PRICE_EXAMPLES.map((e) => (
              <View key={e.name} style={styles.rowCard}>
                <Text style={styles.cardName}>{e.name}</Text>
                <Text style={styles.cardDesc}>
                  {e.lotusGemsMin.toLocaleString()}–{e.lotusGemsMax.toLocaleString()} Lotus Gems · {e.refinedNote}
                </Text>
              </View>
            ))}
          </>
        )}

        {section === "recruitment" && (
          <>
            <Text style={styles.blurb}>
              Codex Shards are earned-first and never sold as unlimited currency. Recruitment
              stays tied to the University Recruitment Hall.
            </Text>
            <Text style={styles.sectionLabel}>CODEX SHARD RULES</Text>
            <View style={styles.rowCard}>
              <Text style={styles.cardDesc}>Primary source: {CODEX_SHARD_RULES.primarySource}</Text>
              <Text style={styles.cardDesc}>Bonus sources: {CODEX_SHARD_RULES.bonusSources.join(", ")}</Text>
              <Text style={styles.cardDesc}>
                1 recruit = {CODEX_SHARD_RULES.recruitCosts.singleRecruit} Shards · 10-pull (guaranteed) = {CODEX_SHARD_RULES.recruitCosts.tenPullGuaranteed} Shards
              </Text>
              <Text style={styles.cardDesc}>
                Capped paid bundle: {CODEX_SHARD_RULES.cappedPaidBundle.codexShards} Shards for {CODEX_SHARD_RULES.cappedPaidBundle.priceLotusGems} Lotus Gems, {CODEX_SHARD_RULES.cappedPaidBundle.limit}
              </Text>
              <Text style={styles.cardDesc}>Pass rewards: {CODEX_SHARD_RULES.passRewardRange}</Text>
            </View>
            <Text style={styles.sectionLabel}>GACHA TYPES</Text>
            {GACHA_TYPES.map((g) => (
              <View key={g.id} style={styles.rowCard}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardName}>{g.name}</Text>
                  <Text style={styles.pill}>{g.monetizationSafety.replace(/-/g, " ")}</Text>
                </View>
                <Text style={styles.cardDesc}>{g.currency} · {g.location}</Text>
                <Text style={styles.cardDesc}>{g.note}</Text>
              </View>
            ))}
          </>
        )}

        {section === "marketplace" && (
          <>
            <Text style={styles.blurb}>
              Status: {MARKETPLACE_STATUS === "future-placeholder" ? "future placeholder — no live trading yet" : "active"}.
            </Text>
            <Text style={styles.sectionLabel}>CURRENCY RULES</Text>
            <View style={styles.rowCard}>
              <Text style={styles.cardDesc}>Buyer currency: {MARKETPLACE_CURRENCY_RULES.buyerPrimaryCurrency}</Text>
              <Text style={styles.cardDesc}>
                Refined Lotus Gems may cover up to {MARKETPLACE_CURRENCY_RULES.refinedGemBuyerCapPercent}% of a
                purchase (daily cap {MARKETPLACE_CURRENCY_RULES.refinedGemDailyMarketplaceCap})
              </Text>
              <Text style={styles.cardDesc}>Seller fees payable with: {MARKETPLACE_CURRENCY_RULES.sellerFeeCurrencies.join(" or ")}</Text>
            </View>
            <Text style={styles.sectionLabel}>TAXES</Text>
            {MARKETPLACE_TAX_TIERS.map((t) => (
              <Text key={t.id} style={styles.cardDesc}>• {t.label}: buyer {t.buyerTaxPercent}%, seller {t.sellerTaxPercent}%</Text>
            ))}
            {MARKETPLACE_TAX_EXAMPLES.map((ex) => (
              <Text key={ex.tier + ex.itemPrice} style={styles.cardDesc}>
                Example ({ex.tier.replace("_", " ")}): item {ex.itemPrice} → buyer pays {ex.buyerPays}, seller receives {ex.sellerReceives}, system removes {ex.systemRemoves}
              </Text>
            ))}
            <Text style={styles.sectionLabel}>LISTING FEES</Text>
            <Text style={styles.cardDesc}>
              {LISTING_FEE_RULES.feePercent}% of listed price, min {LISTING_FEE_RULES.minFee} / max {LISTING_FEE_RULES.maxFee} Lotus or Refined Lotus Gems.
              {" "}{LISTING_FEE_RULES.refundOnSellPercent}% refunded on sale; lost if the listing expires.
            </Text>
            <Text style={styles.sectionLabel}>SAFEGUARDS</Text>
            {MARKETPLACE_SAFEGUARDS.map((s) => (
              <Text key={s} style={styles.cardDesc}>• {s}</Text>
            ))}
            <Text style={styles.cardDesc}>
              Price floor {MARKETPLACE_PRICE_BOUNDS.floorPercentOfValue}% / ceiling {MARKETPLACE_PRICE_BOUNDS.ceilingPercentOfValue}% of value.
            </Text>
          </>
        )}

        {section === "materials" && (
          <>
            <Text style={styles.blurb}>Every material has a clear source, organized by game mode.</Text>
            {MATERIAL_SOURCES.map((m) => (
              <View key={m.mode} style={styles.rowCard}>
                <Text style={styles.cardName}>{m.mode}</Text>
                <Text style={styles.cardDesc}>{m.rewards.join(" · ")}</Text>
              </View>
            ))}
          </>
        )}

        {section === "progression" && (
          <>
            <Text style={styles.sectionLabel}>PLAYER PROGRESSION</Text>
            <View style={styles.rowCard}>
              <Text style={styles.cardDesc}>Currencies: {PLAYER_PROGRESSION_RULES.currencies.join(", ")}</Text>
              <Text style={styles.cardDesc}>Class changes at Level {PLAYER_PROGRESSION_RULES.classChangeLevels.join(", ")}</Text>
              <Text style={styles.cardDesc}>Requires: {PLAYER_PROGRESSION_RULES.classChangeRequires.join(", ")}</Text>
              <Text style={styles.cardDesc}>Paid currency buys class advancement: {PLAYER_PROGRESSION_RULES.paidCurrencyCanBuyClassAdvancement ? "Yes" : "No"}</Text>
            </View>
            <Text style={styles.sectionLabel}>HERO PROGRESSION</Text>
            <View style={styles.rowCard}>
              <Text style={styles.cardDesc}>Currencies: {HERO_PROGRESSION_RULES.currencies.join(", ")}</Text>
              <Text style={styles.cardDesc}>Paid currency stars up heroes: {HERO_PROGRESSION_RULES.paidCurrencyCanStarUpHeroes ? "Yes" : "No"}</Text>
              <Text style={styles.cardDesc}>Safe paid convenience later: {HERO_PROGRESSION_RULES.safePaidConvenienceLater.join(", ")}</Text>
            </View>
          </>
        )}

        {section === "events" && (
          <>
            <Text style={styles.sectionLabel}>LIMITED EVENTS</Text>
            <View style={styles.rowCard}>
              <Text style={styles.cardDesc}>Rewards: {EVENT_ECONOMY_NOTES.limitedEventRewards.join(", ")}</Text>
              <Text style={styles.cardDesc}>Tradeable window: {EVENT_ECONOMY_NOTES.eventItemTradeableWindow}</Text>
            </View>
            <Text style={styles.sectionLabel}>EPIDEMIC / WORLD BOSS (FUTURE)</Text>
            <View style={styles.rowCard}>
              <Text style={styles.cardDesc}>Ward Shift — {EVENT_ECONOMY_NOTES.epidemicConnectsModes.wardShift}</Text>
              <Text style={styles.cardDesc}>Ward Defense — {EVENT_ECONOMY_NOTES.epidemicConnectsModes.wardDefense}</Text>
              <Text style={styles.cardDesc}>University — {EVENT_ECONOMY_NOTES.epidemicConnectsModes.university}</Text>
              <Text style={styles.cardDesc}>Realm — {EVENT_ECONOMY_NOTES.epidemicConnectsModes.realm}</Text>
              <Text style={styles.cardDesc}>Faction — {EVENT_ECONOMY_NOTES.epidemicConnectsModes.faction}</Text>
              <Text style={styles.cardDesc}>World Boss — {EVENT_ECONOMY_NOTES.epidemicConnectsModes.worldBoss}</Text>
              <Text style={styles.cardDesc}>Rewards: {EVENT_ECONOMY_NOTES.epidemicRewards.join(", ")}</Text>
            </View>
          </>
        )}

        {section === "guardrails" && (
          <>
            <Text style={styles.blurb}>These principles govern every economy decision in Clinica.</Text>
            {ECONOMY_GUARDRAILS.map((g, i) => (
              <View key={i} style={styles.guardrailCard}>
                <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
                <Text style={styles.guardrailTxt}>{g}</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 2 },
  title: { color: COLORS.onSurface, fontSize: 20, fontWeight: "800" },
  subtitle: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 1 },
  tabsWrap: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabs: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  tabTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },
  tabTxtActive: { color: COLORS.onBrand, fontWeight: "800" },
  scroll: { padding: SPACING.lg, gap: SPACING.md },
  blurb: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 17, marginBottom: SPACING.xs },
  sectionLabel: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: SPACING.md },
  card: {
    backgroundColor: COLORS.surfaceSecondary, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.md, gap: 3, marginBottom: SPACING.xs,
  },
  rowCard: {
    backgroundColor: COLORS.surfaceSecondary, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.md, gap: 3, marginBottom: SPACING.xs,
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm },
  cardName: { color: COLORS.onSurface, fontSize: 15, fontWeight: "700" },
  cardEffect: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "600" },
  cardDesc: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 16, marginTop: 1 },
  pill: {
    color: COLORS.brand, fontSize: 10, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase",
    backgroundColor: COLORS.brandTertiary, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2,
  },
  guardrailCard: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.xs,
  },
  guardrailTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18, flex: 1 },
});
