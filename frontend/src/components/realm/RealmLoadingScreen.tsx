import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(() => Math.floor(Math.random() * list.length));
  // Pick one random multi-hero illustration for this loading appearance.
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

  // Full-page illustration. A blurred, zoomed COVER copy fills the screen edge
  // to edge (no dead bars on any aspect ratio), and a crisp CONTAIN copy on top
  // guarantees the whole comedic scene is always fully visible — never cropped —
  // regardless of phone shape.
  return (
    <View style={styles.overlay}>
      <ExpoImage
        source={art}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={30}
        transition={0}
      />
      <View style={[StyleSheet.absoluteFill, styles.coverDim]} pointerEvents="none" />
      <ExpoImage
        source={art}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        transition={400}
      />
      <LinearGradient
        colors={["rgba(6,20,26,0.25)", "transparent", "rgba(6,20,26,0.55)", "rgba(6,20,26,0.97)"]}
        locations={[0, 0.32, 0.62, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
        <Animated.View style={[styles.tipWrap, { opacity: fade }]}>
          <Text style={styles.tipLabel}>SANCTUARY WISDOM</Text>
          <Text style={styles.tipText}>{list[index]}</Text>
        </Animated.View>

        <View style={styles.footer}>
          <ActivityIndicator color={COLORS.brand} />
          <Text style={styles.loadingText}>Preparing your realm…</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surface,
    justifyContent: "flex-end",
    zIndex: 50,
  },
  coverDim: {
    backgroundColor: "rgba(6,20,26,0.55)",
  },
  bottom: {
    paddingHorizontal: 24,
  },
  tipWrap: {
    marginBottom: 22,
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
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
