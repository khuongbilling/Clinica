/**
 * TutorialQuestPanel — C1 Quest Arc
 *
 * Shown in the University hub to give the player a clear, persistent
 * objective.  During The Fading Apprentice phase it shows all three
 * sub-tasks with live checkmarks.  After completion it shows the next
 * early-game objective (Lotus Lessons, Recruitment, etc.).
 *
 * Props:
 *   chainProg — live ChainProgress from useFocusEffect in the hub
 *   completed — the completed objective Set loaded from objectiveProgress
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ChainProgress } from "@/src/game/chainProgress";
import { ObjectiveId, ObjectiveDef, OBJECTIVES, getCurrentObjective } from "@/src/game/objectiveProgress";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── Fading Apprentice sub-task definitions ────────────────────────────────

const FA_TASKS: {
  label: string;
  doneKey: keyof ChainProgress;
  objId: ObjectiveId;
  accent: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { label: "Cue Hunt",       doneKey: "cueHuntDone",    objId: "obj_cue_hunt_done", accent: "#2DD4BF", icon: "eye-outline"     },
  { label: "Rapid Triage",   doneKey: "rapidTriageDone",objId: "obj_triage_done",   accent: "#F59E0B", icon: "flash-outline"   },
  { label: "Stabilize Stack",doneKey: "stabilizeDone",  objId: "obj_stabilize_done",accent: "#22D3EE", icon: "layers-outline"  },
];

// Next-step guidance after FA is done
const POST_FA_STEPS: { objId: ObjectiveId; icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; hint: string }[] = [
  { objId: "obj_lotus_visited",     icon: "book-outline",     label: "Lotus Lessons",       hint: "Open Lotus Lessons below" },
  { objId: "obj_lotus_first_lesson",icon: "checkmark-circle-outline", label: "Complete a Lesson", hint: "Finish your first Lotus Lesson" },
  { objId: "obj_recruit_preview",   icon: "sparkles-outline", label: "Visit Recruitment",   hint: "See the Recruitment Hall below" },
  { objId: "obj_ward_shift_first",  icon: "pulse-outline",    label: "Run a Ward Shift",    hint: "Head to the Ward and run a Shift" },
  { objId: "obj_codex_visited",     icon: "library-outline",  label: "Open the Codex",      hint: "Browse the Research Library tab" },
  { objId: "obj_realm_visited",     icon: "globe-outline",    label: "Visit Your Sanctuary",hint: "Enter your Realm from the hub" },
  { objId: "obj_daily_checkin",     icon: "calendar-outline", label: "Daily Ward Rounds",   hint: "Complete your first Daily check-in" },
];

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  chainProg: ChainProgress;
  completed: Set<ObjectiveId>;
  onPressNext?: () => void;
}

export function TutorialQuestPanel({ chainProg, completed, onPressNext }: Props) {
  const faComplete = chainProg.stabilizeDone;

  // ── POST-FA MODE: single next-step hint ──────────────────────────────────
  if (faComplete) {
    const next = POST_FA_STEPS.find((s) => !completed.has(s.objId));
    if (!next) return null; // all objectives done — hide panel

    return (
      <View style={styles.wrap}>
        <LinearGradient
          colors={["#0D1A12", "#091410"]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.header}>
          <View style={styles.stepBadge}>
            <Ionicons name="compass-outline" size={10} color="#22C55E" />
            <Text style={styles.stepBadgeTxt}>NEXT OBJECTIVE</Text>
          </View>
        </View>
        <View style={styles.nextRow}>
          <View style={[styles.nextIcon, { backgroundColor: "#22C55E18", borderColor: "#22C55E30" }]}>
            <Ionicons name={next.icon} size={18} color="#22C55E" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.nextLabel}>{next.label}</Text>
            <Text style={styles.nextHint}>{next.hint}</Text>
          </View>
          {onPressNext && (
            <Pressable style={styles.goBtn} onPress={onPressNext}>
              <Ionicons name="arrow-forward" size={14} color="#0B1A18" />
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // ── FA MODE: 3-subtask checklist ─────────────────────────────────────────
  const doneCount = FA_TASKS.filter((t) => chainProg[t.doneKey]).length;
  const allDone = doneCount === FA_TASKS.length;

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={["#0D1E2C", "#091420"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.stepBadge}>
          <Ionicons name="git-branch-outline" size={10} color="#2DD4BF" />
          <Text style={styles.stepBadgeTxt}>FADING APPRENTICE · STEPS 5–8</Text>
        </View>
        <Text style={styles.progress}>{doneCount}/{FA_TASKS.length}</Text>
      </View>

      <Text style={styles.questTitle}>Complete The Fading Apprentice</Text>
      <Text style={styles.questSub}>Finish all three case chain games in order.</Text>

      {/* Sub-task list */}
      <View style={styles.taskList}>
        {FA_TASKS.map((task, i) => {
          const done = !!chainProg[task.doneKey];
          const isNext = !done && (i === 0 || !!chainProg[FA_TASKS[i - 1].doneKey]);
          return (
            <View
              key={task.label}
              style={[
                styles.taskRow,
                done  && { borderColor: task.accent + "40" },
                isNext && { borderColor: task.accent + "60", backgroundColor: task.accent + "08" },
              ]}
            >
              <View style={[
                styles.taskCircle,
                done  && { backgroundColor: task.accent + "20", borderColor: task.accent + "80" },
                isNext && { backgroundColor: task.accent + "14", borderColor: task.accent + "AA" },
              ]}>
                {done
                  ? <Ionicons name="checkmark" size={12} color={task.accent} />
                  : <Ionicons name={task.icon} size={12} color={isNext ? task.accent : COLORS.onSurfaceTertiary} />
                }
              </View>
              <Text style={[
                styles.taskLabel,
                done   && { color: task.accent, textDecorationLine: "line-through", opacity: 0.7 },
                isNext && { color: task.accent, fontWeight: "700" },
                !done && !isNext && { color: COLORS.onSurfaceTertiary, opacity: 0.5 },
              ]}>
                {task.label}
              </Text>
              {isNext && (
                <View style={[styles.nextPip, { backgroundColor: task.accent }]}>
                  <Text style={styles.nextPipTxt}>NOW</Text>
                </View>
              )}
              {done && (
                <View style={[styles.donePip, { borderColor: task.accent + "50" }]}>
                  <Text style={[styles.donePipTxt, { color: task.accent }]}>+10 XP</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {allDone && (
        <View style={styles.completeRow}>
          <Ionicons name="checkmark-circle" size={13} color="#22C55E" />
          <Text style={styles.completeTxt}>Case chain complete — Apprentice is stable!</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    borderRadius: RADIUS.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2DD4BF22",
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2DD4BF14",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: "#2DD4BF30",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stepBadgeTxt: {
    color: "#2DD4BF",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  progress: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    fontWeight: "700",
  },
  questTitle: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: "700",
  },
  questSub: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 11,
    marginTop: -2,
  },
  taskList: { gap: 6 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: "#1E3830",
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  taskCircle: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  taskLabel: {
    flex: 1,
    fontSize: 13,
    color: COLORS.onSurfaceSecondary,
    fontWeight: "500",
  },
  nextPip: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  nextPipTxt: {
    color: "#071018", fontSize: 8, fontWeight: "800", letterSpacing: 1,
  },
  donePip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  donePipTxt: {
    fontSize: 8, fontWeight: "700",
  },
  completeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  completeTxt: {
    color: "#22C55E",
    fontSize: 11,
    fontWeight: "600",
  },

  // Post-FA styles
  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  nextIcon: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  nextLabel: {
    color: COLORS.onSurface, fontSize: 14, fontWeight: "700",
  },
  nextHint: {
    color: COLORS.onSurfaceSecondary, fontSize: 11,
  },
  goBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#22C55E", alignItems: "center", justifyContent: "center",
  },
});
