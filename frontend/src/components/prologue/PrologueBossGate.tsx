/**
 * PrologueBossGate — Push 11
 *
 * Phase: scripted_defeat
 *
 * Navigates to the real ward battle screen with the Silent Infarct boss.
 * The battle is narratively scripted to end in defeat (isPrologueBoss path
 * in battle.tsx forces loss at turn 6 if not already lost, then calls
 * advanceProloguePhase('lotus_recall_cinematic') and routes to /opening-prologue).
 *
 * Team: Florence Nightingale (legendary) + Alexander Fleming (legendary) +
 *       The Former Self (near-mythic) — set in battle.tsx via isPrologueBoss.
 */

import { useEffect } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function PrologueBossGate() {
  const router = useRouter();

  useEffect(() => {
    router.replace({
      pathname: "/battle",
      params: {
        enemyId: "silent_infarct",
        prologue: "boss",
      },
    } as Parameters<typeof router.replace>[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={s.root}>
      <Text style={s.text}>Preparing the ward…</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#040810", alignItems: "center", justifyContent: "center" },
  text: { color: "rgba(200,180,140,0.55)", fontSize: 13, letterSpacing: 1.5 },
});
