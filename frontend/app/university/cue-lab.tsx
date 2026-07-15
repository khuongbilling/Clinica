import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { goBack } from "@/src/utils/navigation";
import { usePlayer } from "@/src/game/store";
import {
  CueScenario, PracticeDifficulty,
  DIFFICULTY_LABEL, DIFFICULTY_COLOR, ACTIVITY_META,
  PRACTICE_REWARDS, pickRandomScenario, scrollLabel, itemLabel,
  CUE_SCENARIOS,
} from "@/src/game/uniPractice";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const META = ACTIVITY_META.cue_lab;

type Phase = 'pick' | 'play' | 'done';

export default function CueLabScreen() {
  const router = useRouter();
  const { player, completeUniPractice } = usePlayer();

  const [phase, setPhase]         = useState<Phase>('pick');
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>('beginner');
  const [scenario, setScenario]   = useState<CueScenario | null>(null);
  const [selected, setSelected]   = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [claiming, setClaiming]   = useState(false);
  const [claimed, setClaimed]     = useState(false);
  const [result, setResult]       = useState<Awaited<ReturnType<typeof completeUniPractice>> | null>(null);
  const [newMilestones, setNewMilestones] = useState<string[]>([]);

  const rewardDef = PRACTICE_REWARDS.cue_lab[difficulty];

  function startPlay(diff: PracticeDifficulty) {
    const s = pickRandomScenario('cue_lab', diff) as CueScenario | null;
    if (!s) return;
    setDifficulty(diff);
    setScenario(s);
    setSelected(null);
    setSubmitted(false);
    setClaimed(false);
    setResult(null);
    setNewMilestones([]);
    setPhase('play');
  }

  function playAgain() {
    const s = pickRandomScenario('cue_lab', difficulty, scenario?.id) as CueScenario | null;
    if (!s) return;
    setScenario(s);
    setSelected(null);
    setSubmitted(false);
    setClaimed(false);
    setResult(null);
    setNewMilestones([]);
    setPhase('play');
  }

  function handleSubmit() {
    if (!selected) return;
    setSubmitted(true);
  }

  async function handleClaim() {
    if (claiming || claimed) return;
    setClaiming(true);
    try {
      const res = await completeUniPractice('cue_lab', difficulty);
      setResult(res);
      setNewMilestones(res.newMilestones.map((m) => m.label));
      setClaimed(true);
      setPhase('done');
    } finally {
      setClaiming(false);
    }
  }

  if (!player) return null;

  // ── Phase: Pick Difficulty ──────────────────────────────────────────────
  if (phase === 'pick') {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.hero}>
          <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
          <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
          </Pressable>
          <View style={styles.heroInner}>
            <Ionicons name={META.icon as any} size={28} color={META.accent} />
            <Text style={styles.heroKicker}>CLINICA UNIVERSITY</Text>
            <Text style={styles.heroTitle}>{META.label}</Text>
            <Text style={styles.heroSub}>{META.description}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.safetyBox}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.safetyTxt}>
              General wellness education only — not personal clinical advice. {META.battleRecommend}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>CHOOSE DIFFICULTY</Text>

          {(['beginner', 'standard', 'advanced'] as PracticeDifficulty[]).map((diff) => {
            const r = PRACTICE_REWARDS.cue_lab[diff];
            const color = DIFFICULTY_COLOR[diff];
            const scenarios = CUE_SCENARIOS.filter((s) => s.difficulty === diff);
            return (
              <Pressable key={diff} style={[styles.diffCard, { borderColor: color + '40' }]} onPress={() => startPlay(diff)}>
                <View style={[styles.diffBadge, { backgroundColor: color + '18' }]}>
                  <Text style={[styles.diffBadgeTxt, { color }]}>{DIFFICULTY_LABEL[diff].toUpperCase()}</Text>
                </View>
                <Text style={styles.diffDesc}>
                  {diff === 'beginner' ? 'One clear cue — minimal distractors.' :
                   diff === 'standard' ? 'Two related cues with simple distractors.' :
                   'Multiple cues, hidden cues, strong distractors.'}
                </Text>
                <Text style={styles.diffPool}>{scenarios.length} scenarios</Text>
                <View style={styles.rewardRow}>
                  <RewardChip icon="star-outline" color="#F59E0B" label={`+${r.playerXp} XP`} />
                  <RewardChip icon="school-outline" color="#2DD4BF" label={`+${r.universityCredits} UC`} />
                  <RewardChip icon="eye-outline" color={META.accent} label={`${r.scrollCount}× ${scrollLabel(r.scrollKey)}`} />
                  {r.bonusItemKey && <RewardChip icon="gift-outline" color="#A78BFA" label={`+ ${itemLabel(r.bonusItemKey!)}`} />}
                </View>
                <View style={styles.diffStart}>
                  <Text style={[styles.diffStartTxt, { color }]}>START</Text>
                  <Ionicons name="arrow-forward" size={14} color={color} />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Phase: Play ─────────────────────────────────────────────────────────
  if (phase === 'play' && scenario) {
    const correctOpt = scenario.options.find((o) => o.isCorrect);
    const isCorrect = selected === correctOpt?.id;

    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.playHeader}>
          <Pressable style={styles.backBtn} onPress={() => setPhase('pick')} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
          </Pressable>
          <View style={[styles.diffBadge, { backgroundColor: DIFFICULTY_COLOR[difficulty] + '18' }]}>
            <Text style={[styles.diffBadgeTxt, { color: DIFFICULTY_COLOR[difficulty] }]}>
              {DIFFICULTY_LABEL[difficulty].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={[styles.diffBadge, { backgroundColor: META.accent + '18' }]}>
            <Ionicons name={META.icon as any} size={11} color={META.accent} />
            <Text style={[styles.diffBadgeTxt, { color: META.accent }]}>CUE LAB</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.scenarioCard}>
            <Text style={styles.scenarioTitle}>{scenario.title}</Text>
            <Text style={styles.scenarioContext}>{scenario.context}</Text>
          </View>

          <Text style={styles.questionTxt}>{scenario.question}</Text>

          <View style={styles.optionsGrid}>
            {scenario.options.map((opt) => {
              const isSelected = selected === opt.id;
              const isRight = submitted && opt.isCorrect;
              const isWrong = submitted && isSelected && !opt.isCorrect;
              return (
                <Pressable
                  key={opt.id}
                  style={[
                    styles.optionBtn,
                    isSelected && !submitted && styles.optionSelected,
                    isRight && styles.optionCorrect,
                    isWrong && styles.optionWrong,
                  ]}
                  onPress={() => !submitted && setSelected(opt.id)}
                  disabled={submitted}
                >
                  <View style={styles.optionLeft}>
                    <View style={[styles.optionDot, isRight && styles.optionDotCorrect, isWrong && styles.optionDotWrong]}>
                      {isRight && <Ionicons name="checkmark" size={10} color="#fff" />}
                      {isWrong && <Ionicons name="close" size={10} color="#fff" />}
                    </View>
                    <Text style={[styles.optionTxt, (isRight || isWrong) && { fontWeight: '700' }]}>
                      {opt.text}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {!submitted && (
            <Pressable
              style={[styles.submitBtn, !selected && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!selected}
            >
              <Text style={styles.submitBtnTxt}>SUBMIT ANSWER</Text>
            </Pressable>
          )}

          {submitted && (
            <View style={[styles.feedbackBox, { borderColor: isCorrect ? '#34D399' : '#F87171' }]}>
              <View style={styles.feedbackHeader}>
                <Ionicons name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={18}
                  color={isCorrect ? '#34D399' : '#F87171'} />
                <Text style={[styles.feedbackVerdict, { color: isCorrect ? '#34D399' : '#F87171' }]}>
                  {isCorrect ? 'Correct!' : 'Not quite — here\'s why:'}
                </Text>
              </View>
              <Text style={styles.feedbackExplanation}>{scenario.explanation}</Text>
              <View style={styles.keyLearningRow}>
                <Ionicons name="bulb-outline" size={13} color="#F59E0B" />
                <Text style={styles.keyLearningTxt}>{scenario.keyLearning}</Text>
              </View>
              <Pressable style={styles.claimBtn} onPress={handleClaim} disabled={claiming}>
                <Ionicons name="gift-outline" size={14} color="#fff" />
                <Text style={styles.claimBtnTxt}>{claiming ? 'Claiming…' : 'CLAIM REWARDS'}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Phase: Done / Result ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.playHeader}>
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.heroKicker}>SESSION COMPLETE</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.resultCard}>
          <Ionicons name="ribbon" size={36} color={META.accent} style={{ marginBottom: 8 }} />
          <Text style={styles.resultTitle}>Cue Lab Complete!</Text>
          <Text style={styles.resultSub}>
            {DIFFICULTY_LABEL[difficulty]} difficulty · {scenario?.title}
          </Text>
        </View>

        {result && (
          <View style={styles.rewardsCard}>
            <Text style={styles.rewardsLabel}>REWARDS EARNED</Text>
            <View style={styles.rewardRow}>
              <RewardChip icon="star-outline" color="#F59E0B" label={`+${result.reward.playerXp} Player XP`} big />
              <RewardChip icon="person-outline" color="#FB923C" label={`+${result.reward.heroXp} Hero XP`} big />
            </View>
            <View style={styles.rewardRow}>
              <RewardChip icon="school-outline" color="#2DD4BF" label={`+${result.reward.universityCredits} UC`} big />
              <RewardChip icon="eye-outline" color={META.accent} label={`${result.reward.scrollCount}× ${scrollLabel(result.reward.scrollKey)}`} big />
            </View>
            {result.reward.bonusItemKey && (
              <RewardChip icon="gift-outline" color="#A78BFA" label={`${result.reward.bonusItemCount}× ${itemLabel(result.reward.bonusItemKey!)}`} big />
            )}
          </View>
        )}

        {newMilestones.length > 0 && (
          <View style={styles.milestonesCard}>
            <Ionicons name="trophy-outline" size={18} color="#D4AF37" />
            <Text style={styles.milestonesLabel}>MILESTONE UNLOCKED!</Text>
            {newMilestones.map((m) => (
              <Text key={m} style={styles.milestoneTxt}>✓ {m}</Text>
            ))}
          </View>
        )}

        <View style={styles.doneActions}>
          <Pressable style={styles.playAgainBtn} onPress={playAgain}>
            <Ionicons name="refresh" size={16} color={META.accent} />
            <Text style={[styles.playAgainTxt, { color: META.accent }]}>PLAY AGAIN</Text>
          </Pressable>
          <Pressable style={styles.backToUniBtn} onPress={() => goBack(router, "/university")}>
            <Text style={styles.backToUniTxt}>Back to University</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RewardChip({ icon, color, label, big }: { icon: string; color: string; label: string; big?: boolean }) {
  return (
    <View style={[styles.chip, big && styles.chipBig]}>
      <Ionicons name={icon as any} size={big ? 12 : 9} color={color} />
      <Text style={[styles.chipTxt, { color }, big && styles.chipTxtBig]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: 6, overflow: 'hidden' },
  heroInner: { alignItems: 'center', gap: 4 },
  heroKicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  heroTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  heroSub: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, paddingTop: SPACING.lg,
  },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 60 },
  safetyBox: {
    flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start',
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm, padding: SPACING.sm,
  },
  safetyTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, flex: 1, lineHeight: 16 },
  sectionLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 2, fontWeight: '700', marginTop: SPACING.xs },

  // Difficulty cards
  diffCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, padding: SPACING.md, gap: SPACING.sm,
  },
  diffBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  diffBadgeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  diffDesc: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },
  diffPool: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  diffStart: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 4 },
  diffStartTxt: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },

  // Rewards row
  rewardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  chipBig: { paddingHorizontal: 8, paddingVertical: 4 },
  chipTxt: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  chipTxtBig: { fontSize: 11 },

  // Scenario / play
  scenarioCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm,
  },
  scenarioTitle: { color: COLORS.brand, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  scenarioContext: { color: COLORS.onSurface, fontSize: 14, lineHeight: 21 },
  questionTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  optionsGrid: { gap: SPACING.sm },
  optionBtn: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },
  optionSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandTertiary },
  optionCorrect: { borderColor: '#34D399', backgroundColor: '#34D39912' },
  optionWrong:   { borderColor: '#F87171', backgroundColor: '#F8717112' },
  optionLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  optionDot: {
    width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.border, marginTop: 1,
  },
  optionDotCorrect: { backgroundColor: '#34D399', borderColor: '#34D399' },
  optionDotWrong:   { backgroundColor: '#F87171', borderColor: '#F87171' },
  optionTxt: { color: COLORS.onSurface, fontSize: 13, lineHeight: 19, flex: 1 },
  submitBtn: {
    backgroundColor: COLORS.brand, borderRadius: RADIUS.md,
    paddingVertical: 12, alignItems: 'center', marginTop: SPACING.sm,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnTxt: { color: '#071018', fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },

  // Feedback
  feedbackBox: {
    borderRadius: RADIUS.md, borderWidth: 1,
    backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  feedbackHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  feedbackVerdict: { fontSize: 15, fontWeight: '800' },
  feedbackExplanation: { color: COLORS.onSurface, fontSize: 13, lineHeight: 20 },
  keyLearningRow: {
    flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start',
    backgroundColor: '#F59E0B14', borderRadius: RADIUS.sm, padding: SPACING.sm,
  },
  keyLearningTxt: { color: '#F59E0B', fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },
  claimBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#16A34A', borderRadius: RADIUS.md, paddingVertical: 12, marginTop: 4,
  },
  claimBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },

  // Result
  resultCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.brand + '40',
    alignItems: 'center', padding: SPACING.lg, gap: 4,
  },
  resultTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: '800' },
  resultSub: { color: COLORS.onSurfaceSecondary, fontSize: 13 },
  rewardsCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm,
  },
  rewardsLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  milestonesCard: {
    backgroundColor: '#D4AF3712', borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: '#D4AF3740',
    padding: SPACING.md, gap: SPACING.xs, alignItems: 'center',
  },
  milestonesLabel: { color: '#D4AF37', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  milestoneTxt: { color: '#D4AF37', fontSize: 12, fontWeight: '600' },
  doneActions: { gap: SPACING.sm, marginTop: SPACING.sm },
  playAgainBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderRadius: RADIUS.md, borderColor: COLORS.brand + '60',
    paddingVertical: 12,
  },
  playAgainTxt: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  backToUniBtn: { alignItems: 'center', paddingVertical: 10 },
  backToUniTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13 },
});
