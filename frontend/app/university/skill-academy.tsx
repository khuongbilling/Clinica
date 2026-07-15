import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HEROES } from "@/src/game/content";
import {
  SKILL_UPGRADES,
  getMissingMaterials,
  maxHeroLevel,
  type SkillUpgradeDef,
} from "@/src/game/heroSkillAcademy";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── Material inventory strip ─────────────────────────────────────────────────

const MATERIAL_CHIPS: { key: string; label: string; icon: string; color: string }[] = [
  { key: "cue_scroll",        label: "Cue",      icon: "eye-outline",      color: "#2DD4BF" },
  { key: "triage_scroll",     label: "Triage",   icon: "flash-outline",    color: "#F59E0B" },
  { key: "stab_scroll",       label: "Stab",     icon: "heart-outline",    color: "#22C55E" },
  { key: "lesson_note",       label: "Notes",    icon: "book-outline",     color: "#A855F7" },
  { key: "care_chain_manual", label: "Manual",   icon: "library-outline",  color: "#F43F5E" },
  { key: "hero_training_page",label: "Training", icon: "school-outline",   color: "#60A5FA" },
];

function MaterialStrip({ inventory, uc }: { inventory: Record<string, number>; uc: number }) {
  return (
    <View style={strip.row}>
      {MATERIAL_CHIPS.map(c => (
        <View key={c.key} style={strip.chip}>
          <Ionicons name={c.icon as any} size={11} color={c.color} />
          <Text style={[strip.qty, { color: c.color }]}>{inventory[c.key] ?? 0}</Text>
          <Text style={strip.lbl}>{c.label}</Text>
        </View>
      ))}
      <View style={[strip.chip, strip.ucChip]}>
        <Ionicons name="diamond-outline" size={11} color="#D4AF37" />
        <Text style={[strip.qty, { color: "#D4AF37" }]}>{uc}</Text>
        <Text style={strip.lbl}>UC</Text>
      </View>
    </View>
  );
}

const strip = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    backgroundColor: "#1A1A2E",
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  ucChip: { marginLeft: "auto" },
  qty: { fontSize: 12, fontWeight: "700" },
  lbl: { fontSize: 10, color: COLORS.onSurfaceTertiary },
});

// ── Rank dots ────────────────────────────────────────────────────────────────

function RankDots({ currentRank, maxRank, color }: { currentRank: number; maxRank: number; color: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {Array.from({ length: maxRank }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i < currentRank ? color : COLORS.surface,
            borderWidth: 1,
            borderColor: i < currentRank ? color : COLORS.onSurfaceTertiary,
          }}
        />
      ))}
    </View>
  );
}

// ── Requirements row ─────────────────────────────────────────────────────────

function ReqRow({
  label,
  have,
  need,
  color,
}: {
  label: string;
  have: number;
  need: number;
  color: string;
}) {
  const met = have >= need;
  return (
    <View style={req.row}>
      <Ionicons
        name={met ? "checkmark-circle" : "close-circle-outline"}
        size={14}
        color={met ? "#22C55E" : "#EF4444"}
      />
      <Text style={req.label}>{label}</Text>
      <Text style={[req.count, { color: met ? "#22C55E" : "#EF4444" }]}>
        {have}/{need}
      </Text>
    </View>
  );
}

const req = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  label: { flex: 1, color: COLORS.onSurfaceSecondary, fontSize: 12 },
  count: { fontSize: 12, fontWeight: "600" },
});

// ── Missing material hints ────────────────────────────────────────────────────

