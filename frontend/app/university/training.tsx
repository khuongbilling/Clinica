import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HEROES } from "@/src/game/content";
import { getProgress } from "@/src/game/evolution";
import { levelCapForStar } from "@/src/game/university";
import { usePlayer } from "@/src/game/store";
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
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {owned.length === 0 && (
          <Text style={styles.empty}>Recruit a hero at the University to begin training.</Text>
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
  empty: { color: COLORS.onSurfaceTertiary, fontSize: 13, textAlign: "center", marginTop: SPACING.xl },
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
