/**
 * Opening Prologue — Push 1 v2 Phase State Machine
 *
 * Drives the 11-phase new cinematic prologue for brand-new players.
 * Each phase shows a placeholder scene card (title + description + art slot).
 * "Continue" advances to the next phase and persists the checkpoint so the
 * app can resume after a crash or close.  The final phase routes to the hub.
 *
 * Phase-specific art, animations, and interactions will be layered in on
 * subsequent pushes — this file owns the state machine skeleton and routing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { ROUTES } from "@/src/game/routes";
import { usePlayer } from "@/src/game/store";
import { COLORS, SPACING } from "@/src/theme/colors";
import {
  PROLOGUE_PHASES,
  PROLOGUE_PHASE_LABELS,
  PROLOGUE_PHASE_DESCRIPTIONS,
  PROLOGUE_FIRST_PHASE,
  PROLOGUE_LAST_PHASE,
  nextProloguePhase,
  isValidProloguePhase,
  prologuePhaseIndex,
  type ProloguePhase,
} from "@/src/game/prologueTypes";
import OpeningMemoryCinematic from "@/src/components/prologue/OpeningMemoryCinematic";

// Phase accent palette — each phase gets a distinct colour to help signal
// the emotional beat of that scene.  Replace with art-matched palette later.
const PHASE_ACCENTS: Record<ProloguePhase, string> = {
  opening_memory_cinematic:                    "#7EB8F7",
  former_self_battlefield_cutscene:            "#5AC8A8",
  silent_infarction_initial_reveal:            "#F77B72",
  former_self_support_loadout:                 "#9B8CF7",
  opening_battle_tutorial:                     "#4FD8C4",
  scripted_defeat:                             "#C45C5C",
  lotus_recall_cinematic:                      "#E0AAFF",
  identity_reconstruction_character_creation:  "#F7C948",
  post_rebirth_awakening:                      "#80E8A0",
  memory_echo_award_scene:                     "#F7C948",
  clinica_university_introduction:             "#4FD8C4",
};

export default function OpeningPrologue() {
  const router = useRouter();
  const { player, advanceProloguePhase, completePrologueCinematic } = usePlayer();

  // Determine the active phase from persisted player state.
  const rawPhase = player?.opening_prologue_phase;
  const activePhase: ProloguePhase = isValidProloguePhase(rawPhase)
    ? rawPhase
    : PROLOGUE_FIRST_PHASE;

  const [busy, setBusy] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // If the prologue is already complete, skip to hub immediately.
  useEffect(() => {
    if (player?.opening_prologue_complete === true) {
      router.replace(ROUTES.HOME);
    }
  }, [player?.opening_prologue_complete, router]);

  // Fade in whenever the active phase changes.
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [activePhase, fadeAnim]);

  const handleContinue = useCallback(async () => {
    if (busy) return;
    setBusy(true);

    const next = nextProloguePhase(activePhase);

    if (!next) {
      // This was the last phase — mark the entire prologue complete.
      await completePrologueCinematic();
      if (mountedRef.current) router.replace(ROUTES.HOME);
    } else {
      await advanceProloguePhase(next);
      // advanceProloguePhase persists the phase; the state-machine re-renders
      // automatically when player.opening_prologue_phase updates.
      if (mountedRef.current) setBusy(false);
    }
  }, [busy, activePhase, advanceProloguePhase, completePrologueCinematic, router]);

  const phaseIdx   = prologuePhaseIndex(activePhase);
  const totalPhases = PROLOGUE_PHASES.length;
  const accent     = PHASE_ACCENTS[activePhase];
  const label      = PROLOGUE_PHASE_LABELS[activePhase];
  const description = PROLOGUE_PHASE_DESCRIPTIONS[activePhase];
  const isLast     = activePhase === PROLOGUE_LAST_PHASE;

  // ── Phase 1: full-screen cinematic takeover ──────────────────────────────
  // The cinematic manages its own layout, animation, and tap-to-advance UX.
  // When all 8 memory beats finish it calls handleContinue, which persists
  // the phase advance to `former_self_battlefield_cutscene`.
  if (activePhase === "opening_memory_cinematic") {
    return <OpeningMemoryCinematic onComplete={handleContinue} />;
  }

  return (
    <View style={styles.root}>
      {/* Ambient gradient keyed to the phase colour */}
      <LinearGradient
        colors={[`${accent}22`, "rgba(6,14,20,0.98)"]}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe}>
        {/* Progress bar */}
        <View style={styles.progressRow}>
          {PROLOGUE_PHASES.map((ph, i) => (
            <View
              key={ph}
              style={[
                styles.pip,
                i < phaseIdx  && { backgroundColor: accent, opacity: 0.5 },
                i === phaseIdx && { backgroundColor: accent, width: 20 },
                i > phaseIdx  && { backgroundColor: "rgba(255,255,255,0.12)" },
              ]}
            />
          ))}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            {/* Phase kicker */}
            <Text style={[styles.kicker, { color: accent }]}>
              {`CHAPTER ${phaseIdx + 1} · ${totalPhases}`}
            </Text>

            {/* Art placeholder slot */}
            <View style={[styles.artSlot, { borderColor: `${accent}44` }]}>
              <Text style={[styles.artPlaceholder, { color: `${accent}66` }]}>
                ✦
              </Text>
              <Text style={[styles.artLabel, { color: `${accent}88` }]}>
                Scene art coming soon
              </Text>
            </View>

            {/* Phase title */}
            <Text style={styles.phaseTitle}>{label}</Text>

            {/* Phase description */}
            <Text style={styles.phaseBody}>{description}</Text>
          </Animated.View>
        </ScrollView>

        {/* Continue button */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: accent, shadowColor: accent },
              pressed && styles.btnPressed,
              busy && styles.btnDisabled,
            ]}
            onPress={handleContinue}
            disabled={busy}
          >
            <Text style={styles.btnText}>
              {busy ? "…" : isLast ? "ENTER THE KINGDOM" : "CONTINUE"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: "#060E14" },
  safe:  { flex: 1 },

  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 16,
    paddingHorizontal: 24,
  },
  pip: {
    height: 4,
    flex: 1,
    borderRadius: 2,
  },

  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
  },

  card: {
    alignItems: "center",
    gap: SPACING.lg,
  },

  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    textAlign: "center",
  },

  artSlot: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  artPlaceholder: {
    fontSize: 40,
  },
  artLabel: {
    fontSize: 12,
    letterSpacing: 1,
  },

  phaseTitle: {
    color: "#F4F7FB",
    fontSize: 28,
    fontWeight: "300",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  phaseBody: {
    color: "#8A97AB",
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 340,
  },

  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: "center",
  },
  btn: {
    paddingVertical: 16,
    paddingHorizontal: 56,
    borderRadius: 999,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  btnPressed:  { opacity: 0.82, transform: [{ scale: 0.97 }] },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    color: "#060E14",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 2.5,
  },
});
