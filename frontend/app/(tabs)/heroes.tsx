import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HEROES } from "@/src/game/content";
import { getHeroBattleSprite } from "@/src/components/HeroBattleSprites";
import { usePlayer } from "@/src/game/store";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

function Stars({ rarity, color }: { rarity: number; color?: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {Array.from({ length: rarity }).map((_, i) => (
        <Ionicons key={i} name="star" size={9} color={color || COLORS.brand} />
      ))}
    </View>
  );
}

export default function HeroesScreen() {
  const router = useRouter();
  const { player, saveActiveTeam } = usePlayer();
  const [team, setTeam] = useState<string[]>(player?.active_team || []);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (player) setTeam(player.active_team || []);
  }, [player]);

  if (!player) return null;
  const owned = new Set(player.heroes_owned);

  const toggleTeam = async (heroId: string) => {
    if (!owned.has(heroId)) return;
    const inTeam = team.includes(heroId);
    if (!inTeam && team.length >= 3) return;
    if (inTeam && team.length <= 1) return;
    const next = inTeam ? team.filter((id) => id !== heroId) : [...team, heroId];
    setTeam(next);
    await saveActiveTeam(next);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>HALL OF HEROES</Text>
          <Text style={styles.title}>Your Healers</Text>
          <Text style={styles.sub}>
            {player.heroes_owned.length}/{HEROES.length} recruited · {team.length}/3 active
          </Text>
        </View>
        <Pressable style={styles.summonBtn} onPress={() => router.push("/summon")} testID="heroes-summon-button">
          <Ionicons name="diamond" size={14} color={COLORS.brand} />
          <Text style={styles.summonTxt}>{player.codex_shards || 0}</Text>
          <Text style={styles.summonLbl}>SUMMON</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Roster grid */}
        <View style={styles.roster}>
          {HEROES.map((h) => {
            const isOwned = owned.has(h.id);
            const inTeam = team.includes(h.id);
            const isExpanded = expanded === h.id;
            const accent = ELEMENT_COLORS[h.element] ?? COLORS.brand;
            const battleSprite = getHeroBattleSprite(h.id);
            const teamSlot = team.indexOf(h.id) + 1;

            return (
              <Pressable
                key={h.id}
                style={styles.unitCardWrap}
                onPress={() => {
                  if (!isOwned) return;
                  setExpanded(isExpanded ? null : h.id);
                }}
                testID={`hero-card-${h.id}`}
              >
                <View style={[
                  styles.unitCard,
                  { borderColor: inTeam ? accent : COLORS.border },
                  !isOwned && styles.unitLocked,
                  inTeam && { backgroundColor: accent + "14" },
                ]}>
                  {/* Chibi battle sprite */}
                  <View style={[styles.spriteWrap, { backgroundColor: accent + "18" }]}>
                    {battleSprite ? (
                      <Image
                        source={battleSprite}
                        style={styles.sprite}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.spritePlaceholder} />
                    )}
                    {/* Team slot badge */}
                    {inTeam && (
                      <View style={[styles.teamSlot, { backgroundColor: accent }]}>
                        <Text style={styles.teamSlotTxt}>{teamSlot}</Text>
                      </View>
                    )}
                    {/* Lock overlay */}
                    {!isOwned && (
                      <View style={styles.lockOverlay}>
                        <Ionicons name="lock-closed" size={18} color={COLORS.onSurfaceTertiary} />
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={styles.unitInfo}>
                    <Stars rarity={h.rarity} color={accent} />
                    <Text style={[styles.unitName, !isOwned && { color: COLORS.onSurfaceTertiary }]} numberOfLines={1}>
                      {h.name}
                    </Text>
                    <View style={[styles.elementTag, { borderColor: accent + "80" }]}>
                      <Text style={[styles.elementTxt, { color: accent }]}>
                        {h.element.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.roleTag}>{h.role}</Text>
                  </View>

                  {/* Active team toggle button */}
                  {isOwned && (
                    <Pressable
                      style={[
                        styles.toggleBtn,
                        inTeam
                          ? { backgroundColor: accent, borderColor: accent }
                          : { borderColor: accent + "60" },
                      ]}
                      onPress={() => toggleTeam(h.id)}
                      hitSlop={6}
                      testID={`hero-toggle-${h.id}`}
                    >
                      <Ionicons
                        name={inTeam ? "checkmark" : "add"}
                        size={13}
                        color={inTeam ? COLORS.surface : accent}
                      />
                    </Pressable>
                  )}
                </View>

                {/* Expanded detail panel */}
                {isExpanded && isOwned && (
                  <View style={[styles.detailPanel, { borderColor: accent + "40" }]}>
                    <Text style={[styles.detailQuote, { color: accent + "CC" }]}>
                      {(h as any).quote ?? `"${h.description}"`}
                    </Text>
                    <Text style={styles.detailDesc}>{h.description}</Text>
                    <View style={styles.skillsBlock}>
                      {h.skills.map((s) => (
                        <View key={s.id} style={styles.skillRow}>
                          <View style={styles.skillLeft}>
                            <Text style={styles.skillName}>{s.name}</Text>
                            <Text style={styles.skillDesc} numberOfLines={2}>{s.description}</Text>
                          </View>
                          <View style={[styles.apBadge, { backgroundColor: COLORS.brandTertiary }]}>
                            <Text style={styles.apTxt}>{s.cost}AP</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: "row", alignItems: "flex-start",
    padding: SPACING.lg, gap: SPACING.md,
  },
  kicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 26, fontWeight: "300", marginTop: 2 },
  sub: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  summonBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.brand + "14", borderColor: COLORS.brand + "60",
    borderWidth: 1, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  summonTxt: { color: COLORS.brand, fontSize: 14, fontWeight: "700" },
  summonLbl: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },

  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxxl },
  roster: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },

  unitCardWrap: { width: "47%" },

  unitCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg, borderWidth: 2,
    overflow: "hidden",
  },
  unitLocked: { opacity: 0.5 },

  spriteWrap: {
    width: "100%", aspectRatio: 1,
    alignItems: "center", justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  sprite: { width: "95%", height: "95%" },
  spritePlaceholder: { width: "80%", height: "80%", backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md },
  teamSlot: {
    position: "absolute", top: 6, left: 6,
    width: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  teamSlotTxt: { color: COLORS.surface, fontSize: 11, fontWeight: "700" },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12,14,18,0.55)",
    alignItems: "center", justifyContent: "center",
  },

  unitInfo: { padding: SPACING.sm, paddingTop: SPACING.xs, gap: 3 },
  unitName: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  elementTag: {
    alignSelf: "flex-start", borderWidth: 1,
    borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 1,
  },
  elementTxt: { fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  roleTag: { color: COLORS.onSurfaceTertiary, fontSize: 10 },

  toggleBtn: {
    position: "absolute", top: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
  },

  detailPanel: {
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.md, borderWidth: 1,
    padding: SPACING.md, marginTop: 2, gap: SPACING.sm,
  },
  detailQuote: { fontSize: 12, fontStyle: "italic", lineHeight: 18 },
  detailDesc: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },
  skillsBlock: { gap: SPACING.xs },
  skillRow: {
    flexDirection: "row", alignItems: "flex-start",
    gap: SPACING.sm, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm, padding: SPACING.sm,
  },
  skillLeft: { flex: 1, gap: 2 },
  skillName: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  skillDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15 },
  apBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.pill },
  apTxt: { color: COLORS.brand, fontSize: 10, fontWeight: "700" },
});
