import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { goBack } from "@/src/utils/navigation";
import { usePlayer } from "@/src/game/store";
import {
  StackScenario, StackStep, PracticeDifficulty,
  DIFFICULTY_LABEL, DIFFICULTY_COLOR, ACTIVITY_META,
  PRACTICE_REWARDS, pickRandomScenario, scrollLabel, itemLabel,
  STACK_SCENARIOS,
} from "@/src/game/uniPractice";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const META = ACTIVITY_META.stack;
type Phase = 'pick' | 'play' | 'done';

/** Fisher-Yates shuffle (pure, returns new array). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function StackLabScreen() {
  const router = useRouter();
  const { player, completeUniPractice } = usePlayer();

  const [phase, setPhase]           = useState<Phase>('pick');
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>('beginner');
  const [scenario, setScenario]     = useState<StackScenario | null>(null);
  // shuffled pool of step IDs available to pick
  const [pool, setPool]             = useState<string[]>([]);
  // ordered sequence the player has built
  const [sequence, setSequence]     = useState<string[]>([]);
  const [submitted, setSubmitted]   = useState(false);
  const [claiming, setClaiming]     = useState(false);
  const [result, setResult]         = useState<Awaited<ReturnType<typeof completeUniPractice>> | null>(null);
  const [newMilestones, setNewMilestones] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  function startPlay(diff: PracticeDifficulty) {
    const s = pickRandomScenario('stack', diff) as StackScenario | null;
    if (!s) return;
    setDifficulty(diff);
    setScenario(s);
    setPool(shuffle(s.steps.map((st) => st.id)));
    setSequence([]);
    setSubmitted(false);
    setResult(null);
    setNewMilestones([]);
    setRetryCount(0);
    setPhase('play');
  }

  function playAgain() {
    const s = pickRandomScenario('stack', difficulty, scenario?.id) as StackScenario | null;
    if (!s) return;
    setScenario(s);
    setPool(shuffle(s.steps.map((st) => st.id)));
    setSequence([]);
    setSubmitted(false);
    setResult(null);
    setNewMilestones([]);
    setRetryCount(0);
    setPhase('play');
  }

  function pickStep(stepId: string) {
    if (submitted) return;
    setPool((p) => p.filter((id) => id !== stepId));
    setSequence((s) => [...s, stepId]);
  }

  function undoLast() {
    if (!sequence.length || submitted) return;
    const last = sequence[sequence.length - 1];
    setSequence((s) => s.slice(0, -1));
    setPool((p) => [last, ...p]);
  }

  function handleRetry() {
    if (!scenario) return;
    setPool(shuffle(scenario.steps.map((st) => st.id)));
    setSequence([]);
    setSubmitted(false);
    setRetryCount((c) => c + 1);
  }

  async function handleClaim() {
    if (claiming || result) return;
    setClaiming(true);
    try {
      const res = await completeUniPractice('stack', difficulty);
      setResult(res);
      setNewMilestones(res.newMilestones.map((m) => m.label));
      setPhase('done');
    } finally {
      setClaiming(false);
    }
  }

  if (!player) return null;

  // ── Pick Difficulty ──────────────────────────────────────────────────────
  if (phase === 'pick') {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.hero}>
          <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
          <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
          </Pressable>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Ionicons name={META.icon as any} size={28} color={META.accent} />
            <Text style={styles.heroKicker}>CLINICA UNIVERSITY</Text>
            <Text style={styles.heroTitle}>{META.label}</Text>
            <Text style={styles.heroSub}>{META.description}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.safetyBox}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.safetyTxt}>General wellness education only — not personal clinical advice. {META.battleRecommend}</Text>
          </View>
          <Text style={styles.sectionLabel}>CHOOSE DIFFICULTY</Text>
          {(['beginner', 'standard', 'advanced'] as PracticeDifficulty[]).map((diff) => {
            const r = PRACTICE_REWARDS.stack[diff];
            const color = DIFFICULTY_COLOR[diff];
            const count = STACK_SCENARIOS.filter((s) => s.difficulty === diff).length;
            return (
              <Pressable key={diff} style={[styles.diffCard, { borderColor: color + '40' }]} onPress={() => startPlay(diff)}>
                <View style={[styles.badge, { backgroundColor: color + '18' }]}>
                  <Text style={[styles.badgeTxt, { color }]}>{DIFFICULTY_LABEL[diff].toUpperCase()}</Text>
                </View>
                <Text style={styles.diffDesc}>
                  {diff === 'beginner' ? '3 steps — clear sequence, no distractors.' :
                   diff === 'standard' ? '3-4 steps — slightly more complex.' :
                   '4-6 steps with one distractor action.'}
                </Text>
                <Text style={styles.poolTxt}>{count} scenarios · Wrong answers give teaching hints</Text>
                <View style={styles.chips}>
                  <Chip icon="star-outline"   color="#F59E0B" label={`+${r.playerXp} XP`} />
                  <Chip icon="school-outline" color="#2DD4BF" label={`+${r.universityCredits} UC`} />
                  <Chip icon="layers-outline" color={META.accent} label={`${r.scrollCount}× ${scrollLabel(r.scrollKey)}`} />
                  {r.bonusItemKey && <Chip icon="gift-outline" color="#A78BFA" label={`+ ${itemLabel(r.bonusItemKey!)}`} />}
                </View>
                <View style={styles.startRow}>
                  <Text style={[styles.startTxt, { color }]}>START</Text>
                  <Ionicons name="arrow-forward" size={14} color={color} />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Play ─────────────────────────────────────────────────────────────────
  if (phase === 'play' && scenario) {
    const stepMap = Object.fromEntries(scenario.steps.map((s) => [s.id, s]));
    const allPlaced = pool.length === 0 && sequence.length === scenario.steps.length;

    // After submit: compute per-step correctness
    let correctCount = 0;
    const stepResults: boolean[] = [];
    if (submitted) {
      for (let i = 0; i < sequence.length; i++) {
        const ok = sequence[i] === scenario.correctOrder[i];
        stepResults.push(ok);
        if (ok) correctCount++;
      }
    }
    const allCorrect = submitted && correctCount === scenario.steps.length;

    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => setPhase('pick')} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
          </Pressable>
          <View style={[styles.badge, { backgroundColor: DIFFICULTY_COLOR[difficulty] + '18' }]}>
            <Text style={[styles.badgeTxt, { color: DIFFICULTY_COLOR[difficulty] }]}>{DIFFICULTY_LABEL[difficulty].toUpperCase()}</Text>
          </View>
          {retryCount > 0 && (
            <View style={[styles.badge, { backgroundColor: '#F59E0B18' }]}>
              <Text style={[styles.badgeTxt, { color: '#F59E0B' }]}>RETRY {retryCount}</Text>
            </View>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.scenarioCard}>
            <Text style={styles.scenarioTitle}>{scenario.title}</Text>
            <Text style={styles.scenarioContext}>{scenario.context}</Text>
          </View>

          {/* Built sequence */}
          <View style={styles.seqBox}>
            <Text style={styles.seqLabel}>YOUR ORDER ({sequence.length}/{scenario.steps.length})</Text>
            {sequence.length === 0 && (
              <Text style={styles.seqEmpty}>Tap steps below to add them in order →</Text>
            )}
            {sequence.map((id, i) => {
              const step = stepMap[id];
              const ok = submitted ? stepResults[i] : null;
              return (
                <View key={id} style={[styles.seqRow,
                  ok === true && styles.seqRowCorrect,
                  ok === false && styles.seqRowWrong,
                ]}>
                  <View style={[styles.seqNum, ok === true && styles.seqNumCorrect, ok === false && styles.seqNumWrong]}>
                    {ok === true  && <Ionicons name="checkmark" size={10} color="#fff" />}
                    {ok === false && <Ionicons name="close" size={10} color="#fff" />}
                    {ok === null  && <Text style={styles.seqNumTxt}>{i + 1}</Text>}
                  </View>
                  <Text style={styles.seqStepTxt}>{step?.text ?? id}</Text>
                  {submitted && ok === true && step?.explanation && (
                    <Text style={styles.seqExpl}>{step.explanation}</Text>
                  )}
                  {submitted && ok === false && (
                    <Text style={[styles.seqExpl, { color: '#F87171' }]}>
                      Correct position: #{scenario.correctOrder.indexOf(id) + 1}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Available pool */}
          {!submitted && pool.length > 0 && (
            <View style={styles.poolBox}>
              <Text style={styles.poolLabel}>AVAILABLE STEPS — tap to add</Text>
              <View style={styles.poolGrid}>
                {pool.map((id) => (
                  <Pressable key={id} style={styles.poolChip} onPress={() => pickStep(id)}>
                    <Text style={styles.poolChipTxt}>{stepMap[id]?.text ?? id}</Text>
                    <Ionicons name="add" size={14} color={META.accent} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Controls */}
          {!submitted && (
            <View style={styles.controls}>
              {sequence.length > 0 && (
                <Pressable style={styles.undoBtn} onPress={undoLast}>
                  <Ionicons name="arrow-undo" size={14} color={COLORS.onSurfaceSecondary} />
                  <Text style={styles.undoTxt}>Undo Last</Text>
                </Pressable>
              )}
              {allPlaced && (
                <Pressable style={styles.submitBtn} onPress={() => setSubmitted(true)}>
                  <Text style={styles.submitTxt}>CHECK ORDER</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Post-submit teaching note */}
          {submitted && (
            <View style={[styles.feedbackBox, { borderColor: allCorrect ? '#34D399' : '#F59E0B' }]}>
              <View style={styles.feedbackTop}>
                <Ionicons name={allCorrect ? 'checkmark-circle' : 'school-outline'} size={18}
                  color={allCorrect ? '#34D399' : '#F59E0B'} />
                <Text style={[styles.feedbackVerdict, { color: allCorrect ? '#34D399' : '#F59E0B' }]}>
                  {allCorrect ? `Perfect sequence!` : `${correctCount}/${scenario.steps.length} correct — teaching note below`}
                </Text>
              </View>
              <View style={styles.teachingRow}>
                <Ionicons name="bulb-outline" size={13} color="#F59E0B" />
                <Text style={styles.teachingTxt}>{scenario.teachingNote}</Text>
              </View>

              {/* Show correct order for reference */}
              {!allCorrect && (
                <View style={styles.correctOrderBox}>
                  <Text style={styles.correctOrderLabel}>CORRECT ORDER:</Text>
                  {scenario.correctOrder.map((id, i) => (
                    <Text key={id} style={styles.correctOrderTxt}>
                      {i + 1}. {stepMap[id]?.text}
                      {stepMap[id]?.isDistractor ? ' (⚠ lower priority)' : ''}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.postActions}>
                {!allCorrect && (
                  <Pressable style={styles.retryBtn} onPress={handleRetry}>
                    <Ionicons name="refresh" size={14} color="#F59E0B" />
                    <Text style={styles.retryTxt}>TRY AGAIN</Text>
                  </Pressable>
                )}
                <Pressable style={styles.claimBtn} onPress={handleClaim} disabled={claiming}>
                  <Ionicons name="gift-outline" size={14} color="#fff" />
                  <Text style={styles.claimBtnTxt}>{claiming ? 'Claiming…' : 'CLAIM REWARDS'}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.heroKicker}>SESSION COMPLETE</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.resultBanner}>
          <Ionicons name="ribbon" size={36} color={META.accent} />
          <Text style={styles.resultTitle}>Stack Drill Complete!</Text>
          <Text style={styles.resultSub}>{DIFFICULTY_LABEL[difficulty]} · {scenario?.title}</Text>
        </View>
        {result && (
          <View style={styles.rewardsBox}>
            <Text style={styles.rewardsLabel}>REWARDS EARNED</Text>
            <View style={styles.chips}>
              <Chip icon="star-outline"   color="#F59E0B" label={`+${result.reward.playerXp} XP`} big />
              <Chip icon="person-outline" color="#FB923C" label={`+${result.reward.heroXp} Hero XP`} big />
              <Chip icon="school-outline" color="#2DD4BF" label={`+${result.reward.universityCredits} UC`} big />
              <Chip icon="layers-outline" color={META.accent} label={`${result.reward.scrollCount}× ${scrollLabel(result.reward.scrollKey)}`} big />
              {result.reward.bonusItemKey && <Chip icon="gift-outline" color="#A78BFA" label={`${result.reward.bonusItemCount}× ${itemLabel(result.reward.bonusItemKey!)}`} big />}
            </View>
          </View>
        )}
        {newMilestones.length > 0 && (
          <View style={styles.msCard}>
            <Ionicons name="trophy-outline" size={18} color="#D4AF37" />
            <Text style={styles.msLabel}>MILESTONE UNLOCKED!</Text>
            {newMilestones.map((m) => <Text key={m} style={styles.msTxt}>✓ {m}</Text>)}
          </View>
        )}
        <View style={styles.actions}>
          <Pressable style={styles.againBtn} onPress={playAgain}>
            <Ionicons name="refresh" size={16} color={META.accent} />
            <Text style={[styles.againTxt, { color: META.accent }]}>PLAY AGAIN</Text>
          </Pressable>
          <Pressable style={styles.backBtn2} onPress={() => goBack(router, "/university")}>
            <Text style={styles.backTxt2}>Back to University</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ icon, color, label, big }: { icon: string; color: string; label: string; big?: boolean }) {
  return (
    <View style={[chipS.wrap, big && chipS.big]}>
      <Ionicons name={icon as any} size={big ? 12 : 9} color={color} />
      <Text style={[chipS.txt, { color }, big && chipS.txtBig]}>{label}</Text>
    </View>
  );
}
const chipS = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 5, paddingVertical: 2 },
  big: { paddingHorizontal: 8, paddingVertical: 4 },
  txt: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  txtBig: { fontSize: 11 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: 6, overflow: 'hidden' },
  heroKicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  heroTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  heroSub: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, paddingTop: SPACING.lg },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 60 },
  safetyBox: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start', backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm, padding: SPACING.sm },
  safetyTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, flex: 1, lineHeight: 16 },
  sectionLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 2, fontWeight: '700', marginTop: SPACING.xs },
  diffCard: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, padding: SPACING.md, gap: SPACING.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  diffDesc: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },
  poolTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  startRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 4 },
  startTxt: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },

  scenarioCard: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.xs },
  scenarioTitle: { color: META.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  scenarioContext: { color: COLORS.onSurface, fontSize: 14, lineHeight: 21 },

  // Sequence builder
  seqBox: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm },
  seqLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  seqEmpty: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontStyle: 'italic' },
  seqRow: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm, gap: 3 },
  seqRowCorrect: { borderColor: '#34D399', backgroundColor: '#34D39910' },
  seqRowWrong:   { borderColor: '#F87171', backgroundColor: '#F8717110' },
  seqNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  seqNumCorrect: { backgroundColor: '#34D399' },
  seqNumWrong: { backgroundColor: '#F87171' },
  seqNumTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: '700' },
  seqStepTxt: { color: COLORS.onSurface, fontSize: 13, fontWeight: '600', marginLeft: 28 },
  seqExpl: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginLeft: 28, lineHeight: 16 },

  // Pool
  poolBox: { gap: SPACING.sm },
  poolLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  poolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  poolChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: META.accent + '40', paddingHorizontal: 10, paddingVertical: 8 },
  poolChipTxt: { color: COLORS.onSurface, fontSize: 12, fontWeight: '600', maxWidth: 160 },

  controls: { gap: SPACING.sm },
  undoBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 10 },
  undoTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12 },
  submitBtn: { backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  submitTxt: { color: '#071018', fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },

  feedbackBox: { borderRadius: RADIUS.md, borderWidth: 1, backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, gap: SPACING.sm },
  feedbackTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  feedbackVerdict: { fontSize: 14, fontWeight: '800', flex: 1 },
  teachingRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start', backgroundColor: '#F59E0B14', borderRadius: RADIUS.sm, padding: SPACING.sm },
  teachingTxt: { color: '#F59E0B', fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },
  correctOrderBox: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm, padding: SPACING.sm, gap: 3 },
  correctOrderLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  correctOrderTxt: { color: COLORS.onSurface, fontSize: 12, lineHeight: 18 },
  postActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: 4 },
  retryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#F59E0B60', borderRadius: RADIUS.md, paddingVertical: 10 },
  retryTxt: { color: '#F59E0B', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  claimBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#16A34A', borderRadius: RADIUS.md, paddingVertical: 10 },
  claimBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },

  resultBanner: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: META.accent + '40', alignItems: 'center', padding: SPACING.lg, gap: 4 },
  resultTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: '800' },
  resultSub: { color: COLORS.onSurfaceSecondary, fontSize: 13 },
  rewardsBox: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm },
  rewardsLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  msCard: { backgroundColor: '#D4AF3712', borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#D4AF3740', padding: SPACING.md, gap: SPACING.xs, alignItems: 'center' },
  msLabel: { color: '#D4AF37', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  msTxt: { color: '#D4AF37', fontSize: 12, fontWeight: '600' },
  actions: { gap: SPACING.sm, marginTop: SPACING.sm },
  againBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: RADIUS.md, borderColor: META.accent + '60', paddingVertical: 12 },
  againTxt: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  backBtn2: { alignItems: 'center', paddingVertical: 10 },
  backTxt2: { color: COLORS.onSurfaceTertiary, fontSize: 13 },
});
