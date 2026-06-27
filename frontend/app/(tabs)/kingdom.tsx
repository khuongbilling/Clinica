import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BUILDINGS } from "@/src/game/content";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const ICONS: Record<string, string> = {
  academy_of_healing: "school",
  library_of_knowledge: "library",
  hall_of_heroes: "people-circle",
  apothecary: "flask",
};

const BODY_REGIONS = [
  { id: "Air Region",        name: "Air Temple",           system: "Respiratory System",     icon: "cloud",          max: 5 },
  { id: "River Region",      name: "River Gate",           system: "Cardiovascular System",  icon: "water",          max: 5 },
  { id: "Fire Region",       name: "Fire Ward",            system: "Immune / Infection",     icon: "flame",          max: 5 },
  { id: "Energy Region",     name: "Energy Shrine",        system: "Metabolic System",       icon: "flash",          max: 5 },
  { id: "Storm Region",      name: "Storm Observatory",    system: "Sepsis / Multi-system",  icon: "thunderstorm",   max: 5 },
  { id: "Mind Region",       name: "Mind Tower",           system: "Neurological System",    icon: "bulb",           max: 5 },
  { id: "Filter Region",     name: "Filter Basin",         system: "Renal System",           icon: "funnel",         max: 5 },
  { id: "Forge Region",      name: "Forge Hall",           system: "Musculoskeletal",        icon: "hammer",         max: 5 },
  { id: "Protection Region", name: "Protection Wall",      system: "Integumentary",          icon: "shield",         max: 5 },
  { id: "Growth Region",     name: "Growth Garden",        system: "Endocrine / Development",icon: "leaf",           max: 5 },
  { id: "Core",              name: "The Fading Core",      system: "Multi-system Boss",      icon: "planet",         max: 1 },
];

const REGION_ELEMENT: Record<string, string> = {
  "Air Region": "Air",
  "River Region": "River",
  "Fire Region": "Fire",
  "Energy Region": "Energy",
  "Storm Region": "Storm",
  "Mind Region": "Mind",
  "Filter Region": "Filter",
  "Forge Region": "Forge",
  "Protection Region": "Protection",
  "Growth Region": "Growth",
  "Core": "Storm",
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

  const regionProgress = player.region_progress || {};
  const totalRestored = Object.values(regionProgress).reduce((sum, v) => sum + v, 0);

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
          <Text style={styles.sub}>Each victory restores a body region and earns Codex knowledge.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <Stat label="Runs" value={String(player.runs_completed)} icon="flame" />
          <Stat label="Bosses" value={String(player.bosses_defeated.length)} icon="trophy" />
          <Stat label="Restored" value={String(totalRestored)} icon="globe" />
        </View>

        <Text style={styles.section}>Body Regions</Text>
        <Text style={styles.sectionSub}>Win battles to restore each region of the body kingdom.</Text>

        {BODY_REGIONS.map((r) => {
          const progress = regionProgress[r.id] || 0;
          const pct = Math.min(progress / r.max, 1);
          const color = ELEMENT_COLORS[REGION_ELEMENT[r.id]] || COLORS.brand;
          const unlocked = progress > 0;
          return (
            <View key={r.id} style={[styles.regionCard, !unlocked && styles.regionCardLocked]} testID={`kingdom-region-${r.id}`}>
              <View style={[styles.regionIcon, { borderColor: unlocked ? color : COLORS.border }]}>
                <Ionicons name={(r.icon as any)} size={20} color={unlocked ? color : COLORS.onSurfaceTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.regionHeader}>
                  <Text style={[styles.regionName, !unlocked && styles.regionNameLocked]}>{r.name}</Text>
                  <Text style={[styles.regionProgress, { color: unlocked ? color : COLORS.onSurfaceTertiary }]}>
                    {progress}/{r.max}
                  </Text>
                </View>
                <Text style={styles.regionSystem}>{r.system}</Text>
                <View style={styles.regionBar}>
                  <View style={[styles.regionBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
                </View>
                {!unlocked && (
                  <Text style={styles.regionLockHint}>Win a battle in this region to begin restoring it.</Text>
                )}
              </View>
            </View>
          );
        })}

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
  sectionSub: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: -SPACING.sm },

  regionCard: {
    flexDirection: "row", gap: SPACING.md, backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  regionCardLocked: { opacity: 0.6 },
  regionIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceTertiary },
  regionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  regionName: { color: COLORS.onSurface, fontSize: 15, fontWeight: "500" },
  regionNameLocked: { color: COLORS.onSurfaceTertiary },
  regionSystem: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  regionProgress: { fontSize: 12, fontWeight: "700" },
  regionBar: { height: 4, borderRadius: 2, backgroundColor: COLORS.surfaceTertiary, marginTop: 8, overflow: "hidden" },
  regionBarFill: { height: "100%", borderRadius: 2 },
  regionLockHint: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontStyle: "italic", marginTop: 4 },

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
