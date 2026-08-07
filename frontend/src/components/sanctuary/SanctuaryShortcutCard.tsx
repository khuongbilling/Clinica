/**
 * SanctuaryShortcutCard — Push 5 standardised shortcut card.
 *
 * All five hub shortcuts (Rounds / Goals / Recruit / Defense / Supplies) use
 * this component.  Uniform sizing, gold-tinted frame, jade glow shadow,
 * gradient label scrim, consistent badge + availability-dot positions.
 */
import { Image, type ImageSource } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { TYPO, UI, UI_RADIUS, SERIF } from "@/src/theme/ui";

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
  /** Overrides the default accessibilityLabel (defaults to the label prop) */
  accessibilityLabel?: string;
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
  accessibilityLabel,
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
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: locked }}
    >
      {/* ── Icon frame ── */}
      <View style={s.iconFrame}>
        {/* Illustrated emblem PNG — transparent background */}
        <Image
          source={emblem}
          style={s.icon}
          contentFit="contain"
        />

        {/* Label — gradient scrim pinned to frame bottom */}
        <LinearGradient
          colors={["transparent", "rgba(2,6,10,0.90)"]}
          style={s.labelGradient}
          pointerEvents="none"
        >
          <Text style={[s.label, locked && s.labelLocked]} numberOfLines={1}>
            {label.toUpperCase()}
          </Text>
        </LinearGradient>

        {/* Top-right bevel highlight — gives the frame depth */}
        <View style={s.bevelTop}   pointerEvents="none" />
        <View style={s.bevelLeft}  pointerEvents="none" />

        {/* Red notification badge — top-right */}
        {hasBadge && (
          <View style={s.badge}>
            <Text style={s.badgeTxt}>{(badge as number) > 9 ? "9+" : badge}</Text>
          </View>
        )}

        {/* Green availability dot — sits just above label band */}
        {showDot && <View style={s.dot} />}
      </View>

      {/* Quantity chip pill — below icon frame */}
      {!locked && quantity !== undefined && quantity !== "" && (
        <View style={s.chip}>
          <Text style={s.chipTxt}>{quantity}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* ── Dimensions ─────────────────────────────────────────────────────────── */
const CARD_W = 64;   // unchanged — fits 72px column with 4px breathing room
const CARD_H = 88;   // +4px vs Push 4 → icons feel less cramped
const ICON_W = 54;
const ICON_H = 72;

/* ── Colours ─────────────────────────────────────────────────────────────── */
const GOLD        = UI.gold;           // "#E8C868"
const JADE        = UI.jade;           // "#3DC4A8"
const FRAME_BG    = "rgba(4,10,18,0.62)";
const FRAME_BORD  = GOLD + "4A";       // ~29% gold border
const GLOW_COLOR  = JADE;

const s = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: 3,
    minHeight: 44,
  },
  cardLocked: {
    opacity: 0.45,
  },

  /* ── Icon frame ──────────────────────────────────────────────────────── */
  iconFrame: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: UI_RADIUS.card,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FRAME_BG,
    borderWidth: 1.5,
    borderColor: FRAME_BORD,
    // Jade glow shadow — matches System card and header chip language
    shadowColor: GLOW_COLOR,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  icon: {
    width: ICON_W,
    height: ICON_H,
  },

  /* ── Label — gradient scrim ──────────────────────────────────────────── */
  labelGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 14,      // gradient start height above text
    paddingBottom: 5,
    paddingHorizontal: 3,
    alignItems: "center",
  },
  label: {
    fontSize: TYPO.micro,
    fontWeight: "600",
    fontFamily: SERIF,
    letterSpacing: 0.8,
    textAlign: "center",
    color: GOLD,         // antique gold matches frame border colour
  },
  labelLocked: {
    color: COLORS.onSurfaceTertiary,
  },

  /* ── Inner bevel — top + left 1px white strip for depth ─────────────── */
  bevelTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  bevelLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  /* ── Red notification badge — top-right ─────────────────────────────── */
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
    borderColor: FRAME_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  /* ── Green availability dot — bottom-right, above label band ─────────── */
  dot: {
    position: "absolute",
    bottom: 24,       // clears the label gradient zone (≈ 19px text + 5px padding)
    right: 5,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.success,
    borderWidth: 1.5,
    borderColor: FRAME_BG,
  },

  /* ── Quantity chip pill — below icon frame ───────────────────────────── */
  chip: {
    backgroundColor: GOLD + "1E",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: GOLD + "38",
  },
  chipTxt: {
    color: GOLD,
    fontSize: TYPO.micro,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
