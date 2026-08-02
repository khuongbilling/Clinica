import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HEROES } from "@/src/game/content";
import { getProgress } from "@/src/game/evolution";
import {
  levelCapForStar,
  heroEffectiveLevelCap,
  canUseScroll,
  SCROLL_TIERS,
  MAX_CERTIFICATION_STAR,
  checkPromotion,
  heroRoleLabel,
  type ScrollTier,
} from "@/src/game/university";
import { heroXpCostForLevel, playerLevelFromXp } from "@/src/game/progression";
import { usePlayer } from "@/src/game/store";
import { UniversityCreditsBadge } from "@/src/components/UniversityCreditsBadge";
import { ROUTES } from "@/src/game/routes";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── Requirement row ──────────────────────────────────────────────────────────
function ReqRow({ label, have, need }: { label: string; have: number; need: number }) {
  const met = have >= need;
  return (
    <View style={rr.row}>
      <Ionicons
        name={met ? "checkmark-circle" : "close-circle-outline"}
        size={13}
        color={met ? "#22C55E" : "#EF4444"}
      />
      <Text style={rr.label}>{label}</Text>
      <Text style={[rr.count, { color: met ? "#22C55E" : "#EF4444" }]}>
        {have} / {need}
      </Text>
    </View>
  );
}
const rr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  label: { flex: 1, color: COLORS.onSurfaceSecondary, fontSize: 11 },
  count: { fontSize: 11, fontWeight: "700" },
});

// ── Scroll tier rarity colors ────────────────────────────────────────────────
const RARITY_BG: Record<string, string> = {
  Common:   "#94A3B820",
  Uncommon: "#34D39920",
  Rare:     "#60A5FA20",
  Epic:     "#D4AF3720",
};

