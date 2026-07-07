import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { InlineNotice, useInlineNotice } from "@/src/components/WebAlert";
import {
  CLASS_IDENTITIES, CLASS_IDS, ClassAbilityCard, ClassId, GUARDRAIL_LINES,
  canClaimTier, getClassTree, isTierClaimed,
} from "@/src/game/classTree";
import { getMaterialById } from "@/src/game/materials";
import { playerLevelFromXp } from "@/src/game/progression";
import { usePlayer } from "@/src/game/store";
import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function ClassTreeScreen() {
  const router = useRouter();
  const { player, setPlayerClass, claimClassTier } = usePlayer();
  const [viewingId, setViewingId] = useState<ClassId | null>(null);
  const [switchTarget, setSwitchTarget] = useState<ClassId | null>(null);
  const [busyLevel, setBusyLevel] = useState<number | null>(null);
  const { notice, flashNotice } = useInlineNotice();

  if (!player) return null;

  const currentId = (player.class_tree_id as ClassId) || "medic";
  const activeId = viewingId || currentId;
  const identity = CLASS_IDENTITIES[activeId] || CLASS_IDENTITIES.medic;
  const tree = getClassTree(activeId);
  const progress = (player.class_progress || {})[activeId] || [];
  const playerLevel = player.player_level ?? playerLevelFromXp(player.xp).level;
  const inventory = player.inventory || {};

  async function handleClaim(card: ClassAbilityCard) {
    if (activeId !== currentId) return;
    setBusyLevel(card.level);
    const res = await claimClassTier(activeId, card.level);
    setBusyLevel(null);
    flashNotice(`${res.ok ? "Ability Unlocked" : "Not Yet"} — ${res.message}`);
  }

  async function confirmSwitch() {
    if (!switchTarget) return;
    const res = await setPlayerClass(switchTarget);
    setSwitchTarget(null);
    flashNotice(`${res.ok ? "Class Updated" : "Could Not Switch"} — ${res.message}`);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router, "/(tabs)/profile")} style={styles.backBtn} hitSlop={10} testID="class-tree-back">
            <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>PLAYER CLASS</Text>
            <Text style={styles.title}>Class Tree</Text>
          </View>
        </View>

        {notice && <InlineNotice notice={notice} icon="sparkles" testID="class-tree-notice" />}

        <View style={[styles.currentCard, { borderColor: CLASS_IDENTITIES[currentId].color + "55" }]} testID="class-tree-current">
          <View style={[styles.currentIcon, { backgroundColor: CLASS_IDENTITIES[currentId].color + "22", borderColor: CLASS_IDENTITIES[currentId].color }]}>
            <Ionicons name={CLASS_IDENTITIES[currentId].icon as any} size={26} color={CLASS_IDENTITIES[currentId].color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.currentLabel}>CURRENT CLASS</Text>
            <Text style={styles.currentName}>{CLASS_IDENTITIES[currentId].name}</Text>
            <Text style={styles.currentSub}>Player Level {playerLevel}</Text>
          </View>
        </View>

        <Text style={styles.section}>Choose a Class</Text>
        <Text style={styles.sectionHint}>
          Tap a class to preview its ability tree. Your current class is highlighted — switching is free and safe.
        </Text>
        <View style={styles.classGrid}>
          {CLASS_IDS.map((id) => {
            const c = CLASS_IDENTITIES[id];
            const isCurrent = id === currentId;
            const isViewing = id === activeId;
            return (
              <Pressable
                key={id}
                style={[
                  styles.classCard,
                  { borderColor: isViewing ? c.color : COLORS.border },
                  isCurrent && { backgroundColor: c.color + "14" },
                ]}
                onPress={() => setViewingId(id)}
                testID={`class-tree-select-${id}`}
              >
                <Ionicons name={c.icon as any} size={22} color={c.color} />
                <Text style={styles.classCardName}>{c.name}</Text>
                {isCurrent && <Text style={[styles.currentTag, { color: c.color }]}>CURRENT</Text>}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.identityCard} testID="class-tree-identity">
          <Text style={[styles.identityName, { color: identity.color }]}>{identity.name}</Text>
          <Text style={styles.identityRole}>{identity.role}</Text>
          <Text style={styles.identityLore}>{identity.lore}</Text>
          <View style={styles.tagRow}>
            {identity.focusTags.map((t) => (
              <View key={t} style={[styles.tag, { borderColor: identity.color + "55" }]}>
                <Text style={[styles.tagTxt, { color: identity.color }]}>{t}</Text>
              </View>
            ))}
          </View>
          {activeId !== currentId && (
            <Pressable
              style={[styles.switchBtn, { backgroundColor: identity.color }]}
              onPress={() => setSwitchTarget(activeId)}
              testID={`class-tree-switch-${activeId}`}
            >
              <Text style={styles.switchBtnTxt}>Make {identity.name} My Class</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.section}>Ability Tree</Text>
        <View style={{ gap: SPACING.md }}>
          {tree.map((card) => {
            const claimed = isTierClaimed(progress, card.level);
            const levelReached = playerLevel >= card.level;
            const check = canClaimTier(card, playerLevel, progress, inventory);
            const isCurrentClass = activeId === currentId;
            const locked = !claimed && !levelReached;
            return (
              <View
                key={card.level}
                style={[
                  styles.abilityCard,
                  claimed && { borderColor: identity.color + "70", backgroundColor: identity.color + "10" },
                  locked && styles.abilityCardLocked,
                ]}
                testID={`class-tree-ability-lv${card.level}`}
              >
                <View style={styles.abilityHead}>
                  <View style={[styles.lvBadge, { backgroundColor: claimed ? identity.color : COLORS.surfaceTertiary }]}>
                    <Text style={[styles.lvBadgeTxt, claimed && { color: COLORS.onBrand }]}>Lv.{card.level}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.abilityName}>{card.name}</Text>
                    <Text style={styles.abilityDesc}>{card.description}</Text>
                  </View>
                  {claimed ? (
                    <Ionicons name="checkmark-circle" size={20} color={identity.color} />
                  ) : locked ? (
                    <Ionicons name="lock-closed" size={16} color={COLORS.onSurfaceTertiary} />
                  ) : null}
                </View>

                {card.requirements.length > 0 && !claimed && (
                  <View style={styles.reqRow}>
                    {card.requirements.map((r) => {
                      const mat = getMaterialById(r.material);
                      const have = inventory[r.material] || 0;
                      const enough = have >= r.qty;
                      return (
                        <View key={r.material} style={styles.reqChip}>
                          <Ionicons name={(mat?.icon as any) || "cube-outline"} size={12} color={enough ? COLORS.success : COLORS.onSurfaceTertiary} />
                          <Text style={[styles.reqTxt, { color: enough ? COLORS.onSurface : COLORS.onSurfaceTertiary }]}>
                            {have}/{r.qty} {mat?.name || r.material}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {!claimed && card.level > 1 && (
                  levelReached ? (
                    isCurrentClass ? (
                      <Pressable
                        style={[styles.claimBtn, !check.ok && styles.claimBtnDisabled]}
                        disabled={!check.ok || busyLevel === card.level}
                        onPress={() => handleClaim(card)}
                        testID={`class-tree-claim-lv${card.level}`}
                      >
                        <Text style={styles.claimBtnTxt}>{busyLevel === card.level ? "Unlocking…" : "Unlock"}</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.reqNote}>Make this your current class to unlock.</Text>
                    )
                  ) : (
                    <Text style={styles.reqNote}>Requires Player Level {card.level}.</Text>
                  )
                )}
                {card.level === 1 && (
                  <Text style={styles.reqNote}>Active automatically while this is your current class.</Text>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.guardrailCard} testID="class-tree-guardrails">
          <View style={styles.guardrailHead}>
            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.onSurfaceSecondary} />
            <Text style={styles.guardrailTitle}>Fair Play Guardrails</Text>
          </View>
          {GUARDRAIL_LINES.map((line) => (
            <Text key={line} style={styles.guardrailLine}>{"\u2022"} {line}</Text>
          ))}
        </View>
      </ScrollView>

      <Modal visible={!!switchTarget} transparent animationType="fade" onRequestClose={() => setSwitchTarget(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSwitchTarget(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Ionicons name="swap-horizontal" size={22} color={COLORS.brand} />
            <Text style={styles.modalTitle}>Switch Class?</Text>
            <Text style={styles.modalBody}>
              {switchTarget && `Make ${CLASS_IDENTITIES[switchTarget].name} your current class? This is free — you keep any abilities you've already unlocked on every class, and you can switch back anytime.`}
            </Text>
            <View style={styles.modalRow}>
              <Pressable style={styles.modalBtnGhost} onPress={() => setSwitchTarget(null)} testID="class-tree-switch-cancel">
                <Text style={styles.modalBtnGhostTxt}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalBtn} onPress={confirmSwitch} testID="class-tree-switch-confirm">
                <Text style={styles.modalBtnTxt}>Confirm</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceSecondary },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300" },
  currentCard: {
    flexDirection: "row", gap: SPACING.md, alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1.5,
    padding: SPACING.md,
  },
  currentIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  currentLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 2, fontWeight: "700" },
  currentName: { color: COLORS.onSurface, fontSize: 20, fontWeight: "600" },
  currentSub: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 1 },
  section: { color: COLORS.onSurface, fontSize: 17, fontWeight: "400", marginTop: SPACING.sm },
  sectionHint: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: -6 },
  classGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  classCard: {
    width: "31%", alignItems: "center", gap: 4, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1.5, backgroundColor: COLORS.surfaceSecondary,
  },
  classCardName: { color: COLORS.onSurface, fontSize: 11, fontWeight: "700" },
  currentTag: { fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  identityCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, gap: 6,
  },
  identityName: { fontSize: 20, fontWeight: "700" },
  identityRole: { color: COLORS.onSurface, fontSize: 12, fontWeight: "600" },
  identityLore: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 17 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  tagTxt: { fontSize: 10, fontWeight: "700" },
  switchBtn: { marginTop: 8, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: "center" },
  switchBtnTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "800" },
  abilityCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border,
    padding: SPACING.md, gap: SPACING.sm,
  },
  abilityCardLocked: { opacity: 0.6 },
  abilityHead: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  lvBadge: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  lvBadgeTxt: { color: COLORS.onSurface, fontSize: 10, fontWeight: "800" },
  abilityName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700" },
  abilityDesc: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 2, lineHeight: 16 },
  reqRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reqChip: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 4,
  },
  reqTxt: { fontSize: 10, fontWeight: "700" },
  reqNote: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontStyle: "italic" },
  claimBtn: { backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: 9, alignItems: "center" },
  claimBtnDisabled: { backgroundColor: COLORS.surfaceTertiary },
  claimBtnTxt: { color: COLORS.onBrand, fontSize: 12, fontWeight: "800" },
  guardrailCard: {
    marginTop: SPACING.sm, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: 6,
  },
  guardrailHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  guardrailTitle: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
  guardrailLine: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 16 },
  modalBackdrop: { flex: 1, backgroundColor: "#000000AA", alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  modalCard: {
    width: "100%", maxWidth: 340, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, gap: 8,
  },
  modalTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: "800" },
  modalBody: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18 },
  modalRow: { flexDirection: "row", gap: SPACING.sm, marginTop: 6 },
  modalBtn: { flex: 1, backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: "center" },
  modalBtnTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "800" },
  modalBtnGhost: { flex: 1, backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: "center" },
  modalBtnGhostTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
});
