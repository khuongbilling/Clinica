import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

import { BOSS_LORD_IMBALANCE, CODEX, ENEMIES } from "@/src/game/content";
import { getEnemyHint } from "@/src/game/onboarding";
import { playRewardCue } from "@/src/game/cues";
import { getEnemySprite } from "@/src/components/EnemySprites";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { calculateRewards, computeStars, ENEMY_CLINICAL, getStarRules, type LearningProfile } from "@/src/game/clinical";
import { getLotusNodeForEnemy, isLotusNodeComplete } from "@/src/game/lotusLessons";
import { getMission } from "@/src/game/missions";
import { useTestSession } from "@/src/game/testSession";
import { getExplanationLayer, getVictorySummary } from "@/src/game/explanationLayers";
import { getDifficultyModifier } from "@/src/game/difficulty";
import { buildGateContext, checkFeatureGate } from "@/src/game/progression";
import { HEROES } from "@/src/game/content";
import { VERDANTHA } from "@/src/game/worldEvent";
import { SceneTransition } from "@/src/components/onboarding/SceneTransition";
import { OnboardingProgressBar } from "@/src/components/onboarding/OnboardingProgressBar";
import { MilestoneReward, type MilestoneRewardItem } from "@/src/components/onboarding/MilestoneReward";

const EPIDEMIC_ACCENT = "#34D399";

interface HeroXpAwardParsed { heroId: string; contributionShare: number; xpAwarded: number }
interface HeroLevelUpParsed { heroId: string; fromLevel: number; toLevel: number }
interface PlayerLevelUpParsed { fromLevel: number; toLevel: number }

