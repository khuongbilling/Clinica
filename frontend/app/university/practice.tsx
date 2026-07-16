// ─────────────────────────────────────────────────────────────────────────────
// Push 4 — University Practice Curriculum
//
// Structured 3-track learning path that turns the existing repeatable
// mini-games (Cue Lab, Triage Hall, Stack Lab) into a guided progression
// with module-level one-time rewards and a first-visit guided intro.
// ─────────────────────────────────────────────────────────────────────────────

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NarratorGuide } from "@/src/components/NarratorGuide";
import { InlineNotice, useInlineNotice } from "@/src/components/WebAlert";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { goBack } from "@/src/utils/navigation";
import { usePlayer } from "@/src/game/store";
import {
  CURRICULUM_TRACKS,
  CurriculumModule,
  CurriculumTrack,
  countCompletedModules,
  getActivityCount,
  getNextRecommendedModule,
  getTrackProgress,
  isModuleComplete,
  isModuleReadyToClaim,
  ALL_CURRICULUM_MODULES,
} from "@/src/game/practiceCurriculum";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── helper ────────────────────────────────────────────────────────────────────

function diffLabel(kind: string): string {
  return kind === "cue_lab" ? "Cue Lab" : kind === "triage" ? "Triage Hall" : "Stack Lab";
}

// ── sub-components ────────────────────────────────────────────────────────────

