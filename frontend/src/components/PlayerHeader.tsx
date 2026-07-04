import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { APTITUDE_INFO, RANKS } from "@/src/game/content";
import { CLASS_IDENTITIES, ClassId } from "@/src/game/classTree";
import {
  nextClassAbility, nextLockedFeature, playerLevelFromXp,
} from "@/src/game/progression";
import { useLiveStamina } from "@/src/game/stamina";
import { PlayerState } from "@/src/game/types";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ────────────────────────────────────────────────────────────
// PlayerHeader — persistent global top bar for hub/non-battle pages
// (Push 3.5). Three rows: identity (tap -> Profile), a wrapping row of
// compact currency/stamina chips (each tappable to a relevant screen or
// info panel), and a slim Player EXP bar (tap -> level rewards panel).
//
// Currencies shown here are intentionally limited to the four "main
// wallet" items (stamina, Ward Coins, Refined Lotus Gems, Lotus Gems).
// Everything else (Codex Shards, Ward Sigils, Nourishment Petals,
// Faction Marks, building materials, Insight Crystals) stays inside its
// own system's screen — see realm.ts / economy.ts / wellness.ts.
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

export function PlayerHeader({
  player,
  compact = false,
}: {
  player: PlayerState;
  compact?: boolean;
}) {
  const router = useRouter();
  const { stamina, max: staminaMax } = useLiveStamina(player);
  const [infoModal, setInfoModal] = useState<"stamina" | "level" | null>(null);

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

  return (
    <View style={styles.wrap} testID="player-header">
      {/* ── ROW 1 — identity ── */}
      <Pressable
        style={styles.identityRow}
        onPress={() => router.push("/(tabs)/profile")}
        hitSlop={4}
        testID="player-header-identity"
      >
        <View style={[styles.avatar, apt && { borderColor: apt.color + "70" }]}>
          <Ionicons name={(apt?.icon as any) || "person-circle"} size={compact ? 15 : 18} color={apt?.color || COLORS.onSurfaceSecondary} />
        </View>
        <View style={{ flex: 1 }}>
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
        <Ionicons name="chevron-forward" size={13} color={COLORS.onSurfaceTertiary} />
      </Pressable>

      {/* ── ROW 2 — chips (wraps to a second line on narrow widths) ── */}
      <View style={styles.chipRow}>
        <Chip
          testID="player-header-stamina"
          icon="flash"
          iconColor={stamina <= 0 ? COLORS.error : COLORS.brand}
          text={`${stamina}/${staminaMax}`}
          onPress={() => setInfoModal("stamina")}
        />
        <Chip
          testID="player-header-crowns"
          icon="cash"
          iconColor={COLORS.brand}
          text={formatCompactNumber(player.crowns)}
          onPress={() => router.push("/(tabs)/shop")}
        />
        <Chip
          testID="player-header-refined-gems"
          icon="diamond"
          iconColor={COLORS.filter}
          text={formatCompactNumber(player.refined_lotus_gems ?? 0)}
          onPress={() => router.push("/economy")}
        />
        <Chip
          testID="player-header-lotus-gems"
          icon="flower"
          iconColor={COLORS.growth}
          text={formatCompactNumber(player.lotus_gems_paid ?? 0)}
          onPress={() => router.push("/economy")}
        />
      </View>

      {/* ── ROW 3 — slim Player EXP bar ── */}
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
              You have {stamina}/{staminaMax} Stamina. It regenerates slowly over time and is spent starting a
              Ward Shift battle. Your max Stamina grows as your Player Level rises.
            </Text>
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
  icon, iconColor, text, onPress, testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  text: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable style={[styles.chip, { borderColor: iconColor + "40" }]} onPress={onPress} hitSlop={4} testID={testID}>
      <Ionicons name={icon} size={12} color={iconColor} />
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
  identityRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  name: { color: COLORS.onSurface, fontSize: 14, fontWeight: "800" },
  levelTxt: { color: COLORS.brand, fontSize: 12, fontWeight: "700" },
  rankTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "600", letterSpacing: 0.4, marginTop: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
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
  modalSub: { color: COLORS.brand, fontSize: 12, fontWeight: "700" },
  modalBtn: {
    marginTop: 4,
    backgroundColor: COLORS.brand,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalBtnTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "800" },
});
