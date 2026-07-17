import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { playRewardCue } from "@/src/game/cues";
import { rarityColor, SUMMON_COST } from "@/src/game/gacha";
import { completeObjective } from "@/src/game/objectiveProgress";
import { RecruitResult, rarityTierLabel } from "@/src/game/university";
import { usePlayer } from "@/src/game/store";
import { UniversityCreditsBadge } from "@/src/components/UniversityCreditsBadge";
import { useTutorial } from "@/src/game/tutorialStore";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function UniversityRecruitScreen() {
  const router = useRouter();
  const { player, recruitOnce, freeRecruitOnce, recruitTen } = usePlayer();
  const { isCompleted, startTutorial, onRequiredAction } = useTutorial();
  useClearTutorialOnExit();

  // C1 obj 11: grant once when player first visits Recruitment.
  const recruitVisitRef = useRef(false);
  useEffect(() => {
    if (!player || recruitVisitRef.current) return;
    recruitVisitRef.current = true;
    completeObjective("obj_recruit_preview");
  }, [player?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState(false);
  const [single, setSingle] = useState<RecruitResult | null>(null);
  const [batch, setBatch] = useState<RecruitResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // P16: free daily summon availability
  const freeAvailable = (() => {
    if (!player) return false;
    const last = player.last_free_summon_at;
    if (!last) return true;
    return Date.now() - new Date(last).getTime() >= 24 * 60 * 60 * 1000;
  })();
  const freeCountdown = (() => {
    if (!player?.last_free_summon_at || freeAvailable) return null;
    const msLeft = 24 * 60 * 60 * 1000 - (Date.now() - new Date(player.last_free_summon_at).getTime());
    const h = Math.floor(msLeft / (60 * 60 * 1000));
    const m = Math.floor((msLeft % (60 * 60 * 1000)) / 60000);
    return `${h}h ${m}m`;
  })();

  // P18: pulse animation for the FREE button ring when daily draw is available
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!freeAvailable) { pulseAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [freeAvailable]);

  useEffect(() => {
    if (!isCompleted("firstSummon")) {
      const t = setTimeout(() => startTutorial("firstSummon"), 600);
      return () => clearTimeout(t);
    }
  }, []);

  if (!player) {
    return (
      <SafeAreaView style={[styles.container, styles.loading]} edges={["top"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  const shards = player.codex_shards || 0;
  const tenCost = SUMMON_COST * 10;
  // P18: affordability helpers
  const canAffordSingle = shards >= SUMMON_COST;
  const canAffordTen    = shards >= tenCost;
  const needMore        = Math.max(0, SUMMON_COST - shards);

  const doFree = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setBatch(null);
    setSingle(null);
    const res = await freeRecruitOnce();
    if (!res.ok) setError(res.message);
    else { setSingle(res.result || null); playRewardCue(false); onRequiredAction("summon"); }
    setBusy(false);
  };

  const doSingle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setBatch(null);
    const res = await recruitOnce();
    if (!res.ok) setError(res.message);
    else { setSingle(res.result || null); playRewardCue(false); onRequiredAction("summon"); }
    setBusy(false);
  };

  const doTen = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSingle(null);
    const res = await recruitTen();
    if (!res.ok) setError(res.message);
    else { setBatch(res.results || null); playRewardCue(true); }
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
        <View style={styles.walletRow}>
          <View style={styles.shardCard}>
            <Ionicons name="sparkles" size={18} color={COLORS.brand} />
            <Text style={styles.shardVal}>{shards}</Text>
            <Text style={styles.shardLbl}>SUMMONING SHARDS</Text>
          </View>
          <UniversityCreditsBadge amount={player.university_credits || 0} compact testID="recruit-credits-badge" />
        </View>
        {/* P18: show free-draw banner when available + shards low; show earn-hint only when broke and free draw is spent */}
        {freeAvailable && !canAffordSingle && (
          <View style={styles.freeReadyBanner}>
            <Ionicons name="sparkles" size={13} color="#4FD8C4" />
            <Text style={styles.freeReadyBannerTxt}>
              ✦ Your free daily draw is ready — no shards needed! Tap FREE DAILY below.
            </Text>
          </View>
        )}
        {!freeAvailable && !canAffordSingle && (
          <View style={styles.shardsInfo}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.brand} />
            <Text style={styles.shardsInfoTxt}>
              Earn Summoning Shards from Ward Shifts, chapter clears, daily duties, and milestone rewards — no payment required.
            </Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* P18: FREE DAILY RECRUITMENT — always first, visually dominant when available */}
        <View style={styles.freeSummonWrap}>
          {/* Animated pulse ring — only visible when freeAvailable */}
          {freeAvailable && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.freePulseRing,
                {
                  opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.45] }),
                  transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }],
                },
              ]}
            />
          )}
          <Pressable
            style={[
              styles.freeSummonBtn,
              freeAvailable && styles.freeSummonBtnActive,
              (!freeAvailable || busy) && !freeAvailable && { opacity: 0.65 },
            ]}
            onPress={doFree}
            disabled={busy}
            testID="recruit-free-btn"
          >
            <View style={styles.freeSummonInner}>
              <View style={[styles.freeBadge, freeAvailable && styles.freeBadgeActive]}>
                <Text style={styles.freeBadgeTxt}>{freeAvailable ? "FREE ✦" : "FREE"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.freeSummonTxt, freeAvailable && { color: "#4FD8C4" }]}>DAILY RECRUITMENT</Text>
                <Text style={styles.freeSummonSub}>
                  {freeAvailable
                    ? "Available now — no shards needed. Tap to draw!"
                    : `Next free draw in ${freeCountdown}`}
                </Text>
              </View>
              {busy
                ? <ActivityIndicator size="small" color="#4FD8C4" />
                : <Ionicons
                    name={freeAvailable ? "sparkles" : "time-outline"}
                    size={22}
                    color={freeAvailable ? "#4FD8C4" : COLORS.onSurfaceTertiary}
                  />
              }
            </View>
          </Pressable>
        </View>

        {/* Result cards */}
        {single && <ResultCard result={single} />}
        {batch && (
          <View style={styles.batchGrid}>
            {batch.map((r, i) => (
              <ResultTile key={i} result={r} />
            ))}
          </View>
        )}

        {error && <Text style={styles.errorTxt}>{error}</Text>}

        {/* P18: SINGLE RECRUITMENT — locked visual when insufficient shards */}
        <Pressable
          style={[styles.btn, (busy || !canAffordSingle) && { opacity: canAffordSingle ? 0.5 : 0.45 }]}
          onPress={doSingle}
          disabled={busy}
          testID="recruit-single-btn"
        >
          <LinearGradient
            colors={canAffordSingle ? [COLORS.brand, COLORS.brandSecondary] : ["#334155", "#1E293B"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {busy ? <ActivityIndicator color={COLORS.onBrand} /> : (
            <>
              {!canAffordSingle && <Ionicons name="lock-closed" size={13} color="#94A3B8" style={{ marginRight: 4 }} />}
              <View style={{ alignItems: "center" }}>
                <Text style={[styles.btnTxt, !canAffordSingle && { color: "#94A3B8" }]}>SINGLE RECRUITMENT</Text>
                <Text style={[styles.btnCost, !canAffordSingle && { color: "#64748B" }]}>
                  {canAffordSingle
                    ? `${SUMMON_COST} SHARDS`
                    : `Need ${needMore} more shards  ·  ${SUMMON_COST} total`}
                </Text>
              </View>
            </>
          )}
        </Pressable>

        {/* P18: TEN RECRUITMENT — locked visual when insufficient */}
        <Pressable
          style={[styles.btnOutline, (busy || !canAffordTen) && { opacity: 0.45 }, { borderColor: canAffordTen ? COLORS.brand : "#334155" }]}
          onPress={doTen}
          disabled={busy}
          testID="recruit-ten-btn"
        >
          {!canAffordTen && <Ionicons name="lock-closed" size={12} color="#64748B" />}
          <Text style={[styles.btnOutlineTxt, { color: canAffordTen ? COLORS.brand : "#64748B" }]}>FULL CLASS RECRUITMENT (×10)</Text>
          <Text style={styles.btnOutlineCost}>{tenCost} SHARDS · guarantees a Class Trainee + Credits</Text>
        </Pressable>

        {/* P18: Earn-shards CTA when player is broke and free draw already used */}
        {!canAffordSingle && !freeAvailable && (
          <View style={styles.earnCard}>
            <View style={styles.earnCardHeader}>
              <Ionicons name="trending-up-outline" size={14} color={COLORS.brand} />
              <Text style={styles.earnCardTitle}>Earn more Summoning Shards</Text>
            </View>
            <Text style={styles.earnCardLine}>• Ward Shifts — 10–20 shards per run</Text>
            <Text style={styles.earnCardLine}>• Chapter milestones — 25–50 shards on clear</Text>
            <Text style={styles.earnCardLine}>• Daily duties &amp; weekly tasks — up to 100 shards</Text>
            <Text style={styles.earnCardNote}>All sources are free — no payment ever required.</Text>
          </View>
        )}

        <View style={styles.oddsBox}>
          <Text style={styles.oddsTitle}>Recruitment Odds</Text>
          <Text style={styles.oddsLine}>70% — Roll a healer (new hero, or duplicate → Hero Shards)</Text>
          <Text style={styles.oddsLine}>20% — Class Trainees for a random department</Text>
          <Text style={styles.oddsLine}>10% — University Credits</Text>
        </View>
      </ScrollView>

      <TutorialOverlay />
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
  walletRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
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
  shardsInfo: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: COLORS.brandTertiary + "30", borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.brand + "40",
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, marginTop: SPACING.xs,
  },
  shardsInfoTxt: {
    flex: 1, fontSize: 11, color: COLORS.onSurfaceSecondary, lineHeight: 16,
  },
  oddsBox: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, gap: 3, backgroundColor: COLORS.surfaceSecondary,
  },
  oddsTitle: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700", marginBottom: 2 },
  oddsLine: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  // P18: FREE button wrapper + pulse ring
  freeSummonWrap: { position: "relative" as const },
  freePulseRing: {
    position:     "absolute" as const,
    top:          -4, bottom: -4, left: -4, right: -4,
    borderRadius: RADIUS.md + 4,
    borderWidth:  3,
    borderColor:  "#3DC4A8",
  },
  freeSummonBtn: {
    borderRadius: RADIUS.md, borderWidth: 2, borderColor: "#3DC4A840",
    backgroundColor: "#3DC4A808", overflow: "hidden",
  },
  freeSummonBtnActive: {
    borderColor: "#3DC4A8",
    backgroundColor: "#3DC4A812",
    shadowColor: "#3DC4A8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  freeSummonInner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  freeBadge: {
    backgroundColor: "#3DC4A840", borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: "#3DC4A880",
  },
  freeBadgeActive: {
    backgroundColor: "#3DC4A8",
  },
  freeBadgeTxt: { color: "#082019", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  freeSummonTxt: { color: COLORS.onSurfaceSecondary, fontSize: 14, fontWeight: "700", letterSpacing: 0.4 },
  freeSummonSub: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  // P18: header banner when free draw available and shards low
  freeReadyBanner: {
    flexDirection: "row" as const, alignItems: "flex-start", gap: 6,
    backgroundColor: "#3DC4A815", borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: "#3DC4A840",
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, marginTop: SPACING.xs,
  },
  freeReadyBannerTxt: {
    flex: 1, fontSize: 11, color: "#4FD8C4", lineHeight: 16, fontWeight: "600" as const,
  },
  // P18: earn-shards helper card
  earnCard: {
    borderWidth: 1, borderColor: COLORS.brand + "35", borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, gap: 4,
  },
  earnCardHeader: { flexDirection: "row" as const, alignItems: "center", gap: 6, marginBottom: 2 },
  earnCardTitle: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700" as const },
  earnCardLine: { color: COLORS.onSurfaceSecondary, fontSize: 11 },
  earnCardNote: { color: COLORS.brand, fontSize: 10, fontStyle: "italic" as const, marginTop: 2 },
});
