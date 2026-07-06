import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "react-native";

import { BazaarChipList } from "@/src/components/bazaar/BazaarChipList";
import { BazaarRuleRow } from "@/src/components/bazaar/BazaarRuleRow";
import { BazaarSectionCard } from "@/src/components/bazaar/BazaarSectionCard";
import { StaminaPill } from "@/src/components/StaminaPill";
import {
  BAZAAR_STATUS,
  BAZAAR_WELCOME,
  BAZAAR_PURPOSE,
  BAZAAR_TRADEABLE_SECTION,
  BAZAAR_NON_TRADEABLE_SECTION,
  BAZAAR_MARKETPLACE_RULES,
  BAZAAR_TRADING_REQUIREMENTS,
  BAZAAR_TAX_TIERS,
  BAZAAR_TAX_NOTES,
  BAZAAR_LISTING_FEES,
  BAZAAR_SAFETY_GUIDELINES,
} from "@/src/game/bazaarHub";
import { usePlayer } from "@/src/game/store";
import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ────────────────────────────────────────────────────────────
// Push 8 — Sanctuary Bazaar Placeholder.
// This screen is a polished, NON-FUNCTIONAL preview of the future player
// marketplace. There is no live trading, no listings, no purchases, no
// auctions, and no player-to-player transactions anywhere on this page —
// every section is clearly informational and labeled Preview / Planned /
// Coming Soon.
// ────────────────────────────────────────────────────────────

