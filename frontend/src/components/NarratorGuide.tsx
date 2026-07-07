import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const MENTOR_ART = require("../../assets/images/mentor_guide.png");

export interface NarratorGuideProps {
  /** What the narrator says — a directive line guiding the player. */
  message: string;
  /** Optional one-line objective shown as a highlighted chip. */
  objective?: string;
  /** Call-to-action button label. Omit to hide the button. */
  ctaLabel?: string;
  onPress?: () => void;
  /** Narrator name shown above the message. */
  name?: string;
  /**
   * When provided, the guide renders as a full illustrated banner with this
   * art as the background (behind a legibility scrim). Otherwise it renders as
   * a compact side-by-side panel.
   */
  bgImage?: any;
  testID?: string;
}

/**
 * NarratorGuide — a hand-drawn donghua mentor who narrates and directs the
 * player on where/how to start and their current objective. Two layouts:
 *  - Illustrated banner (pass `bgImage`) — used as a prominent onboarding hero.
 *  - Compact panel (no `bgImage`) — used inline above a screen's content.
 */
export function NarratorGuide({
  message,
  objective,
  ctaLabel,
  onPress,
  name = "Mentor",
  bgImage,
  testID,
}: NarratorGuideProps) {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);

  const Body = (
    <>
      <View style={styles.headerRow}>
        <View style={styles.portrait}>
          <ExpoImage source={MENTOR_ART} style={styles.portraitImg} contentFit="cover" transition={200} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.nameRow}>
            <Ionicons name="sparkles" size={11} color={COLORS.brand} />
            <Text style={styles.name} numberOfLines={1}>{name.toUpperCase()}</Text>
          </View>
          <Text style={[styles.message, bgImage ? styles.messageOnArt : null]}>{message}</Text>
        </View>
      </View>

      {objective ? (
        <View style={styles.objectiveChip}>
          <Ionicons name="flag" size={12} color={COLORS.brand} />
          <Text style={styles.objectiveTxt} numberOfLines={2}>
            <Text style={styles.objectiveLabel}>OBJECTIVE  </Text>
            {objective}
          </Text>
        </View>
      ) : null}

      {ctaLabel && onPress ? (
        <Pressable style={styles.cta} onPress={onPress} testID={testID ? `${testID}-cta` : undefined}>
          <Text style={styles.ctaTxt}>{ctaLabel}</Text>
          <Ionicons name="arrow-forward" size={16} color={COLORS.onBrand} />
        </Pressable>
      ) : null}
    </>
  );

  return (
    <Animated.View
      style={[
        bgImage ? styles.bannerWrap : styles.panelWrap,
        { opacity: fade, transform: [{ translateY: rise }] },
      ]}
      testID={testID ?? "narrator-guide"}
    >
      {bgImage ? (
        <>
          <ExpoImage source={bgImage} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <LinearGradient
            colors={["rgba(6,10,16,0.55)", "rgba(6,10,16,0.82)", "rgba(6,10,16,0.94)"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.bannerInner}>{Body}</View>
        </>
      ) : (
        Body
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panelWrap: {
    borderWidth: 1,
    borderColor: COLORS.brand + "45",
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.brand + "12",
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  bannerWrap: {
    borderWidth: 1.5,
    borderColor: COLORS.brand + "66",
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
  bannerInner: { padding: SPACING.md, gap: SPACING.sm },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.md },
  portrait: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: COLORS.brand + "AA",
    overflow: "hidden",
    backgroundColor: "#0B1420",
    flexShrink: 0,
  },
  portraitImg: { width: 58, height: 58 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { color: COLORS.brand, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  message: { color: COLORS.onSurface, fontSize: 13, lineHeight: 19 },
  messageOnArt: { color: "#F2F5FA", textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 4 },
  objectiveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(212,175,55,0.14)",
    borderWidth: 1,
    borderColor: COLORS.brand + "55",
    borderRadius: RADIUS.md,
    paddingVertical: 7,
    paddingHorizontal: SPACING.sm,
  },
  objectiveTxt: { flex: 1, color: COLORS.onSurface, fontSize: 12, lineHeight: 16 },
  objectiveLabel: { color: COLORS.brand, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.brand,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
  },
  ctaTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "800", letterSpacing: 1.5 },
});
