import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ImageSourcePropType, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { APTITUDE_INFO, RANKS } from "@/src/game/content";
import { getAvatarSource } from "@/src/game/avatars";
import { CLASS_IDENTITIES, ClassId } from "@/src/game/classTree";
import {
  buildGateContext, checkFeatureGate, nextClassAbility, nextLockedFeature, playerLevelFromXp,
} from "@/src/game/progression";
import { useLiveStamina } from "@/src/game/stamina";
import { PlayerState } from "@/src/game/types";
import { getUiIcon } from "@/src/game/uiIcons";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ────────────────────────────────────────────────────────────
// PlayerHeader — persistent global top bar for hub/non-battle pages
// (Push 3.5 + B4 Progressive Reveal). Two rows: identity+wallet line and
// a slim Player EXP bar.
//
// B4 Progressive Reveal rules (do NOT show confusing 0-balance chips to new players):
//   Always:        Stamina + Ward Coins (the two core everyday resources)
//   Shop unlocked (Level 2) OR has any balance:  Refined Lotus Gems chip
//   Has any paid gems:                           Lotus Gems (paid) chip
//   Tap each chip → info modal explaining what it is and where to spend it
//
// Currencies that belong only inside their own screens (NOT shown here):
//   Codex Shards, Ward Sigils, Insight Crystals, University Credits,
//   Epidemic Tokens, Nourishment Petals, Faction Marks, building materials
// ────────────────────────────────────────────────────────────

