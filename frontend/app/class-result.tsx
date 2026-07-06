import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { CLASS_IDENTITIES, getClassTree, type ClassId } from "@/src/game/classTree";
import {
  CLASS_FLAVOR_TITLE, CLASS_WHY_FITS, formatResonance, fantasyClassFromClassId,
  classIdFromFantasyClass, getFuturePathHint, type FantasyClass,
} from "@/src/game/classQuiz";
import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// Push 6 — "Review Class Result". A read-only recap of the player's current
// class (never mutates anything): the saved class, the modern-department
// resonance and second-closest fit captured at the moment it was last
// confirmed (see confirmClassDiagnostic in store.tsx / the backfill in
// normalizeProgression for legacy saves), its starting trait, and a future
// path hint. Switching classes is intentionally NOT duplicated here — the
// Class Tree screen already offers a free, forgiving switch, so this screen
// just links there.
export default function ClassResultScreen() {
  const router = useRouter();
  const { player } = usePlayer();

  if (!player) return null;

  const classId = (player.class_tree_id as ClassId) || "medic";
  const identity = CLASS_IDENTITIES[classId];
  const fantasyClass = fantasyClassFromClassId(classId);
  const resonance = player.class_diagnostic_resonance || "";
  const secondary = (player.class_diagnostic_secondary as FantasyClass) || fantasyClass;
  const secondaryClassId = classIdFromFantasyClass(secondary);
  const secondaryIdentity = CLASS_IDENTITIES[secondaryClassId];
  const trait = getClassTree(classId)[0];
  const futurePath = resonance ? getFuturePathHint(resonance, fantasyClass) : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router, "/(tabs)/profile")} style={styles.backBtn} hitSlop={10} testID="class-result-back">
            <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>YOUR CLASS</Text>
            <Text style={styles.title}>Class Result</Text>
          </View>
        </View>

        <View style={[styles.resultCard, { borderColor: identity.color + "40" }]} testID="class-result-card">
          <View style={[styles.resultIcon, { backgroundColor: identity.color + "22", borderColor: identity.color }]}>
            <Ionicons name={identity.icon as any} size={30} color={identity.color} />
          </View>
          <Text style={[styles.pathTitle, { color: identity.color }]}>{fantasyClass}</Text>
          <Text style={styles.flavorTitle}>{CLASS_FLAVOR_TITLE[fantasyClass]}</Text>
          <Text style={styles.body}>{CLASS_WHY_FITS[fantasyClass]}</Text>
        </View>

        <View style={[styles.setupCard, { borderColor: identity.color + "30" }]}>
          <Text style={styles.setupCardTitle}>SYSTEM ARCHIVE</Text>
          <View style={{ gap: SPACING.sm }}>
            {!!resonance && (
              <View style={styles.setupRow}>
                <Ionicons name="business-outline" size={14} color={COLORS.onSurfaceTertiary} />
                <Text style={styles.setupLabel}>Modern Department Resonance:</Text>
                <Text style={styles.setupValue}>{formatResonance(resonance)}</Text>
              </View>
            )}
            {trait && (
              <View style={styles.setupRow}>
                <Ionicons name="sparkles-outline" size={14} color={COLORS.onSurfaceTertiary} />
                <Text style={styles.setupLabel}>Starting Trait:</Text>
                <Text style={styles.setupValue}>{trait.name}</Text>
              </View>
            )}
            <View style={styles.setupRow}>
              <Ionicons name={secondaryIdentity.icon as any} size={14} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.setupLabel}>Second Closest Fit:</Text>
              <Text style={styles.setupValue}>{secondary}</Text>
            </View>
            {futurePath && (
              <View style={styles.setupRow}>
                <Ionicons name="telescope-outline" size={14} color={COLORS.onSurfaceTertiary} />
                <Text style={styles.setupLabel}>Future Path Hint:</Text>
                <Text style={styles.setupValue}>{futurePath}</Text>
              </View>
            )}
          </View>
          {trait && <Text style={styles.traitDesc}>{trait.description}</Text>}
        </View>

        <Text style={styles.note}>
          This is a snapshot, not a lock — your class stays freely re-trainable, and every
          future path keeps evolving as you train at the University.
        </Text>

        <Pressable
          style={[styles.switchBtn, { backgroundColor: identity.color }]}
          onPress={() => router.push("/class-tree")}
          testID="class-result-switch"
        >
          <Ionicons name="swap-horizontal" size={16} color={COLORS.onBrand} />
          <Text style={styles.switchBtnTxt}>Switch Class</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxl || 48 },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceSecondary },
  kicker: { color: COLORS.brand, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 22, fontWeight: "700" },
  resultCard: {
    alignItems: "center", gap: SPACING.sm, padding: SPACING.lg, borderRadius: RADIUS.lg,
    borderWidth: 1, backgroundColor: COLORS.surfaceSecondary,
  },
  resultIcon: {
    width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  pathTitle: { fontSize: 20, fontWeight: "800" },
  flavorTitle: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "600", textAlign: "center" },
  body: { color: COLORS.onSurfaceTertiary, fontSize: 13, lineHeight: 19, textAlign: "center" },
  setupCard: { padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, backgroundColor: COLORS.surfaceSecondary, gap: SPACING.sm },
  setupCardTitle: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  setupRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  setupLabel: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  setupValue: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700" },
  traitDesc: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 17, marginTop: SPACING.xs },
  note: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18, textAlign: "center" },
  switchBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.xs,
    paddingVertical: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.sm,
  },
  switchBtnTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700" },
});
