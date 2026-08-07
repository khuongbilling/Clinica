import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { UI_RADIUS, SPACING } from "@/src/theme/ui";
import { useReducedMotion } from "@/src/hooks/useReducedMotion";

// EnterWardButton — the ceremonial "Enter the Ward" CTA for the Sanctuary hub.
// Glossy 3D jade treatment matching the approved Ink & Mist hub mockup:
// vertical jade gradient with a top gloss highlight and bottom inner shade,
// 2px gold frame with warm outer glow, sparkle corners, midpoint diamond
// ornaments, animated shimmer sweep, and pressed / disabled / loading states.

// Palette from the approved mockup spec (main-hub/Current).
const JADE_TOP = "#82D5BA";
const JADE_BOTTOM = "#55C8B7";
const GOLD = "#C7A15D";
const GOLD_BRIGHT = "#E1C27C";
const INK = "#071820";

export function EnterWardButton({
  onPress,
  label = "ENTER THE WARD",
  disabled = false,
  loading = false,
  style,
  testID,
  accessibilityLabel,
}: {
  onPress: () => void;
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const reduceMotion = useReducedMotion();
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const shimmerX   = useRef(new Animated.Value(-60)).current;
  const shimmerLoop = useRef<Animated.CompositeAnimation | null>(null);
  const [btnWidth, setBtnWidth] = useState(300);

  // ── Shimmer loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (disabled || loading || reduceMotion) {
      shimmerLoop.current?.stop();
      shimmerX.setValue(-60);
      return;
    }
    const anim = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: btnWidth + 60,
        duration: 2400,
        useNativeDriver: true,
      }),
    );
    shimmerLoop.current = anim;
    anim.start();
    return () => anim.stop();
  }, [disabled, loading, reduceMotion, btnWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pressed spring ───────────────────────────────────────────────────────
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 40,
      bounciness: 2,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 2,
    }).start();
  };

  const isBlocked = disabled || loading;

  return (
    <Animated.View
      style={[
        styles.outer,
        { transform: [{ scale: scaleAnim }] },
        isBlocked && styles.disabledOuter,
        style,
      ]}
    >
      <Pressable
        onPress={isBlocked ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isBlocked}
        testID={testID}
        style={styles.pressable}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        accessibilityState={{ disabled: isBlocked }}
      >
        {/* ── Jade gradient fill (vertical, mint → teal) ── */}
        <LinearGradient
          colors={[JADE_TOP, JADE_BOTTOM]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* ── Top gloss highlight — the "3D" sheen ── */}
        <LinearGradient
          colors={["rgba(255,255,255,0.38)", "rgba(255,255,255,0.06)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gloss}
          pointerEvents="none"
        />

        {/* ── Bottom inner shade — grounds the button ── */}
        <LinearGradient
          colors={["transparent", "rgba(7,24,32,0.28)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.innerShade}
          pointerEvents="none"
        />

        {/* ── Gold border overlay (sibling so overflow:hidden doesn't clip) ── */}
        <View style={styles.goldBorder} pointerEvents="none" />

        {/* ── Sparkle corners (decorative — hidden from screen readers) ── */}
        <Text style={[styles.sparkle, styles.sparkleTL]} pointerEvents="none" accessible={false} importantForAccessibility="no">✦</Text>
        <Text style={[styles.sparkle, styles.sparkleTR]} pointerEvents="none" accessible={false} importantForAccessibility="no">✦</Text>
        <Text style={[styles.sparkle, styles.sparkleBL]} pointerEvents="none" accessible={false} importantForAccessibility="no">✦</Text>
        <Text style={[styles.sparkle, styles.sparkleBR]} pointerEvents="none" accessible={false} importantForAccessibility="no">✦</Text>

        {/* ── Inner content row ── */}
        <View
          style={styles.row}
          onLayout={(e) => setBtnWidth(e.nativeEvent.layout.width)}
        >
          {/* Left medallion */}
          <View style={styles.medallion}>
            <Ionicons name="medical" size={15} color={INK} />
          </View>

          {/* Label / loader — flex:1 centres between the two fixed icons */}
          {loading ? (
            <View style={styles.labelSlot}>
              <ActivityIndicator size="small" color={INK} />
            </View>
          ) : (
            <Text style={styles.label} numberOfLines={1}>{label}</Text>
          )}

          {/* Right arrow */}
          <Ionicons name="arrow-forward" size={17} color={INK} />
        </View>

        {/* ── Shimmer overlay ── */}
        {!isBlocked && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shimmer,
              { transform: [{ translateX: shimmerX }] },
            ]}
          >
            <LinearGradient
              colors={["transparent", "rgba(255,255,255,0.32)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
      </Pressable>

      {/* ── Midpoint gold diamond ornaments — outside the clipped pressable,
            decorative only (hidden from screen readers) ── */}
      <Text style={[styles.diamond, styles.diamondL]} pointerEvents="none" accessible={false} importantForAccessibility="no">◆</Text>
      <Text style={[styles.diamond, styles.diamondR]} pointerEvents="none" accessible={false} importantForAccessibility="no">◆</Text>
    </Animated.View>
  );
}

const BORDER_RADIUS = UI_RADIUS.pill;

const styles = StyleSheet.create({
  outer: {
    borderRadius: BORDER_RADIUS,
    // Warm gold outer glow (mockup spec) instead of teal
    shadowColor: GOLD,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  disabledOuter: {
    opacity: 0.45,
  },
  pressable: {
    minHeight: 54,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
    justifyContent: "center",
  },
  gloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "48%",
    borderTopLeftRadius: BORDER_RADIUS,
    borderTopRightRadius: BORDER_RADIUS,
  },
  innerShade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "42%",
    borderBottomLeftRadius: BORDER_RADIUS,
    borderBottomRightRadius: BORDER_RADIUS,
  },
  goldBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS,
    borderWidth: 2,
    borderColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  sparkle: {
    position: "absolute",
    fontSize: 10,
    lineHeight: 12,
    color: GOLD_BRIGHT,
    opacity: 0.75,
  },
  sparkleTL: { top: 4,    left: 14 },
  sparkleTR: { top: 4,    right: 14 },
  sparkleBL: { bottom: 4, left: 14 },
  sparkleBR: { bottom: 4, right: 14 },
  diamond: {
    position: "absolute",
    top: "50%",
    marginTop: -8,
    fontSize: 13,
    lineHeight: 16,
    color: GOLD,
    textShadowColor: GOLD,
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  diamondL: { left: -7 },
  diamondR: { right: -7 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  medallion: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: JADE_BOTTOM,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    flexShrink: 0,
  },
  labelSlot: {
    flex: 1,
    alignItems: "center",
  },
  label: {
    flex: 1,
    textAlign: "center",
    color: INK,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.2,
    textShadowColor: "rgba(255,255,255,0.25)",
    textShadowRadius: 0,
    textShadowOffset: { width: 0, height: 1 },
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    width: 60,
    borderRadius: BORDER_RADIUS,
  },
});
