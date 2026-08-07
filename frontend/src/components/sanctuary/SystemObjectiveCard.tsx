/**
 * SystemObjectiveCard — Push 4 rebuild.
 *
 * Structure:
 *   Card (translucent dark, gold border, jade glow shadow)
 *   ├── Main row: system medallion PNG · "THE SYSTEM" · narrative · chevron/dismiss
 *   ├── Inset objective panel (margins + teal border + smoked fill + bevel)
 *   │     left ornament · flag · "OBJECTIVE" kicker · text · right sparkle
 *   └── CTA button (flush bottom)
 *
 * Props contract unchanged so index.tsx call site needs zero edits.
 */
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { RADIUS, SPACING } from "@/src/theme/colors";
import { UI, UI_RADIUS, TYPO, SERIF } from "@/src/theme/ui";
import { useReducedMotion } from "@/src/hooks/useReducedMotion";

// ── Raster assets ────────────────────────────────────────────────────────────
const SYSTEM_MEDALLION   = require("../../../assets/ui-icons/hub/system-medallion.png");
const OBJECTIVE_FLAG     = require("../../../assets/ui-icons/hub/objective-flag.png");
const ORNAMENT_LEFT      = require("../../../assets/ui-icons/hub/objective-ornament-left.png");

// ── Types ────────────────────────────────────────────────────────────────────
export interface SystemObjectiveCardProps {
  message: string;
  objective?: string;
  ctaLabel?: string;
  onPress?: () => void;
  onDismiss?: () => void;
  defaultOpen?: boolean;
  style?: ViewStyle;
  testID?: string;
}

// ── Collapse chevron ─────────────────────────────────────────────────────────
function CollapseChevron({ open }: { open: boolean }) {
  const rotAnim = useRef(new Animated.Value(open ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(rotAnim, {
      toValue: open ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const rotate = rotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Ionicons name="chevron-up" size={14} color={UI.gold} />
    </Animated.View>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export function SystemObjectiveCard({
  message,
  objective,
  ctaLabel,
  onPress,
  onDismiss,
  defaultOpen = true,
  style,
  testID,
}: SystemObjectiveCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const reduceMotion = useReducedMotion();

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    if (reduceMotion) { fade.setValue(1); rise.setValue(0); return; }
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0,  duration: 400, useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[s.card, { opacity: fade, transform: [{ translateY: rise }] }, style]}
      testID={testID ?? "system-objective-card"}
    >
      {/* ── Main row ── */}
      <View style={s.mainRow}>
        {/* System medallion — PNG replaces SVG stethoscope */}
        <ExpoImage
          source={SYSTEM_MEDALLION}
          style={s.medallion}
          contentFit="contain"
          accessible={false}
        />

        {/* Text block */}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.kicker}>THE SYSTEM</Text>
          <Text style={s.message}>{message}</Text>
        </View>

        {/* Collapse toggle */}
        <Pressable
          style={s.toggleBtn}
          onPress={() => setOpen((v) => !v)}
          hitSlop={8}
          accessibilityLabel={open ? "Collapse objective" : "Expand objective"}
        >
          <CollapseChevron open={open} />
        </Pressable>

        {/* Dismiss (optional) */}
        {onDismiss && (
          <Pressable
            style={s.dismissBtn}
            onPress={onDismiss}
            hitSlop={8}
            accessibilityLabel="Dismiss"
          >
            <Ionicons name="close" size={14} color={UI.textDim} />
          </Pressable>
        )}
      </View>

      {/* ── Inset objective panel ── */}
      {open && objective ? (
        <View style={s.insetPanel}>
          {/* Left vine/floral ornament — clipped to panel height */}
          <ExpoImage
            source={ORNAMENT_LEFT}
            style={s.ornamentLeft}
            contentFit="cover"
            contentPosition="top"
            accessible={false}
          />

          {/* Panel content — padded away from ornament */}
          <View style={s.panelContent}>
            {/* Header row: flag icon + OBJECTIVE kicker */}
            <View style={s.panelHeaderRow}>
              <ExpoImage
                source={OBJECTIVE_FLAG}
                style={s.flagIcon}
                contentFit="contain"
                accessible={false}
              />
              <Text style={s.objectiveKicker}>OBJECTIVE</Text>

              {/* Right sparkle — decorative */}
              <Text style={s.sparkle} accessible={false}>✦</Text>
            </View>

            {/* Objective text */}
            <Text style={s.objectiveTxt} numberOfLines={3}>{objective}</Text>
          </View>

          {/* Shallow bevel — top highlight edge */}
          <View style={s.insetBevelTop} pointerEvents="none" />
        </View>
      ) : null}

      {/* ── CTA button — flush with card bottom ── */}
      {ctaLabel && onPress ? (
        <Pressable
          style={s.cta}
          onPress={onPress}
          testID={testID ? `${testID}-cta` : undefined}
          accessibilityLabel={ctaLabel}
          accessibilityRole="button"
        >
          <Text style={s.ctaTxt}>{ctaLabel}</Text>
          <Ionicons name="arrow-forward" size={15} color="#082019" />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const JADE        = UI.jade;          // "#3DC4A8"
const JADE_BORDER = JADE + "55";      // ~33% opacity
const JADE_FILL   = "rgba(3,28,28,0.58)";

const s = StyleSheet.create({
  // ── Outer card ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: "rgba(13, 34, 40, 0.82)",
    borderWidth: 1.5,
    borderColor: UI.gold + "4D",
    borderRadius: UI_RADIUS.xl,
    overflow: "hidden",
    shadowColor: JADE,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  // ── Main row ────────────────────────────────────────────────────────────
  mainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    padding: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  medallion: {
    width: 44,
    height: 44,
    flexShrink: 0,
  },
  kicker: {
    color: JADE,
    fontSize: TYPO.kicker,
    fontWeight: "600",
    fontFamily: SERIF,
    letterSpacing: 1.6,
  },
  message: {
    color: UI.text,      // warm ivory — more legible than textSoft on dark card
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  toggleBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: UI.gold + "1A",
    borderWidth: 1.5,
    borderColor: UI.gold + "4D",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dismissBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // ── Inset objective panel ────────────────────────────────────────────────
  insetPanel: {
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: JADE_BORDER,
    backgroundColor: JADE_FILL,
    overflow: "hidden",
    flexDirection: "row",
    // Outer glow gives the panel depth
    shadowColor: JADE,
    shadowOpacity: 0.20,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  // Tall left ornament — pinned to left edge, full panel height
  ornamentLeft: {
    width: 22,
    // height stretches to panel height via alignSelf: stretch
    alignSelf: "stretch",
    flexShrink: 0,
    opacity: 0.85,
  },
  // Content zone — padded away from ornament
  panelContent: {
    flex: 1,
    paddingLeft: 6,
    paddingRight: 10,
    paddingTop: 9,
    paddingBottom: 9,
    gap: 5,
  },
  panelHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  flagIcon: {
    width: 18,
    height: 22,
    flexShrink: 0,
  },
  objectiveKicker: {
    color: JADE,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
    flex: 1,
  },
  sparkle: {
    color: UI.gold,
    fontSize: 10,
    opacity: 0.70,
    lineHeight: 12,
  },
  objectiveTxt: {
    color: UI.textSoft,
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 17,
  },
  // Shallow bevel — 1px semi-transparent white strip along the inside top edge
  insetBevelTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  // ── CTA button ──────────────────────────────────────────────────────────
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: JADE,
    borderRadius: 0,
    paddingVertical: SPACING.md,
  },
  ctaTxt: {
    color: "#082019",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: SERIF,
    letterSpacing: 1.0,
  },
});
