import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APTITUDE_INFO, RANKS } from "@/src/game/content";
import { AVATAR_OPTIONS, getAvatarSource } from "@/src/game/avatars";
import { CLASS_IDENTITIES, ClassId } from "@/src/game/classTree";
import { EVENT_TITLES, getEventTitle } from "@/src/game/worldEvent";
import { usePlayer } from "@/src/game/store";
import { useSettings } from "@/src/game/settingsStore";
import { playRewardCue } from "@/src/game/cues";
import { useTutorial } from "@/src/game/tutorialStore";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import {
  nextClassAbility, playerClassForAptitude, playerLevelFromXp,
  unlockedClassAbilities,
} from "@/src/game/progression";

const MASTERY_LABELS: Record<string, string> = {
  assessment: "Assessment",
  stabilization: "Stabilization",
  pharmacology: "Pharmacology",
  judgment: "Judgment",
  command: "Command",
  systems: "Systems",
};

// Intentionally no <PlayerHeader> on this screen (Push 5.5 decision): the
// header's identity row (avatar/name/rank/class) exists to link INTO this
// exact Profile screen, and its own head block below already covers that
// same info plus rank/XP progress — stacking PlayerHeader here would just
// duplicate it. Wallet chips (stamina/coins/gems) live on hub screens only;
// Profile is the deep identity/settings page, not another hub surface.
export default function ProfileScreen() {
  const router = useRouter();
  const { player, resetPlayer, setAvatar, setActiveTitle } = usePlayer();
  const { soundEnabled, hapticsEnabled, setSound, setHaptics } = useSettings();
  const { resetTutorials } = useTutorial();
  const [pickerOpen, setPickerOpen] = useState(false);

  async function handleReset() {
    await resetTutorials();
    await resetPlayer();
    // Return to the boot gate so the full fresh-player flow re-runs
    // (title → preloader → prologue → the forced guided tutorial battle).
    // Without this the app would stay mounted inside (tabs) on a now-blank
    // screen and never replay onboarding.
    router.replace("/");
  }

  if (!player) {
    return (
      <SafeAreaView style={[styles.container, styles.loading]} edges={["top"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }
  const apt = APTITUDE_INFO[player.aptitude];
  const nextRank = RANKS[player.rank_index + 1];

  const playerLevelInfo = playerLevelFromXp(player.xp);
  const playerClass = playerClassForAptitude(player.aptitude);
  const unlockedAbilities = unlockedClassAbilities(player.aptitude, playerLevelInfo.level);
  const nextAbility = nextClassAbility(player.aptitude, playerLevelInfo.level);

  const ownedTitles = player.owned_titles || [];
  const activeTitle = player.active_title ? getEventTitle(player.active_title) : null;
  // Un-owned Titles from the catalog, surfaced as locked collection goals.
  const lockedTitles = Object.values(EVENT_TITLES).filter((t) => !ownedTitles.includes(t.id));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Pressable
            style={[styles.avatar, { borderColor: apt.color }]}
            onPress={() => setPickerOpen(true)}
            testID="profile-avatar"
          >
            {getAvatarSource(player.avatar_id) ? (
              <ExpoImage source={getAvatarSource(player.avatar_id)!} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Ionicons name={apt.icon as any} size={36} color={apt.color} />
            )}
            <View style={[styles.avatarEditBadge, { borderColor: apt.color }]}>
              <Ionicons name="pencil" size={11} color={COLORS.onBrand} />
            </View>
          </Pressable>
          <Text style={styles.name}>{player.name}</Text>
          {activeTitle && (
            <View style={[styles.titleBadge, { borderColor: activeTitle.accentColor + "66", backgroundColor: activeTitle.accentColor + "18" }]} testID="profile-active-title">
              <Ionicons name="ribbon" size={12} color={activeTitle.accentColor} />
              <Text style={[styles.titleBadgeTxt, { color: activeTitle.accentColor }]}>{activeTitle.label}</Text>
            </View>
          )}
          <Text style={styles.aptLine}>{apt.title} · {player.rank}</Text>
        </View>

        <View style={styles.rankCard}>
          <Text style={styles.label}>RANK PROGRESS</Text>
          <Text style={styles.rankName}>{player.rank}</Text>
          {nextRank ? (
            <>
              <Text style={styles.nextRank}>Next: {nextRank.name} at {nextRank.xpRequired} XP</Text>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.min(100, (player.xp / nextRank.xpRequired) * 100)}%` }]} />
              </View>
              <Text style={styles.xpTxt}>{player.xp} / {nextRank.xpRequired} XP</Text>
            </>
          ) : <Text style={styles.nextRank}>You have reached the apex.</Text>}
        </View>

        <Pressable
          style={styles.classTreeCard}
          onPress={() => router.push("/class-tree")}
          testID="profile-class-tree-link"
        >
          <View style={[styles.classTreeIcon, { backgroundColor: (CLASS_IDENTITIES[(player.class_tree_id as ClassId) || "medic"] || CLASS_IDENTITIES.medic).color + "22" }]}>
            <Ionicons
              name={(CLASS_IDENTITIES[(player.class_tree_id as ClassId) || "medic"] || CLASS_IDENTITIES.medic).icon as any}
              size={22}
              color={(CLASS_IDENTITIES[(player.class_tree_id as ClassId) || "medic"] || CLASS_IDENTITIES.medic).color}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>CLASS TREE</Text>
            <Text style={styles.rankName}>{(CLASS_IDENTITIES[(player.class_tree_id as ClassId) || "medic"] || CLASS_IDENTITIES.medic).name}</Text>
            <Text style={styles.nextRank}>View abilities & switch class</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.onSurfaceTertiary} />
        </Pressable>

        <View style={styles.classCard} testID="profile-player-class">
          <Text style={styles.label}>PLAYER CLASS</Text>
          <Text style={styles.rankName}>{playerClass}</Text>
          <Text style={styles.nextRank}>Player Level {playerLevelInfo.level}</Text>
          {unlockedAbilities.length > 0 && (
            <View style={{ gap: 6, marginTop: 6 }}>
              {unlockedAbilities.map((a) => (
                <View key={a.name} style={styles.abilityRow} testID={`class-ability-${a.level}`}>
                  <Text style={styles.abilityLevel}>Lv.{a.level}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.abilityName}>{a.name}</Text>
                    <Text style={styles.abilityDesc}>{a.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          {nextAbility ? (
            <Text style={[styles.nextRank, { marginTop: 6 }]}>
              Next: {nextAbility.name} at Lv.{nextAbility.level} — {nextAbility.description}
            </Text>
          ) : (
            <Text style={[styles.nextRank, { marginTop: 6 }]}>All class abilities unlocked.</Text>
          )}
        </View>

        <Text style={styles.section}>Titles</Text>
        {ownedTitles.length === 0 && (
          <View style={styles.titlesEmpty} testID="profile-titles-empty">
            <Ionicons name="ribbon-outline" size={20} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.titlesEmptyTxt}>
              No Titles earned yet. Claim Miasma Bloom event milestones to earn cosmetic Titles like Bloom Researcher.
            </Text>
          </View>
        )}
        {(ownedTitles.length > 0 || lockedTitles.length > 0) && (
          <View style={styles.titlesCard} testID="profile-titles-card">
            {ownedTitles.map((tid) => {
              const t = getEventTitle(tid);
              const selected = player.active_title === tid;
              return (
                <Pressable
                  key={tid}
                  style={[styles.titleRow, selected && { borderColor: t.accentColor, backgroundColor: t.accentColor + "12" }]}
                  onPress={() => setActiveTitle(selected ? "" : tid)}
                  testID={`title-option-${tid}`}
                >
                  <Ionicons name="ribbon" size={18} color={t.accentColor} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.titleName}>{t.label}</Text>
                    {!!t.description && <Text style={styles.titleDesc}>{t.description}</Text>}
                  </View>
                  {selected ? (
                    <View style={[styles.titleActivePill, { backgroundColor: t.accentColor }]}>
                      <Text style={styles.titleActivePillTxt}>ACTIVE</Text>
                    </View>
                  ) : (
                    <Text style={styles.titleEquipHint}>Tap to display</Text>
                  )}
                </Pressable>
              );
            })}
            {lockedTitles.map((t) => (
              <View
                key={t.id}
                style={[styles.titleRow, styles.titleRowLocked]}
                testID={`title-locked-${t.id}`}
              >
                <Ionicons name="lock-closed" size={16} color={COLORS.onSurfaceTertiary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.titleName, styles.titleNameLocked]}>{t.label}</Text>
                  {!!t.description && <Text style={styles.titleDesc}>{t.description}</Text>}
                </View>
                <View style={styles.titleLockedPill}>
                  <Text style={styles.titleLockedPillTxt}>LOCKED</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.section}>Mastery</Text>
        <View style={styles.masteryGrid}>
          {Object.entries(player.mastery).map(([k, v]) => (
            <View key={k} style={styles.mCard} testID={`mastery-${k}`}>
              <Text style={styles.mLabel}>{MASTERY_LABELS[k] || k}</Text>
              <Text style={styles.mValue}>{v}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>Stats</Text>
        <View style={styles.statsCard}>
          <Stat label="Codex Shards" value={String(player.codex_shards || 0)} />
          <Stat label="Shifts Completed" value={String(player.runs_completed)} />
          <Stat label="Bosses Defeated" value={String(player.bosses_defeated.length)} />
          <Stat label="Heroes Recruited" value={String(player.heroes_owned.length)} />
          <Stat label="Codex Pages" value={String(player.codex_unlocked.length)} />
        </View>

        <Text style={styles.section}>Settings</Text>
        <View style={styles.settingsCard}>
          <Pressable
            style={styles.settingsRow}
            onPress={() => { const next = !soundEnabled; setSound(next); if (next) playRewardCue(false); }}
            testID="profile-sound-toggle"
          >
            <Ionicons
              name={soundEnabled ? "volume-high-outline" : "volume-mute-outline"}
              size={18}
              color={soundEnabled ? COLORS.brand : COLORS.onSurfaceTertiary}
            />
            <Text style={styles.settingsRowTxt}>Sound Effects</Text>
            <View style={[styles.toggle, soundEnabled && styles.toggleOn]}>
              <View style={[styles.toggleKnob, soundEnabled && styles.toggleKnobOn]} />
            </View>
          </Pressable>
          <View style={styles.settingsDivider} />
          <Pressable
            style={styles.settingsRow}
            onPress={() => { const next = !hapticsEnabled; setHaptics(next); if (next) playRewardCue(false); }}
            testID="profile-haptics-toggle"
          >
            <Ionicons
              name="phone-portrait-outline"
              size={18}
              color={hapticsEnabled ? COLORS.brand : COLORS.onSurfaceTertiary}
            />
            <Text style={styles.settingsRowTxt}>Vibration (mobile)</Text>
            <View style={[styles.toggle, hapticsEnabled && styles.toggleOn]}>
              <View style={[styles.toggleKnob, hapticsEnabled && styles.toggleKnobOn]} />
            </View>
          </Pressable>
          <View style={styles.settingsDivider} />
          <Pressable
            style={styles.settingsRow}
            onPress={() => router.push("/tutorial")}
            testID="profile-tutorial-button"
          >
            <Ionicons name="book-outline" size={18} color={COLORS.brand} />
            <Text style={styles.settingsRowTxt}>{"How to Play — Healer's Manual"}</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
          <View style={styles.settingsDivider} />
          <Pressable
            style={styles.settingsRow}
            onPress={() => router.push("/(tabs)/codex")}
            testID="profile-codex-button"
          >
            <Ionicons name="library-outline" size={18} color={COLORS.brand} />
            <Text style={styles.settingsRowTxt}>Research Library (Codex)</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
          <View style={styles.settingsDivider} />
          <Pressable
            style={styles.settingsRow}
            onPress={() => router.push("/economy")}
            testID="profile-economy-button"
          >
            <Ionicons name="diamond-outline" size={18} color={COLORS.brand} />
            <Text style={styles.settingsRowTxt}>Economy Guide</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
          <View style={styles.settingsDivider} />
          <Pressable
            style={styles.settingsRow}
            onPress={() => router.push("/materials")}
            testID="profile-materials-button"
          >
            <Ionicons name="cube-outline" size={18} color={COLORS.brand} />
            <Text style={styles.settingsRowTxt}>Material Guide</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
          <View style={styles.settingsDivider} />
          <View style={styles.settingsRow} testID="profile-achievements-row">
            <Ionicons name="trophy-outline" size={18} color={COLORS.onSurfaceTertiary} />
            <Text style={[styles.settingsRowTxt, { color: COLORS.onSurfaceTertiary }]}>Achievements</Text>
            <Text style={styles.comingSoonTag}>SOON</Text>
          </View>
          <View style={styles.settingsDivider} />
          <View style={styles.settingsRow} testID="profile-support-row">
            <Ionicons name="help-buoy-outline" size={18} color={COLORS.onSurfaceTertiary} />
            <Text style={[styles.settingsRowTxt, { color: COLORS.onSurfaceTertiary }]}>Support & Legal</Text>
            <Text style={styles.comingSoonTag}>SOON</Text>
          </View>
        </View>

        <Text style={styles.section}>Onboarding & Replay</Text>
        <View style={styles.settingsCard}>
          <Pressable
            style={styles.settingsRow}
            onPress={() => router.push("/battle?enemyId=dehydration_wisp&training=1&prologue=tutorial&replay=1")}
            testID="profile-replay-prologue-button"
          >
            <Ionicons name="film-outline" size={18} color={COLORS.brand} />
            <Text style={styles.settingsRowTxt}>Replay Prologue Shift</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
          <View style={styles.settingsDivider} />
          <Pressable
            style={styles.settingsRow}
            onPress={() => router.push("/reminiscence?replay=1")}
            testID="profile-replay-reminiscence-button"
          >
            <Ionicons name="images-outline" size={18} color={COLORS.brand} />
            <Text style={styles.settingsRowTxt}>Replay Memory Reminiscence</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
          <View style={styles.settingsDivider} />
          <Pressable
            style={styles.settingsRow}
            onPress={() => router.push("/post-recall?replay=1")}
            testID="profile-replay-diagnostic-button"
          >
            <Ionicons name="pulse-outline" size={18} color={COLORS.brand} />
            <Text style={styles.settingsRowTxt}>Replay Class Diagnostic</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
          <View style={styles.settingsDivider} />
          <Pressable
            style={styles.settingsRow}
            onPress={() => router.push("/class-result")}
            testID="profile-class-result-button"
          >
            <Ionicons name="ribbon-outline" size={18} color={COLORS.brand} />
            <Text style={styles.settingsRowTxt}>Review Class Result</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
          <View style={styles.settingsDivider} />
          <Pressable
            style={styles.settingsRow}
            onPress={() => router.push("/tutorial-center")}
            testID="profile-tutorial-center-button"
          >
            <Ionicons name="school-outline" size={18} color={COLORS.brand} />
            <Text style={styles.settingsRowTxt}>Tutorial Replay Center</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
        </View>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerLabel}>DANGER ZONE</Text>
          <Pressable style={styles.resetBtn} onPress={handleReset} testID="profile-reset-button">
            <Ionicons name="refresh" size={14} color={COLORS.error} />
            <Text style={styles.resetTxt}>Reset Account (Start Over)</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Portrait avatar picker */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Choose Your Portrait</Text>
            <Text style={styles.pickerSub}>Pick a hand-drawn healer portrait for your profile.</Text>
            <View style={styles.pickerGrid}>
              {AVATAR_OPTIONS.map((opt) => {
                const selected = player.avatar_id === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[styles.pickerOption, selected && { borderColor: apt.color, borderWidth: 3 }]}
                    onPress={async () => { await setAvatar(opt.id); setPickerOpen(false); }}
                    testID={`avatar-option-${opt.id}`}
                  >
                    <ExpoImage source={opt.source} style={styles.pickerImg} contentFit="cover" />
                    {selected && (
                      <View style={[styles.pickerCheck, { backgroundColor: apt.color }]}>
                        <Ionicons name="checkmark" size={13} color={COLORS.onBrand} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
            {!!player.avatar_id && (
              <Pressable
                style={styles.pickerClear}
                onPress={async () => { await setAvatar(""); setPickerOpen(false); }}
                testID="avatar-clear"
              >
                <Ionicons name="close-circle-outline" size={15} color={COLORS.onSurfaceSecondary} />
                <Text style={styles.pickerClearTxt}>Use aptitude icon instead</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLbl}>{label}</Text>
      <Text style={styles.statVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  scroll: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxxl },
  head: { alignItems: "center", gap: 8, marginTop: SPACING.md },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceSecondary, overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  avatarEditBadge: {
    position: "absolute", right: -2, bottom: -2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.brand, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  pickerBackdrop: { flex: 1, backgroundColor: "#000000AA", alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  pickerCard: {
    width: "100%", maxWidth: 380,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.lg, gap: 6,
  },
  pickerTitle: { color: COLORS.onSurface, fontSize: 17, fontWeight: "800" },
  pickerSub: { color: COLORS.onSurfaceSecondary, fontSize: 12, marginBottom: 6 },
  pickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  pickerOption: {
    width: 92, height: 92, borderRadius: RADIUS.md, overflow: "hidden",
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  pickerImg: { width: "100%", height: "100%" },
  pickerCheck: {
    position: "absolute", right: 4, top: 4,
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
  pickerClear: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    marginTop: 10, paddingVertical: 8,
  },
  pickerClearTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "600" },
  name: { color: COLORS.onSurface, fontSize: 24, fontWeight: "400", marginTop: SPACING.sm },
  titleBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
    marginTop: 2,
  },
  titleBadgeTxt: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  aptLine: { color: COLORS.brand, fontSize: 12, letterSpacing: 1.5, fontWeight: "600" },
  titlesCard: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden", gap: 1 },
  titleRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    padding: SPACING.md, borderWidth: 1, borderColor: "transparent", borderRadius: RADIUS.md,
  },
  titleRowLocked: { opacity: 0.55 },
  titleName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700" },
  titleNameLocked: { color: COLORS.onSurfaceSecondary },
  titleLockedPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: COLORS.surfaceTertiary },
  titleLockedPillTxt: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  titleDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  titleEquipHint: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "600" },
  titleActivePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  titleActivePillTxt: { color: COLORS.onBrand, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  titlesEmpty: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  titlesEmptyTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, flex: 1, lineHeight: 17 },
  rankCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  label: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  rankName: { color: COLORS.onSurface, fontSize: 22, fontWeight: "300" },
  nextRank: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  bar: { height: 6, backgroundColor: COLORS.surfaceTertiary, borderRadius: 3, overflow: "hidden", marginTop: 8 },
  barFill: { height: "100%", backgroundColor: COLORS.brand },
  xpTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 4 },
  classTreeCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  classTreeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  classCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  abilityRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start" },
  abilityLevel: { color: COLORS.brand, fontSize: 11, fontWeight: "700", width: 40 },
  abilityName: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  abilityDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 1 },
  section: { color: COLORS.onSurface, fontSize: 18, marginTop: SPACING.sm, fontWeight: "400" },
  masteryGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  mCard: {
    width: "47%", backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, gap: 4,
  },
  mLabel: { color: COLORS.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "600" },
  mValue: { color: COLORS.brand, fontSize: 26, fontWeight: "300" },
  statsCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  statRow: { flexDirection: "row", justifyContent: "space-between" },
  statLbl: { color: COLORS.onSurfaceSecondary, fontSize: 14 },
  statVal: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: SPACING.md },
  resetTxt: { color: COLORS.error, fontSize: 12, fontWeight: "600" },
  tutorialBtn: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md, marginTop: SPACING.sm, backgroundColor: COLORS.brand + "12", borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.brand + "40" },
  tutorialTxt: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600", flex: 1 },
  settingsCard: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  settingsRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md },
  settingsRowTxt: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600", flex: 1 },
  settingsDivider: { height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.md + 18 + SPACING.sm },
  comingSoonTag: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  toggle: {
    width: 42, height: 24, borderRadius: 12, padding: 3,
    backgroundColor: COLORS.surfaceTertiary, justifyContent: "center",
  },
  toggleOn: { backgroundColor: COLORS.brand },
  toggleKnob: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.onSurfaceTertiary,
    alignSelf: "flex-start",
  },
  toggleKnobOn: { backgroundColor: COLORS.onBrand, alignSelf: "flex-end" },
  dangerZone: { borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.error + "35", backgroundColor: COLORS.error + "08" },
  dangerLabel: { color: COLORS.error, fontSize: 9, letterSpacing: 2, fontWeight: "700", paddingTop: SPACING.sm, paddingHorizontal: SPACING.md },
});
