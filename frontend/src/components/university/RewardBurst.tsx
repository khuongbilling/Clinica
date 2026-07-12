/**
 * RewardBurst — shared dopamine-maximising completion screen for University mini-games.
 *
 * Animation sequence:
 *   t=0      Screen flash (white→transparent, 120ms) — immediate win signal
 *   t=0      8 star particles burst outward from the badge centre
 *   t=160ms  Badge spring-bounces in (scale 0 → 1.2 → 1.0)
 *   t=160ms  Continuous glow ring pulses around badge
 *   t=400ms  Grade label slides up + fades in
 *   t=580ms  Score display fades in
 *   t=720ms  Observation + clinical note fade in
 *   t=900ms  Chibi healer + buttons fade in
 */

import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { MilestoneReward, MilestoneRewardItem } from "@/src/components/onboarding/MilestoneReward";

const CHIBI = require("../../../assets/images/cue_hunt_chibi_healer.png");

const NUM_STARS = 8;
const STAR_DIST = 96;

// Pre-computed star directions (8 evenly-spaced angles)
const STAR_DIRS = Array.from({ length: NUM_STARS }, (_, i) => {
  const angle = (i / NUM_STARS) * Math.PI * 2;
  return { tx: Math.cos(angle) * STAR_DIST, ty: Math.sin(angle) * STAR_DIST };
});

// Extra "distant" sparkle burst — 4 stars at larger radius, staggered
const SPARKLE_DIST = 145;
const SPARKLE_DIRS = [45, 135, 225, 315].map((deg) => {
  const r = (deg * Math.PI) / 180;
  return { tx: Math.cos(r) * SPARKLE_DIST, ty: Math.sin(r) * SPARKLE_DIST };
});

export interface RewardGrade {
  label: string;
  color: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}

interface RewardBurstProps {
  grade: RewardGrade;
  score: number;
  total: number;
  observation: string;
  clinicalNote: string;
  chainHint?: string;
  bgColors: readonly [string, string, string];
  onFinish: () => void;
  onLearnMore?: () => void;
  learnLabel?: string;
  creditsEarned?: number;
  milestoneItems?: MilestoneRewardItem[];
}

