import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HEROES, APTITUDE_INFO } from "@/src/game/content";
import { usePlayer } from "@/src/game/store";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

function Stars({ rarity }: { rarity: number }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {Array.from({ length: rarity }).map((_, i) => (
        <Ionicons key={i} name="star" size={11} color={COLORS.brand} style={{ marginRight: 1 }} />
      ))}
    </View>
  );
}

export default function HeroesScreen() {
  const { player } = usePlayer();
  if (!player) return null;
  const owned = new Set(player.heroes_owned);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>HALL OF HEROES</Text>
        <Text style={styles.title}>Your Healers</Text>
        <Text style={styles.sub}>{player.heroes_owned.length} of {HEROES.length} recruited</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {HEROES.map((h) => {
          const isOwned = owned.has(h.id);
          const elementColor = ELEMENT_COLORS[h.element];
          return (
            <View key={h.id} style={[styles.card, !isOwned && { opacity: 0.45 }, { borderLeftColor: elementColor }]} testID={`hero-card-${h.id}`}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroName}>{h.name}</Text>
                  <Text style={styles.heroTitle}>{h.title}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Stars rarity={h.rarity} />
                  <Text style={[styles.role, { color: elementColor }]}>{h.role.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.desc}>{h.description}</Text>
              <View style={styles.skillList}>
                {h.skills.map((s) => (
                  <View key={s.id} style={styles.skill}>
                    <View style={styles.skillHead}>
                      <Text style={styles.skillName}>{s.name}</Text>
                      <View style={styles.cost}><Text style={styles.costTxt}>{s.cost} AP</Text></View>
                    </View>
                    <Text style={styles.skillDesc}>{s.description}</Text>
                  </View>
                ))}
              </View>
              {!isOwned && (
                <View style={styles.lockedTag}>
                  <Ionicons name="lock-closed" size={12} color={COLORS.onSurfaceTertiary} />
                  <Text style={styles.lockedTxt}>Not yet recruited — unlock through gameplay</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: { padding: SPACING.lg, gap: 4 },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 28, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  scroll: { padding: SPACING.lg, paddingTop: 0, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  card: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, gap: SPACING.sm,
  },
  cardHead: { flexDirection: "row", alignItems: "flex-start" },
  heroName: { color: COLORS.onSurface, fontSize: 18, fontWeight: "500" },
  heroTitle: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  role: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  desc: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18, fontStyle: "italic" },
  skillList: { gap: SPACING.sm, marginTop: 4 },
  skill: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm, padding: SPACING.sm },
  skillHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  skillName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  cost: { backgroundColor: COLORS.brandTertiary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill },
  costTxt: { color: COLORS.brand, fontSize: 10, fontWeight: "700" },
  skillDesc: { color: COLORS.onSurfaceSecondary, fontSize: 12, marginTop: 4, lineHeight: 16 },
  lockedTag: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  lockedTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
});
