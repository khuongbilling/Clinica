import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FOUNDATION_BANNER, rarityColor, SUMMON_COST } from "@/src/game/gacha";
import { rarityTierLabel } from "@/src/game/university";
import { usePlayer } from "@/src/game/store";
import { useTestSession } from "@/src/game/testSession";
import { useTutorial } from "@/src/game/tutorialStore";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function SummonScreen() {
  const router = useRouter();
  const { player, summonOnce } = usePlayer();
  const { logEvent } = useTestSession();
  const { isCompleted, startTutorial, onRequiredAction } = useTutorial();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ entry: any; duplicate: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!isCompleted("firstSummon")) {
      const t = setTimeout(() => startTutorial("firstSummon"), 600);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => { logEvent('summon_screen_opened', 'summon'); }, []);

  if (!player) return null;
  const shards = player.codex_shards || 0;
  const canSummon = shards >= SUMMON_COST && !busy;

  const handleSummon = async () => {
    onRequiredAction("summon");
    setBusy(true);
    try {
      const res = await summonOnce();
      if (res) setLast(res);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/heroes");
          }}
          style={styles.closeBtn}
          hitSlop={12}
          testID="summon-close"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>SUMMON HALL</Text>
        <Text style={styles.title}>Foundation{"\n"}Healer Banner</Text>
        <Text style={styles.sub}>Spend {SUMMON_COST} Codex Shards to call a new healer.</Text>

        <View style={styles.shardCard}>
          <Ionicons name="diamond" size={18} color={COLORS.brand} />
          <Text style={styles.shardVal}>{shards}</Text>
          <Text style={styles.shardLbl}>CODEX SHARDS</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {last && (
          <View style={[styles.resultCard, last.duplicate ? { borderColor: COLORS.borderStrong } : { borderColor: rarityColor(last.entry.rarity) }]} testID="summon-result">
            <Text style={[styles.resultName, { color: rarityColor(last.entry.rarity) }]}>{last.entry.name}</Text>
            <View style={[styles.tierPill, { borderColor: rarityColor(last.entry.rarity) + "70" }]}>
              <Text style={[styles.tierPillTxt, { color: rarityColor(last.entry.rarity) }]}>{rarityTierLabel(last.entry.rarity)}</Text>
            </View>
            <Text style={styles.resultMeta}>{last.entry.role} · {last.entry.aptitude}</Text>
            <Text style={styles.resultMsg}>{last.message}</Text>
          </View>
        )}

        <Pressable
          style={[styles.summonBtn, !canSummon && { opacity: 0.4 }]}
          onPress={handleSummon}
          disabled={!canSummon}
          testID="summon-button"
        >
          <LinearGradient colors={[COLORS.brand, COLORS.brandSecondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
          {busy ? <ActivityIndicator color={COLORS.onBrand} /> : (
            <>
              <Text style={styles.summonBtnTxt}>SUMMON 1 HEALER</Text>
              <Text style={styles.summonBtnCost}>{SUMMON_COST} SHARDS</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.section}>Banner Pool</Text>
        {FOUNDATION_BANNER.map((h) => {
          const rc = rarityColor(h.rarity);
          const owned = player.heroes_owned.includes(h.heroId);
          return (
            <View key={h.id} style={[styles.poolRow, { borderLeftColor: rc }]} testID={`pool-${h.id}`}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={[styles.poolName, owned && { color: rc }]}>{h.name}</Text>
                  {owned && <Ionicons name="checkmark-circle" size={12} color={rc} />}
                </View>
                <Text style={styles.poolMeta}>{h.role} · {h.aptitude}</Text>
              </View>
              <View style={[styles.tierPillSm, { borderColor: rc + "70" }]}>
                <Text style={[styles.tierPillSmTxt, { color: rc }]}>{rarityTierLabel(h.rarity)}</Text>
              </View>
              <Text style={styles.poolWeight}>{Math.round((h.weight / FOUNDATION_BANNER.reduce((s, x) => s + x.weight, 0)) * 100)}%</Text>
            </View>
          );
        })}
      </ScrollView>

      <TutorialOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: { padding: SPACING.lg, paddingLeft: SPACING.lg + 36, gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  closeBtn: { position: "absolute", left: SPACING.sm, top: SPACING.lg, padding: 12, zIndex: 2, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 3, fontWeight: "700", marginTop: SPACING.lg },
  title: { color: COLORS.onSurface, fontSize: 30, fontWeight: "300", lineHeight: 34 },
  sub: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  shardCard: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.brand + "18", borderRadius: 4, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.brand + "50", borderLeftWidth: 3, borderLeftColor: COLORS.brand, marginTop: SPACING.sm },
  shardVal: { color: COLORS.brand, fontSize: 22, fontWeight: "300" },
  shardLbl: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 1.5, fontWeight: "700", marginLeft: "auto" },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  resultCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, borderRadius: 4, borderWidth: 2, alignItems: "center", gap: 6 },
  resultName: { fontSize: 22, fontWeight: "400" },
  tierPill: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tierPillTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  tierPillSm: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 1 },
  tierPillSmTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  resultMeta: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  resultMsg: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: "center", marginTop: SPACING.sm },
  summonBtn: { height: 56, borderRadius: 4, alignItems: "center", justifyContent: "center", overflow: "hidden", flexDirection: "row", gap: SPACING.md },
  summonBtnTxt: { color: COLORS.onBrand, fontSize: 14, fontWeight: "700", letterSpacing: 2 },
  summonBtnCost: { color: COLORS.onBrand, fontSize: 11, fontWeight: "700" },
  section: { color: COLORS.onSurface, fontSize: 18, marginTop: SPACING.md, fontWeight: "400" },
  poolRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4 },
  poolName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  poolMeta: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  poolWeight: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "600", minWidth: 36, textAlign: "right" },
});