export function formatCompactNumber(n: number): string {
  const v = Math.floor(n || 0);
  if (v < 1000) return String(v);
  if (v < 1_000_000) {
    const k = v / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  const m = v / 1_000_000;
  return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
}

type InfoModal = "stamina" | "level" | "crowns" | "refined_gems" | "lotus_gems" | null;

export function PlayerHeader({
  player,
  compact = false,
}: {
  player: PlayerState;
  compact?: boolean;
}) {
  const router = useRouter();
  const { stamina, max: staminaMax } = useLiveStamina(player);
  const [infoModal, setInfoModal] = useState<InfoModal>(null);

  const apt = APTITUDE_INFO[player.aptitude];
  const playerLevelInfo = playerLevelFromXp(player.xp);
  const levelProgress = playerLevelInfo.atCap
    ? 1
    : Math.min(1, playerLevelInfo.xpIntoLevel / Math.max(1, playerLevelInfo.xpForNextLevel));
  const remaining = playerLevelInfo.atCap
    ? 0
    : Math.max(0, playerLevelInfo.xpForNextLevel - playerLevelInfo.xpIntoLevel);
  const nextUnlock = nextLockedFeature(playerLevelInfo.level);
  const nextAbility = nextClassAbility(player.aptitude, playerLevelInfo.level);
  const classId = (player.class_tree_id as ClassId) || "medic";
  const classIdentity = CLASS_IDENTITIES[classId] || CLASS_IDENTITIES.medic;

  // ── Progressive reveal gates ──────────────────────────────
  // Shop gate: crowns chip links to Shop only if unlocked (level 2)
  const shopUnlocked = checkFeatureGate("shop", buildGateContext(player)).unlocked;
  // Refined Lotus Gems: show once Shop unlocks (level 2) OR player already has a balance
  const showRefinedGems = shopUnlocked || (player.refined_lotus_gems ?? 0) > 0;
  // Paid Lotus Gems: only show if player actually has some — suppress the confusing
  // 0-balance chip until premium spending has been introduced
  const showPaidGems = (player.lotus_gems_paid ?? 0) > 0;

  const avatarSource = getAvatarSource(player.avatar_id);

  return (
    <View style={styles.wrap} testID="player-header">
      {/* ── ROW 1 — identity + wallet chips on one line ── */}
      <View style={styles.topRow}>
        <Pressable
          style={styles.identityRow}
          onPress={() => router.push("/(tabs)/profile")}
          hitSlop={4}
          testID="player-header-identity"
        >
          <View style={[styles.avatar, apt && { borderColor: apt.color + "70" }]}>
            {avatarSource ? (
              <ExpoImage source={avatarSource} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Ionicons name={(apt?.icon as any) || "person-circle"} size={compact ? 16 : 20} color={apt?.color || COLORS.onSurfaceSecondary} />
            )}
          </View>
          <View style={styles.identityText}>
            <Text style={styles.name} numberOfLines={1}>
              {player.name}{" "}
              <Text
                style={styles.levelTxt}
                onPress={() => router.push("/class-tree")}
                testID="player-header-class-link"
              >
                Lv.{playerLevelInfo.level} {classIdentity.name}
              </Text>
            </Text>
            {!compact && (
              <Text style={styles.rankTxt} numberOfLines={1}>{RANKS[player.rank_index]?.name ?? ""}</Text>
            )}
          </View>
        </Pressable>

        {/* wallet + stamina chips — progressively revealed */}
        <View style={styles.chipRow}>
          {/* Always visible: Stamina */}
          <Chip
            testID="player-header-stamina"
            icon={getUiIcon("stamina")}
            tint={stamina <= 0 ? COLORS.error : COLORS.brand}
            text={`${stamina}/${staminaMax}`}
            onPress={() => setInfoModal("stamina")}
          />
          {/* Always visible: Ward Coins */}
          <Chip
            testID="player-header-crowns"
            icon={getUiIcon("crowns")}
            tint={COLORS.brand}
            text={formatCompactNumber(player.crowns)}
            onPress={() => setInfoModal("crowns")}
          />
          {/* Progressively revealed: Refined Lotus Gems (Shop unlocked or already has some) */}
          {showRefinedGems && (
            <Chip
              testID="player-header-refined-gems"
              icon={getUiIcon("refined_gem")}
              tint={COLORS.filter}
              text={formatCompactNumber(player.refined_lotus_gems ?? 0)}
              onPress={() => setInfoModal("refined_gems")}
            />
          )}
          {/* Progressively revealed: Paid Lotus Gems (only when player has any) */}
          {showPaidGems && (
            <Chip
              testID="player-header-lotus-gems"
              icon={getUiIcon("lotus_gem")}
              tint={COLORS.growth}
              text={formatCompactNumber(player.lotus_gems_paid ?? 0)}
              onPress={() => setInfoModal("lotus_gems")}
            />
          )}
        </View>
      </View>

      {/* ── ROW 2 — slim Player EXP bar ── */}
      <Pressable
        style={styles.expRow}
        onPress={() => setInfoModal("level")}
        testID="player-header-exp-bar"
      >
        <View style={styles.expBarBg}>
          <View style={[styles.expBarFill, { width: `${Math.round(levelProgress * 100)}%` as any }]} />
        </View>
        <Text style={styles.expTxt} numberOfLines={1}>
          {playerLevelInfo.atCap
            ? "MAX LEVEL"
            : `${playerLevelInfo.xpIntoLevel}/${playerLevelInfo.xpForNextLevel} EXP · ${remaining} to Lv.${playerLevelInfo.level + 1}`}
        </Text>
      </Pressable>

      {/* ── Stamina info modal ── */}
      <Modal visible={infoModal === "stamina"} transparent animationType="fade" onRequestClose={() => setInfoModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoModal(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Ionicons name="flash" size={22} color={COLORS.brand} />
            <Text style={styles.modalTitle}>Shift Stamina</Text>
            <Text style={styles.modalBody}>
              You have {stamina}/{staminaMax} Stamina. It regenerates slowly over time and is spent when
              you start a Ward Shift battle. Your max Stamina grows as your Player Level rises.
            </Text>
            <Text style={styles.modalHint}>Spend it on Ward Shift battles to earn Ward Coins, Codex Shards, and Hero EXP.</Text>
            <Pressable
              style={styles.modalBtn}
              onPress={() => { setInfoModal(null); router.push("/(tabs)/index" as any); }}
              testID="player-header-stamina-goto-shift"
            >
              <Text style={styles.modalBtnTxt}>Go to Ward Shift</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Ward Coins info modal ── */}
      <Modal visible={infoModal === "crowns"} transparent animationType="fade" onRequestClose={() => setInfoModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoModal(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Ionicons name="shield" size={22} color={COLORS.brand} />
            <Text style={styles.modalTitle}>Ward Coins</Text>
            <Text style={styles.modalBody}>
              Ward Coins are the primary free currency of the Sanctuary. Earn them by completing Ward
              Shift battles, Daily Rounds objectives, and story milestones.
            </Text>
            <Text style={styles.modalHint}>Spend them at the Apothecary Market for Clinical Supplies, hero upgrades, and Ward Defense boosts.</Text>
            {shopUnlocked && (
              <Pressable
                style={styles.modalBtn}
                onPress={() => { setInfoModal(null); router.push("/(tabs)/shop"); }}
                testID="player-header-crowns-goto-shop"
              >
                <Text style={styles.modalBtnTxt}>Go to Shop</Text>
              </Pressable>
            )}
            {!shopUnlocked && (
              <View style={styles.modalLockedHint}>
                <Ionicons name="lock-closed-outline" size={13} color={COLORS.onSurfaceTertiary} />
                <Text style={styles.modalLockedTxt}>Shop unlocks at Level 2</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Refined Lotus Gems info modal ── */}
      <Modal visible={infoModal === "refined_gems"} transparent animationType="fade" onRequestClose={() => setInfoModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoModal(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Ionicons name="diamond" size={22} color={COLORS.filter} />
            <Text style={styles.modalTitle}>Refined Lotus Gems</Text>
            <Text style={styles.modalBody}>
              Refined Lotus Gems are a mid-tier earned currency — crafted in the Sanctuary Bank by
              converting Insight Crystals you earn through learning and play. They are{" "}
              <Text style={{ fontWeight: "800" }}>never sold for real money</Text> and cost about
              20% more to buy at their exchange rate than paid Lotus Gems, rewarding dedicated players.
            </Text>
            <Text style={styles.modalHint}>Spend them on cosmetics, hero skins, and Realm decorations.</Text>
            <Pressable
              style={styles.modalBtn}
              onPress={() => { setInfoModal(null); router.push("/economy"); }}
              testID="player-header-refined-gems-goto-economy"
            >
              <Text style={styles.modalBtnTxt}>View Currency Guide</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Paid Lotus Gems info modal ── */}
      <Modal visible={infoModal === "lotus_gems"} transparent animationType="fade" onRequestClose={() => setInfoModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoModal(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Ionicons name="sparkles" size={22} color={COLORS.growth} />
            <Text style={styles.modalTitle}>Lotus Gems</Text>
            <Text style={styles.modalBody}>
              Lotus Gems are an optional premium currency for players who choose to support Clinica's
              development. They are spent only on cosmetics, passes, and convenience items —{" "}
              <Text style={{ fontWeight: "800" }}>never on exclusive power</Text> or progression
              advantages unavailable to free players.
            </Text>
            <Text style={styles.modalHint}>Core clinical learning and all ward progression are always completely free.</Text>
            <Pressable
              style={styles.modalBtn}
              onPress={() => { setInfoModal(null); router.push("/economy"); }}
              testID="player-header-lotus-gems-goto-economy"
            >
              <Text style={styles.modalBtnTxt}>View Currency Guide</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Level rewards / next unlock modal ── */}
      <Modal visible={infoModal === "level"} transparent animationType="fade" onRequestClose={() => setInfoModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoModal(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Ionicons name="ribbon" size={22} color={COLORS.brand} />
            <Text style={styles.modalTitle}>Player Level {playerLevelInfo.level}</Text>
            <Text style={styles.modalBody}>
              {playerLevelInfo.atCap
                ? "You've reached the current max Player Level."
                : `${playerLevelInfo.xpIntoLevel}/${playerLevelInfo.xpForNextLevel} EXP — ${remaining} EXP to Level ${playerLevelInfo.level + 1}.`}
            </Text>
            {nextUnlock && (
              <Text style={styles.modalSub}>Next unlock: {nextUnlock.label} at Lv.{nextUnlock.level}</Text>
            )}
            {nextAbility && (
              <Text style={styles.modalSub}>Next Class Ability: {nextAbility.name} at Lv.{nextAbility.level}</Text>
            )}
            <Pressable
              style={styles.modalBtn}
              onPress={() => { setInfoModal(null); router.push("/(tabs)/profile"); }}
              testID="player-header-level-goto-profile"
            >
              <Text style={styles.modalBtnTxt}>View Profile</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Chip({
  icon, tint, text, onPress, testID,
}: {
  icon: ImageSourcePropType;
  tint: string;
  text: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable style={[styles.chip, { borderColor: tint + "40" }]} onPress={onPress} hitSlop={4} testID={testID}>
      <ExpoImage source={icon} style={styles.chipIcon} contentFit="contain" />
      <Text style={styles.chipTxt}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    gap: 7,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  topRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: SPACING.sm, rowGap: 7 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 },
  identityText: { flexShrink: 1, minWidth: 0 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  name: { color: COLORS.onSurface, fontSize: 14, fontWeight: "800" },
  levelTxt: { color: COLORS.brand, fontSize: 12, fontWeight: "700" },
  rankTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "600", letterSpacing: 0.4, marginTop: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, flexGrow: 1, justifyContent: "flex-end" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipIcon: { width: 15, height: 15 },
  chipTxt: { color: COLORS.onSurface, fontSize: 11, fontWeight: "700" },
  expRow: { gap: 3 },
  expBarBg: {
    height: 4, borderRadius: 2, backgroundColor: COLORS.surfaceTertiary, overflow: "hidden",
  },
  expBarFill: { height: "100%", backgroundColor: COLORS.brand, borderRadius: 2 },
  expTxt: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "600", letterSpacing: 0.2 },
  modalBackdrop: {
    flex: 1, backgroundColor: "#000000AA", alignItems: "center", justifyContent: "center", padding: SPACING.xl,
  },
  modalCard: {
    width: "100%", maxWidth: 340,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: 8,
  },
  modalTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: "800" },
  modalBody: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18 },
  modalHint: { color: COLORS.brand, fontSize: 11, lineHeight: 16, fontStyle: "italic" },
  modalSub: { color: COLORS.brand, fontSize: 12, fontWeight: "700" },
  modalLockedHint: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  modalLockedTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },
  modalBtn: {
    marginTop: 4,
    backgroundColor: COLORS.brand,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalBtnTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "800" },
});
