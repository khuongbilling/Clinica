import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ModeCardDef, MODE_STATUS_LABEL } from "@/src/game/modeHub";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// Illustrated donghua banner art per mode, keyed by ModeCardDef.imageKey.
// require() paths must be static string literals so Metro can bundle them.
const BANNER_IMAGES: Record<string, any> = {
  "ward-shift": require("../../assets/images/banner_ward_shift.png"),
  "ward-defense": require("../../assets/images/banner_ward_defense.png"),
  "boss-ward": require("../../assets/images/banner_boss_ward.png"),
  "lotus-journal": require("../../assets/images/banner_lotus_journal.png"),
  // Apothecary Market (Shop) hub banners
  "apothecary-market": require("../../assets/images/banner_apothecary_market.png"),
  "summoning-altar": require("../../assets/images/banner_summoning_altar.png"),
  "regalia-upgrades": require("../../assets/images/banner_regalia_upgrades.png"),
  "sanctuary-bank": require("../../assets/images/banner_sanctuary_bank.png"),
  "night-market": require("../../assets/images/banner_night_market.png"),
  // Clinica University hub banners
  "university": require("../../assets/images/banner_university.png"),
  "uni-lessons": require("../../assets/images/banner_uni_lessons.png"),
  "uni-recruit": require("../../assets/images/banner_uni_recruit.png"),
  "uni-training": require("../../assets/images/banner_uni_training.png"),
  "uni-library": require("../../assets/images/banner_uni_library.png"),
  "uni-classtree": require("../../assets/images/banner_uni_classtree.png"),
};

/** Illustrated donghua quest emblem for the Daily Quests section. */
export const QUEST_ICON = require("../../assets/images/quest_icon.png");

export function getBannerImage(imageKey?: string): any | undefined {
  return imageKey ? BANNER_IMAGES[imageKey] : undefined;
}

function StatusBadge({ status, color }: { status: ModeCardDef["status"]; color: string }) {
  const isActive = status === "active";
  const isLocked = status === "locked";
  const bg = isActive ? COLORS.success + "26" : isLocked ? "rgba(12,14,18,0.65)" : color + "30";
  const fg = isActive ? COLORS.success : isLocked ? COLORS.onSurfaceTertiary : color;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {!isActive && <Ionicons name={isLocked ? "lock-closed" : "time-outline"} size={10} color={fg} />}
      <Text style={[styles.badgeTxt, { color: fg }]}>{MODE_STATUS_LABEL[status]}</Text>
    </View>
  );
}

interface BannerCardProps {
  mode: ModeCardDef;
  onPress: () => void;
  height?: number;
  locked?: boolean;
  /** When locked, shows a level/condition unlock label in the center of the card. */
  lockLabel?: string;
  testID?: string;
}

/**
 * Rectangular, full-width mode banner used on the Ward Operations hub.
 * Shows the illustrated donghua art (or an accent gradient fallback) with a
 * darkened lower band carrying the mode title, subtitle, and status.
 */
export function BannerCard({ mode, onPress, height = 132, locked, lockLabel, testID }: BannerCardProps) {
  const art = getBannerImage(mode.imageKey);
  const dimmed = locked || mode.status === "coming_soon";
  return (
    <Pressable
      style={[styles.card, { height, borderColor: mode.accentColor + "55" }, dimmed && styles.dimmed]}
      onPress={onPress}
      testID={testID}
    >
      {art ? (
        <ExpoImage source={art} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      ) : (
        <LinearGradient
          colors={[mode.accentColor + "55", mode.accentColor + "18", COLORS.surfaceSecondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* Bottom scrim for legible text over art */}
      <LinearGradient
        colors={["rgba(8,10,14,0.05)", "rgba(8,10,14,0.55)", "rgba(8,10,14,0.92)"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top-right status badge */}
      <View style={styles.topRow}>
        <StatusBadge status={locked ? "locked" : mode.status} color={mode.accentColor} />
      </View>

      {/* Lock label — centered overlay when banner is locked with a level requirement */}
      {locked && lockLabel && (
        <View style={styles.lockLabelWrap} pointerEvents="none">
          <View style={styles.lockLabelPill}>
            <Ionicons name="lock-closed" size={11} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.lockLabelTxt}>{lockLabel}</Text>
          </View>
        </View>
      )}

      {/* Bottom content band */}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={[styles.iconChip, { borderColor: mode.accentColor + "80", backgroundColor: mode.accentColor + "2A" }]}>
            <Ionicons name={mode.icon as any} size={16} color={mode.accentColor} />
          </View>
          <Text style={styles.title} numberOfLines={1}>{mode.title}</Text>
        </View>
        <Text style={styles.subtitle} numberOfLines={2}>{mode.subtitle}</Text>
        {mode.rewardPreview && mode.status === "active" && !locked && (
          <View style={styles.rewardRow}>
            <Ionicons name="gift-outline" size={11} color={COLORS.brand} />
            <Text style={styles.rewardTxt} numberOfLines={1}>{mode.rewardPreview}</Text>
          </View>
        )}
      </View>

      {/* Enter affordance */}
      {!dimmed && (
        <View style={[styles.enterChip, { backgroundColor: mode.accentColor }]}>
          <Ionicons name="arrow-forward" size={16} color={COLORS.onBrand} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "flex-end",
  },
  dimmed: { opacity: 0.72 },
  topRow: { position: "absolute", top: SPACING.sm, right: SPACING.sm },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  lockLabelWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  lockLabelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(8,10,14,0.72)",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  lockLabelTxt: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  body: { padding: SPACING.md, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  iconChip: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 },
  subtitle: { color: "rgba(255,255,255,0.82)", fontSize: 12, lineHeight: 16, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 3 },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  rewardTxt: { color: COLORS.brand, fontSize: 11, fontWeight: "700" },
  enterChip: {
    position: "absolute", right: SPACING.md, bottom: SPACING.md,
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
  },
});
