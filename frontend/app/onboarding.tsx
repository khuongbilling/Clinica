import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APTITUDE_INFO } from "@/src/game/content";
import { usePlayer } from "@/src/game/store";
import type { Aptitude } from "@/src/game/types";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const APTITUDES: Aptitude[] = ["guardian", "sage", "warden", "weaver"];

const APTITUDE_LORE: Record<Aptitude, string> = {
  guardian: "Stabilizer. Crisis responder. You hold the line when systems falter.",
  sage: "Reader of cues. You see patterns where others see chaos.",
  warden: "Keeper of safety. Coordination, delegation, infection control are your craft.",
  weaver: "Pattern weaver. Labs, trends, and data sing to you.",
};

export default function Onboarding() {
  const router = useRouter();
  const { createPlayer } = usePlayer();
  const [name, setName] = useState("");
  const [aptitude, setAptitude] = useState<Aptitude | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onBegin = async () => {
    if (!aptitude) return;
    setBusy(true);
    setError(null);
    try {
      await createPlayer(name.trim() || "Healer", aptitude);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message || "Could not begin your journey.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>CHAPTER I · THE FADING CORE</Text>
          <Text style={styles.title}>The Codex{"\n"}has shattered.</Text>
          <Text style={styles.lede}>
            Disease corruptions spread across Clinica. Choose your path, name yourself, and begin restoring the kingdom.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your healer name"
            placeholderTextColor={COLORS.onSurfaceTertiary}
            style={styles.input}
            maxLength={24}
            testID="onboarding-name-input"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>APTITUDE</Text>
          {APTITUDES.map((a) => {
            const info = APTITUDE_INFO[a];
            const selected = aptitude === a;
            return (
              <Pressable
                key={a}
                onPress={() => setAptitude(a)}
                style={[styles.aptCard, selected && { borderColor: info.color, backgroundColor: info.color + "14" }]}
                testID={`onboarding-aptitude-${a}`}
              >
                <View style={[styles.aptIconWrap, { borderColor: info.color }]}>
                  <Ionicons name={info.icon as any} size={22} color={info.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aptName}>{info.title}</Text>
                  <Text style={styles.aptLore}>{APTITUDE_LORE[a]}</Text>
                  <Text style={[styles.aptPassive, { color: info.color }]}>{info.passive}</Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={22} color={info.color} />}
              </Pressable>
            );
          })}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={onBegin}
          disabled={!aptitude || busy}
          style={[styles.cta, (!aptitude || busy) && { opacity: 0.4 }]}
          testID="onboarding-begin-button"
        >
          <LinearGradient colors={[COLORS.brand, COLORS.brandSecondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
          {busy ? <ActivityIndicator color={COLORS.onBrand} /> : <Text style={styles.ctaText}>BEGIN THE SHIFT</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.xl },
  header: { gap: SPACING.sm, marginTop: SPACING.md },
  kicker: { color: COLORS.brand, fontSize: 11, letterSpacing: 3, fontWeight: "600" },
  title: { color: COLORS.onSurface, fontSize: 38, lineHeight: 44, fontWeight: "300" },
  lede: { color: COLORS.onSurfaceSecondary, fontSize: 15, lineHeight: 22, marginTop: SPACING.sm },
  section: { gap: SPACING.md },
  label: { color: COLORS.onSurfaceTertiary, fontSize: 11, letterSpacing: 2, fontWeight: "600" },
  input: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    color: COLORS.onSurface,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  aptCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  aptIconWrap: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1,
    alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceTertiary,
  },
  aptName: { color: COLORS.onSurface, fontSize: 17, fontWeight: "500" },
  aptLore: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  aptPassive: { fontSize: 11, marginTop: 4, fontWeight: "500" },
  cta: {
    height: 56, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  ctaText: { color: COLORS.onBrand, fontSize: 14, fontWeight: "700", letterSpacing: 3 },
  error: { color: COLORS.error, fontSize: 13, textAlign: "center" },
});
