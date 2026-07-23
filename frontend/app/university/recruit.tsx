import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { playRewardCue } from "@/src/game/cues";
import { rarityColor, SUMMON_COST } from "@/src/game/gacha";
import { completeObjective } from "@/src/game/objectiveProgress";
import { RecruitResult, rarityTierLabel } from "@/src/game/university";
import { LAUNCH_ROSTER, FAMILY_COLORS } from "@/src/game/heroRoster";
import { SKILL_CLINICAL } from "@/src/game/clinical";
import { usePlayer } from "@/src/game/store";
import { UniversityCreditsBadge } from "@/src/components/UniversityCreditsBadge";
import { useTutorial } from "@/src/game/tutorialStore";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── Portrait asset map — keyed by heroId ────────────────────────────────────
const HERO_PORTRAITS: Record<string, ReturnType<typeof require>> = {
  novice_guardian:   require("../../assets/heroes/novice_guardian.png"),
  apprentice_seer:   require("../../assets/heroes/apprentice_seer.png"),
  junior_warden:     require("../../assets/heroes/junior_warden.png"),
  data_acolyte:      require("../../assets/heroes/data_acolyte.png"),
  village_caretaker: require("../../assets/heroes/village_caretaker.png"),
  night_watcher:     require("../../assets/heroes/night_watcher.png"),
  storm_runner:      require("../../assets/heroes/storm_runner.png"),
  infection_warden:  require("../../assets/heroes/infection_warden.png"),
  wound_sage:        require("../../assets/heroes/wound_sage.png"),
  mindkeeper:        require("../../assets/heroes/mindkeeper.png"),
};

// Collect unique chain roles from a hero's skills (max 3 displayed).
function getHeroChainRoles(heroId: string): string[] {
  const hero = LAUNCH_ROSTER.find(h => h.id === heroId);
  if (!hero) return [];
  const seen = new Set<string>();
  for (const skill of hero.skills) {
    const clinical = SKILL_CLINICAL[skill.id];
    if (clinical?.chainRoles) clinical.chainRoles.forEach(r => seen.add(r));
  }
  return Array.from(seen).slice(0, 3);
}

const TRAINEE_SEEN_KEY = "clinica.seen_trainee_reveal";

