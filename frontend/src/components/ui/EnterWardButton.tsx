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
import { useReducedMotion } from "@/src/hooks/useReducedMotion";
import { SERIF } from "@/src/theme/ui";

// ── Raster assets — code never re-draws these ─────────────────────────────
// v5 — layered: the hand-painted FRAME artwork (no lettering) stretches to
// whatever button size layout asks for, while the "+" medallion and the
// "ENTER THE WARD" label are rendered by code on top. This keeps the text
// crisp (never stretched with the art) and mathematically centered.
const FRAME_ART = require("../../../assets/ui-icons/hub/enter-ward-frame-v3.png");
const PLUS_ART  = require("../../../assets/ui-icons/hub/enter-ward-plus-v2.png");
// Natural proportions of the v4 full-button artwork — kept as the button's
// default aspect so existing layouts don't shift.
const ART_ASPECT = 995 / 206;

// ── Palette ────────────────────────────────────────────────────────────────
const INK        = "#071820";   // dark ink on jade (spinner)
const LABEL_INK  = "#2E5546";   // deep jade-green lettering (matches painted art)

// ── Props ─────────────────────────────────────────────────────────────────
export interface EnterWardButtonProps {
  onPress:             () => void;
  label?:              string;
  disabled?:           boolean;
  loading?:            boolean;
  style?:              ViewStyle;
  testID?:             string;
  accessibilityLabel?: string;
  /** Scale the button height relative to the artwork's natural aspect ratio.
   *  Width is unchanged; 0.75 = 75 % of natural height. Default 1. */
  heightScale?:        number;
}

export function EnterWardButton({
  onPress,
  label = "ENTER THE WARD",
  disabled = false,
  loading  = false,
  style,
  testID,
  accessibilityLabel,
  heightScale = 1,
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
        style={[s.pressable, heightScale !== 1 && { aspectRatio: ART_ASPECT / heightScale }]}
        onLayout={(e) => setBtnWidth(e.nativeEvent.layout.width)}
      >
        {/* ── Painted frame artwork (no lettering) — stretches with layout ── */}
        <Image
          source={FRAME_ART}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
          pointerEvents="none"
          accessible={false}
        />

        {/* ── Content row — medallion · label · sparkle — code-drawn so it
             stays crisp at any button height and is truly centered ── */}
        {!loading && (
          <View style={s.contentRow} pointerEvents="none">
            <Image source={PLUS_ART} style={s.medallion} contentFit="contain" accessible={false} />
            <Text style={s.sparkle}>✦</Text>
            <Text style={s.label} numberOfLines={1}>{label}</Text>
          </View>
        )}

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

        {/* ── Loading spinner — overlays the painted label while busy ── */}
        {loading && (
          <View style={s.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color={INK} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  outer: {
    // No shadow/glow here — on web a shadow around a transparent view paints
    // a rectangular box behind the painted frame. The PNG carries its own glow.
    // 90% width, centered — per design the button is slightly narrower than
    // the content column.
    width:     "90%",
    alignSelf: "center",
  },
  outerDisabled: {
    opacity: 0.42,
  },

  pressable: {
    // Button always keeps the painted art's exact proportions.
    width:           "100%",
    aspectRatio:     ART_ASPECT,
    overflow:        "hidden",
    justifyContent:  "center",
    backgroundColor: "transparent",
    // Capsule clipping — keeps shimmer/press-tint rectangles from painting
    // over the frame PNG's transparent corners.
    borderRadius:    28,
  },

  // ── Content row — centered medallion · sparkle · label ──────────────────
  contentRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap: 8,
  },
  medallion: {
    width:  30,
    height: 30,
  },
  sparkle: {
    color:    LABEL_INK,
    fontSize: 12,
    marginRight: 2,
  },
  label: {
    fontFamily:    SERIF,
    fontSize:      19,
    fontWeight:    "700",
    letterSpacing: 2.4,
    color:         LABEL_INK,
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

  // ── Loading spinner overlay (centered over the painted label) ───────────
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     "center",
    justifyContent: "center",
  },
});
