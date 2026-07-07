import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { rarityColor, SUMMON_COST } from "@/src/game/gacha";
import { RecruitResult, rarityTierLabel } from "@/src/game/university";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function UniversityRecruitScreen() {
  const router = useRouter();
  const { player, recruitOnce, recruitTen } = usePlayer();
  const [busy, setBusy] = useState(false);
  const [single, setSingle] = useState<RecruitResult | null>(null);
  const [batch, setBatch] = useState<RecruitResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!player) {
    return (
      <SafeAreaView style={[styles.container, styles.loading]} edges={["top"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  const shards = player.codex_shards || 0;
  const tenCost = SUMMON_COST * 10;

  const doSingle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setBatch(null);
    const res = await recruitOnce();
    if (!res.ok) setError(res.message);
    else setSingle(res.result || null);
    setBusy(false);
  };

  const doTen = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSingle(null);
    const res = await recruitTen();
    if (!res.ok) setError(res.message);
    else setBatch(res.results || null);
    setBusy(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} testID="recruit-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>UNIVERSITY RECRUITMENT</Text>
        <Text style={styles.title}>Recruitment Hall</Text>
        <Text style={styles.sub}>Enroll new healers, or convert duplicates into Hero Shards, Class Trainees, and Credits.</Text>
        <View style={styles.shardCard}>
          <Ionicons name="diamond" size={18} color={COLORS.brand} />
          <Text style={styles.shardVal}>{shards}</Text>
          <Text style={styles.shardLbl}>CODEX SHARDS</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {error && <Text style={styles.errorTxt}>{error}</Text>}

        {single && <ResultCard result={single} />}
        {batch && (
          <View style={styles.batchGrid}>
            {batch.map((r, i) => (
              <ResultTile key={i} result={r} />
            ))}
          </View>
        )}

        <Pressable style={[styles.btn, busy && { opacity: 0.5 }]} onPress={doSingle} disabled={busy} testID="recruit-single-btn">
          <LinearGradient colors={[COLORS.brand, COLORS.brandSecondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
          {busy ? <ActivityIndicator color={COLORS.onBrand} /> : (
            <>
              <Text style={styles.btnTxt}>SINGLE RECRUITMENT</Text>
              <Text style={styles.btnCost}>{SUMMON_COST} SHARDS</Text>
            </>
          )}
        </Pressable>

        <Pressable style={[styles.btnOutline, busy && { opacity: 0.5 }, { borderColor: COLORS.brand }]} onPress={doTen} disabled={busy} testID="recruit-ten-btn">
          <Text style={[styles.btnOutlineTxt, { color: COLORS.brand }]}>FULL CLASS RECRUITMENT (×10)</Text>
          <Text style={styles.btnOutlineCost}>{tenCost} SHARDS · guarantees a Class Trainee + Credits</Text>
        </Pressable>

        <View style={styles.oddsBox}>
          <Text style={styles.oddsTitle}>Recruitment Odds</Text>
          <Text style={styles.oddsLine}>70% — Roll a healer (new hero, or duplicate → Hero Shards)</Text>
          <Text style={styles.oddsLine}>20% — Class Trainees for a random department</Text>
          <Text style={styles.oddsLine}>10% — University Credits</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultCard({ result }: { result: RecruitResult }) {
  if (result.kind === "hero" || result.kind === "shards") {
    const rc = rarityColor(result.entry!.rarity);
    return (
      <View style={[styles.resultCard, { borderColor: rc }]} testID="recruit-result">
        <Text style={[styles.resultName, { color: rc }]}>{result.entry!.name}</Text>
        <View style={[styles.tierPill, { borderColor: rc + "70" }]}>
          <Text style={[styles.tierPillTxt, { color: rc }]}>{rarityTierLabel(result.entry!.rarity)}</Text>
        </View>
        <Text style={styles.resultMsg}>{result.message}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.resultCard, { borderColor: COLORS.brand }]} testID="recruit-result">
      <Ionicons name={result.kind === "trainee" ? "people" : "school"} size={22} color={COLORS.brand} />
      <Text style={styles.resultMsg}>{result.message}</Text>
    </View>
  );
}

function ResultTile({ result }: { result: RecruitResult }) {
  if (result.kind === "hero" || result.kind === "shards") {
    const rc = rarityColor(result.entry!.rarity);
    return (
      <View style={[styles.tile, { borderColor: rc + "70" }]}>
        <Text style={[styles.tileName, { color: rc }]} numberOfLines={1}>{result.entry!.name}</Text>
        <Text style={styles.tileMeta}>{result.kind === "hero" ? "NEW" : `+${result.shardAmount} shards`}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.tile, { borderColor: COLORS.brand + "70" }]}>
      <Ionicons name={result.kind === "trainee" ? "people" : "school"} size={14} color={COLORS.brand} />
      <Text style={styles.tileMeta}>
        {result.kind === "trainee" ? `+${result.traineeAmount} ${result.trainee?.label}` : `+${result.creditsAmount} Credits`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: 4 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)", marginBottom: SPACING.sm,
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 26, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
  shardCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginTop: SPACING.sm, alignSelf: "flex-start",
  },
  shardVal: { color: COLORS.brand, fontSize: 18, fontWeight: "300" },
  shardLbl: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  errorTxt: { color: COLORS.brandSecondary, fontSize: 13, textAlign: "center" },
  resultCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 2, alignItems: "center", gap: 6 },
  resultName: { fontSize: 20, fontWeight: "400" },
  tierPill: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tierPillTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  resultMsg: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: "center", marginTop: 4 },
  batchGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  tile: {
    width: "31%", borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, alignItems: "center", gap: 4, minHeight: 64, justifyContent: "center",
  },
  tileName: { fontSize: 11, fontWeight: "700" },
  tileMeta: { fontSize: 9, color: COLORS.onSurfaceTertiary, textAlign: "center" },
  btn: {
    height: 56, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center",
    overflow: "hidden", flexDirection: "row", gap: SPACING.md,
  },
  btnTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 1.5 },
  btnCost: { color: COLORS.onBrand, fontSize: 11, opacity: 0.85 },
  btnOutline: {
    height: 56, borderRadius: RADIUS.md, borderWidth: 2, alignItems: "center", justifyContent: "center", gap: 2,
  },
  btnOutlineTxt: { fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  btnOutlineCost: { fontSize: 10, color: COLORS.onSurfaceTertiary },
  oddsBox: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, gap: 3, backgroundColor: COLORS.surfaceSecondary,
  },
  oddsTitle: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700", marginBottom: 2 },
  oddsLine: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
});
