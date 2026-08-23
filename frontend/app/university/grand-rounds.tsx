import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import type { GrandRoundsAttempt, GrandRoundsCaseCard, GrandRoundsDebrief, GrandRoundsGate } from '@/src/game/grandRounds';
import { ROUTES } from '@/src/game/routes';
import { usePlayer } from '@/src/game/store';
import { ActivityEntryGate } from '@/src/components/FeatureGate';
import { COLORS, RADIUS, SPACING } from '@/src/theme/colors';

const cleanError = (error: unknown) => error instanceof Error ? error.message.replace(/^API \d+: /, '') : 'Grand Rounds is unavailable right now.';
const titleCase = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function Vital({ label, value }: { label: string; value: number }) {
  const color = value < 45 ? '#F87171' : value < 65 ? '#FBBF24' : '#34D399';
  const urgency = value < 45 ? 'critical' : value < 65 ? 'needs attention' : 'stable';
  return <View style={styles.vital} accessibilityLabel={`${label}: ${value} of 100, ${urgency}`}>
    <View style={styles.vitalLine}><Text style={styles.vitalLabel}>{label}</Text><Text style={[styles.vitalValue, { color }]}>{value}</Text></View>
    <View style={styles.bar}><View style={[styles.barFill, { width: `${value}%`, backgroundColor: color }]} /></View>
  </View>;
}

export default function GrandRoundsScreen() {
  return <ActivityEntryGate activityId="grand-rounds" title="Grand Rounds" fallback={ROUTES.UNIVERSITY}><GrandRoundsContent /></ActivityEntryGate>;
}

