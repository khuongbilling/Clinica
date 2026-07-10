/**
 * Lotus Lesson Reward — Chain Complete.
 *
 * Final reward screen after the University mini-game chain:
 * Cue Hunt → Lesson → Rapid Triage → Stabilize Stack → here.
 *
 * On mount (once): calls completeLotusLessonNode("recognizing-cues-hydration")
 * to save completion and grant existing lotus rewards (crowns / crystals / xp).
 * No new currencies introduced.
 *
 * Shows three badge-style reward beats:
 *   1. Assessment Sense +1  (flavor / learning milestone)
 *   2. Lotus Lesson Complete (tracked in player.lessons_completed)
 *   3. Recruitment Path Unlocked (narrative unlock hint)
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ─────────────────────────────────────────────────────────────────────────────
// Badge data
// ─────────────────────────────────────────────────────────────────────────────
interface BadgeDef {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accent: string;
  label: string;
  sublabel: string;
}

const BADGES: BadgeDef[] = [
  {
    icon: "scan-outline",
    accent: "#38BDF8",
    label: "Assessment Sense +1",
    sublabel: "Assess before you treat.",
  },
  {
    icon: "checkmark-circle-outline",
    accent: "#D4AF37",
    label: "Lotus Lesson Complete",
    sublabel: "Vital Foundations — Chapter I",
  },
  {
    icon: "people-outline",
    accent: "#A78BFA",
    label: "Recruitment Path Unlocked",
    sublabel: "The next healers are waiting.",
  },
];

const LOTUS_NODE_ID = "recognizing-cues-hydration";

// ─────────────────────────────────────────────────────────────────────────────
// RewardBadge — animated entrance per badge
// ─────────────────────────────────────────────────────────────────────────────
function RewardBadge({ badge, delay }: { badge: BadgeDef; delay: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 310, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <Animated.View
      style={[
        styles.badge,
        { borderColor: badge.accent + "35" },
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Left glow icon */}
      <View style={[styles.badgeIcon, { backgroundColor: badge.accent + "14" }]}>
        <Ionicons name={badge.icon} size={22} color={badge.accent} />
      </View>

      {/* Text */}
      <View style={styles.badgeText}>
        <Text style={[styles.badgeLabel, { color: badge.accent }]}>{badge.label}</Text>
        <Text style={styles.badgeSub}>{badge.sublabel}</Text>
      </View>

      {/* Right tick */}
      <Ionicons name="checkmark" size={14} color={badge.accent + "88"} />
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function StabilizeCompleteScreen() {
  const router = useRouter();
  const { completeLotusLessonNode } = usePlayer();

  const [claimed, setClaimed] = useState(false);
  const [ctaReady, setCtaReady] = useState(false);

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-12)).current;
  const ctaFade = useRef(new Animated.Value(0)).current;

  // ── Grant lotus rewards exactly once ───────────────────────────────────
  useEffect(() => {
    if (claimed) return;
    setClaimed(true);
    completeLotusLessonNode(LOTUS_NODE_ID).catch(() => {
      // Fail silently — reward is cosmetic-safe; node may already be complete
    });
  }, []);

  // ── Staggered entrance ─────────────────────────────────────────────────
  useEffect(() => {
    // Header fades in immediately
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 340, useNativeDriver: true }),
    ]).start();

    // CTA appears after all badges — mark ready first so pointerEvents enable
    const t = setTimeout(() => {
      setCtaReady(true);
      Animated.timing(ctaFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }, BADGES.length * 220 + 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Deep emerald-to-void gradient — distinct from other steps */}
      <LinearGradient
        colors={["#08200E", "#041208", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.content}>
        {/* ── HEADER ────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.headerBlock,
            { opacity: headerFade, transform: [{ translateY: headerSlide }] },
          ]}
        >
          {/* Crown glow icon */}
          <View style={styles.crownWrap}>
            <LinearGradient
              colors={["#D4AF3730", "#D4AF3710"]}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="ribbon-outline" size={40} color="#D4AF37" />
          </View>

          <Text style={styles.kicker}>CHAIN COMPLETE</Text>
          <Text style={styles.title}>Lotus Lesson One</Text>
          <Text style={styles.subtitle}>
            You read the cues, sorted the patients, and chose the right order.
          </Text>
        </Animated.View>

        {/* ── REWARD BADGES ─────────────────────────────────────────── */}
        <View style={styles.badgeList}>
          {BADGES.map((badge, i) => (
            <RewardBadge key={badge.label} badge={badge} delay={280 + i * 200} />
          ))}
        </View>

        {/* ── UNLOCK HINT ───────────────────────────────────────────── */}
        <Animated.View style={[styles.unlockBanner, { opacity: ctaFade }]}>
          <LinearGradient
            colors={["#A78BFA10", "#7C3AED08"]}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="arrow-forward-circle-outline" size={14} color="#A78BFA" />
          <Text style={styles.unlockTxt}>
            Head to Recruitment to summon your first healer.
          </Text>
        </Animated.View>
      </View>

      {/* ── CONTINUE CTA ──────────────────────────────────────────────── */}
      <Animated.View style={[styles.ctaWrap, { opacity: ctaFade }]} pointerEvents={ctaReady ? "auto" : "none"}>
        <Pressable
          style={styles.ctaBtn}
          onPress={() => router.replace("/university" as any)}
          testID="chain-complete-continue"
        >
          <Text style={styles.ctaBtnTxt}>Continue</Text>
          <Ionicons name="arrow-forward" size={16} color="#0B1A18" />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.lg,
    justifyContent: "center",
  },

  // Header
  headerBlock: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  crownWrap: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 1.5, borderColor: "#D4AF3748",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    marginBottom: SPACING.xs,
  },
  kicker: {
    color: "#D4AF37",
    fontSize: 9, fontWeight: "700", letterSpacing: 3,
  },
  title: {
    color: COLORS.onSurface,
    fontSize: 24, fontWeight: "300",
    letterSpacing: 0.3, textAlign: "center",
  },
  subtitle: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13, lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: SPACING.md,
  },

  // Badges
  badgeList: { gap: SPACING.sm },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  badgeIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  badgeText: { flex: 1, gap: 2 },
  badgeLabel: { fontSize: 14, fontWeight: "700", letterSpacing: 0.2 },
  badgeSub: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "400" },

  // Unlock banner
  unlockBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#A78BFA20",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    overflow: "hidden",
  },
  unlockTxt: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 12, lineHeight: 17, flex: 1,
  },

  // CTA
  ctaWrap: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#D4AF37",
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
  },
  ctaBtnTxt: {
    color: "#0B1A18",
    fontSize: 16, fontWeight: "800", letterSpacing: 0.3,
  },
});
