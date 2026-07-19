import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HEROES } from "@/src/game/content";
import { getProgress } from "@/src/game/evolution";
import {
  levelCapForStar,
  MAX_CERTIFICATION_STAR,
  checkPromotion,
} from "@/src/game/university";
import { usePlayer } from "@/src/game/store";
import { UniversityCreditsBadge } from "@/src/components/UniversityCreditsBadge";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── Requirement row ──────────────────────────────────────────────────────────
function ReqRow({ label, have, need }: { label: string; have: number; need: number }) {
  const met = have >= need;
  return (
    <View style={rr.row}>
      <Ionicons
        name={met ? "checkmark-circle" : "close-circle-outline"}
        size={13}
        color={met ? "#22C55E" : "#EF4444"}
      />
      <Text style={rr.label}>{label}</Text>
      <Text style={[rr.count, { color: met ? "#22C55E" : "#EF4444" }]}>
        {have} / {need}
      </Text>
    </View>
  );
}

const rr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  label: { flex: 1, color: COLORS.onSurfaceSecondary, fontSize: 11 },
  count: { fontSize: 11, fontWeight: "700" },
});

// ── Main screen ──────────────────────────────────────────────────────────────
export default function TrainingHallScreen() {
  const router = useRouter();
  const { player, trainHero, promoteHeroCert } = usePlayer();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  if (!player) {
    return (
      <SafeAreaView style={[styles.container, styles.loading]} edges={["top"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  const owned = HEROES.filter((h) => player.heroes_owned.includes(h.id));
  const uc = player.university_credits ?? 0;

  const onTrain = async (heroId: string) => {
    if (busyId) return;
    setBusyId(heroId);
    const res = await trainHero(heroId);
    setFeedback((f) => ({ ...f, [heroId]: res.message }));
    setBusyId(null);
  };

  const onPromote = async (heroId: string) => {
    if (busyId) return;
    setBusyId(heroId);
    const res = await promoteHeroCert(heroId);
    setFeedback((f) => ({ ...f, [heroId]: res.message }));
    setBusyId(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} testID="training-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>TRAINING HALL</Text>
        <Text style={styles.title}>Level Up Your Heroes</Text>
        <Text style={styles.sub}>Training is free. Certification Star promotion costs University Credits.</Text>
        <UniversityCreditsBadge amount={uc} testID="training-credits-badge" />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.loopBox} testID="training-loop-explainer">
          <Text style={styles.loopTitle}>HOW HERO GROWTH WORKS</Text>
          <Text style={styles.loopLine}>1. Train here for FREE — each session grants +1 Hero Level.</Text>
          <Text style={styles.loopLine}>2. Training stops at the level cap set by the hero's Certification Star.</Text>
          <Text style={styles.loopLine}>3. When the cap is reached, promote the star here — costs Credits + Shards/Trainees.</Text>
        </View>

        {owned.length === 0 && (
          <View style={styles.emptyBox} testID="training-empty-state">
            <Ionicons name="people-outline" size={32} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.emptyTitle}>No heroes to train yet</Text>
            <Text style={styles.empty}>Heroes join your ward through University Recruitment. Enroll your first healer, then return here to train them.</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push("/university/recruit")} testID="training-empty-recruit-btn">
              <Ionicons name="school" size={14} color={COLORS.onBrand} />
              <Text style={styles.emptyBtnTxt}>GO TO RECRUITMENT HALL</Text>
            </Pressable>
          </View>
        )}

        {owned.map((h) => {
          const prog = getProgress(player.hero_progression, h.id);
          const cap = levelCapForStar(prog.star);
          const level = prog.level ?? 1;
          const pct = Math.min(1, level / cap);
          const accent = ELEMENT_COLORS[h.element] ?? COLORS.brand;
          const atCap = level >= cap;
          const atMaxStar = prog.star >= MAX_CERTIFICATION_STAR;
          const isBusy = busyId === h.id;

          // Compute promotion eligibility whenever at cap and not max star
          const promCheck = (atCap && !atMaxStar)
            ? checkPromotion(h.role, prog, player)
            : null;

          return (
            <View key={h.id} style={[styles.card, { borderLeftColor: accent }]} testID={`training-hero-${h.id}`}>
              {/* Header */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{h.name}</Text>
                <Text style={[styles.cardStar, { color: accent }]}>★{prog.star}</Text>
              </View>
              <Text style={styles.cardRole}>{h.role} · {h.element}</Text>

              {/* Level bar */}
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: accent }]} />
              </View>
              <Text style={styles.levelTxt}>Level {level} / {cap}</Text>

              {/* Train button — only shown when not at cap */}
              {!atCap && (
                <Pressable
                  onPress={() => onTrain(h.id)}
                  disabled={isBusy}
                  style={[styles.trainBtn, { backgroundColor: isBusy ? accent + "66" : accent }]}
                  testID={`training-train-btn-${h.id}`}
                >
                  <Ionicons name="school-outline" size={14} color={COLORS.surface} />
                  <Text style={[styles.trainBtnTxt, { color: COLORS.surface }]}>
                    {isBusy ? "Training…" : "Train (+1 Level)"}
                  </Text>
                </Pressable>
              )}

              {/* Fully maxed */}
              {atCap && atMaxStar && (
                <View style={styles.maxRow}>
                  <Ionicons name="trophy-outline" size={14} color={accent} />
                  <Text style={[styles.maxTxt, { color: accent }]}>Fully certified — max star and level cap reached.</Text>
                </View>
              )}

              {/* Certification promotion section */}
              {atCap && !atMaxStar && promCheck && (
                <View style={[styles.promoteBox, { borderColor: accent + "44" }]}>
                  <View style={styles.promoteHeader}>
                    <Ionicons name="arrow-up-circle-outline" size={15} color={accent} />
                    <Text style={[styles.promoteTitle, { color: accent }]}>
                      PROMOTE TO ★{prog.star + 1} CERTIFICATION
                    </Text>
                  </View>
                  <Text style={styles.promoteCaption}>
                    Raises the level cap to {levelCapForStar(prog.star + 1)}. Costs Credits + materials.
                  </Text>

                  {/* Requirements */}
                  <View style={styles.reqBlock}>
                    <ReqRow
                      label={`Hero Level ${promCheck.levelNeeded}`}
                      have={promCheck.level}
                      need={promCheck.levelNeeded}
                    />
                    {promCheck.req?.shardsOrTrainees ? (
                      <ReqRow
                        label={`Hero Shards OR ${promCheck.trainee.label}s`}
                        have={Math.max(promCheck.shardsHave, promCheck.trainHave)}
                        need={Math.min(promCheck.shardsNeeded, promCheck.trainNeeded)}
                      />
                    ) : (
                      <>
                        <ReqRow
                          label={`Hero Shards (${promCheck.shardsNeeded} needed)`}
                          have={promCheck.shardsHave}
                          need={promCheck.shardsNeeded}
                        />
                        <ReqRow
                          label={`${promCheck.trainee.label}s (${promCheck.trainNeeded} needed)`}
                          have={promCheck.trainHave}
                          need={promCheck.trainNeeded}
                        />
                      </>
                    )}
                    <ReqRow
                      label={`University Credits`}
                      have={promCheck.creditsHave}
                      need={promCheck.creditsNeeded}
                    />
                  </View>

                  {/* Missing list or promote button */}
                  {!promCheck.eligible ? (
                    <View style={styles.missingBox}>
                      {promCheck.missing.map((m, i) => (
                        <Text key={i} style={styles.missingTxt}>· {m}</Text>
                      ))}
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => onPromote(h.id)}
                      disabled={isBusy}
                      style={[styles.promoteBtn, { backgroundColor: isBusy ? accent + "66" : accent }]}
                      testID={`training-promote-btn-${h.id}`}
                    >
                      <Ionicons name="arrow-up-circle" size={15} color="#000" />
                      <Text style={styles.promoteBtnTxt}>
                        {isBusy ? "Promoting…" : `Promote to ★${prog.star + 1}`}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}

              {feedback[h.id] && (
                <Text style={[styles.feedback, { color: accent }]}>{feedback[h.id]}</Text>
              )}
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky bottom credits bar */}
      <View style={styles.creditsBar}>
        <View style={styles.creditChip}>
          <Ionicons name="diamond-outline" size={13} color="#D4AF37" />
          <Text style={styles.creditLabel}>University Credits</Text>
          <Text style={styles.creditAmt}>{uc.toLocaleString()}</Text>
        </View>
        <View style={styles.creditChip}>
          <Ionicons name="school-outline" size={13} color={COLORS.brand} />
          <Text style={styles.creditLabel}>Training Pages</Text>
          <Text style={[styles.creditAmt, { color: COLORS.brand }]}>
            {(player.inventory?.hero_training_page ?? 0)}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: 4 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)", marginBottom: SPACING.sm,
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  loopBox: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, gap: 4,
  },
  loopTitle: { color: COLORS.brand, fontSize: 10, letterSpacing: 1.5, fontWeight: "800" },
  loopLine: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },
  emptyBox: { alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.xl },
  emptyTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.brand, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, marginTop: SPACING.xs,
  },
  emptyBtnTxt: { color: COLORS.onBrand, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  empty: { color: COLORS.onSurfaceTertiary, fontSize: 13, textAlign: "center", maxWidth: 300 },

  card: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderLeftWidth: 3,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: 6,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardName: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  cardStar: { fontSize: 13, fontWeight: "800" },
  cardRole: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  barTrack: { height: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceTertiary, overflow: "hidden", marginTop: 4 },
  barFill: { height: "100%", borderRadius: RADIUS.pill },
  levelTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: "600" },

  trainBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm, marginTop: 4,
  },
  trainBtnTxt: { fontSize: 12, fontWeight: "700" },

  maxRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  maxTxt: { fontSize: 11, fontWeight: "600" },

  promoteBox: {
    marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: 10, gap: 6,
  },
  promoteHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  promoteTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  promoteCaption: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15 },
  reqBlock: { gap: 2, marginTop: 4 },

  missingBox: { gap: 3, marginTop: 4 },
  missingTxt: { color: "#EF4444", fontSize: 11, lineHeight: 16 },

  promoteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm, marginTop: 6,
  },
  promoteBtnTxt: { color: "#000", fontSize: 12, fontWeight: "800" },

  feedback: { fontSize: 11, fontWeight: "600", textAlign: "center" },

  creditsBar: {
    flexDirection: "row", gap: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
  },
  creditChip: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  creditLabel: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 11 },
  creditAmt: { color: "#D4AF37", fontSize: 14, fontWeight: "800" },
});
