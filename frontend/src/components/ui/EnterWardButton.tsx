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

import { UI, UI_RADIUS, GLOW, SPACING } from "@/src/theme/ui";

// EnterWardButton — the ceremonial "Enter the Ward" CTA for the Sanctuary hub.
// Jade mint-to-teal gradient with ornate gold frame, corner flourishes, shimmer,
// and deliberate pressed / disabled / loading states.
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
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const shimmerX   = useRef(new Animated.Value(-60)).current;
  const shimmerLoop = useRef<Animated.CompositeAnimation | null>(null);
  const [btnWidth, setBtnWidth] = useState(300);

  // ── Shimmer loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (disabled || loading) {
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
  }, [disabled, loading, btnWidth]); // eslint-disable-line react-hooks/exhaustive-deps

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
        GLOW.teal,
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
        {/* ── Jade gradient fill ── */}
        <LinearGradient
          colors={["#7DE6D6", "#3DC4A8", "#2C9E88"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />

        {/* ── Gold border overlay (rendered as a sibling so overflow:hidden on
              the gradient doesn't clip it) ── */}
        <View style={styles.goldBorder} pointerEvents="none" />

        {/* ── Corner flourishes — four thin gold L-marks ── */}
        <View style={[styles.flourish, styles.flourishTL]} pointerEvents="none" />
        <View style={[styles.flourish, styles.flourishTR]} pointerEvents="none" />
        <View style={[styles.flourish, styles.flourishBL]} pointerEvents="none" />
        <View style={[styles.flourish, styles.flourishBR]} pointerEvents="none" />

        {/* ── Inner content row ── */}
        <View
          style={styles.row}
          onLayout={(e) => setBtnWidth(e.nativeEvent.layout.width)}
        >
          {/* Left medallion */}
          <View style={styles.medallion}>
            <Ionicons name="medical" size={15} color="#082019" />
          </View>

          {/* Label / loader — flex:1 centres between the two fixed icons */}
          {loading ? (
            <View style={styles.labelSlot}>
              <ActivityIndicator size="small" color="#082019" />
            </View>
          ) : (
            <Text style={styles.label} numberOfLines={1}>{label}</Text>
          )}

          {/* Right arrow */}
          <Ionicons name="arrow-forward" size={17} color="#082019" />
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
              colors={["transparent", "rgba(255,255,255,0.28)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const FLOURISH_SIZE = 6;
const BORDER_RADIUS = UI_RADIUS.pill;

const styles = StyleSheet.create({
  outer: {
    borderRadius: BORDER_RADIUS,
    // glow applied via GLOW.teal spread
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
  goldBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS,
    borderWidth: 1.5,
    borderColor: UI.gold,
    // very subtle inner glow via shadow on web / elevation on native
    shadowColor: UI.gold,
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  flourish: {
    position: "absolute",
    width: FLOURISH_SIZE,
    height: FLOURISH_SIZE,
    borderColor: UI.gold,
    borderWidth: 1,
  },
  flourishTL: { top: 6,    left: 14,  borderRightWidth: 0, borderBottomWidth: 0 },
  flourishTR: { top: 6,    right: 14, borderLeftWidth: 0,  borderBottomWidth: 0 },
  flourishBL: { bottom: 6, left: 14,  borderRightWidth: 0, borderTopWidth: 0    },
  flourishBR: { bottom: 6, right: 14, borderLeftWidth: 0,  borderTopWidth: 0    },
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
    backgroundColor: "#3DC4A8",
    alignItems: "center",
    justifyContent: "center",
    // Subtle inner shadow via border
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    flexShrink: 0,
  },
  labelSlot: {
    flex: 1,
    alignItems: "center",
  },
  label: {
    flex: 1,
    textAlign: "center",
    color: "#082019",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    width: 60,
    borderRadius: BORDER_RADIUS,
  },
});
