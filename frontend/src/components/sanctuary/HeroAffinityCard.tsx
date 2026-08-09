/**
 * HeroAffinityCard — Push 7
 *
 * The hero info strip shown below the arena on the Sanctuary hub.
 * The entire card is one Pressable (no separate "View Profile" button).
 *
 * Layout:
 *   Left   — Large painted affinity medallion (element-specific)
 *   Centre — Hero name · Profession · Lv. X + XP progress bar
 *   Right  — XP figures · NEXT REWARD kicker · painted treasure chest
 *
 * Props:
 *   hero.name            — "Acute Step Warden"
 *   hero.profession      — "Physiotherapist"  (maps to hero.title in roster)
 *   hero.level           — current hero level (integer)
 *   hero.affinity        — ElementSystem value used to tint accents
 *   hero.affinityArtwork — painted medallion ImageSource (from getAffinityMedallion)
 *   hero.currentXP       — XP banked toward next level
 *   hero.requiredXP      — XP required for next level
 *   hero.nextRewardArtwork — ImageSource for reward icon (treasure chest)
 *   hero.atLevelCap      — when true, shows MAX instead of XP figures
 *   accentColor          — element tint colour (pass ELEMENT_COLORS[hero.affinity])
 *   onPress              — navigates to hero detail screen
 */
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { RADIUS, SPACING } from "@/src/theme/colors";
import { TYPO, UI, UI_RADIUS, SERIF } from "@/src/theme/ui";

// ── Prop types ───────────────────────────────────────────────────────────────
export interface HeroAffinityCardHeroData {
  name: string;
  profession: string;
  level: number;
  affinity: string;
  affinityArtwork: ImageSourcePropType;
  currentXP: number;
  requiredXP: number;
  nextRewardArtwork: ImageSourcePropType;
  atLevelCap?: boolean;
}

export interface HeroAffinityCardProps {
  hero: HeroAffinityCardHeroData;
  /** Element tint colour — pass ELEMENT_COLORS[hero.affinity] */
  accentColor: string;
  onPress: () => void;
  testID?: string;
}

// ── Component ────────────────────────────────────────────────────────────────
export function HeroAffinityCard({ hero, accentColor, onPress, testID }: HeroAffinityCardProps) {
  const xpPct = hero.atLevelCap
    ? 1
    : Math.min(1, hero.requiredXP > 0 ? hero.currentXP / hero.requiredXP : 0);

  const xpLabel = hero.atLevelCap
    ? "MAX"
    : `${hero.currentXP}/${hero.requiredXP}`;

  return (
    <Pressable
      style={[
        s.card,
        {
          borderColor:   accentColor + "42",
          shadowColor:   accentColor,
          shadowOpacity: 0.25,
          shadowRadius:  16,
          shadowOffset:  { width: 0, height: 4 },
          elevation: 5,
        },
      ]}
      onPress={onPress}
      testID={testID ?? "hero-affinity-card"}
      accessibilityLabel={`${hero.name} — Lv. ${hero.level} ${hero.profession}. Tap to view profile.`}
      accessibilityRole="button"
    >
      {/* Soft themed glow along the top edge — a gradient wash fading into the
          card, matching the shadow glow on the other three sides. (The old
          2px solid strip read as a dark line over the dark background.) */}
      <LinearGradient
        colors={[accentColor + "66", accentColor + "1A", "transparent"]}
        style={s.accentGlow}
        pointerEvents="none"
      />

      {/* ── Row ── */}
      <View style={s.row}>

        {/* LEFT — affinity medallion */}
        <View style={s.medallionWrap}>
          <Image
            source={hero.affinityArtwork}
            style={s.medallion}
            contentFit="contain"
            accessibilityLabel={`${hero.affinity} affinity`}
          />
          {/* Affinity label underneath medallion */}
          <Text style={[s.affinityLabel, { color: accentColor }]}>
            {hero.affinity.toUpperCase()}
          </Text>
        </View>

        {/* CENTRE — name / profession / level + XP bar */}
        <View style={s.centre}>
          <Text style={s.heroName} numberOfLines={1}>{hero.name}</Text>
          <Text style={s.heroProfession} numberOfLines={1}>{hero.profession}</Text>

          {/* Level + short bar + sparkle tip on one row */}
          <View style={s.levelRow}>
            <Text style={[s.levelLabel, { color: accentColor }]}>Lv. {hero.level}</Text>
            <View style={s.xpTrack}>
              <View
                style={[
                  s.xpFill,
                  {
                    width: `${Math.round(xpPct * 100)}%` as any,
                    backgroundColor: accentColor,
                  },
                ]}
              />
            </View>
            <Text style={[s.barSparkle, { color: accentColor }]}>✦</Text>
          </View>
        </View>

        {/* RIGHT — XP figures + NEXT REWARD stacked, chest alongside */}
        <View style={s.right}>
          <View style={s.rightText}>
            <Text style={s.xpLine} numberOfLines={1}>
              <Text style={[s.xpFigures, { color: accentColor }]}>{xpLabel}</Text>
              {!hero.atLevelCap && <Text style={s.xpUnit}> XP</Text>}
            </Text>
            {!hero.atLevelCap && (
              <Text style={[s.nextRewardKicker, { color: accentColor }]}>
                NEXT REWARD
              </Text>
            )}
          </View>
          {!hero.atLevelCap && (
            <Image
              source={hero.nextRewardArtwork}
              style={s.chestIcon}
              contentFit="contain"
              accessibilityLabel="Next reward"
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  card: {
    backgroundColor: "rgba(8, 16, 24, 0.82)",
    borderWidth: 1.5,
    borderRadius: UI_RADIUS.xl,
    overflow: "hidden",
  },

  // Soft top glow — gradient wash replacing the old 2px solid strip
  accentGlow: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 14,
    zIndex: 1,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },

  // ── Left: medallion ──────────────────────────────────────────────────────
  medallionWrap: {
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  medallion: {
    width: 68,
    height: 68,
  },
  affinityLabel: {
    fontSize: 8,
    fontWeight: "600",
    fontFamily: SERIF,
    letterSpacing: 1.2,
  },

  // ── Centre ───────────────────────────────────────────────────────────────
  centre: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  heroName: {
    color: UI.text,        // warm ivory "#F6F0E4"
    fontSize: 17,
    fontWeight: "700",
    fontFamily: SERIF,
    letterSpacing: 0.4,
  },
  heroProfession: {
    color: UI.textDim,
    fontSize: 12,
    fontWeight: "400",
    fontFamily: SERIF,
    letterSpacing: 0.3,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  levelLabel: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: SERIF,
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  xpTrack: {
    // Short, deliberate bar (per reference) — no longer stretches to fill.
    width: 96,
    maxWidth: "55%",
    height: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    borderRadius: RADIUS.pill,
  },
  barSparkle: {
    fontSize: 9,
    opacity: 0.9,
  },

  // ── Right: XP figures + NEXT REWARD stacked beside the chest ────────────
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  rightText: {
    alignItems: "flex-end",
    gap: 2,
    // Wide enough for "000/000 XP" at fontSize 14 without truncating.
    minWidth: 84,
  },
  xpLine: {
    textAlign: "right",
  },
  xpFigures: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  xpUnit: {
    color: UI.textDim,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.6,
  },
  nextRewardKicker: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.1,
    opacity: 0.85,
  },
  chestIcon: {
    width: 40,
    height: 40,
  },
});
