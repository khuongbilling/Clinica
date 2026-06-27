import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTestSession } from '../game/testSession';
import { COLORS, RADIUS, SPACING } from '../theme/colors';

export function TestPanel() {
  const { session, resetSession, exportJSON, logEvent } = useTestSession();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!__DEV__) return null;

  const json = open ? exportJSON() : '';

  const handleCopy = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(json);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {}
  };

  const handleCapture = () => {
    logEvent('screen_state_captured', 'dev_panel', {
      meta: {
        eventsCount: session.events.length,
        lastScreen: session.screensVisited[session.screensVisited.length - 1] ?? 'none',
        lastEvent: session.events[session.events.length - 1]?.eventName ?? 'none',
        battleSummary: session.battleSummary,
      },
    });
  };

  const handleReset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    resetSession();
    setConfirmReset(false);
    setOpen(false);
  };

  const lastEvent = session.events[session.events.length - 1];

  return (
    <>
      <View style={styles.fabContainer}>
        <Pressable
          style={styles.fab}
          onPress={() => { setOpen(true); setConfirmReset(false); }}
          hitSlop={12}
        >
          <Text style={styles.fabTxt}>DEV</Text>
        </Pressable>
      </View>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Test Session Log</Text>
              <Text style={styles.sub}>
                {session.events.length} events · {session.screensVisited.length} screens · {session.playerProfile}
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={() => setOpen(false)} hitSlop={10}>
              <Text style={styles.closeTxt}>✕</Text>
            </Pressable>
          </View>

          {lastEvent && (
            <View style={styles.lastEvent}>
              <Text style={styles.lastEventLabel}>LAST EVENT</Text>
              <Text style={styles.lastEventName}>{lastEvent.eventName}</Text>
              <Text style={styles.lastEventMeta}>
                {lastEvent.screen} · {new Date(lastEvent.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <StatBox label="Events" value={String(session.events.length)} />
            <StatBox label="Screens" value={String(session.screensVisited.length)} />
            <StatBox label="Profile" value={session.playerProfile} />
            <StatBox label="Battle" value={session.battleSummary.result || 'none'} />
          </View>

          <View style={styles.btnRow}>
            <Pressable style={[styles.btn, copied && styles.btnSuccess]} onPress={handleCopy}>
              <Text style={styles.btnTxt}>{copied ? '✓ Copied!' : 'Copy JSON'}</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={handleCapture}>
              <Text style={styles.btnTxt}>Capture State</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, confirmReset && styles.btnDanger]}
              onPress={handleReset}
            >
              <Text style={styles.btnTxt}>{confirmReset ? 'Confirm Reset' : 'Reset Session'}</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.jsonScroll} contentContainerStyle={styles.jsonContent}>
            <TextInput
              style={styles.jsonText}
              value={json}
              multiline
              editable={false}
              scrollEnabled={false}
              textAlignVertical="top"
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999,
    elevation: 9999,
    pointerEvents: 'box-none' as any,
  },
  fab: {
    position: 'absolute',
    top: 68,
    right: 14,
    backgroundColor: '#CC4400',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  fabTxt: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  modal: { flex: 1, backgroundColor: '#0a0c0e' },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: SPACING.lg, borderBottomWidth: 1, borderColor: '#1e2226',
  },
  title: { color: COLORS.onSurface, fontSize: 18, fontWeight: '600' },
  sub: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  closeBtn: { padding: SPACING.sm, marginTop: -SPACING.xs },
  closeTxt: { color: COLORS.onSurfaceTertiary, fontSize: 20 },

  lastEvent: {
    marginHorizontal: SPACING.lg, marginTop: SPACING.sm,
    backgroundColor: '#111820', borderRadius: RADIUS.sm,
    padding: SPACING.sm, borderWidth: 1, borderColor: '#1e2a38',
  },
  lastEventLabel: { color: '#4a90d9', fontSize: 8, letterSpacing: 2, fontWeight: '700' },
  lastEventName: { color: COLORS.onSurface, fontSize: 14, fontWeight: '500', marginTop: 2 },
  lastEventMeta: { color: COLORS.onSurfaceTertiary, fontSize: 10, marginTop: 2 },

  statsRow: {
    flexDirection: 'row', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
  },
  stat: {
    flex: 1, backgroundColor: '#111315', borderRadius: RADIUS.sm,
    padding: SPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: '#1e2226',
  },
  statVal: { color: COLORS.onSurface, fontSize: 14, fontWeight: '600' },
  statLbl: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 1, marginTop: 2 },

  btnRow: {
    flexDirection: 'row', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm, flexWrap: 'wrap',
  },
  btn: {
    backgroundColor: '#111315', borderRadius: RADIUS.sm,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#2a2d30',
  },
  btnSuccess: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  btnDanger: { borderColor: '#ef4444', backgroundColor: '#2d0a0a' },
  btnTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: '600' },

  jsonScroll: { flex: 1, borderTopWidth: 1, borderColor: '#1e2226' },
  jsonContent: { paddingBottom: SPACING.xxl },
  jsonText: {
    color: '#6b7280', fontSize: 10, lineHeight: 15,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    padding: SPACING.md,
  },
});
