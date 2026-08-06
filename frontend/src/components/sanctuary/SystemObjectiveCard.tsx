/**
 * SystemObjectiveCard — collapsible jade-bordered card with stethoscope
 * SVG medallion. Replaces NarratorGuide at the main-hub call-site only.
 *
 * Matches the mockup's SystemCard.tsx design: jade border, inset teal
 * glow, "THE SYSTEM" kicker, narrative message, collapsible objective
 * strip, and CTA button.
 *
 * Props mirror the existing hub usage so the swap in index.tsx is
 * drop-in with no game-logic changes.
 */
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
import Svg, { Circle, Path } from "react-native-svg";
import { RADIUS, SPACING } from "@/src/theme/colors";
import { UI, UI_RADIUS, TYPO } from "@/src/theme/ui";
import { useReducedMotion } from "@/src/hooks/useReducedMotion";

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

// Stethoscope SVG medallion — matches the mockup's SVG shape
function StethoscopeMedallion() {
  return (
    <View style={m.medallionWrap}>
      <Svg width={22} height={22} viewBox="0 0 20 20" fill="none">
        {/* Stethoscope arch */}
        <Path
          d="M6 5Q6 3 8 3Q10 3 10 5V10Q10 13 13 13Q16 13 16 10"
          stroke={UI.jade}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
        />
        {/* Head circle */}
        <Circle cx={16} cy={8.5} r={2.2} stroke={UI.jade} strokeWidth={1.3} fill="rgba(61,196,168,0.18)" />
        {/* Ear tips */}
        <Circle cx={7} cy={4.5} r={1.1} fill={UI.jade} />
        <Circle cx={9} cy={4.5} r={1.1} fill={UI.jade} />
      </Svg>
    </View>
  );
}

// Collapse chevron — rotates 180° when collapsed
function CollapseChevron({ open }: { open: boolean }) {
  const rotAnim = useRef(new Animated.Value(open ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(rotAnim, {
      toValue: open ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [open]);
  const rotate = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Ionicons name="chevron-up" size={14} color={UI.gold} />
    </Animated.View>
  );
}

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

  // Fade-in on mount — skipped when Reduce Motion is enabled
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    if (reduceMotion) {
      fade.setValue(1);
      rise.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[
        s.card,
        { opacity: fade, transform: [{ translateY: rise }] },
        style,
      ]}
      testID={testID ?? "system-objective-card"}
    >
      {/* ── Main row: medallion · text · chevron ── */}
      <View style={s.mainRow}>
        <StethoscopeMedallion />

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
          <Pressable style={s.dismissBtn} onPress={onDismiss} hitSlop={8} accessibilityLabel="Dismiss">
            <Ionicons name="close" size={14} color={UI.textDim} />
          </Pressable>
        )}
      </View>

      {/* ── Objective strip — collapses/expands ── */}
      {open && objective ? (
        <View style={s.objectiveStrip}>
          <Ionicons name="flag" size={11} color={UI.jade} />
          <Text style={s.objectiveKicker}>OBJECTIVE</Text>
          <Text style={s.objectiveTxt} numberOfLines={2}>{objective}</Text>
        </View>
      ) : null}

      {/* ── CTA button ── */}
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

const m = StyleSheet.create({
  medallionWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0E2E26",
    borderWidth: 1.5,
    borderColor: UI.jade + "70",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    // subtle jade glow
    shadowColor: UI.jade,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
});

const s = StyleSheet.create({
  card: {
    backgroundColor: "#0D2228",
    borderWidth: 1.5,
    borderColor: UI.gold + "4D",   // ~30% gold border matching mockup
    borderRadius: UI_RADIUS.xl,
    overflow: "hidden",
    // inset jade glow approximated via shadow
    shadowColor: UI.jade,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    padding: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  kicker: {
    color: UI.jade,
    fontSize: TYPO.kicker,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  message: {
    color: UI.textSoft,
    fontSize: 12,
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
  objectiveStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingTop: 6,
    paddingBottom: 9,
    backgroundColor: "rgba(22,52,59,0.70)",
  },
  objectiveKicker: {
    color: UI.jade,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  objectiveTxt: {
    flex: 1,
    color: UI.textSoft,
    fontSize: 11,
    lineHeight: 16,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: UI.jade,
    borderRadius: 0,   // flush with card bottom edge
    paddingVertical: SPACING.md,
  },
  ctaTxt: {
    color: "#082019",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
