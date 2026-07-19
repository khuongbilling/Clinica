import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ROUTES } from "@/src/game/routes";
import { usePlayer } from "@/src/game/store";
import { COLORS, SPACING } from "@/src/theme/colors";
import { SceneTransition } from "@/src/components/onboarding/SceneTransition";
import { OnboardingProgressBar } from "@/src/components/onboarding/OnboardingProgressBar";
import { PROLOGUE_FIRST_PHASE } from "@/src/game/prologueTypes";

// Prologue entry-point — determines which prologue path to take:
//
//   A) Push 1 v2 (new cinematic prologue):
//      Brand-new players (no player object) or players with
//      opening_prologue_complete === false go to /opening-prologue where the
//      11-phase state machine runs.
//
//   B) Legacy path (old tutorial battle — still reachable by saves created
//      before Push 1 v2 that somehow have prologue_complete:false but
//      opening_prologue_complete:true, or by the dev tester bypass):
//      Route directly to the tutorial Ward Shift battle.
//
// Existing players always have opening_prologue_complete backfilled to true in
// normalizeProgression, so they never land here.
export default function Prologue() {
  const router = useRouter();
  const { player, createPlayer } = usePlayer();
  const [starting, setStarting] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;

    // ── Path A: new cinematic prologue (resume if mid-sequence) ────────────
    if (player && player.opening_prologue_complete === false) {
      startedRef.current = true;
      router.replace(ROUTES.openingPrologue);
      return;
    }

    // ── Path B: legacy tutorial battle (backward compat) ───────────────────
    if (player && player.prologue_complete === false) {
      startedRef.current = true;
      router.replace({
        pathname: "/mission-loadout",
        params: {
          enemyId: "dehydration_wisp",
          title: "First Ward Shift",
          partType: "battle",
          chapterAccent: "#4FD8C4",
          tutorial: "1",
        },
      });
      return;
    }

    // ── No player yet: create + send to new cinematic prologue ─────────────
    if (!player) {
      startedRef.current = true;
      setStarting(true);
      createPlayer({
        name: "Healer",
        aptitude: "guardian",
        codex_depth: "simple",
        prologue_complete: false,
        identity_restored: false,
        diagnostic_intro_seen: false,
        opening_prologue_complete: false,
        opening_prologue_phase: PROLOGUE_FIRST_PHASE,
      })
        .then(() => {
          router.replace(ROUTES.openingPrologue);
        })
        .catch(() => {
          setStarting(false);
          startedRef.current = false;
        });
    }
  }, [player, createPlayer, router]);

  return (
    <View style={styles.container} testID="prologue-screen">
      <SceneTransition style={styles.block}>
        <OnboardingProgressBar step="Prologue" />
        <Text style={styles.kicker}>THE KINGDOM OF HEALING</Text>
        <Text style={styles.title}>A patient needs you.</Text>
        <Text style={styles.body}>
          Somewhere in the ward, Stability is falling and Corruption is spreading.
          There is no time for paperwork — only the work itself.
        </Text>
        <View style={styles.subRow}>
          <ActivityIndicator size="small" color={COLORS.brand} />
          <Text style={styles.sub}>
            {starting ? "Entering the ward…" : "Preparing your first shift…"}
          </Text>
        </View>
      </SceneTransition>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  block: { alignItems: "center", gap: SPACING.md, maxWidth: 360, width: "100%" },
  kicker: { color: COLORS.brand, fontSize: 11, letterSpacing: 3, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 26, fontWeight: "300", textAlign: "center" },
  body: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  subRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.md },
  sub: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 1 },
});
