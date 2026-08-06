/**
 * SanctuaryShortcutCard — standardised hero-scene shortcut card.
 *
 * Used in the Sanctuary hub's side columns.  All five shortcuts share
 * identical sizing, icon framing, badge/dot/chip slots, and touch targets.
 */
import { Image, type ImageSource } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { GLOW, TYPO, UI, UI_RADIUS } from "@/src/theme/ui";

export interface SanctuaryShortcutCardProps {
  emblem: ImageSource;
  label: string;
  onPress: () => void;
  locked?: boolean;
  /** Red badge count — renders top-right of icon frame */
  badge?: number;
  /** Green availability dot — renders bottom-right; hidden when badge is shown */
  available?: boolean;
  /** Compact pill chip below icon frame (e.g. "12 items") */
  quantity?: string | number;
  testID?: string;
}

export function SanctuaryShortcutCard({
  emblem,
  label,
  onPress,
  locked = false,
  badge,
  available = false,
  quantity,
  testID,
}: SanctuaryShortcutCardProps) {
  const hasBadge = !locked && badge !== undefined && badge > 0;
  const showDot  = !locked && available && !hasBadge;

  return (
    <Pressable
      style={[s.card, locked && s.cardLocked]}
      onPress={onPress}
      hitSlop={6}
      testID={testID}
    >
      {/* ── Icon frame ── */}
      <View style={s.iconFrame}>
        <Image
          source={emblem}
          style={s.icon}
          contentFit="contain"
        />

        {/* Label overlay at icon frame bottom */}
        <View style={s.labelOverlay}>
          <Text style={[s.label, locked && s.labelLocked]} numberOfLines={1}>
            {label.toUpperCase()}
          </Text>
        </View>

        {/* Red badge — top-right of icon frame */}
        {hasBadge && (
          <View style={s.badge}>
            <Text style={s.badgeTxt}>{(badge as number) > 9 ? "9+" : badge}</Text>
          </View>
        )}

        {/* Green availability dot — bottom-right of icon frame */}
        {showDot && <View style={s.dot} />}
      </View>

      {/* Quantity chip below icon frame */}
      {!locked && quantity !== undefined && quantity !== "" && (
        <View style={s.chip}>
          <Text style={s.chipTxt}>{quantity}</Text>
        </View>
      )}
    </Pressable>
  );
}

const CARD_W = 64;
const CARD_H = 84;

const s = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: 3,
    minHeight: 44,
  },
  cardLocked: {
    opacity: 0.5,
  },

  /* Icon frame */
  iconFrame: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: UI_RADIUS.card,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6, 9, 16, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  icon: {
    width: 56,
    height: 75,
  },

  /* Label overlay — dark scrim band pinned to frame bottom */
  labelOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 5,
    paddingHorizontal: 2,
    alignItems: "center",
    backgroundColor: "rgba(4, 7, 12, 0.82)",
  },
  label: {
    fontSize: TYPO.micro,
    fontWeight: "800",
    letterSpacing: 0.9,
    textAlign: "center",
    color: COLORS.onSurface,
  },
  labelLocked: {
    color: COLORS.onSurfaceTertiary,
  },

  /* Red notification badge — top-right */
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 4,
    backgroundColor: COLORS.error,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  /* Green availability dot — bottom-right */
  dot: {
    position: "absolute",
    bottom: 22,     // just above label band
    right: 4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.success,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },

  /* Quantity chip pill — below icon frame */
  chip: {
    backgroundColor: "rgba(232,200,104,0.18)",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(232,200,104,0.35)",
  },
  chipTxt: {
    color: UI.gold,
    fontSize: TYPO.micro,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