// ── Main screen ──────────────────────────────────────────────────────────────
export default function TrainingHallScreen() {
  const router = useRouter();
  const { player, trainHero, promoteHeroCert, purchaseItem } = usePlayer();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [buyingTier, setBuyingTier] = useState<string | null>(null);
  const [buyFeedback, setBuyFeedback] = useState<string | null>(null);

  if (!player) {
    return (
      <SafeAreaView style={[styles.container, styles.loading]} edges={["top"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  const owned = HEROES.filter((h) => player.heroes_owned.includes(h.id));
  const uc = player.university_credits ?? 0;
  const inv = player.inventory ?? {};
  const crowns = player.crowns ?? 0;
  const playerLevel = player.player_level ?? playerLevelFromXp(player.xp ?? 0).level;

  // Total scroll count across all tiers (for bottom bar)
  const totalScrolls = SCROLL_TIERS.reduce((sum, t) => sum + (inv[t.key] ?? 0), 0);

  const onTrain = async (heroId: string, tierKey: string) => {
    if (busyId) return;
    const key = `${heroId}::${tierKey}`;
    setBusyId(heroId);
    setBusyTier(tierKey);
    const res = await trainHero(heroId, tierKey);
    setFeedback((f) => ({ ...f, [heroId]: res.message }));
    setBusyId(null);
    setBusyTier(null);
  };

  const onPromote = async (heroId: string) => {
    if (busyId) return;
    setBusyId(heroId);
    const res = await promoteHeroCert(heroId);
    setFeedback((f) => ({ ...f, [heroId]: res.message }));
    setBusyId(null);
  };

  const onBuyScroll = async (tier: ScrollTier) => {
    if (buyingTier) return;
    setBuyingTier(tier.key);
    const res = await purchaseItem(tier.key, tier.crownCost, 1);
    setBuyFeedback(res.ok ? `Purchased 1 ${tier.label}!` : res.message);
    setTimeout(() => setBuyFeedback(null), 3000);
    setBuyingTier(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} testID="training-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>TRAINING HALL</Text>
        <Text style={styles.title}>Level Up Your Heroes</Text>
        <View style={styles.headerMeta}>
          <View style={styles.metaChip}>
            <Ionicons name="person-circle-outline" size={13} color={COLORS.brand} />
            <Text style={styles.metaLabel}>Player Lv</Text>
            <Text style={[styles.metaValue, { color: COLORS.brand }]}>{playerLevel}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="document-text-outline" size={13} color="#FCD34D" />
            <Text style={styles.metaLabel}>Scrolls</Text>
            <Text style={[styles.metaValue, { color: "#FCD34D" }]}>{totalScrolls}</Text>
          </View>
          <UniversityCreditsBadge amount={uc} testID="training-credits-badge" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* How it works */}
        <View style={styles.loopBox} testID="training-loop-explainer">
          <Text style={styles.loopTitle}>HOW HERO GROWTH WORKS</Text>
          <Text style={styles.loopLine}>
            <Text style={styles.loopBold}>Battle XP — </Text>
            Heroes gain XP from battles they join. Higher contribution (stabilizes, reveals, actions) earns more.
          </Text>
          <Text style={styles.loopLine}>
            <Text style={styles.loopBold}>Experience Scrolls — </Text>
            Use a scroll here to inject XP instantly. Rarer scrolls give more. Earn them from battle clears or buy with Crowns.
          </Text>
          <Text style={styles.loopLine}>
            <Text style={styles.loopBold}>Certification Stars — </Text>
            Each hero levels freely within their current ★ cap. Reach Player Level {`{N}`} to unlock promotion to {`{N}`}★.
          </Text>
          <Text style={styles.loopLine}>
            <Text style={styles.loopBold}>Promotion — </Text>
            When a hero hits their star cap, spend Hero Shards + Credits to advance to the next Certification Star.
          </Text>
        </View>

        {/* Scroll shop — all 4 tiers */}
        <View style={styles.shopSection}>
          <Text style={styles.shopTitle}>SCROLL SHOP</Text>
          <Text style={styles.shopSub}>Your Crowns: {crowns.toLocaleString()}</Text>
          {buyFeedback && <Text style={styles.buyFeedback}>{buyFeedback}</Text>}
          {SCROLL_TIERS.map((tier) => {
            const count = inv[tier.key] ?? 0;
            const canAfford = crowns >= tier.crownCost;
            const isBuying = buyingTier === tier.key;
            return (
              <View key={tier.key} style={[styles.shopRow, { backgroundColor: RARITY_BG[tier.rarity] }]}>
                <View style={styles.shopLeft}>
                  <Ionicons name={tier.iconName as any} size={20} color={tier.color} />
                  <View>
                    <View style={styles.shopNameRow}>
                      <Text style={[styles.shopName, { color: tier.color }]}>{tier.label}</Text>
                      <View style={[styles.rarityBadge, { borderColor: tier.color + "50" }]}>
                        <Text style={[styles.rarityTxt, { color: tier.color }]}>{tier.rarity}</Text>
                      </View>
                    </View>
                    <Text style={styles.shopXp}>+{tier.xp} Hero XP per use</Text>
                  </View>
                </View>
                <View style={styles.shopRight}>
                  <View style={[styles.countBubble, { borderColor: tier.color + "60" }]}>
                    <Text style={[styles.countTxt, { color: tier.color }]}>{count}</Text>
                  </View>
                  <Pressable
                    style={[styles.buyBtn, (!canAfford || isBuying) && styles.buyBtnDisabled]}
                    onPress={() => onBuyScroll(tier)}
                    disabled={!canAfford || isBuying}
                    testID={`training-buy-${tier.key}`}
                  >
                    <Ionicons name="diamond-outline" size={11} color={!canAfford ? COLORS.onSurfaceTertiary : "#fff"} />
                    <Text style={[styles.buyBtnTxt, !canAfford && { color: COLORS.onSurfaceTertiary }]}>
                      {isBuying ? "…" : tier.crownCost}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          <Text style={styles.dropHint}>
            Drop rates: 1★ → Common · 2★ → Uncommon · 3★ → Rare · Boss 3★ → Epic
          </Text>
        </View>

        {owned.length === 0 && (
          <View style={styles.emptyBox} testID="training-empty-state">
            <Ionicons name="people-outline" size={32} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.emptyTitle}>No heroes to train yet</Text>
            <Text style={styles.empty}>Heroes join your ward through University Recruitment. Enroll your first healer, then return here to train them.</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push(ROUTES.universityRecruit)} testID="training-empty-recruit-btn">
              <Ionicons name="school" size={14} color={COLORS.onBrand} />
              <Text style={styles.emptyBtnTxt}>GO TO RECRUITMENT HALL</Text>
            </Pressable>
          </View>
        )}

        {owned.map((h) => {
          const prog = getProgress(player.hero_progression, h.id);
          const starCap = levelCapForStar(prog.star);
          const effectiveCap = starCap; // level cap is now purely star-based
          const level = prog.level ?? 1;
          const xpBanked = prog.xp ?? 0;
          const xpNeeded = heroXpCostForLevel(level);
          const xpPct = level >= effectiveCap ? 1 : Math.min(1, xpBanked / xpNeeded);
          const levelPct = Math.min(1, level / effectiveCap);
          const accent = ELEMENT_COLORS[h.element] ?? COLORS.brand;
          const starCapped = level >= starCap;
          const atCap = level >= effectiveCap;
          const atMaxStar = prog.star >= MAX_CERTIFICATION_STAR;
          const isBusy = busyId === h.id;
          const canScroll = canUseScroll(prog, playerLevel);

          // Certification promotion check
          const promCheck = (atCap && !atMaxStar)
            ? checkPromotion(h.role, prog, player)
            : null;

          return (
            <View key={h.id} style={[styles.card, { borderLeftColor: accent }]} testID={`training-hero-${h.id}`}>
              {/* Header */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{h.name}</Text>
                <Text style={[styles.cardStar, { color: accent }]}>★{prog.star}</Text>
              </View>
              <Text style={styles.cardRole}>{heroRoleLabel(h.role)} · {h.element}</Text>

              {/* Broad level bar */}
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${levelPct * 100}%`, backgroundColor: accent + "88" }]} />
              </View>
              <Text style={styles.levelTxt}>
                Level {level} / {effectiveCap}
                <Text style={styles.gateTxt}> (★{prog.star} cap)</Text>
              </Text>

              {/* Fine XP bar within current level */}
              {!atCap && (
                <>
                  <View style={styles.xpTrack}>
                    <View style={[styles.xpFill, { width: `${xpPct * 100}%`, backgroundColor: accent }]} />
                  </View>
                  <Text style={styles.xpTxt}>{xpBanked} / {xpNeeded} XP to Level {level + 1}</Text>
                </>
              )}

              {/* Scroll train buttons — one row per tier that has stock */}
              {canScroll && (
                <View style={styles.trainSection}>
                  <Text style={styles.trainLabel}>USE A SCROLL</Text>
                  <View style={styles.trainTierRow}>
                    {SCROLL_TIERS.map((tier) => {
                      const count = inv[tier.key] ?? 0;
                      const isThisBusy = isBusy && busyTier === tier.key;
                      const disabled = isBusy || count < 1;
                      return (
                        <Pressable
                          key={tier.key}
                          onPress={() => onTrain(h.id, tier.key)}
                          disabled={disabled}
                          style={[
                            styles.tierBtn,
                            { borderColor: count > 0 ? tier.color + "70" : COLORS.border },
                            disabled && styles.tierBtnDisabled,
                          ]}
                          testID={`training-train-${h.id}-${tier.key}`}
                        >
                          <Ionicons
                            name={tier.iconName as any}
                            size={13}
                            color={count > 0 ? tier.color : COLORS.onSurfaceTertiary}
                          />
                          <Text style={[styles.tierXp, { color: count > 0 ? tier.color : COLORS.onSurfaceTertiary }]}>
                            {isThisBusy ? "…" : `+${tier.xp}`}
                          </Text>
                          <View style={[styles.tierCountBubble, { backgroundColor: count > 0 ? tier.color + "25" : COLORS.surfaceTertiary }]}>
                            <Text style={[styles.tierCountTxt, { color: count > 0 ? tier.color : COLORS.onSurfaceTertiary }]}>
                              {count}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                  {totalScrolls === 0 && (
                    <Text style={styles.noScrollHint}>Earn scrolls from battle clears or buy above</Text>
                  )}
                </View>
              )}

              {/* Star cap — fully certified */}
              {starCapped && atMaxStar && (
                <View style={styles.maxRow}>
                  <Ionicons name="trophy-outline" size={14} color={accent} />
                  <Text style={[styles.maxTxt, { color: accent }]}>Fully certified — max star and level reached.</Text>
                </View>
              )}

              {/* Certification promotion */}
              {atCap && !atMaxStar && promCheck !== null && (
                <View style={[styles.promoteBox, { borderColor: accent + "44" }]}>
                  <View style={styles.promoteHeader}>
                    <Ionicons name="arrow-up-circle-outline" size={15} color={accent} />
                    <Text style={[styles.promoteTitle, { color: accent }]}>
                      PROMOTE TO ★{prog.star + 1} CERTIFICATION
                    </Text>
                  </View>
                  <Text style={styles.promoteCaption}>
                    Raises the star cap to Level {levelCapForStar(prog.star + 1)}. Costs Credits + materials.
                  </Text>
                  <View style={styles.reqBlock}>
                    <ReqRow label={`Hero Level ${promCheck.levelNeeded}`} have={promCheck.level} need={promCheck.levelNeeded} />
                    {promCheck.req?.shardsOrTrainees ? (
                      <ReqRow
                        label={`Hero Shards OR ${promCheck.trainee.label}s`}
                        have={Math.max(promCheck.shardsHave, promCheck.trainHave)}
                        need={Math.min(promCheck.shardsNeeded, promCheck.trainNeeded)}
                      />
                    ) : (
                      <>
                        <ReqRow label={`Hero Shards (${promCheck.shardsNeeded} needed)`} have={promCheck.shardsHave} need={promCheck.shardsNeeded} />
                        <ReqRow label={`${promCheck.trainee.label}s (${promCheck.trainNeeded} needed)`} have={promCheck.trainHave} need={promCheck.trainNeeded} />
                      </>
                    )}
                    <ReqRow label="University Credits" have={promCheck.creditsHave} need={promCheck.creditsNeeded} />
                  </View>
                  {!promCheck.eligible ? (
                    <View style={styles.missingBox}>
                      {promCheck.missing.map((m, i) => (
                        <Text key={i} style={styles.missingTxt}>· {m}</Text>
                      ))}
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => onPromote(h.id)}
                      disabled={isBusy}
                      style={[styles.promoteBtn, { backgroundColor: isBusy ? accent + "66" : accent }]}
                      testID={`training-promote-btn-${h.id}`}
                    >
                      <Ionicons name="arrow-up-circle" size={15} color="#000" />
                      <Text style={styles.promoteBtnTxt}>
                        {isBusy ? "Promoting…" : `Promote to ★${prog.star + 1}`}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}

              {feedback[h.id] && (
                <Text style={[styles.feedback, { color: accent }]}>{feedback[h.id]}</Text>
              )}
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={styles.creditsBar}>
        {SCROLL_TIERS.map((tier) => {
          const count = inv[tier.key] ?? 0;
          return (
            <View key={tier.key} style={styles.creditChip}>
              <Ionicons name={tier.iconName as any} size={12} color={tier.color} />
              <Text style={[styles.creditAmt, { color: count > 0 ? tier.color : COLORS.onSurfaceTertiary }]}>{count}</Text>
            </View>
          );
        })}
        <View style={[styles.creditChip, { flex: 2 }]}>
          <Ionicons name="school-outline" size={12} color="#2DD4BF" />
          <Text style={styles.creditLabel}>Credits</Text>
          <Text style={[styles.creditAmt, { color: "#2DD4BF" }]}>{uc.toLocaleString()}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: 6 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)", marginBottom: SPACING.sm,
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300" },
  headerMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(0,0,0,0.2)", borderRadius: RADIUS.sm,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  metaLabel: { color: COLORS.onSurfaceSecondary, fontSize: 11 },
  metaValue: { fontSize: 13, fontWeight: "800" },

  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },

  loopBox: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, gap: 6,
  },
  loopTitle: { color: COLORS.brand, fontSize: 10, letterSpacing: 1.5, fontWeight: "800", marginBottom: 2 },
  loopLine: { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 17 },
  loopBold: { color: COLORS.onSurface, fontWeight: "700" },

  // Scroll shop
  shopSection: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, gap: 8,
  },
  shopTitle: { color: COLORS.brand, fontSize: 10, letterSpacing: 1.5, fontWeight: "800" },
  shopSub: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: -4 },
  buyFeedback: { color: "#22C55E", fontSize: 11, textAlign: "center" },
  shopRow: {
    flexDirection: "row", alignItems: "center",
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm, paddingVertical: 10, gap: SPACING.sm,
  },
  shopLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  shopNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  shopName: { fontSize: 13, fontWeight: "700" },
  rarityBadge: {
    borderWidth: 1, borderRadius: RADIUS.sm,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  rarityTxt: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  shopXp: { color: COLORS.onSurfaceTertiary, fontSize: 10, marginTop: 1 },
  shopRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  countBubble: {
    minWidth: 32, height: 32, borderRadius: 16, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  countTxt: { fontSize: 13, fontWeight: "800" },
  buyBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.brand, borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  buyBtnDisabled: { backgroundColor: COLORS.surfaceTertiary },
  buyBtnTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  dropHint: {
    color: COLORS.onSurfaceTertiary, fontSize: 10, fontStyle: "italic",
    textAlign: "center", lineHeight: 14,
  },

  emptyBox: { alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.xl },
  emptyTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.brand, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, marginTop: SPACING.xs,
  },
  emptyBtnTxt: { color: COLORS.onBrand, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  empty: { color: COLORS.onSurfaceTertiary, fontSize: 13, textAlign: "center", maxWidth: 300 },

  card: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderLeftWidth: 3,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: 6,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardName: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  cardStar: { fontSize: 13, fontWeight: "800" },
  cardRole: { color: COLORS.onSurfaceTertiary, fontSize: 11 },

  barTrack: { height: 6, borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceTertiary, overflow: "hidden", marginTop: 4 },
  barFill: { height: "100%", borderRadius: RADIUS.pill },
  levelTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: "600" },
  gateTxt: { color: COLORS.onSurfaceTertiary, fontWeight: "400", fontSize: 10 },

  xpTrack: { height: 4, borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceTertiary, overflow: "hidden" },
  xpFill: { height: "100%", borderRadius: RADIUS.pill },
  xpTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10 },

  // Tier scroll buttons
  trainSection: { marginTop: 4, gap: 6 },
  trainLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  trainTierRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tierBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  tierBtnDisabled: { opacity: 0.45 },
  tierXp: { fontSize: 12, fontWeight: "800" },
  tierCountBubble: {
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1,
  },
  tierCountTxt: { fontSize: 10, fontWeight: "800" },
  noScrollHint: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontStyle: "italic" },

  capRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  capTxt: { flex: 1, color: "#F59E0B", fontSize: 10, lineHeight: 14 },

  maxRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  maxTxt: { fontSize: 11, fontWeight: "600" },

  promoteBox: {
    marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: 10, gap: 6,
  },
  promoteHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  promoteTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  promoteCaption: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15 },
  reqBlock: { gap: 2, marginTop: 4 },
  missingBox: { gap: 3, marginTop: 4 },
  missingTxt: { color: "#EF4444", fontSize: 11, lineHeight: 16 },
  promoteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm, marginTop: 6,
  },
  promoteBtnTxt: { color: "#000", fontSize: 12, fontWeight: "800" },

  feedback: { fontSize: 11, fontWeight: "600", textAlign: "center" },

  creditsBar: {
    flexDirection: "row", gap: 8,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  creditChip: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
    paddingHorizontal: 8, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  creditLabel: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10 },
  creditAmt: { fontSize: 13, fontWeight: "800" },
});
