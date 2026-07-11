/**
 * Cue Hunt — The Fading Apprentice
 *
 * A visual patient scene where the player taps clinical clues hidden in a
 * Lotus-infirmary illustration built from pure React Native views.
 *
 * Required clues (3):   dry_lips · weak_posture · water_flask
 * Distractors (3):      window · books · scroll
 *
 * Tutorial: cueHuntIntro (forced, System-narrated). Step 1 primes the player
 * with "Before you treat, learn to see. Tap the dry lips." Step 2 blocks all
 * taps via TutorialOverlay scrim and highlights only clue_dry_lips (zIndex 9500).
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { playRewardCue } from "@/src/game/cues";
import { useTutorial, useHighlightTarget } from "@/src/game/tutorialStore";
import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ─────────────────────────────────────────────────────────────────────────────
// Zone definitions
// All positions are FRACTIONS OF scW (scene width), not percentages of scH.
// scH is always scW * SCENE_RATIO. Using a single linear unit keeps the layout
// pixel-perfect regardless of actual screen size.
// ─────────────────────────────────────────────────────────────────────────────

const SCENE_RATIO = 1.35; // scH = scW * SCENE_RATIO
const REQUIRED_COUNT = 3;

interface ZoneDef {
  id: string;
  label: string;
  feedback: string;
  isRequired: boolean;
  cx: number; // center x as fraction of scW
  cy: number; // center y as fraction of scW  (NOT scH)
  r: number;  // radius as fraction of scW
  color: string;
}

const ZONES: readonly ZoneDef[] = [
  // ── Required ─────────────────────────────────────────────────────────────
  {
    id: "clue_dry_lips",
    label: "Dry lips",
    feedback: "Cracked and pale — dehydration sign.",
    isRequired: true,
    cx: 0.500, cy: 0.375, r: 0.086,
    color: "#2DD4BF",
  },
  {
    id: "clue_weak_posture",
    label: "Weak posture",
    feedback: "Slumped shoulders — low energy, muscle weakness.",
    isRequired: true,
    cx: 0.500, cy: 0.690, r: 0.108,
    color: "#2DD4BF",
  },
  {
    id: "clue_water_flask",
    label: "Empty flask",
    feedback: "Almost empty — not been drinking enough.",
    isRequired: true,
    cx: 0.826, cy: 0.685, r: 0.078,
    color: "#D4AF37",
  },
  // ── Distractors ───────────────────────────────────────────────────────────
  {
    id: "distractor_window",
    label: "",
    feedback: "",
    isRequired: false,
    cx: 0.500, cy: 0.115, r: 0.108,
    color: "#F59E0B",
  },
  {
    id: "distractor_books",
    label: "",
    feedback: "",
    isRequired: false,
    cx: 0.125, cy: 0.740, r: 0.084,
    color: "#7C3AED",
  },
  {
    id: "distractor_scroll",
    label: "",
    feedback: "",
    isRequired: false,
    cx: 0.190, cy: 1.030, r: 0.073,
    color: "#D97706",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ClueZone — single tappable zone in the scene
// ─────────────────────────────────────────────────────────────────────────────

interface ClueZoneProps {
  zone: ZoneDef;
  scW: number;
  found: boolean;
  onCorrect: (z: ZoneDef) => void;
  onWrong: () => void;
}

function ClueZone({ zone, scW, found, onCorrect, onWrong }: ClueZoneProps) {
  const { isHighlighted, onTargetPress } = useHighlightTarget(zone.id);

  const rPx = zone.r * scW;
  const dPx = rPx * 2;
  const leftPx = zone.cx * scW - rPx;
  const topPx = zone.cy * scW - rPx; // cy is also a fraction of scW

  // Pulse ring for unfound zones
  const pulse = useRef(new Animated.Value(0)).current;
  // One-shot glow burst on found
  const burstScale = useRef(new Animated.Value(1)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;
  // Shake for wrong taps
  const shakeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (found) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [found, pulse]);

  useEffect(() => {
    if (!found) return;
    burstScale.setValue(1);
    burstOpacity.setValue(0.85);
    Animated.parallel([
      Animated.spring(burstScale, { toValue: 2.5, speed: 3, useNativeDriver: true }),
      Animated.timing(burstOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, [found, burstScale, burstOpacity]);

  const handlePress = useCallback(() => {
    if (zone.isRequired) {
      if (found) return;
      if (isHighlighted) onTargetPress();
      onCorrect(zone);
    } else {
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -8, duration: 48, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 8, duration: 48, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -5, duration: 48, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 5, duration: 48, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 48, useNativeDriver: true }),
      ]).start();
      onWrong();
    }
  }, [zone, found, isHighlighted, onTargetPress, onCorrect, onWrong, shakeX]);

  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.40] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.10] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: leftPx,
        top: topPx,
        width: dPx,
        height: dPx,
        transform: [{ translateX: shakeX }],
        zIndex: isHighlighted ? 9500 : 1,
      }}
    >
      {/* Glow burst — runs once on found */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: dPx, height: dPx, borderRadius: rPx,
          borderWidth: 2.5, borderColor: zone.color,
          transform: [{ scale: burstScale }],
          opacity: burstOpacity,
        }}
      />

      {/* Tutorial highlight aura — shown when this zone is the forced target */}
      {isHighlighted && !found && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: dPx + 16, height: dPx + 16,
            left: -8, top: -8,
            borderRadius: rPx + 8,
            borderWidth: 2.5, borderColor: "#2DD4BF",
            backgroundColor: "#2DD4BF14",
            shadowColor: "#2DD4BF",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.95,
            shadowRadius: 16,
          }}
        />
      )}

      {/* Pulsing ring — unfound, not highlighted */}
      {!found && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: dPx, height: dPx, borderRadius: rPx,
            borderWidth: isHighlighted ? 2.5 : 1.5,
            borderColor: isHighlighted ? "#2DD4BF" : zone.color,
            opacity: isHighlighted ? 0.88 : pulseOpacity,
            transform: [{ scale: isHighlighted ? 1.08 : pulseScale }],
          }}
        />
      )}

      {/* Solid ring + checkmark — found state */}
      {found && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: dPx, height: dPx, borderRadius: rPx,
            borderWidth: 2.5, borderColor: zone.color,
            backgroundColor: zone.color + "22",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="checkmark" size={dPx * 0.38} color={zone.color} />
        </View>
      )}

      {/* Hit area — transparent Pressable over the full zone */}
      <Pressable
        style={{
          position: "absolute",
          width: dPx, height: dPx, borderRadius: rPx,
        }}
        onPress={handlePress}
        testID={`zone-${zone.id}`}
      />

      {/* Label badge below the zone, visible when found */}
      {found && !!zone.label && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: dPx + 5,
            alignSelf: "center",
            backgroundColor: zone.color + "22",
            borderRadius: RADIUS.pill,
            borderWidth: 1, borderColor: zone.color + "55",
            paddingHorizontal: 7, paddingVertical: 3,
          }}
        >
          <Text
            style={{ color: zone.color, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}
          >
            {zone.label}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InfirmaryScene — the full visual room layout
// scW is the actual scene container width (in pixels). All positions use scW
// as the base unit. scH is implicit (= scW * SCENE_RATIO).
// ─────────────────────────────────────────────────────────────────────────────

interface SceneProps {
  scW: number;
  found: Set<string>;
  onCorrect: (z: ZoneDef) => void;
  onWrong: () => void;
}

function InfirmaryScene({ scW, found, onCorrect, onWrong }: SceneProps) {
  const U = scW; // base unit shorthand

  return (
    <View style={{ width: U, height: U * SCENE_RATIO, overflow: "hidden" }}>

      {/* ══════════════════════════════════════════════════════════════
          LAYER 1 · DEEP ROOM BACKGROUND
          Donghua atmosphere: base dark is not flat but has a painterly
          warm-centre / cool-edge temperature story. Lanterns heat the
          left and right walls with amber; moon casts silver-blue down
          the centre column; teal lotus magic pools near the floor.
      ══════════════════════════════════════════════════════════════ */}
      {/* Base deep-night gradient */}
      <LinearGradient
        colors={["#0A1810", "#111D14", "#0C1710", "#070C08"]}
        locations={[0, 0.28, 0.68, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Warm lantern side-wash — amber heat from both walls */}
      <LinearGradient
        colors={["#C8781018", "transparent", "#C8781018"]}
        start={{ x: 0, y: 0.44 }}
        end={{ x: 1, y: 0.44 }}
        style={{ position: "absolute", left: 0, top: 0, right: 0, height: U * SCENE_RATIO }}
      />
      {/* Cool moonlight column down centre — silver-blue from window */}
      <LinearGradient
        colors={["#8AB8CC1C", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: "absolute",
          left: U * 0.310, top: 0, width: U * 0.380, height: U * 0.640,
        }}
      />
      {/* Teal lotus-magic floor ambience — faint glow near patient */}
      <LinearGradient
        colors={["transparent", "#2DD4BF0A"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: "absolute",
          left: U * 0.220, top: U * 0.600, width: U * 0.560, height: U * 0.450,
          borderRadius: U * 0.225,
        }}
      />

      {/* ══════════════════════════════════════════════════════════════
          LAYER 2 · WALL STONE TEXTURE
          Horizontal mortar courses and faint vertical pillar marks give
          the back wall the feel of dressed stone or plastered brick.
          Slightly stronger lines for painterly depth.
      ══════════════════════════════════════════════════════════════ */}
      {/* Stone course (mortar) lines */}
      {[0.18, 0.36, 0.54, 0.70, 0.86].map((y, i) => (
        <View key={`sc${i}`} style={{
          position: "absolute",
          left: 0, top: U * y, right: 0, height: 1,
          backgroundColor: "#2DD4BF0D",
        }} />
      ))}
      {/* Vertical pillar grooves */}
      {[0.25, 0.50, 0.75].map((x, i) => (
        <View key={`vp${i}`} style={{
          position: "absolute",
          left: U * x, top: 0, width: 1,
          height: U * 0.92,
          backgroundColor: "#FFFFFF07",
        }} />
      ))}
      {/* Wainscoting: lower wall panel, subtly darker */}
      <View style={{
        position: "absolute",
        left: 0, top: U * 0.820, right: 0,
        height: U * (SCENE_RATIO - 0.820),
        backgroundColor: "#060C07",
      }} />
      {/* Wainscoting gold trim rail — more visible, fantasy-medical gilt */}
      <View style={{
        position: "absolute",
        left: 0, top: U * 0.820, right: 0, height: 2.5,
        backgroundColor: "#D4AF3740",
      }} />
      {/* Wainscoting inner shadow rail */}
      <View style={{
        position: "absolute",
        left: U * 0.048, top: U * 0.827, right: U * 0.048, height: 1,
        backgroundColor: "#D4AF3720",
      }} />

      {/* ══════════════════════════════════════════════════════════════
          LAYER 3 · CEILING ZONE + BEAM
          The ceiling is pitched dark with two carved beams from which
          the hanging lanterns are suspended.
      ══════════════════════════════════════════════════════════════ */}
      {/* Dark ceiling gradient */}
      <LinearGradient
        colors={["#030806", "#0D1F16"]}
        style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: U * 0.115,
        }}
      />
      {/* Main ceiling beam (horizontal dark band) */}
      <View style={{
        position: "absolute",
        left: 0, top: U * 0.095, right: 0, height: U * 0.032,
        backgroundColor: "#182818",
        borderBottomWidth: 1.5, borderBottomColor: "#2DD4BF10",
      }} />
      {/* Beam wood-grain marks */}
      {[0.18, 0.38, 0.60, 0.80].map((x, i) => (
        <View key={`bm${i}`} style={{
          position: "absolute",
          left: U * x, top: U * 0.095,
          width: 1, height: U * 0.032,
          backgroundColor: "#000000",
          opacity: 0.18,
        }} />
      ))}

      {/* ══════════════════════════════════════════════════════════════
          LAYER 4 · WINDOW ARCH — moonlit Lotus arch with silver-blue cast
          Donghua: moonlight is cooler/silver-blue, distinct from warm amber
          lanterns. Light rays are visible shafts of lunar silver.
      ══════════════════════════════════════════════════════════════ */}
      {/* Broad cool lunar bloom behind arch — silver-blue, not amber */}
      <LinearGradient
        colors={["#B0C8E040", "#9AB8D028", "transparent"]}
        style={{
          position: "absolute", top: -U * 0.02,
          left: U * 0.220, width: U * 0.560,
          height: U * 0.460,
        }}
      />
      {/* Secondary warm highlight near top of arch (candle glow from inside) */}
      <LinearGradient
        colors={["#D4AF3420", "transparent"]}
        style={{
          position: "absolute", top: 0,
          left: U * 0.310, width: U * 0.380,
          height: U * 0.200,
        }}
      />
      {/* Outer arch molding — ornate gilt frame */}
      <View style={{
        position: "absolute",
        left: U * 0.328, top: 0,
        width: U * 0.344, height: U * 0.272,
        borderTopLeftRadius: U * 0.172,
        borderTopRightRadius: U * 0.172,
        borderWidth: 2.5, borderBottomWidth: 0,
        borderColor: "#D4AF3752",
      }} />
      {/* Arch outer-outer faint halo ring */}
      <View style={{
        position: "absolute",
        left: U * 0.316, top: 0,
        width: U * 0.368, height: U * 0.284,
        borderTopLeftRadius: U * 0.184,
        borderTopRightRadius: U * 0.184,
        borderWidth: 1, borderBottomWidth: 0,
        borderColor: "#D4AF3720",
      }} />
      {/* Inner arch glass area — silver-blue lunar glass */}
      <View style={{
        position: "absolute",
        left: U * 0.346, top: 0,
        width: U * 0.308, height: U * 0.250,
        borderTopLeftRadius: U * 0.154,
        borderTopRightRadius: U * 0.154,
        overflow: "hidden",
      }}>
        <LinearGradient
          colors={["#B8D0E848", "#A8C4DC28", "#8AB0C810"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Vertical center bar */}
        <View style={{
          position: "absolute", bottom: 0,
          left: "50%", width: 1.5, height: "62%",
          backgroundColor: "#D4AF3738",
          transform: [{ translateX: -0.75 }],
        }} />
        {/* Horizontal cross bar */}
        <View style={{
          position: "absolute", top: "40%",
          left: 0, right: 0, height: 1.5,
          backgroundColor: "#D4AF3730",
        }} />
        {/* Moonlight ray — left shaft, silver-blue */}
        <View style={{
          position: "absolute", top: "5%", left: "20%",
          width: U * 0.044, height: U * 0.260,
          backgroundColor: "#C8DCF014",
          transform: [{ rotate: "-12deg" }, { translateX: -U * 0.022 }],
        }} />
        {/* Moonlight ray — right shaft */}
        <View style={{
          position: "absolute", top: "5%", left: "60%",
          width: U * 0.038, height: U * 0.260,
          backgroundColor: "#C8DCF012",
          transform: [{ rotate: "15deg" }, { translateX: -U * 0.019 }],
        }} />
        {/* Centre bright spot — moon face in glass */}
        <View style={{
          position: "absolute", top: "10%", left: "35%",
          width: "30%", height: "25%",
          borderRadius: 100,
          backgroundColor: "#D0E4F820",
        }} />
      </View>
      {/* Flanking pillar lines — gilt edges */}
      <View style={{
        position: "absolute", top: 0,
        left: U * 0.272, width: 2.5, height: U * 0.295,
        backgroundColor: "#D4AF3728",
      }} />
      <View style={{
        position: "absolute", top: 0,
        left: U * (1 - 0.272) - 2, width: 2.5, height: U * 0.295,
        backgroundColor: "#D4AF3728",
      }} />
      {/* Moonlight wall-wash below arch — cool silver-blue cast on stone */}
      <LinearGradient
        colors={["#9AB8CC18", "transparent"]}
        style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: U * 0.420,
        }}
      />

      {/* ══════════════════════════════════════════════════════════════
          LAYER 5 · LOTUS SIGIL — carved & glowing on back wall
          Clinica's medical-magical emblem. Donghua: magical sigils glow
          softly with inner light. Three rings: outer bloom, main disc,
          inner detail. Petals have visible luminous teal fill.
      ══════════════════════════════════════════════════════════════ */}
      {/* Outermost soft glow bloom — large radius, barely-there */}
      <View style={{
        position: "absolute",
        left: U * 0.406, top: U * 0.267,
        width: U * 0.188, height: U * 0.188,
        borderRadius: U * 0.094,
        backgroundColor: "#2DD4BF0E",
      }} />
      {/* Disc backing — brighter, feels inlaid */}
      <View style={{
        position: "absolute",
        left: U * 0.437, top: U * 0.298,
        width: U * 0.126, height: U * 0.126,
        borderRadius: U * 0.063,
        borderWidth: 1.5, borderColor: "#2DD4BF30",
        backgroundColor: "#2DD4BF14",
      }} />
      {/* Mid ring */}
      <View style={{
        position: "absolute",
        left: U * 0.455, top: U * 0.316,
        width: U * 0.090, height: U * 0.090,
        borderRadius: U * 0.045,
        borderWidth: 1, borderColor: "#2DD4BF22",
      }} />
      {/* Inner ring */}
      <View style={{
        position: "absolute",
        left: U * 0.468, top: U * 0.329,
        width: U * 0.064, height: U * 0.064,
        borderRadius: U * 0.032,
        borderWidth: 1, borderColor: "#2DD4BF28",
        backgroundColor: "#2DD4BF08",
      }} />
      {/* Six lotus petals — luminous teal fill */}
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <View key={`lp${i}`} pointerEvents="none" style={{
            position: "absolute",
            left: U * 0.490 + Math.cos(rad) * U * 0.040 - U * 0.010,
            top: U * 0.361 + Math.sin(rad) * U * 0.040 - U * 0.018,
            width: U * 0.020, height: U * 0.036,
            borderRadius: U * 0.010,
            borderWidth: 1, borderColor: "#2DD4BF28",
            backgroundColor: "#2DD4BF10",
            transform: [{ rotate: `${deg}deg` }],
          }} />
        );
      })}

      {/* ══════════════════════════════════════════════════════════════
          LAYER 6 · LEFT HANGING LANTERN
          Donghua: lanterns are prominent luminous light sources, not just
          props. Large outer bloom + brighter inner corona + visible flame.
          The light pools on wall and floor beneath to sell the 3D space.
      ══════════════════════════════════════════════════════════════ */}
      {/* Outer warm bloom — large soft amber cloud on wall */}
      <View style={{
        position: "absolute",
        left: -U * 0.070, top: U * 0.040,
        width: U * 0.340, height: U * 0.520,
        borderRadius: U * 0.170,
        backgroundColor: "#E8A42018",
      }} />
      {/* Inner corona — brighter, tighter around lantern body */}
      <View style={{
        position: "absolute",
        left: U * 0.004, top: U * 0.120,
        width: U * 0.170, height: U * 0.300,
        borderRadius: U * 0.085,
        backgroundColor: "#E8A42028",
      }} />
      {/* Wall amber wash — lantern casts on stone beside it */}
      <LinearGradient
        colors={["#C87010", "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          position: "absolute",
          left: 0, top: U * 0.140, width: U * 0.180, height: U * 0.200,
          borderRadius: U * 0.090, opacity: 0.08,
        }}
      />
      {/* Bracket arm (horizontal, from wall) */}
      <View style={{
        position: "absolute",
        left: 0, top: U * 0.108,
        width: U * 0.075, height: U * 0.015,
        backgroundColor: "#283C2A", borderRadius: 3,
      }} />
      {/* Chain (vertical) */}
      <View style={{
        position: "absolute",
        left: U * 0.066, top: U * 0.122,
        width: 2, height: U * 0.062,
        backgroundColor: "#3A4E3C",
      }} />
      {/* Lantern top cap */}
      <View style={{
        position: "absolute",
        left: U * 0.042, top: U * 0.183,
        width: U * 0.050, height: U * 0.014,
        backgroundColor: "#283C2A", borderRadius: 3,
      }} />
      {/* Lantern body */}
      <View style={{
        position: "absolute",
        left: U * 0.040, top: U * 0.196,
        width: U * 0.054, height: U * 0.074,
        borderRadius: 5,
        backgroundColor: "#1C2C1E",
        borderWidth: 1.5, borderColor: "#E8A42048",
        overflow: "hidden",
      }}>
        <LinearGradient
          colors={["#E8A42028", "#E8A42014"]}
          style={StyleSheet.absoluteFillObject}
        />
        {[0.28, 0.56, 0.82].map((y, i) => (
          <View key={i} style={{
            position: "absolute",
            left: 0, top: `${y * 100}%`, right: 0, height: 1,
            backgroundColor: "#E8A42025",
          }} />
        ))}
      </View>
      {/* Lantern bottom cap */}
      <View style={{
        position: "absolute",
        left: U * 0.042, top: U * 0.268,
        width: U * 0.050, height: U * 0.014,
        backgroundColor: "#283C2A", borderRadius: 3,
      }} />
      {/* Flame glow — outer halo */}
      <View style={{
        position: "absolute",
        left: U * 0.046, top: U * 0.212,
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: "#FFD06018",
      }} />
      {/* Flame glow — inner bright */}
      <View style={{
        position: "absolute",
        left: U * 0.059, top: U * 0.225,
        width: 9, height: 9, borderRadius: 4.5,
        backgroundColor: "#FFE08068",
      }} />
      {/* Floor light pool (left) — broad amber spill */}
      <LinearGradient
        colors={["#E8A42030", "transparent"]}
        style={{
          position: "absolute",
          left: 0, top: U * 0.700,
          width: U * 0.320, height: U * 0.380,
          borderRadius: U * 0.160,
        }}
      />
      {/* Wall light wash (left, descending from lantern) */}
      <LinearGradient
        colors={["#D08018", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: "absolute",
          left: 0, top: U * 0.260, width: U * 0.200, height: U * 0.400,
          opacity: 0.06,
        }}
      />

      {/* ══════════════════════════════════════════════════════════════
          LAYER 7 · RIGHT HANGING LANTERN (mirror of left)
          Same luminous treatment: outer bloom + inner corona + visible flame.
      ══════════════════════════════════════════════════════════════ */}
      {/* Outer warm bloom — right side */}
      <View style={{
        position: "absolute",
        left: U * 0.730, top: U * 0.040,
        width: U * 0.340, height: U * 0.520,
        borderRadius: U * 0.170,
        backgroundColor: "#E8A42018",
      }} />
      {/* Inner corona — right */}
      <View style={{
        position: "absolute",
        left: U * 0.826, top: U * 0.120,
        width: U * 0.170, height: U * 0.300,
        borderRadius: U * 0.085,
        backgroundColor: "#E8A42028",
      }} />
      {/* Wall amber wash — right lantern on stone */}
      <LinearGradient
        colors={["transparent", "#C87010"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          position: "absolute",
          left: U * 0.820, top: U * 0.140, width: U * 0.180, height: U * 0.200,
          borderRadius: U * 0.090, opacity: 0.08,
        }}
      />
      {/* Bracket arm */}
      <View style={{
        position: "absolute",
        left: U * 0.925, top: U * 0.108,
        width: U * 0.075, height: U * 0.015,
        backgroundColor: "#283C2A", borderRadius: 3,
      }} />
      {/* Chain */}
      <View style={{
        position: "absolute",
        left: U * 0.932, top: U * 0.122,
        width: 2, height: U * 0.062,
        backgroundColor: "#3A4E3C",
      }} />
      {/* Lantern top cap */}
      <View style={{
        position: "absolute",
        left: U * 0.908, top: U * 0.183,
        width: U * 0.050, height: U * 0.014,
        backgroundColor: "#283C2A", borderRadius: 3,
      }} />
      {/* Lantern body */}
      <View style={{
        position: "absolute",
        left: U * 0.906, top: U * 0.196,
        width: U * 0.054, height: U * 0.074,
        borderRadius: 5,
        backgroundColor: "#1C2C1E",
        borderWidth: 1.5, borderColor: "#E8A42048",
        overflow: "hidden",
      }}>
        <LinearGradient
          colors={["#E8A42028", "#E8A42014"]}
          style={StyleSheet.absoluteFillObject}
        />
        {[0.28, 0.56, 0.82].map((y, i) => (
          <View key={i} style={{
            position: "absolute",
            left: 0, top: `${y * 100}%`, right: 0, height: 1,
            backgroundColor: "#E8A42025",
          }} />
        ))}
      </View>
      {/* Lantern bottom cap */}
      <View style={{
        position: "absolute",
        left: U * 0.908, top: U * 0.268,
        width: U * 0.050, height: U * 0.014,
        backgroundColor: "#283C2A", borderRadius: 3,
      }} />
      {/* Flame glow — outer halo (right) */}
      <View style={{
        position: "absolute",
        left: U * 0.912, top: U * 0.212,
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: "#FFD06018",
      }} />
      {/* Flame glow — inner bright (right) */}
      <View style={{
        position: "absolute",
        left: U * 0.925, top: U * 0.225,
        width: 9, height: 9, borderRadius: 4.5,
        backgroundColor: "#FFE08068",
      }} />
      {/* Floor light pool (right) — broad amber spill */}
      <LinearGradient
        colors={["#E8A42030", "transparent"]}
        style={{
          position: "absolute",
          left: U * 0.680, top: U * 0.700,
          width: U * 0.320, height: U * 0.380,
          borderRadius: U * 0.160,
        }}
      />
      {/* Wall light wash (right, descending) */}
      <LinearGradient
        colors={["transparent", "#D08018"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: "absolute",
          left: U * 0.800, top: U * 0.260, width: U * 0.200, height: U * 0.400,
          opacity: 0.06,
        }}
      />

      {/* ══════════════════════════════════════════════════════════════
          LAYER 8 · FLOOR — stone tiles
      ══════════════════════════════════════════════════════════════ */}
      <View style={{
        position: "absolute",
        top: U * 0.970, left: 0, right: 0,
        height: U * (SCENE_RATIO - 0.970),
        backgroundColor: "#060C07",
      }} />
      <View style={{
        position: "absolute",
        top: U * 0.970, left: 0, right: 0, height: 1.5,
        backgroundColor: "#2DD4BF12",
      }} />
      {/* Tile grid lines on floor */}
      {[0.25, 0.50, 0.75].map((x, i) => (
        <View key={`tg${i}`} style={{
          position: "absolute",
          left: U * x, top: U * 0.970, width: 1,
          height: U * (SCENE_RATIO - 0.970),
          backgroundColor: "#FFFFFF04",
        }} />
      ))}

      {/* ══════════════════════════════════════════════════════════════
          LAYER 9 · INFIRMARY BED — raised cot with carved headboard
          The patient sits propped against the headboard. All bed elements
          render BEFORE the patient figure so the figure appears in front.
      ══════════════════════════════════════════════════════════════ */}
      {/* Raised platform base (dark lacquered wood) */}
      <View style={{
        position: "absolute",
        left: U * 0.172, top: U * 0.960,
        width: U * 0.656, height: U * 0.040,
        backgroundColor: "#192818", borderRadius: 4,
        borderTopWidth: 2, borderTopColor: "#253C26",
      }} />
      {/* Platform highlight edge */}
      <View style={{
        position: "absolute",
        left: U * 0.172, top: U * 0.960,
        width: U * 0.656, height: 2,
        backgroundColor: "#D4AF3718",
      }} />

      {/* Mattress / futon body — dark aged linen, lantern-lit */}
      <View style={{
        position: "absolute",
        left: U * 0.194, top: U * 0.468,
        width: U * 0.612, height: U * 0.496,
        borderRadius: 9,
        overflow: "hidden",
      }}>
        <LinearGradient
          colors={["#2A4840", "#1E3830"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Horizontal sheet creases */}
        <View style={{
          position: "absolute",
          left: 0, top: "30%", right: 0, height: 1,
          backgroundColor: "#2DD4BF18",
        }} />
        <View style={{
          position: "absolute",
          left: 0, top: "65%", right: 0, height: 1,
          backgroundColor: "#2DD4BF10",
        }} />
      </View>
      {/* Mattress teal trim border (top edge) */}
      <View style={{
        position: "absolute",
        left: U * 0.194, top: U * 0.468,
        width: U * 0.612, height: 3,
        backgroundColor: "#2DD4BF30", borderRadius: 3,
      }} />

      {/* Lower blanket / coverlet over legs — deep teal */}
      <View style={{
        position: "absolute",
        left: U * 0.218, top: U * 0.886,
        width: U * 0.564, height: U * 0.076,
        borderRadius: 7,
        overflow: "hidden",
        borderWidth: 1, borderColor: "#2DD4BF35",
      }}>
        <LinearGradient
          colors={["#1E5048", "#143C36"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Blanket fold line */}
        <View style={{
          position: "absolute",
          left: 0, top: "48%", right: 0, height: 1.5,
          backgroundColor: "#2DD4BF20",
        }} />
      </View>

      {/* Headboard — carved dark wood behind patient head/shoulders */}
      {/* Main back panel */}
      <View style={{
        position: "absolute",
        left: U * 0.200, top: U * 0.180,
        width: U * 0.600, height: U * 0.295,
        borderRadius: 7,
        backgroundColor: "#14221A",
        borderWidth: 1.5, borderColor: "#263A28",
      }} />
      {/* Arched decorative top */}
      <View style={{
        position: "absolute",
        left: U * 0.308, top: U * 0.152,
        width: U * 0.384, height: U * 0.122,
        borderTopLeftRadius: U * 0.192,
        borderTopRightRadius: U * 0.192,
        backgroundColor: "#162018",
        borderWidth: 1.5, borderColor: "#263A28",
      }} />
      {/* Headboard inlay — lotus roundel */}
      <View style={{
        position: "absolute",
        left: U * 0.458, top: U * 0.168,
        width: U * 0.084, height: U * 0.084,
        borderRadius: U * 0.042,
        borderWidth: 1.5, borderColor: "#D4AF3728",
        backgroundColor: "#D4AF3710",
      }} />
      <View style={{
        position: "absolute",
        left: U * 0.474, top: U * 0.184,
        width: U * 0.052, height: U * 0.052,
        borderRadius: U * 0.026,
        borderWidth: 1, borderColor: "#D4AF3720",
      }} />
      {/* Left bed post */}
      <View style={{
        position: "absolute",
        left: U * 0.192, top: U * 0.180,
        width: U * 0.022, height: U * 0.800,
        backgroundColor: "#162018",
        borderRadius: 4,
        borderWidth: 1, borderColor: "#263A28",
      }} />
      {/* Right bed post */}
      <View style={{
        position: "absolute",
        left: U * 0.786, top: U * 0.180,
        width: U * 0.022, height: U * 0.800,
        backgroundColor: "#162018",
        borderRadius: 4,
        borderWidth: 1, borderColor: "#263A28",
      }} />

      {/* ── Headboard clinical rune marks — Lotus diagnostic glyphs ──
          Fantasy-medical: the academy beds have Lotus-script glyphs carved
          into the headboard for vital monitoring. Three short horizontal
          bars each side, very faint teal, feel like carved inlay.         */}
      <View pointerEvents="none" style={{ position: "absolute", left: U * 0.224, top: U * 0.328, width: U * 0.052, height: 1.5, backgroundColor: "#2DD4BF22" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: U * 0.232, top: U * 0.336, width: U * 0.036, height: 1.5, backgroundColor: "#2DD4BF18" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: U * 0.228, top: U * 0.344, width: U * 0.044, height: 1.5, backgroundColor: "#2DD4BF14" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: U * 0.724, top: U * 0.328, width: U * 0.052, height: 1.5, backgroundColor: "#2DD4BF22" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: U * 0.732, top: U * 0.336, width: U * 0.036, height: 1.5, backgroundColor: "#2DD4BF18" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: U * 0.728, top: U * 0.344, width: U * 0.044, height: 1.5, backgroundColor: "#2DD4BF14" }} />

      {/* ── Patient notes scroll — pinned to headboard ── */}
      <View style={{
        position: "absolute",
        left: U * 0.582, top: U * 0.200,
        width: U * 0.096, height: U * 0.118,
        backgroundColor: "#C8B462",
        borderRadius: 3,
        borderWidth: 1, borderColor: "#A09040",
        overflow: "hidden",
      }}>
        {/* Parchment header bar */}
        <View style={{
          position: "absolute",
          left: 0, top: 0, right: 0, height: U * 0.016,
          backgroundColor: "#9A8035",
          opacity: 0.40,
        }} />
        {/* Simulated text lines */}
        {[0.26, 0.40, 0.54, 0.68, 0.82].map((y, i) => (
          <View key={i} style={{
            position: "absolute",
            left: U * 0.008, top: `${y * 100}%`,
            right: U * 0.008, height: 1.5,
            backgroundColor: "#6A4A18",
            borderRadius: 1, opacity: 0.45,
          }} />
        ))}
      </View>

      {/* ══════════════════════════════════════════════════════════════
          LAYER 10 · PILLOW — behind the patient's head (dark sage linen)
      ══════════════════════════════════════════════════════════════ */}
      <View style={{
        position: "absolute",
        left: U * 0.326, top: U * 0.262,
        width: U * 0.348, height: U * 0.096,
        borderRadius: U * 0.048,
        overflow: "hidden",
        borderWidth: 1, borderColor: "#2DD4BF20",
      }}>
        <LinearGradient
          colors={["#2E5048", "#224038"]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Pillow teal trim stitching */}
        <View style={{
          position: "absolute",
          left: 6, top: 5, right: 6, bottom: 5,
          borderRadius: U * 0.046,
          borderWidth: 1, borderColor: "#2DD4BF28",
        }} />
      </View>

      {/* ══════════════════════════════════════════════════════════════
          LAYER 11 · BOOK STACK (left wall) — 4 volumes with colored spines
          Distractor zone: cx=0.125, cy=0.740, r=0.084
      ══════════════════════════════════════════════════════════════ */}
      {([
        { dy: 0.000, w: 0.112, c: "#2C4228", acc: "#7A5A28" },
        { dy: 0.050, w: 0.092, c: "#1A2E1A", acc: "#4A7038" },
        { dy: 0.100, w: 0.132, c: "#3A5030", acc: "#8A6832" },
        { dy: 0.150, w: 0.098, c: "#1E3420", acc: "#557040" },
      ] as const).map((b, i) => (
        <View key={i} style={{
          position: "absolute",
          left: U * 0.026, top: U * 0.692 + U * b.dy,
          width: U * b.w, height: U * 0.044,
          backgroundColor: b.c, borderRadius: 2,
          borderRightWidth: 1.5, borderRightColor: "#FFFFFF10",
          borderTopWidth: 1, borderTopColor: "#FFFFFF06",
        }}>
          {/* Spine colour accent */}
          <View style={{
            position: "absolute",
            left: 0, top: 0, width: 3, height: "100%",
            backgroundColor: b.acc, opacity: 0.65, borderRadius: 1,
          }} />
        </View>
      ))}
      {/* Gold accent vertical stripe across spine edges */}
      <View style={{
        position: "absolute",
        left: U * 0.026, top: U * 0.692,
        width: 2, height: U * 0.194,
        backgroundColor: "#D4AF3728",
      }} />

      {/* ══════════════════════════════════════════════════════════════
          LAYER 12 · SCROLL ON FLOOR (left)
          Distractor zone: cx=0.190, cy=1.030, r=0.073
      ══════════════════════════════════════════════════════════════ */}
      <View style={{
        position: "absolute",
        left: U * 0.147, top: U * 0.972,
        width: U * 0.086, height: U * 0.148,
        borderRadius: U * 0.043,
        backgroundColor: "#A08048",
        borderWidth: 1.5, borderColor: "#C0A05840",
        overflow: "hidden",
      }}>
        {/* End caps */}
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: U * 0.022, backgroundColor: "#7A6030",
          borderRadius: U * 0.043,
        }} />
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: U * 0.022, backgroundColor: "#7A6030",
          borderRadius: U * 0.043,
        }} />
        {/* Text line hints */}
        {[0.38, 0.55].map((y, i) => (
          <View key={i} style={{
            position: "absolute",
            left: U * 0.010, top: `${y * 100}%`,
            right: U * 0.010, height: 1.5,
            backgroundColor: "#6A4A1830", borderRadius: 1,
          }} />
        ))}
      </View>

      {/* ══════════════════════════════════════════════════════════════
          LAYER 13 · SIDE TABLE (right) — more detailed
      ══════════════════════════════════════════════════════════════ */}
      {/* Table surface */}
      <View style={{
        position: "absolute",
        left: U * 0.698, top: U * 0.842,
        width: U * 0.244, height: U * 0.028,
        backgroundColor: "#223028", borderRadius: 4,
        borderTopWidth: 1.5, borderTopColor: "#384E3A",
      }} />
      {/* Table leg */}
      <View style={{
        position: "absolute",
        left: U * 0.800, top: U * 0.868,
        width: U * 0.044, height: U * 0.100,
        backgroundColor: "#1A2620", borderRadius: 3,
      }} />
      {/* Bottom stretcher bar */}
      <View style={{
        position: "absolute",
        left: U * 0.706, top: U * 0.952,
        width: U * 0.228, height: U * 0.010,
        backgroundColor: "#1A2620", borderRadius: 2,
      }} />

      {/* ══════════════════════════════════════════════════════════════
          LAYER 14 · SMALL VIALS + HERBS ON TABLE
      ══════════════════════════════════════════════════════════════ */}
      {/* Vial 1 — tall, teal liquid (medical) */}
      <View style={{
        position: "absolute",
        left: U * 0.714, top: U * 0.790,
        width: U * 0.022, height: U * 0.054,
        borderRadius: U * 0.011,
        backgroundColor: "#183028",
        borderWidth: 1, borderColor: "#2DD4BF48",
        overflow: "hidden",
      }}>
        <View style={{
          position: "absolute", bottom: 0, left: 1, right: 1, height: "35%",
          backgroundColor: "#2DD4BF30", borderRadius: U * 0.009,
        }} />
        {/* Glass highlight */}
        <View style={{
          position: "absolute",
          left: 2, top: 3, width: 2, height: "45%",
          backgroundColor: "#FFFFFF18", borderRadius: 1,
        }} />
      </View>
      {/* Vial 1 stopper */}
      <View style={{
        position: "absolute",
        left: U * 0.712, top: U * 0.787,
        width: U * 0.026, height: U * 0.006,
        backgroundColor: "#284038", borderRadius: 2,
      }} />
      {/* Vial 2 — shorter, amber herbal */}
      <View style={{
        position: "absolute",
        left: U * 0.746, top: U * 0.804,
        width: U * 0.024, height: U * 0.040,
        borderRadius: U * 0.012,
        backgroundColor: "#1C2820",
        borderWidth: 1, borderColor: "#D4AF3740",
        overflow: "hidden",
      }}>
        <View style={{
          position: "absolute", bottom: 0, left: 1, right: 1, height: "55%",
          backgroundColor: "#D4AF3722", borderRadius: U * 0.010,
        }} />
        <View style={{
          position: "absolute",
          left: 2, top: 2, width: 2, height: "40%",
          backgroundColor: "#FFFFFF14", borderRadius: 1,
        }} />
      </View>
      {/* Herb sprig bundle on table */}
      <View style={{
        position: "absolute",
        left: U * 0.776, top: U * 0.820,
        width: U * 0.032, height: U * 0.024,
        borderRadius: 3,
        borderWidth: 1, borderColor: "#4A8040",
        backgroundColor: "#182E18",
      }} />
      {/* Tiny mortar bowl shape */}
      <View style={{
        position: "absolute",
        left: U * 0.876, top: U * 0.820,
        width: U * 0.040, height: U * 0.024,
        borderBottomLeftRadius: U * 0.020,
        borderBottomRightRadius: U * 0.020,
        backgroundColor: "#1E2E22",
        borderWidth: 1, borderColor: "#3A5038",
      }} />

      {/* ══════════════════════════════════════════════════════════════
          LAYER 15 · FLASK — empty water flask (CLUE ZONE cx=0.826, cy=0.685)
          Zone spans: x (0.748–0.904)·U, y (0.607–0.763)·U
          Story: the flask is nearly empty and has been sitting untouched —
          a dry tide-ring at mid-height shows where the water once reached.
          A small water spill/puddle on the table adds environmental texture.
      ══════════════════════════════════════════════════════════════ */}
      {/* Spill puddle on table — neglected flask, water spilled/dried */}
      <LinearGradient
        colors={["#2DD4BF1A", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: "absolute",
          left: U * 0.780, top: U * 0.836,
          width: U * 0.090, height: U * 0.018,
          borderRadius: U * 0.009,
        }}
      />
      {/* Flask neck — slight tilt (leans against headboard, untouched) */}
      <View style={{
        position: "absolute",
        left: U * 0.808, top: U * 0.502,
        width: U * 0.036, height: U * 0.044,
        borderRadius: 5,
        backgroundColor: "#192E2A",
        borderWidth: 1, borderColor: "#D4AF3748",
        transform: [{ rotate: "4deg" }],
      }} />
      {/* Flask stopper cap */}
      <View style={{
        position: "absolute",
        left: U * 0.802, top: U * 0.494,
        width: U * 0.048, height: U * 0.014,
        backgroundColor: "#284840", borderRadius: 3,
        borderWidth: 1, borderColor: "#3A5A5055",
        transform: [{ rotate: "4deg" }],
      }} />
      {/* Flask body — rounder, more prominent, slight tilt */}
      <View style={{
        position: "absolute",
        left: U * 0.793, top: U * 0.542,
        width: U * 0.066, height: U * 0.298,
        borderRadius: U * 0.033,
        backgroundColor: "#182E2A",
        borderWidth: 2, borderColor: "#D4AF3778",
        overflow: "hidden",
        transform: [{ rotate: "4deg" }],
      }}>
        {/* Barely-there water — critically low (the flask clue) */}
        <View style={{
          position: "absolute",
          bottom: 0, left: 3, right: 3, height: "7%",
          backgroundColor: "#2DD4BF40", borderRadius: U * 0.028,
        }} />
        {/* Water surface shimmer — more visible */}
        <View style={{
          position: "absolute",
          bottom: "7%", left: 3, right: 3, height: 2.5,
          backgroundColor: "#2DD4BF80",
        }} />
        {/* HIGH TIDE RING — most important storytelling mark.
            Shows exactly where the water level was earlier today.
            The dry gap between this ring and the current level tells the
            whole story: the apprentice has not been drinking.           */}
        <View style={{
          position: "absolute",
          bottom: "46%", left: 5, right: 5, height: 1.5,
          backgroundColor: "#2DD4BF38",
          borderRadius: 1,
        }} />
        {/* Second tide ring — intermediate level */}
        <View style={{
          position: "absolute",
          bottom: "30%", left: 5, right: 5, height: 1,
          backgroundColor: "#2DD4BF22",
          borderRadius: 1,
        }} />
        {/* Glass highlight — main */}
        <View style={{
          position: "absolute",
          left: 4, top: 6,
          width: 4, height: "52%",
          backgroundColor: "#FFFFFF22", borderRadius: 3,
        }} />
        {/* Glass highlight — secondary */}
        <View style={{
          position: "absolute",
          right: 5, top: 10,
          width: 3, height: "30%",
          backgroundColor: "#FFFFFF12", borderRadius: 2,
        }} />
      </View>
      {/* Parchment label ribbon on flask */}
      <View style={{
        position: "absolute",
        left: U * 0.796, top: U * 0.648,
        width: U * 0.060, height: U * 0.022,
        backgroundColor: "#D4AF3720",
        borderRadius: 2,
        borderWidth: 1, borderColor: "#D4AF3740",
        transform: [{ rotate: "4deg" }],
      }} />

      {/* ══════════════════════════════════════════════════════════════
          LAYER 16 · PATIENT FIGURE
          Zones: dry_lips at (0.500, 0.375)·U — lower head (mouth area)
                 weak_posture at (0.500, 0.690)·U — mid-robe body
          Figure renders in front of bed (comes after bed in JSX).
      ══════════════════════════════════════════════════════════════ */}
      {/* Hair mass — dark, slightly volumetric */}
      <View style={{
        position: "absolute",
        left: U * 0.372, top: U * 0.222,
        width: U * 0.256, height: U * 0.140,
        borderRadius: U * 0.128,
        backgroundColor: "#1E1005",
        overflow: "hidden",
      }}>
        {/* Hair volume shine */}
        <View style={{
          position: "absolute",
          left: U * 0.024, top: U * 0.016,
          width: U * 0.090, height: U * 0.066,
          borderRadius: U * 0.033,
          backgroundColor: "#2C1A08",
          opacity: 0.50,
        }} />
      </View>
      {/* Side hair strand — left */}
      <View style={{
        position: "absolute",
        left: U * 0.378, top: U * 0.306,
        width: U * 0.030, height: U * 0.118,
        borderRadius: U * 0.015,
        backgroundColor: "#1E1005",
      }} />
      {/* Side hair strand — right */}
      <View style={{
        position: "absolute",
        left: U * 0.592, top: U * 0.306,
        width: U * 0.030, height: U * 0.114,
        borderRadius: U * 0.015,
        backgroundColor: "#1E1005",
      }} />

      {/* Head — sallow, pale skin (dehydration pallor) */}
      <View style={{
        position: "absolute",
        left: U * 0.420, top: U * 0.264,
        width: U * 0.160, height: U * 0.160,
        borderRadius: U * 0.080,
        overflow: "hidden",
      }}>
        {/* Base skin — cooler, paler amber (dehydrated, ashen) */}
        <LinearGradient
          colors={["#BEAB88", "#A89070"]}
          start={{ x: 0.25, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Temple/cheek pallor wash — grey-cool overtone */}
        <LinearGradient
          colors={["#7888A020", "transparent", "#7888A020"]}
          start={{ x: 0, y: 0.25 }}
          end={{ x: 1, y: 0.75 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Lower face shade */}
        <View style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0, height: "42%",
          borderBottomLeftRadius: U * 0.080,
          borderBottomRightRadius: U * 0.080,
          backgroundColor: "#A07858",
          opacity: 0.55,
        }} />
        {/* Left eyebrow — furrowed inward (worry/fatigue) */}
        <View style={{
          position: "absolute",
          left: "15%", top: "26%",
          width: "24%", height: 2.5,
          backgroundColor: "#4A2C10",
          borderRadius: 1.25, opacity: 0.85,
          transform: [{ rotate: "10deg" }],
        }} />
        {/* Right eyebrow — furrowed inward */}
        <View style={{
          position: "absolute",
          right: "15%", top: "26%",
          width: "24%", height: 2.5,
          backgroundColor: "#4A2C10",
          borderRadius: 1.25, opacity: 0.85,
          transform: [{ rotate: "-10deg" }],
        }} />
        {/* Left eye — heavy-lidded closed line (fatigued) */}
        <View style={{
          position: "absolute",
          left: "16%", top: "43%",
          width: "24%", height: 4,
          backgroundColor: "#3A2010",
          borderRadius: 2, opacity: 0.82,
        }} />
        {/* Left eye under-shadow (hollow eyes) */}
        <View style={{
          position: "absolute",
          left: "16%", top: "50%",
          width: "24%", height: 2,
          backgroundColor: "#8A7060",
          borderRadius: 1, opacity: 0.38,
        }} />
        {/* Right eye — heavy-lidded closed line */}
        <View style={{
          position: "absolute",
          right: "16%", top: "43%",
          width: "24%", height: 4,
          backgroundColor: "#3A2010",
          borderRadius: 2, opacity: 0.82,
        }} />
        {/* Right eye under-shadow */}
        <View style={{
          position: "absolute",
          right: "16%", top: "50%",
          width: "24%", height: 2,
          backgroundColor: "#8A7060",
          borderRadius: 1, opacity: 0.38,
        }} />
        {/* ── DRY LIPS — dehydration clue: ashen, cracked, parted ──────
            Upper lip: chalky grey-white strip (sapped colour).
            Lower lip: pale pink-grey, heavier & more prominent.
            Gap between: dark dried shadow — mouth slightly open from fatigue.
            Cracks are visible vertical interruptions across both lips.      */}
        {/* Upper lip — colourless, sapped (dehydration drains lip colour) */}
        <View style={{
          position: "absolute",
          left: "22%", bottom: "26%",
          width: "56%", height: 5,
          backgroundColor: "#C0A88A",
          borderRadius: 2.5, opacity: 0.90,
        }} />
        {/* Lower lip — slightly fuller, pale grey-pink, prominent */}
        <View style={{
          position: "absolute",
          left: "24%", bottom: "16%",
          width: "52%", height: 9,
          backgroundColor: "#B09878",
          borderRadius: 4.5, opacity: 0.96,
        }} />
        {/* Parted gap — dark dried shadow between lips */}
        <View style={{
          position: "absolute",
          left: "22%", bottom: "24%",
          width: "56%", height: 3,
          backgroundColor: "#5A3828",
          borderRadius: 1.5, opacity: 0.72,
        }} />
        {/* Crack 1 — prominent left-of-centre vertical split on lower lip */}
        <View style={{
          position: "absolute",
          left: "36%", bottom: "14%",
          width: "6%", height: 11,
          backgroundColor: "#8A5840",
          borderRadius: 1, opacity: 0.68,
        }} />
        {/* Crack 2 — right-of-centre split */}
        <View style={{
          position: "absolute",
          left: "57%", bottom: "14%",
          width: "5%", height: 9,
          backgroundColor: "#8A5840",
          borderRadius: 1, opacity: 0.58,
        }} />
        {/* Crack 3 — small corner crack far right */}
        <View style={{
          position: "absolute",
          right: "22%", bottom: "18%",
          width: "4%", height: 7,
          backgroundColor: "#7A4830",
          borderRadius: 1, opacity: 0.44,
        }} />
        {/* Lip shadow — reinforces the parted, sunken look */}
        <View style={{
          position: "absolute",
          left: "20%", bottom: "14%",
          width: "60%", height: 4,
          backgroundColor: "#3A2010",
          borderRadius: 2, opacity: 0.28,
        }} />
      </View>

      {/* Neck */}
      <View style={{
        position: "absolute",
        left: U * 0.469, top: U * 0.420,
        width: U * 0.062, height: U * 0.054,
        backgroundColor: "#A89070",
        borderRadius: 4,
      }} />

      {/* ── SWEAT DROPS — forehead/temple (dehydration, fever-sweat) ── */}
      {/* Drop 1 — left temple */}
      <View style={{
        position: "absolute",
        left: U * 0.432, top: U * 0.276,
        width: 5, height: 7,
        borderRadius: 3,
        backgroundColor: "#D4C8A8",
        opacity: 0.70,
      }} />
      {/* Drop 2 — upper forehead center-left */}
      <View style={{
        position: "absolute",
        left: U * 0.455, top: U * 0.268,
        width: 4, height: 5,
        borderRadius: 2.5,
        backgroundColor: "#CEC0A0",
        opacity: 0.58,
      }} />
      {/* Drop 3 — right forehead */}
      <View style={{
        position: "absolute",
        left: U * 0.528, top: U * 0.274,
        width: 3, height: 4,
        borderRadius: 2,
        backgroundColor: "#D0C4A4",
        opacity: 0.52,
      }} />

      {/* ── DIZZINESS SWIRL — orbiting pale-gold motes around the head ──
          Arranged in a visible clockwise arc so the eye reads "vertigo"
          rather than random scatter. Seven motes, largest at the start of
          the arc and fading to tiny at the tail. Subtle — not a ring glow,
          just enough to suggest the apprentice's head is spinning.        */}
      {/* Mote 1 — arc start, upper-right (largest) */}
      <View style={{
        position: "absolute",
        left: U * 0.590, top: U * 0.244,
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: "#D8CC60", opacity: 0.55,
      }} />
      {/* Mote 2 — continuing arc, right */}
      <View style={{
        position: "absolute",
        left: U * 0.606, top: U * 0.264,
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: "#D8CC60", opacity: 0.45,
      }} />
      {/* Mote 3 — arc lower-right */}
      <View style={{
        position: "absolute",
        left: U * 0.600, top: U * 0.284,
        width: 5, height: 5, borderRadius: 2.5,
        backgroundColor: "#D4C858", opacity: 0.38,
      }} />
      {/* Mote 4 — arc top-right, one step back */}
      <View style={{
        position: "absolute",
        left: U * 0.578, top: U * 0.228,
        width: 5, height: 5, borderRadius: 2.5,
        backgroundColor: "#D0C850", opacity: 0.38,
      }} />
      {/* Mote 5 — arc top-centre */}
      <View style={{
        position: "absolute",
        left: U * 0.556, top: U * 0.218,
        width: 4, height: 4, borderRadius: 2,
        backgroundColor: "#CCC048", opacity: 0.30,
      }} />
      {/* Mote 6 — arc upper-left, tail starts fading */}
      <View style={{
        position: "absolute",
        left: U * 0.532, top: U * 0.224,
        width: 3.5, height: 3.5, borderRadius: 1.75,
        backgroundColor: "#C8BC40", opacity: 0.22,
      }} />
      {/* Mote 7 — arc tail, far upper-left (smallest) */}
      <View style={{
        position: "absolute",
        left: U * 0.514, top: U * 0.236,
        width: 3, height: 3, borderRadius: 1.5,
        backgroundColor: "#C4B838", opacity: 0.16,
      }} />

      {/* ── WEAK POSTURE — shoulders drooped, asymmetric slump ──────────
          Right shoulder drops noticeably lower than left (tired lean into
          headboard). Rotation bumped to 9° for a legible downward slope.
          Shadow deepens on the dropped/right side.                        */}
      {/* Shoulder bar — angled slump */}
      <View style={{
        position: "absolute",
        left: U * 0.250, top: U * 0.476,
        width: U * 0.500, height: U * 0.090,
        borderRadius: U * 0.045,
        overflow: "hidden",
        transform: [{ rotate: "9deg" }],
      }}>
        <LinearGradient
          colors={["#B4CCC8", "#98B0AC"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Right-side slump shadow — dropped shoulder depth */}
        <LinearGradient
          colors={["transparent", "#4A7A7850"]}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      {/* Right shoulder extra drop — accentuates asymmetric slump */}
      <View style={{
        position: "absolute",
        left: U * 0.620, top: U * 0.520,
        width: U * 0.150, height: U * 0.042,
        borderRadius: U * 0.021,
        backgroundColor: "#8EAAA6",
        opacity: 0.72,
        transform: [{ rotate: "14deg" }],
      }} />
      {/* Shoulder cast shadow on mattress below */}
      <LinearGradient
        colors={["#000A0630", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: "absolute",
          left: U * 0.270, top: U * 0.552,
          width: U * 0.460, height: U * 0.038,
          borderRadius: U * 0.019,
        }}
      />
      {/* Left arm — resting limply on mattress, palm-down (no energy) */}
      <View style={{
        position: "absolute",
        left: U * 0.244, top: U * 0.620,
        width: U * 0.110, height: U * 0.040,
        borderRadius: U * 0.020,
        backgroundColor: "#A89070",
        opacity: 0.84,
        transform: [{ rotate: "-6deg" }],
      }} />
      {/* Left hand — small oval, limp */}
      <View style={{
        position: "absolute",
        left: U * 0.222, top: U * 0.638,
        width: U * 0.050, height: U * 0.034,
        borderRadius: U * 0.017,
        backgroundColor: "#A28A68",
        opacity: 0.80,
      }} />
      {/* Right arm — resting across lap at low angle */}
      <View style={{
        position: "absolute",
        left: U * 0.620, top: U * 0.648,
        width: U * 0.106, height: U * 0.038,
        borderRadius: U * 0.019,
        backgroundColor: "#9A8060",
        opacity: 0.76,
        transform: [{ rotate: "8deg" }],
      }} />

      {/* Body / robe — slumped garment (weak posture reads in the lean) */}
      <View style={{
        position: "absolute",
        left: U * 0.332, top: U * 0.532,
        width: U * 0.336, height: U * 0.370,
        borderRadius: 11,
        transform: [{ rotate: "3deg" }],
        overflow: "hidden",
      }}>
        <LinearGradient
          colors={["#D4E8E4", "#C4D8D2"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Centre robe fold line */}
        <View style={{
          position: "absolute",
          left: "50%", top: 0, width: 1.5, height: "100%",
          backgroundColor: "#9DC8C222",
          transform: [{ translateX: -0.75 }],
        }} />
        {/* Robe shading gradient */}
        <LinearGradient
          colors={["transparent", "#7AADA82A"]}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Collar detail */}
        <View style={{
          position: "absolute",
          left: "28%", top: 0, width: "44%", height: 9,
          backgroundColor: "#B8D0CA",
          borderRadius: 4,
        }} />
      </View>

      {/* Legs / robe hem visible above blanket */}
      <View style={{
        position: "absolute",
        left: U * 0.278, top: U * 0.884,
        width: U * 0.444, height: U * 0.052,
        borderRadius: 7,
        backgroundColor: "#BAD2CC",
        transform: [{ rotate: "1deg" }],
      }} />

      {/* ══════════════════════════════════════════════════════════════
          LAYER 17 · AMBIENT LIGHT OVERLAYS
          Donghua: overlapping warm/cool light pools create painterly depth.
          Central pool is warm amber; centre-top is cooler moonlight silver;
          a faint Lotus diagnostic ring marks the clinical monitoring field.
      ══════════════════════════════════════════════════════════════ */}
      {/* Central warm lantern-light pool — deeper amber over bed */}
      <LinearGradient
        colors={["#E8A42018", "transparent"]}
        style={{
          position: "absolute",
          left: U * 0.190, top: U * 0.180,
          width: U * 0.620, height: U * 0.540,
          borderRadius: U * 0.310,
        }}
      />
      {/* Moonlight spill — silver-blue lunar cast down from arch */}
      <LinearGradient
        colors={["#A8C4DC22", "transparent"]}
        style={{
          position: "absolute",
          left: U * 0.280, top: U * 0.200,
          width: U * 0.440, height: U * 0.380,
        }}
      />
      {/* Side-light accent — very faint amber on left edge of patient */}
      <LinearGradient
        colors={["#D09020", "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          position: "absolute",
          left: U * 0.180, top: U * 0.420, width: U * 0.200, height: U * 0.300,
          borderRadius: U * 0.100, opacity: 0.06,
        }}
      />
      {/* ── Lotus Diagnostic Circle — fantasy-medical monitoring field ──
          In the Clinica world, infirmary beds in the Lotus academy are
          inscribed with diagnostic circles that monitor patient vitals
          through Lotus magic. Two concentric rings, barely visible, give
          the scene its fantasy-medical RPG identity without distraction. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: U * 0.148, top: U * 0.348,
          width: U * 0.704, height: U * 0.704,
          borderRadius: U * 0.352,
          borderWidth: 1, borderColor: "#2DD4BF20",
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: U * 0.172, top: U * 0.372,
          width: U * 0.656, height: U * 0.656,
          borderRadius: U * 0.328,
          borderWidth: 1, borderColor: "#2DD4BF12",
        }}
      />
      {/* Diagnostic ring cardinal marks — four tiny teal ticks at N/E/S/W */}
      <View pointerEvents="none" style={{
        position: "absolute",
        left: U * 0.498, top: U * 0.342,
        width: 4, height: 8, borderRadius: 2,
        backgroundColor: "#2DD4BF22",
      }} />
      <View pointerEvents="none" style={{
        position: "absolute",
        left: U * 0.498, top: U * 1.046,
        width: 4, height: 8, borderRadius: 2,
        backgroundColor: "#2DD4BF22",
      }} />
      <View pointerEvents="none" style={{
        position: "absolute",
        left: U * 0.144, top: U * 0.696,
        width: 8, height: 4, borderRadius: 2,
        backgroundColor: "#2DD4BF22",
      }} />
      <View pointerEvents="none" style={{
        position: "absolute",
        left: U * 0.848, top: U * 0.696,
        width: 8, height: 4, borderRadius: 2,
        backgroundColor: "#2DD4BF22",
      }} />

      {/* ══════════════════════════════════════════════════════════════
          LAYER 18 · AMBIENT PARTICLES (Lotus healing magic)
          Teal motes float near the lanterns, window, and patient.
      ══════════════════════════════════════════════════════════════ */}
      {[
        { px: 0.128, py: 0.074, pr: 2.4, po: 0.30 },
        { px: 0.936, py: 0.074, pr: 2.2, po: 0.26 },
        { px: 0.206, py: 0.190, pr: 1.6, po: 0.20 },
        { px: 0.782, py: 0.196, pr: 1.8, po: 0.22 },
        { px: 0.500, py: 0.080, pr: 2.4, po: 0.24 },
        { px: 0.372, py: 0.625, pr: 1.4, po: 0.14 },
        { px: 0.636, py: 0.316, pr: 1.4, po: 0.16 },
        { px: 0.142, py: 0.462, pr: 1.2, po: 0.12 },
        { px: 0.862, py: 0.448, pr: 1.2, po: 0.14 },
        { px: 0.500, py: 0.440, pr: 1.0, po: 0.10 },
        { px: 0.320, py: 0.282, pr: 1.2, po: 0.12 },
        { px: 0.688, py: 0.258, pr: 1.0, po: 0.10 },
      ].map((p, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: U * p.px - p.pr,
            top: U * p.py - p.pr,
            width: p.pr * 2, height: p.pr * 2,
            borderRadius: p.pr,
            backgroundColor: "#2DD4BF",
            opacity: p.po,
          }}
        />
      ))}

      {/* ══════════════════════════════════════════════════════════════
          LAYER 19 · FOREGROUND VIGNETTE
          Dark edge strips add cinematic depth and focus the eye
          on the patient at the centre.
      ══════════════════════════════════════════════════════════════ */}
      {/* Left edge */}
      <LinearGradient
        colors={["#000A06CC", "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          position: "absolute",
          left: 0, top: 0, width: U * 0.110,
          height: U * SCENE_RATIO,
        }}
      />
      {/* Right edge */}
      <LinearGradient
        colors={["transparent", "#000A06CC"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          position: "absolute",
          left: U * 0.890, top: 0, width: U * 0.110,
          height: U * SCENE_RATIO,
        }}
      />
      {/* Top edge */}
      <LinearGradient
        colors={["#000A06CC", "transparent"]}
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, height: U * 0.085,
        }}
      />
      {/* Bottom edge */}
      <LinearGradient
        colors={["transparent", "#000A0680"]}
        style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0, height: U * 0.080,
        }}
      />

      {/* ══════════════════════════════════════════════════════════════
          CLUE ZONES — always rendered on top of all scene elements
      ══════════════════════════════════════════════════════════════ */}
      {ZONES.map((zone) => (
        <ClueZone
          key={zone.id}
          zone={zone}
          scW={scW}
          found={found.has(zone.id)}
          onCorrect={onCorrect}
          onWrong={onWrong}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CueHuntScreen — main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function CueHuntScreen() {
  const router = useRouter();
  const { startTutorial, isCompleted, activeTutorialId } = useTutorial();

  const [scW, setScW] = useState(0);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"playing" | "complete">("playing");
  const [toastText, setToastText] = useState("");
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const requiredFound = [...found].filter(
    (id) => ZONES.find((z) => z.id === id)?.isRequired,
  ).length;

  // Auto-start tutorial once (delayed to avoid hydration race)
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isCompleted("cueHuntIntro") && !activeTutorialId) {
        startTutorial("cueHuntIntro");
      }
    }, 700);
    return () => clearTimeout(t);
  }, []);

  // Transition to complete when all required clues found
  useEffect(() => {
    if (requiredFound >= REQUIRED_COUNT && phase === "playing") {
      setTimeout(() => setPhase("complete"), 450);
    }
  }, [requiredFound, phase]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setScW(e.nativeEvent.layout.width);
  }, []);

  const showToast = useCallback(
    (msg: string) => {
      if (!msg) return;
      setToastText(msg);
      toastOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1100),
        Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setToastText(""));
    },
    [toastOpacity],
  );

  const handleCorrect = useCallback(
    (zone: ZoneDef) => {
      setFound((prev) => {
        if (prev.has(zone.id)) return prev;
        return new Set([...prev, zone.id]);
      });
      playRewardCue();
      showToast(zone.feedback);
    },
    [showToast],
  );

  const handleWrong = useCallback(() => {
    // Visual shake handled inside ClueZone — no toast, no penalty
  }, []);

  const dots = Array.from({ length: REQUIRED_COUNT }, (_, i) => i < requiredFound);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#162C24", "#0E2018", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/university")}
          hitSlop={10}
          testID="cue-hunt-back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.kicker}>CUE HUNT</Text>
          <Text style={styles.caseName}>The Fading Apprentice</Text>
        </View>
        {/* Progress dots — teal when found */}
        <View style={styles.dotRow}>
          {dots.map((filled, i) => (
            <View key={i} style={[styles.dot, filled && styles.dotFilled]} />
          ))}
        </View>
      </View>

      {/* ── OBJECTIVE STRIP ───────────────────────────────────────────── */}
      <View style={styles.objectiveRow}>
        <Ionicons name="eye-outline" size={13} color="#2DD4BF" />
        <Text style={styles.objectiveTxt}>
          Find 3 clues · {requiredFound}/3 found
        </Text>
      </View>

      {/* ── SCENE ─────────────────────────────────────────────────────── */}
      <View style={styles.sceneOuter}>
        {/* The scene container has a fixed aspect ratio so the Lotus
            infirmary room always renders at the same proportions.
            onLayout gives us the actual width, which we use as the base
            unit (scW) for all scene element positions. */}
        <View
          style={styles.sceneContainer}
          onLayout={handleLayout}
        >
          {scW > 0 && (
            <InfirmaryScene
              scW={scW}
              found={found}
              onCorrect={handleCorrect}
              onWrong={handleWrong}
            />
          )}

          {/* Short feedback toast, positioned inside scene at the bottom */}
          {toastText !== "" && (
            <Animated.View
              style={[styles.toast, { opacity: toastOpacity }]}
              pointerEvents="none"
            >
              <Text style={styles.toastTxt}>{toastText}</Text>
            </Animated.View>
          )}
        </View>
      </View>

      {/* ── BOTTOM: completion feedback OR back link ──────────────────── */}
      {phase === "complete" ? (
        <View style={styles.completionCard}>
          <LinearGradient
            colors={["#0D3B38", "#152E2A"]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Icon + kicker row */}
          <View style={styles.completeTopRow}>
            <View style={styles.completeIconWrap}>
              <Ionicons name="checkmark-done" size={14} color="#2DD4BF" />
            </View>
            <Text style={styles.completeKicker}>ROUND COMPLETE</Text>
          </View>

          {/* Observation — what the player noticed */}
          <Text style={styles.observationTxt}>
            "You noticed dry lips, weakness, and poor intake."
          </Text>

          {/* Clinical connection */}
          <Text style={styles.clinicalTxt}>
            These clues suggest dehydration risk.
          </Text>

          {/* Action row */}
          <View style={styles.completeActions}>
            <Pressable
              style={styles.learnWhyBtn}
              onPress={() => router.push("/university/cue-hunt-lesson" as any)}
              testID="cue-hunt-learn-why"
            >
              <Text style={styles.learnWhyTxt}>Learn Why</Text>
              <Ionicons name="arrow-forward" size={13} color="#0B1A18" />
            </Pressable>
            <Pressable
              onPress={() => goBack(router, "/university")}
              testID="cue-hunt-finish"
            >
              <Text style={styles.completeBackTxt}>Back to University</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={styles.backToUni}
          onPress={() => goBack(router, "/university")}
          testID="cue-hunt-return"
        >
          <Ionicons name="chevron-back" size={15} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.backToUniTxt}>Back to University</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, gap: 1 },
  kicker: { color: "#2DD4BF", fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  caseName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "300", letterSpacing: 0.4 },
  dotRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.border },
  dotFilled: { backgroundColor: "#2DD4BF" },

  objectiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  objectiveTxt: {
    color: "#2DD4BF",
    fontSize: 12, fontWeight: "700", letterSpacing: 0.5,
  },

  sceneOuter: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    alignItems: "center",
  },
  sceneContainer: {
    // Fixed aspect ratio keeps the Lotus infirmary room proportional on all sizes.
    // scW * SCENE_RATIO = height, so aspectRatio (w/h) = 1/SCENE_RATIO.
    aspectRatio: 1 / SCENE_RATIO,
    width: "100%",
    maxWidth: 480,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2DD4BF18",
  },

  toast: {
    position: "absolute",
    bottom: SPACING.md,
    alignSelf: "center",
    backgroundColor: "rgba(13,59,56,0.92)",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: "#2DD4BF40",
  },
  toastTxt: { color: "#2DD4BF", fontSize: 12, fontWeight: "600" },

  completionCard: {
    margin: SPACING.lg,
    marginTop: 0,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: "#2DD4BF30",
    overflow: "hidden",
  },
  completeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  completeIconWrap: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#2DD4BF18",
    borderWidth: 1, borderColor: "#2DD4BF40",
    alignItems: "center", justifyContent: "center",
  },
  completeKicker: {
    color: "#2DD4BF",
    fontSize: 9, fontWeight: "700", letterSpacing: 2,
  },
  observationTxt: {
    color: COLORS.onSurface,
    fontSize: 15, fontStyle: "italic", fontWeight: "300",
    lineHeight: 22,
  },
  clinicalTxt: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  completeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginTop: SPACING.xs ?? 4,
  },
  learnWhyBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#2DD4BF",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.lg, paddingVertical: 14,
    minHeight: 44,
  },
  learnWhyTxt: { color: "#0B1A18", fontSize: 13, fontWeight: "800" },
  completeBackTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13, fontWeight: "600",
  },

  backToUni: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: SPACING.md, paddingBottom: SPACING.xl,
  },
  backToUniTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
});
