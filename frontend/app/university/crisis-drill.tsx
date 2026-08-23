import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import type {
  CrisisDrillAttempt,
  CrisisDrillCaseCard,
  CrisisDrillDebrief,
  CrisisDrillDifficulty,
  CrisisDrillGate,
} from '@/src/game/crisisDrill';
import { ROUTES } from '@/src/game/routes';
import { usePlayer } from '@/src/game/store';
import { COLORS, RADIUS, SPACING } from '@/src/theme/colors';

const cleanError = (error: unknown) =>
  error instanceof Error ? error.message.replace(/^API \d+: /, '') : 'Crisis Drill is unavailable right now.';

const titleCase = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

/** Non-color urgency label — urgency is communicated by text, not by color alone. */
function UrgencyBadge({ urgency }: { urgency: string }) {
  const label = titleCase(urgency);
  const accessible = `Urgency level: ${label}`;
  return (
    <View style={styles.urgencyBadge} accessibilityLabel={accessible}>
      <Ionicons name="alert-circle-outline" size={12} color={COLORS.onSurfaceSecondary} />
      <Text style={styles.urgencyText}>{label.toUpperCase()}</Text>
    </View>
  );
}

/** Numeric vital bar — no color-only urgency; level is labeled in text. */
function Vital({ label, value }: { label: string; value: number }) {
  const level = value < 45 ? 'critical' : value < 65 ? 'needs attention' : 'stable';
  const barColor = value < 45 ? '#F87171' : value < 65 ? '#FBBF24' : '#34D399';
  return (
    <View style={styles.vital} accessibilityLabel={`${label}: ${value} of 100, ${level}`}>
      <View style={styles.vitalLine}>
        <Text style={styles.vitalLabel}>{label}</Text>
        <Text style={styles.vitalValue}>{value}<Text style={styles.vitalMax}>/100</Text></Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${value}%` as any, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.vitalLevel}>{level}</Text>
    </View>
  );
}

export default function CrisisDrillScreen() {
  const router = useRouter();
  const {
    player,
    startCrisisDrill,
    resumeCrisisDrill,
    submitCrisisDrillResponse,
    pauseCrisisDrill,
    abandonCrisisDrill,
    completeCrisisDrill,
  } = usePlayer();

  const [cases, setCases] = useState<CrisisDrillCaseCard[]>([]);
  const [gate, setGate] = useState<CrisisDrillGate | null>(null);
  const [attempt, setAttempt] = useState<CrisisDrillAttempt | null>(null);
  const [debrief, setDebrief] = useState<CrisisDrillDebrief | null>(null);
  const [lastCard, setLastCard] = useState<CrisisDrillCaseCard | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    if (!player) return;
    setBusy(true);
    try {
      const result = await api.getCrisisDrills(player.id, player.economy_token);
      setCases(result.cases);
      setGate(result.gate);
      if (player.crisis_drill_active_attempt_id) {
        // Reading an attempt does NOT implicitly resume it. A paused drill
        // stays paused until the player deliberately presses Resume.
        const { attempt: saved } = await api.getCrisisDrillAttempt(
          player.id,
          player.crisis_drill_active_attempt_id,
          player.economy_token,
        );
        setAttempt(saved);
        if (saved.status === 'completed') {
          const complete = await completeCrisisDrill(saved.attemptId);
          setDebrief(complete.debrief);
        }
      }
    } catch (error) {
      setMessage(cleanError(error));
    } finally {
      setBusy(false);
    }
  }, [completeCrisisDrill, player]);

  useFocusEffect(useCallback(() => { loadBoard(); }, [loadBoard]));

  // Pause on background so an app switch cannot leave an active drill accepting input.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && attempt?.status === 'active') {
        pauseCrisisDrill(attempt.attemptId).then(setAttempt).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [attempt, pauseCrisisDrill]);

  const start = async (
    card: CrisisDrillCaseCard,
    mode: CrisisDrillDifficulty,
    retryMode: 'fresh_case' | 'same_case' | 'guided' = 'fresh_case',
  ) => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await startCrisisDrill(
        card.id,
        card.version,
        mode,
        retryMode,
        retryMode === 'same_case' ? attempt?.attemptId : undefined,
      );
      setAttempt(next);
      setDebrief(null);
      setLastCard(card);
    } catch (error) {
      setMessage(cleanError(error));
    } finally {
      setBusy(false);
    }
  };

  const respond = async (responseId: string) => {
    if (!attempt) return;
    setBusy(true);
    setMessage(null);
    try {
      const next = await submitCrisisDrillResponse(attempt.attemptId, responseId);
      setAttempt(next);
      if (next.status === 'completed') {
        setMessage('Drill complete. Open your debrief when you are ready.');
      }
    } catch (error) {
      setMessage(cleanError(error));
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!attempt) return;
    setBusy(true);
    try {
      const result = await completeCrisisDrill(attempt.attemptId);
      setDebrief(result.debrief);
      setAttempt(null);
      await loadBoard();
    } catch (error) {
      setMessage(cleanError(error));
    } finally {
      setBusy(false);
    }
  };

  if (!player) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  // ── DEBRIEF VIEW ──────────────────────────────────────────────────────────
  if (debrief) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} accessibilityLiveRegion="polite">
          <Pressable
            accessibilityRole="button"
            onPress={() => { setDebrief(null); loadBoard(); }}
            style={styles.back}
          >
            <Ionicons name="arrow-back" size={18} color={COLORS.onSurface} />
            <Text style={styles.backText}>DRILL BOARD</Text>
          </Pressable>

          <Text style={styles.eyebrow}>EMERGENCY DEBRIEF</Text>
          <Text style={styles.h1}>{titleCase(debrief.outcome)} result</Text>

          <View style={styles.scoreCard}>
            <Text style={styles.score}>
              {debrief.score}<Text style={styles.scoreSmall}> / 100</Text>
            </Text>
            <Text style={styles.scoreLabel}>
              Urgency handling: {titleCase(debrief.urgencyHandling)} · {titleCase(debrief.safety)}
            </Text>
          </View>
          {debrief.crisisEfficiency && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Crisis Efficiency</Text>
              <Text style={styles.copy}>
                {debrief.crisisEfficiency.eligible
                  ? `${debrief.crisisEfficiency.score} / 100`
                  : 'Unranked — Training and paused/accessibility runs do not create timing records.'}
              </Text>
              <Text style={styles.copy}>{debrief.crisisEfficiency.note}</Text>
            </View>
          )}

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Causality</Text>
            <Text style={styles.copy}>
              <Text style={styles.bold}>Strongest decision: </Text>{debrief.strongestDecision}
            </Text>
            <Text style={styles.copy}>
              <Text style={styles.bold}>Missed opportunity: </Text>{debrief.missedOpportunity}
            </Text>
            <Text style={styles.copy}>
              <Text style={styles.bold}>Clinical principle: </Text>{debrief.clinicalPrinciple}
            </Text>
            <Text style={styles.copy}>
              <Text style={styles.bold}>Patient summary: </Text>{debrief.patientSummary}
            </Text>
          </View>

          {debrief.timeline.length > 0 && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Drill timeline</Text>
              {debrief.timeline.map((entry, index) => (
                <Text style={styles.copy} key={`${entry.stepId}-${index}`}>
                  {entry.timingLabel} · {entry.announcement} · {entry.stateDelta}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Learning loop</Text>
            {debrief.relatedPractice.length > 0 && (
              <Text style={styles.copy}>
                Related University practice: {debrief.relatedPractice.join(' · ')}
              </Text>
            )}
            <Text style={styles.copy}>
              {debrief.reward.message}
              {debrief.reward.xp > 0
                ? ` +${debrief.reward.xp} XP · +${debrief.reward.universityCredits} credits`
                : ''}
            </Text>
          </View>

          {lastCard && (
            <>
              <Pressable
                style={styles.primary}
                onPress={() => start(lastCard, 'training', 'fresh_case')}
                disabled={busy}
              >
                <Text style={styles.primaryText}>RETRY TRAINING MODE</Text>
              </Pressable>
              <Pressable
                style={styles.primary}
                onPress={() => start(lastCard, 'crisis', 'fresh_case')}
                disabled={busy}
              >
                <Text style={styles.primaryText}>RETRY CRISIS MODE</Text>
              </Pressable>
              <Pressable
                style={styles.secondary}
                onPress={() => start(lastCard, 'training', 'guided')}
                disabled={busy}
              >
                <Text style={styles.secondaryText}>PRACTICE · NO REWARD</Text>
              </Pressable>
            </>
          )}
          <Pressable style={styles.secondary} onPress={() => { setDebrief(null); loadBoard(); }}>
            <Text style={styles.secondaryText}>RETURN TO DRILL BOARD</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => router.push(ROUTES.UNI_PRACTICE)}>
            <Text style={styles.secondaryText}>OPEN RELATED PRACTICE</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── ACTIVE / PAUSED ATTEMPT VIEW ──────────────────────────────────────────
  if (attempt) {
    const caseCard = cases.find((c) => c.id === attempt.caseId);
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header row */}
          <View style={styles.topline}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                pauseCrisisDrill(attempt.attemptId).then((next) => {
                  setAttempt(next);
                  router.back();
                })
              }
              style={styles.iconBtn}
            >
              <Ionicons name="pause-outline" size={20} color={COLORS.onSurface} />
              <Text style={styles.iconText}>PAUSE</Text>
            </Pressable>
            <Text style={styles.eyebrow}>
              {attempt.status === 'paused'
                ? 'DRILL PAUSED'
                : attempt.mode === 'crisis'
                ? 'CRISIS DRILL'
                : 'TRAINING DRILL'}
            </Text>
            {/* The server owns the active response window. It affects Crisis
                Efficiency/prestige only; never safety, mastery, or rewards. */}
            {attempt.elapsedLabel ? (
              <Text
                style={styles.elapsedLabel}
                accessibilityLiveRegion="polite"
                accessibilityLabel={`Response timing: ${attempt.elapsedLabel}. Timing affects Crisis Efficiency prestige only.`}
              >
                {attempt.elapsedLabel}
              </Text>
            ) : <View />}
          </View>

          {caseCard && (
            <Text style={styles.h1}>{caseCard.title}</Text>
          )}

          {/* Non-color urgency — urgency communicated by text + icon, never color alone */}
          <View style={styles.urgencyRow}>
            <UrgencyBadge urgency={attempt.patient.urgency} />
            <Text style={styles.concern} accessibilityLiveRegion="polite">
              {attempt.patient.concern}
            </Text>
          </View>

          {/* Patient vitals */}
          <View style={styles.vitals}>
            <Vital label="Stability" value={attempt.patient.stability} />
            <Vital label="Oxygenation" value={attempt.patient.oxygenation} />
            <Vital label="Perfusion" value={attempt.patient.perfusion} />
          </View>

          {/* Persistent known patient data */}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Known patient data</Text>
            {attempt.known.length ? (
              attempt.known.map((item) => (
                <Text key={item.id} style={styles.copy}>{item.label}: {item.value}</Text>
              ))
            ) : (
              <Text style={styles.copy}>
                No additional focused findings are known yet. Choose an action to reveal what is clinically observable.
              </Text>
            )}
          </View>

          {/* Clinical change timeline — manual paced, collapsible */}
          <Pressable
            style={styles.timelineToggle}
            onPress={() => setShowTimeline((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showTimeline }}
          >
            <Text style={styles.timelineText}>
              CLINICAL TIMELINE ({attempt.timeline.length})
            </Text>
            <Ionicons
              name={showTimeline ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={COLORS.onSurfaceSecondary}
            />
          </Pressable>
          {showTimeline && (
            <View style={styles.panel}>
              {attempt.timeline.length === 0 ? (
                <Text style={styles.copy}>No events recorded yet.</Text>
              ) : (
                attempt.timeline.map((entry, index) => (
                  <Text style={styles.copy} key={`${entry.stepId}-${index}`}>
                    {entry.timingLabel} · {entry.announcement} · {entry.stateDelta}
                  </Text>
                ))
              )}
            </View>
          )}

          {/* Complication notice */}
          {attempt.complicationActive && (
            <View style={styles.complicationNotice} accessibilityLiveRegion="assertive">
              <Ionicons name="warning-outline" size={16} color="#FBBF24" />
              <Text style={styles.complicationText}>
                COMPLICATION ACTIVE — MANUAL CONTINUATION REQUIRED
              </Text>
            </View>
          )}

          {/* Main interaction area */}
          {attempt.status === 'paused' ? (
            <Pressable
              style={styles.primary}
              onPress={() => resumeCrisisDrill(attempt.attemptId).then(setAttempt)}
            >
              <Text style={styles.primaryText}>RESUME WHEN READY</Text>
            </Pressable>
          ) : attempt.step ? (
            <>
              <Text style={styles.eyebrow}>
                {attempt.complicationActive
                  ? 'COMPLICATION · MANUAL CONTINUATION'
                  : `${attempt.step.urgency.toUpperCase()} URGENCY · MANUAL CONTINUATION`}
              </Text>
              <View style={styles.stepHeader}>
                <Text style={styles.stationTitle}>{attempt.step.label}</Text>
                <UrgencyBadge urgency={attempt.step.urgency} />
              </View>
              <Text style={styles.prompt}>{attempt.step.prompt}</Text>
              {/* 3–5 action choices */}
              {attempt.step.options.map((option) => (
                <Pressable
                  key={option.id}
                  disabled={busy}
                  onPress={() => respond(option.id)}
                  accessibilityRole="button"
                  style={[styles.option, busy && styles.disabled]}
                >
                  <Text style={styles.optionTitle}>{option.label}</Text>
                  <Text style={styles.optionCopy}>{option.rationale}</Text>
                </Pressable>
              ))}
            </>
          ) : (
            <Pressable style={styles.primary} disabled={busy} onPress={finish}>
              <Text style={styles.primaryText}>OPEN EMERGENCY DEBRIEF</Text>
            </Pressable>
          )}

          {message && (
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Text style={styles.noticeText}>{message}</Text>
            </View>
          )}

          <Pressable
            style={styles.danger}
            onPress={() =>
              abandonCrisisDrill(attempt.attemptId).then(() => {
                setAttempt(null);
                loadBoard();
              })
            }
          >
            <Text style={styles.dangerText}>ABANDON THIS DRILL</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── CASE BOARD VIEW ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={18} color={COLORS.onSurface} />
          <Text style={styles.backText}>UNIVERSITY</Text>
        </Pressable>

        <Text style={styles.eyebrow}>EMERGENCY TRAINING</Text>
        <Text style={styles.h1}>Code Blue / Crisis Drill</Text>
        <Text style={styles.lede}>
          Fast emergency decision practice. Both Training and Crisis modes are available for every
          approved case. Training is untimed; Crisis uses faculty-owned response windows for a
          separate prestige-only Crisis Efficiency record. Safe care, mastery, and baseline rewards
          never depend on speed. All clinical scoring and safety are reviewed on the faculty record.
        </Text>

        {message && (
          <View style={styles.notice} accessibilityLiveRegion="polite">
            <Text style={styles.noticeText}>{message}</Text>
          </View>
        )}

        {/* Gate / locked notice */}
        {!gate?.eligible && (
          <View style={styles.locked}>
            <Ionicons name="lock-closed-outline" size={22} color="#FBBF24" />
            <Text style={styles.panelTitle}>Preparation required</Text>
            <Text style={styles.copy}>{gate?.reason ?? 'Loading prerequisites…'}</Text>
          </View>
        )}

        {/* Mode legend */}
        <View style={styles.modeLegend}>
          <View style={styles.modeLegendRow}>
            <Ionicons name="school-outline" size={14} color="#34D399" />
            <Text style={styles.modeLegendText}>
              <Text style={styles.bold}>Training mode</Text> — paced, safe debrief, reward eligible on first clear
            </Text>
          </View>
          <View style={styles.modeLegendRow}>
            <Ionicons name="alert-circle-outline" size={14} color="#F87171" />
            <Text style={styles.modeLegendText}>
              <Text style={styles.bold}>Crisis mode</Text> — higher urgency, same manual pacing, same safe debrief
            </Text>
          </View>
        </View>

        {/* Case cards */}
        {busy && !cases.length ? (
          <ActivityIndicator color={COLORS.brand} />
        ) : (
          cases.map((card) => (
            <View
              key={card.id}
              style={[styles.caseCard, !card.available && styles.caseLocked]}
              accessibilityLabel={`${card.title}, ${card.available ? 'available' : `locked: ${card.lockedReason}`}`}
            >
              <View style={styles.caseHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.caseKicker}>
                    {card.approved ? 'APPROVED CASE' : 'CASE'} · {card.estimatedMinutes} MIN
                  </Text>
                  <Text style={styles.caseTitle}>{card.title}</Text>
                </View>
                <Ionicons
                  name={card.available ? 'alert-circle-outline' : 'lock-closed-outline'}
                  size={22}
                  color={card.available ? '#F87171' : COLORS.onSurfaceTertiary}
                />
              </View>
              <Text style={styles.caseSub}>{card.subtitle}</Text>
              <Text style={styles.caseMeta}>{card.scenario}</Text>
              {card.personalBest !== null && card.personalBest !== undefined && (
                <Text style={styles.caseMeta}>Personal best: {card.personalBest}</Text>
              )}
              {card.completedCount ? (
                <Text style={styles.caseMeta}>{card.completedCount} drill{card.completedCount !== 1 ? 's' : ''} completed</Text>
              ) : null}

              {card.available ? (
                <View style={styles.modeButtons}>
                  {card.availableModes.includes('training') && (
                    <Pressable
                      style={[styles.caseBtn, styles.trainingBtn]}
                      onPress={() => start(card, 'training', card.completedCount ? 'guided' : 'fresh_case')}
                      disabled={busy || !gate?.eligible}
                      accessibilityRole="button"
                      accessibilityLabel={`Start ${card.title} in Training mode`}
                    >
                      <Ionicons name="school-outline" size={13} color="#34D399" />
                      <Text style={[styles.caseBtnText, { color: '#34D399' }]}>
                        {card.completedCount ? 'PRACTICE TRAINING · NO REWARD' : 'BEGIN TRAINING'}
                      </Text>
                    </Pressable>
                  )}
                  {card.availableModes.includes('crisis') && (
                    <Pressable
                      style={[styles.caseBtn, styles.crisisBtn]}
                      onPress={() => start(card, 'crisis', card.completedCount ? 'guided' : 'fresh_case')}
                      disabled={busy || !gate?.eligible}
                      accessibilityRole="button"
                      accessibilityLabel={`Start ${card.title} in Crisis mode`}
                    >
                      <Ionicons name="alert-circle-outline" size={13} color="#F87171" />
                      <Text style={[styles.caseBtnText, { color: '#F87171' }]}>
                        {card.completedCount ? 'PRACTICE CRISIS · NO REWARD' : 'BEGIN CRISIS DRILL'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <Text style={styles.lockReason}>{card.lockedReason}</Text>
              )}
            </View>
          ))
        )}

        <View style={styles.footNote}>
          <Ionicons name="information-circle-outline" size={13} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footNoteText}>
            Crisis Drill is a game progression system only — not CME/CE credit. Timing labels are
            server-assigned display values and are never used to compute your score.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface },
  content: { padding: SPACING.lg, paddingBottom: 56, gap: SPACING.md },

  back: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { color: COLORS.onSurfaceSecondary, fontWeight: '800', fontSize: 12 },

  eyebrow: { color: '#F87171', fontWeight: '900', fontSize: 11, letterSpacing: 1.2 },
  h1: { color: COLORS.onSurface, fontSize: 29, lineHeight: 35, fontWeight: '900' },
  lede: { color: COLORS.onSurfaceSecondary, fontSize: 15, lineHeight: 22 },

  notice: { backgroundColor: '#23344C', borderRadius: RADIUS.md, padding: 12 },
  noticeText: { color: '#D6E9FF', fontSize: 13, lineHeight: 18 },

  locked: {
    backgroundColor: '#3B2C0A', borderWidth: 1, borderColor: '#FBBF2455',
    borderRadius: RADIUS.lg, padding: SPACING.lg, gap: 7,
  },

  modeLegend: {
    backgroundColor: '#171428', borderRadius: RADIUS.lg, padding: SPACING.md, gap: 8,
  },
  modeLegendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  modeLegendText: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19, flex: 1 },

  // Case cards
  caseCard: {
    backgroundColor: '#1A0E10', borderRadius: RADIUS.lg, padding: SPACING.lg, gap: 9,
    borderWidth: 1, borderColor: '#F8717144',
  },
  caseLocked: { opacity: 0.72, borderColor: '#ffffff16' },
  caseHead: { flexDirection: 'row', gap: 10 },
  caseKicker: { color: '#F87171', fontSize: 10, fontWeight: '900', letterSpacing: .7 },
  caseTitle: { color: COLORS.onSurface, fontSize: 19, fontWeight: '900', marginTop: 3 },
  caseSub: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  caseMeta: { color: '#8E8AA4', fontSize: 12, fontWeight: '700' },
  lockReason: { color: '#FBBF24', fontSize: 12, lineHeight: 17 },
  modeButtons: { gap: 8, marginTop: 3 },
  caseBtn: {
    borderRadius: RADIUS.md, alignItems: 'center', paddingVertical: 11, marginTop: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  trainingBtn: { backgroundColor: '#0E2418', borderWidth: 1, borderColor: '#34D39955' },
  crisisBtn: { backgroundColor: '#2A0E10', borderWidth: 1, borderColor: '#F8717155' },
  caseBtnText: { fontSize: 12, fontWeight: '900', letterSpacing: .4 },

  // Attempt view
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5 },
  iconText: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: '900' },
  elapsedLabel: {
    color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 0.4,
  },

  urgencyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  urgencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ffffff12', borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  urgencyText: { color: COLORS.onSurfaceSecondary, fontSize: 10, fontWeight: '900', letterSpacing: .6 },
  concern: { color: COLORS.onSurface, fontSize: 13, fontWeight: '800', flex: 1 },

  vitals: { backgroundColor: '#11101E', borderRadius: RADIUS.lg, padding: SPACING.md, gap: 11 },
  vital: { gap: 3 },
  vitalLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  vitalLabel: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: '700' },
  vitalValue: { fontSize: 13, fontWeight: '900', color: COLORS.onSurface },
  vitalMax: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: '600' },
  vitalLevel: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: '600' },
  bar: { height: 5, backgroundColor: '#ffffff16', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },

  panel: { backgroundColor: '#171428', borderRadius: RADIUS.lg, padding: SPACING.md, gap: 7 },
  panelTitle: { color: COLORS.onSurface, fontWeight: '900', fontSize: 14 },
  copy: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  bold: { color: COLORS.onSurface, fontWeight: '800' },

  timelineToggle: {
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3, alignItems: 'center',
  },
  timelineText: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: '900', letterSpacing: .5 },

  complicationNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#2D1F06', borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: '#FBBF2455',
  },
  complicationText: { color: '#FBBF24', fontSize: 12, fontWeight: '900', flex: 1 },

  stepHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
  },
  stationTitle: { color: COLORS.onSurface, fontSize: 21, fontWeight: '900', flex: 1 },
  prompt: { color: COLORS.onSurfaceSecondary, fontSize: 15, lineHeight: 22 },
  option: {
    borderWidth: 1, borderColor: '#ffffff22', borderRadius: RADIUS.lg,
    padding: SPACING.md, gap: 5, backgroundColor: '#1C1930',
  },
  disabled: { opacity: .55 },
  optionTitle: { color: COLORS.onSurface, fontWeight: '800', fontSize: 15 },
  optionCopy: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },

  primary: {
    backgroundColor: '#7C1D1D', borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#F8717144',
  },
  primaryText: { color: '#FFCDD2', fontSize: 12, fontWeight: '900', letterSpacing: .5 },
  secondary: {
    borderWidth: 1, borderColor: '#ffffff26', borderRadius: RADIUS.md,
    paddingVertical: 13, alignItems: 'center',
  },
  secondaryText: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: '900' },
  danger: { alignItems: 'center', padding: 12 },
  dangerText: { color: '#F87171', fontSize: 11, fontWeight: '900' },

  // Debrief
  scoreCard: {
    backgroundColor: '#2A1010', borderRadius: RADIUS.lg, padding: SPACING.lg,
    alignItems: 'center', gap: 3,
  },
  score: { color: '#FFCDD2', fontSize: 46, fontWeight: '900' },
  scoreSmall: { color: '#F87171', fontSize: 17 },
  scoreLabel: { color: '#F87171', fontSize: 12, fontWeight: '700', textAlign: 'center' },

  footNote: {
    flexDirection: 'row', gap: 6, alignItems: 'flex-start',
    marginTop: SPACING.sm,
  },
  footNoteText: {
    color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 16, flex: 1,
  },
});
