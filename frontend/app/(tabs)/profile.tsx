import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APTITUDE_INFO, RANKS } from "@/src/game/content";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import {
  nextClassAbility, playerClassForAptitude, playerLevelFromXp,
  unlockedClassAbilities,
} from "@/src/game/progression";

const MASTERY_LABELS: Record<string, string> = {
  assessment: "Assessment",
  stabilization: "Stabilization",
  pharmacology: "Pharmacology",
  judgment: "Judgment",
  command: "Command",
  systems: "Systems",
};

// Intentionally no <PlayerHeader> on this screen (Push 5.5 decision): the
// header's identity row (avatar/name/rank/class) exists to link INTO this
// exact Profile screen, and its own head block below already covers that
// same info plus rank/XP progress — stacking PlayerHeader here would just
// duplicate it. Wallet chips (stamina/coins/gems) live on hub screens only;
// Profile is the deep identity/settings page, not another hub surface.
export default function ProfileScreen() {
  const router = useRouter();
  const { player, resetPlayer } = usePlayer();
  const { resetTutorials } = useTutorial();

  async function handleReset() {
    await resetTutorials();
    resetPlayer();
  }

  if (!player) return null;
  const apt = APTITUDE_INFO[player.aptitude];
  const nextRank = RANKS[player.rank_index + 1];

  const playerLevelInfo = playerLevelFromXp(player.xp);
  const playerClass = playerClassForAptitude(player.aptitude);
  const unlockedAbilities = unlockedClassAbilities(player.aptitude, playerLevelInfo.level);
  const nextAbility = nextClassAbility(player.aptitude, playerLevelInfo.level);

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

        <View style={styles.classCard} testID="profile-player-class">
          <Text style={styles.label}>PLAYER CLASS</Text>
          <Text style={styles.rankName}>{playerClass}</Text>
          <Text style={styles.nextRank}>Player Level {playerLevelInfo.level}</Text>
          {unlockedAbilities.length > 0 && (
            <View style={{ gap: 6, marginTop: 6 }}>
              {unlockedAbilities.map((a) => (
                <View key={a.name} style={styles.abilityRow} testID={`class-ability-${a.level}`}>
                  <Text style={styles.abilityLevel}>Lv.{a.level}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.abilityName}>{a.name}</Text>
                    <Text style={styles.abilityDesc}>{a.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          {nextAbility ? (
            <Text style={[styles.nextRank, { marginTop: 6 }]}>
              Next: {nextAbility.name} at Lv.{nextAbility.level} — {nextAbility.description}
            </Text>
          ) : (
            <Text style={[styles.nextRank, { marginTop: 6 }]}>All class abilities unlocked.</Text>
          )}
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

        <Text style={styles.section}>Settings</Text>
        <View style={styles.settingsCard}>
          <Pressable
            style={styles.settingsRow}
            onPress={() => router.push("/tutorial")}
            testID="profile-tutorial-button"
          >
            <Ionicons name="book-outline" size={18} color={COLORS.brand} />
            <Text style={styles.settingsRowTxt}>{"How to Play — Healer's Manual"}</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
          <View style={styles.settingsDivider} />
          <Pressable
            style={styles.settingsRow}
            onPress={() => router.push("/(tabs)/codex")}
            testID="profile-codex-button"
          >
            <Ionicons name="library-outline" size={18} color={COLORS.brand} />
            <Text style={styles.settingsRowTxt}>Research Library (Codex)</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
          <View style={styles.settingsDivider} />
          <Pressable
            style={styles.settingsRow}
            onPress={() => router.push("/economy")}
            testID="profile-economy-button"
          >
            <Ionicons name="diamond-outline" size={18} color={COLORS.brand} />
            <Text style={styles.settingsRowTxt}>Economy Guide</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
          <View style={styles.settingsDivider} />
          <Pressable
            style={styles.settingsRow}
            onPress={() => router.push("/materials")}
            testID="profile-materials-button"
          >
            <Ionicons name="cube-outline" size={18} color={COLORS.brand} />
            <Text style={styles.settingsRowTxt}>Material Guide</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
          <View style={styles.settingsDivider} />
          <View style={styles.settingsRow} testID="profile-achievements-row">
            <Ionicons name="trophy-outline" size={18} color={COLORS.onSurfaceTertiary} />
            <Text style={[styles.settingsRowTxt, { color: COLORS.onSurfaceTertiary }]}>Achievements</Text>
            <Text style={styles.comingSoonTag}>SOON</Text>
          </View>
          <View style={styles.settingsDivider} />
          <View style={styles.settingsRow} testID="profile-support-row">
            <Ionicons name="help-buoy-outline" size={18} color={COLORS.onSurfaceTertiary} />
            <Text style={[styles.settingsRowTxt, { color: COLORS.onSurfaceTertiary }]}>Support & Legal</Text>
            <Text style={styles.comingSoonTag}>SOON</Text>
          </View>
        </View>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerLabel}>DANGER ZONE</Text>
          <Pressable style={styles.resetBtn} onPress={handleReset} testID="profile-reset-button">
            <Ionicons name="refresh" size={14} color={COLORS.error} />
            <Text style={styles.resetTxt}>Reset Account (Start Over)</Text>
          </Pressable>
        </View>
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
  classCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  abilityRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start" },
  abilityLevel: { color: COLORS.brand, fontSize: 11, fontWeight: "700", width: 40 },
  abilityName: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  abilityDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 1 },
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
  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: SPACING.md },
  resetTxt: { color: COLORS.error, fontSize: 12, fontWeight: "600" },
  tutorialBtn: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md, marginTop: SPACING.sm, backgroundColor: COLORS.brand + "12", borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.brand + "40" },
  tutorialTxt: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600", flex: 1 },
  settingsCard: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  settingsRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md },
  settingsRowTxt: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600", flex: 1 },
  settingsDivider: { height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.md + 18 + SPACING.sm },
  comingSoonTag: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  dangerZone: { borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.error + "35", backgroundColor: COLORS.error + "08" },
  dangerLabel: { color: COLORS.error, fontSize: 9, letterSpacing: 2, fontWeight: "700", paddingTop: SPACING.sm, paddingHorizontal: SPACING.md },
});
