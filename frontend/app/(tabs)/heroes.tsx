import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HEROES } from "@/src/game/content";
import { getHeroBattleSprite } from "@/src/components/HeroBattleSprites";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { FeatureLockedView, useFeatureGate } from "@/src/components/FeatureGate";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { canEvolve, getProgress } from "@/src/game/evolution";
import { rarityTierLabel } from "@/src/game/university";
import { findSkin } from "@/src/game/shop";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

function Stars({ count, color }: { count: number; color: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Ionicons key={i} name="star" size={9} color={color} />
      ))}
    </View>
  );
}

// Quality tier badge — rarity is a base-pool weight (3-7), never rendered as
// stars (Certification Stars are the only stars in the game).
function TierBadge({ rarity, color }: { rarity: number; color: string }) {
  return (
    <View style={[styles.tierBadge, { borderColor: color + "70" }]}>
      <Text style={[styles.tierBadgeTxt, { color }]}>{rarityTierLabel(rarity)}</Text>
    </View>
  );
}

export default function HeroesScreen() {
  const router = useRouter();
  const { player, saveActiveTeam } = usePlayer();
  const gate = useFeatureGate("hall_of_heroes");
  const { isCompleted, startTutorial, onRequiredAction } = useTutorial();
  const [team, setTeam] = useState<string[]>(player?.active_team ?? []);

  // Leaving mid-tutorial must never leak the overlay onto the next screen.
  useClearTutorialOnExit();

  useEffect(() => {
    if (player) setTeam(player.active_team ?? []);
  }, [player]);

  useEffect(() => {
    if (!isCompleted("firstHeroTeam")) {
      const t = setTimeout(() => startTutorial("firstHeroTeam"), 600);
      return () => clearTimeout(t);
    }
  }, []);

  if (!player) {
    return (
      <SafeAreaView style={[styles.root, styles.loading]} edges={["top"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }
  // Block direct navigation (deep links / in-app links) into a still-locked
  // Hall of Heroes — the tab bar hides the button, but the route stays alive.
  if (!gate.unlocked) return <FeatureLockedView title="The Hall of Heroes" reason={gate.reason} />;

  const owned = new Set(player.heroes_owned);
  const equippedSkin = findSkin(player.equipped_skin || "");

  const toggleTeam = async (heroId: string) => {
    if (!owned.has(heroId)) return;
    const inTeam = team.includes(heroId);
    if (!inTeam && team.length >= 3) return;
    if (inTeam && team.length <= 1) return;
    const next = inTeam ? team.filter((id) => id !== heroId) : [...team, heroId];
    setTeam(next);
    await saveActiveTeam(next);
    onRequiredAction("setTeam");
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <PlayerHeader player={player} />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Text style={styles.kicker}>HALL OF HEROES</Text>
        <Text style={styles.title}>Your Healers</Text>
        <Text style={styles.sub}>
          {player.heroes_owned.length}/{HEROES.length} recruited · {team.length}/3 active
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {player.heroes_owned.length === 0 && (
          <View style={styles.emptyBanner} testID="heroes-empty-state">
            <Ionicons name="school" size={26} color={COLORS.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>No healers on your roster yet</Text>
              <Text style={styles.emptyTxt}>
                Every hero joins your ward through University Recruitment. Enroll your first healer to build your team.
              </Text>
            </View>
            <Pressable style={styles.emptyBtn} onPress={() => router.push("/university/recruit")} testID="heroes-empty-recruit-btn">
              <Text style={styles.emptyBtnTxt}>RECRUIT</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.grid}>
          {HEROES.map((h) => {
            const isOwned  = owned.has(h.id);
            const inTeam   = team.includes(h.id);
            const accent   = ELEMENT_COLORS[h.element] ?? COLORS.brand;
            const sprite   = getHeroBattleSprite(h.id);
            const teamSlot = team.indexOf(h.id) + 1;
            const prog     = getProgress(player.hero_progression, h.id);
            const evolveReady = isOwned && canEvolve(prog);

            return (
              <Pressable
                key={h.id}
                style={styles.cardWrap}
                onPress={() => {
                  if (isOwned) router.push(`/hero/${h.id}`);
                }}
                testID={`hero-card-${h.id}`}
              >
                <View style={[
                  styles.card,
                  { borderColor: evolveReady ? COLORS.brand : inTeam ? accent : COLORS.border },
                  inTeam && { backgroundColor: accent + "10" },
                  isOwned && equippedSkin && { borderColor: equippedSkin.accentColor },
                  !isOwned && styles.cardLocked,
                ]}>

                  {/* Sprite area */}
                  <View style={[
                    styles.spriteBox,
                    { backgroundColor: accent + "15" },
                    isOwned && equippedSkin && { backgroundColor: equippedSkin.auraColor + "22" },
                  ]}>
                    {isOwned && equippedSkin && (
                      <View style={[styles.skinAura, { backgroundColor: equippedSkin.auraColor + "44" }]} pointerEvents="none" />
                    )}
                    {sprite ? (
                      <Image
                        source={sprite}
                        style={styles.sprite}
                        contentFit="contain"
                        contentPosition="center"
                      />
                    ) : (
                      <View style={styles.spriteFallback} />
                    )}

                    {/* Team slot badge */}
                    {inTeam && (
                      <View style={[styles.slotBadge, { backgroundColor: accent }]}>
                        <Text style={styles.slotTxt}>{teamSlot}</Text>
                      </View>
                    )}

                    {/* Evolution star badge */}
                    {isOwned && (
                      <View style={styles.starBadge}>
                        <Ionicons name="star" size={9} color={COLORS.brand} />
                        <Text style={styles.starBadgeTxt}>{prog.star}</Text>
                      </View>
                    )}

                    {/* Evolve-ready indicator */}
                    {evolveReady && (
                      <View style={styles.evolveBadge}>
                        <Ionicons name="arrow-up-circle" size={16} color={COLORS.surface} />
                      </View>
                    )}

                    {/* Lock overlay */}
                    {!isOwned && (
                      <View style={styles.lockOverlay}>
                        <Ionicons name="lock-closed" size={20} color={COLORS.onSurfaceTertiary} />
                        <Text style={styles.lockTxt}>Locked</Text>
                      </View>
                    )}

                    {/* Tap-to-view hint for owned heroes */}
                    {isOwned && (
                      <View style={styles.viewHint}>
                        <Ionicons name="chevron-forward" size={10} color={accent + "BB"} />
                      </View>
                    )}
                  </View>

                  {/* Info row */}
                  <View style={styles.infoRow}>
                    <View style={{ flex: 1 }}>
                      <TierBadge rarity={h.rarity} color={accent} />
                      <Text style={[styles.heroName, !isOwned && { color: COLORS.onSurfaceTertiary }]} numberOfLines={1}>
                        {h.name}
                      </Text>
                      <View style={[styles.elementTag, { borderColor: accent + "70" }]}>
                        <Text style={[styles.elementTxt, { color: accent }]}>{h.element.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.roleTag}>{h.role}</Text>
                    </View>

                    {/* Active team toggle */}
                    {isOwned && (
                      <Pressable
                        style={[
                          styles.toggleBtn,
                          inTeam
                            ? { backgroundColor: accent, borderColor: accent }
                            : { borderColor: accent + "55", backgroundColor: "transparent" },
                        ]}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          toggleTeam(h.id);
                        }}
                        hitSlop={8}
                        testID={`hero-toggle-${h.id}`}
                      >
                        <Ionicons
                          name={inTeam ? "checkmark" : "add"}
                          size={14}
                          color={inTeam ? COLORS.surface : accent}
                        />
                      </Pressable>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <TutorialOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },

  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  kicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title:  { color: COLORS.onSurface, fontSize: 26, fontWeight: "300", marginTop: 2 },
  sub:    { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 2 },

  scroll: { padding: SPACING.md, paddingBottom: 120 },
  grid:   { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },

  emptyBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.brand + "50", borderRadius: RADIUS.md,
    backgroundColor: COLORS.brand + "12", padding: SPACING.md, marginBottom: SPACING.md,
  },
  emptyTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700" },
  emptyTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  emptyBtn: {
    borderRadius: RADIUS.pill, backgroundColor: COLORS.brand,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  emptyBtnTxt: { color: COLORS.onBrand, fontSize: 10, fontWeight: "800", letterSpacing: 1 },

  cardWrap: { width: "47.5%" },

  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    overflow: "hidden",
  },
  cardLocked: { opacity: 0.45 },

  spriteBox: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  skinAura: {
    position: "absolute",
    width: "70%",
    aspectRatio: 1,
    borderRadius: 999,
    top: "12%",
    opacity: 0.9,
  },
  sprite:        { width: "92%", height: "92%" },
  spriteFallback: { width: "70%", height: "70%", backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md },

  slotBadge: {
    position: "absolute", top: 6, left: 6,
    width: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  slotTxt: { color: COLORS.surface, fontSize: 11, fontWeight: "700" },

  starBadge: {
    position: "absolute", top: 6, right: 6,
    flexDirection: "row", alignItems: "center", gap: 1,
    backgroundColor: "rgba(12,14,18,0.72)",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  starBadgeTxt: { color: COLORS.brand, fontSize: 10, fontWeight: "800" },
  tierBadge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 1, marginBottom: 2 },
  tierBadgeTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  evolveBadge: {
    position: "absolute", bottom: 6, left: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.brand,
    alignItems: "center", justifyContent: "center",
  },

  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12,14,18,0.6)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  lockTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 0.5 },

  viewHint: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(12,14,18,0.5)",
    borderRadius: RADIUS.pill,
    width: 18, height: 18,
    alignItems: "center", justifyContent: "center",
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: SPACING.sm,
    paddingTop: SPACING.xs,
    gap: SPACING.xs,
  },
  heroName:   { color: COLORS.onSurface, fontSize: 13, fontWeight: "600", marginTop: 2 },
  elementTag: { alignSelf: "flex-start", borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 1, marginTop: 2 },
  elementTxt: { fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  roleTag:    { color: COLORS.onSurfaceTertiary, fontSize: 10, marginTop: 1 },

  toggleBtn: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2,
    alignItems: "center", justifyContent: "center",
    marginBottom: 2,
  },
});