function MissingHints({
  upgradeId,
  player,
  router,
}: {
  upgradeId: string;
  player: any;
  router: ReturnType<typeof useRouter>;
}) {
  const missing = getMissingMaterials(player, upgradeId);
  if (missing.length === 0) return null;

  const sourceRouteMap: Record<string, string> = {
    "Practice Clinical Cue Lab":      "/university/cue-lab",
    "Practice Rapid Triage Hall":     "/university/triage-hall",
    "Practice Stabilize Stack Lab":   "/university/stack-lab",
    "Complete Lotus Lessons":         "/university/lessons",
    "Complete University Milestones": "/university/uni-milestones",
  };

  const unique = Array.from(new Set(missing.map(m => m.source)));
  return (
    <View style={hints.box}>
      {unique.map(src => {
        const route = sourceRouteMap[src];
        return (
          <View key={src} style={hints.row}>
            <Ionicons name="arrow-forward-circle-outline" size={13} color={COLORS.onSurfaceTertiary} />
            <Text style={hints.txt}>{src}</Text>
            {route && (
              <Pressable onPress={() => router.push(route as any)}>
                <Text style={hints.go}>Go →</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const hints = StyleSheet.create({
  box: { marginTop: 8, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
  txt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 11 },
  go:  { color: "#2DD4BF", fontSize: 11, fontWeight: "700" },
});

// ── Upgrade card ─────────────────────────────────────────────────────────────

function UpgradeCard({
  upg,
  player,
  onUpgrade,
  router,
}: {
  upg: SkillUpgradeDef;
  player: any;
  onUpgrade: (id: string) => Promise<{ ok: boolean; message: string }>;
  router: ReturnType<typeof useRouter>;
}) {
  const currentRank = (player.hero_skill_upgrades ?? {})[upg.id] ?? 0;
  const isMaxRank   = currentRank >= upg.maxRank;
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const rankDef = !isMaxRank ? upg.ranks[currentRank] : null;

  // Compute requirement rows for next rank
  const inv = player.inventory ?? {};
  const uc  = player.university_credits ?? 0;
  const heroLevel = maxHeroLevel(player);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  }

  async function handleUpgrade() {
    if (busy || isMaxRank) return;
    setBusy(true);
    const res = await onUpgrade(upg.id);
    setBusy(false);
    showToast(res.message, res.ok);
  }

  const missing = !isMaxRank ? getMissingMaterials(player, upg.id) : [];
  const canBuy  = !isMaxRank && missing.length === 0;

  return (
    <View style={[card.wrap, { borderColor: upg.accentColor + "40" }]}>
      {/* Header row */}
      <View style={card.header}>
        <View style={[card.iconBg, { backgroundColor: upg.accentColor + "1A" }]}>
          <Ionicons name={upg.icon as any} size={18} color={upg.accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={card.name}>{upg.name}</Text>
            {isMaxRank && (
              <View style={[card.maxBadge, { backgroundColor: upg.accentColor + "22" }]}>
                <Text style={[card.maxBadgeTxt, { color: upg.accentColor }]}>MAX</Text>
              </View>
            )}
          </View>
          <View style={[card.catBadge, { backgroundColor: upg.accentColor + "22" }]}>
            <Text style={[card.catTxt, { color: upg.accentColor }]}>{upg.categoryLabel}</Text>
          </View>
        </View>
        <RankDots currentRank={currentRank} maxRank={upg.maxRank} color={upg.accentColor} />
      </View>

      {/* Description */}
      <Text style={card.desc}>{upg.description}</Text>

      {/* Current active effect summary */}
      {currentRank > 0 && !isMaxRank && (
        <View style={card.activeBox}>
          <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
          <Text style={card.activeTxt}>Active: {upg.ranks[currentRank - 1].battleEffect}</Text>
        </View>
      )}
      {isMaxRank && (
        <View style={card.activeBox}>
          <Ionicons name="checkmark-circle" size={12} color={upg.accentColor} />
          <Text style={[card.activeTxt, { color: upg.accentColor }]}>
            {upg.ranks[upg.maxRank - 1].battleEffect}
          </Text>
        </View>
      )}

      {/* Next rank section */}
      {rankDef && (
        <View style={card.nextBox}>
          <View style={card.nextHeaderRow}>
            <Ionicons name="arrow-up-circle-outline" size={14} color={upg.accentColor} />
            <Text style={[card.nextLabel, { color: upg.accentColor }]}>
              UPGRADE → {rankDef.label}
            </Text>
          </View>
          <Text style={card.nextEffect}>{rankDef.description}</Text>
          <Text style={[card.battleEffect, { color: upg.accentColor + "CC" }]}>
            {rankDef.battleEffect}
          </Text>

          {/* Requirements */}
          <View style={{ marginTop: 8 }}>
            {rankDef.requirements.cue_scroll != null && (
              <ReqRow label="Cue Scrolls"              have={inv.cue_scroll ?? 0}        need={rankDef.requirements.cue_scroll}        color={upg.accentColor} />
            )}
            {rankDef.requirements.triage_scroll != null && (
              <ReqRow label="Triage Scrolls"           have={inv.triage_scroll ?? 0}     need={rankDef.requirements.triage_scroll}     color={upg.accentColor} />
            )}
            {rankDef.requirements.stab_scroll != null && (
              <ReqRow label="Stabilization Scrolls"    have={inv.stab_scroll ?? 0}       need={rankDef.requirements.stab_scroll}       color={upg.accentColor} />
            )}
            {rankDef.requirements.lesson_note != null && (
              <ReqRow label="Lesson Notes"             have={inv.lesson_note ?? 0}       need={rankDef.requirements.lesson_note}       color={upg.accentColor} />
            )}
            {rankDef.requirements.care_chain_manual != null && (
              <ReqRow label="Care Chain Manual"        have={inv.care_chain_manual ?? 0} need={rankDef.requirements.care_chain_manual} color={upg.accentColor} />
            )}
            {rankDef.requirements.hero_training_page != null && (
              <ReqRow label="Hero Training Pages"      have={inv.hero_training_page ?? 0}need={rankDef.requirements.hero_training_page}color={upg.accentColor} />
            )}
            <ReqRow
              label={`University Credits`}
              have={uc}
              need={rankDef.requirements.university_credits}
              color={upg.accentColor}
            />
            <ReqRow
              label={`Hero Level ${rankDef.requirements.hero_level}`}
              have={heroLevel}
              need={rankDef.requirements.hero_level}
              color={upg.accentColor}
            />
          </View>

          {/* Missing material hints */}
          {missing.length > 0 && (
            <MissingHints upgradeId={upg.id} player={player} router={router} />
          )}

          {/* Upgrade button */}
          <Pressable
            style={[card.btn, { backgroundColor: canBuy ? upg.accentColor : upg.accentColor + "33" }, busy && { opacity: 0.6 }]}
            onPress={handleUpgrade}
            disabled={!canBuy || busy}
          >
            <Ionicons name="arrow-up-circle" size={16} color={canBuy ? "#000" : upg.accentColor + "88"} />
            <Text style={[card.btnTxt, { color: canBuy ? "#000" : upg.accentColor + "88" }]}>
              {busy ? "Upgrading…" : `Upgrade to ${rankDef.label}`}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Toast feedback */}
      {toast && (
        <View style={[card.toast, { backgroundColor: toast.ok ? "#22C55E22" : "#EF444422", borderColor: toast.ok ? "#22C55E66" : "#EF444466" }]}>
          <Ionicons name={toast.ok ? "checkmark-circle" : "alert-circle-outline"} size={13} color={toast.ok ? "#22C55E" : "#EF4444"} />
          <Text style={[card.toastTxt, { color: toast.ok ? "#22C55E" : "#EF4444" }]}>{toast.msg}</Text>
        </View>
      )}
    </View>
  );
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  iconBg: { width: 38, height: 38, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  name:   { fontSize: 15, fontWeight: "700", color: COLORS.onSurface, marginBottom: 4 },
  catBadge: { alignSelf: "flex-start", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  catTxt:   { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  maxBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  maxBadgeTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  desc: { fontSize: 12, color: COLORS.onSurfaceSecondary, lineHeight: 17, marginBottom: 8 },
  activeBox: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8, backgroundColor: "#22C55E11", borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 5 },
  activeTxt: { fontSize: 11, color: "#22C55E", flex: 1 },
  nextBox: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: 12,
    marginTop: 4,
  },
  nextHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  nextLabel:  { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  nextEffect: { fontSize: 12, color: COLORS.onSurfaceSecondary, marginBottom: 4 },
  battleEffect: { fontSize: 11, fontStyle: "italic", marginBottom: 4 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
  },
  btnTxt: { fontSize: 13, fontWeight: "700" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
  },
  toastTxt: { fontSize: 12, fontWeight: "600", flex: 1 },
});

// ── Active team preview ───────────────────────────────────────────────────────

function TeamPreview({ player }: { player: any }) {
  const teamIds = (player.active_team?.length > 0 ? player.active_team : player.heroes_owned ?? []).slice(0, 3);
  if (teamIds.length === 0) return null;

  return (
    <View style={team.row}>
      <Ionicons name="people-outline" size={13} color={COLORS.onSurfaceTertiary} />
      <Text style={team.label}>Active team benefits from these upgrades in battle:</Text>
      <View style={team.heroes}>
        {teamIds.map((id: string) => {
          const hero = HEROES.find(h => h.id === id);
          if (!hero) return null;
          return (
            <View key={id} style={[team.badge, { backgroundColor: COLORS.surfaceSecondary }]}>
              <Text style={team.heroName}>{hero.name.split(" ")[0]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const team = StyleSheet.create({
  row:    { gap: 5, marginBottom: 14 },
  label:  { fontSize: 11, color: COLORS.onSurfaceTertiary },
  heroes: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 3 },
  badge:  { borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4 },
  heroName:{ fontSize: 11, color: COLORS.onSurface, fontWeight: "600" },
});

// ── Main screen ──────────────────────────────────────────────────────────────

export default function SkillAcademy() {
  const router = useRouter();
  const { player, loading, upgradeHeroSkill } = usePlayer();

  if (loading || !player) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface }}>
        <Text style={{ color: COLORS.onSurfaceTertiary }}>Loading…</Text>
      </View>
    );
  }

  const hasHeroes = (player.heroes_owned ?? []).length > 0;
  const heroLevel = maxHeroLevel(player);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Hero Skill Academy</Text>
          <Text style={styles.subtitle}>Convert learning into stronger clinical support skills</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Explainer */}
        <View style={styles.explainer}>
          <Ionicons name="information-circle-outline" size={15} color="#2DD4BF" />
          <Text style={styles.explainerTxt}>
            Practice at University labs earns Scrolls and Manuals. Spend them here to improve your heroes' skills for Ward Shifts and mini-boss battles.
          </Text>
        </View>

        {/* Material inventory */}
        <MaterialStrip inventory={player.inventory ?? {}} uc={player.university_credits ?? 0} />

        {/* Locked state — no heroes yet */}
        {!hasHeroes ? (
          <View style={styles.lockedBox}>
            <Ionicons name="lock-closed-outline" size={36} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.lockedTitle}>Healers Not Yet Recruited</Text>
            <Text style={styles.lockedDesc}>
              Skill upgrades apply to your hero team. Recruit your first healers from the Summoning Hall or complete Lotus Lessons to earn loaner heroes, then return here to upgrade their skills.
            </Text>
            <Pressable style={styles.lockedBtn} onPress={() => router.push("/university/lessons" as any)}>
              <Ionicons name="book-outline" size={14} color="#2DD4BF" />
              <Text style={styles.lockedBtnTxt}>Go to Lotus Lessons</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Team preview */}
            <TeamPreview player={player} />

            {/* Hero level context */}
            {heroLevel < 2 && (
              <View style={[styles.explainer, { backgroundColor: "#F59E0B11", borderColor: "#F59E0B33" }]}>
                <Ionicons name="trending-up-outline" size={14} color="#F59E0B" />
                <Text style={[styles.explainerTxt, { color: "#F59E0B" }]}>
                  Most upgrades require a hero at Level 2+. Battle and train your healers to unlock higher ranks.
                </Text>
              </View>
            )}

            {/* Upgrade cards */}
            {SKILL_UPGRADES.map(upg => (
              <UpgradeCard
                key={upg.id}
                upg={upg}
                player={player}
                onUpgrade={upgradeHeroSkill}
                router={router}
              />
            ))}
          </>
        )}

        {/* Footer — back to practice */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Need more materials?</Text>
          <View style={styles.footerBtns}>
            <Pressable style={styles.footerBtn} onPress={() => router.push("/university/cue-lab" as any)}>
              <Ionicons name="eye-outline" size={13} color="#2DD4BF" />
              <Text style={[styles.footerBtnTxt, { color: "#2DD4BF" }]}>Cue Lab</Text>
            </Pressable>
            <Pressable style={styles.footerBtn} onPress={() => router.push("/university/triage-hall" as any)}>
              <Ionicons name="flash-outline" size={13} color="#F59E0B" />
              <Text style={[styles.footerBtnTxt, { color: "#F59E0B" }]}>Triage Hall</Text>
            </Pressable>
            <Pressable style={styles.footerBtn} onPress={() => router.push("/university/stack-lab" as any)}>
              <Ionicons name="layers-outline" size={13} color="#22D3EE" />
              <Text style={[styles.footerBtnTxt, { color: "#22D3EE" }]}>Stack Lab</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: COLORS.surface },
  header:   { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: SPACING.md, paddingTop: 8, paddingBottom: 12 },
  backBtn:  { padding: 4 },
  title:    { fontSize: 20, fontWeight: "800", color: COLORS.onSurface },
  subtitle: { fontSize: 12, color: COLORS.onSurfaceTertiary, marginTop: 2 },
  scroll:   { flex: 1 },
  content:  { paddingHorizontal: SPACING.md, paddingTop: 4 },

  explainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#2DD4BF11",
    borderWidth: 1,
    borderColor: "#2DD4BF33",
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 14,
  },
  explainerTxt: { flex: 1, fontSize: 12, color: COLORS.onSurfaceSecondary, lineHeight: 18 },

  lockedBox: {
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 32,
    marginTop: 8,
  },
  lockedTitle: { fontSize: 16, fontWeight: "700", color: COLORS.onSurface, textAlign: "center" },
  lockedDesc:  { fontSize: 13, color: COLORS.onSurfaceSecondary, textAlign: "center", lineHeight: 19 },
  lockedBtn:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#2DD4BF22", borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 10 },
  lockedBtnTxt:{ fontSize: 13, fontWeight: "700", color: "#2DD4BF" },

  footer: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 14, marginTop: 8 },
  footerTitle: { fontSize: 11, fontWeight: "700", color: COLORS.onSurfaceTertiary, marginBottom: 8, letterSpacing: 0.6 },
  footerBtns:  { flexDirection: "row", gap: 8 },
  footerBtn:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.sm, paddingVertical: 9 },
  footerBtnTxt:{ fontSize: 11, fontWeight: "700" },
});
