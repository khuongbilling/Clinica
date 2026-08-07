/**
 * EnterWardButton — Push 9
 *
 * The approved jade-frame artwork IS the button.
 * Code contributes:  press scale · disabled opacity · periodic shimmer · sparkle glyphs
 * Code draws nothing: gold border, jade gradient, side ornaments — all in the PNG.
 *
 * Layout (inside the Pressable):
 *   [absoluteFill] enter-ward-frame.webp  ← painted background
 *   [absoluteFill] shimmer overlay        ← single sweep, clipped by overflow:hidden
 *   [absoluteFill] press tint             ← darkens on press
 *   [row]  cross PNG  ·  ENTER THE WARD  ·  right sparkle glyph
 */
import { Image } from "expo-image";
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
import { LinearGradient } from "expo-linear-gradient";
import { SPACING, SERIF } from "@/src/theme/ui";
import { useReducedMotion } from "@/src/hooks/useReducedMotion";

// ── Raster assets — code never re-draws these ─────────────────────────────
// v2 — hand-painted assets matched to the approved Ink & Mist reference:
// luminous backlit-jade capsule with gold rim + pointed side finials, and a
// glowing emerald "+" medallion for the left icon.
const FRAME = require("../../../assets/ui-icons/hub/enter-ward-frame-v2.png");
const CROSS = require("../../../assets/ui-icons/hub/enter-ward-plus-v2.png");

// ── Palette for text + sparkles only ──────────────────────────────────────
const INK        = "#071820";   // dark ink on jade for label
const SPARKLE_C  = "#C8A84B";   // warm gold — matches frame rim tone

// ── Props ─────────────────────────────────────────────────────────────────
export interface EnterWardButtonProps {
  onPress:             () => void;
  label?:              string;
  disabled?:           boolean;
  loading?:            boolean;
  style?:              ViewStyle;
  testID?:             string;
  accessibilityLabel?: string;
}

