import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HEROES } from "@/src/game/content";
import { getHeroSprite } from "@/src/components/HeroSprites";
import { usePlayer } from "@/src/game/store";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

function Stars({ rarity, color }: { rarity: number; color?: string }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {Array.from({ length: rarity }).map((_, i) => (
        <Ionicons key={i} name="star" size={11} color={color || COLORS.brand} style={{ marginRight: 1 }} />
      ))}
    </View>
  );
}

export default function HeroesScreen() {
  const router = useRouter();
  const { player, saveActiveTeam } = usePlayer();
  const [team, setTeam] = useState<string[]>(player?.active_team || []);

  useEffect(() => {
    if (player) setTeam(player.active_team || []);
  }, [player]);

  if (!player) return null;
  const owned = new Set(player.heroes_owned);
  const ownedHeroes = HEROES.filter(h => owned.has(h.id));

  const toggleTeam = async (heroId: string) => {
    if (!owned.has(heroId)) return;
    const inTeam = team.includes(heroId);
    let next = inTeam ? team.filter(id => id !== heroId) : team.length < 3 ? [...team, heroId] : team;
    if (!inTeam && team.length >= 3) return; // max 3
    if (next.length === 0 && ownedHeroes.length > 0) return; // min 1
    setTeam(next);
    await saveActiveTeam(next);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>HALL OF HEROES</Text>
            <Text style={styles.title}>Your Healers</Text>
            <Text style={styles.sub}>{player.heroes_owned.length} of {HEROES.length} recruited · {team.length}/3 in active team</Text>
          </View>
          <Pressable style={styles.summonBtn} onPress={() => router.push("/summon")} testID="heroes-summon-button">
            <Ionicons name="diamond" size={14} color={COLORS.brand} />
            <Text style={styles.summonTxt}>{player.codex_shards || 0}</Text>
            <Text style={styles.summonLbl}>SUMMON</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.helperText}>Tap an owned hero to add or remove from your battle team (max 3).</Text>
        {HEROES.map((h) => {
          const isOwned = owned.has(h.id);
          const elementColor = ELEMENT_COLORS[h.element];
          const inTeam = team.includes(h.id);
          return (
            <Pressable
              key={h.id}
              style={[styles.card, !isOwned && { opacity: 0.45 }, { borderLeftColor: elementColor }, inTeam && { borderColor: COLORS.brand, backgroundColor: COLORS.brand + "10" }]}
              onPress={() => toggleTeam(h.id)}
              disabled={!isOwned}
              testID={`hero-card-${h.id}`}
            >
              <View style={styles.cardHead}>
                {getHeroSprite(h.id) && (
                  <Image source={getHeroSprite(h.id)!} style={styles.heroSprite} resizeMode="cover" />
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.heroName}>{h.name}</Text>
                    {inTeam && (
                      <View style={styles.teamBadge}>
                        <Ionicons name="checkmark" size={10} color={COLORS.onBrand} />
                        <Text style={styles.teamBadgeTxt}>TEAM</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.heroTitle}>{h.title}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Stars rarity={h.rarity} />
                  <Text style={[styles.role, { color: elementColor }]}>{h.role.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.desc}>{h.description}</Text>
              <View style={styles.skillList}>
                {h.skills.map((s) => (
                  <View key={s.id} style={styles.skill}>
                    <View style={styles.skillHead}>
                      <Text style={styles.skillName}>{s.name}</Text>
                      <View style={styles.cost}><Text style={styles.costTxt}>{s.cost} AP</Text></View>
                    </View>
                    <Text style={styles.skillDesc}>{s.description}</Text>
                  </View>
                ))}
              </View>
              {!isOwned && (
                <View style={styles.lockedTag}>
                  <Ionicons name="lock-closed" size={12} color={COLORS.onSurfaceTertiary} />
                  <Text style={styles.lockedTxt}>Not recruited — summon in the Summon Hall</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: { padding: SPACING.lg, gap: 4 },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 28, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  summonBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.brand + "14", borderColor: COLORS.brand + "60", borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  summonTxt: { color: COLORS.brand, fontSize: 14, fontWeight: "700" },
  summonLbl: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  scroll: { padding: SPACING.lg, paddingTop: 0, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  helperText: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginBottom: SPACING.sm, fontStyle: "italic" },
  card: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, gap: SPACING.sm },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.md },
  heroSprite: { width: 72, height: 92, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  heroName: { color: COLORS.onSurface, fontSize: 18, fontWeight: "500" },
  teamBadge: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: COLORS.brand, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.pill },
  teamBadgeTxt: { color: COLORS.onBrand, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  heroTitle: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  role: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  desc: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18, fontStyle: "italic" },
  skillList: { gap: SPACING.sm, marginTop: 4 },
  skill: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm, padding: SPACING.sm },
  skillHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  skillName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  cost: { backgroundColor: COLORS.brandTertiary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill },
  costTxt: { color: COLORS.brand, fontSize: 10, fontWeight: "700" },
  skillDesc: { color: COLORS.onSurfaceSecondary, fontSize: 12, marginTop: 4, lineHeight: 16 },
  lockedTag: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  lockedTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
});
