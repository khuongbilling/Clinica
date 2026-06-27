import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BUILDINGS } from "@/src/game/content";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const ICONS: Record<string, string> = {
  academy_of_healing: "school",
  library_of_knowledge: "library",
  hall_of_heroes: "people-circle",
  apothecary: "flask",
};

export default function KingdomScreen() {
  const { player } = usePlayer();
  const { isCompleted, startTutorial } = useTutorial();

  useEffect(() => {
    if (!isCompleted("firstKingdom")) {
      const t = setTimeout(() => startTutorial("firstKingdom"), 600);
      return () => clearTimeout(t);
    }
  }, []);

  if (!player) return null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero} testID="kingdom-map">
        <Image
          source={{ uri: "https://images.pexels.com/photos/29672206/pexels-photo-29672206.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={["rgba(17,19,21,0.3)", "rgba(17,19,21,0.85)", COLORS.surface]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.heroInner}>
          <Text style={styles.kicker}>KINGDOM OF CLINICA</Text>
          <Text style={styles.title}>Rebuild the Realm</Text>
          <Text style={styles.sub}>Each shift earns codex pages and restores the kingdom.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <Stat label="Runs" value={String(player.runs_completed)} icon="flame" />
          <Stat label="Bosses" value={String(player.bosses_defeated.length)} icon="trophy" />
          <Stat label="Heroes" value={String(player.heroes_owned.length)} icon="people" />
        </View>

        <Text style={styles.section}>Buildings</Text>

        {BUILDINGS.map((b) => {
          const lvl = player.kingdom_levels[b.id] || 0;
          return (
            <View key={b.id} style={styles.bCard} testID={`kingdom-building-${b.id}`}>
              <View style={[styles.bIcon, { borderColor: COLORS.brand }]}>
                <Ionicons name={(ICONS[b.id] as any) || "business"} size={24} color={COLORS.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={styles.bName}>{b.name}</Text>
                  <Text style={styles.bLvl}>LVL {lvl}</Text>
                </View>
                <Text style={styles.bDesc}>{b.description}</Text>
                <Text style={styles.bUnlock}>{b.unlocks}</Text>
                <View style={styles.lvlBar}>
                  {Array.from({ length: b.maxLevel }).map((_, i) => (
                    <View key={i} style={[styles.lvlSeg, i < lvl && { backgroundColor: COLORS.brand }]} />
                  ))}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <TutorialOverlay />
    </SafeAreaView>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon as any} size={18} color={COLORS.brand} />
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: { height: 160 },
  heroInner: { flex: 1, padding: SPACING.lg, justifyContent: "flex-end", gap: 4 },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 30, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 13 },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  statsRow: { flexDirection: "row", gap: SPACING.md },
  stat: {
    flex: 1, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: "center", gap: 4, borderWidth: 1, borderColor: COLORS.border,
  },
  statVal: { color: COLORS.onSurface, fontSize: 22, fontWeight: "300" },
  statLbl: { color: COLORS.onSurfaceTertiary, fontSize: 11, letterSpacing: 1 },
  section: { color: COLORS.onSurface, fontSize: 18, marginTop: SPACING.md, fontWeight: "400" },
  bCard: {
    flexDirection: "row", gap: SPACING.md, backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  bIcon: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceTertiary },
  bName: { color: COLORS.onSurface, fontSize: 16, fontWeight: "500" },
  bLvl: { color: COLORS.brand, fontSize: 11, fontWeight: "700" },
  bDesc: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  bUnlock: { color: COLORS.brand, fontSize: 11, marginTop: 4, fontStyle: "italic" },
  lvlBar: { flexDirection: "row", gap: 3, marginTop: 8 },
  lvlSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: COLORS.surfaceTertiary },
});