export default function BazaarScreen() {
  const router = useRouter();
  const { player } = usePlayer();

  if (!player) {
    return (
      <SafeAreaView style={[styles.root, styles.loading]} edges={["top", "bottom"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/(tabs)/kingdom")} hitSlop={10} testID="bazaar-back">
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>SANCTUARY COMMERCE</Text>
          <Text style={styles.title}>Sanctuary Bazaar</Text>
        </View>
        <StaminaPill player={player} />
      </View>

      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
        <Text style={styles.noticeTxt}>
          {BAZAAR_STATUS.toUpperCase()} — this is a design preview only. No live trading, listings,
          purchases, auctions, or player-to-player transactions exist yet.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Welcome overview */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Ionicons name="moon" size={14} color={COLORS.storm} />
            <Text style={styles.heroBadgeTxt}>{BAZAAR_STATUS.toUpperCase()}</Text>
          </View>
          <Text style={styles.heroKicker}>{BAZAAR_WELCOME.kicker}</Text>
          <Text style={styles.heroTitle}>{BAZAAR_WELCOME.title}</Text>
          <Text style={styles.heroBody}>{BAZAAR_WELCOME.body}</Text>
        </View>

        {/* Marketplace purpose */}
        <BazaarSectionCard title={BAZAAR_PURPOSE.title} icon="help-buoy-outline" accentColor="#A78BFA" intro={BAZAAR_PURPOSE.body} testID="bazaar-purpose">
          <View style={styles.pillarRow}>
            {BAZAAR_PURPOSE.pillars.map((p) => (
              <View key={p.label} style={styles.pillar}>
                <View style={styles.pillarIcon}>
                  <Ionicons name={p.icon as any} size={16} color={COLORS.brand} />
                </View>
                <Text style={styles.pillarTxt} numberOfLines={2}>{p.label}</Text>
              </View>
            ))}
          </View>
        </BazaarSectionCard>

        {/* Tradeable categories */}
        <BazaarSectionCard
          title={BAZAAR_TRADEABLE_SECTION.title}
          icon={BAZAAR_TRADEABLE_SECTION.icon}
          accentColor={BAZAAR_TRADEABLE_SECTION.accentColor}
          intro={BAZAAR_TRADEABLE_SECTION.intro}
          testID="bazaar-tradeable"
        >
          <BazaarChipList items={BAZAAR_TRADEABLE_SECTION.chips} accentColor={BAZAAR_TRADEABLE_SECTION.accentColor} icon="checkmark-circle-outline" />
        </BazaarSectionCard>

        {/* Non-tradeable categories */}
        <BazaarSectionCard
          title={BAZAAR_NON_TRADEABLE_SECTION.title}
          icon={BAZAAR_NON_TRADEABLE_SECTION.icon}
          accentColor={BAZAAR_NON_TRADEABLE_SECTION.accentColor}
          intro={BAZAAR_NON_TRADEABLE_SECTION.intro}
          testID="bazaar-non-tradeable"
        >
          <BazaarChipList items={BAZAAR_NON_TRADEABLE_SECTION.chips} accentColor={BAZAAR_NON_TRADEABLE_SECTION.accentColor} icon="close-circle-outline" />
        </BazaarSectionCard>

        {/* Marketplace rules */}
        <BazaarSectionCard
          title="Marketplace Rules"
          icon="document-text-outline"
          accentColor="#5B9BD5"
          intro="Planned safeguards that will govern every trade once the Bazaar goes live."
          testID="bazaar-rules"
        >
          {BAZAAR_MARKETPLACE_RULES.map((row) => (
            <BazaarRuleRow key={row.label} row={row} accentColor="#5B9BD5" />
          ))}
        </BazaarSectionCard>

        {/* Trading requirements */}
        <BazaarSectionCard
          title="Trading Requirements"
          icon="checkbox-outline"
          accentColor="#F59E0B"
          intro="Requirements a healer must meet before they can buy or sell anything."
          testID="bazaar-requirements"
        >
          {BAZAAR_TRADING_REQUIREMENTS.map((row) => (
            <BazaarRuleRow key={row.label} row={row} accentColor="#F59E0B" />
          ))}
        </BazaarSectionCard>

        {/* Taxes */}
        <BazaarSectionCard
          title="Taxes"
          icon="calculator-outline"
          accentColor="#F97316"
          intro={BAZAAR_TAX_NOTES.intro}
          testID="bazaar-taxes"
        >
          {BAZAAR_TAX_TIERS.map((tier) => (
            <View key={tier.id} style={styles.taxRow}>
              <Text style={styles.taxLabel}>{tier.label}</Text>
              <Text style={styles.taxValue}>{tier.buyerTaxPercent}% buyer + {tier.sellerTaxPercent}% seller</Text>
            </View>
          ))}
          <Text style={styles.footnote}>Buyer currency: {BAZAAR_TAX_NOTES.buyerCurrency}. {BAZAAR_TAX_NOTES.refinedGemCapNote}</Text>
        </BazaarSectionCard>

        {/* Listing fees */}
        <BazaarSectionCard
          title="Listing Fees"
          icon="pricetag-outline"
          accentColor="#22D3EE"
          intro={BAZAAR_LISTING_FEES.intro}
          testID="bazaar-listing-fees"
        >
          <BazaarRuleRow row={{ icon: "pricetags-outline", label: "Fee rate", value: `${BAZAAR_LISTING_FEES.feePercent}% of listing price (min ${BAZAAR_LISTING_FEES.minFee}, max ${BAZAAR_LISTING_FEES.maxFee})` }} accentColor="#22D3EE" />
          <BazaarRuleRow row={{ icon: "diamond-outline", label: "Payable with", value: BAZAAR_LISTING_FEES.currencies.join(" or ") }} accentColor="#22D3EE" />
          <BazaarRuleRow row={{ icon: "return-up-back-outline", label: "If the item sells", value: `${BAZAAR_LISTING_FEES.refundOnSellPercent}% of the listing fee is refunded` }} accentColor="#22D3EE" />
          <BazaarRuleRow row={{ icon: "time-outline", label: "If the listing expires", value: BAZAAR_LISTING_FEES.lostOnExpire ? "The listing fee is not refunded" : "The listing fee is refunded" }} accentColor="#22D3EE" />
        </BazaarSectionCard>

        {/* Safety guidelines */}
        <BazaarSectionCard
          title="Safety Guidelines"
          icon="shield-checkmark-outline"
          accentColor="#34D399"
          intro="Protections built in from the start to keep trading fair and scam-free."
          testID="bazaar-safety"
        >
          {BAZAAR_SAFETY_GUIDELINES.map((row) => (
            <BazaarRuleRow key={row.label} row={row} accentColor="#34D399" />
          ))}
        </BazaarSectionCard>

        <View style={styles.closingNotice}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.noticeTxt}>
            Nothing on this page can be tapped to buy, sell, or trade anything. All numbers and rules
            are planning placeholders and may change before the Bazaar ever opens.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg, paddingBottom: SPACING.sm },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  kicker: { color: COLORS.storm, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300", marginTop: 2 },
  notice: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    marginHorizontal: SPACING.lg, marginBottom: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },
  noticeTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 17, flex: 1, fontStyle: "italic" },
  scroll: { padding: SPACING.lg, paddingTop: 0, paddingBottom: SPACING.xxxl, gap: SPACING.md },
  heroCard: {
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.storm + "45",
    backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, gap: 6,
  },
  heroBadge: {
    flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 4,
    backgroundColor: COLORS.storm + "22", borderColor: COLORS.storm + "55", borderWidth: 1,
    borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4,
  },
  heroBadgeTxt: { color: COLORS.storm, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  heroKicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  heroTitle: { color: COLORS.onSurface, fontSize: 19, fontWeight: "700" },
  heroBody: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19, marginTop: 2 },
  pillarRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  pillar: {
    flexBasis: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, padding: 8,
  },
  pillarIcon: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.brand + "22",
    alignItems: "center", justifyContent: "center",
  },
  pillarTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, flex: 1, fontWeight: "600" },
  taxRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm, paddingVertical: 8,
  },
  taxLabel: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700" },
  taxValue: { color: COLORS.onSurfaceSecondary, fontSize: 12 },
  footnote: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15, fontStyle: "italic", marginTop: 2 },
  closingNotice: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },
});
