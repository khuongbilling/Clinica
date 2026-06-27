import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APTITUDE_INFO, RANKS } from "@/src/game/content";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const MASTERY_LABELS: Record<string, string> = {
  assessment: "Assessment",
  stabilization: "Stabilization",
  pharmacology: "Pharmacology",
  judgment: "Judgment",
  command: "Command",
  systems: "Systems",
};

export default function ProfileScreen() {
  const router = useRouter();
  const { player, resetPlayer } = usePlayer();
  if (!player) return null;
  const apt = APTITUDE_INFO[player.aptitude];
  const nextRank = RANKS[player.rank_index + 1];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View style={[styles.avatar, { borderColor: apt.color }]}>
            <Ionicons name={apt.icon as any} size={36} color={apt.color} />
          </View>
          <Text style={styles.name}>{player.name}</Text>
          <Text style={styles.aptLine}>{apt.title} · {player.rank}</Text>
        </View>

        <View style={styles.rankCard}>
          <Text style={styles.label}>RANK PROGRESS</Text>
          <Text style={styles.rankName}>{player.rank}</Text>
          {nextRank ? (
            <>
              <Text style={styles.nextRank}>Next: {nextRank.name} at {nextRank.xpRequired} XP</Text>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.min(100, (player.xp / nextRank.xpRequired) * 100)}%` }]} />
              </View>
              <Text style={styles.xpTxt}>{player.xp} / {nextRank.xpRequired} XP</Text>
            </>
          ) : <Text style={styles.nextRank}>You have reached the apex.</Text>}
        </View>

        <Text style={styles.section}>Mastery</Text>
        <View style={styles.masteryGrid}>
          {Object.entries(player.mastery).map(([k, v]) => (
            <View key={k} style={styles.mCard} testID={`mastery-${k}`}>
              <Text style={styles.mLabel}>{MASTERY_LABELS[k] || k}</Text>
              <Text style={styles.mValue}>{v}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>Stats</Text>
        <View style={styles.statsCard}>
          <Stat label="Codex Shards" value={String(player.codex_shards || 0)} />
          <Stat label="Shifts Completed" value={String(player.runs_completed)} />
          <Stat label="Bosses Defeated" value={String(player.bosses_defeated.length)} />
          <Stat label="Heroes Recruited" value={String(player.heroes_owned.length)} />
          <Stat label="Codex Pages" value={String(player.codex_unlocked.length)} />
        </View>

        <Pressable
          style={styles.tutorialBtn}
          onPress={() => router.push("/tutorial")}
          testID="profile-tutorial-button"
        >
          <Ionicons name="book" size={16} color={COLORS.brand} />
          <Text style={styles.tutorialTxt}>{"How to Play — Healer's Manual"}</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
        </Pressable>

        <Pressable style={styles.resetBtn} onPress={resetPlayer} testID="profile-reset-button">
          <Ionicons name="refresh" size={14} color={COLORS.error} />
          <Text style={styles.resetTxt}>Reset Account (Start Over)</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLbl}>{label}</Text>
      <Text style={styles.statVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxxl },
  head: { alignItems: "center", gap: 8, marginTop: SPACING.md },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceSecondary },
  name: { color: COLORS.onSurface, fontSize: 24, fontWeight: "400", marginTop: SPACING.sm },
  aptLine: { color: COLORS.brand, fontSize: 12, letterSpacing: 1.5, fontWeight: "600" },
  rankCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  label: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  rankName: { color: COLORS.onSurface, fontSize: 22, fontWeight: "300" },
  nextRank: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  bar: { height: 6, backgroundColor: COLORS.surfaceTertiary, borderRadius: 3, overflow: "hidden", marginTop: 8 },
  barFill: { height: "100%", backgroundColor: COLORS.brand },
  xpTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 4 },
  section: { color: COLORS.onSurface, fontSize: 18, marginTop: SPACING.sm, fontWeight: "400" },
  masteryGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  mCard: {
    width: "47%", backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, gap: 4,
  },
  mLabel: { color: COLORS.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "600" },
  mValue: { color: COLORS.brand, fontSize: 26, fontWeight: "300" },
  statsCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  statRow: { flexDirection: "row", justifyContent: "space-between" },
  statLbl: { color: COLORS.onSurfaceSecondary, fontSize: 14 },
  statVal: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: SPACING.md, marginTop: SPACING.md },
  resetTxt: { color: COLORS.error, fontSize: 12, fontWeight: "600" },
  tutorialBtn: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md, marginTop: SPACING.sm, backgroundColor: COLORS.brand + "12", borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.brand + "40" },
  tutorialTxt: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600", flex: 1 },
});
