import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { InlineNotice, useInlineNotice } from "@/src/components/WebAlert";
import {
  PLAYER_HERO_STAGE_GATES, PLAYER_HERO_STAT_KEYS, playerHeroStateLabel,
  type PlayerHeroEligibility, type PlayerHeroStat,
} from "@/src/game/playerHero";
import { usePlayer } from "@/src/game/store";
import { ROUTES } from "@/src/game/routes";
import { UI, UI_RADIUS } from "@/src/theme/ui";

const FOCUSES = ["lantern", "lotus", "compass", "bell"] as const;
const CORE_TRAITS = ["steady_hands", "clinical_eye", "quiet_resolve"] as const;
const NATURAL_TALENTS = ["pattern_reader", "rapid_learner", "protective_instinct"] as const;
const CREEDS = ["care_before_glory", "truth_in_practice", "leave_no_one_behind"] as const;

function pretty(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PlayerHeroScreen() {
  const router = useRouter();
  const { player, getPlayerHeroEligibility, createPlayerHero } = usePlayer();
  const { notice, flashNotice } = useInlineNotice();
  const [eligibility, setEligibility] = useState<PlayerHeroEligibility | null>(null);
  const [name, setName] = useState(player?.name ?? "");
  const [pronouns, setPronouns] = useState(player?.pronouns ?? "they/them");
  const [focus, setFocus] = useState<(typeof FOCUSES)[number]>("lantern");
  const [coreTrait, setCoreTrait] = useState<(typeof CORE_TRAITS)[number]>("steady_hands");
  const [naturalTalent, setNaturalTalent] = useState<(typeof NATURAL_TALENTS)[number]>("pattern_reader");
  const [creed, setCreed] = useState<(typeof CREEDS)[number]>("care_before_glory");
  const [stats, setStats] = useState<Record<PlayerHeroStat, number>>({
    insight: 5, carePower: 5, intervention: 5, guard: 5, coordination: 5,
  });
  const [busy, setBusy] = useState(false);

  const refreshEligibility = useCallback(async () => {
    const next = await getPlayerHeroEligibility();
    if (next) setEligibility(next);
  }, [getPlayerHeroEligibility]);

  useEffect(() => { void refreshEligibility(); }, [refreshEligibility]);
  const total = useMemo(() => PLAYER_HERO_STAT_KEYS.reduce((sum, key) => sum + stats[key], 0), [stats]);
  const created = player?.player_hero;

  function adjustStat(stat: PlayerHeroStat, delta: number) {
    setStats((current) => {
      const nextValue = current[stat] + delta;
      if (nextValue < 0 || nextValue > 10) return current;
      const nextTotal = total + delta;
      if (nextTotal < 0 || nextTotal > 25) return current;
      return { ...current, [stat]: nextValue };
    });
  }

  async function submit() {
    if (!eligibility?.canCreate || busy || total !== 25) {
      if (total !== 25) flashNotice("Allocate all 25 combat points before creating.");
      return;
    }
    setBusy(true);
    const res = await createPlayerHero({
      displayName: name, pronouns, focus, stats, coreTraitId: coreTrait,
      naturalTalentId: naturalTalent, creedId: creed,
      appearance: { skinTone: player?.char_skin_tone ?? 0, hairStyle: player?.char_hair_style ?? 0, hairColor: 0, faceStyle: 0, accentColor: 0 },
    });
    setBusy(false);
    flashNotice(`${res.ok ? "Awakened" : "Not Yet"} — ${res.message}`);
    if (res.ok) await refreshEligibility();
  }

  if (!player) {
    return <SafeAreaView style={[styles.root, styles.center]}><ActivityIndicator color={UI.gold} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.replace(ROUTES.HEROES)} hitSlop={12} style={styles.back} testID="player-hero-back">
            <Ionicons name="chevron-back" size={23} color={UI.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>ONE-TIME AWAKENING</Text>
            <Text style={styles.title}>Your Player Hero</Text>
          </View>
        </View>

        {notice && <InlineNotice notice={notice} icon="sparkles" testID="player-hero-notice" />}

        {created ? (
          <View style={styles.card} testID="player-hero-created">
            <Text style={styles.kicker}>AWAKENED</Text>
            <Text style={styles.heroName}>{created.identity.displayName}</Text>
            <Text style={styles.body}>
              {pretty(created.skillDNA.signatureId)} · {pretty(created.potential.tier)} Potential
            </Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summary}>Core: {pretty(created.progression.coreTraitId)}</Text>
              <Text style={styles.summary}>Natural: {pretty(created.progression.naturalTalentId)}</Text>
            </View>
            {(player.player_hero_opportunities ?? []).length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Journey Development</Text>
                {(player.player_hero_opportunities ?? []).slice(-3).reverse().map((opportunity) => (
                  <View key={opportunity.id} style={styles.opportunityRow}>
                    <Ionicons
                      name={opportunity.awarded ? "sparkles" : "checkmark-circle"}
                      size={16}
                      color={opportunity.awarded ? UI.gold : UI.textDim}
                    />
                    <Text style={styles.opportunityText}>
                      {opportunity.awarded
                        ? `${pretty(opportunity.kind ?? "development")} opportunity secured`
                        : "Journey completed — no development opportunity this time"}
                    </Text>
                  </View>
                ))}
              </>
            )}
            <Text style={styles.sectionTitle}>Progression Gates</Text>
            {Object.entries(PLAYER_HERO_STAGE_GATES).map(([stage, gate]) => (
              <View key={stage} style={styles.stageRow}>
                <Text style={styles.stageName}>{pretty(stage)}</Text>
                <Text style={[styles.stageStatus, { color: gate.playable ? UI.teal : UI.textDim }]}>
                  {gate.playable ? `Level ${gate.minLevel}+ sidegrade` : `Level ${gate.minLevel}+ · unavailable`}
                </Text>
              </View>
            ))}
            <Text style={styles.footnote}>
              Proficiency is earned only from verified meaningful practice. Player Hero equipment, artifacts, Aegis, and Covenant remain separately gated.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card} testID="player-hero-gate">
              <View style={styles.stateRow}>
                <View>
                  <Text style={styles.kicker}>AWAKENING STATUS</Text>
                  <Text style={styles.stateTitle}>{playerHeroStateLabel(eligibility?.state ?? "hidden")}</Text>
                </View>
                <Ionicons name={eligibility?.canCreate ? "lock-open" : "lock-closed"} size={28} color={eligibility?.canCreate ? UI.teal : UI.gold} />
              </View>
              <Text style={styles.body}>
                This is a distinct, one-time hero. It never enters Recruitment or changes your existing roster progression.
              </Text>
              <Text style={styles.sectionTitle}>Requirements</Text>
              {(eligibility?.requirements ?? []).map((requirement) => (
                <View style={styles.requirement} key={requirement.id}>
                  <Ionicons name={requirement.met ? "checkmark-circle" : "ellipse-outline"} size={18} color={requirement.met ? UI.teal : UI.textDim} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requirementLabel}>{requirement.label}</Text>
                    <Text style={styles.requirementDetail}>{requirement.detail}</Text>
                  </View>
                </View>
              ))}
              {!eligibility && <ActivityIndicator color={UI.gold} style={{ marginVertical: 8 }} />}
            </View>

            {eligibility?.canCreate && (
              <View style={styles.card} testID="player-hero-create">
                <Text style={styles.sectionTitle}>Create Your Hero</Text>
                <Text style={styles.body}>Your Potential Profile and Signature lineage are issued once by the server after creation.</Text>
                <TextInput value={name} onChangeText={setName} placeholder="Hero name" placeholderTextColor={UI.textDim} style={styles.input} maxLength={24} />
                <TextInput value={pronouns} onChangeText={setPronouns} placeholder="Pronouns" placeholderTextColor={UI.textDim} style={styles.input} maxLength={32} />
                <ChoiceRow label="Focus" values={FOCUSES} value={focus} onChange={setFocus} />
                <ChoiceRow label="Core Trait" values={CORE_TRAITS} value={coreTrait} onChange={setCoreTrait} />
                <ChoiceRow label="Natural Talent" values={NATURAL_TALENTS} value={naturalTalent} onChange={setNaturalTalent} />
                <ChoiceRow label="Creed" values={CREEDS} value={creed} onChange={setCreed} />
                <Text style={styles.sectionTitle}>Combat Allocation · {total}/25</Text>
                {PLAYER_HERO_STAT_KEYS.map((stat) => (
                  <View key={stat} style={styles.statRow}>
                    <Text style={styles.statLabel}>{pretty(stat)}</Text>
                    <Pressable onPress={() => adjustStat(stat, -1)} style={styles.statButton}><Text style={styles.statButtonText}>−</Text></Pressable>
                    <Text style={styles.statValue}>{stats[stat]}</Text>
                    <Pressable onPress={() => adjustStat(stat, 1)} style={styles.statButton}><Text style={styles.statButtonText}>+</Text></Pressable>
                  </View>
                ))}
                <Pressable style={[styles.cta, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy} testID="player-hero-create-button">
                  {busy ? <ActivityIndicator color={UI.onGold} /> : <Text style={styles.ctaText}>Create Once</Text>}
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChoiceRow<T extends string>({ label, values, value, onChange }: { label: string; values: readonly T[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.choiceWrap}>
        {values.map((item) => <Pressable key={item} onPress={() => onChange(item)} style={[styles.choice, value === item && styles.choiceActive]}>
          <Text style={[styles.choiceText, value === item && styles.choiceTextActive]}>{pretty(item)}</Text>
        </Pressable>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: UI.bgDeep },
  center: { alignItems: "center", justifyContent: "center" },
  scroll: { padding: 18, paddingBottom: 48, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: UI.panel },
  kicker: { color: UI.gold, fontSize: 11, letterSpacing: 1.3, fontWeight: "800" },
  title: { color: UI.text, fontSize: 29, fontWeight: "800", marginTop: 3 },
  card: { backgroundColor: UI.panel, borderColor: UI.border, borderWidth: 1, borderRadius: UI_RADIUS.card, padding: 16 },
  stateRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  stateTitle: { color: UI.text, fontSize: 22, fontWeight: "800", marginTop: 2 },
  heroName: { color: UI.goldSoft, fontSize: 25, fontWeight: "800", marginTop: 3 },
  body: { color: UI.textSoft, fontSize: 14, lineHeight: 21, marginTop: 6 },
  sectionTitle: { color: UI.text, fontWeight: "800", fontSize: 16, marginTop: 18, marginBottom: 9 },
  requirement: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 8, borderBottomColor: UI.divider, borderBottomWidth: 1 },
  requirementLabel: { color: UI.text, fontSize: 14, fontWeight: "700" },
  requirementDetail: { color: UI.textDim, fontSize: 12, marginTop: 2 },
  input: { color: UI.text, backgroundColor: UI.bgBase, borderWidth: 1, borderColor: UI.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, fontSize: 15 },
  choiceGroup: { marginTop: 14 },
  choiceLabel: { color: UI.textSoft, fontSize: 13, fontWeight: "700", marginBottom: 7 },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choice: { borderWidth: 1, borderColor: UI.border, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 99 },
  choiceActive: { borderColor: UI.gold, backgroundColor: UI.gold + "18" },
  choiceText: { color: UI.textSoft, fontSize: 12, fontWeight: "700" },
  choiceTextActive: { color: UI.goldSoft },
  statRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  statLabel: { color: UI.textSoft, flex: 1, fontSize: 14, fontWeight: "700" },
  statButton: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: UI.borderStrong, alignItems: "center", justifyContent: "center" },
  statButtonText: { color: UI.gold, fontSize: 19, lineHeight: 22 },
  statValue: { width: 18, textAlign: "center", color: UI.text, fontWeight: "800" },
  cta: { backgroundColor: UI.gold, alignItems: "center", paddingVertical: 13, borderRadius: 12, marginTop: 18 },
  ctaText: { color: UI.onGold, fontSize: 16, fontWeight: "900" },
  summaryRow: { gap: 7, marginTop: 14 },
  summary: { color: UI.textSoft, fontSize: 13 },
  opportunityRow: { flexDirection: "row", gap: 8, alignItems: "center", paddingVertical: 6, borderBottomColor: UI.divider, borderBottomWidth: 1 },
  opportunityText: { color: UI.textSoft, fontSize: 13, flex: 1 },
  stageRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomColor: UI.divider, borderBottomWidth: 1 },
  stageName: { color: UI.text, fontSize: 14, fontWeight: "700" },
  stageStatus: { fontSize: 12, fontWeight: "700" },
  footnote: { color: UI.textDim, fontSize: 12, lineHeight: 18, marginTop: 16 },
});