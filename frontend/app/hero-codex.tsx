/**
 * Hero Codex — full tabulated roster of every hero in LAUNCH_ROSTER,
 * grouped by rarity tier (Epic → Rare → Uncommon → Common) with both
 * portrait and battle-sprite thumbnails, per-tier and per-hero pull rates,
 * and a family filter. Owned heroes show a checkmark and a highlighted row.
 */

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getHeroBattleSprite } from "@/src/components/HeroBattleSprites";
import { getHeroPortrait } from "@/src/components/HeroPortraits";
import {
  FAMILY_COLORS,
  LAUNCH_ROSTER,
  RARITY_COLORS,
  RARITY_LABELS,
  RARITY_PULL_RATES,
  type RosterHero,
} from "@/src/game/heroRoster";
import type { ClassFamily, LaunchRarity } from "@/src/game/types";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── Constants ────────────────────────────────────────────────────────────────

const TIER_ORDER: LaunchRarity[] = ["epic", "rare", "uncommon", "common"];

const TIER_STARS: Record<LaunchRarity, string> = {
  epic:     "★★★★",
  rare:     "★★★",
  uncommon: "★★",
  common:   "★",
};

const ALL_FAMILIES: ClassFamily[] = [
  "Wardborn", "Lifebreath", "Truthseer",
  "Remedybound", "Restorebound", "Realmbound",
];

// Unfiltered counts used for accurate per-hero pull rate calculation
const TIER_TOTALS: Record<LaunchRarity, number> = { epic: 0, rare: 0, uncommon: 0, common: 0 };
for (const h of LAUNCH_ROSTER) TIER_TOTALS[h.rarityTier]++;

