import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CLINICAL_SIMULATIONS, getClinicalSimulation,
  CLINICAL_SIMULATION_ADVANCED_LEVEL_GATE, SimulationActionGroup, SimulationAttemptState, SimulationConfig, SimulationDebrief,
  SimulationManifest,
} from '@/src/game/clinicalSimulation';
import { LegacySimulationDetail } from '@/src/components/university/LegacySimulationDetail';
import { resolveSimulationRoute } from '@/src/game/simulationRoute';
import { usePlayer } from '@/src/game/store';
import { ROUTES } from '@/src/game/routes';
import { COLORS, RADIUS, SPACING } from '@/src/theme/colors';

type ScreenState = 'locked' | 'intro' | 'configuration' | 'handoff' | 'active' | 'response' | 'complication' | 'completion' | 'debrief';

const GROUPS: { id: SimulationActionGroup; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }[] = [
  { id: 'assess', label: 'Assess', icon: 'eye-outline', color: '#7DD3FC' },
  { id: 'support', label: 'Support', icon: 'heart-outline', color: '#34D399' },
  { id: 'treat', label: 'Treat', icon: 'medkit-outline', color: '#F59E0B' },
  { id: 'escalate', label: 'Escalate', icon: 'alert-circle-outline', color: '#F472B6' },
  { id: 'reassess', label: 'Reassess', icon: 'refresh-outline', color: '#A78BFA' },
];

const difficultyLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function Vital({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.vital} accessibilityLabel={`${label}: ${value} out of 100`}>
      <View style={styles.vitalRow}><Text style={styles.vitalLabel}>{label}</Text><Text style={[styles.vitalValue, { color }]}>{value}</Text></View>
      <View style={styles.vitalTrack}><View style={[styles.vitalFill, { width: `${value}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

export default function SimulationRouteScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const routeKind = resolveSimulationRoute(String(params.id));
  if (routeKind === 'legacy') return <LegacySimulationDetail simulationId={String(params.id)} />;
  if (routeKind === 'clinical') return <ClinicalSimulationLabScreen />;
  return <MissingSimulationScreen />;
}

function MissingSimulationScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={28} color={COLORS.onSurfaceSecondary} />
        <Text style={styles.muted}>This simulation is unavailable.</Text>
        <Pressable style={styles.secondary} onPress={() => router.replace(ROUTES.UNI_PRACTICE)}><Text style={styles.secondaryTxt}>RETURN TO UNIVERSITY</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

function ClinicalSimulationLabScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const {
    player, startClinicalSimulation, resumeClinicalSimulation,
    submitClinicalSimulationAction, completeClinicalSimulation,
  } = usePlayer();
  const initialManifest = getClinicalSimulation(String(params.id))!;
  const [manifest, setManifest] = useState<SimulationManifest>(initialManifest);
  const [screen, setScreen] = useState<ScreenState>('intro');
  const [attempt, setAttempt] = useState<SimulationAttemptState | null>(null);
  const [debrief, setDebrief] = useState<SimulationDebrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [config, setConfig] = useState<SimulationConfig>({
    difficulty: initialManifest.difficulty, style: initialManifest.style,
    complicationId: initialManifest.complications[0]?.id, assistance: 'coach',
  });

  const packageOneComplete = (player?.uni_cue_lab_count ?? 0) >= 1 &&
    (player?.uni_triage_count ?? 0) >= 1 && (player?.uni_stack_count ?? 0) >= 1 &&
    (player?.lessons_completed?.length ?? 0) >= 1;
  const advancedLocked = (player?.player_level ?? 1) < CLINICAL_SIMULATION_ADVANCED_LEVEL_GATE;

  useEffect(() => {
    if (!player) return;
    if (!packageOneComplete) {
      setScreen('locked');
      return;
    }
    const activeId = player.clinical_simulation_active_attempt_id;
    if (!activeId) return;
    setWorking(true);
    resumeClinicalSimulation(activeId)
      .then(async (restored) => {
        const restoredManifest = getClinicalSimulation(restored.simulationId);
        if (restoredManifest) {
          setManifest(restoredManifest);
          setConfig(restored.config);
          setAttempt(restored);
          if (restored.status === 'active') {
            setScreen('active');
          } else {
            // A network interruption may occur after the last action has
            // been persisted but before the receipt/debrief returns. Re-run
            // the idempotent server completion endpoint to recover it.
            const recovered = await completeClinicalSimulation(restored.attemptId);
            setDebrief(recovered.debrief);
            setScreen('debrief');
          }
        }
      })
      .catch(() => {
        setScreen('intro');
        setError('Your saved simulation could not be reopened. You can start a fresh reviewed scenario.');
      })
      .finally(() => setWorking(false));
  // Resume only when an attempt identity changes, not whenever the live Player
  // object refreshes after a daily objective pulse.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id, player?.clinical_simulation_active_attempt_id, completeClinicalSimulation, resumeClinicalSimulation]);

  const eligibleActions = useMemo(() => attempt
    ? manifest.actions.filter((action) => action.beats.includes(attempt.beat) && !attempt.actionIds.includes(action.id))
    : [], [attempt, manifest]);

  const selectManifest = (next: SimulationManifest) => {
    setManifest(next);
    setConfig({
      difficulty: next.difficulty, style: next.style,
      complicationId: next.complications[0]?.id, assistance: 'coach',
    });
    setError(null);
  };

  const start = useCallback(async (retryMode: 'same_branch' | 'new_variation' | 'similar_case' | 'guided' = 'new_variation') => {
    setWorking(true); setError(null);
    try {
      const next = await startClinicalSimulation(manifest.id, {
        ...config, assistance: retryMode === 'guided' ? 'guided' : config.assistance,
      }, retryMode, retryMode === 'same_branch' ? attempt?.attemptId : undefined);
      setAttempt(next); setDebrief(null); setShowTimeline(false); setScreen('handoff');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replace(/^API \d+: /, '') : 'Simulation Lab is unavailable right now.');
    } finally {
      setWorking(false);
    }
  }, [attempt?.attemptId, config, manifest.id, startClinicalSimulation]);

  const chooseAction = useCallback(async (actionId: string) => {
    if (!attempt || working) return;
    setWorking(true); setError(null);
    try {
      const next = await submitClinicalSimulationAction(attempt.attemptId, actionId);
      setAttempt(next);
      if (next.status === 'completed') {
        setScreen('completion');
        const result = await completeClinicalSimulation(next.attemptId);
        setDebrief(result.debrief);
      } else {
        setScreen(next.complicationTriggered && next.beat === 'adaptation' ? 'complication' : 'response');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replace(/^API \d+: /, '') : 'That action could not be recorded. Your previous state is still saved.');
    } finally {
      setWorking(false);
    }
  }, [attempt, completeClinicalSimulation, submitClinicalSimulationAction, working]);

  if (!player) {
    return <SafeAreaView style={styles.container}><View style={styles.center}><ActivityIndicator color={COLORS.brand} /><Text style={styles.muted}>Opening Simulation Lab…</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.replace(ROUTES.UNI_PRACTICE)} accessibilityLabel="Return to University practice">
          <Ionicons name="chevron-back" size={20} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>CLINICAL SIMULATION LAB</Text>
          <Text style={styles.title}>{screen === 'active' ? manifest.patientName : manifest.title}</Text>
        </View>
        <View style={styles.zeroCost}><Ionicons name="leaf-outline" size={13} color="#34D399" /><Text style={styles.zeroCostTxt}>ZERO STAMINA</Text></View>
      </View>

      {error && <View style={styles.error} accessibilityLiveRegion="polite"><Ionicons name="information-circle-outline" size={16} color="#FCA5A5" /><Text style={styles.errorTxt}>{error}</Text></View>}
      {working && <View style={styles.loadingStrip}><ActivityIndicator size="small" color={COLORS.brand} /><Text style={styles.loadingTxt}>Saving your clinical decision…</Text></View>}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {screen === 'locked' && (
          <View style={styles.panel}>
            <Ionicons name="lock-closed-outline" size={30} color="#A78BFA" />
            <Text style={styles.panelTitle}>Build your lab foundation</Text>
            <Text style={styles.body}>Simulation Lab opens after one introductory Lotus Lesson and one completion in Clinical Cue Lab, Rapid Triage Hall, and Stabilize Stack Lab.</Text>
            <View style={styles.checkList}>
              {[
                ['Lotus Lesson', (player.lessons_completed?.length ?? 0) >= 1],
                ['Clinical Cue Lab', (player.uni_cue_lab_count ?? 0) >= 1],
                ['Rapid Triage Hall', (player.uni_triage_count ?? 0) >= 1],
                ['Stabilize Stack Lab', (player.uni_stack_count ?? 0) >= 1],
              ].map(([label, done]) => <Text key={String(label)} style={[styles.check, { color: done ? '#86EFAC' : COLORS.onSurfaceSecondary }]}>{done ? '✓' : '○'} {label}</Text>)}
            </View>
            <Pressable style={styles.primary} onPress={() => router.replace(ROUTES.UNI_PRACTICE)}><Text style={styles.primaryTxt}>GO TO PRACTICE LABS</Text></Pressable>
          </View>
        )}

        {screen === 'intro' && (
          <>
            <View style={styles.recommended}>
              <Text style={styles.recommendedKicker}>RECOMMENDED NEXT</Text>
              <Text style={styles.recommendedTitle}>{manifest.title}</Text>
              <Text style={styles.body}>{manifest.subtitle}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>{difficultyLabel(manifest.difficulty)}</Text><Text style={styles.meta}>•</Text><Text style={styles.meta}>{manifest.domain}</Text><Text style={styles.meta}>•</Text><Text style={styles.meta}>~{manifest.estimatedMinutes} min</Text>
              </View>
              <Pressable style={styles.primary} onPress={() => start()} disabled={working} testID="simulation-recommended-start"><Text style={styles.primaryTxt}>START RECOMMENDED SIMULATION</Text><Ionicons name="arrow-forward" size={15} color="#071018" /></Pressable>
            </View>
            <Pressable style={styles.secondary} onPress={() => setScreen('configuration')}><Ionicons name="options-outline" size={16} color="#A78BFA" /><Text style={styles.secondaryTxt}>Configure a different reviewed case</Text></Pressable>
            <Text style={styles.disclaimer}>Educational gameplay only. This Lab does not provide medical advice, a real-time timer, AP, energy, or currency.</Text>
          </>
        )}

        {screen === 'configuration' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Choose a reviewed case</Text>
            <Text style={styles.body}>Configuration opens progressively after the foundation labs. Advanced and Expert remain gated at Player Level {CLINICAL_SIMULATION_ADVANCED_LEVEL_GATE}.</Text>
            <Text style={styles.sectionLabel}>DOMAIN & STYLE</Text>
            {CLINICAL_SIMULATIONS.map((candidate) => {
              const locked = ['advanced', 'expert'].includes(candidate.difficulty) && advancedLocked;
              const selected = candidate.id === manifest.id;
              return <Pressable key={candidate.id} disabled={locked} onPress={() => selectManifest(candidate)} style={[styles.caseRow, selected && styles.caseSelected, locked && styles.caseLocked]}>
                <View style={{ flex: 1 }}><Text style={styles.caseTitle}>{candidate.title}</Text><Text style={styles.caseSub}>{difficultyLabel(candidate.difficulty)} · {candidate.domain} · {candidate.style}</Text></View>
                <Ionicons name={locked ? 'lock-closed' : selected ? 'checkmark-circle' : 'chevron-forward'} size={18} color={locked ? COLORS.onSurfaceTertiary : selected ? '#34D399' : COLORS.onSurfaceSecondary} />
              </Pressable>;
            })}
            <Text style={styles.sectionLabel}>ASSISTANCE</Text>
            <View style={styles.choiceRow}>
              {(['coach', 'guided', 'none'] as const).map((assist) => <Pressable key={assist} onPress={() => setConfig((prev) => ({ ...prev, assistance: assist }))} style={[styles.chip, config.assistance === assist && styles.chipActive]}><Text style={styles.chipTxt}>{assist === 'coach' ? 'Coach cues' : assist === 'guided' ? 'Guided' : 'No hints'}</Text></Pressable>)}
            </View>
            {manifest.complications.length > 0 && !advancedLocked && <Pressable onPress={() => setConfig((prev) => ({ ...prev, complicationId: prev.complicationId ? undefined : manifest.complications[0].id }))} style={styles.complicationToggle}><Ionicons name={config.complicationId ? 'checkbox-outline' : 'square-outline'} size={18} color="#F59E0B" /><Text style={styles.body}>Include reviewed complication: {manifest.complications[0].label}</Text></Pressable>}
            <Pressable style={styles.primary} onPress={() => start()} disabled={working}><Text style={styles.primaryTxt}>BEGIN THIS CASE</Text></Pressable>
          </View>
        )}

        {screen === 'handoff' && attempt && (
          <View style={styles.panel}>
            <Text style={styles.recommendedKicker}>HANDOFF · {attempt.branchId.slice(-4).toUpperCase()}</Text>
            <Text style={styles.panelTitle}>{manifest.patientName}, {manifest.patientAge}</Text>
            <Text style={styles.body}>{manifest.handoff}</Text>
            <View style={styles.concern}><Ionicons name="alert-circle-outline" size={17} color="#FBBF24" /><Text style={styles.concernTxt}>Current concern: {attempt.patient.concern}</Text></View>
            <Text style={styles.body}>There is no timer. Read the handoff, make one approved decision at a time, and use the timeline to review what changed.</Text>
            <Pressable style={styles.primary} onPress={() => setScreen('active')}><Text style={styles.primaryTxt}>BEGIN ASSESSMENT</Text></Pressable>
            <Pressable style={styles.secondary} onPress={() => router.replace(ROUTES.UNI_PRACTICE)}><Text style={styles.secondaryTxt}>PAUSE & RESUME LATER</Text></Pressable>
          </View>
        )}

        {(screen === 'active' || screen === 'response' || screen === 'complication') && attempt && (
          <>
            {screen !== 'active' && <View style={[styles.responseBanner, screen === 'complication' && styles.complicationBanner]} accessibilityLiveRegion="polite">
              <Ionicons name={screen === 'complication' ? 'warning-outline' : 'chatbubble-ellipses-outline'} size={18} color={screen === 'complication' ? '#FBBF24' : '#C4B5FD'} />
              <View style={{ flex: 1 }}>
                <Text style={styles.responseTitle}>{screen === 'complication' ? 'AUTHORED COMPLICATION' : 'DECISION RECORDED'}</Text>
                <Text style={styles.responseText}>{attempt.timeline[attempt.timeline.length - 1]?.announcement ?? 'The patient state has been updated.'}</Text>
              </View>
            </View>}
            <View style={styles.patientCard} accessibilityLiveRegion="polite">
              <View style={styles.patientHead}><View style={styles.patientAvatar}><Ionicons name="person-outline" size={27} color="#D8B4FE" /></View><View style={{ flex: 1 }}><Text style={styles.patientName}>{manifest.patientName}, {manifest.patientAge}</Text><Text style={styles.patientConcern}>{attempt.patient.concern}</Text></View><Text style={[styles.acuity, attempt.patient.acuity === 'high' && { color: '#FCA5A5' }]}>{attempt.patient.acuity.toUpperCase()}</Text></View>
              <Vital label="Stability" value={attempt.patient.stability} color="#34D399" />
              <Vital label="Oxygenation" value={attempt.patient.oxygenation} color="#7DD3FC" />
              <Vital label="Perfusion" value={attempt.patient.perfusion} color="#FBBF24" />
            </View>

            <View style={styles.beat}><Text style={styles.beatLabel}>CLINICAL-TIME BEAT</Text><Text style={styles.beatTxt}>{attempt.beat === 'adaptation' ? 'Complication: adapt the plan' : difficultyLabel(attempt.beat)}</Text>{attempt.complicationTriggered && <Text style={styles.complicationText}>Complication active — use an approved adaptation.</Text>}</View>
            {(attempt.known.length > 0) && <View style={styles.known}><Text style={styles.sectionLabel}>DISCOVERED DATA</Text>{attempt.known.map((item) => <Text key={item.id} style={styles.knownText}>• {item.label}: {item.value}</Text>)}</View>}

            {screen === 'active' && <><Text style={styles.sectionLabel}>APPROVED ACTIONS</Text>
            {GROUPS.map((group) => {
              const actions = eligibleActions.filter((action) => action.group === group.id);
              return <View key={group.id} style={styles.actionGroup}><View style={styles.groupHeader}><Ionicons name={group.icon} size={15} color={group.color} /><Text style={[styles.groupLabel, { color: group.color }]}>{group.label}</Text></View>{actions.length ? actions.map((action) => <Pressable key={action.id} style={[styles.action, action.unsafe && styles.unsafeAction]} onPress={() => chooseAction(action.id)} disabled={working} accessibilityLabel={`${group.label}: ${action.label}. ${action.rationale}`}><View style={{ flex: 1 }}><Text style={styles.actionTitle}>{action.label}</Text><Text style={styles.actionRationale}>{action.rationale}</Text></View><Ionicons name="arrow-forward" size={17} color={COLORS.onSurfaceSecondary} /></Pressable>) : <Text style={styles.noAction}>No approved {group.label.toLowerCase()} action during this beat.</Text>}</View>;
            })}</>}
            {screen !== 'active' && <Pressable style={styles.primary} onPress={() => setScreen('active')} disabled={working}>
              <Text style={styles.primaryTxt}>{screen === 'complication' ? 'CONTINUE TO ADAPTATION' : 'CONTINUE TO NEXT BEAT'}</Text><Ionicons name="arrow-forward" size={15} color="#071018" />
            </Pressable>}
            <Pressable style={styles.timelineToggle} onPress={() => setShowTimeline((visible) => !visible)}><Ionicons name={showTimeline ? 'chevron-up' : 'time-outline'} size={15} color="#A78BFA" /><Text style={styles.secondaryTxt}>{showTimeline ? 'Hide decision timeline' : `Decision timeline (${attempt.timeline.length})`}</Text></Pressable>
            {showTimeline && attempt.timeline.map((entry, index) => <View style={styles.timeline} key={`${entry.actionId}-${index}`}><Text style={styles.timelineIndex}>{index + 1}</Text><View style={{ flex: 1 }}><Text style={styles.timelineText}>{entry.announcement}</Text><Text style={styles.timelineDelta}>{entry.stateDelta}</Text></View></View>)}
            <Pressable style={styles.secondary} onPress={() => router.replace(ROUTES.UNI_PRACTICE)}><Text style={styles.secondaryTxt}>PAUSE & RESUME LATER</Text></Pressable>
          </>
        )}

        {screen === 'completion' && debrief && (
          <View style={styles.panel}>
            <Text style={styles.recommendedKicker}>COMPLETION RECORDED</Text>
            <Text style={styles.outcome}>{debrief.outcome === 'stabilized' ? 'Patient stabilized' : debrief.outcome === 'unsafe' ? 'Safety review needed' : 'Case complete'}</Text>
            <Text style={styles.body}>Your official result is saved. Review the decision timeline and clinical principle before choosing a retry.</Text>
            <Pressable style={styles.primary} onPress={() => setScreen('debrief')}><Text style={styles.primaryTxt}>OPEN DEBRIEF</Text><Ionicons name="arrow-forward" size={15} color="#071018" /></Pressable>
          </View>
        )}

        {screen === 'debrief' && debrief && (
          <View style={styles.panel}>
            <Text style={styles.recommendedKicker}>SIMULATION DEBRIEF</Text>
            <Text style={styles.outcome}>{debrief.outcome === 'stabilized' ? 'Patient stabilized' : debrief.outcome === 'unsafe' ? 'Safety review needed' : 'A partial response'}</Text>
            <Text style={styles.body}>Rating: {debrief.rating.toUpperCase()} · Official score: {debrief.score}/100</Text>
            <View style={[styles.safety, debrief.safety === 'unsafe' && styles.safetyUnsafe]}><Ionicons name={debrief.safety === 'unsafe' ? 'warning-outline' : 'shield-checkmark-outline'} size={18} color={debrief.safety === 'unsafe' ? '#FCA5A5' : '#86EFAC'} /><Text style={styles.safetyTxt}>{debrief.safety === 'unsafe' ? 'Unsafe turning point: review the timeline before retrying.' : 'Safety result: safe pathway recorded.'}</Text></View>
            <Text style={styles.sectionLabel}>WEIGHTED DOMAIN BREAKDOWN</Text>
            {Object.entries(debrief.domainBreakdown).filter(([domain]) => domain === manifest.domain).map(([domain, score]) => <Vital key={domain} label={difficultyLabel(domain)} value={score} color="#A78BFA" />)}
            <Text style={styles.sectionLabel}>STRONG DECISIONS</Text>
            {(debrief.strongDecisions.length ? debrief.strongDecisions : ['No strong decision was recorded yet.']).map((item) => <Text key={item} style={styles.knownText}>✓ {item}</Text>)}
            <Text style={styles.sectionLabel}>MISSED OPPORTUNITIES</Text>
            {(debrief.missedOpportunities.length ? debrief.missedOpportunities : ['None — all reviewed objectives were addressed.']).map((item) => <Text key={item} style={styles.knownText}>• {item}</Text>)}
            <Pressable style={styles.timelineToggle} onPress={() => setShowDetails((value) => !value)}><Text style={styles.secondaryTxt}>{showDetails ? 'Hide clinical principle' : 'Show clinical principle & related practice'}</Text><Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={15} color="#A78BFA" /></Pressable>
            {showDetails && <View style={styles.detail}><Text style={styles.body}>{debrief.clinicalPrinciple}</Text><Text style={styles.timelineDelta}>Related practice: {debrief.relatedPractice.join(' · ')}</Text></View>}
            <Pressable style={styles.primary} onPress={() => start('same_branch')} disabled={working}><Text style={styles.primaryTxt}>RETRY SAME SCENARIO</Text></Pressable>
            <Pressable style={styles.secondary} onPress={() => { const next = CLINICAL_SIMULATIONS.find((item) => item.variantFamilyId === manifest.variantFamilyId && item.id !== manifest.id) ?? CLINICAL_SIMULATIONS.find((item) => item.id !== manifest.id) ?? manifest; selectManifest(next); setScreen('configuration'); }}><Text style={styles.secondaryTxt}>NEW VARIATION / SIMILAR CASE</Text></Pressable>
            {debrief.safety === 'unsafe' && <Pressable style={styles.secondary} onPress={() => start('guided')}><Text style={styles.secondaryTxt}>REVIEW IN GUIDED MODE</Text></Pressable>}
            <Pressable style={styles.secondary} onPress={() => router.replace(ROUTES.UNI_PRACTICE)}><Text style={styles.secondaryTxt}>NEW SIMULATION</Text></Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: SPACING.lg, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceSecondary },
  back: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000030' },
  kicker: { color: '#A78BFA', fontSize: 10, letterSpacing: 1.4, fontWeight: '800' },
  title: { color: COLORS.onSurface, fontSize: 18, fontWeight: '700', marginTop: 2 },
  zeroCost: { flexDirection: 'row', gap: 4, paddingHorizontal: 7, paddingVertical: 5, borderRadius: RADIUS.pill, backgroundColor: '#34D39918' },
  zeroCostTxt: { color: '#86EFAC', fontSize: 9, fontWeight: '800' },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 52 },
  panel: { backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md },
  recommended: { borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md, borderWidth: 1, borderColor: '#A78BFA55', backgroundColor: '#1D1530' },
  recommendedKicker: { color: '#C4B5FD', fontWeight: '800', fontSize: 10, letterSpacing: 1.4 },
  recommendedTitle: { color: COLORS.onSurface, fontSize: 22, fontWeight: '800' },
  panelTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: '800' },
  body: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  meta: { color: '#C4B5FD', fontSize: 11, textTransform: 'capitalize' },
  primary: { minHeight: 44, backgroundColor: '#A78BFA', borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  primaryTxt: { color: '#120D1D', fontSize: 12, fontWeight: '900', letterSpacing: .4 },
  secondary: { minHeight: 40, borderWidth: 1, borderColor: '#A78BFA55', borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  secondaryTxt: { color: '#C4B5FD', fontSize: 12, fontWeight: '700' },
  disclaimer: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: 8 },
  error: { marginHorizontal: SPACING.lg, marginTop: SPACING.sm, padding: 10, gap: 8, flexDirection: 'row', borderRadius: RADIUS.md, backgroundColor: '#7F1D1D66' },
  errorTxt: { color: '#FECACA', flex: 1, fontSize: 12, lineHeight: 16 },
  loadingStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.lg, paddingVertical: 8, backgroundColor: '#A78BFA18' },
  loadingTxt: { color: '#DDD6FE', fontSize: 11 },
  checkList: { gap: 7 }, check: { fontSize: 13, fontWeight: '600' },
  sectionLabel: { color: '#C4B5FD', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 3 },
  caseRow: { flexDirection: 'row', gap: 8, padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  caseSelected: { borderColor: '#A78BFA', backgroundColor: '#A78BFA16' }, caseLocked: { opacity: .45 },
  caseTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: '700' }, caseSub: { color: COLORS.onSurfaceSecondary, fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 7 }, chipActive: { borderColor: '#A78BFA', backgroundColor: '#A78BFA25' }, chipTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: '700' },
  complicationToggle: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: '#F59E0B10' },
  concern: { flexDirection: 'row', gap: 7, alignItems: 'center', padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: '#F59E0B14' }, concernTxt: { color: '#FDE68A', fontSize: 12, fontWeight: '600' },
  patientCard: { borderRadius: RADIUS.lg, padding: SPACING.md, gap: 10, backgroundColor: '#131B2B', borderWidth: 1, borderColor: '#334155' },
  patientHead: { flexDirection: 'row', alignItems: 'center', gap: 9 }, patientAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#A78BFA22' },
  patientName: { color: COLORS.onSurface, fontSize: 15, fontWeight: '800' }, patientConcern: { color: '#FDE68A', fontSize: 11, marginTop: 2 }, acuity: { color: '#FDE68A', fontSize: 10, fontWeight: '900' },
  vital: { gap: 4 }, vitalRow: { flexDirection: 'row', justifyContent: 'space-between' }, vitalLabel: { color: COLORS.onSurfaceSecondary, fontSize: 11 }, vitalValue: { fontSize: 12, fontWeight: '900' }, vitalTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#FFFFFF16' }, vitalFill: { height: '100%', borderRadius: 3 },
  beat: { borderRadius: RADIUS.md, padding: SPACING.md, backgroundColor: '#A78BFA16', gap: 3 }, beatLabel: { color: '#C4B5FD', fontSize: 10, fontWeight: '900' }, beatTxt: { color: COLORS.onSurface, fontSize: 15, fontWeight: '700', textTransform: 'capitalize' }, complicationText: { color: '#FDE68A', fontSize: 11 },
  responseBanner: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: '#A78BFA16', borderWidth: 1, borderColor: '#A78BFA55' }, complicationBanner: { backgroundColor: '#F59E0B14', borderColor: '#F59E0B66' }, responseTitle: { color: '#C4B5FD', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, responseText: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  known: { gap: 5, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: '#7DD3FC10' }, knownText: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },
  actionGroup: { gap: 6 }, groupHeader: { flexDirection: 'row', gap: 6, alignItems: 'center' }, groupLabel: { fontSize: 12, fontWeight: '900' }, action: { borderRadius: RADIUS.md, padding: SPACING.md, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', gap: 8, alignItems: 'center' }, unsafeAction: { borderColor: '#F8717188', backgroundColor: '#7F1D1D22' },
  actionTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: '700' }, actionRationale: { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 16, marginTop: 2 }, noAction: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontStyle: 'italic', paddingLeft: 3 },
  timelineToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 34 }, timeline: { flexDirection: 'row', gap: 8, paddingLeft: 5 }, timelineIndex: { color: '#C4B5FD', fontSize: 12, fontWeight: '900', width: 18 }, timelineText: { color: COLORS.onSurfaceSecondary, fontSize: 12 }, timelineDelta: { color: COLORS.onSurfaceTertiary, fontSize: 10, marginTop: 2 },
  outcome: { color: COLORS.onSurface, fontWeight: '900', fontSize: 22 }, safety: { flexDirection: 'row', gap: 8, padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: '#14532D55', alignItems: 'center' }, safetyUnsafe: { backgroundColor: '#7F1D1D66' }, safetyTxt: { color: COLORS.onSurface, flex: 1, fontSize: 12, lineHeight: 16 }, detail: { gap: 5, padding: SPACING.sm, backgroundColor: '#A78BFA12', borderRadius: RADIUS.md },
  muted: { color: COLORS.onSurfaceSecondary, fontSize: 12 },
});