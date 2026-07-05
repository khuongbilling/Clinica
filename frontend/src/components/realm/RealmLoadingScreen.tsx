import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS } from "@/src/theme/colors";
import { randomLoadingArt } from "@/src/game/loadingArt";

const TIPS: string[] = [
  "Buildings unlock as your Grand Ward Atrium levels up — keep completing shifts to raise it.",
  "Every healer's Realm is unique, grown from their own seed. No two sanctuaries look alike.",
  "Stone-laid roads connect your districts — plan your pathways to keep the Sanctuary flowing.",
  "Win battles to earn Codex Shards, then spend them on new buildings and upgrades here in the Realm.",
  "Stabilize a patient before the corruption spreads — timing is everything in the ward.",
  "Infection Control can block the next spread. Save it for when the enemy readies a wave.",
  "Duplicate heroes become stars — every copy you earn makes your champion stronger.",
  "Rest at the Lotus Plate during your off-shift to restore stamina and clear your mind.",
  "Read the Clinical Cue each turn — the right treatment rewards you with a stabilize bonus.",
  "Water, forests, and mountains frame your realm as natural borders, but can't be built upon.",
  "Assign heroes to districts to shape your Sanctuary's identity and earn harmony bonuses.",
  "A steady healer reads the whole chart before acting. Patience saves lives.",
];

const FALLBACK_TIPS: string[] = ["Preparing your realm…"];

// Rotate faster for short tips, slower for long ones — clamped to 5–10 seconds
// so there's always time to read without ever feeling stuck on one card.
function tipDurationMs(text: string) {
  return Math.min(10000, Math.max(5000, 2200 + text.length * 45));
}

export function RealmLoadingScreen({ tips = TIPS }: { tips?: string[] }) {
  const list = tips.length > 0 ? tips : FALLBACK_TIPS;
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(() => Math.floor(Math.random() * list.length));
  // Pick one random illustration for this loading appearance.
  const [art] = useState(() => randomLoadingArt());
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start();

    const dur = tipDurationMs(list[index] ?? "");
    const t = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 400,
        useNativeDriver: false,
      }).start(() => {
        if (!cancelled) setIndex((i) => (i + 1) % list.length);
      });
    }, dur);
    return () => {
      cancelled = true;
      clearTimeout(t);
      fade.stopAnimation();
    };
  }, [index, list]);

  // Contained square card so the full illustration is always visible, sized to
  // fit both portrait and landscape without cropping the character.
  const size = Math.min(width * 0.86, height * 0.52, 460);

  return (
    <View style={styles.overlay}>
      <View style={[styles.card, { width: size, height: size }]}>
        <ExpoImage
          source={art}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={400}
        />
        <LinearGradient
          colors={["transparent", "rgba(6,20,26,0.35)", "rgba(6,20,26,0.94)"]}
          locations={[0.45, 0.7, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Animated.View style={[styles.tipWrap, { opacity: fade }]}>
          <Text style={styles.tipLabel}>SANCTUARY WISDOM</Text>
          <Text style={styles.tipText}>{list[index]}</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <ActivityIndicator color={COLORS.brand} />
        <Text style={styles.loadingText}>Preparing your realm…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  card: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  tipWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 40,
  },
  tipLabel: {
    color: COLORS.brand,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 6,
  },
  tipText: {
    color: "#EAFBF8",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 26,
  },
  loadingText: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
