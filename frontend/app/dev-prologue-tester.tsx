/**
 * Dev-Only Prologue Scene Tester
 *
 * Lets developers jump to any of the 11 prologue phases without replaying
 * the whole sequence.  Gated by __DEV__ — production builds show a simple
 * "Not available" screen so the route doesn't 404 if somehow reached.
 *
 * Access via ROUTES.devPrologueTester ("/dev-prologue-tester").
 * The route is registered in routes.ts but never surfaced in any nav element
 * in production code (only __DEV__ deep-link or manual URL bar use).
 */

import { useCallback } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { ROUTES } from "@/src/game/routes";
import { usePlayer } from "@/src/game/store";
import { COLORS, SPACING } from "@/src/theme/colors";
import {
  PROLOGUE_PHASES,
  PROLOGUE_PHASE_LABELS,
  type ProloguePhase,
} from "@/src/game/prologueTypes";

export default function DevPrologueTester() {
  const router = useRouter();
  const { player, advanceProloguePhase, completePrologueCinematic } = usePlayer();

  const jumpToPhase = useCallback(async (phase: ProloguePhase) => {
    // Persist the phase then navigate; the opening-prologue screen reads from
    // player.opening_prologue_phase so it renders the correct scene.
    await advanceProloguePhase(phase);
    router.replace(ROUTES.openingPrologue);
  }, [advanceProloguePhase, router]);

  const resetPrologue = useCallback(async () => {
    await advanceProloguePhase(PROLOGUE_PHASES[0]);
    router.replace(ROUTES.openingPrologue);
  }, [advanceProloguePhase, router]);

  const skipToHub = useCallback(async () => {
    await completePrologueCinematic();
    router.replace(ROUTES.HOME);
  }, [completePrologueCinematic, router]);

  if (!__DEV__) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.centerSafe}>
          <Text style={styles.empty}>Dev tester not available in production.</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backTxt}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Prologue Scene Tester</Text>
          <Text style={styles.subtitle}>
            Current phase:{" "}
            <Text style={styles.highlight}>
              {player?.opening_prologue_phase ?? "(none)"}
            </Text>
          </Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Quick-action row */}
          <View style={styles.quickRow}>
            <Pressable style={[styles.quickBtn, { backgroundColor: "#4FD8C4" }]} onPress={resetPrologue}>
              <Text style={styles.quickTxt}>↩ Reset to Phase 1</Text>
            </Pressable>
            <Pressable style={[styles.quickBtn, { backgroundColor: "#F77B72" }]} onPress={skipToHub}>
              <Text style={styles.quickTxt}>⤮ Skip → Hub</Text>
            </Pressable>
          </View>

          {/* Phase jump buttons */}
          <Text style={styles.sectionLabel}>JUMP TO PHASE</Text>
          {PROLOGUE_PHASES.map((phase, i) => {
            const isActive = player?.opening_prologue_phase === phase;
            return (
              <Pressable
                key={phase}
                style={({ pressed }) => [
                  styles.phaseRow,
                  isActive && styles.phaseRowActive,
                  pressed && styles.phaseRowPressed,
                ]}
                onPress={() => jumpToPhase(phase)}
              >
                <View style={[styles.phaseIdx, isActive && styles.phaseIdxActive]}>
                  <Text style={styles.phaseIdxTxt}>{i + 1}</Text>
                </View>
                <View style={styles.phaseInfo}>
                  <Text style={[styles.phaseName, isActive && styles.phaseNameActive]}>
                    {PROLOGUE_PHASE_LABELS[phase]}
                  </Text>
                  <Text style={styles.phaseId}>{phase}</Text>
                </View>
                {isActive && (
                  <View style={styles.activePip} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.surface },
  safe:       { flex: 1 },
  centerSafe: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty:      { color: COLORS.onSurfaceTertiary, fontSize: 14, textAlign: "center" },

  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: 6,
  },
  backBtn:   {},
  backTxt:   { color: COLORS.brand, fontSize: 14 },
  title:     { color: COLORS.onSurface, fontSize: 22, fontWeight: "700" },
  subtitle:  { color: COLORS.onSurfaceSecondary, fontSize: 13 },
  highlight: { color: COLORS.brand, fontWeight: "700" },

  scroll:        { flex: 1 },
  scrollContent: { padding: SPACING.lg, gap: SPACING.sm },

  quickRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  quickTxt: { color: "#060E14", fontWeight: "700", fontSize: 13 },

  sectionLabel: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 4,
  },

  phaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  phaseRowActive:  { borderColor: COLORS.brand, backgroundColor: `${COLORS.brand}14` },
  phaseRowPressed: { opacity: 0.75 },

  phaseIdx: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  phaseIdxActive: { backgroundColor: COLORS.brand },
  phaseIdxTxt:   { color: "#F4F7FB", fontSize: 13, fontWeight: "700" },

  phaseInfo: { flex: 1, gap: 2 },
  phaseName:       { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  phaseNameActive: { color: COLORS.brand },
  phaseId: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontFamily: "monospace" },

  activePip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.brand,
  },
});