export function EnterWardButton({
  onPress,
  label = "ENTER THE WARD",
  disabled = false,
  loading  = false,
  style,
  testID,
  accessibilityLabel,
}: EnterWardButtonProps) {
  const reduceMotion   = useReducedMotion();
  const scaleAnim      = useRef(new Animated.Value(1)).current;
  const shimmerX       = useRef(new Animated.Value(-80)).current;
  const pressOpacity   = useRef(new Animated.Value(0)).current;
  const shimmerLoop    = useRef<Animated.CompositeAnimation | null>(null);
  const [btnWidth, setBtnWidth] = useState(280);

  const isBlocked = disabled || loading;

  // ── Periodic shimmer (one soft sweep every ~5 s) ─────────────────────────
  useEffect(() => {
    shimmerLoop.current?.stop();
    shimmerX.setValue(-80);
    if (isBlocked || reduceMotion) return;

    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(4200),
        Animated.timing(shimmerX, {
          toValue:        btnWidth + 80,
          duration:       1300,
          useNativeDriver: true,
        }),
        // instant reset — invisible because it's off-screen left
        Animated.timing(shimmerX, {
          toValue:        -80,
          duration:       0,
          useNativeDriver: true,
        }),
      ]),
    );
    shimmerLoop.current = anim;
    anim.start();
    return () => anim.stop();
  }, [isBlocked, reduceMotion, btnWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Press spring ─────────────────────────────────────────────────────────
  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue:       0.97,
        useNativeDriver: true,
        speed:         50,
        bounciness:    0,
      }),
      Animated.timing(pressOpacity, {
        toValue:       1,
        duration:      80,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue:       1,
        useNativeDriver: true,
        speed:         40,
        bounciness:    3,
      }),
      Animated.timing(pressOpacity, {
        toValue:       0,
        duration:      180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Animated.View
      style={[
        s.outer,
        { transform: [{ scale: scaleAnim }] },
        isBlocked && s.outerDisabled,
        style,
      ]}
    >
      <Pressable
        onPress={isBlocked ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isBlocked}
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        accessibilityState={{ disabled: isBlocked }}
        style={s.pressable}
      >
        {/* ── Painted jade frame — artwork background ── */}
        <Image
          source={FRAME}
          style={StyleSheet.absoluteFill}
          contentFit="fill"         // frame designed to stretch to any button width
          pointerEvents="none"
          accessible={false}
        />

        {/* ── Shimmer — narrow soft highlight sweeping across jade ── */}
        {!isBlocked && (
          <Animated.View
            pointerEvents="none"
            style={[s.shimmer, { transform: [{ translateX: shimmerX }] }]}
          >
            <LinearGradient
              colors={[
                "transparent",
                "rgba(255,255,255,0.18)",
                "rgba(255,255,255,0.09)",
                "transparent",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}

        {/* ── Press darkening tint ── */}
        <Animated.View
          pointerEvents="none"
          style={[s.pressTint, { opacity: pressOpacity }]}
        />

        {/* ── Content row ── */}
        <View
          style={s.row}
          onLayout={(e) => setBtnWidth(e.nativeEvent.layout.width)}
        >
          {/* Painted jade cross — left icon */}
          <Image
            source={CROSS}
            style={s.cross}
            contentFit="contain"
            accessible={false}
          />

          {/* Label or loader */}
          {loading ? (
            <View style={s.labelSlot}>
              <ActivityIndicator size="small" color={INK} />
            </View>
          ) : (
            <Text
              style={s.label}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {label}
            </Text>
          )}

          {/* Right sparkle glyph — decorative */}
          <Text
            style={s.sparkleRight}
            accessible={false}
            importantForAccessibility="no"
          >
            ✦
          </Text>
        </View>

        {/* ── Corner sparkles (very subtle, static) ── */}
        <Text style={[s.sparkle, s.sparkleTR]}
          accessible={false} importantForAccessibility="no">✦</Text>
        <Text style={[s.sparkle, s.sparkleBL]}
          accessible={false} importantForAccessibility="no">✦</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  outer: {
    // Jade glow shadow — warm green outer bloom (not gold; the frame has gold)
    shadowColor:   "#4DA87A",
    shadowOpacity: 0.40,
    shadowRadius:  20,
    shadowOffset:  { width: 0, height: 2 },
    elevation:     6,
  },
  outerDisabled: {
    opacity: 0.42,
  },

  pressable: {
    minHeight:       56,
    overflow:        "hidden",
    justifyContent:  "center",
    backgroundColor: "transparent",
  },

  // ── Shimmer — 70px-wide soft strip ──────────────────────────────────────
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    width: 70,
  },

  // ── Press tint ───────────────────────────────────────────────────────────
  pressTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,18,10,0.20)",
  },

  // ── Content row ──────────────────────────────────────────────────────────
  row: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical:   SPACING.md,
    gap: SPACING.sm,
  },

  // Painted jade cross — small left icon
  cross: {
    width:    26,
    height:   26,
    flexShrink: 0,
  },

  labelSlot: {
    flex:        1,
    alignItems:  "center",
  },

  label: {
    flex:          1,
    textAlign:     "center",
    color:         INK,
    fontSize:      17,
    fontWeight:    "700",
    fontFamily:    SERIF,
    letterSpacing: 2.2,
    // Subtle raised-text shadow — lifts it off the jade
    textShadowColor:  "rgba(255,255,255,0.30)",
    textShadowRadius: 0,
    textShadowOffset: { width: 0, height: 1 },
  },

  sparkleRight: {
    color:      SPARKLE_C,
    fontSize:   12,
    lineHeight: 14,
    opacity:    0.65,
    flexShrink: 0,
  },

  // ── Corner sparkle glyphs (static, very subtle) ─────────────────────────
  sparkle: {
    position:   "absolute",
    color:      SPARKLE_C,
    fontSize:   9,
    lineHeight: 11,
    opacity:    0.38,
  },
  sparkleTR: { top: 5, right: 18 },
  sparkleBL: { bottom: 5, left: 18 },
});