export function RewardBurst({
  grade,
  score,
  total,
  observation,
  clinicalNote,
  chainHint,
  bgColors,
  onFinish,
  onLearnMore,
  learnLabel = "Learn Why",
  creditsEarned,
  milestoneItems,
}: RewardBurstProps) {
  // ── Particle animations ─────────────────────────────────────────────────────
  const stars = useRef(
    Array.from({ length: NUM_STARS }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      op: new Animated.Value(0),
      sc: new Animated.Value(0),
    }))
  ).current;

  const sparkles = useRef(
    Array.from({ length: 4 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      op: new Animated.Value(0),
    }))
  ).current;

  // ── Badge + glow ────────────────────────────────────────────────────────────
  const badgeScale   = useRef(new Animated.Value(0)).current;
  const badgeRotate  = useRef(new Animated.Value(0)).current;
  const glowAnim     = useRef(new Animated.Value(0)).current;
  const glowLoop     = useRef<Animated.CompositeAnimation | null>(null);

  // ── Text reveals ───────────────────────────────────────────────────────────
  const gradeOp      = useRef(new Animated.Value(0)).current;
  const gradeY       = useRef(new Animated.Value(18)).current;
  const scoreOp      = useRef(new Animated.Value(0)).current;
  const bodyOp       = useRef(new Animated.Value(0)).current;
  const btnOp        = useRef(new Animated.Value(0)).current;
  const flash        = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Flash
    Animated.sequence([
      Animated.timing(flash, { toValue: 0.22, duration: 100, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0,    duration: 320, useNativeDriver: true }),
    ]).start();

    // 2. Star burst (inner ring)
    const starAnim = Animated.parallel(
      stars.map((s, i) => {
        const { tx, ty } = STAR_DIRS[i];
        s.x.setValue(0); s.y.setValue(0); s.op.setValue(0); s.sc.setValue(0);
        return Animated.sequence([
          Animated.delay(i * 20),
          Animated.parallel([
            Animated.spring(s.sc, { toValue: 1, speed: 30, bounciness: 6, useNativeDriver: true }),
            Animated.timing(s.op, { toValue: 1, duration: 60, useNativeDriver: true }),
            Animated.timing(s.x,  { toValue: tx, duration: 480, useNativeDriver: true }),
            Animated.timing(s.y,  { toValue: ty, duration: 480, useNativeDriver: true }),
          ]),
          Animated.timing(s.op, { toValue: 0, duration: 260, useNativeDriver: true }),
        ]);
      })
    );

    // 3. Sparkle burst (outer ring, delayed)
    const sparkleAnim = Animated.parallel(
      sparkles.map((s, i) => {
        const { tx, ty } = SPARKLE_DIRS[i];
        s.x.setValue(0); s.y.setValue(0); s.op.setValue(0);
        return Animated.sequence([
          Animated.delay(80 + i * 30),
          Animated.parallel([
            Animated.timing(s.op, { toValue: 0.85, duration: 100, useNativeDriver: true }),
            Animated.timing(s.x,  { toValue: tx, duration: 580, useNativeDriver: true }),
            Animated.timing(s.y,  { toValue: ty, duration: 580, useNativeDriver: true }),
          ]),
          Animated.timing(s.op, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]);
      })
    );

    Animated.parallel([starAnim, sparkleAnim]).start();

    // 4. Badge spring
    const badgeTimer = setTimeout(() => {
      Animated.sequence([
        Animated.spring(badgeScale, {
          toValue: 1.18, speed: 10, bounciness: 16, useNativeDriver: true,
        }),
        Animated.spring(badgeScale, {
          toValue: 1.0, speed: 18, useNativeDriver: true,
        }),
      ]).start();

      // Subtle sway
      Animated.sequence([
        Animated.timing(badgeRotate, { toValue: -0.04, duration: 120, useNativeDriver: true }),
        Animated.timing(badgeRotate, { toValue:  0.04, duration: 200, useNativeDriver: true }),
        Animated.timing(badgeRotate, { toValue:  0,    duration: 150, useNativeDriver: true }),
      ]).start();

      // Continuous glow pulse
      glowLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1,   duration: 950, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.25, duration: 950, useNativeDriver: true }),
        ])
      );
      glowLoop.current.start();
    }, 160);

    // 5. Grade text
    const gradeTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(gradeOp, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(gradeY,  { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 420);

    // 6. Score
    const scoreTimer = setTimeout(() => {
      Animated.timing(scoreOp, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }, 600);

    // 7. Body text
    const bodyTimer = setTimeout(() => {
      Animated.timing(bodyOp, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }, 760);

    // 8. Chibi + buttons
    const btnTimer = setTimeout(() => {
      Animated.timing(btnOp, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }, 950);

    return () => {
      clearTimeout(badgeTimer);
      clearTimeout(gradeTimer);
      clearTimeout(scoreTimer);
      clearTimeout(bodyTimer);
      clearTimeout(btnTimer);
      glowLoop.current?.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.85] });
  const rotateInterp = badgeRotate.interpolate({
    inputRange: [-0.1, 0.1],
    outputRange: ["-6deg", "6deg"],
  });

  return (
    <View style={styles.root}>
      {/* Background */}
      <LinearGradient colors={bgColors as any} style={StyleSheet.absoluteFillObject} />

      {/* Win flash */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: grade.color, opacity: flash }]}
      />

      {/* ── Particle container ─────────────────────────────────────────────── */}
      <View style={styles.particleAnchor} pointerEvents="none">
        {/* Inner stars */}
        {stars.map((s, i) => (
          <Animated.View
            key={`s${i}`}
            style={[
              styles.starDot,
              {
                opacity: s.op,
                transform: [
                  { translateX: s.x },
                  { translateY: s.y },
                  { scale: s.sc },
                ],
              },
            ]}
          >
            <Ionicons
              name="star"
              size={13}
              color={i % 2 === 0 ? grade.color : "#D4AF37"}
            />
          </Animated.View>
        ))}
        {/* Outer sparkles */}
        {sparkles.map((s, i) => (
          <Animated.View
            key={`sp${i}`}
            style={[
              styles.sparkleDot,
              {
                opacity: s.op,
                transform: [{ translateX: s.x }, { translateY: s.y }],
              },
            ]}
          >
            <Ionicons name="sparkles" size={11} color="#D4AF37CC" />
          </Animated.View>
        ))}
      </View>

      {/* ── Badge ──────────────────────────────────────────────────────────── */}
      <View style={styles.badgeZone}>
        {/* Glow ring */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glowRing,
            { borderColor: grade.color, opacity: glowOpacity },
          ]}
        />
        {/* Second glow ring (larger, dimmer) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glowRingOuter,
            {
              borderColor: grade.color,
              opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.35] }),
            },
          ]}
        />
        {/* Medal */}
        <Animated.View
          style={[
            styles.badge,
            { backgroundColor: grade.color + "22", borderColor: grade.color },
            { transform: [{ scale: badgeScale }, { rotate: rotateInterp }] },
          ]}
        >
          <LinearGradient
            colors={[grade.color + "30", "transparent"]}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name={grade.icon} size={44} color={grade.color} />
        </Animated.View>
      </View>

      {/* ── Grade label ────────────────────────────────────────────────────── */}
      <Animated.Text
        style={[
          styles.gradeLabel,
          { color: grade.color, opacity: gradeOp, transform: [{ translateY: gradeY }] },
        ]}
      >
        {grade.label}
      </Animated.Text>

      {/* ── Score ──────────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.scoreRow, { opacity: scoreOp }]}>
        <Text style={[styles.scoreNum, { color: grade.color }]}>{score}</Text>
        <Text style={styles.scoreSep}> / </Text>
        <Text style={styles.scoreTotal}>{total}</Text>
      </Animated.View>
      <Animated.Text style={[styles.scoreCaption, { opacity: scoreOp }]}>
        correct
      </Animated.Text>

      {/* ── Divider ────────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.divider, { opacity: bodyOp }]} />

      {/* ── Observation + clinical note ────────────────────────────────────── */}
      <Animated.Text style={[styles.observation, { opacity: bodyOp }]}>
        {observation}
      </Animated.Text>
      <Animated.Text style={[styles.clinicalNote, { opacity: bodyOp }]}>
        {clinicalNote}
      </Animated.Text>

      {/* ── Credits earned chip ────────────────────────────────────────────── */}
      {!!creditsEarned && (
        <Animated.View style={[styles.creditsRow, { opacity: scoreOp }]}>
          <Ionicons name="school" size={13} color="#2DD4BF" />
          <Text style={styles.creditsTxt}>
            +{creditsEarned} University Credits
          </Text>
        </Animated.View>
      )}

      {/* ── Chain hint ─────────────────────────────────────────────────────── */}
      {!!chainHint && (
        <Animated.View style={[styles.chainRow, { opacity: bodyOp }]}>
          <Ionicons name="arrow-forward-circle-outline" size={13} color="#2DD4BF60" />
          <Text style={styles.chainTxt}>{chainHint}</Text>
        </Animated.View>
      )}

      {/* ── First-perfect milestone reward ─────────────────────────────────── */}
      {!!milestoneItems && (
        <Animated.View style={[{ width: "100%", marginTop: 4 }, { opacity: btnOp }]}>
          <MilestoneReward
            title="FIRST PERFECT SCORE"
            items={milestoneItems}
            accent="#D4AF37"
          />
        </Animated.View>
      )}

      {/* ── Chibi healer ───────────────────────────────────────────────────── */}
      <Animated.View style={[styles.chibiWrap, { opacity: btnOp }]}>
        <ExpoImage source={CHIBI} style={styles.chibi} contentFit="contain" />
      </Animated.View>

      {/* ── Buttons ────────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.btnRow, { opacity: btnOp }]}>
        {!!onLearnMore && (
          <Pressable
            style={[styles.learnBtn, { backgroundColor: grade.color }]}
            onPress={onLearnMore}
            testID="reward-learn"
          >
            <Text style={styles.learnTxt}>{learnLabel}</Text>
            <Ionicons name="arrow-forward" size={13} color="#071018" />
          </Pressable>
        )}
        <Pressable style={styles.finishBtn} onPress={onFinish} testID="reward-finish">
          <Text style={styles.finishTxt}>Back to University</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
    overflow: "hidden",
  },

  // Particles
  particleAnchor: {
    position: "absolute",
    top: "30%",
    alignSelf: "center",
    width: 0, height: 0,
    alignItems: "center", justifyContent: "center",
  },
  starDot:    { position: "absolute" },
  sparkleDot: { position: "absolute" },

  // Badge
  badgeZone: {
    width: 100, height: 100,
    alignItems: "center", justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  glowRing: {
    position: "absolute",
    width: 112, height: 112, borderRadius: 56,
    borderWidth: 2.5,
  },
  glowRingOuter: {
    position: "absolute",
    width: 136, height: 136, borderRadius: 68,
    borderWidth: 2,
  },
  badge: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 2.5,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },

  // Grade
  gradeLabel: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },

  // Score
  scoreRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  scoreNum:     { fontSize: 48, fontWeight: "200", lineHeight: 54 },
  scoreSep:     { color: COLORS.onSurfaceTertiary, fontSize: 24, fontWeight: "200" },
  scoreTotal:   { color: COLORS.onSurfaceTertiary, fontSize: 24, fontWeight: "200" },
  scoreCaption: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: -SPACING.xs ?? -4,
  },

  // Divider
  divider: {
    width: "40%", height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginVertical: SPACING.sm,
  },

  // Text
  observation: {
    color: COLORS.onSurface,
    fontSize: 15, fontStyle: "italic", fontWeight: "300",
    textAlign: "center", lineHeight: 22,
  },
  clinicalNote: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13, lineHeight: 19,
    textAlign: "center",
  },

  // Credits chip
  creditsRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#2DD4BF18",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: "#2DD4BF30",
  },
  creditsTxt: {
    color: "#2DD4BF",
    fontSize: 12, fontWeight: "700", letterSpacing: 0.3,
  },

  // Chain hint
  chainRow: {
    flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2,
  },
  chainTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12, fontStyle: "italic",
  },

  // Chibi
  chibiWrap: { marginTop: SPACING.sm },
  chibi: { width: 64, height: 64 },

  // Buttons
  btnRow: {
    flexDirection: "row", alignItems: "center",
    gap: SPACING.md, marginTop: SPACING.sm,
    flexWrap: "wrap", justifyContent: "center",
  },
  learnBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.xl, paddingVertical: 14,
    minHeight: 44,
  },
  learnTxt:   { color: "#071018", fontSize: 14, fontWeight: "800" },
  finishBtn:  { paddingHorizontal: SPACING.md, paddingVertical: 12 },
  finishTxt:  {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13, fontWeight: "600",
  },
});
