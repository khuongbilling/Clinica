import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getBadge, getSimulation } from '@/src/game/lessons';
import { ROUTES } from '@/src/game/routes';
import { usePlayer } from '@/src/game/store';
import { COLORS, RADIUS, SPACING } from '@/src/theme/colors';
import { useBlockBack } from '@/src/hooks/useBlockBack';
import { useClearTutorialOnExit } from '@/src/hooks/useClearTutorialOnExit';

export function LegacySimulationDetail({ simulationId }: { simulationId: string }) {
  const router = useRouter();
  const { player, completeSimulation } = usePlayer();
  const simulation = getSimulation(simulationId);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [reward, setReward] = useState<string | null>(null);

  useBlockBack();
  useClearTutorialOnExit();

  if (!player || !simulation) return null;

  const badge = getBadge(simulation.badgeId);
  const alreadyDone = (player.simulations_completed || []).includes(simulation.id);

  const choose = async (index: number) => {
    if (answered) return;
    setSelected(index);
    setAnswered(true);
    const result = await completeSimulation(simulation.id, simulation.choices[index].correct);
    if (result.ok) setReward(result.message);
  };

  const chosen = selected == null ? null : simulation.choices[selected];
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backBtn} onPress={() => router.replace(ROUTES.university)} testID="simulation-back" accessibilityLabel="Return to University">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>SIMULATION{alreadyDone ? ' · COMPLETED' : ''}</Text>
        <Text style={styles.title}>{simulation.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.scenarioBox}>
          <Text style={styles.scenarioLabel}>Scenario</Text>
          <Text style={styles.scenarioTxt}>{simulation.scenario}</Text>
        </View>
        <Text style={styles.section}>Choose the best first action</Text>
        {simulation.choices.map((choice, index) => {
          const selectedChoice = selected === index;
          const correct = answered && choice.correct;
          const wrong = answered && selectedChoice && !choice.correct;
          return (
            <Pressable key={choice.text} onPress={() => choose(index)} disabled={answered}
              style={[styles.choice, correct && styles.choiceCorrect, wrong && styles.choiceWrong]}
              testID={`simulation-choice-${index}`}>
              <Text style={styles.choiceTxt}>{choice.text}</Text>
            </Pressable>
          );
        })}
        {answered && chosen && (
          <View style={styles.feedbackBox} testID="simulation-feedback">
            <Text style={[styles.feedbackHeader, { color: chosen.correct ? COLORS.brand : COLORS.onSurfaceSecondary }]}>
              {chosen.correct ? 'Correct!' : 'Not quite — here’s why'}
            </Text>
            <Text style={styles.feedbackTxt}>{chosen.feedback}</Text>
            {reward && <Text style={styles.rewardTxt}>{reward}</Text>}
            {badge && <Text style={styles.badgeTxt}>Progress toward {badge.name}: {Math.min((player.badge_progress || {})[badge.id] || 0, badge.goal)}/{badge.goal}</Text>}
          </View>
        )}
        <View style={styles.combatPanel}>
          <Text style={styles.combatTitle}>Concept-to-Combat</Text>
          <CombatRow label="Real Concept" text={simulation.conceptToCombat.realConcept} />
          <CombatRow label="Game Translation" text={simulation.conceptToCombat.gameTranslation} />
          <CombatRow label="Battle Tip" text={simulation.conceptToCombat.battleTip} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CombatRow({ label, text }: { label: string; text: string }) {
  return <View style={{ gap: 2 }}><Text style={styles.combatLabel}>{label}</Text><Text style={styles.combatTxt}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: 4 },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)', marginBottom: SPACING.sm },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  title: { color: COLORS.onSurface, fontSize: 22, fontWeight: '300' },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  scenarioBox: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, backgroundColor: COLORS.surfaceSecondary, gap: 4 },
  scenarioLabel: { color: COLORS.brand, fontSize: 11, fontWeight: '700' },
  scenarioTxt: { color: COLORS.onSurface, fontSize: 13, lineHeight: 18 },
  section: { color: COLORS.onSurface, fontSize: 13, fontWeight: '700' },
  choice: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, backgroundColor: COLORS.surfaceSecondary },
  choiceCorrect: { borderColor: COLORS.brand, backgroundColor: `${COLORS.brand}18` },
  choiceWrong: { borderColor: COLORS.brandSecondary, backgroundColor: `${COLORS.brandSecondary}18` },
  choiceTxt: { color: COLORS.onSurface, fontSize: 12 },
  feedbackBox: { gap: 4 },
  feedbackHeader: { fontSize: 12, fontWeight: '800' },
  feedbackTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 16 },
  rewardTxt: { color: COLORS.brand, fontSize: 12, fontWeight: '700' },
  badgeTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  combatPanel: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, backgroundColor: COLORS.surfaceSecondary, gap: SPACING.sm },
  combatTitle: { color: COLORS.onSurface, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  combatLabel: { color: COLORS.brand, fontSize: 10, fontWeight: '700' },
  combatTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 16 },
});