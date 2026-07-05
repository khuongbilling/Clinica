import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ENEMIES } from "@/src/game/content";
import { getEnemySprite } from "@/src/components/EnemySprites";
import { ModeCard } from "@/src/components/ModeCard";
import { RewardPreview } from "@/src/components/RewardPreview";
import { StaminaPill } from "@/src/components/StaminaPill";
import { usePlayer } from "@/src/game/store";
import { goBack } from "@/src/utils/navigation";
import { ENCOUNTER_COST, formatCountdown, useLiveStamina } from "@/src/game/stamina";
import {
  CLINICAL_CHALLENGE_MODES, FUTURE_EVENT_MODES, KNOWLEDGE_CHALLENGE_MODES,
  ModeCardDef, WARD_SHIFT_MODE, WELLNESS_MODES,
} from "@/src/game/modeHub";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function ShiftPage() {
  const router = useRouter();
  const { player, spendStamina } = usePlayer();
  const { stamina, msUntilNext } = useLiveStamina(player);
  const [blocked, setBlocked] = useState(false);
  const launchingRef = useRef(false);
  const canPlay = stamina >= ENCOUNTER_COST;

  const bossUnlocked = (player?.bosses_defeated?.length ?? 0) > 0 || (player?.runs_completed ?? 0) >= 1;

  const handleModePress = (mode: ModeCardDef) => {
    if (mode.status === "coming_soon" || mode.status === "locked") {
      Alert.alert(
        mode.status === "locked" ? "Not Yet Unlocked" : `${mode.title} — Coming Soon`,
        mode.status === "locked"
          ? mode.unlockRequirement || "This mode isn't unlocked yet."
          : mode.subtitle + "\n\nThis mode is still in development — no stamina is spent and no rewards are given yet.",
      );
      return;
    }
    if (mode.id === "boss-ward" && !bossUnlocked) {
      Alert.alert("The Fading Core is Sealed", "Complete at least one shift to break the seal and confront Lord Imbalance.");
      return;
    }
    if (mode.route) router.push(mode.route as any);
  };

  const dailyShift = useMemo(() => {
    if (!player) return [];
    const starters = ENEMIES.filter((e) => e.difficulty <= 2);
    const advanced = ENEMIES.filter((e) => e.difficulty >= 3);
    const seed = (player.runs_completed || 0) % 5;
    const seed2 = (seed + 2) % 5;
    return [
      starters[seed % starters.length],
      starters[(seed + 1) % starters.length],
      advanced[seed2 % advanced.length],
    ];
  }, [player]);

  if (!player) return null;

  const launchEncounter = async (enemyId: string) => {
    if (launchingRef.current) return;
    launchingRef.current = true;
    const ok = await spendStamina();
    if (!ok) {
      setBlocked(true);
      launchingRef.current = false;
      return;
    }
    setBlocked(false);
    router.push({ pathname: "/battle", params: { enemyId } });
    setTimeout(() => { launchingRef.current = false; }, 1000);
  };

  const clinicalModes = CLINICAL_CHALLENGE_MODES.map((m) =>
    m.id === "boss-ward" && !bossUnlocked
      ? { ...m, unlockRequirement: "Complete at least one shift to unlock." }
      : m,
  );

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/(tabs)")} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>WARD OPERATIONS</Text>
          <Text style={styles.title}>Choose Your Mode</Text>
        </View>
        <StaminaPill player={player} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          Your mission control for every clinical mission, challenge, and off-shift activity. New modes will appear here as they open.
        </Text>

        {!canPlay && (
          <View style={styles.staminaWarn}>
            <Ionicons name="flash-off-outline" size={16} color={COLORS.error} />
            <Text style={styles.staminaWarnTxt}>
              You're out of shift energy. Each case costs {ENCOUNTER_COST}. Next point in{" "}
              {formatCountdown(msUntilNext)} — rest and return.
            </Text>
          </View>
        )}
        {canPlay && blocked && (
          <View style={styles.staminaWarn}>
            <Ionicons name="flash-off-outline" size={16} color={COLORS.error} />
            <Text style={styles.staminaWarnTxt}>Not enough shift energy for that case.</Text>
          </View>
        )}

        {/* Continue — Ward Shift */}
        <Text style={styles.section}>Continue</Text>
        <ModeCard mode={WARD_SHIFT_MODE} onPress={() => {}} testID="mode-ward-shift" />

        <RewardPreview mode="Ward Shift" />

        <Text style={styles.sectionHint}>Today's Cases — tap one to begin</Text>
        {dailyShift.map((e, idx) => {
          const sprite = getEnemySprite(e.id);
          const accent = ELEMENT_COLORS[e.primarySystem] ?? COLORS.brand;
          return (
            <Pressable
              key={e.id + idx}
              style={[styles.card, !canPlay && { opacity: 0.45 }]}
              onPress={() => launchEncounter(e.id)}
              testID={`shift-encounter-${e.id}`}
            >
              {sprite ? (
                <View style={[styles.cardThumb, { borderColor: accent + "80" }]}>
                  <Image source={sprite} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                  <LinearGradient
                    colors={["transparent", "rgba(12,14,18,0.7)"]}
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
              ) : (
                <View style={[styles.cardThumb, { backgroundColor: accent + "20", borderColor: accent + "60" }]}>
                  <Ionicons name="medical" size={28} color={accent} />
                </View>
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[styles.cardSys, { color: accent }]}>{e.primarySystem.toUpperCase()}</Text>
                  {e.secondarySystem && (
                    <Text style={[styles.cardSys, { color: ELEMENT_COLORS[e.secondarySystem] + "AA" }]}>
                      · {e.secondarySystem.toUpperCase()}
                    </Text>
                  )}
                  <View style={styles.diffRow}>
                    {Array.from({ length: e.difficulty }).map((_, i) => (
                      <Ionicons key={i} name="star" size={8} color={COLORS.brand} />
                    ))}
                  </View>
                </View>
                <Text style={styles.cardName}>{e.name}</Text>
                <Text style={styles.cardReal}>{e.realWorld}</Text>
              </View>
              <View style={[styles.enterBtn, { borderColor: accent + "60" }]}>
                <Ionicons name="enter-outline" size={18} color={accent} />
              </View>
            </Pressable>
          );
        })}

        {/* Clinical Challenges */}
        <Text style={styles.section}>Clinical Challenges</Text>
        <View style={styles.mediumGrid}>
          {clinicalModes.map((m) => (
            <ModeCard key={m.id} mode={m} onPress={() => handleModePress(m)} testID={`mode-${m.id}`} />
          ))}
        </View>

        {/* Knowledge Challenges */}
        <Text style={styles.section}>Knowledge Challenges</Text>
        <View style={styles.smallGrid}>
          {KNOWLEDGE_CHALLENGE_MODES.map((m) => (
            <ModeCard key={m.id} mode={m} onPress={() => handleModePress(m)} testID={`mode-${m.id}`} />
          ))}
        </View>

        {/* Wellness / Off-Shift */}
        <Text style={styles.section}>Wellness / Off-Shift</Text>
        <View style={styles.mediumGrid}>
          {WELLNESS_MODES.map((m) => (
            <ModeCard key={m.id} mode={m} onPress={() => handleModePress(m)} testID={`mode-${m.id}`} />
          ))}
        </View>

        {/* Future Events */}
        <Text style={styles.section}>Future Events</Text>
        <View style={styles.smallGrid}>
          {FUTURE_EVENT_MODES.map((m) => (
            <ModeCard key={m.id} mode={m} onPress={() => handleModePress(m)} testID={`mode-${m.id}`} />
          ))}
        </View>

        <View style={styles.footNote}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footNoteTxt}>
            Coming Soon modes are placeholders only — tapping them never spends stamina or grants rewards.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg, paddingBottom: SPACING.sm },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  kicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300", marginTop: 2 },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  lead: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 22, fontStyle: "italic", marginBottom: SPACING.sm },
  staminaWarn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.error + "18",
    borderWidth: 1, borderColor: COLORS.error + "50",
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  staminaWarnTxt: { color: COLORS.onSurface, fontSize: 12, lineHeight: 18, flex: 1 },
  card: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardThumb: {
    width: 72, height: 80, borderRadius: RADIUS.md,
    overflow: "hidden", borderWidth: 2,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surfaceTertiary,
  },
  cardSys: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  diffRow: { flexDirection: "row", gap: 2, marginLeft: 2 },
  cardName: { color: COLORS.onSurface, fontSize: 17, fontWeight: "500" },
  cardReal: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  enterBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceTertiary },
  footNote: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.sm },
  footNoteTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18, flex: 1, fontStyle: "italic" },
  section: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginTop: SPACING.md, marginBottom: 2 },
  sectionHint: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "600", marginTop: SPACING.xs, marginBottom: -SPACING.xs },
  mediumGrid: { gap: SPACING.sm },
  smallGrid: { gap: SPACING.sm },
});
