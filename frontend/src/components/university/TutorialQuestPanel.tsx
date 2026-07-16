/**
 * TutorialQuestPanel — C1 Quest Arc
 *
 * Shown in the University hub during The Fading Apprenticeship arc (step 8 of
 * the canonical 12-step chain).  Shows all three sub-tasks with live checkmarks
 * and individual "Start" CTAs so the player never has to guess what to do next.
 * Once the chain is complete the panel collapses to a single quiet line handled
 * by FaCompleteChip in the parent; this component returns null for that state.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ChainProgress } from "@/src/game/chainProgress";
import { ObjectiveId, OBJECTIVES } from "@/src/game/objectiveProgress";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── Sub-task definitions ──────────────────────────────────────────────────────

type FaTaskKey = "cueHunt" | "triage" | "stabilize";

const FA_TASKS: {
  label: string;
  taskKey: FaTaskKey;
  doneKey: keyof ChainProgress;
  objId: ObjectiveId;
  accent: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  desc: string;
}[] = [
  {
    label: "Cue Hunt",
    taskKey: "cueHunt",
    doneKey: "cueHuntDone",
    objId: "obj_cue_hunt_done",
    accent: "#2DD4BF",
    icon: "eye-outline",
    desc: "Notice the signs before acting",
  },
  {
    label: "Rapid Triage",
    taskKey: "triage",
    doneKey: "rapidTriageDone",
    objId: "obj_triage_done",
    accent: "#F59E0B",
    icon: "flash-outline",
    desc: "Decide what matters first",
  },
  {
    label: "Stabilize Stack",
    taskKey: "stabilize",
    doneKey: "stabilizeDone",
    objId: "obj_stabilize_done",
    accent: "#22D3EE",
    icon: "layers-outline",
    desc: "Put care steps in safe order",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  chainProg: ChainProgress;
  completed: Set<ObjectiveId>;
  /** Called when the player taps "Start" on an incomplete sub-task row. */
  onPressTask?: (taskKey: FaTaskKey) => void;
}

export function TutorialQuestPanel({ chainProg, completed, onPressTask }: Props) {
  // Once the full chain is done the parent renders FaCompleteChip instead.
  if (chainProg.stabilizeDone) return null;

  const doneCount = FA_TASKS.filter((t) => chainProg[t.doneKey]).length;
  const faStep = OBJECTIVES.find((o) => o.id === "obj_fading_apprentice_done");
  const stepLabel = faStep ? `STEP ${faStep.step} OF ${OBJECTIVES.length}` : "STEP 8 OF 12";

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
          <Text style={styles.stepBadgeTxt}>{stepLabel} · FADING APPRENTICE</Text>
        </View>
        <Text style={styles.progress}>{doneCount}/{FA_TASKS.length} Complete</Text>
      </View>

      <Text style={styles.questTitle}>Complete The Fading Apprenticeship</Text>
      <Text style={styles.questSub}>Three challenges. One chain. Build your clinical foundation.</Text>

      {/* Sub-task list */}
      <View style={styles.taskList}>
        {FA_TASKS.map((task, i) => {
          const done  = !!chainProg[task.doneKey];
          // A task is "active" when it's the next one in sequence:
          // first task is always available; subsequent tasks unlock after previous done.
          const isActive = !done && (i === 0 || !!chainProg[FA_TASKS[i - 1].doneKey]);
          const isLocked = !done && !isActive;
          return (
            <View
              key={task.label}
              style={[
                styles.taskRow,
                done    && { borderColor: task.accent + "40" },
                isActive && { borderColor: task.accent + "60", backgroundColor: task.accent + "08" },
                isLocked && { opacity: 0.45 },
              ]}
            >
              {/* Status circle */}
              <View style={[
                styles.taskCircle,
                done    && { backgroundColor: task.accent + "20", borderColor: task.accent + "80" },
                isActive && { backgroundColor: task.accent + "14", borderColor: task.accent + "AA" },
              ]}>
                {done
                  ? <Ionicons name="checkmark" size={12} color={task.accent} />
                  : <Ionicons name={task.icon} size={12} color={isActive ? task.accent : COLORS.onSurfaceTertiary} />
                }
              </View>

              {/* Label + description */}
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={[
                  styles.taskLabel,
                  done    && { color: task.accent, textDecorationLine: "line-through", opacity: 0.7 },
                  isActive && { color: task.accent, fontWeight: "700" },
                  isLocked && { color: COLORS.onSurfaceTertiary },
                ]}>
                  {task.label}
                </Text>
                <Text style={[
                  styles.taskDesc,
                  done    && { opacity: 0.45 },
                  isActive && { color: COLORS.onSurfaceSecondary },
                ]}>
                  {task.desc}
                </Text>
              </View>

              {/* Right-side badge / CTA */}
              {done && (
                <View style={[styles.donePip, { borderColor: task.accent + "50" }]}>
                  <Ionicons name="checkmark-circle" size={10} color={task.accent} />
                  <Text style={[styles.donePipTxt, { color: task.accent }]}>+10 XP</Text>
                </View>
              )}
              {isActive && onPressTask && (
                <Pressable
                  style={[styles.startBtn, { backgroundColor: task.accent }]}
                  onPress={() => onPressTask(task.taskKey)}
                  hitSlop={8}
                >
                  <Text style={styles.startBtnTxt}>Start</Text>
                  <Ionicons name="arrow-forward" size={10} color="#071018" />
                </Pressable>
              )}
              {isLocked && (
                <Ionicons name="lock-closed-outline" size={12} color={COLORS.onSurfaceTertiary} />
              )}
            </View>
          );
        })}
      </View>

      {/* Narrator note */}
      <View style={styles.narratorRow}>
        <Ionicons name="information-circle-outline" size={12} color="#2DD4BF88" />
        <Text style={styles.narratorTxt}>
          Complete all three to advance. Progress saves automatically.
        </Text>
      </View>
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
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  taskCircle: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  taskLabel: {
    fontSize: 13,
    color: COLORS.onSurfaceSecondary,
    fontWeight: "500",
  },
  taskDesc: {
    fontSize: 10,
    color: COLORS.onSurfaceTertiary,
  },
  donePip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  donePipTxt: {
    fontSize: 8, fontWeight: "700",
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  startBtnTxt: {
    color: "#071018",
    fontSize: 10,
    fontWeight: "800",
  },
  narratorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    marginTop: 2,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: "#2DD4BF18",
  },
  narratorTxt: {
    flex: 1,
    color: "#2DD4BF66",
    fontSize: 9,
    lineHeight: 13,
  },
});
