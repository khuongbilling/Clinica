import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HEROES } from "@/src/game/content";
import { getProgress } from "@/src/game/evolution";
import { levelCapForStar, MAX_CERTIFICATION_STAR, PROMOTION_REQUIREMENTS } from "@/src/game/university";
import { usePlayer } from "@/src/game/store";
import { UniversityCreditsBadge } from "@/src/components/UniversityCreditsBadge";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function TrainingHallScreen() {
  const router = useRouter();
  const { player, trainHero } = usePlayer();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  if (!player) {
    return (
      <SafeAreaView style={[styles.container, styles.loading]} edges={["top"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  const owned = HEROES.filter((h) => player.heroes_owned.includes(h.id));

  const onTrain = async (heroId: string) => {
    if (busyId) return;
    setBusyId(heroId);
    const res = await trainHero(heroId);
    setFeedback((f) => ({ ...f, [heroId]: res.message }));
    setBusyId(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} testID="training-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>TRAINING HALL</Text>
        <Text style={styles.title}>Level Up Your Heroes</Text>
        <Text style={styles.sub}>Each hero's Hero Level is capped by their Certification Star. Promote at Hero Certification to raise the cap.</Text>
        <UniversityCreditsBadge amount={player.university_credits || 0} testID="training-credits-badge" />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.loopBox} testID="training-loop-explainer">
          <Text style={styles.loopTitle}>HOW HERO GROWTH WORKS</Text>
          <Text style={styles.loopLine}>1. Train here for FREE — each session grants +1 Hero Level.</Text>
          <Text style={styles.loopLine}>2. Training stops at the level cap set by the hero's Certification Star.</Text>
          <Text style={styles.loopLine}>3. Promote the star at Hero Certification — that's where University Credits are spent — to raise the cap and keep training.</Text>
          <Text style={styles.loopHint}>Tap the Credits badge above any time to see where to earn more.</Text>
        </View>
        {owned.length === 0 && (
          <View style={styles.emptyBox} testID="training-empty-state">
            <Ionicons name="people-outline" size={32} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.emptyTitle}>No heroes to train yet</Text>
            <Text style={styles.empty}>Heroes join your ward through University Recruitment. Enroll your first healer, then return here to train them.</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push("/university/recruit")} testID="training-empty-recruit-btn">
              <Ionicons name="school" size={14} color={COLORS.onBrand} />
              <Text style={styles.emptyBtnTxt}>GO TO RECRUITMENT HALL</Text>
            </Pressable>
          </View>
        )}
        {owned.map((h) => {
          const prog = getProgress(player.hero_progression, h.id);
          const cap = levelCapForStar(prog.star);
          const level = prog.level ?? 1;
          const pct = Math.min(1, level / cap);
          const accent = ELEMENT_COLORS[h.element] ?? COLORS.brand;
          const atCap = level >= cap;
          return (
            <View key={h.id} style={[styles.card, { borderLeftColor: accent }]} testID={`training-hero-${h.id}`}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{h.name}</Text>
                <Text style={[styles.cardStar, { color: accent }]}>★{prog.star}</Text>
              </View>
              <Text style={styles.cardRole}>{h.role} · {h.element}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: accent }]} />
              </View>
              <Text style={styles.levelTxt}>Level {level} / {cap}</Text>
              {atCap && prog.star < MAX_CERTIFICATION_STAR && (
                <Pressable style={styles.promoteRow} onPress={() => router.push(`/hero/${h.id}`)} testID={`training-promote-hint-${h.id}`}>
                  <Ionicons name="arrow-up-circle-outline" size={14} color={accent} />
                  <Text style={[styles.promoteTxt, { color: accent }]}>
                    Cap reached — promote to ★{prog.star + 1} at Hero Certification for {(PROMOTION_REQUIREMENTS[prog.star]?.creditsRequired ?? 0).toLocaleString()} Credits (you have {(player.university_credits || 0).toLocaleString()})
                  </Text>
                </Pressable>
              )}
              {atCap && prog.star >= MAX_CERTIFICATION_STAR && (
                <Text style={styles.maxTxt}>Fully certified — maximum star and level cap reached.</Text>
              )}
              <Pressable
                onPress={() => onTrain(h.id)}
                disabled={atCap || busyId === h.id}
                style={[styles.trainBtn, atCap ? { backgroundColor: COLORS.surfaceTertiary } : { backgroundColor: accent }]}
                testID={`training-train-btn-${h.id}`}
              >
                <Ionicons name="school-outline" size={14} color={atCap ? COLORS.onSurfaceTertiary : COLORS.surface} />
                <Text style={[styles.trainBtnTxt, { color: atCap ? COLORS.onSurfaceTertiary : COLORS.surface }]}>
                  {atCap ? "Level cap reached" : "Train (+1 Level)"}
                </Text>
              </Pressable>
              {feedback[h.id] && <Text style={[styles.feedback, { color: accent }]}>{feedback[h.id]}</Text>}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: 4 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)", marginBottom: SPACING.sm,
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  loopBox: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, gap: 4,
  },
  loopTitle: { color: COLORS.brand, fontSize: 10, letterSpacing: 1.5, fontWeight: "800" },
  loopLine: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },
  loopHint: { color: COLORS.onSurfaceTertiary, fontSize: 10, marginTop: 2 },
  promoteRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 4 },
  promoteTxt: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "600" },
  maxTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 4 },
  emptyBox: { alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.xl },
  emptyTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.brand, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, marginTop: SPACING.xs,
  },
  emptyBtnTxt: { color: COLORS.onBrand, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  empty: { color: COLORS.onSurfaceTertiary, fontSize: 13, textAlign: "center", maxWidth: 300 },
  card: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderLeftWidth: 3,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: 6,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardName: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  cardStar: { fontSize: 13, fontWeight: "800" },
  cardRole: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  barTrack: { height: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceTertiary, overflow: "hidden", marginTop: 4 },
  barFill: { height: "100%", borderRadius: RADIUS.pill },
  levelTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: "600" },
  trainBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm, marginTop: 4,
  },
  trainBtnTxt: { fontSize: 12, fontWeight: "700" },
  feedback: { fontSize: 11, fontWeight: "600", textAlign: "center" },
});