function ModuleCard({
  module,
  track,
  player,
  onPlay,
  onClaim,
  busy,
}: {
  module: CurriculumModule;
  track: CurriculumTrack;
  player: any;
  onPlay: (route: string) => void;
  onClaim: (moduleId: string) => void;
  busy: boolean;
}) {
  const done = isModuleComplete(player, module);
  const ready = isModuleReadyToClaim(player, module);
  const currentCount = getActivityCount(player, module.activity.kind);

  return (
    <View
      style={[
        styles.moduleCard,
        done && styles.moduleCardDone,
        ready && !done && styles.moduleCardReady,
      ]}
    >
      {/* Title row */}
      <View style={styles.moduleTitleRow}>
        <View
          style={[
            styles.moduleIconWrap,
            { backgroundColor: track.accentColor + "1A" },
            done && { backgroundColor: COLORS.success + "1A" },
          ]}
        >
          <Ionicons
            name={done ? "checkmark-circle" : (track.icon as any)}
            size={14}
            color={done ? COLORS.success : track.accentColor}
          />
        </View>
        <Text style={[styles.moduleTitle, done && styles.moduleTitleDone]}>
          {module.title}
        </Text>
        {done && (
          <View style={styles.completePill}>
            <Text style={styles.completePillTxt}>DONE</Text>
          </View>
        )}
        {ready && !done && (
          <View style={[styles.completePill, { backgroundColor: COLORS.success + "1A", borderColor: COLORS.success + "55" }]}>
            <Text style={[styles.completePillTxt, { color: COLORS.success }]}>CLAIM!</Text>
          </View>
        )}
      </View>

      {/* Summary */}
      {!done && (
        <Text style={styles.moduleSummary}>{module.summary}</Text>
      )}

      {/* Activity row */}
      <View style={styles.activityRow}>
        <View style={styles.activityInfo}>
          <Ionicons
            name={track.icon as any}
            size={12}
            color={track.accentColor}
          />
          <Text style={[styles.activityLabel, { color: track.accentColor }]}>
            {module.activity.label}
          </Text>
        </View>

        {/* Progress fraction */}
        {!done && (
          <Text style={styles.progressFrac}>
            {Math.min(currentCount, module.requiredCount)}/{module.requiredCount} sessions
          </Text>
        )}
      </View>

      {/* Progress bar */}
      {!done && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(100, (currentCount / module.requiredCount) * 100)}%` as any,
                backgroundColor: ready ? COLORS.success : track.accentColor,
              },
            ]}
          />
        </View>
      )}

      {/* Reward row */}
      {!done && (
        <View style={styles.rewardRow}>
          <Ionicons name="school-outline" size={11} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.rewardTxt}>
            +{module.reward.universityCredits} Credits · +{module.reward.playerXp} XP
            {module.reward.codexShards ? ` · +${module.reward.codexShards} Shards` : ""}
          </Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.moduleActions}>
        <Pressable
          style={[styles.playBtn, { borderColor: track.accentColor + "55" }]}
          onPress={() => onPlay(module.activity.route)}
        >
          <Ionicons name="play-circle-outline" size={14} color={track.accentColor} />
          <Text style={[styles.playBtnTxt, { color: track.accentColor }]}>
            {done ? "Play Again" : "Start Activity"}
          </Text>
        </Pressable>

        {ready && !done && (
          <Pressable
            style={styles.claimBtn}
            onPress={() => onClaim(module.id)}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color={COLORS.onBrand} />
            ) : (
              <>
                <Ionicons name="gift-outline" size={14} color={COLORS.onBrand} />
                <Text style={styles.claimBtnTxt}>Claim Reward</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function TrackSection({
  track,
  player,
  onPlay,
  onClaim,
  busy,
  defaultOpen,
}: {
  track: CurriculumTrack;
  player: any;
  onPlay: (route: string) => void;
  onClaim: (moduleId: string) => void;
  busy: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const prog = getTrackProgress(player, track.id);

  return (
    <View style={styles.trackSection}>
      <Pressable style={styles.trackHeader} onPress={() => setOpen((o) => !o)}>
        <View style={[styles.trackIconBig, { backgroundColor: track.accentColor + "15" }]}>
          <Ionicons name={track.icon as any} size={18} color={track.accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.trackTitle}>{track.title}</Text>
          <Text style={styles.trackSub}>{track.subtitle}</Text>
        </View>
        <View style={styles.trackProgress}>
          <Text style={[styles.trackProgressTxt, { color: track.accentColor }]}>
            {prog.completed}/{prog.total}
          </Text>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={14}
            color={COLORS.onSurfaceTertiary}
          />
        </View>
      </Pressable>

      {/* Dot progress strip */}
      <View style={styles.dotStrip}>
        {track.modules.map((m, i) => {
          const done = isModuleComplete(player, m);
          const ready = isModuleReadyToClaim(player, m);
          return (
            <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
              {i > 0 && (
                <View
                  style={[
                    styles.dotLine,
                    done && { backgroundColor: COLORS.success },
                  ]}
                />
              )}
              <View
                style={[
                  styles.dot,
                  done && { backgroundColor: COLORS.success, borderColor: COLORS.success },
                  ready && !done && { borderColor: COLORS.success },
                  !done && !ready && { borderColor: track.accentColor + "55" },
                ]}
              >
                {done && <Ionicons name="checkmark" size={8} color={COLORS.surface} />}
              </View>
            </View>
          );
        })}
      </View>

      {open && (
        <View style={styles.moduleList}>
          {track.modules.map((m) => (
            <ModuleCard
              key={m.id}
              module={m}
              track={track}
              player={player}
              onPlay={onPlay}
              onClaim={onClaim}
              busy={busy}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function PracticeCurriculumScreen() {
  const router = useRouter();
  const { player, claimPracticeModule, markPracticeCurriculumSeen } = usePlayer();
  const { notice, flashNotice } = useInlineNotice();
  const [busy, setBusy] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  // Show intro on first visit
  useFocusEffect(
    useCallback(() => {
      if (player && !player.seen_practice_curriculum) {
        setShowIntro(true);
      }
    }, [player?.seen_practice_curriculum]),
  );

  const dismissIntro = useCallback(async () => {
    setShowIntro(false);
    await markPracticeCurriculumSeen();
  }, [markPracticeCurriculumSeen]);

  const handlePlay = useCallback(
    (route: string) => {
      router.push(route as any);
    },
    [router],
  );

  const handleClaim = useCallback(
    async (moduleId: string) => {
      if (busy) return;
      setBusy(true);
      try {
        const res = await claimPracticeModule(moduleId);
        flashNotice(res.message);
      } finally {
        setBusy(false);
      }
    },
    [busy, claimPracticeModule, flashNotice],
  );

  if (!player) {
    return (
      <SafeAreaView style={[styles.container, styles.loading]} edges={["top"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  const totalDone = countCompletedModules(player);
  const totalModules = ALL_CURRICULUM_MODULES.length;
  const nextModule = getNextRecommendedModule(player);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PlayerHeader player={player} />

      {/* Hero banner */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[COLORS.brandTertiary, COLORS.surface]}
          style={StyleSheet.absoluteFillObject}
        />
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/university")}
          testID="practice-back"
        >
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>CLINICA UNIVERSITY</Text>
        <Text style={styles.title}>Practice Curriculum</Text>
        <Text style={styles.sub}>
          Structured drills that build the three core clinical skills —
          assessment, prioritisation, and sequencing.
        </Text>

        {/* Overall progress chip */}
        <View style={styles.overallProgress}>
          <Ionicons name="trophy-outline" size={13} color="#D4AF37" />
          <Text style={styles.overallProgressTxt}>
            {totalDone}/{totalModules} modules complete
          </Text>
          {totalDone > 0 && (
            <View style={styles.overallBar}>
              <View
                style={[
                  styles.overallFill,
                  { width: `${Math.round((totalDone / totalModules) * 100)}%` as any },
                ]}
              />
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* First-visit guided intro */}
        {showIntro && (
          <View style={{ marginBottom: SPACING.md }}>
            <NarratorGuide
              message="The Practice Curriculum is your personal training regimen. Each track focuses on one core clinical skill. Work through the modules in any order — every module links to a practice activity and awards a one-time reward when you've completed enough sessions."
              objective="Start with any module. Complete its activity, then claim your reward."
              ctaLabel="Got it"
              onPress={dismissIntro}
            />
          </View>
        )}

        <InlineNotice notice={notice} icon="checkmark-circle-outline" testID="practice-notice" />

        {/* "Next recommended" highlight strip */}
        {nextModule && !isModuleComplete(player, nextModule) && (
          <View style={styles.nextStrip}>
            <Ionicons name="arrow-forward-circle-outline" size={16} color={COLORS.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nextLabel}>RECOMMENDED NEXT</Text>
              <Text style={styles.nextTitle} numberOfLines={1}>{nextModule.title}</Text>
            </View>
            <Pressable
              style={styles.nextBtn}
              onPress={() => handlePlay(nextModule.activity.route)}
            >
              <Text style={styles.nextBtnTxt}>Start</Text>
            </Pressable>
          </View>
        )}

        {/* Tracks */}
        {CURRICULUM_TRACKS.map((track, i) => (
          <TrackSection
            key={track.id}
            track={track}
            player={player}
            onPlay={handlePlay}
            onClaim={handleClaim}
            busy={busy}
            defaultOpen={i === 0}
          />
        ))}

        {/* Footer note */}
        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={12} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footerTxt}>
            Practice activities can be repeated as many times as you like. Module rewards are claimed once only. Completion also counts toward your daily University duty.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  loading:   { justifyContent: "center", alignItems: "center" },
  scroll:    { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 60 },

  // Hero
  hero: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    gap: 4,
    overflow: "hidden",
  },
  backBtn: {
    position: "absolute", top: SPACING.sm, left: SPACING.sm,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center", justifyContent: "center", zIndex: 10,
  },
  kicker: { color: COLORS.brand, fontSize: 10, fontWeight: "800", letterSpacing: 2, marginTop: 36 },
  title:  { color: COLORS.onSurface, fontSize: 22, fontWeight: "800", lineHeight: 28 },
  sub:    { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18 },

  // Overall progress
  overallProgress: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: SPACING.sm,
  },
  overallProgressTxt: { color: "#D4AF37", fontSize: 12, fontWeight: "700" },
  overallBar: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, overflow: "hidden",
  },
  overallFill: { height: 4, backgroundColor: "#D4AF37", borderRadius: 2 },

  // Next recommended strip
  nextStrip: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.brand + "0E",
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.brand + "30",
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  nextLabel: { color: COLORS.brand, fontSize: 8, fontWeight: "800", letterSpacing: 1.5 },
  nextTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700" },
  nextBtn: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  nextBtnTxt: { color: COLORS.onBrand, fontSize: 12, fontWeight: "700" },

  // Track section
  trackSection: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: SPACING.xs,
  },
  trackHeader: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    padding: SPACING.md,
  },
  trackIconBig: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  trackTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "700" },
  trackSub:   { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 1 },
  trackProgress: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  trackProgressTxt: { fontSize: 13, fontWeight: "800" },

  // Dot strip
  dotStrip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm,
    gap: 0,
  },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  dotLine: { flex: 1, height: 2, backgroundColor: COLORS.border, minWidth: 20 },

  // Module list
  moduleList: { paddingHorizontal: SPACING.sm, paddingBottom: SPACING.sm, gap: SPACING.xs },

  // Module card
  moduleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.sm, gap: SPACING.xs,
  },
  moduleCardDone:  { opacity: 0.7, borderColor: COLORS.onSurfaceTertiary + "25" },
  moduleCardReady: { borderColor: COLORS.success + "55", backgroundColor: COLORS.success + "06" },

  moduleTitleRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  moduleIconWrap: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  moduleTitle:     { flex: 1, color: COLORS.onSurface, fontSize: 13, fontWeight: "700" },
  moduleTitleDone: { color: COLORS.onSurfaceTertiary },
  completePill: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: RADIUS.pill, borderWidth: 1,
    borderColor: COLORS.onSurfaceTertiary + "40",
    backgroundColor: COLORS.onSurfaceTertiary + "15",
  },
  completePillTxt: {
    color: COLORS.onSurfaceTertiary, fontSize: 8, fontWeight: "800", letterSpacing: 1,
  },

  moduleSummary: {
    color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 16,
  },

  activityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  activityInfo: { flexDirection: "row", alignItems: "center", gap: 4 },
  activityLabel: { fontSize: 11, fontWeight: "600" },
  progressFrac: { color: COLORS.onSurfaceTertiary, fontSize: 10 },

  progressBar: {
    height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, overflow: "hidden",
  },
  progressFill: { height: 4, borderRadius: 2 },

  rewardRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  rewardTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10 },

  moduleActions: { flexDirection: "row", gap: SPACING.xs, marginTop: 2 },
  playBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    borderWidth: 1, borderRadius: RADIUS.sm,
    paddingVertical: 7,
  },
  playBtnTxt: { fontSize: 12, fontWeight: "700" },
  claimBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.sm, paddingVertical: 7,
  },
  claimBtnTxt: { color: COLORS.onBrand, fontSize: 12, fontWeight: "700" },

  // Footer
  footer: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    paddingHorizontal: SPACING.xs, marginTop: SPACING.sm,
  },
  footerTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 14 },
});
