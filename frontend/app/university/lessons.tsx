import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  BADGES,
  DEPARTMENTS,
  SAFETY_NOTE,
  lessonsForDepartment,
  simulationsForDepartment,
} from "@/src/game/lessons";
import { LOTUS_PATHS, isLotusNodeComplete } from "@/src/game/lotusLessons";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function LessonsHubScreen() {
  const router = useRouter();
  const { player, loading } = usePlayer();

  if (loading || !player) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.hero}>
          <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
          <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} testID="lessons-back">
            <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
          </Pressable>
          <Text style={styles.kicker}>CLINICA UNIVERSITY</Text>
          <Text style={styles.title}>Lessons & Simulations</Text>
        </View>
        <View style={styles.fallback}>
          <ActivityIndicator color={COLORS.brand} />
        </View>
      </SafeAreaView>
    );
  }

  const badgeProgress = player.badge_progress || {};
  const completedLessons = player.lessons_completed || [];
  const available = DEPARTMENTS.filter((d) => d.status === "available");
  const comingSoon = DEPARTMENTS.filter((d) => d.status === "coming_soon");
  const vitalFoundations = LOTUS_PATHS.find((p) => p.id === "vital-foundations");

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} testID="lessons-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>CLINICA UNIVERSITY</Text>
        <Text style={styles.title}>Lessons & Simulations</Text>
        <Text style={styles.sub}>
          Learn hard health and clinical concepts through quick lessons, simulation cases, quizzes, and
          fantasy-medical challenges.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.safetyBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.safetyTxt}>{SAFETY_NOTE}</Text>
        </View>

        {vitalFoundations && (
          <>
            <Text style={styles.section}>{vitalFoundations.name}</Text>
            <Text style={styles.pathDesc}>{vitalFoundations.description}</Text>
            <View style={styles.pathTrack}>
              {vitalFoundations.nodes.map((node, i) => {
                const locked = node.status !== "available";
                const done = !locked && isLotusNodeComplete(player, node.id);
                const isLast = i === vitalFoundations.nodes.length - 1;
                return (
                  <View key={node.id} style={styles.pathRow}>
                    <View style={styles.pathNodeCol}>
                      <Pressable
                        disabled={locked}
                        onPress={() => router.push(`/university/lotus-lesson/${node.id}` as any)}
                        style={[
                          styles.pathNode,
                          done && styles.pathNodeDone,
                          locked && styles.pathNodeLocked,
                        ]}
                        testID={`lotus-node-${node.id}`}
                      >
                        <Ionicons
                          name={locked ? "lock-closed" : done ? "checkmark" : "water"}
                          size={20}
                          color={locked ? COLORS.onSurfaceTertiary : COLORS.onBrand}
                        />
                      </Pressable>
                      {!isLast && <View style={styles.pathConnector} />}
                    </View>
                    <View style={styles.pathNodeBody}>
                      <Text style={[styles.pathNodeTitle, locked && styles.pathNodeTitleLocked]}>
                        {node.title}
                      </Text>
                      <Text style={styles.pathNodeSub}>{node.subtitle}</Text>
                      {done && <Text style={styles.pathNodeDoneTxt}>Completed</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.section}>Departments</Text>
        {available.map((d) => {
          const lessons = lessonsForDepartment(d.id);
          const sims = simulationsForDepartment(d.id);
          const doneCount = lessons.filter((l) => completedLessons.includes(l.id)).length;
          return (
            <Pressable
              key={d.id}
              style={styles.deptCard}
              onPress={() => router.push(`/university/department/${d.id}` as any)}
              testID={`lessons-dept-${d.id}`}
            >
              <View style={styles.deptIcon}>
                <Ionicons name={d.icon as any} size={22} color={COLORS.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deptName}>{d.name}</Text>
                <Text style={styles.deptDesc}>{d.description}</Text>
                <Text style={styles.deptMeta}>
                  {lessons.length} lessons · {sims.length} simulations · {doneCount}/{lessons.length} completed
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.onSurfaceTertiary} />
            </Pressable>
          );
        })}

        <Text style={styles.section}>Coming Soon</Text>
        {comingSoon.map((d) => (
          <View key={d.id} style={[styles.deptCard, styles.deptCardLocked]} testID={`lessons-dept-locked-${d.id}`}>
            <View style={[styles.deptIcon, { borderColor: COLORS.border, backgroundColor: COLORS.surfaceTertiary }]}>
              <Ionicons name={d.icon as any} size={22} color={COLORS.onSurfaceTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.deptNameLocked}>{d.name}</Text>
                <View style={styles.soonBadge}>
                  <Text style={styles.soonTxt}>COMING SOON</Text>
                </View>
              </View>
              <Text style={styles.deptDescLocked}>{d.description}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.section}>Concept Badges</Text>
        <View style={styles.badgeGrid}>
          {BADGES.map((b) => {
            const progress = badgeProgress[b.id] || 0;
            const unlocked = progress >= b.goal;
            return (
              <View key={b.id} style={[styles.badgeTile, unlocked && styles.badgeTileUnlocked]} testID={`lessons-badge-${b.id}`}>
                <Ionicons name={b.icon as any} size={20} color={unlocked ? COLORS.brand : COLORS.onSurfaceTertiary} />
                <Text style={[styles.badgeName, unlocked && { color: COLORS.brand }]} numberOfLines={2}>{b.name}</Text>
                <Text style={styles.badgeProgress}>{Math.min(progress, b.goal)}/{b.goal}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: 4 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)", marginBottom: SPACING.sm,
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  safetyBox: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, backgroundColor: COLORS.surfaceSecondary,
  },
  safetyTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 15 },
  section: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700", marginTop: SPACING.sm },
  pathDesc: { color: COLORS.onSurfaceSecondary, fontSize: 12, marginTop: -SPACING.sm },
  pathTrack: { gap: 0 },
  pathRow: { flexDirection: "row", gap: SPACING.md },
  pathNodeCol: { alignItems: "center" },
  pathNode: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.brand, borderWidth: 1, borderColor: COLORS.brand,
  },
  pathNodeDone: { backgroundColor: COLORS.success || COLORS.brand },
  pathNodeLocked: { backgroundColor: COLORS.surfaceSecondary, borderColor: COLORS.border },
  pathConnector: { width: 2, flex: 1, minHeight: 24, backgroundColor: COLORS.border, marginVertical: 2 },
  pathNodeBody: { flex: 1, paddingBottom: SPACING.lg },
  pathNodeTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700" },
  pathNodeTitleLocked: { color: COLORS.onSurfaceTertiary },
  pathNodeSub: { color: COLORS.onSurfaceSecondary, fontSize: 11, marginTop: 2 },
  pathNodeDoneTxt: { color: COLORS.brand, fontSize: 11, fontWeight: "700", marginTop: 4 },
  deptCard: {
    flexDirection: "row", gap: SPACING.md, alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  deptCardLocked: { opacity: 0.6 },
  deptIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.brand + "40",
  },
  deptName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  deptNameLocked: { color: COLORS.onSurfaceSecondary, fontSize: 14, fontWeight: "600" },
  deptDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  deptDescLocked: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  deptMeta: { color: COLORS.brand, fontSize: 10, marginTop: 4, fontWeight: "600" },
  soonBadge: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 2 },
  soonTxt: { color: COLORS.onSurfaceTertiary, fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  badgeTile: {
    width: "31%", borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.sm, alignItems: "center", gap: 4, backgroundColor: COLORS.surfaceSecondary, minHeight: 84, justifyContent: "center",
  },
  badgeTileUnlocked: { borderColor: COLORS.brand + "70" },
  badgeName: { color: COLORS.onSurfaceSecondary, fontSize: 10, fontWeight: "600", textAlign: "center" },
  badgeProgress: { color: COLORS.onSurfaceTertiary, fontSize: 9 },
});