function perHeroPct(tier: LaunchRarity): string {
  const v = RARITY_PULL_RATES[tier] / TIER_TOTALS[tier];
  return v >= 1 ? v.toFixed(1) : v.toFixed(2);
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function HeroCodexScreen() {
  const router  = useRouter();
  const { player } = usePlayer();
  const owned   = useMemo(() => new Set(player?.heroes_owned ?? []), [player?.heroes_owned]);

  const [filterFamily, setFilterFamily] = useState<ClassFamily | null>(null);

  const herosByTier = useMemo(() => {
    const filtered = filterFamily
      ? LAUNCH_ROSTER.filter((h) => h.family === filterFamily)
      : LAUNCH_ROSTER;
    const groups: Record<LaunchRarity, RosterHero[]> = {
      epic: [], rare: [], uncommon: [], common: [],
    };
    for (const h of filtered) groups[h.rarityTier].push(h);
    return groups;
  }, [filterFamily]);

  const visibleCount = useMemo(
    () => TIER_ORDER.reduce((s, t) => s + herosByTier[t].length, 0),
    [herosByTier],
  );

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="hero-codex-screen">
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10} testID="hero-codex-back">
          <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>CLINICA UNIVERSITY</Text>
          <Text style={styles.title}>Hero Codex</Text>
        </View>
        <View style={styles.countPill}>
          <Ionicons name="people" size={13} color={COLORS.brand} />
          <Text style={styles.countTxt}>
            {filterFamily ? `${visibleCount} / ` : ""}{LAUNCH_ROSTER.length}
          </Text>
        </View>
      </View>

      {/* ── Pull Rate Overview ── */}
      <View style={styles.pullBanner}>
        <Text style={styles.pullBannerLbl}>GACHA PULL RATES BY TIER</Text>
        <View style={styles.pullTierRow}>
          {TIER_ORDER.map((tier) => {
            const col = RARITY_COLORS[tier];
            return (
              <View key={tier} style={[styles.pullTierCard, { borderColor: col + "55", backgroundColor: col + "0E" }]}>
                <Text style={[styles.pullTierStars, { color: col }]}>{TIER_STARS[tier]}</Text>
                <Text style={[styles.pullTierName,  { color: col }]}>{RARITY_LABELS[tier]}</Text>
                <Text style={[styles.pullTierPct,   { color: col }]}>{RARITY_PULL_RATES[tier]}%</Text>
                <Text style={styles.pullTierPer}>{perHeroPct(tier)}% ea</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Family Filter ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.familyRow}
        contentContainerStyle={styles.familyRowContent}
      >
        {ALL_FAMILIES.map((fam) => {
          const col    = FAMILY_COLORS[fam];
          const active = filterFamily === fam;
          return (
            <Pressable
              key={fam}
              style={[
                styles.familyChip,
                active
                  ? { backgroundColor: col, borderColor: col }
                  : { borderColor: col + "55" },
              ]}
              onPress={() => setFilterFamily(active ? null : fam)}
              testID={`codex-family-${fam}`}
            >
              <Text style={[styles.familyChipTxt, { color: active ? "#0D1B2A" : col }]}>
                {fam}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Hero List ── */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {TIER_ORDER.map((tier) => {
          const heroes    = herosByTier[tier];
          if (heroes.length === 0) return null;
          const tierColor = RARITY_COLORS[tier];
          const tierRate  = RARITY_PULL_RATES[tier];
          const perHero   = perHeroPct(tier);

          return (
            <View key={tier}>
              {/* ── Tier Section Header ── */}
              <View style={[styles.tierHead, { borderLeftColor: tierColor }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" }}>
                  <Text style={[styles.tierStars, { color: tierColor }]}>{TIER_STARS[tier]}</Text>
                  <Text style={[styles.tierName,  { color: tierColor }]}>
                    {RARITY_LABELS[tier].toUpperCase()}
                  </Text>
                  <View style={[styles.tierCount, { borderColor: tierColor + "50", backgroundColor: tierColor + "1A" }]}>
                    <Text style={[styles.tierCountTxt, { color: tierColor }]}>
                      {heroes.length}{filterFamily ? ` / ${TIER_TOTALS[tier]}` : ""}
                    </Text>
                  </View>
                </View>
                <Text style={styles.tierRateLine}>
                  {tierRate}% overall · {perHero}% per hero
                </Text>
              </View>

              {/* ── Hero Rows ── */}
              {heroes.map((h) => {
                const portrait      = getHeroPortrait(h.id);
                const battleSprite  = getHeroBattleSprite(h.id);
                const famColor      = FAMILY_COLORS[h.family];
                const isOwned       = owned.has(h.id);

                return (
                  <View
                    key={h.id}
                    style={[
                      styles.heroRow,
                      isOwned && { backgroundColor: famColor + "0A" },
                    ]}
                    testID={`codex-hero-${h.id}`}
                  >
                    {/* Portrait thumbnail */}
                    <View style={[styles.portraitBox, { borderColor: tierColor + "55" }]}>
                      {portrait ? (
                        <Image
                          source={portrait}
                          style={styles.portraitImg}
                          contentFit="cover"
                          contentPosition="top"
                        />
                      ) : (
                        <View style={[styles.portraitFallback, { backgroundColor: famColor + "28" }]}>
                          <Text style={[styles.portraitInitial, { color: famColor }]}>
                            {h.name[0]}
                          </Text>
                        </View>
                      )}
                      {/* Owned dot */}
                      {isOwned && (
                        <View style={[styles.ownedDot, { backgroundColor: tierColor }]} />
                      )}
                    </View>

                    {/* Battle sprite thumbnail */}
                    <View style={[styles.spriteBox, { backgroundColor: famColor + "14" }]}>
                      {battleSprite ? (
                        <Image
                          source={battleSprite}
                          style={styles.spriteImg}
                          contentFit="contain"
                        />
                      ) : (
                        <Ionicons name="person-outline" size={20} color={famColor + "88"} />
                      )}
                    </View>

                    {/* Hero info */}
                    <View style={styles.heroInfo}>
                      <View style={styles.heroNameRow}>
                        <Text style={styles.heroName} numberOfLines={1}>{h.name}</Text>
                        {isOwned && (
                          <Ionicons name="checkmark-circle" size={12} color={tierColor} />
                        )}
                      </View>
                      <Text style={styles.heroTitle} numberOfLines={1}>{h.title}</Text>
                      <View style={styles.heroTagRow}>
                        {/* Family chip */}
                        <View style={[styles.famChip, { borderColor: famColor + "55", backgroundColor: famColor + "18" }]}>
                          <Text style={[styles.famChipTxt, { color: famColor }]}>{h.family}</Text>
                        </View>
                        {/* Role chip */}
                        <View style={styles.roleChip}>
                          <Text style={styles.roleChipTxt}>{h.role}</Text>
                        </View>
                      </View>
                      {/* Element */}
                      <Text style={styles.heroElement}>{h.element}</Text>
                    </View>

                    {/* Per-hero pull rate */}
                    <View style={[styles.pullCell, { borderColor: tierColor + "45" }]}>
                      <Text style={[styles.pullPct, { color: tierColor }]}>{perHero}%</Text>
                      <Text style={styles.pullPer}>per pull</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* Footer note */}
        <View style={styles.footerNote}>
          <Ionicons name="information-circle-outline" size={13} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footerTxt}>
            Per-pull rates assume equal weight within each tier (
            {RARITY_PULL_RATES.epic}% ÷ {TIER_TOTALS.epic} epics,{" "}
            {RARITY_PULL_RATES.rare}% ÷ {TIER_TOTALS.rare} rares,{" "}
            {RARITY_PULL_RATES.uncommon}% ÷ {TIER_TOTALS.uncommon} uncommons,{" "}
            {RARITY_PULL_RATES.common}% ÷ {TIER_TOTALS.common} commons).
            Owned heroes show a highlighted row and a{" "}
            <Text style={{ color: COLORS.brand }}>✓</Text>.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  // ── Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surfaceSecondary,
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title:  { color: COLORS.onSurface, fontSize: 20, fontWeight: "300", letterSpacing: 0.3 },
  countPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 4,
  },
  countTxt: { color: COLORS.brand, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },

  // ── Pull Rate Banner
  pullBanner: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  pullBannerLbl: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10, letterSpacing: 2, fontWeight: "700",
  },
  pullTierRow: { flexDirection: "row", gap: SPACING.xs },
  pullTierCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    alignItems: "center",
    paddingVertical: SPACING.sm,
    gap: 2,
  },
  pullTierStars: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  pullTierName:  { fontSize: 9,  fontWeight: "700", letterSpacing: 0.5 },
  pullTierPct:   { fontSize: 18, fontWeight: "800", lineHeight: 22 },
  pullTierPer:   { color: COLORS.onSurfaceTertiary, fontSize: 9 },

  // ── Family Filter
  familyRow: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  familyRowContent: {
    flexDirection: "row",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  familyChip: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: SPACING.sm + 2, paddingVertical: 4,
  },
  familyChipTxt: { fontSize: 11, fontWeight: "700" },

  // ── List
  list:        { flex: 1 },
  listContent: { paddingBottom: SPACING.xl * 2 },

  // ── Tier section header
  tierHead: {
    borderLeftWidth: 3,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xs,
    backgroundColor: COLORS.surfaceSecondary + "66",
    gap: 3,
  },
  tierStars:    { fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  tierName:     { fontSize: 13, fontWeight: "800", letterSpacing: 2 },
  tierCount: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  tierCountTxt: { fontSize: 11, fontWeight: "700" },
  tierRateLine: { color: COLORS.onSurfaceTertiary, fontSize: 11 },

  // ── Hero Row
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border + "55",
  },

  // Portrait
  portraitBox: {
    width: 52, height: 70,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  portraitImg: { width: "100%", height: "100%" },
  portraitFallback: {
    width: "100%", height: "100%",
    alignItems: "center", justifyContent: "center",
  },
  portraitInitial: { fontSize: 22, fontWeight: "700" },
  ownedDot: {
    position: "absolute", bottom: 3, right: 3,
    width: 8, height: 8, borderRadius: 4,
  },

  // Battle sprite
  spriteBox: {
    width: 48, height: 64,
    borderRadius: RADIUS.sm,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  spriteImg: { width: "100%", height: "100%" },

  // Info column
  heroInfo:    { flex: 1, gap: 2, minWidth: 0 },
  heroNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroName:    { color: COLORS.onSurface, fontSize: 12, fontWeight: "700", flexShrink: 1 },
  heroTitle:   { color: COLORS.onSurfaceTertiary, fontSize: 10, fontStyle: "italic" },
  heroTagRow:  { flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 2 },
  famChip: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  famChipTxt:  { fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  roleChip: {
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1,
    backgroundColor: COLORS.surfaceSecondary,
  },
  roleChipTxt:  { color: COLORS.onSurfaceSecondary, fontSize: 9, fontWeight: "600" },
  heroElement:  { color: COLORS.onSurfaceTertiary, fontSize: 10, marginTop: 1 },

  // Pull rate cell
  pullCell: {
    width: 54,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  pullPct: { fontSize: 13, fontWeight: "800" },
  pullPer: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.3 },

  // Footer
  footerNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    margin: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
  },
  footerTxt: {
    flex: 1,
    color: COLORS.onSurfaceTertiary,
    fontSize: 11, lineHeight: 16,
  },
});
