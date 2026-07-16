import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { useEffect, useRef } from "react";
import { completeObjective, markObjectiveXpGranted } from "@/src/game/objectiveProgress";
import { CLASS_IDENTITIES, getClassTree, type ClassId } from "@/src/game/classTree";
import {
  CLASS_FLAVOR_TITLE, CLASS_WHY_FITS, formatResonance, fantasyClassFromClassId,
  classIdFromFantasyClass, getFuturePathHint, type FantasyClass,
} from "@/src/game/classQuiz";
import { goBack } from "@/src/utils/navigation";
import { SystemNarratorBar } from "@/src/components/SystemNarratorBar";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";

export default function ClassResultScreen() {
  const router = useRouter();
  const { player, applyRewards } = usePlayer();

  // C1: grant obj_class_result (step 3 — Complete Class Diagnostic) once.
  // classGrantedRef prevents re-grant on revisit from Profile.
  const classGrantedRef = useRef(false);
  useEffect(() => {
    if (!player || classGrantedRef.current) return;
    classGrantedRef.current = true;
    completeObjective("obj_class_result").then(async (isNew) => {
      if (isNew) {
        await markObjectiveXpGranted("obj_class_result");
        await applyRewards({ xp: 10, codexShards: 0, crowns: 0, codex: [], enemyId: "", enemyName: "" });
      }
    });
  }, [player?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!player) {
    return (
      <SafeAreaView style={[styles.container, styles.loading]} edges={["top", "bottom"]} testID="class-result-loading">
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  const classId = (player.class_tree_id as ClassId) || "medic";
  const identity = CLASS_IDENTITIES[classId];
  const fantasyClass = fantasyClassFromClassId(classId);
  const resonance = player.class_diagnostic_resonance || "";
  const secondary = (player.class_diagnostic_secondary as FantasyClass) || fantasyClass;
  const secondaryClassId = classIdFromFantasyClass(secondary);
  const secondaryIdentity = CLASS_IDENTITIES[secondaryClassId];
  const trait = getClassTree(classId)[0];
  const futurePath = resonance ? getFuturePathHint(resonance, fantasyClass) : null;

  const handleDone = () => goBack(router, "/(tabs)/profile");

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="class-result-screen">
      {/* Scrollable content — paddingBottom leaves room for the sticky footer */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>

          {/* Header row */}
          <View style={styles.header}>
            <Pressable
              onPress={handleDone}
              style={styles.backBtn}
              hitSlop={10}
              testID="class-result-back"
            >
              <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.kicker}>YOUR CLASS</Text>
              <Text style={styles.title}>Class Result</Text>
            </View>
          </View>

          {/* System narrator message */}
          <SystemNarratorBar
            message="Your resonance pattern is confirmed. What you carry into this role, you carry into every battle. This is not a lock — it is a starting point."
            testID="class-result-narrator"
          />

          {/* Class identity reveal card */}
          <View
            style={[styles.resultCard, { borderColor: identity.color + "50" }]}
            testID="class-result-card"
          >
            <Text style={[styles.assignedKicker, { color: identity.color }]}>
              SYSTEM: CLASS ASSIGNMENT CONFIRMED
            </Text>

            {/* Icon badge */}
            <View
              style={[
                styles.resultIcon,
                { backgroundColor: identity.color + "1A", borderColor: identity.color + "80" },
              ]}
            >
              <Ionicons name={identity.icon as any} size={34} color={identity.color} />
            </View>

            {/* Class name — large, dominant, class color */}
            <Text style={[styles.pathTitle, { color: identity.color }]} testID="class-result-name">
              {fantasyClass}
            </Text>

            {/* Flavor subtitle */}
            <Text style={styles.flavorTitle}>{CLASS_FLAVOR_TITLE[fantasyClass]}</Text>

            {/* Why fits — wraps naturally */}
            <Text style={styles.body}>{CLASS_WHY_FITS[fantasyClass]}</Text>
          </View>

          {/* System Archive panel — each row is stacked (no single-line overflow) */}
          <View
            style={[styles.setupCard, { borderColor: identity.color + "30" }]}
            testID="class-result-archive"
          >
            <Text style={styles.setupCardTitle}>SYSTEM ARCHIVE</Text>

            {!!resonance && (
              <View style={styles.archiveRow}>
                <View style={styles.archiveRowLabel}>
                  <Ionicons name="business-outline" size={13} color={COLORS.onSurfaceTertiary} />
                  <Text style={styles.archiveLabel}>Modern Department Resonance</Text>
                </View>
                <Text style={styles.archiveValue}>{formatResonance(resonance)}</Text>
              </View>
            )}

            {trait && (
              <View style={styles.archiveRow}>
                <View style={styles.archiveRowLabel}>
                  <Ionicons name="sparkles-outline" size={13} color={COLORS.onSurfaceTertiary} />
                  <Text style={styles.archiveLabel}>Starting Trait</Text>
                </View>
                <Text style={styles.archiveValue}>{trait.name}</Text>
              </View>
            )}

            <View style={styles.archiveRow}>
              <View style={styles.archiveRowLabel}>
                <Ionicons name={secondaryIdentity.icon as any} size={13} color={COLORS.onSurfaceTertiary} />
                <Text style={styles.archiveLabel}>Second Closest Fit</Text>
              </View>
              <Text style={styles.archiveValue}>{secondary}</Text>
            </View>

            {futurePath && (
              <View style={styles.archiveRow}>
                <View style={styles.archiveRowLabel}>
                  <Ionicons name="telescope-outline" size={13} color={COLORS.onSurfaceTertiary} />
                  <Text style={styles.archiveLabel}>Future Path Hint</Text>
                </View>
                <Text style={styles.archiveValue}>{futurePath}</Text>
              </View>
            )}

            {trait && (
              <>
                <View style={styles.archiveDivider} />
                <Text style={styles.traitTitle}>{trait.name}</Text>
                <Text style={styles.traitDesc}>{trait.description}</Text>
              </>
            )}
          </View>

          {/* Reassurance note */}
          <Text style={styles.note}>
            This is a snapshot, not a lock — your class stays freely re-trainable, and every
            future path keeps evolving as you train at the University.
          </Text>

          {/* Secondary action: Switch Class */}
          <Pressable
            style={styles.switchBtn}
            onPress={() => router.push("/class-tree")}
            testID="class-result-switch"
          >
            <Ionicons name="swap-horizontal" size={14} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.switchBtnTxt}>Switch Class</Text>
          </Pressable>

        </View>
      </ScrollView>

      {/* Sticky footer — outside ScrollView so it's always visible */}
      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <Pressable
          style={[styles.doneBtn, { backgroundColor: identity.color }]}
          onPress={handleDone}
          testID="class-result-done"
        >
          <Ionicons name="checkmark" size={17} color={COLORS.onBrand} />
          <Text style={[styles.doneBtnTxt, { color: COLORS.onBrand }]}>Done</Text>
        </Pressable>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.sanctuaryBg },
  loading: { alignItems: "center", justifyContent: "center" },

  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  inner: {
    width: "100%",
    maxWidth: 480,
    gap: SPACING.md,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.sanctuaryPanel,
    borderWidth: 1,
    borderColor: UI.sanctuaryBorder,
  },
  headerText: { flex: 1 },
  kicker: { color: COLORS.brand, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 22, fontWeight: "700" },

  /* Class reveal card */
  resultCard: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    backgroundColor: UI.sanctuaryPanel,
  },
  assignedKicker: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: SPACING.xs,
  },
  resultIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    marginBottom: SPACING.xs,
  },
  pathTitle: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  flavorTitle: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    fontStyle: "italic",
  },
  body: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    paddingHorizontal: SPACING.xs,
  },

  /* System Archive panel — stacked 2-line rows, no overflow */
  setupCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    backgroundColor: UI.sanctuaryPanel,
    borderColor: UI.sanctuaryBorder,
    gap: SPACING.sm,
  },
  setupCardTitle: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: SPACING.xs,
  },
  archiveRow: {
    gap: 3,
  },
  archiveRowLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  archiveLabel: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 11,
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  archiveValue: {
    color: COLORS.onSurface,
    fontSize: 13,
    fontWeight: "700",
    paddingLeft: 18,
  },
  archiveDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xs,
  },
  traitTitle: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  traitDesc: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12,
    lineHeight: 18,
  },

  /* Reassurance note */
  note: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: SPACING.xs,
  },

  /* Switch Class secondary link */
  switchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    alignSelf: "center",
  },
  switchBtnTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  /* Sticky footer */
  footer: {
    backgroundColor: UI.sanctuaryBg,
    borderTopWidth: 1,
    borderTopColor: UI.sanctuaryBorder,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.md,
    width: "100%",
  },
  doneBtnTxt: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