export default function Result() {
  const router = useRouter();
  const { player } = usePlayer();
  const { logEvent } = useTestSession();
  const { outcome, enemyId, stability, training, prologue, replay, shards, crowns, epidemicTokens, fullChain, unsafe, poorFit, turns, reassess, consults, emergency, inappropriate, basicAid, playerXp, heroXp, playerLevelUp: playerLevelUpParam, heroLevelUps: heroLevelUpsParam } = useLocalSearchParams<{
    outcome: string; enemyId: string; stability: string; training?: string; prologue?: string; replay?: string; shards?: string; crowns?: string; epidemicTokens?: string;
    fullChain?: string; unsafe?: string; poorFit?: string; turns?: string; reassess?: string;
    consults?: string; emergency?: string; inappropriate?: string; basicAid?: string;
    playerXp?: string; heroXp?: string; playerLevelUp?: string; heroLevelUps?: string;
  }>();
  const won = outcome === "win";
  const isTraining = training === "1";
  const isPrologueTutorial = prologue === "tutorial";
  // Push 6 — Replay Prologue keeps a rewards-free flag threaded all the way
  // into the next battle leg (the scripted boss fight) so it also skips
  // granting anything.
  const isReplay = replay === "1";
  const baseShards = parseInt(shards || "0", 10);
  const crownsEarned = parseInt(crowns || "0", 10);
  const epidemicTokensEarned = parseInt(epidemicTokens || "0", 10);
  // Only offer the "spend at the Apothecary Market" shortcut once the Shop is
  // actually unlocked — otherwise the card would bounce the player into a locked
  // screen. When still gated, the card stays informational (non-pressable).
  const shopGate = checkFeatureGate("shop", buildGateContext(player));
  const fullChainCompleted = fullChain === "1";
  const consultsUsed = parseInt(consults || "0", 10);
  const emergencyCallsUsed = parseInt(emergency || "0", 10);
  const inappropriateConsultsUsed = parseInt(inappropriate || "0", 10);
  const basicAidUses = parseInt(basicAid || "0", 10);
  const playerXpEarned = parseInt(playerXp || "0", 10);
  const heroXpBreakdown: HeroXpAwardParsed[] = useMemo(() => {
    if (!heroXp) return [];
    try {
      const parsed = JSON.parse(heroXp);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [heroXp]);
  const playerLevelUp: PlayerLevelUpParsed | null = useMemo(() => {
    if (!playerLevelUpParam) return null;
    try { return JSON.parse(playerLevelUpParam); } catch { return null; }
  }, [playerLevelUpParam]);
  const heroLevelUps: HeroLevelUpParsed[] = useMemo(() => {
    if (!heroLevelUpsParam) return [];
    try {
      const parsed = JSON.parse(heroLevelUpsParam);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [heroLevelUpsParam]);
  const heroName = (id: string) => HEROES.find((h) => h.id === id)?.name || id;
  const enemy = useMemo(() => {
    if (enemyId === BOSS_LORD_IMBALANCE.id) return BOSS_LORD_IMBALANCE;
    return ENEMIES.find((e) => e.id === enemyId);
  }, [enemyId]);

  const codexUnlocked = useMemo(() => {
    if (!enemy || !won) return [];
    return CODEX.filter((c) => enemy.teaches.includes(c.id));
  }, [enemy, won]);

  const mission = enemy ? getMission(enemy.id) : null;
  const enemyClinical = enemy ? ENEMY_CLINICAL[enemy.id] : undefined;
  const profile = (player?.learning_profile as LearningProfile | undefined) || undefined;
  const explanationLayer = getExplanationLayer(player?.learning_profile);
  const victorySummary = enemy ? getVictorySummary(enemy.id, explanationLayer) : null;
  const linkedLesson = enemy ? getLotusNodeForEnemy(enemy.id) : undefined;
  const lessonComplete = (linkedLesson && player) ? isLotusNodeComplete(player, linkedLesson.id) : false;
  const diffMod = getDifficultyModifier(player?.difficulty as any);
  const starRules = getStarRules(profile, enemyClinical);
  const starResult = useMemo(() => {
    return computeStars({
      won,
      fullChainCompleted,
      unsafeActionsUsed: parseInt(unsafe || "0", 10),
      poorFitActionsUsed: parseInt(poorFit || "0", 10),
      turnsTaken: parseInt(turns || "0", 10),
      reassessUsed: reassess === "1",
      consultsUsed,
      emergencyCallsUsed,
      inappropriateConsultsUsed,
      basicAidUses,
    }, starRules);
  }, [won, fullChainCompleted, unsafe, poorFit, turns, reassess, consultsUsed, emergencyCallsUsed, inappropriateConsultsUsed, basicAidUses, starRules]);

  const rewardBreakdown = won ? calculateRewards(baseShards, starResult.stars, fullChainCompleted) : null;

  // First Simulation Shift (prologue tutorial win) — present the modest
  // rewards as a single onboarding milestone card instead of only the
  // scattered shards/crowns cards below.
  const firstShiftRewards: MilestoneRewardItem[] = useMemo(() => {
    const items: MilestoneRewardItem[] = [
      { icon: "heart", label: "Patient stabilized" },
      { icon: "star", label: "Stars", amount: String(starResult.stars) },
    ];
    if (rewardBreakdown && rewardBreakdown.total > 0) items.push({ icon: "diamond", label: "Codex Shards", amount: String(rewardBreakdown.total) });
    if (crownsEarned > 0) items.push({ icon: "cash-outline", label: "Crowns", amount: String(crownsEarned) });
    return items;
  }, [starResult.stars, rewardBreakdown, crownsEarned]);

  useEffect(() => {
    logEvent('victory_screen_viewed', 'result', {
      meta: { won, enemyId: enemy?.id, stars: starResult.stars },
    });
    if (won) {
      playRewardCue(true);
      logEvent('stars_earned', 'result', { meta: { stars: starResult.stars, enemyId: enemy?.id } });
      if (mission) logEvent('region_progress_updated', 'result', { meta: { region: mission.kingdomRegion } });
    }
  }, []);


  // After loss, current failure count was just incremented by battle.tsx
  const failureCount = enemy ? ((player?.failure_counts || {})[enemy.id] || 0) : 0;
  const hints = enemy ? getEnemyHint(enemy.id) : null;

  // For the result hint banner:
  // - 1 failure → gentle hint
  // - 2 failures → tactical hint
  // - 3+ failures → training battle offer
  const showTactical = !won && failureCount === 2;
  const showTraining = !won && failureCount >= 3;

  const retryTraining = () => {
    if (!enemy) return;
    router.replace({ pathname: "/battle", params: { enemyId: enemy.id, training: "1" } });
  };
  const retryNormal = () => {
    if (!enemy) return;
    router.replace({ pathname: "/battle", params: { enemyId: enemy.id } });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {won && isPrologueTutorial && (
          <SceneTransition duration={800}>
            <OnboardingProgressBar step="First Shift" />
          </SceneTransition>
        )}
        <View style={styles.head}>
          {enemy && getEnemySprite(enemy.id) ? (
            <View style={[styles.enemyResultPortrait, { borderColor: won ? COLORS.success : COLORS.error }]}>
              <ExpoImage source={getEnemySprite(enemy.id)!} style={styles.enemyResultImg} contentFit="contain" />
              <View style={[styles.enemyResultBadge, { backgroundColor: won ? COLORS.success : COLORS.error }]}>
                <Ionicons name={won ? "shield-checkmark" : "alert-circle"} size={22} color={COLORS.surface} />
              </View>
            </View>
          ) : (
            <Ionicons
              name={won ? "shield-checkmark" : "alert-circle"}
              size={64}
              color={won ? COLORS.success : COLORS.error}
            />
          )}
          <Text style={styles.kicker}>{won ? "ENCOUNTER PURIFIED" : "PATIENT LOST"}</Text>
          <Text style={styles.title}>{won && mission ? mission.victoryTitle : enemy?.name ?? ""}</Text>
          <Text style={styles.sub}>{won && mission ? enemy?.name : enemy?.realWorld}{isTraining ? " · Training" : ""}</Text>
        </View>

        {won && isPrologueTutorial && (
          <MilestoneReward
            title="FIRST SIMULATION SHIFT COMPLETE"
            items={firstShiftRewards}
            accent={COLORS.success}
          />
        )}

        {won && (
          <>
            {/* Stars */}
            <View style={styles.starsCard}>
              <Text style={styles.starsTitle}>STARS EARNED</Text>
              <View style={styles.starsRow}>
                {[0, 1, 2].map((i) => (
                  <Ionicons
                    key={i}
                    name={i < starResult.stars ? "star" : "star-outline"}
                    size={36}
                    color={i < starResult.stars ? COLORS.brand : COLORS.onSurfaceTertiary}
                    style={{ marginHorizontal: 4 }}
                  />
                ))}
              </View>
              <View style={{ gap: 4, marginTop: 8 }}>
                {(mission?.starGoals ?? ["Stabilized the patient.", "Completed the clinical care chain.", "Efficient and safe care."]).map((label, i) => (
                  <View key={i} style={styles.starLine}>
                    <Ionicons name={i < starResult.stars ? "checkmark-circle" : "ellipse-outline"} size={14} color={i < starResult.stars ? COLORS.success : COLORS.onSurfaceTertiary} />
                    <Text style={[styles.starLabel, i < starResult.stars && { color: COLORS.onSurface }]}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {victorySummary && (
              <View style={styles.victorySummaryCard}>
                <Text style={styles.victorySummaryTitle}>WHAT YOU LEARNED</Text>
                <Text style={styles.victorySummaryText}>{victorySummary.summary}</Text>
                {victorySummary.nclexSteps && victorySummary.nclexSteps.length > 0 && (
                  <View style={{ marginTop: 8, gap: 4 }}>
                    {victorySummary.nclexSteps.map((step, i) => (
                      <View key={i} style={styles.victoryStepRow}>
                        <Ionicons name="checkmark-circle-outline" size={12} color={COLORS.brand} />
                        <Text style={styles.victoryStepText}>{step}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {victorySummary.terms && victorySummary.terms.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {victorySummary.terms.map((t, i) => (
                      <View key={i} style={styles.victoryTermChip}>
                        <Text style={styles.victoryTermText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {diffMod.rewardMultiplier !== 1 && (
              <View style={styles.diffRewardNote}>
                <Ionicons name="trending-up-outline" size={14} color={COLORS.brand} />
                <Text style={styles.diffRewardText}>
                  {diffMod.rewardMultiplier > 1
                    ? `+${Math.round((diffMod.rewardMultiplier - 1) * 100)}% difficulty bonus applied`
                    : `${Math.round((1 - diffMod.rewardMultiplier) * 100)}% guided-mode reduction applied`}
                </Text>
              </View>
            )}

            {mission && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>WHAT HAPPENED</Text>
                <Text style={styles.summaryText}>{mission.clinicalSummary}</Text>
              </View>
            )}

            {(consultsUsed > 0 || emergencyCallsUsed > 0 || inappropriateConsultsUsed > 0 || basicAidUses > 2) && (
              <View style={styles.consultCard} testID="result-consult-notes">
                <Text style={styles.consultTitle}>CLINICAL FORM</Text>
                {basicAidUses > 2 && (
                  <Text style={styles.consultWarn}>• {basicAidUses}× Care Attempt — efficiency star withheld. Targeted clinical skills are stronger.</Text>
                )}
                {consultsUsed === 1 && inappropriateConsultsUsed === 0 && emergencyCallsUsed === 0 && (
                  <Text style={styles.consultGood}>✓ One consult used appropriately — efficient teamwork.</Text>
                )}
                {consultsUsed > 1 && (
                  <Text style={styles.consultWarn}>• {consultsUsed} consults used — efficiency star reduced.</Text>
                )}
                {emergencyCallsUsed > 0 && (
                  <Text style={styles.consultWarn}>• Rapid Response was needed — efficiency star withheld.</Text>
                )}
                {inappropriateConsultsUsed > 0 && (
                  <Text style={styles.consultWarn}>• {inappropriateConsultsUsed} consult{inappropriateConsultsUsed > 1 ? 's' : ''} did not fit the clinical problem.</Text>
                )}
              </View>
            )}

            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statLbl}>STABILITY</Text>
                <Text style={styles.statVal}>{stability}%</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLbl}>PLAYER EXP</Text>
                <Text style={styles.statVal}>+{playerXpEarned}</Text>
              </View>
            </View>

            {playerLevelUp && (
              <View style={styles.playerLevelUpCard} testID="result-player-levelup">
                <Ionicons name="ribbon" size={22} color={COLORS.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerLevelUpTitle}>HEALER LEVEL UP!</Text>
                  <Text style={styles.playerLevelUpText}>
                    Player Level {playerLevelUp.fromLevel} → {playerLevelUp.toLevel}
                  </Text>
                </View>
              </View>
            )}

            {heroXpBreakdown.length > 0 && (
              <View style={styles.heroXpCard} testID="result-hero-xp">
                <Text style={styles.heroXpTitle}>HERO CONTRIBUTION</Text>
                {heroXpBreakdown.map((h) => (
                  <View key={h.heroId} style={styles.heroXpRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heroXpName}>{heroName(h.heroId)}</Text>
                      <Text style={styles.heroXpShare}>{Math.round(h.contributionShare * 100)}% contribution</Text>
                    </View>
                    <Text style={styles.heroXpVal}>+{h.xpAwarded} XP</Text>
                  </View>
                ))}
                {heroLevelUps.length > 0 && (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {heroLevelUps.map((l) => (
                      <View key={l.heroId} style={styles.heroLevelUpRow}>
                        <Ionicons name="trending-up" size={16} color={COLORS.success} />
                        <Text style={styles.heroLevelUpText}>
                          {heroName(l.heroId)} leveled up! Lv.{l.fromLevel} → Lv.{l.toLevel}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {rewardBreakdown && rewardBreakdown.total > 0 && (
              <View style={styles.shardsCard} testID="result-shards">
                <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
                  <Ionicons name="diamond" size={20} color={COLORS.brand} />
                  <Text style={styles.shardsTxt}>{rewardBreakdown.total} Codex Shards earned.</Text>
                </View>
                <Text style={styles.shardsBreakdown}>
                  Base {rewardBreakdown.base}{rewardBreakdown.starBonus ? ` · Stars +${rewardBreakdown.starBonus}` : ""}{rewardBreakdown.chainBonus ? ` · Care Chain +${rewardBreakdown.chainBonus}` : ""}
                </Text>
              </View>
            )}

            {crownsEarned > 0 && (
              shopGate.unlocked ? (
                <Pressable style={styles.crownsCard} testID="result-crowns" onPress={() => router.push("/(tabs)/shop")}>
                  <Ionicons name="cash-outline" size={20} color={COLORS.energy} />
                  <Text style={styles.crownsTxt}>+{crownsEarned} Crowns earned — spend them at the Apothecary Market.</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.energy} />
                </Pressable>
              ) : (
                <View style={styles.crownsCard} testID="result-crowns-locked">
                  <Ionicons name="cash-outline" size={20} color={COLORS.energy} />
                  <Text style={styles.crownsTxt}>
                    +{crownsEarned} Crowns earned — {shopGate.reason || "unlock the Apothecary Market to spend them."}
                  </Text>
                </View>
              )
            )}

            {epidemicTokensEarned > 0 && (
              <Pressable style={styles.tokensCard} testID="result-epidemic-tokens" onPress={() => router.push("/world-event")}>
                <Ionicons name="flask" size={20} color={EPIDEMIC_ACCENT} />
                <Text style={styles.tokensTxt}>
                  +{epidemicTokensEarned} Epidemic Token{epidemicTokensEarned > 1 ? "s" : ""} — your Ward Shift helped contain the Miasma Bloom.
                </Text>
                <Ionicons name="chevron-forward" size={16} color={EPIDEMIC_ACCENT} />
              </Pressable>
            )}

            {enemy?.worldBoss && (
              <View style={styles.bossDropCard} testID="result-worldboss-drop">
                <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
                  <Ionicons name="cube" size={20} color={EPIDEMIC_ACCENT} />
                  <Text style={styles.bossDropTitle}>WORLD BOSS RELIC</Text>
                </View>
                <Text style={styles.bossDropTxt}>
                  World Boss Relic Shard secured — a crystallised remnant of {enemy.name}'s core.
                </Text>
                <View style={styles.bossDropDivider} />
                {VERDANTHA.dropRewards.map((drop, i) => (
                  <View key={i} style={styles.bossDropRow}>
                    <Ionicons name="cube-outline" size={13} color={EPIDEMIC_ACCENT} />
                    <Text style={styles.bossDropRowTxt}>{drop}</Text>
                  </View>
                ))}
              </View>
            )}

            {mission && (
              <View style={styles.kingdomCard}>
                <Ionicons name="globe-outline" size={16} color={COLORS.brand} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={styles.kingdomTitle}>{mission.kingdomRegion}</Text>
                    <Text style={styles.kingdomSub}>
                      {Math.min((player?.region_progress?.[mission.kingdomRegion] ?? 0), mission.kingdomMax)}/{mission.kingdomMax} restored
                    </Text>
                  </View>
                  <View style={styles.regionBar}>
                    <View style={[styles.regionFill, { width: `${Math.min(((player?.region_progress?.[mission.kingdomRegion] ?? 0) / mission.kingdomMax) * 100, 100)}%` as any }]} />
                  </View>
                </View>
              </View>
            )}

            {codexUnlocked.length > 0 && (
              <>
                <Text style={styles.section}>Codex Pages Restored</Text>
                {codexUnlocked.map((c) => (
                  <View key={c.id} style={styles.codex}>
                    <Ionicons name="book" size={18} color={COLORS.brand} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.codexTitle}>{c.title}</Text>
                      <Text style={styles.codexBody} numberOfLines={3}>{c.body}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* ── What This Case Taught — clinical reflection card ── */}
            <View style={styles.reflectionCard} testID="result-reflection-card">
              <View style={styles.reflectionHeader}>
                <Ionicons name="leaf-outline" size={14} color={COLORS.brand} />
                <Text style={styles.reflectionKicker}>WHAT THIS CASE TAUGHT</Text>
              </View>
              <View style={styles.reflectionSteps}>
                <View style={styles.reflectionStep}>
                  <Ionicons name="search-outline" size={12} color={COLORS.brand} />
                  <Text style={styles.reflectionStepTxt}>Scout first — reveal cues before acting, so you treat the right system.</Text>
                </View>
                <View style={styles.reflectionStep}>
                  <Ionicons name="shield-outline" size={12} color={COLORS.brand} />
                  <Text style={styles.reflectionStepTxt}>Stabilize before countering — keep the patient safe, then address the cause.</Text>
                </View>
                <View style={styles.reflectionStep}>
                  <Ionicons name="refresh-outline" size={12} color={COLORS.brand} />
                  <Text style={styles.reflectionStepTxt}>Reassess after treatment — check whether the response improved or shifted.</Text>
                </View>
              </View>
              {lessonComplete && linkedLesson && (
                <View style={styles.reflectionLessonRow}>
                  <Ionicons name="checkmark-circle" size={13} color={COLORS.brand} />
                  <Text style={styles.reflectionLessonTxt}>
                    Your Lotus Lesson <Text style={styles.reflectionLessonName}>{linkedLesson.title}</Text> prepared you for this encounter.
                  </Text>
                </View>
              )}
              {(linkedLesson?.learningTags ?? []).length > 0 && (
                <View style={styles.reflectionTags}>
                  {(linkedLesson!.learningTags!).map((tag) => (
                    <View key={tag} style={styles.reflectionTag}>
                      <Text style={styles.reflectionTagTxt}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {!won && hints && (
          <View style={[styles.tipCard, showTraining && { borderColor: COLORS.brand }]}>
            <Text style={styles.tipKicker}>
              {showTraining ? "A MENTOR JOINS YOU" : showTactical ? "MENTOR'S GUIDANCE" : "THE CODEX WHISPERS"}
            </Text>
            <Text style={styles.tipTitle}>{enemy?.dangerTrigger}</Text>
            <Text style={styles.tipBody}>
              {showTraining
                ? `${hints.tactical}\n\nTry a Training Battle to learn the pattern with extra help.`
                : showTactical
                  ? hints.tactical
                  : hints.gentle}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          {showTraining && enemy && (
            <Pressable style={styles.training} onPress={retryTraining} testID="result-try-training">
              <Ionicons name="sparkles" size={16} color={COLORS.onBrand} />
              <Text style={styles.primaryTxt}>TRY TRAINING BATTLE</Text>
            </Pressable>
          )}
          {!won && enemy && (
            <Pressable style={styles.primary} onPress={retryNormal} testID="result-retry">
              <Text style={styles.primaryTxt}>TRY AGAIN</Text>
            </Pressable>
          )}
          {won && isPrologueTutorial && (
            <Pressable
              style={styles.primary}
              onPress={() => router.replace({ pathname: "/battle", params: { enemyId: "silent_infarct", prologue: "boss", replay: isReplay ? "1" : "" } })}
              testID="result-prologue-continue"
            >
              <Ionicons name="alert-circle" size={16} color={COLORS.onBrand} />
              <Text style={styles.primaryTxt}>ANSWER THE NEXT CALL</Text>
            </Pressable>
          )}
          {won && !isPrologueTutorial && (
            <Pressable style={styles.primary} onPress={() => router.replace("/shift")} testID="result-next-mission">
              <Ionicons name="arrow-forward-circle" size={16} color={COLORS.onBrand} />
              <Text style={styles.primaryTxt}>NEXT MISSION</Text>
            </Pressable>
          )}
          {!(won && isPrologueTutorial) && (
            <>
              <Pressable style={styles.secondary} onPress={() => router.replace("/(tabs)")} testID="result-back">
                <Text style={styles.secondaryTxt}>RETURN TO KINGDOM</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => router.replace("/(tabs)/codex")} testID="result-codex">
                <Text style={styles.secondaryTxt}>OPEN CODEX</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxxl },
  head: { alignItems: "center", gap: 6, marginTop: SPACING.xl },
  enemyResultPortrait: { width: 96, height: 96, borderRadius: 6, borderWidth: 3, overflow: "hidden", backgroundColor: COLORS.surfaceTertiary, position: "relative", marginBottom: SPACING.xs },
  enemyResultImg: { width: "100%", height: "100%" },
  enemyResultBadge: { position: "absolute", right: -2, bottom: -2, width: 32, height: 32, borderRadius: 4, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: COLORS.surface },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 3, fontWeight: "700", marginTop: SPACING.sm },
  title: { color: COLORS.onSurface, fontSize: 28, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceTertiary, fontSize: 13 },
  statRow: { flexDirection: "row", gap: SPACING.md },
  stat: { flex: 1, backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center", borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  statLbl: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  statVal: { color: COLORS.brand, fontSize: 28, fontWeight: "300" },
  section: { color: COLORS.onSurface, fontSize: 18, marginTop: SPACING.sm },
  codex: { flexDirection: "row", gap: SPACING.md, backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3, borderLeftColor: COLORS.brand + "80" },
  codexTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  codexBody: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 4, lineHeight: 16 },
  tipCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.error + "60", gap: SPACING.sm },
  tipKicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  tipTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: "500" },
  tipBody: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  actions: { gap: SPACING.sm, marginTop: SPACING.md },
  primary: { backgroundColor: COLORS.brand, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: SPACING.sm },
  training: { backgroundColor: COLORS.brand, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: SPACING.sm },
  primaryTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
  secondary: { borderWidth: 1, borderColor: COLORS.borderStrong, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center" },
  secondaryTxt: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
  shardsCard: { flexDirection: "column", gap: 6, backgroundColor: COLORS.brand + "14", borderColor: COLORS.brand + "40", borderWidth: 1, padding: SPACING.md, borderRadius: RADIUS.md },
  shardsTxt: { color: COLORS.brand, fontSize: 14, fontWeight: "600" },
  crownsCard: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.energy + "14", borderColor: COLORS.energy + "40", borderWidth: 1, padding: SPACING.md, borderRadius: RADIUS.md },
  crownsTxt: { color: COLORS.energy, fontSize: 14, fontWeight: "600", flex: 1 },
  tokensCard: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: EPIDEMIC_ACCENT + "14", borderColor: EPIDEMIC_ACCENT + "40", borderWidth: 1, padding: SPACING.md, borderRadius: RADIUS.md },
  tokensTxt: { color: EPIDEMIC_ACCENT, fontSize: 14, fontWeight: "600", flex: 1 },
  bossDropCard: { backgroundColor: EPIDEMIC_ACCENT + "10", borderColor: EPIDEMIC_ACCENT + "40", borderWidth: 1, padding: SPACING.md, borderRadius: RADIUS.md, gap: SPACING.sm },
  bossDropTitle: { color: EPIDEMIC_ACCENT, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  bossDropTxt: { color: COLORS.onSurface, fontSize: 13, lineHeight: 19 },
  bossDropDivider: { height: 1, backgroundColor: EPIDEMIC_ACCENT + "22" },
  bossDropRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  bossDropRowTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, flex: 1 },
  shardsBreakdown: { color: COLORS.onSurfaceSecondary, fontSize: 11 },
  starsCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, borderTopWidth: 3, borderTopColor: COLORS.brand, alignItems: "center", gap: 4 },
  starsTitle: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  starsRow: { flexDirection: "row", marginTop: 4 },
  starLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  starLabel: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  consultCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  consultTitle: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 4 },
  consultGood: { color: COLORS.success, fontSize: 12, lineHeight: 17 },
  consultWarn: { color: COLORS.warning || COLORS.brand, fontSize: 12, lineHeight: 17 },
  summaryCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3, borderLeftColor: COLORS.success + "80", gap: 6 },
  summaryTitle: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  summaryText: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20 },
  victorySummaryCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: 4, borderWidth: 1, borderColor: COLORS.brand + "40", borderLeftWidth: 3, borderLeftColor: COLORS.brand, gap: 4 },
  victorySummaryTitle: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  victorySummaryText: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20 },
  victoryStepRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  victoryStepText: { color: COLORS.onSurface, fontSize: 12, lineHeight: 18, flex: 1 },
  victoryTermChip: { backgroundColor: COLORS.brand + "14", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.brand + "30" },
  victoryTermText: { color: COLORS.brand, fontSize: 11, fontWeight: "600" },
  diffRewardNote: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.brand + "10", borderRadius: 4, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.brand + "20" },
  diffRewardText: { color: COLORS.onSurfaceSecondary, fontSize: 12, flex: 1 },
  playerLevelUpCard: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.brand + "14", borderColor: COLORS.brand, borderWidth: 1, padding: SPACING.md, borderRadius: RADIUS.md },
  playerLevelUpTitle: { color: COLORS.brand, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  playerLevelUpText: { color: COLORS.onSurface, fontSize: 14, marginTop: 2 },
  heroXpCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  heroXpTitle: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  heroXpRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroXpName: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  heroXpShare: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  heroXpVal: { color: COLORS.success, fontSize: 14, fontWeight: "600" },
  heroLevelUpRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.success + "14", borderRadius: 4, padding: SPACING.sm },
  heroLevelUpText: { color: COLORS.onSurface, fontSize: 12, fontWeight: "600", flex: 1 },
  kingdomCard: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.md,
    backgroundColor: COLORS.brand + "10", borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.brand + "30",
  },
  kingdomTitle: { color: COLORS.brand, fontSize: 13, fontWeight: "600" },
  kingdomSub: { color: COLORS.onSurfaceSecondary, fontSize: 11 },
  regionBar: { height: 4, borderRadius: 2, backgroundColor: COLORS.border, overflow: "hidden" },
  regionFill: { height: "100%", backgroundColor: COLORS.brand, borderRadius: 2 },

  reflectionCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.brand + "30",
    borderLeftWidth: 3, borderLeftColor: COLORS.brand + "80",
    padding: SPACING.md, gap: SPACING.sm,
  },
  reflectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  reflectionKicker: { color: COLORS.brand, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  reflectionSteps: { gap: 6, marginTop: 2 },
  reflectionStep: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  reflectionStepTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17, flex: 1 },
  reflectionLessonRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: COLORS.brand + "0E", borderRadius: 6,
    padding: SPACING.sm, marginTop: 2,
  },
  reflectionLessonTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17, flex: 1 },
  reflectionLessonName: { color: COLORS.brand, fontWeight: "700" },
  reflectionTags: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 2 },
  reflectionTag: {
    backgroundColor: COLORS.brand + "14", borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.brand + "28",
  },
  reflectionTagTxt: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
});
