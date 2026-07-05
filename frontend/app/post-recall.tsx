import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// Push 2 post-recall onboarding. Runs immediately after Lotus Recall, before
// the player ever reaches the normal hub, in two resumable sub-steps:
//   1. Identity restoration — a System-styled name input that saves into the
//      same `player.name` field used everywhere else (header, profile).
//   2. Diagnostic intro — a System-styled teaser for the future class
//      diagnostic. No quiz or class assignment happens here; that is
//      deferred to a later push. This step only sets expectations.
// The screen re-derives which sub-step to show from persisted player flags
// (identity_restored / diagnostic_intro_seen) on every render, so a reload
// or app restart mid-sequence always resumes at the correct step instead of
// getting stuck or skipping ahead.
export default function PostRecall() {
  const router = useRouter();
  const { player, completeIdentityRestore, completeDiagnosticIntro } = usePlayer();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const phase: "identity" | "diagnostic" | "done" = !player
    ? "identity"
    : player.identity_restored === false
    ? "identity"
    : player.diagnostic_intro_seen === false
    ? "diagnostic"
    : "done";

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [phase, fadeAnim]);

  useEffect(() => {
    if (phase === "done") router.replace("/(tabs)");
  }, [phase, router]);

  useEffect(() => {
    if (player?.name && player.name !== "Healer") setName(player.name);
  }, [player?.name]);

  const submitIdentity = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await completeIdentityRestore(name.trim() || "Healer");
    } finally {
      setSubmitting(false);
    }
  };

  const submitDiagnosticIntro = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await completeDiagnosticIntro();
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "done") return null;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]} testID="post-recall-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        {phase === "identity" ? (
          <Animated.View style={[styles.block, { opacity: fadeAnim }]} testID="post-recall-identity">
            <Ionicons name="finger-print" size={36} color={COLORS.brand} />
            <Text style={styles.systemLine}>SYSTEM: Identity record fragmented.</Text>
            <Text style={styles.systemLine}>SYSTEM: Restore designation.</Text>
            <Text style={styles.body}>
              The Lotus Recall preserved you, but not every record. Before the Sanctuary can
              re-open your file, it needs a name to write it under.
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your designation"
              placeholderTextColor={COLORS.onSurfaceTertiary}
              style={styles.input}
              maxLength={24}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={submitIdentity}
              testID="post-recall-name-input"
            />
            <Pressable
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={submitIdentity}
              disabled={submitting}
              testID="post-recall-name-continue"
            >
              <Text style={styles.buttonTxt}>CONFIRM DESIGNATION</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.block, { opacity: fadeAnim }]} testID="post-recall-diagnostic">
            <Ionicons name="pulse" size={36} color={COLORS.brand} />
            <Text style={styles.systemLine}>SYSTEM: Class resonance cannot be assigned by memory alone.</Text>
            <Text style={styles.systemLine}>SYSTEM: Respond. Your choices will shape your first pathway.</Text>
            <Text style={styles.body}>
              A diagnostic is coming — a short series of choices, not a test. It will only
              recommend a starting pathway for you, {player?.name || "Healer"}.
            </Text>
            <Text style={styles.note}>
              Nothing it suggests is permanent. Every pathway keeps evolving as you train at the
              University, no matter where you begin.
            </Text>
            <Pressable
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={submitDiagnosticIntro}
              disabled={submitting}
              testID="post-recall-diagnostic-continue"
            >
              <Text style={styles.buttonTxt}>ENTER THE SANCTUARY</Text>
            </Pressable>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  flex: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  block: { alignItems: "center", gap: SPACING.md, maxWidth: 380, width: "100%" },
  systemLine: { color: COLORS.brand, fontSize: 13, fontWeight: "700", letterSpacing: 0.5, textAlign: "center" },
  body: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: SPACING.xs },
  note: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18, textAlign: "center" },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    color: COLORS.onSurface,
    fontSize: 15,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
  },
  button: { backgroundColor: COLORS.brand, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, borderRadius: RADIUS.md, marginTop: SPACING.md, width: "100%", alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
});
