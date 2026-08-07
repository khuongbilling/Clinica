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
    : `${hero.currentXP} / ${hero.requiredXP}`;

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
      {/* Thin coloured accent strip along top edge */}
      <View style={[s.accentStrip, { backgroundColor: accentColor }]} />

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

          {/* Level + bar on one row */}
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
          </View>
        </View>

        {/* RIGHT — XP figures + NEXT REWARD + chest */}
        <View style={s.right}>
          <Text style={[s.xpFigures, { color: accentColor }]} numberOfLines={1}>
            {xpLabel}
          </Text>
          <Text style={s.xpUnit}>XP</Text>

          {!hero.atLevelCap && (
            <>
              <Text style={[s.nextRewardKicker, { color: accentColor }]}>
                NEXT REWARD
              </Text>
              <Image
                source={hero.nextRewardArtwork}
                style={s.chestIcon}
                contentFit="contain"
                accessibilityLabel="Next reward"
              />
            </>
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

  // 2px coloured top strip, same design language as inset panel bevel
  accentStrip: {
    height: 2,
    opacity: 0.70,
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
    fontSize: 14,
    fontWeight: "600",
    fontFamily: SERIF,
    letterSpacing: 0.3,
  },
  heroProfession: {
    color: UI.textDim,
    fontSize: 11,
    fontWeight: "400",     // body weight — not bold sans
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  levelLabel: {
    fontSize: 11,
    fontWeight: "600",     // jade progress — UI font, not display
    letterSpacing: 0.4,
    flexShrink: 0,
  },
  xpTrack: {
    flex: 1,
    height: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    borderRadius: RADIUS.pill,
  },

  // ── Right: XP + reward ───────────────────────────────────────────────────
  right: {
    alignItems: "center",
    gap: 1,
    flexShrink: 0,
    minWidth: 56,
  },
  xpFigures: {
    fontSize: 12,
    fontWeight: "600",     // readable at small size, not aggressive bold
    letterSpacing: 0.2,
  },
  xpUnit: {
    color: UI.textDim,
    fontSize: 9,
    fontWeight: "400",
    letterSpacing: 0.8,
  },
  nextRewardKicker: {
    fontSize: 7,
    fontWeight: "600",
    letterSpacing: 1.0,
    marginTop: 4,
    opacity: 0.85,
  },
  chestIcon: {
    width: 36,
    height: 36,
    marginTop: 1,
  },
});
