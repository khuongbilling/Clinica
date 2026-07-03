import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BATTLE_MECHANICS, CODEX, ENEMIES } from "@/src/game/content";
import { DEPTH_INTRO, DEPTH_LABEL } from "@/src/game/onboarding";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { TUTORIAL_LABELS, TutorialId } from "@/src/game/tutorials";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const TUTORIAL_IDS: TutorialId[] = ["firstBattle", "firstKingdom", "firstSummon"];

const TUTORIAL_ICONS: Record<TutorialId, string> = {
  firstBattle: "shield",
  firstKingdom: "home",
  firstSummon: "sparkles",
};

const TUTORIAL_DESC: Record<TutorialId, string> = {
  firstBattle: "Learn Scout, Stabilize, and Counter — the care chain that wins battles.",
  firstKingdom: "Explore your kingdom buildings and understand how the realm grows.",
  firstSummon: "Spend Codex Shards to call new healers with unique clinical skills.",
};

export default function CodexScreen() {
  const { player } = usePlayer();
  const { completed, replayTutorial } = useTutorial();
  if (!player) return null;
  const unlocked = new Set(player.codex_unlocked);
  const depth = player.codex_depth || "simple";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>THE GREAT CODEX</Text>
        <Text style={styles.title}>Library of Knowledge</Text>
        <Text style={styles.sub}>{unlocked.size} of {CODEX.length} pages restored</Text>

        <View style={styles.depthCard} testID="codex-depth-banner">
          <Ionicons name="bookmark" size={14} color={COLORS.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.depthLabel}>{(DEPTH_LABEL[depth] || "General Reading").toUpperCase()}</Text>
            <Text style={styles.depthIntro}>{DEPTH_INTRO[depth] || DEPTH_INTRO.simple}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Tutorial Replay Section */}
        <View style={styles.tutSection}>
          <View style={styles.tutSectionHead}>
            <Ionicons name="play-circle" size={16} color={COLORS.brand} />
            <Text style={styles.tutSectionTitle}>TUTORIALS</Text>
          </View>
          <Text style={styles.tutSectionSub}>
            Tutorials teach the first steps. Codex entries below explain the deeper clinical meaning.
          </Text>
          {TUTORIAL_IDS.map((id) => {
            const isDone = !!completed[id];
            return (
              <View key={id} style={styles.tutCard} testID={`tutorial-card-${id}`}>
                <View style={[styles.tutIcon, isDone && { backgroundColor: COLORS.brand + "20", borderColor: COLORS.brand + "40" }]}>
                  <Ionicons name={TUTORIAL_ICONS[id] as any} size={18} color={isDone ? COLORS.brand : COLORS.onSurfaceTertiary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.tutCardHead}>
                    <Text style={styles.tutName}>{TUTORIAL_LABELS[id]}</Text>
                    {isDone && (
                      <View style={styles.doneBadge}>
                        <Ionicons name="checkmark" size={10} color={COLORS.brand} />
                        <Text style={styles.doneTxt}>DONE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.tutDesc}>{TUTORIAL_DESC[id]}</Text>
                </View>
                <Pressable
                  onPress={() => replayTutorial(id)}
                  style={styles.replayBtn}
                  testID={`tutorial-replay-${id}`}
                  hitSlop={8}
                >
                  <Ionicons name="refresh" size={14} color={COLORS.brand} />
                  <Text style={styles.replayTxt}>REPLAY</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Battle Mechanics — always visible */}
        <Text style={styles.section}>Battle Mechanics</Text>
        {BATTLE_MECHANICS.map((m) => (
          <View key={m.id} style={styles.card} testID={`mechanic-${m.id}`}>
            <View style={styles.mechHead}>
              <Ionicons name={m.icon as any} size={16} color={COLORS.brand} />
              <Text style={styles.mechTitle}>{m.title}</Text>
            </View>
            <Text style={styles.entryBody}>{m.body}</Text>
          </View>
        ))}

        {/* Codex Entries */}
        <Text style={styles.section}>Codex Pages</Text>
        {CODEX.map((entry) => {
          const isUnlocked = unlocked.has(entry.id);
          const c = ELEMENT_COLORS[entry.system];
          const linkedEnemies = ENEMIES.filter((e) => e.teaches.includes(entry.id));
          const firstEnemy = linkedEnemies[0];
          return (
            <View key={entry.id} style={styles.card} testID={`codex-entry-${entry.id}`}>
              <View style={styles.cardHead}>
                <View style={[styles.elementBadge, { backgroundColor: c + "22", borderColor: c }]}>
                  <Text style={[styles.elementText, { color: c }]}>{entry.system.toUpperCase()}</Text>
                </View>
                <View style={styles.level}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <View key={i} style={[styles.lvlDot, i < entry.level && { backgroundColor: COLORS.brand }]} />
                  ))}
                </View>
              </View>
              {isUnlocked ? (
                <>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  <Text style={styles.entryBody}>{entry.body}</Text>

                  {firstEnemy && (
                    <View style={styles.clinicBox}>
                      <Text style={styles.clinicLabel}>REAL CLINICAL CONCEPT</Text>
                      <Text style={styles.clinicReal}>{firstEnemy.realWorld}</Text>

                      {firstEnemy.visibleClues.length > 0 && (
                        <>
                          <Text style={[styles.clinicLabel, { marginTop: 8 }]}>CLUES TO RECOGNIZE</Text>
                          <View style={styles.clueRow}>
                            {firstEnemy.visibleClues.map((cl) => (
                              <View key={cl.id} style={styles.cluePill}>
                                <Text style={styles.clueTxt}>{cl.label}</Text>
                              </View>
                            ))}
                          </View>
                        </>
                      )}

                      {firstEnemy.dangerTrigger && (
                        <>
                          <Text style={[styles.clinicLabel, { marginTop: 8 }]}>DANGER TO WATCH FOR</Text>
                          <Text style={styles.clinicDanger}>{firstEnemy.dangerTrigger}</Text>
                        </>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.locked}>
                  <Ionicons name="lock-closed" size={20} color={COLORS.onSurfaceTertiary} />
                  <Text style={styles.lockedTitle}>Sealed Page</Text>
                  <Text style={styles.lockedSub}>Defeat a {entry.system} corruption to reveal this lore.</Text>
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
  depthCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.md,
    backgroundColor: COLORS.brand + "12", borderColor: COLORS.brand + "40", borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.sm,
  },
  depthLabel: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  depthIntro: { color: COLORS.onSurfaceSecondary, fontSize: 12, marginTop: 2, lineHeight: 16 },
  scroll: { padding: SPACING.lg, paddingTop: 0, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  section: { color: COLORS.onSurface, fontSize: 18, fontWeight: "400", marginTop: SPACING.sm },

  tutSection: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  tutSectionHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  tutSectionTitle: { color: COLORS.brand, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  tutSectionSub: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15, marginBottom: SPACING.xs },
  tutCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm,
    padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  tutIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  tutCardHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  tutName: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  doneBadge: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: COLORS.brand + "20", borderRadius: RADIUS.pill,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  doneTxt: { color: COLORS.brand, fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  tutDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15 },
  replayBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.brand + "50",
    flexShrink: 0,
  },
  replayTxt: { color: COLORS.brand, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },

  card: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  elementBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, borderWidth: 1 },
  elementText: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  level: { flexDirection: "row", gap: 4 },
  lvlDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.surfaceTertiary },
  entryTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: "400" },
  entryBody: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21 },
  mechHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  mechTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: "600" },
  locked: { alignItems: "center", paddingVertical: SPACING.lg, gap: 6 },
  lockedTitle: { color: COLORS.onSurfaceTertiary, fontSize: 14, fontWeight: "500" },
  lockedSub: { color: COLORS.onSurfaceTertiary, fontSize: 12, textAlign: "center", paddingHorizontal: SPACING.lg },

  clinicBox: {
    marginTop: SPACING.sm, padding: SPACING.sm,
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
    gap: 4,
  },
  clinicLabel: { color: COLORS.brand, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  clinicReal: { color: COLORS.onSurface, fontSize: 13, fontWeight: "500", lineHeight: 18 },
  clueRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cluePill: {
    backgroundColor: COLORS.brand + "14", borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: COLORS.brand + "30",
  },
  clueTxt: { color: COLORS.brand, fontSize: 11, fontWeight: "600" },
  clinicDanger: { color: COLORS.error, fontSize: 12, lineHeight: 17 },
});
