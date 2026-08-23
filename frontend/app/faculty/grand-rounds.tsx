import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import type { FacultyGrandRoundsBoard, FacultyGrandRoundsDraft } from '@/src/game/facultyGrandRounds';
import { COLORS, RADIUS, SPACING } from '@/src/theme/colors';

const cleanError = (error: unknown) => error instanceof Error ? error.message.replace(/^API \d+: /, '') : 'Faculty workspace is unavailable.';

export default function FacultyGrandRoundsScreen() {
  const [facultyKey, setFacultyKey] = useState('');
  const [board, setBoard] = useState<FacultyGrandRoundsBoard | null>(null);
  const [selected, setSelected] = useState<FacultyGrandRoundsDraft | null>(null);
  const [caseId, setCaseId] = useState('');
  const [manifestText, setManifestText] = useState('{\n  "family": "",\n  "title": "",\n  "subtitle": "",\n  "domain": "",\n  "difficulty": "introductory",\n  "patientName": "",\n  "patientAge": 60,\n  "handoff": "",\n  "concern": "",\n  "unlockChapter": 1,\n  "unlockPractice": 3,\n  "initial": { "stability": 70, "oxygenation": 70, "perfusion": 70 },\n  "hidden": [],\n  "principle": "",\n  "relatedPractice": ["Clinical Cue Lab"],\n  "stations": {}\n}');
  const [reviewNotes, setReviewNotes] = useState('');
  const [retireCaseId, setRetireCaseId] = useState('');
  const [retireReason, setRetireReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!facultyKey.trim()) return setMessage('Enter your faculty access key to open the governed workspace.');
    setBusy(true); setMessage(null);
    try {
      const next = await api.getFacultyGrandRounds(facultyKey.trim());
      setBoard(next);
      if (selected) {
        const refreshed = next.drafts.find((draft) => draft.draftId === selected.draftId) ?? null;
        setSelected(refreshed);
        if (refreshed) setManifestText(JSON.stringify(refreshed.manifest, null, 2));
      }
    } catch (error) { setMessage(cleanError(error)); }
    finally { setBusy(false); }
  }, [facultyKey, selected]);

  const parsedManifest = (): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(manifestText);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Case manifest must be a JSON object.');
      return parsed as Record<string, unknown>;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Case manifest is not valid JSON.');
      return null;
    }
  };
  const choose = (draft: FacultyGrandRoundsDraft) => {
    setSelected(draft); setCaseId(draft.caseId); setRetireCaseId(draft.caseId); setManifestText(JSON.stringify(draft.manifest, null, 2)); setReviewNotes(draft.review?.notes ?? '');
  };
  const create = async () => {
    const manifest = parsedManifest();
    if (!manifest || !caseId.trim()) return setMessage('A stable case ID and valid case manifest are required.');
    setBusy(true); setMessage(null);
    try {
      const { draft } = await api.createFacultyGrandRoundsDraft(facultyKey.trim(), caseId.trim(), manifest);
      setSelected(draft); setMessage(`Draft ${draft.caseId} v${draft.version} created. Submit it when ready for review.`); await load();
    } catch (error) { setMessage(cleanError(error)); } finally { setBusy(false); }
  };
  const save = async () => {
    const manifest = parsedManifest();
    if (!manifest || !selected) return;
    setBusy(true); setMessage(null);
    try {
      const { draft } = await api.updateFacultyGrandRoundsDraft(facultyKey.trim(), selected.draftId, selected.revision, manifest);
      setSelected(draft); setMessage('Draft saved. Its revision advanced to prevent lost edits.'); await load();
    } catch (error) { setMessage(cleanError(error)); } finally { setBusy(false); }
  };
  const runAction = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setMessage(null);
    try { await action(); setMessage(success); await load(); }
    catch (error) { setMessage(cleanError(error)); } finally { setBusy(false); }
  };

  const role = board?.faculty.role;
  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.titleRow}><View><Text style={styles.eyebrow}>GOVERNED CURRICULUM</Text><Text style={styles.h1}>Grand Rounds Faculty</Text></View><Ionicons name="shield-checkmark-outline" size={30} color="#C4B5FD" /></View>
    <Text style={styles.copy}>Drafts never appear in learner cases. Publishing creates an immutable version; retirements remove selection without erasing prior attempts or debrief receipts.</Text>
    <View style={styles.panel}><Text style={styles.label}>Faculty access key</Text><TextInput value={facultyKey} onChangeText={setFacultyKey} placeholder="Provided by curriculum administration" placeholderTextColor={COLORS.onSurfaceTertiary} secureTextEntry style={styles.input} accessibilityLabel="Faculty access key" /><Pressable style={styles.primary} disabled={busy} onPress={load}><Text style={styles.primaryText}>OPEN FACULTY WORKSPACE</Text></Pressable></View>
    {message && <View style={styles.notice} accessibilityLiveRegion="polite"><Text style={styles.noticeText}>{message}</Text></View>}
    {busy && <ActivityIndicator color={COLORS.brand} />}
    {board && <><View style={styles.role}><Text style={styles.roleText}>{board.faculty.id} · {role?.toUpperCase()}</Text></View>
      {role === 'author' && <View style={styles.panel}><Text style={styles.panelTitle}>{selected ? `Edit ${selected.caseId} v${selected.version}` : 'New case draft'}</Text>
        <TextInput value={caseId} editable={!selected} onChangeText={setCaseId} placeholder="case-id (e.g. gr-new-case)" placeholderTextColor={COLORS.onSurfaceTertiary} style={styles.input} />
        <Text style={styles.helper}>Enter the complete private case manifest. Server validation checks station paths, legal response links, hidden findings, scoring, and patient-state bounds before review.</Text>
        <TextInput value={manifestText} onChangeText={setManifestText} multiline autoCapitalize="none" autoCorrect={false} textAlignVertical="top" style={styles.editor} accessibilityLabel="Private case manifest JSON" />
        {selected ? <><Pressable style={styles.primary} disabled={busy || !['draft', 'changes_requested'].includes(selected.status)} onPress={save}><Text style={styles.primaryText}>SAVE DRAFT</Text></Pressable><Pressable style={styles.secondary} disabled={busy || !['draft', 'changes_requested'].includes(selected.status)} onPress={() => runAction(() => api.submitFacultyGrandRoundsReview(facultyKey.trim(), selected.draftId, selected.revision), 'Submitted to independent faculty review.')}><Text style={styles.secondaryText}>SUBMIT FOR REVIEW</Text></Pressable></> : <Pressable style={styles.primary} disabled={busy} onPress={create}><Text style={styles.primaryText}>CREATE DRAFT</Text></Pressable>}
      </View>}
      <Text style={styles.section}>CASE REVIEW QUEUE</Text>
      {board.drafts.length === 0 ? <Text style={styles.copy}>No faculty case drafts yet.</Text> : board.drafts.map((draft) => <Pressable key={draft.draftId} style={[styles.card, selected?.draftId === draft.draftId && styles.cardSelected]} onPress={() => choose(draft)}>
        <View style={styles.cardHead}><Text style={styles.cardTitle}>{draft.manifest.title as string ?? draft.caseId}</Text><Text style={styles.status}>{draft.status.replace(/_/g, ' ').toUpperCase()}</Text></View>
        <Text style={styles.meta}>{draft.caseId} · v{draft.version} · revision {draft.revision} · author {draft.authorId}</Text>
        {draft.review && <Text style={styles.helper}>Reviewer {draft.review.reviewerId}: {draft.review.notes}</Text>}
        {selected?.draftId === draft.draftId && role === 'reviewer' && draft.status === 'in_review' && <View style={styles.actionGroup}><TextInput value={reviewNotes} onChangeText={setReviewNotes} multiline placeholder="Required review rationale" placeholderTextColor={COLORS.onSurfaceTertiary} style={styles.notes} /><Pressable style={styles.primary} disabled={busy || reviewNotes.trim().length < 3} onPress={() => runAction(() => api.reviewFacultyGrandRoundsDraft(facultyKey.trim(), draft.draftId, draft.revision, 'approve_for_publish', reviewNotes), 'Case passed independent review and awaits approval.')}><Text style={styles.primaryText}>APPROVE FOR PUBLISH</Text></Pressable><Pressable style={styles.secondary} disabled={busy || reviewNotes.trim().length < 3} onPress={() => runAction(() => api.reviewFacultyGrandRoundsDraft(facultyKey.trim(), draft.draftId, draft.revision, 'changes_requested', reviewNotes), 'Changes request sent to the author.')}><Text style={styles.secondaryText}>REQUEST CHANGES</Text></Pressable></View>}
        {selected?.draftId === draft.draftId && role === 'approver' && draft.status === 'approved_for_publish' && <Pressable style={styles.primary} disabled={busy} onPress={() => runAction(() => api.approveFacultyGrandRoundsDraft(facultyKey.trim(), draft.draftId, draft.revision), `Published immutable ${draft.caseId} v${draft.version}.`)}><Text style={styles.primaryText}>PUBLISH IMMUTABLE VERSION</Text></Pressable>}
      </Pressable>)}
      {role === 'approver' && <View style={styles.panel}><Text style={styles.panelTitle}>Retire a live case</Text><Text style={styles.helper}>Retirement hides a case from new learner selection but preserves its authored version for attempts and debriefs.</Text><TextInput value={retireCaseId} onChangeText={setRetireCaseId} placeholder="Case ID to retire" placeholderTextColor={COLORS.onSurfaceTertiary} style={styles.input} /><TextInput value={retireReason} onChangeText={setRetireReason} placeholder="Required retirement reason" placeholderTextColor={COLORS.onSurfaceTertiary} style={styles.input} /><Pressable style={styles.danger} disabled={busy || !retireCaseId.trim() || !retireReason.trim()} onPress={() => runAction(() => api.retireFacultyGrandRoundsCase(facultyKey.trim(), retireCaseId.trim(), retireReason.trim()), `${retireCaseId} is retired from new learner selection.`)}><Text style={styles.dangerText}>RETIRE CASE</Text></Pressable></View>}
    </>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.surface }, content: { padding: SPACING.lg, paddingBottom: 56, gap: SPACING.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { color: '#C4B5FD', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }, h1: { color: COLORS.onSurface, fontSize: 28, fontWeight: '900' },
  copy: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21 }, panel: { backgroundColor: '#171428', borderRadius: RADIUS.lg, padding: SPACING.md, gap: 9, borderWidth: 1, borderColor: '#ffffff14' }, panelTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: '900' },
  label: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: '800' }, helper: { color: '#AAA6C1', fontSize: 12, lineHeight: 18 }, input: { color: COLORS.onSurface, borderWidth: 1, borderColor: '#ffffff22', borderRadius: RADIUS.md, paddingHorizontal: 11, paddingVertical: 10, fontSize: 14 },
  editor: { color: '#E8E3FF', backgroundColor: '#0F0D1A', borderWidth: 1, borderColor: '#ffffff22', borderRadius: RADIUS.md, padding: 11, minHeight: 300, fontSize: 12, lineHeight: 18, fontFamily: 'monospace' }, notes: { color: COLORS.onSurface, borderWidth: 1, borderColor: '#ffffff22', borderRadius: RADIUS.md, padding: 10, minHeight: 72, textAlignVertical: 'top' },
  primary: { backgroundColor: '#6D4EDB', borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' }, primaryText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: .4 }, secondary: { borderWidth: 1, borderColor: '#ffffff26', borderRadius: RADIUS.md, paddingVertical: 11, alignItems: 'center' }, secondaryText: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: '900' },
  notice: { backgroundColor: '#23344C', borderRadius: RADIUS.md, padding: 12 }, noticeText: { color: '#D6E9FF', fontSize: 13, lineHeight: 18 }, role: { alignSelf: 'flex-start', backgroundColor: '#2C2351', borderRadius: 99, paddingVertical: 6, paddingHorizontal: 10 }, roleText: { color: '#D7CBFF', fontSize: 11, fontWeight: '900' },
  section: { color: COLORS.onSurfaceSecondary, fontSize: 11, letterSpacing: 1, fontWeight: '900', marginTop: 3 }, card: { backgroundColor: '#171428', borderRadius: RADIUS.lg, padding: SPACING.md, gap: 7, borderWidth: 1, borderColor: '#ffffff14' }, cardSelected: { borderColor: '#A78BFAAA' }, cardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, cardTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: '900', flex: 1 }, status: { color: '#C4B5FD', fontSize: 9, fontWeight: '900', textAlign: 'right' }, meta: { color: '#8E8AA4', fontSize: 11 }, actionGroup: { gap: 8, marginTop: 4 },
  danger: { borderWidth: 1, borderColor: '#F8717166', borderRadius: RADIUS.md, paddingVertical: 11, alignItems: 'center' }, dangerText: { color: '#F87171', fontSize: 11, fontWeight: '900' },
});