function GrandRoundsContent() {
  const router = useRouter();
  const {
    player, startGrandRounds, resumeGrandRounds, submitGrandRoundsResponse, pauseGrandRounds,
    abandonGrandRounds, saveGrandRoundsNotes, completeGrandRounds,
  } = usePlayer();
  const [cases, setCases] = useState<GrandRoundsCaseCard[]>([]);
  const [gate, setGate] = useState<GrandRoundsGate | null>(null);
  const [attempt, setAttempt] = useState<GrandRoundsAttempt | null>(null);
  const [debrief, setDebrief] = useState<GrandRoundsDebrief | null>(null);
  const [lastCase, setLastCase] = useState<GrandRoundsCaseCard | null>(null);
  const [notes, setNotes] = useState('');
  const [showTimeline, setShowTimeline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    if (!player) return;
    setBusy(true);
    try {
      const result = await api.getGrandRounds(player.id, player.economy_token);
      setCases(result.cases); setGate(result.gate);
      if (player.grand_rounds_active_attempt_id) {
        // Reading an attempt must never implicitly resume it. A paused case
        // stays paused until the player deliberately presses Resume.
        const { attempt: saved } = await api.getGrandRoundsAttempt(player.id, player.grand_rounds_active_attempt_id, player.economy_token);
        setAttempt(saved); setNotes(saved.notes);
        if (saved.status === 'completed') {
          const complete = await completeGrandRounds(saved.attemptId);
          setDebrief(complete.debrief);
        }
      }
    } catch (error) { setMessage(cleanError(error)); }
    finally { setBusy(false); }
  }, [completeGrandRounds, player, resumeGrandRounds]);

  useFocusEffect(useCallback(() => { loadBoard(); }, [loadBoard]));

  // Grand Rounds has no race timer. Pausing on background is a safety guard so
  // an app switch cannot leave an authoritative case accepting further input.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && attempt?.status === 'active') {
        pauseGrandRounds(attempt.attemptId).then(setAttempt).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [attempt, pauseGrandRounds]);

  const start = async (card: GrandRoundsCaseCard, mode: 'fresh_case' | 'same_case' | 'guided' = 'fresh_case') => {
    setBusy(true); setMessage(null);
    try {
      const next = await startGrandRounds(card.id, card.version, mode, mode === 'same_case' ? attempt?.attemptId : undefined);
      setAttempt(next); setDebrief(null); setNotes(next.notes); setLastCase(card);
    } catch (error) { setMessage(cleanError(error)); }
    finally { setBusy(false); }
  };
  const answer = async (responseId: string) => {
    if (!attempt) return;
    setBusy(true); setMessage(null);
    try {
      const next = await submitGrandRoundsResponse(attempt.attemptId, responseId);
      setAttempt(next);
      if (next.status === 'completed') setMessage('All stations are complete. Open your faculty debrief when you are ready.');
    } catch (error) { setMessage(cleanError(error)); }
    finally { setBusy(false); }
  };
  const saveNotes = async () => {
    if (!attempt) return;
    try { const next = await saveGrandRoundsNotes(attempt.attemptId, notes); setAttempt(next); setMessage('Personal notes saved to this case.'); }
    catch (error) { setMessage(cleanError(error)); }
  };
  const finish = async () => {
    if (!attempt) return;
    setBusy(true);
    try { const result = await completeGrandRounds(attempt.attemptId); setDebrief(result.debrief); setAttempt(null); await loadBoard(); }
    catch (error) { setMessage(cleanError(error)); }
    finally { setBusy(false); }
  };

  if (!player) return <SafeAreaView style={styles.center}><ActivityIndicator color={COLORS.brand} /></SafeAreaView>;
  if (debrief) return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} accessibilityLiveRegion="polite">
    <Pressable accessibilityRole="button" onPress={() => { setDebrief(null); loadBoard(); }} style={styles.back}><Ionicons name="arrow-back" size={18} color={COLORS.onSurface} /><Text style={styles.backText}>CASE BOARD</Text></Pressable>
    <Text style={styles.eyebrow}>FACULTY DEBRIEF</Text><Text style={styles.h1}>{titleCase(debrief.outcome)} result</Text>
    <View style={styles.scoreCard}><Text style={styles.score}>{debrief.score}<Text style={styles.scoreSmall}> / 100</Text></Text><Text style={styles.scoreLabel}>Performance score · {titleCase(debrief.safety)}</Text><Text style={styles.patientOutcome}>Patient outcome: {titleCase(debrief.patientOutcome)}</Text></View>
    <Text style={styles.section}>DOMAIN REVIEW</Text>
    {Object.entries(debrief.domainBreakdown).map(([domain, score]) => <Vital key={domain} label={titleCase(domain)} value={score} />)}
    <View style={styles.panel}><Text style={styles.panelTitle}>Causality</Text><Text style={styles.copy}><Text style={styles.bold}>Strongest decision: </Text>{debrief.strongestDecision}</Text><Text style={styles.copy}><Text style={styles.bold}>Missed opportunity: </Text>{debrief.missedOpportunity}</Text><Text style={styles.copy}><Text style={styles.bold}>Patient-state evolution: </Text>{debrief.patientEvolution}</Text><Text style={styles.copy}><Text style={styles.bold}>Clinical principle: </Text>{debrief.clinicalPrinciple}</Text></View>
    <View style={styles.panel}><Text style={styles.panelTitle}>Learning loop</Text><Text style={styles.copy}>Related University practice: {debrief.relatedPractice.join(' · ')}</Text><Text style={styles.copy}>{debrief.reward.message} {debrief.reward.xp > 0 ? `+${debrief.reward.xp} XP · +${debrief.reward.universityCredits} credits · +${debrief.reward.mastery} mastery` : ''}</Text></View>
    {lastCase && <Pressable style={styles.primary} onPress={() => start(lastCase, 'fresh_case')}><Text style={styles.primaryText}>TRY A FRESH CASE VARIANT</Text></Pressable>}
    {lastCase && <Pressable style={styles.secondary} onPress={() => start(lastCase, 'guided')}><Text style={styles.secondaryText}>REVIEW THIS CASE · NO REWARD</Text></Pressable>}
    <Pressable style={styles.secondary} onPress={() => { setDebrief(null); loadBoard(); }}><Text style={styles.secondaryText}>RETURN TO CASE BOARD</Text></Pressable>
    <Pressable style={styles.secondary} onPress={() => router.push(ROUTES.UNI_PRACTICE)}><Text style={styles.secondaryText}>OPEN RELATED PRACTICE</Text></Pressable>
  </ScrollView></SafeAreaView>;

  if (attempt) return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.topline}><Pressable accessibilityRole="button" onPress={() => pauseGrandRounds(attempt.attemptId).then((next) => { setAttempt(next); router.back(); })} style={styles.iconBtn}><Ionicons name="pause-outline" size={20} color={COLORS.onSurface} /><Text style={styles.iconText}>PAUSE</Text></Pressable><Text style={styles.eyebrow}>{attempt.status === 'paused' ? 'CASE PAUSED' : 'GRAND ROUNDS'}</Text></View>
    <Text style={styles.h1}>{cases.find((item) => item.id === attempt.caseId)?.title ?? 'Faculty case'}</Text>
    <Text style={styles.concern} accessibilityLiveRegion="polite">Patient concern: {attempt.patient.concern} · {attempt.patient.acuity.toUpperCase()} acuity</Text>
    <View style={styles.vitals}><Vital label="Stability" value={attempt.patient.stability} /><Vital label="Oxygenation" value={attempt.patient.oxygenation} /><Vital label="Perfusion" value={attempt.patient.perfusion} /></View>
    <View style={styles.panel}><Text style={styles.panelTitle}>Known patient data</Text>{attempt.known.length ? attempt.known.map((item) => <Text key={item.id} style={styles.copy}>{item.label}: {item.value}</Text>) : <Text style={styles.copy}>No additional focused findings are known yet. Choose an assessment to reveal what is clinically observable.</Text>}</View>
    <Pressable style={styles.timelineToggle} onPress={() => setShowTimeline((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: showTimeline }}><Text style={styles.timelineText}>AUTHORITATIVE TIMELINE ({attempt.timeline.length})</Text><Ionicons name={showTimeline ? 'chevron-up' : 'chevron-down'} size={15} color={COLORS.onSurfaceSecondary} /></Pressable>
    {showTimeline && <View style={styles.panel}>{attempt.timeline.map((entry, index) => <Text style={styles.copy} key={`${entry.stageId}-${index}`}>{index + 1}. {entry.announcement} · {entry.stateDelta}</Text>)}</View>}
    <View style={styles.panel}><Text style={styles.panelTitle}>Personal notes</Text><TextInput value={notes} onChangeText={setNotes} onBlur={saveNotes} placeholder="Optional private clinical reasoning notes…" placeholderTextColor={COLORS.onSurfaceTertiary} multiline accessibilityLabel="Personal case notes" style={styles.notes} /><Pressable onPress={saveNotes} style={styles.noteSave}><Text style={styles.noteSaveText}>SAVE NOTES</Text></Pressable></View>
    {attempt.status === 'paused' ? <Pressable style={styles.primary} onPress={() => resumeGrandRounds(attempt.attemptId).then(setAttempt)}><Text style={styles.primaryText}>RESUME WHEN READY</Text></Pressable> : attempt.stage ? <>
      <Text style={styles.eyebrow}>{attempt.complicationActive ? 'COMPLICATION · MANUAL CONTINUATION' : `${titleCase(attempt.stage.inputKind)} STATION · MANUAL CONTINUATION`}</Text>
      <Text style={styles.stationTitle}>{attempt.stage.label}</Text><Text style={styles.prompt}>{attempt.stage.prompt}</Text>
      {attempt.stage.options.map((option) => <Pressable key={option.id} disabled={busy} onPress={() => answer(option.id)} accessibilityRole="button" style={[styles.option, busy && styles.disabled]}><Text style={styles.optionTitle}>{option.label}</Text><Text style={styles.optionCopy}>{option.rationale}</Text></Pressable>)}
    </> : <Pressable style={styles.primary} disabled={busy} onPress={finish}><Text style={styles.primaryText}>OPEN FACULTY DEBRIEF</Text></Pressable>}
    <Pressable style={styles.danger} onPress={() => abandonGrandRounds(attempt.attemptId).then(() => { setAttempt(null); loadBoard(); })}><Text style={styles.dangerText}>ABANDON THIS CASE</Text></Pressable>
  </ScrollView></SafeAreaView>;

  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={COLORS.onSurface} /><Text style={styles.backText}>UNIVERSITY</Text></Pressable>
    <Text style={styles.eyebrow}>FORMAL FACULTY CASES</Text><Text style={styles.h1}>Grand Rounds</Text><Text style={styles.lede}>A zero-Stamina, 15–30 minute integrated case. Patient state, legal responses, score, safety, and rewards are reviewed on the faculty record.</Text>
    {message && <View style={styles.notice} accessibilityLiveRegion="polite"><Text style={styles.noticeText}>{message}</Text></View>}
    {!gate?.eligible && <View style={styles.locked}><Ionicons name="lock-closed-outline" size={22} color="#FBBF24" /><Text style={styles.panelTitle}>Preparation required</Text><Text style={styles.copy}>{gate?.reason ?? 'Loading prerequisites…'}</Text></View>}
    {busy && !cases.length ? <ActivityIndicator color={COLORS.brand} /> : <>{cases.map((card) => <View key={card.id} style={[styles.caseCard, !card.available && styles.caseLocked]} accessibilityLabel={`${card.title}, ${card.difficulty}, ${card.available ? 'available' : `locked: ${card.lockedReason}`}`}>
      <View style={styles.caseHead}><View style={{ flex: 1 }}><Text style={styles.caseKicker}>{card.reviewed ? 'REVIEWED AGE 1 CASE' : 'CASE'} · {titleCase(card.difficulty)} · {card.estimatedMinutes} MIN</Text><Text style={styles.caseTitle}>{card.title}</Text></View><Ionicons name={card.available ? 'document-text-outline' : 'lock-closed-outline'} size={22} color={card.available ? '#C4B5FD' : COLORS.onSurfaceTertiary} /></View>
      <Text style={styles.caseSub}>{card.subtitle}</Text><Text style={styles.caseMeta}>{titleCase(card.domain)} {card.personalBest !== null && card.personalBest !== undefined ? `· Personal best ${card.personalBest}` : ''}{card.completedCount ? ` · ${card.completedCount} completed` : ''}</Text>
      {card.available ? <Pressable style={styles.caseBtn} onPress={() => start(card, card.completedCount ? 'guided' : 'fresh_case')} disabled={busy}><Text style={styles.caseBtnText}>{card.completedCount ? 'REVIEW CASE · NO REWARD' : 'BEGIN REVIEWED CASE'}</Text></Pressable> : <Text style={styles.lockReason}>{card.lockedReason}</Text>}
    </View>)}</>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.surface }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface },
  content: { padding: SPACING.lg, paddingBottom: 56, gap: SPACING.md }, back: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 6 }, backText: { color: COLORS.onSurfaceSecondary, fontWeight: '800', fontSize: 12 },
  eyebrow: { color: '#C4B5FD', fontWeight: '900', fontSize: 11, letterSpacing: 1.2 }, h1: { color: COLORS.onSurface, fontSize: 29, lineHeight: 35, fontWeight: '900' }, lede: { color: COLORS.onSurfaceSecondary, fontSize: 15, lineHeight: 22 }, concern: { color: '#FBBF24', fontSize: 13, fontWeight: '800' },
  caseCard: { backgroundColor: '#171428', borderRadius: RADIUS.lg, padding: SPACING.lg, gap: 9, borderWidth: 1, borderColor: '#A78BFA44' }, caseLocked: { opacity: 0.72, borderColor: '#ffffff16' }, caseHead: { flexDirection: 'row', gap: 10 }, caseKicker: { color: '#C4B5FD', fontSize: 10, fontWeight: '900', letterSpacing: .7 }, caseTitle: { color: COLORS.onSurface, fontSize: 19, fontWeight: '900', marginTop: 3 }, caseSub: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 }, caseMeta: { color: '#8E8AA4', fontSize: 12, fontWeight: '700' },
  caseBtn: { backgroundColor: '#6D4EDB', borderRadius: RADIUS.md, alignItems: 'center', paddingVertical: 12, marginTop: 3 }, caseBtnText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: .4 }, lockReason: { color: '#FBBF24', fontSize: 12, lineHeight: 17 },
  locked: { backgroundColor: '#3B2C0A', borderWidth: 1, borderColor: '#FBBF2455', borderRadius: RADIUS.lg, padding: SPACING.lg, gap: 7 }, notice: { backgroundColor: '#23344C', borderRadius: RADIUS.md, padding: 12 }, noticeText: { color: '#D6E9FF', fontSize: 13, lineHeight: 18 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, iconBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5 }, iconText: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: '900' },
  vitals: { backgroundColor: '#11101E', borderRadius: RADIUS.lg, padding: SPACING.md, gap: 11 }, vital: { gap: 4 }, vitalLine: { flexDirection: 'row', justifyContent: 'space-between' }, vitalLabel: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: '700' }, vitalValue: { fontSize: 13, fontWeight: '900' }, bar: { height: 6, backgroundColor: '#ffffff16', borderRadius: 5, overflow: 'hidden' }, barFill: { height: '100%', borderRadius: 5 },
  panel: { backgroundColor: '#171428', borderRadius: RADIUS.lg, padding: SPACING.md, gap: 7 }, panelTitle: { color: COLORS.onSurface, fontWeight: '900', fontSize: 14 }, copy: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 }, bold: { color: COLORS.onSurface, fontWeight: '800' },
  timelineToggle: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3, alignItems: 'center' }, timelineText: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: '900', letterSpacing: .5 }, notes: { minHeight: 72, color: COLORS.onSurface, borderWidth: 1, borderColor: '#ffffff22', borderRadius: RADIUS.md, padding: 10, textAlignVertical: 'top' }, noteSave: { alignSelf: 'flex-start' }, noteSaveText: { color: '#C4B5FD', fontSize: 11, fontWeight: '900' },
  stationTitle: { color: COLORS.onSurface, fontSize: 21, fontWeight: '900' }, prompt: { color: COLORS.onSurfaceSecondary, fontSize: 15, lineHeight: 22 }, option: { borderWidth: 1, borderColor: '#ffffff22', borderRadius: RADIUS.lg, padding: SPACING.md, gap: 5, backgroundColor: '#1C1930' }, disabled: { opacity: .55 }, optionTitle: { color: COLORS.onSurface, fontWeight: '800', fontSize: 15 }, optionCopy: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },
  primary: { backgroundColor: '#6D4EDB', borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' }, primaryText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: .5 }, secondary: { borderWidth: 1, borderColor: '#ffffff26', borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center' }, secondaryText: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: '900' }, danger: { alignItems: 'center', padding: 12 }, dangerText: { color: '#F87171', fontSize: 11, fontWeight: '900' },
  scoreCard: { backgroundColor: '#281D4E', borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: 'center', gap: 3 }, score: { color: '#E5D8FF', fontSize: 46, fontWeight: '900' }, scoreSmall: { color: '#C4B5FD', fontSize: 17 }, scoreLabel: { color: '#C4B5FD', fontSize: 12, fontWeight: '700' }, patientOutcome: { color: COLORS.onSurface, fontSize: 14, fontWeight: '800' }, section: { color: COLORS.onSurfaceSecondary, fontSize: 11, letterSpacing: 1, fontWeight: '900', marginTop: 4 },
});