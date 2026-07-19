import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ROUTES } from "@/src/game/routes";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HEROES } from "@/src/game/content";
import { getHeroBattleSprite } from "@/src/components/HeroBattleSprites";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { FeatureLockedView, useFeatureGate } from "@/src/components/FeatureGate";
import { RPGTabBar, RPGTab } from "@/src/components/RPGTabBar";
import { SummoningEmblem, HeroesEmblem, WardDefenseEmblem, UniversityEmblem } from "@/src/components/ClinicaEmblems";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { canEvolve, getProgress } from "@/src/game/evolution";
import { rarityTierLabel } from "@/src/game/university";
import { findSkin } from "@/src/game/shop";
import { ROUTES } from "@/src/game/routes";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";

const TABS: RPGTab[] = [
  { key: "roster",  label: "Roster",  emblem: (a) => <HeroesEmblem      size={14} color={a ? "#1B1308" : "#E8C868"} /> },
  { key: "team",    label: "Team",    emblem: (a) => <WardDefenseEmblem  size={14} color={a ? "#1B1308" : "#E8C868"} /> },
  { key: "recruit", label: "Recruit", emblem: (a) => <SummoningEmblem   size={14} color={a ? "#1B1308" : "#E8C868"} /> },
  { key: "upgrade", label: "Upgrade", emblem: (a) => <UniversityEmblem  size={14} color={a ? "#1B1308" : "#E8C868"} /> },
];

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
  const [activeTab, setActiveTab] = useState("roster");

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

  const ownedHeroes = HEROES.filter((h) => owned.has(h.id));
  const teamHeroes  = HEROES.filter((h) => team.includes(h.id));

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <PlayerHeader player={player} />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>HALL OF HEROES</Text>
          <Text style={styles.title}>Your Healers</Text>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statPill}>
            <Ionicons name="people" size={13} color={COLORS.brand} />
            <Text style={styles.statTxt}>{player.heroes_owned.length}/{HEROES.length}</Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="shield-half" size={13} color={COLORS.brand} />
            <Text style={styles.statTxt}>{team.length}/3</Text>
          </View>
        </View>
      </View>

      <RPGTabBar tabs={TABS} activeTab={activeTab} onTabPress={setActiveTab} />

      {/* ── ROSTER ── */}
      {activeTab === "roster" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {player.heroes_owned.length === 0 && (
            <Pressable
              style={styles.emptyBanner}
              onPress={() => router.push(ROUTES.universityRecruit)}
              testID="heroes-empty-recruit-btn"
            >
              <Ionicons name="school" size={22} color={COLORS.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyTitle}>No healers yet</Text>
                <Text style={styles.emptyTxt}>Recruit from Clinica University to build your team.</Text>
              </View>
              <View style={styles.emptyBtn}>
                <Text style={styles.emptyBtnTxt}>RECRUIT</Text>
              </View>
            </Pressable>
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
                  onPress={() => { if (isOwned) router.push(`/hero/${h.id}`); }}
                  testID={`hero-card-${h.id}`}
                >
                  <View style={[
                    styles.card,
                    { borderColor: evolveReady ? COLORS.brand : inTeam ? accent : COLORS.border },
                    inTeam && { backgroundColor: accent + "10" },
                    isOwned && equippedSkin && { borderColor: equippedSkin.accentColor },
                    !isOwned && styles.cardLocked,
                  ]}>
                    <View style={[styles.spriteBox, { backgroundColor: accent + "15" },
                      isOwned && equippedSkin && { backgroundColor: equippedSkin.auraColor + "22" }]}>
                      {isOwned && equippedSkin && (
                        <View style={[styles.skinAura, { backgroundColor: equippedSkin.auraColor + "44" }]} pointerEvents="none" />
                      )}
                      {sprite ? (
                        <Image source={sprite} style={styles.sprite} contentFit="contain" contentPosition="center" />
                      ) : (
                        <View style={styles.spriteFallback} />
                      )}
                      {inTeam && (
                        <View style={[styles.slotBadge, { backgroundColor: accent }]}>
                          <Text style={styles.slotTxt}>{teamSlot}</Text>
                        </View>
                      )}
                      {isOwned && (
                        <View style={styles.starBadge}>
                          <Ionicons name="star" size={9} color={COLORS.brand} />
                          <Text style={styles.starBadgeTxt}>{prog.star}</Text>
                        </View>
                      )}
                      {evolveReady && (
                        <View style={styles.evolveBadge}>
                          <Ionicons name="arrow-up-circle" size={16} color={COLORS.surface} />
                        </View>
                      )}
                      {!isOwned && (
                        <View style={styles.lockOverlay}>
                          <Ionicons name="lock-closed" size={20} color={COLORS.onSurfaceTertiary} />
                          <Text style={styles.lockTxt}>Locked</Text>
                        </View>
                      )}
                      {isOwned && (
                        <View style={styles.viewHint}>
                          <Ionicons name="chevron-forward" size={10} color={accent + "BB"} />
                        </View>
                      )}
                    </View>
                    <View style={styles.infoRow}>
                      <View style={{ flex: 1 }}>
                        <TierBadge rarity={h.rarity} color={accent} />
                        <Text style={[styles.heroName, !isOwned && { color: COLORS.onSurfaceTertiary }]} numberOfLines={1}>{h.name}</Text>
                        <View style={[styles.elementTag, { borderColor: accent + "70" }]}>
                          <Text style={[styles.elementTxt, { color: accent }]}>{h.element.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.roleTag}>{h.role}</Text>
                      </View>
                      {isOwned && (
                        <Pressable
                          style={[styles.toggleBtn,
                            inTeam ? { backgroundColor: accent, borderColor: accent }
                                   : { borderColor: accent + "55", backgroundColor: "transparent" }]}
                          onPress={(e) => { e.stopPropagation?.(); toggleTeam(h.id); }}
                          hitSlop={8}
                          testID={`hero-toggle-${h.id}`}
                        >
                          <Ionicons name={inTeam ? "checkmark" : "add"} size={14}
                            color={inTeam ? COLORS.surface : accent} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ── TEAM ── */}
      {activeTab === "team" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLbl}>Active Team · {team.length}/3 Healers</Text>
          {team.length === 0 && (
            <View style={styles.teamEmptyCard}>
              <Ionicons name="shield-outline" size={32} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.teamEmptyTxt}>No active team yet. Add healers from the Roster tab.</Text>
            </View>
          )}
          {teamHeroes.map((h, i) => {
            const accent = ELEMENT_COLORS[h.element] ?? COLORS.brand;
            const sprite = getHeroBattleSprite(h.id);
            const prog   = getProgress(player.hero_progression, h.id);
            return (
              <Pressable key={h.id} style={[styles.teamCard, { borderLeftColor: accent }]}
                onPress={() => router.push(`/hero/${h.id}`)}>
                <View style={[styles.teamSprite, { backgroundColor: accent + "18" }]}>
                  {sprite ? (
                    <Image source={sprite} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                  ) : (
                    <Text style={{ fontSize: 24 }}>⚕</Text>
                  )}
                  <View style={[styles.slotBadge, { backgroundColor: accent, top: 2, left: 2 }]}>
                    <Text style={styles.slotTxt}>{i + 1}</Text>
                  </View>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <TierBadge rarity={h.rarity} color={accent} />
                  <Text style={styles.teamHeroName}>{h.name}</Text>
                  <Text style={styles.teamHeroRole}>{h.role} · {h.element}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="star" size={11} color={COLORS.brand} />
                    <Text style={styles.teamStat}>★{prog.star} · Lv {prog.level}</Text>
                  </View>
                </View>
                <Pressable style={[styles.toggleBtn, { borderColor: accent + "55", backgroundColor: "transparent" }]}
                  onPress={() => toggleTeam(h.id)} hitSlop={8}>
                  <Ionicons name="remove" size={14} color={accent} />
                </Pressable>
              </Pressable>
            );
          })}
          {team.length < 3 && (
            <Pressable style={styles.addSlotBtn} onPress={() => setActiveTab("roster")}>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.brand} />
              <Text style={styles.addSlotTxt}>Add {3 - team.length} more healer{3 - team.length > 1 ? "s" : ""} from Roster</Text>
            </Pressable>
          )}
          <Text style={styles.sectionLbl} style={{ marginTop: SPACING.lg }}>Team Tips</Text>
          <View style={styles.tipCard}>
            <Text style={styles.tipTxt}>⚕ Your team's element composition affects Ward Shift synergies.</Text>
          </View>
          <View style={styles.tipCard}>
            <Text style={styles.tipTxt}>📖 Tap any team member to view stats, skills, and evolution.</Text>
          </View>
        </ScrollView>
      )}

      {/* ── RECRUIT ── */}
      {activeTab === "recruit" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLbl}>Recruitment Hall</Text>
          <Pressable style={styles.recruitBanner}
            onPress={() => router.push(ROUTES.universityRecruit)} testID="heroes-recruit-tab-btn">
            <View style={styles.recruitIcon}>
              <Ionicons name="school" size={28} color={COLORS.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recruitTitle}>Clinica University</Text>
              <Text style={styles.recruitSub}>Summon new healers through the Recruitment Hall.</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={COLORS.brand} />
          </Pressable>

          <Text style={styles.sectionLbl} style={{ marginTop: SPACING.lg }}>All Healers</Text>
          {HEROES.map((h) => {
            const isOwned = owned.has(h.id);
            const accent  = ELEMENT_COLORS[h.element] ?? COLORS.brand;
            return (
              <View key={h.id} style={[styles.rosterRow, { borderLeftColor: accent, opacity: isOwned ? 1 : 0.5 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rosterName, { color: isOwned ? COLORS.onSurface : COLORS.onSurfaceTertiary }]}>{h.name}</Text>
                  <Text style={styles.rosterMeta}>{h.role} · {h.element}</Text>
                </View>
                {isOwned ? (
                  <View style={[styles.ownedPill, { borderColor: accent + "60" }]}>
                    <Ionicons name="checkmark-circle" size={12} color={accent} />
                    <Text style={[styles.ownedTxt, { color: accent }]}>Owned</Text>
                  </View>
                ) : (
                  <View style={styles.lockedPill}>
                    <Ionicons name="lock-closed" size={11} color={COLORS.onSurfaceTertiary} />
                    <Text style={styles.lockedPillTxt}>Recruit</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── UPGRADE ── */}
      {activeTab === "upgrade" && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLbl}>Power Up Your Team</Text>

          <Pressable style={styles.upgradeLinkCard} onPress={() => router.push(ROUTES.UNI_SKILL_ACADEMY)}>
            <View style={[styles.upgradeIconBox, { backgroundColor: COLORS.mind + "22" }]}>
              <Ionicons name="flash" size={22} color={COLORS.mind} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.upgradeLinkTitle}>Skill Academy</Text>
              <Text style={styles.upgradeLinkSub}>Upgrade hero skills to boost combat effectiveness.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.onSurfaceTertiary} />
          </Pressable>

          <Pressable style={styles.upgradeLinkCard} onPress={() => router.push(ROUTES.UNI_TRAINING)}>
            <View style={[styles.upgradeIconBox, { backgroundColor: COLORS.fire + "22" }]}>
              <Ionicons name="fitness" size={22} color={COLORS.fire} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.upgradeLinkTitle}>Training Hall</Text>
              <Text style={styles.upgradeLinkSub}>Earn hero XP and raise individual hero levels.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.onSurfaceTertiary} />
          </Pressable>

          <Text style={styles.sectionLbl} style={{ marginTop: SPACING.lg }}>Evolution-Ready</Text>
          {ownedHeroes.filter((h) => canEvolve(getProgress(player.hero_progression, h.id))).length === 0 && (
            <View style={styles.tipCard}>
              <Text style={styles.tipTxt}>No heroes ready for evolution yet. Earn duplicate summons to evolve.</Text>
            </View>
          )}
          {ownedHeroes
            .filter((h) => canEvolve(getProgress(player.hero_progression, h.id)))
            .map((h) => {
              const accent = ELEMENT_COLORS[h.element] ?? COLORS.brand;
              return (
                <Pressable key={h.id} style={[styles.rosterRow, { borderLeftColor: accent }]}
                  onPress={() => router.push(`/hero/${h.id}`)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rosterName}>{h.name}</Text>
                    <Text style={styles.rosterMeta}>{h.role} · {h.element}</Text>
                  </View>
                  <View style={[styles.ownedPill, { borderColor: COLORS.brand + "60", backgroundColor: COLORS.brand + "18" }]}>
                    <Ionicons name="arrow-up-circle" size={12} color={COLORS.brand} />
                    <Text style={[styles.ownedTxt, { color: COLORS.brand }]}>Evolve</Text>
                  </View>
                </Pressable>
              );
            })}
        </ScrollView>
      )}

      <TutorialOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: UI.bgBase },
  loading: { alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  kicker: { color: COLORS.brand, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  title:  { color: COLORS.onSurface, fontSize: 26, fontWeight: "700", marginTop: 2 },
  statRow: { flexDirection: "row", gap: 6 },
  statPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.brand + "15", borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.brand + "35",
  },
  statTxt: { color: COLORS.brand, fontSize: 12, fontWeight: "700" },

  scroll: { padding: SPACING.md, paddingBottom: 120 },
  grid:   { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },

  sectionLbl: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: SPACING.sm },

  emptyBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.brand + "50", borderRadius: RADIUS.md,
    backgroundColor: COLORS.brand + "12", padding: SPACING.md, marginBottom: SPACING.md,
  },
  emptyTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: "700" },
  emptyTxt:   { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19, marginTop: 2 },
  emptyBtn:   { borderRadius: RADIUS.pill, backgroundColor: COLORS.brand, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  emptyBtnTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },

  cardWrap: { width: "47.5%" },
  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg, borderWidth: 2, overflow: "hidden",
  },
  cardLocked: { opacity: 0.45 },
  spriteBox: {
    width: "100%", aspectRatio: 1,
    alignItems: "center", justifyContent: "center",
    position: "relative", overflow: "hidden",
  },
  skinAura:     { position: "absolute", width: "70%", aspectRatio: 1, borderRadius: 999, top: "12%", opacity: 0.9 },
  sprite:        { width: "92%", height: "92%" },
  spriteFallback: { width: "70%", height: "70%", backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md },
  slotBadge: {
    position: "absolute", top: 6, left: 6,
    width: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  slotTxt: { color: COLORS.surface, fontSize: 12, fontWeight: "700" },
  starBadge: {
    position: "absolute", top: 6, right: 6,
    flexDirection: "row", alignItems: "center", gap: 1,
    backgroundColor: "rgba(12,14,18,0.72)", borderRadius: RADIUS.pill,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  starBadgeTxt: { color: COLORS.brand, fontSize: 12, fontWeight: "800" },
  tierBadge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 1, marginBottom: 2 },
  tierBadgeTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  evolveBadge: {
    position: "absolute", bottom: 6, left: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center",
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12,14,18,0.6)", alignItems: "center", justifyContent: "center", gap: 4,
  },
  lockTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 0.2 },
  viewHint: {
    position: "absolute", bottom: 4, right: 4,
    backgroundColor: "rgba(12,14,18,0.5)", borderRadius: RADIUS.pill,
    width: 18, height: 18, alignItems: "center", justifyContent: "center",
  },
  infoRow:  { flexDirection: "row", alignItems: "flex-end", padding: SPACING.sm, paddingTop: SPACING.xs, gap: SPACING.xs },
  heroName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600", marginTop: 2 },
  elementTag: { alignSelf: "flex-start", borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 1, marginTop: 2 },
  elementTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  roleTag:    { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 1 },
  toggleBtn: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center", marginBottom: 2 },

  // Team tab
  teamCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    borderLeftWidth: 3, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  teamSprite: {
    width: 60, height: 60, borderRadius: RADIUS.md,
    alignItems: "center", justifyContent: "center",
    position: "relative", overflow: "hidden",
  },
  teamHeroName: { color: COLORS.onSurface, fontSize: 15, fontWeight: "700" },
  teamHeroRole: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 1 },
  teamStat:     { color: COLORS.brand, fontSize: 12, fontWeight: "700" },
  teamEmptyCard: {
    alignItems: "center", gap: SPACING.sm, padding: SPACING.xl,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed",
  },
  teamEmptyTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13, textAlign: "center", lineHeight: 20 },
  addSlotBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    justifyContent: "center", padding: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.brand + "50",
    borderStyle: "dashed", backgroundColor: COLORS.brand + "08", marginTop: SPACING.sm,
  },
  addSlotTxt: { color: COLORS.brand, fontSize: 14, fontWeight: "700" },
  tipCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.xs,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tipTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20 },

  // Recruit tab
  recruitBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.brand + "15", borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.brand + "50", padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  recruitIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.brand + "22", alignItems: "center", justifyContent: "center",
  },
  recruitTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: "700" },
  recruitSub:   { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19, marginTop: 2 },
  rosterRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
    borderLeftWidth: 3, padding: SPACING.md, marginBottom: 6,
  },
  rosterName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  rosterMeta: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 1 },
  ownedPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 4,
  },
  ownedTxt:   { fontSize: 12, fontWeight: "700" },
  lockedPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 4, backgroundColor: COLORS.surfaceTertiary,
  },
  lockedPillTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },

  // Upgrade tab
  upgradeLinkCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  upgradeIconBox: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  upgradeLinkTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: "700" },
  upgradeLinkSub:   { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19, marginTop: 2 },
});
