import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ROUTES } from "@/src/game/routes";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HEROES } from "@/src/game/content";
import { getHeroBattleSprite } from "@/src/components/HeroBattleSprites";
import { getHeroPortrait } from "@/src/components/HeroPortraits";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { FeatureLockedView, useFeatureGate } from "@/src/components/FeatureGate";
import { RPGTabBar, RPGTab } from "@/src/components/RPGTabBar";
import { SummoningEmblem, HeroesEmblem, WardDefenseEmblem, UniversityEmblem } from "@/src/components/ClinicaEmblems";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { canEvolve, getProgress } from "@/src/game/evolution";
import {
  rarityTierLabel, heroClassLabel, heroRoleLabel, isClassChangeStar,
  levelCapForStar, canUseScroll, SCROLL_TIERS,
  playerMaxStar, CLASS_CHANGE_STAR,
} from "@/src/game/university";
import { playerLevelFromXp, heroXpCostForLevel } from "@/src/game/progression";
import { findSkin } from "@/src/game/shop";
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
  const [filterElement, setFilterElement] = useState<string | null>(null);
  const [filterRole,    setFilterRole]    = useState<string | null>(null);

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
  const playerLevel = player.player_level ?? playerLevelFromXp(player.xp ?? 0).level;
  const maxStar = playerMaxStar(playerLevel);
  const inv = player.inventory ?? {};

  const toggleTeam = async (heroId: string) => {
    if (!owned.has(heroId)) return;
    const inTeam = team.includes(heroId);
    if (!inTeam && team.length >= 3) return;
    if (inTeam && team.length <= 1) return;
    const next = inTeam ? team.filter((id) => id !== heroId) : [...team, heroId];
    setTeam(next);
    await saveActiveTeam(next);
    onRequiredAction("setTeam"); // satisfies firstHeroTeam › heroes_set (requiredActionType:"setTeam")
  };

  const ownedHeroes    = HEROES.filter((h) => owned.has(h.id));
  const teamHeroes     = HEROES.filter((h) => team.includes(h.id));
  const regularHeroes  = HEROES.filter((h) => !h.locked);
  const legendaryHeroes = HEROES.filter((h) => h.locked);

  // Unique elements and roles from the regular pool (preserving first-seen order)
  const allElements = Array.from(new Set(regularHeroes.map((h) => h.element)));
  const allRoles    = Array.from(new Set(regularHeroes.map((h) => h.role)));

  // Filtered slice shown in the Roster grid
  const visibleHeroes = regularHeroes.filter((h) =>
    (!filterElement || h.element === filterElement) &&
    (!filterRole    || h.role    === filterRole),
  );

  // Helper: whether hero at `star` with Player Level `pl` can currently promote
  const check_canPromote = (star: number, pl: number) => pl >= star + 1;

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
            <Text style={styles.statTxt}>{player.heroes_owned.length}/{regularHeroes.length}</Text>
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
          {/* ── Filter chips ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
            {allElements.map((el) => {
              const col = ELEMENT_COLORS[el] ?? COLORS.brand;
              const active = filterElement === el;
              return (
                <Pressable key={el}
                  style={[styles.filterChip,
                    active ? { backgroundColor: col, borderColor: col } : { borderColor: col + "55" }]}
                  onPress={() => setFilterElement(active ? null : el)}
                  testID={`filter-element-${el}`}
                >
                  <Text style={[styles.filterChipTxt, { color: active ? COLORS.surface : col }]}>{el}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={[styles.filterRow, { marginTop: 4 }]} contentContainerStyle={styles.filterRowContent}>
            {allRoles.map((role) => {
              const active = filterRole === role;
              return (
                <Pressable key={role}
                  style={[styles.filterChip,
                    active ? { backgroundColor: COLORS.brand, borderColor: COLORS.brand } : { borderColor: COLORS.brand + "40" }]}
                  onPress={() => setFilterRole(active ? null : role)}
                  testID={`filter-role-${role}`}
                >
                  <Text style={[styles.filterChipTxt, { color: active ? COLORS.surface : COLORS.onSurfaceTertiary }]}>{heroRoleLabel(role)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {(filterElement || filterRole) && (
            <Pressable style={styles.clearFilters} onPress={() => { setFilterElement(null); setFilterRole(null); }}
              testID="filter-clear">
              <Ionicons name="close-circle" size={12} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.clearFiltersTxt}>Clear filters</Text>
            </Pressable>
          )}
          {visibleHeroes.length === 0 && (
            <View style={styles.noResultsCard}>
              <Text style={styles.noResultsTxt}>No heroes match these filters.</Text>
            </View>
          )}

          <View style={styles.grid}>
            {visibleHeroes.map((h) => {
              const isOwned  = owned.has(h.id);
              const inTeam   = team.includes(h.id);
              const accent   = ELEMENT_COLORS[h.element] ?? COLORS.brand;
              // Always prefer the full-body battle sprite on the heroes roster grid.
              const sprite   = getHeroBattleSprite(h.id) ?? getHeroPortrait(h.id);
              const teamSlot = team.indexOf(h.id) + 1;
              const prog     = getProgress(player.hero_progression, h.id);
              const evolveReady = isOwned && canEvolve(prog);

              const level      = prog.level ?? 1;
              const starLvlCap = levelCapForStar(prog.star);
              const levelPct   = Math.min(1, level / starLvlCap);
              const canTrain   = canUseScroll(prog);
              const atStarCap  = level >= starLvlCap;
              const classLabel = heroClassLabel(h.role, prog.star);
              const classChange = isOwned && isClassChangeStar(prog.star);
              const promoteReady = isOwned && atStarCap && prog.star < 5;
              const starGateLocked = isOwned && prog.star < maxStar && promoteReady && !check_canPromote(prog.star, maxStar);

              return (
                <Pressable
                  key={h.id}
                  style={styles.cardWrap}
                  onPress={() => { if (isOwned) router.push(`/hero/${h.id}`); }}
                  testID={`hero-card-${h.id}`}
                >
                  <View style={[
                    styles.card,
                    { borderColor: evolveReady ? COLORS.brand : promoteReady ? accent + "CC" : inTeam ? accent : COLORS.border },
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

                      {/* Team slot badge */}
                      {inTeam && (
                        <View style={[styles.slotBadge, { backgroundColor: accent }]}>
                          <Text style={styles.slotTxt}>{teamSlot}</Text>
                        </View>
                      )}

                      {/* Star row (top right) */}
                      {isOwned && (
                        <View style={styles.starRow}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Ionicons key={i} name={i < prog.star ? "star" : "star-outline"}
                              size={8} color={i < prog.star ? COLORS.brand : COLORS.border + "88"} />
                          ))}
                        </View>
                      )}

                      {/* Class-change badge */}
                      {classChange && (
                        <View style={styles.classChangeBadge}>
                          <Ionicons name="sparkles" size={8} color="#D4AF37" />
                          <Text style={styles.classChangeTxt}>CLASS ↑</Text>
                        </View>
                      )}

                      {/* Level bar at bottom of sprite */}
                      {isOwned && (
                        <View style={styles.levelBarWrap} pointerEvents="none">
                          <View style={styles.levelBarTrack}>
                            <View style={[styles.levelBarFill, { width: `${levelPct * 100}%`, backgroundColor: canTrain ? accent : accent + "55" }]} />
                          </View>
                          <Text style={styles.levelBarTxt}>Lv {level}/{starLvlCap}</Text>
                        </View>
                      )}

                      {/* Evolve / promote ready indicator */}
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
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
                          <View style={[styles.elementTag, { borderColor: accent + "70" }]}>
                            <Text style={[styles.elementTxt, { color: accent }]}>{h.element.toUpperCase()}</Text>
                          </View>
                        </View>
                        {isOwned ? (
                          <Text style={[styles.roleTag, prog.star >= CLASS_CHANGE_STAR && { color: accent + "CC" }]}
                            numberOfLines={1}>{classLabel}</Text>
                        ) : (
                          <Text style={styles.roleTag}>{heroRoleLabel(h.role)}</Text>
                        )}
                        {isOwned && promoteReady && (
                          <View style={[styles.promotePill, { borderColor: accent + "80", backgroundColor: accent + "18" }]}>
                            <Ionicons name="arrow-up-circle-outline" size={10} color={accent} />
                            <Text style={[styles.promotePillTxt, { color: accent }]}>PROMOTE</Text>
                          </View>
                        )}
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

          {/* ── Legendary Coming-Soon Section ──────────────────────────────── */}
          {legendaryHeroes.length > 0 && (
            <View style={styles.legendarySection}>
              <View style={styles.legendarySectionHead}>
                <View style={[styles.legendaryPip, { backgroundColor: UI.gold }]} />
                <Text style={styles.legendarySectionTitle}>LEGENDARY HEALERS</Text>
                <View style={[styles.legendaryComingSoonChip]}>
                  <Text style={styles.legendaryComingSoonTxt}>COMING SOON</Text>
                </View>
              </View>
              <Text style={styles.legendarySectionDesc}>
                Historical healers of legend. Unlock them in future Recruitment events.
              </Text>
              <View style={styles.grid}>
                {legendaryHeroes.map((h) => {
                  const accent = UI.gold;
                  const sprite = getHeroPortrait(h.id) ?? getHeroBattleSprite(h.id);
                  return (
                    <View key={h.id} style={[styles.cardWrap]}>
                      <View style={[styles.card, styles.legendaryCard, { borderColor: UI.gold + "60" }]}>
                        <View style={[styles.spriteBox, { backgroundColor: UI.gold + "12" }]}>
                          {sprite ? (
                            <Image source={sprite} style={[styles.sprite, styles.legendarySprite]} contentFit="contain" contentPosition="center" />
                          ) : (
                            <View style={styles.spriteFallback} />
                          )}
                          <View style={styles.legendaryGlowOverlay} pointerEvents="none" />
                          <View style={styles.legendaryLockOverlay}>
                            <Ionicons name="star" size={18} color={UI.gold} />
                            <Text style={styles.legendaryLockLabel}>LEGENDARY</Text>
                            <Text style={styles.legendaryLockSub}>Coming Soon</Text>
                          </View>
                        </View>
                        <View style={styles.infoRow}>
                          <View style={{ flex: 1 }}>
                            <View style={[styles.tierBadge, { borderColor: UI.gold + "70", backgroundColor: UI.gold + "18" }]}>
                              <Text style={[styles.tierBadgeTxt, { color: UI.gold }]}>LEGENDARY</Text>
                            </View>
                            <Text style={[styles.heroName, { color: UI.gold + "CC" }]} numberOfLines={1}>{h.name}</Text>
                            <View style={[styles.elementTag, { borderColor: accent + "50" }]}>
                              <Text style={[styles.elementTxt, { color: accent + "BB" }]}>{h.element.toUpperCase()}</Text>
                            </View>
                            <Text style={styles.roleTag}>{heroRoleLabel(h.role)}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
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
            const accent   = ELEMENT_COLORS[h.element] ?? COLORS.brand;
            const sprite   = getHeroPortrait(h.id) ?? getHeroBattleSprite(h.id);
            const prog     = getProgress(player.hero_progression, h.id);
            const level    = prog.level ?? 1;
            const lvCap    = levelCapForStar(prog.star);
            const lvPct    = Math.min(1, level / lvCap);
            const xpBanked = prog.xp ?? 0;
            const xpNeeded = heroXpCostForLevel(level);
            const xpPct    = level >= lvCap ? 1 : Math.min(1, xpBanked / xpNeeded);
            const cLabel   = heroClassLabel(h.role, prog.star);
            const skills   = h.skills ?? [];
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
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <TierBadge rarity={h.rarity} color={accent} />
                    <View style={{ flexDirection: "row", gap: 2 }}>
                      {Array.from({ length: 5 }).map((_, si) => (
                        <Ionicons key={si} name={si < prog.star ? "star" : "star-outline"}
                          size={9} color={si < prog.star ? COLORS.brand : COLORS.border} />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.teamHeroName}>{h.name}</Text>
                  <Text style={[styles.teamHeroRole, prog.star >= CLASS_CHANGE_STAR && { color: accent + "DD" }]}>
                    {cLabel} · {h.element}
                  </Text>
                  {/* Level progress bar */}
                  <View style={styles.teamLevelRow}>
                    <Text style={styles.teamLvTxt}>Lv {level}/{lvCap}</Text>
                    <View style={styles.teamLvTrack}>
                      <View style={[styles.teamLvFill, { width: `${lvPct * 100}%`, backgroundColor: accent + "BB" }]} />
                    </View>
                    {level < lvCap && (
                      <View style={styles.teamXpTrack}>
                        <View style={[styles.teamXpFill, { width: `${xpPct * 100}%`, backgroundColor: accent }]} />
                      </View>
                    )}
                  </View>
                  {/* Skill count */}
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: 1 }}>
                    <View style={[styles.skillCountPill, { borderColor: accent + "50" }]}>
                      <Ionicons name="flash-outline" size={9} color={accent} />
                      <Text style={[styles.skillCountTxt, { color: accent }]}>{skills.length} Skills</Text>
                    </View>
                    {prog.star >= CLASS_CHANGE_STAR && (
                      <View style={[styles.skillCountPill, { borderColor: "#D4AF37" + "60", backgroundColor: "#D4AF37" + "12" }]}>
                        <Ionicons name="sparkles" size={9} color="#D4AF37" />
                        <Text style={[styles.skillCountTxt, { color: "#D4AF37" }]}>Class Change</Text>
                      </View>
                    )}
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
          <Text style={[styles.sectionLbl, { marginTop: SPACING.lg }]}>Team Tips</Text>
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

          <Text style={[styles.sectionLbl, { marginTop: SPACING.lg }]}>All Healers</Text>
          {regularHeroes.map((h) => {
            const isOwned = owned.has(h.id);
            const accent  = ELEMENT_COLORS[h.element] ?? COLORS.brand;
            return (
              <View key={h.id} style={[styles.rosterRow, { borderLeftColor: accent, opacity: isOwned ? 1 : 0.5 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rosterName, { color: isOwned ? COLORS.onSurface : COLORS.onSurfaceTertiary }]}>{h.name}</Text>
                  <Text style={styles.rosterMeta}>{heroRoleLabel(h.role)} · {h.element}</Text>
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

          <Text style={[styles.sectionLbl, { marginTop: SPACING.lg }]}>Evolution-Ready</Text>
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
                    <Text style={styles.rosterMeta}>{heroRoleLabel(h.role)} · {h.element}</Text>
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
  starRow: {
    position: "absolute", top: 5, right: 5,
    flexDirection: "row", alignItems: "center", gap: 1,
    backgroundColor: "rgba(12,14,18,0.66)", borderRadius: RADIUS.pill,
    paddingHorizontal: 4, paddingVertical: 3,
  },
  tierBadge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 1, marginBottom: 2 },
  tierBadgeTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  evolveBadge: {
    position: "absolute", bottom: 30, left: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center",
  },
  classChangeBadge: {
    position: "absolute", top: 5, left: 6,
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: "rgba(18,12,2,0.80)", borderRadius: RADIUS.pill,
    paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: "#D4AF37" + "70",
  },
  classChangeTxt: { color: "#D4AF37", fontSize: 8, fontWeight: "800", letterSpacing: 0.6 },
  levelBarWrap: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 6, paddingBottom: 5, paddingTop: 3,
    backgroundColor: "rgba(10,12,16,0.72)",
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  levelBarTrack: { flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" },
  levelBarFill: { height: "100%", borderRadius: 2 },
  levelBarTxt: { color: "rgba(255,255,255,0.75)", fontSize: 8, fontWeight: "700", minWidth: 28 },
  promotePill: {
    flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3,
    alignSelf: "flex-start", borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  promotePillTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
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

  legendarySection: { marginTop: SPACING.xl },
  legendarySectionHead: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  legendaryPip: { width: 3, height: 14, borderRadius: 2 },
  legendarySectionTitle: { color: UI.gold, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, flex: 1 },
  legendaryComingSoonChip: {
    borderWidth: 1, borderColor: UI.gold + "60",
    backgroundColor: UI.gold + "14", borderRadius: RADIUS.pill,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  legendaryComingSoonTxt: { color: UI.gold, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  legendarySectionDesc: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18, marginBottom: SPACING.md },
  legendaryCard: { opacity: 0.85 },
  legendarySprite: { width: "85%", height: "85%" },
  legendaryGlowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: UI.gold + "10",
  },
  legendaryLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12,10,4,0.55)",
    alignItems: "center", justifyContent: "center", gap: 3,
  },
  legendaryLockLabel: { color: UI.gold, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  legendaryLockSub:   { color: UI.gold + "99", fontSize: 10, letterSpacing: 0.3 },

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

  // Team tab — level progress
  teamLevelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  teamLvTxt:   { color: COLORS.brand, fontSize: 10, fontWeight: "700", minWidth: 40 },
  teamLvTrack: { flex: 1, height: 4, backgroundColor: COLORS.surfaceTertiary, borderRadius: 2, overflow: "hidden" },
  teamLvFill:  { height: "100%", borderRadius: 2 },
  teamXpTrack: { width: 30, height: 3, backgroundColor: COLORS.surfaceTertiary, borderRadius: 2, overflow: "hidden" },
  teamXpFill:  { height: "100%", borderRadius: 2 },

  // Team skill count chips
  skillCountPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  skillCountTxt: { fontSize: 9, fontWeight: "700" },

  // Upgrade tab — hero progress cards
  upgradeHeroCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    borderLeftWidth: 3, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  upgradeStatLbl: { color: COLORS.onSurfaceSecondary, fontSize: 10, fontWeight: "700", minWidth: 36 },
  scrollCountChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill,
    paddingHorizontal: 5, paddingVertical: 2, backgroundColor: COLORS.surfaceTertiary,
  },
  scrollCountTxt: { fontSize: 9, fontWeight: "700" },

  // Upgrade tab
  upgradeLinkCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  upgradeIconBox: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  upgradeLinkTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: "700" },
  upgradeLinkSub:   { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19, marginTop: 2 },

  // Roster filter chips
  filterRow: { flexGrow: 0, marginBottom: 2 },
  filterRowContent: { paddingHorizontal: 0, gap: 6, flexDirection: "row", alignItems: "center", paddingBottom: 4 },
  filterChip: {
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  filterChipTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  clearFilters: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-end", marginBottom: SPACING.sm,
  },
  clearFiltersTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  noResultsCard: {
    padding: SPACING.lg, alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm,
  },
  noResultsTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13 },
});
