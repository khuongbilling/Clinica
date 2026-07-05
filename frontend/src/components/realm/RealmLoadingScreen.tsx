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

import { COLORS } from "@/src/theme/colors";

const PARCHMENT = require("../../../assets/realm/ui/parchment_scroll.png");
const PARCHMENT_RATIO = 1024 / 743; // native width / height of the scroll art

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
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(() => Math.floor(Math.random() * list.length));
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

  const pw = Math.min(width * 0.9, 560);
  const ph = pw / PARCHMENT_RATIO;

  return (
    <View style={styles.overlay}>
      <View style={{ width: pw, height: ph, justifyContent: "center", alignItems: "center" }}>
        <ExpoImage
          source={PARCHMENT}
          style={{ position: "absolute", width: pw, height: ph }}
          contentFit="contain"
        />
        <Animated.View
          style={{
            opacity: fade,
            paddingHorizontal: pw * 0.17,
            maxWidth: pw,
          }}
        >
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
  tipLabel: {
    color: "#7A4A22",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 8,
    opacity: 0.85,
  },
  tipText: {
    color: "#3E2412",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 28,
  },
  loadingText: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
