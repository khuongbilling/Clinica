import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { goBack } from "@/src/utils/navigation";
import { usePlayer } from "@/src/game/store";
import {
  TriageScenario, PracticeDifficulty,
  DIFFICULTY_LABEL, DIFFICULTY_COLOR, ACTIVITY_META,
  PRACTICE_REWARDS, pickRandomScenario, scrollLabel, itemLabel,
  TRIAGE_SCENARIOS,
} from "@/src/game/uniPractice";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const META = ACTIVITY_META.triage;
type Phase = 'pick' | 'play' | 'done';

export default function TriageHallScreen() {
  const router = useRouter();
  const { player, completeUniPractice } = usePlayer();

  const [phase, setPhase]           = useState<Phase>('pick');
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>('beginner');
  const [scenario, setScenario]     = useState<TriageScenario | null>(null);
  const [selected, setSelected]     = useState<string | null>(null);
  const [submitted, setSubmitted]   = useState(false);
  const [claiming, setClaiming]     = useState(false);
  const [result, setResult]         = useState<Awaited<ReturnType<typeof completeUniPractice>> | null>(null);
  const [newMilestones, setNewMilestones] = useState<string[]>([]);

  function startPlay(diff: PracticeDifficulty) {
    const s = pickRandomScenario('triage', diff) as TriageScenario | null;
    if (!s) return;
    setDifficulty(diff);
    setScenario(s);
    setSelected(null);
    setSubmitted(false);
    setResult(null);
    setNewMilestones([]);
    setPhase('play');
  }

  function playAgain() {
    const s = pickRandomScenario('triage', difficulty, scenario?.id) as TriageScenario | null;
    if (!s) return;
    setScenario(s);
    setSelected(null);
    setSubmitted(false);
    setResult(null);
    setNewMilestones([]);
    setPhase('play');
  }

  async function handleClaim() {
    if (claiming || result) return;
    setClaiming(true);
    try {
      const res = await completeUniPractice('triage', difficulty);
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
            const r = PRACTICE_REWARDS.triage[diff];
            const color = DIFFICULTY_COLOR[diff];
            const count = TRIAGE_SCENARIOS.filter((s) => s.difficulty === diff).length;
            return (
              <Pressable key={diff} style={[styles.diffCard, { borderColor: color + '40' }]} onPress={() => startPlay(diff)}>
                <View style={[styles.badge, { backgroundColor: color + '18' }]}>
                  <Text style={[styles.badgeTxt, { color }]}>{DIFFICULTY_LABEL[diff].toUpperCase()}</Text>
                </View>
                <Text style={styles.diffDesc}>
                  {diff === 'beginner' ? 'Choose 1 of 2 obvious priorities.' :
                   diff === 'standard' ? 'Choose 1 of 3 patients.' :
                   'Changing status with subtle cues.'}
                </Text>
                <Text style={styles.poolTxt}>{count} scenarios</Text>
                <View style={styles.chips}>
                  <Chip icon="star-outline" color="#F59E0B" label={`+${r.playerXp} XP`} />
                  <Chip icon="school-outline" color="#2DD4BF" label={`+${r.universityCredits} UC`} />
                  <Chip icon="flash-outline" color={META.accent} label={`${r.scrollCount}× ${scrollLabel(r.scrollKey)}`} />
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
    const isCorrect = selected === scenario.correctPatientId;
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => setPhase('pick')} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
          </Pressable>
          <View style={[styles.badge, { backgroundColor: DIFFICULTY_COLOR[difficulty] + '18' }]}>
            <Text style={[styles.badgeTxt, { color: DIFFICULTY_COLOR[difficulty] }]}>
              {DIFFICULTY_LABEL[difficulty].toUpperCase()}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.scenarioCard}>
            <Text style={styles.scenarioTitle}>{scenario.title}</Text>
            <Text style={styles.scenarioInstruction}>{scenario.instruction}</Text>
          </View>

          <View style={styles.patientList}>
            {scenario.patients.map((p) => {
              const isSelected = selected === p.id;
              const isRight    = submitted && p.id === scenario.correctPatientId;
              const isWrong    = submitted && isSelected && !isRight;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.patientCard,
                    isSelected && !submitted && styles.patientSelected,
                    isRight  && styles.patientCorrect,
                    isWrong  && styles.patientWrong,
                  ]}
                  onPress={() => !submitted && setSelected(p.id)}
                  disabled={submitted}
                >
                  <View style={styles.patientTop}>
                    <View style={[styles.patientIndicator,
                      isRight && { backgroundColor: '#34D399' },
                      isWrong && { backgroundColor: '#F87171' },
                    ]}>
                      {isRight && <Ionicons name="checkmark" size={11} color="#fff" />}
                      {isWrong && <Ionicons name="close" size={11} color="#fff" />}
                      {!isRight && !isWrong && <Ionicons name="person-outline" size={11} color={isSelected ? COLORS.brand : COLORS.onSurfaceTertiary} />}
                    </View>
                    <Text style={[styles.patientName, isSelected && { color: COLORS.brand }]}>{p.name}</Text>
                    {isRight && <View style={styles.urgentBadge}><Text style={styles.urgentBadgeTxt}>PRIORITY</Text></View>}
                  </View>
                  <Text style={styles.patientSituation}>{p.situation}</Text>
                </Pressable>
              );
            })}
          </View>

          {!submitted && (
            <Pressable
              style={[styles.submitBtn, !selected && styles.submitDisabled]}
              onPress={() => setSubmitted(true)}
              disabled={!selected}
            >
              <Text style={styles.submitTxt}>CONFIRM PRIORITY</Text>
            </Pressable>
          )}

          {submitted && (
            <View style={[styles.feedbackBox, { borderColor: isCorrect ? '#34D399' : '#F87171' }]}>
              <View style={styles.feedbackTop}>
                <Ionicons name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={18}
                  color={isCorrect ? '#34D399' : '#F87171'} />
                <Text style={[styles.feedbackVerdict, { color: isCorrect ? '#34D399' : '#F87171' }]}>
                  {isCorrect ? 'Correct priority!' : 'Not quite — here\'s the reasoning:'}
                </Text>
              </View>
              <Text style={styles.feedbackExplanation}>{scenario.explanation}</Text>
              <View style={styles.keyRow}>
                <Ionicons name="bulb-outline" size={13} color="#F59E0B" />
                <Text style={styles.keyTxt}>{scenario.keyLearning}</Text>
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

  // ── Done ──────────────────────────────────────────────────────────────────
  const rewardDef = PRACTICE_REWARDS.triage[difficulty];
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
          <Text style={styles.resultTitle}>Triage Drill Complete!</Text>
          <Text style={styles.resultSub}>{DIFFICULTY_LABEL[difficulty]} · {scenario?.title}</Text>
        </View>

        {result && (
          <View style={styles.rewardsBox}>
            <Text style={styles.rewardsLabel}>REWARDS EARNED</Text>
            <View style={styles.chips}>
              <Chip icon="star-outline"   color="#F59E0B" label={`+${result.reward.playerXp} XP`} big />
              <Chip icon="person-outline" color="#FB923C" label={`+${result.reward.heroXp} Hero XP`} big />
              <Chip icon="school-outline" color="#2DD4BF" label={`+${result.reward.universityCredits} UC`} big />
              <Chip icon="flash-outline"  color={META.accent} label={`${result.reward.scrollCount}× ${scrollLabel(result.reward.scrollKey)}`} big />
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
  scenarioInstruction: { color: COLORS.onSurface, fontSize: 14, lineHeight: 21 },

  patientList: { gap: SPACING.sm },
  patientCard: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.xs },
  patientSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandTertiary },
  patientCorrect:  { borderColor: '#34D399', backgroundColor: '#34D39912' },
  patientWrong:    { borderColor: '#F87171', backgroundColor: '#F8717112' },
  patientTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  patientIndicator: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  patientName: { color: COLORS.onSurface, fontSize: 13, fontWeight: '700', flex: 1 },
  urgentBadge: { backgroundColor: '#34D39920', borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 2 },
  urgentBadgeTxt: { color: '#34D399', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  patientSituation: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18, paddingLeft: 30 },

  submitBtn: { backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', marginTop: SPACING.sm },
  submitDisabled: { opacity: 0.4 },
  submitTxt: { color: '#071018', fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },

  feedbackBox: { borderRadius: RADIUS.md, borderWidth: 1, backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, gap: SPACING.sm, marginTop: SPACING.sm },
  feedbackTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  feedbackVerdict: { fontSize: 15, fontWeight: '800' },
  feedbackExplanation: { color: COLORS.onSurface, fontSize: 13, lineHeight: 20 },
  keyRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start', backgroundColor: '#F59E0B14', borderRadius: RADIUS.sm, padding: SPACING.sm },
  keyTxt: { color: '#F59E0B', fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },
  claimBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#16A34A', borderRadius: RADIUS.md, paddingVertical: 12, marginTop: 4 },
  claimBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },

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