export default function UniversityRecruitScreen() {
  const router = useRouter();
  const { player, recruitOnce, freeRecruitOnce, tutorialRecruitOnce, recruitTen } = usePlayer();
  const { isCompleted, startTutorial, onRequiredAction } = useTutorial();
  useClearTutorialOnExit();

  const recruitVisitRef = useRef(false);
  useEffect(() => {
    if (!player || recruitVisitRef.current) return;
    recruitVisitRef.current = true;
    completeObjective("obj_recruit_preview");
  }, [player?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [busy, setBusy] = useState(false);
  const [single, setSingle] = useState<RecruitResult | null>(null);
  const [ceremonyResult, setCeremonyResult] = useState<RecruitResult | null>(null);
  const [batch, setBatch] = useState<RecruitResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealResult, setRevealResult] = useState<RecruitResult | null>(null);

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

  const ceremonyPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!player) return;
    const needsCeremony = !player.tutorial_summon_1_done || !player.tutorial_summon_2_done;
    if (!needsCeremony) { ceremonyPulse.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ceremonyPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(ceremonyPulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [player?.tutorial_summon_1_done, player?.tutorial_summon_2_done]);

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
  const canAffordSingle = shards >= SUMMON_COST;
  const canAffordTen    = shards >= tenCost;
  const needMore        = Math.max(0, SUMMON_COST - shards);

  // Ceremony state
  const ceremony1Needed = !player.tutorial_summon_1_done;
  const ceremony2Needed = (player.tutorial_summon_1_done ?? false) && !(player.tutorial_summon_2_done ?? false);
  const anyCeremonyNeeded = ceremony1Needed || ceremony2Needed;
  const activeSummonIndex: 1 | 2 = ceremony1Needed ? 1 : 2;

  const doTutorialSummon = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setBatch(null);
    setSingle(null);
    setCeremonyResult(null);
    const res = await tutorialRecruitOnce(activeSummonIndex);
    if (!res.ok) setError(res.message);
    else {
      const r = res.result || null;
      setCeremonyResult(r);
      setRevealResult(r);
      playRewardCue(true);
      onRequiredAction("summon");
    }
    setBusy(false);
  };

  const doFree = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setBatch(null);
    setSingle(null);
    setCeremonyResult(null);
    const res = await freeRecruitOnce();
    if (!res.ok) setError(res.message);
    else { const r = res.result || null; setSingle(r); setRevealResult(r); playRewardCue(false); onRequiredAction("summon"); }
    setBusy(false);
  };

  const doSingle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setBatch(null);
    setCeremonyResult(null);
    const res = await recruitOnce();
    if (!res.ok) setError(res.message);
    else { const r = res.result || null; setSingle(r); setRevealResult(r); playRewardCue(false); onRequiredAction("summon"); }
    setBusy(false);
  };

  const doTen = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSingle(null);
    setCeremonyResult(null);
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
        <Text style={styles.sub}>
          {anyCeremonyNeeded
            ? "The Realm has called — enroll your founding healers through the Academy Ceremony."
            : "Enroll new healers, or convert duplicates into Hero Shards, Class Trainees, and Credits."}
        </Text>
        <View style={styles.walletRow}>
          <View style={styles.shardCard}>
            <Ionicons name="sparkles" size={18} color={COLORS.brand} />
            <Text style={styles.shardVal}>{shards}</Text>
            <Text style={styles.shardLbl}>SUMMONING SHARDS</Text>
          </View>
          <UniversityCreditsBadge amount={player.university_credits || 0} compact testID="recruit-credits-badge" />
        </View>
        {freeAvailable && !canAffordSingle && !anyCeremonyNeeded && (
          <View style={styles.freeReadyBanner}>
            <Ionicons name="sparkles" size={13} color="#4FD8C4" />
            <Text style={styles.freeReadyBannerTxt}>
              ✦ Your free daily draw is ready — no shards needed! Tap FREE DAILY below.
            </Text>
          </View>
        )}
        {!freeAvailable && !canAffordSingle && !anyCeremonyNeeded && (
          <View style={styles.shardsInfo}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.brand} />
            <Text style={styles.shardsInfoTxt}>
              Earn Summoning Shards from Ward Shifts, chapter clears, daily duties, and milestone rewards — no payment required.
            </Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── RECRUITMENT CEREMONY (tutorial summons 1 & 2) ── */}
        {anyCeremonyNeeded && (
          <View style={styles.ceremonySection}>
            {/* Step tracker */}
            <View style={styles.ceremonyStepRow}>
              <View style={[styles.ceremonyStep, { backgroundColor: "#D4AF3740" }]}>
                <Ionicons
                  name={player.tutorial_summon_1_done ? "checkmark-circle" : "person-add"}
                  size={14}
                  color={player.tutorial_summon_1_done ? "#4FD8C4" : "#D4AF37"}
                />
                <Text style={[styles.ceremonyStepTxt, player.tutorial_summon_1_done && { color: "#4FD8C4" }]}>
                  {player.tutorial_summon_1_done ? "1st Healer Enrolled" : "1st Enrollment"}
                </Text>
              </View>
              <View style={styles.ceremonyStepLine} />
              <View style={[styles.ceremonyStep, { backgroundColor: ceremony2Needed ? "#D4AF3740" : "#1E293B" }]}>
                <Ionicons
                  name={player.tutorial_summon_2_done ? "checkmark-circle" : "people"}
                  size={14}
                  color={player.tutorial_summon_2_done ? "#4FD8C4" : ceremony2Needed ? "#D4AF37" : COLORS.onSurfaceTertiary}
                />
                <Text style={[
                  styles.ceremonyStepTxt,
                  player.tutorial_summon_2_done && { color: "#4FD8C4" },
                  !ceremony2Needed && !player.tutorial_summon_2_done && { color: COLORS.onSurfaceTertiary },
                ]}>
                  {player.tutorial_summon_2_done ? "2nd Healer Enrolled" : "2nd Enrollment"}
                </Text>
              </View>
            </View>

            {/* Ceremony card */}
            <View style={styles.ceremonyCard}>
              <LinearGradient
                colors={["#1A1A0E", "#0D1A1A"]}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.ceremonyCardBorder} />

              <View style={styles.ceremonyCardTop}>
                <View style={styles.ceremonyBadge}>
                  <Text style={styles.ceremonyBadgeTxt}>GUARANTEED HEALER</Text>
                </View>
                <Text style={styles.ceremonyCardTitle}>
                  {ceremony1Needed
                    ? "First Enrollment Ceremony"
                    : "Second Enrollment Ceremony"}
                </Text>
                <Text style={styles.ceremonyCardDesc}>
                  {ceremony1Needed
                    ? "Every healer begins with a calling. The Realm selects your first ward member — always a real healer, never a material."
                    : "A complete ward team needs complementary skills. Your second enrollment favors a healer of a different specialization."}
                </Text>
              </View>

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.ceremonyPulseRing,
                  {
                    opacity: ceremonyPulse.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.5] }),
                    transform: [{ scale: ceremonyPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }],
                  },
                ]}
              />
              <Pressable
                style={[styles.ceremonyBtn, busy && { opacity: 0.6 }]}
                onPress={doTutorialSummon}
                disabled={busy}
                testID="recruit-ceremony-btn"
              >
                <LinearGradient
                  colors={["#B8952A", "#D4AF37", "#B8952A"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
                {busy
                  ? <ActivityIndicator color="#0D1200" />
                  : (
                    <View style={styles.ceremonyBtnInner}>
                      <Ionicons name="sparkles" size={18} color="#0D1200" />
                      <Text style={styles.ceremonyBtnTxt}>
                        {ceremony1Needed ? "ENROLL FIRST HEALER" : "ENROLL SECOND HEALER"}
                      </Text>
                      <Text style={styles.ceremonyBtnFree}>FREE</Text>
                    </View>
                  )}
              </Pressable>

              <Text style={styles.ceremonyNote}>
                ✦ One-time Academy ceremony · No shards required · After both enrollments, normal recruitment resumes
              </Text>
            </View>

            {/* Ceremony result */}
            {ceremonyResult && (
              <CeremonyResultCard result={ceremonyResult} />
            )}

            <View style={styles.ceremonySectionDivider}>
              <View style={styles.ceremonySectionLine} />
              <Text style={styles.ceremonySectionDividerTxt}>DAILY RECRUITMENT</Text>
              <View style={styles.ceremonySectionLine} />
            </View>
          </View>
        )}

        {/* ── FREE DAILY RECRUITMENT ── */}
        <View style={styles.freeSummonWrap}>
          {freeAvailable && !anyCeremonyNeeded && (
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

        {/* Result cards (free / single / batch) */}
        {single && <ResultCard result={single} />}
        {batch && (
          <View style={styles.batchGrid}>
            {batch.map((r, i) => (
              <ResultTile key={i} result={r} />
            ))}
          </View>
        )}

        {error && <Text style={styles.errorTxt}>{error}</Text>}

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

        {!canAffordSingle && !freeAvailable && !anyCeremonyNeeded && (
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
          {anyCeremonyNeeded && (
            <Text style={[styles.oddsLine, { color: "#D4AF37", fontWeight: "700" }]}>
              ✦ Ceremony draws always grant a healer — guaranteed.
            </Text>
          )}
          <Text style={styles.oddsLine}>70% — Roll a healer (new hero, or duplicate → Hero Shards)</Text>
          <Text style={styles.oddsLine}>20% — Class Trainees for a random department</Text>
          <Text style={styles.oddsLine}>10% — University Credits</Text>
          {anyCeremonyNeeded && (
            <Text style={styles.oddsCeremonyNote}>
              Normal mixed odds apply after both Academy Ceremony draws are claimed.
            </Text>
          )}
        </View>
      </ScrollView>

      <RecruitRevealModal result={revealResult} onDismiss={() => setRevealResult(null)} />
      <TutorialOverlay />
    </SafeAreaView>
  );
}

// ── Gacha-style reveal popup ─────────────────────────────────────────────────
function RecruitRevealModal({ result, onDismiss }: { result: RecruitResult | null; onDismiss: () => void }) {
  const { height: screenH } = useWindowDimensions();
  const scaleAnim   = useRef(new Animated.Value(0.94)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const glowAnim    = useRef(new Animated.Value(0)).current;
  const [showTraineeInfo, setShowTraineeInfo] = useState(false);

  useEffect(() => {
    if (!result) {
      scaleAnim.setValue(0.94);
      opacityAnim.setValue(0);
      glowAnim.setValue(0);
      return;
    }
    if (result.kind === "trainee") {
      AsyncStorage.getItem(TRAINEE_SEEN_KEY).then(v => setShowTraineeInfo(!v));
    }
    const spring = Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true });
    const fade   = Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true });
    Animated.parallel([spring, fade]).start(() => {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ])
      );
      pulse.start();
    });
    return () => { glowAnim.stopAnimation(); };
  }, [result]);

  const handleDismiss = () => {
    if (result?.kind === "trainee") AsyncStorage.setItem(TRAINEE_SEEN_KEY, "1");
    onDismiss();
  };

  if (!result) return null;

  const portraitH = Math.round(screenH * 0.58);

  // ── HERO reveal ────────────────────────────────────────────────────────────
  if (result.kind === "hero" && result.entry) {
    const entry      = result.entry;
    const hero       = LAUNCH_ROSTER.find(h => h.id === entry.heroId);
    const rc         = rarityColor(entry.rarity);
    const rLabel     = entry.rarity === 5 ? "LEGENDARY" : entry.rarity === 4 ? "RARE" : entry.rarity === 3 ? "UNCOMMON" : "COMMON";
    const portrait   = HERO_PORTRAITS[entry.heroId];
    const famColor   = hero ? FAMILY_COLORS[hero.family] : rc;
    const chainRoles = getHeroChainRoles(entry.heroId);
    const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.65] });

    return (
      <Animated.View style={[revealStyles.fullOverlay, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Full-screen dark background with rarity colour tint */}
        <LinearGradient
          colors={[rc + "38", "#050A0F", "#050A0F"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.55 }}
          pointerEvents="none"
        />

        {/* Pulsing glow border at edges */}
        <Animated.View style={[revealStyles.fullGlowBorder, { borderColor: rc, opacity: glowOpacity }]} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={revealStyles.fullScrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Portrait zone (top 58% of screen) ── */}
          <View style={[revealStyles.portraitZone, { height: portraitH }]}>
            {portrait ? (
              <Image source={portrait} style={revealStyles.fullPortrait} resizeMode="contain" />
            ) : (
              <View style={[revealStyles.fullPortraitPlaceholder, { borderColor: rc + "40" }]}>
                <Ionicons name="person" size={80} color={rc + "70"} />
              </View>
            )}
            {/* Bottom fade of portrait into content */}
            <LinearGradient
              colors={["transparent", "transparent", "#050A0F"]}
              style={revealStyles.portraitFade}
              start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }}
              pointerEvents="none"
            />

            {/* Rarity pill — floated at top of portrait */}
            <View style={[revealStyles.rarityPill, { backgroundColor: rc + "22", borderColor: rc + "80" }]}>
              <Ionicons name="sparkles" size={11} color={rc} />
              <Text style={[revealStyles.rarityPillTxt, { color: rc }]}>{rLabel} HEALER ENROLLED</Text>
              <Ionicons name="sparkles" size={11} color={rc} />
            </View>
          </View>

          {/* ── Info block ── */}
          <View style={revealStyles.infoBlock}>
            {/* Large decorative role line */}
            <View style={revealStyles.roleRow}>
              <Text style={[revealStyles.roleBracket, { color: rc + "AA" }]}>⟦</Text>
              <Text style={[revealStyles.roleTxt, { color: rc }]}>{entry.role.toUpperCase()}</Text>
              <Text style={[revealStyles.roleBracket, { color: rc + "AA" }]}>⟧</Text>
            </View>

            {/* Hero name + title */}
            <View style={{ gap: 3, alignItems: "center" }}>
              <Text style={[revealStyles.heroName, { color: COLORS.onSurface }]}>{entry.name}</Text>
              {hero?.title && <Text style={revealStyles.heroTitle}>"{hero.title}"</Text>}
            </View>

            {/* Family + rarity badges */}
            <View style={revealStyles.badgeRow}>
              {hero && (
                <View style={[revealStyles.badge, { borderColor: famColor + "60", backgroundColor: famColor + "18" }]}>
                  <Text style={[revealStyles.badgeTxt, { color: famColor }]}>{hero.family}</Text>
                </View>
              )}
              <View style={[revealStyles.badge, { borderColor: rc + "60", backgroundColor: rc + "18" }]}>
                <Text style={[revealStyles.badgeTxt, { color: rc }]}>{rLabel}</Text>
              </View>
            </View>

            {/* Chain roles */}
            {chainRoles.length > 0 && (
              <View style={revealStyles.chainRow}>
                <Text style={revealStyles.chainLabel}>CARE CHAIN</Text>
                {chainRoles.map(cr => (
                  <View key={cr} style={revealStyles.chainChip}>
                    <Text style={revealStyles.chainChipTxt}>{cr}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Description */}
            {hero?.description && (
              <Text style={revealStyles.desc}>{hero.description}</Text>
            )}

            {/* Quote */}
            {hero?.quote && (
              <Text style={revealStyles.quote}>"{hero.quote}"</Text>
            )}
          </View>
        </ScrollView>

        {/* CTA — anchored at bottom, always reachable */}
        <View style={[revealStyles.ctaContainer, { borderTopColor: rc + "30" }]}>
          <Pressable
            style={[revealStyles.ctaBtn, { backgroundColor: rc }]}
            onPress={handleDismiss}
            testID="reveal-cta"
          >
            <Ionicons name="checkmark-circle" size={18} color="#07120F" />
            <Text style={revealStyles.ctaTxt}>WELCOME TO THE WARD</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  // ── TRAINEE reveal ─────────────────────────────────────────────────────────
  if (result.kind === "trainee" && result.trainee) {
    const trainee = result.trainee;
    const rc = COLORS.brand;
    const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.65] });
    return (
      <Animated.View style={[revealStyles.fullOverlay, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient
          colors={[rc + "28", "#050A0F", "#050A0F"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
          pointerEvents="none"
        />
        <Animated.View style={[revealStyles.fullGlowBorder, { borderColor: rc, opacity: glowOpacity }]} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={revealStyles.fullScrollContent} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={[revealStyles.portraitZone, { height: portraitH }]}>
            <View style={revealStyles.fullIconZone}>
              <Ionicons name="people" size={96} color={rc} />
            </View>
            <View style={[revealStyles.rarityPill, { backgroundColor: rc + "22", borderColor: rc + "80" }]}>
              <Text style={[revealStyles.rarityPillTxt, { color: rc }]}>CLASS TRAINEES</Text>
            </View>
          </View>
          <View style={revealStyles.infoBlock}>
            <View style={revealStyles.roleRow}>
              <Text style={[revealStyles.roleBracket, { color: rc + "AA" }]}>⟦</Text>
              <Text style={[revealStyles.roleTxt, { color: rc }]}>+{result.traineeAmount} {trainee.label.toUpperCase()}</Text>
              <Text style={[revealStyles.roleBracket, { color: rc + "AA" }]}>⟧</Text>
            </View>
            <View style={[revealStyles.badge, { borderColor: rc + "60", backgroundColor: rc + "18", alignSelf: "center" }]}>
              <Text style={[revealStyles.badgeTxt, { color: rc }]}>{trainee.role} Class</Text>
            </View>
            <Text style={revealStyles.desc}>
              {showTraineeInfo
                ? `Class Trainees are shared training materials for your ward team. Use them at the Training Hall to raise a healer's Certification Star — unlocking higher level caps and greater power. They can also power hero evolution in future systems.`
                : `${trainee.label}s are used to promote ${trainee.role} healers. Use them at the Training Hall.`}
            </Text>
          </View>
        </ScrollView>
        <View style={[revealStyles.ctaContainer, { borderTopColor: rc + "30" }]}>
          <Pressable style={[revealStyles.ctaBtn, { backgroundColor: rc }]} onPress={handleDismiss} testID="reveal-cta">
            <Text style={revealStyles.ctaTxt}>GOT IT</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  // ── DUPLICATE → SHARDS reveal ──────────────────────────────────────────────
  if (result.kind === "shards" && result.entry) {
    const rc = rarityColor(result.entry.rarity);
    const rLabel = result.entry.rarity === 5 ? "LEGENDARY" : result.entry.rarity === 4 ? "RARE" : result.entry.rarity === 3 ? "UNCOMMON" : "COMMON";
    const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.65] });
    return (
      <Animated.View style={[revealStyles.fullOverlay, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient
          colors={[rc + "28", "#050A0F", "#050A0F"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
          pointerEvents="none"
        />
        <Animated.View style={[revealStyles.fullGlowBorder, { borderColor: rc, opacity: glowOpacity }]} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={revealStyles.fullScrollContent} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={[revealStyles.portraitZone, { height: portraitH }]}>
            <View style={revealStyles.fullIconZone}>
              <Ionicons name="sparkles" size={96} color={rc} />
            </View>
            <View style={[revealStyles.rarityPill, { backgroundColor: rc + "22", borderColor: rc + "80" }]}>
              <Text style={[revealStyles.rarityPillTxt, { color: rc }]}>DUPLICATE · CONVERTED TO SHARDS</Text>
            </View>
          </View>
          <View style={revealStyles.infoBlock}>
            <View style={revealStyles.roleRow}>
              <Text style={[revealStyles.roleBracket, { color: rc + "AA" }]}>⟦</Text>
              <Text style={[revealStyles.roleTxt, { color: rc }]}>+{result.shardAmount} SHARDS</Text>
              <Text style={[revealStyles.roleBracket, { color: rc + "AA" }]}>⟧</Text>
            </View>
            <Text style={[revealStyles.heroName, { color: COLORS.onSurface, textAlign: "center" }]}>{result.entry.name}</Text>
            <View style={[revealStyles.badge, { borderColor: rc + "60", backgroundColor: rc + "18", alignSelf: "center" }]}>
              <Text style={[revealStyles.badgeTxt, { color: rc }]}>{rLabel} · Already Enrolled</Text>
            </View>
            <Text style={revealStyles.desc}>
              You already have this healer on your ward team. The duplicate was converted into Hero Shards — use them at the Training Hall to raise their Certification Star and unlock higher power.
            </Text>
          </View>
        </ScrollView>
        <View style={[revealStyles.ctaContainer, { borderTopColor: rc + "30" }]}>
          <Pressable style={[revealStyles.ctaBtn, { backgroundColor: rc }]} onPress={handleDismiss} testID="reveal-cta">
            <Text style={revealStyles.ctaTxt}>GOT IT</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  // ── CREDITS reveal ─────────────────────────────────────────────────────────
  if (result.kind === "credits") {
    const rc = "#D4AF37";
    const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.65] });
    return (
      <Animated.View style={[revealStyles.fullOverlay, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient
          colors={[rc + "28", "#050A0F", "#050A0F"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
          pointerEvents="none"
        />
        <Animated.View style={[revealStyles.fullGlowBorder, { borderColor: rc, opacity: glowOpacity }]} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={revealStyles.fullScrollContent} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={[revealStyles.portraitZone, { height: portraitH }]}>
            <View style={revealStyles.fullIconZone}>
              <Ionicons name="school" size={96} color={rc} />
            </View>
            <View style={[revealStyles.rarityPill, { backgroundColor: rc + "22", borderColor: rc + "80" }]}>
              <Text style={[revealStyles.rarityPillTxt, { color: rc }]}>UNIVERSITY CREDITS</Text>
            </View>
          </View>
          <View style={revealStyles.infoBlock}>
            <View style={revealStyles.roleRow}>
              <Text style={[revealStyles.roleBracket, { color: rc + "AA" }]}>⟦</Text>
              <Text style={[revealStyles.roleTxt, { color: rc }]}>+{result.creditsAmount} CREDITS</Text>
              <Text style={[revealStyles.roleBracket, { color: rc + "AA" }]}>⟧</Text>
            </View>
            <Text style={revealStyles.desc}>
              University Credits fund hero certification upgrades and research. Spend them at the Training Hall to promote your healers to higher Certification Stars.
            </Text>
          </View>
        </ScrollView>
        <View style={[revealStyles.ctaContainer, { borderTopColor: rc + "30" }]}>
          <Pressable style={[revealStyles.ctaBtn, { backgroundColor: rc }]} onPress={handleDismiss} testID="reveal-cta">
            <Text style={revealStyles.ctaTxt}>GOT IT</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  return null;
}

function CeremonyResultCard({ result }: { result: RecruitResult }) {
  const rc = result.entry ? rarityColor(result.entry.rarity) : "#D4AF37";
  return (
    <View style={[styles.ceremonyResultCard, { borderColor: rc }]} testID="recruit-ceremony-result">
      <View style={styles.ceremonyResultHeader}>
        <Ionicons name="sparkles" size={16} color={rc} />
        <Text style={[styles.ceremonyResultLabel, { color: rc }]}>HEALER ENROLLED</Text>
        <Ionicons name="sparkles" size={16} color={rc} />
      </View>
      {result.entry && (
        <>
          <Text style={[styles.ceremonyResultName, { color: rc }]}>{result.entry.name}</Text>
          <View style={[styles.tierPill, { borderColor: rc + "70" }]}>
            <Text style={[styles.tierPillTxt, { color: rc }]}>
              {result.entry.role} · {rarityTierLabel(result.entry.rarity)}
            </Text>
          </View>
        </>
      )}
      <Text style={styles.ceremonyResultMsg}>{result.message}</Text>
    </View>
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
  kicker: { color: COLORS.brand, fontSize: 12, letterSpacing: 0.6, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 30, fontWeight: "700" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 15, marginTop: 2 },
  walletRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
  shardCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginTop: SPACING.sm, alignSelf: "flex-start",
  },
  shardVal: { color: COLORS.brand, fontSize: 18, fontWeight: "300" },
  shardLbl: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 0.5, fontWeight: "700" },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  errorTxt: { color: COLORS.brandSecondary, fontSize: 13, textAlign: "center" },

  // Ceremony section
  ceremonySection: { gap: SPACING.md },
  ceremonyStepRow: { flexDirection: "row" as const, alignItems: "center", gap: 6 },
  ceremonyStep: {
    flex: 1, flexDirection: "row" as const, alignItems: "center", gap: 6,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 7,
  },
  ceremonyStepLine: { width: 16, height: 1, backgroundColor: "#D4AF3750" },
  ceremonyStepTxt: { fontSize: 12, fontWeight: "700" as const, color: "#D4AF37", flex: 1 },
  ceremonyCard: {
    borderRadius: RADIUS.lg, overflow: "hidden" as const,
    borderWidth: 1.5, borderColor: "#D4AF3760",
    padding: SPACING.lg, gap: SPACING.md,
    position: "relative" as const,
  },
  ceremonyCardBorder: {
    position: "absolute" as const, top: 0, left: 0, right: 0,
    height: 2, backgroundColor: "#D4AF37",
  },
  ceremonyCardTop: { gap: 8 },
  ceremonyBadge: {
    alignSelf: "flex-start" as const,
    backgroundColor: "#D4AF3725",
    borderWidth: 1, borderColor: "#D4AF3770",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  ceremonyBadgeTxt: { color: "#D4AF37", fontSize: 13, fontWeight: "700" as const, letterSpacing: 0.4 },
  ceremonyCardTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: "700" as const, letterSpacing: 0.1 },
  ceremonyCardDesc: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21 },
  ceremonyPulseRing: {
    position: "absolute" as const,
    top: -3, bottom: -3, left: -3, right: -3,
    borderRadius: RADIUS.lg + 3,
    borderWidth: 2, borderColor: "#D4AF37",
  },
  ceremonyBtn: {
    height: 52, borderRadius: RADIUS.md, overflow: "hidden" as const,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  ceremonyBtnInner: { flexDirection: "row" as const, alignItems: "center", gap: 8 },
  ceremonyBtnTxt: { color: "#0D1200", fontSize: 16, fontWeight: "800" as const, letterSpacing: 0.3 },
  ceremonyBtnFree: {
    backgroundColor: "#0D1200", color: "#D4AF37",
    fontSize: 12, fontWeight: "800" as const, letterSpacing: 0.4,
    borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 2,
  },
  ceremonyNote: {
    color: COLORS.onSurfaceTertiary, fontSize: 13, textAlign: "center" as const,
    lineHeight: 19, fontStyle: "italic" as const,
  },
  ceremonySectionDivider: {
    flexDirection: "row" as const, alignItems: "center", gap: 8, marginTop: 4,
  },
  ceremonySectionLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  ceremonySectionDividerTxt: {
    color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: "700" as const, letterSpacing: 0.4,
  },

  // Ceremony result
  ceremonyResultCard: {
    backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 2,
    alignItems: "center" as const, gap: 8,
  },
  ceremonyResultHeader: { flexDirection: "row" as const, alignItems: "center", gap: 8 },
  ceremonyResultLabel: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.8 },
  ceremonyResultName: { fontSize: 22, fontWeight: "400" as const, letterSpacing: 0.1 },
  ceremonyResultMsg: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: "center" as const, marginTop: 2 },

  // Normal result cards
  resultCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 2, alignItems: "center", gap: 6 },
  resultName: { fontSize: 20, fontWeight: "400" },
  tierPill: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tierPillTxt: { fontSize: 12, fontWeight: "700", letterSpacing: 0.2 },
  resultMsg: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: "center", marginTop: 4 },
  batchGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  tile: {
    width: "31%", borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, alignItems: "center", gap: 4, minHeight: 64, justifyContent: "center",
  },
  tileName: { fontSize: 13, fontWeight: "700" },
  tileMeta: { fontSize: 12, color: COLORS.onSurfaceTertiary, textAlign: "center" },

  // Buttons
  btn: {
    height: 56, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center",
    overflow: "hidden", flexDirection: "row", gap: SPACING.md,
  },
  btnTxt: { color: COLORS.onBrand, fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
  btnCost: { color: COLORS.onBrand, fontSize: 13, opacity: 0.85 },
  btnOutline: {
    height: 56, borderRadius: RADIUS.md, borderWidth: 2, alignItems: "center", justifyContent: "center", gap: 2,
  },
  btnOutlineTxt: { fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
  btnOutlineCost: { fontSize: 12, color: COLORS.onSurfaceTertiary },
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
  oddsTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  oddsLine: { color: COLORS.onSurfaceTertiary, fontSize: 13 },
  oddsCeremonyNote: { color: "#D4AF3799", fontSize: 12, fontStyle: "italic", marginTop: 4 },
  freeSummonWrap: { position: "relative" as const },
  freePulseRing: {
    position: "absolute" as const,
    top: -4, bottom: -4, left: -4, right: -4,
    borderRadius: RADIUS.md + 4,
    borderWidth: 3, borderColor: "#3DC4A8",
  },
  freeSummonBtn: {
    borderRadius: RADIUS.md, borderWidth: 2, borderColor: "#3DC4A840",
    backgroundColor: "#3DC4A808", overflow: "hidden",
  },
  freeSummonBtnActive: {
    borderColor: "#3DC4A8", backgroundColor: "#3DC4A812",
    shadowColor: "#3DC4A8", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
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
  freeBadgeActive: { backgroundColor: "#3DC4A8" },
  freeBadgeTxt: { color: "#082019", fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  freeSummonTxt: { color: COLORS.onSurfaceSecondary, fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
  freeSummonSub: { color: COLORS.onSurfaceTertiary, fontSize: 13, marginTop: 2 },
  freeReadyBanner: {
    flexDirection: "row" as const, alignItems: "flex-start", gap: 6,
    backgroundColor: "#3DC4A815", borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: "#3DC4A840",
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, marginTop: SPACING.xs,
  },
  freeReadyBannerTxt: {
    flex: 1, fontSize: 13, color: "#4FD8C4", lineHeight: 20, fontWeight: "600" as const,
  },
  earnCard: {
    borderWidth: 1, borderColor: COLORS.brand + "35", borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, gap: 4,
  },
  earnCardHeader: { flexDirection: "row" as const, alignItems: "center", gap: 6, marginBottom: 2 },
  earnCardTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700" as const },
  earnCardLine: { color: COLORS.onSurfaceSecondary, fontSize: 13 },
  earnCardNote: { color: COLORS.brand, fontSize: 12, fontStyle: "italic" as const, marginTop: 2 },
});

// ── Reveal modal styles (full-screen) ────────────────────────────────────────
const revealStyles = StyleSheet.create({
  // Full-screen animated container — replaces old centred card
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#050A0F",
    zIndex: 3000,
    overflow: "hidden",
  },
  fullGlowBorder: {
    position: "absolute",
    top: 0, bottom: 0, left: 0, right: 0,
    borderWidth: 3,
    zIndex: 1,
    pointerEvents: "none",
  },

  // Portrait zone — occupies top 58% of screen
  portraitZone: {
    width: "100%",
    overflow: "hidden",
    position: "relative",
  },
  fullPortrait: {
    width: "100%",
    height: "100%",
  },
  fullPortraitPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
  },
  fullIconZone: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  portraitFade: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    height: 120,
    pointerEvents: "none",
  },

  // Rarity pill — absolute at top of portrait zone
  rarityPill: {
    position: "absolute",
    top: SPACING.xl,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  rarityPillTxt: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
  },

  // Scrollable content below portrait
  fullScrollContent: {
    paddingBottom: SPACING.xxxl,
  },
  infoBlock: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    gap: SPACING.md,
    alignItems: "center",
  },

  // Large decorative role line
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roleBracket: {
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 36,
  },
  roleTxt: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2.5,
  },

  // Hero identity
  heroName: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: COLORS.onSurface,
    textAlign: "center",
  },
  heroTitle: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
  },

  // Badges
  badgeRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  badge: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeTxt: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  // Care chain chips
  chainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  chainLabel: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  chainChip: {
    backgroundColor: "#0F2420",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#3DC4A845",
  },
  chainChipTxt: {
    color: "#4FD8C4",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Description + quote
  desc: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  quote: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 19,
    textAlign: "center",
  },

  // CTA bar — anchored at bottom
  ctaContainer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
    backgroundColor: "#050A0F",
  },
  ctaBtn: {
    height: 54,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  ctaTxt: {
    color: "#07120F",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1.0,
  },
});
