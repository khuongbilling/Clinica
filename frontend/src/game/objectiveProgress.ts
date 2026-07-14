/**
 * Objective Progress — C1 Tutorial Arc
 *
 * Tracks 15 numbered tutorial objectives (quest steps) that each grant
 * exactly 10 Player XP once on first completion.  Storage is separate from
 * the overlay tutorial system (tutorialStore) so hub-level quests persist
 * independently of in-screen tutorial overlays.
 *
 * Storage key:  clinica.objectives.v1
 * Pattern:      same fail-open AsyncStorage pattern as chainProgress.
 *
 * XP DEDUPLICATION GUARANTEE
 * ───────────────────────────
 * completeObjective(id) is idempotent.  It returns `true` only on the very
 * first call for that id; every subsequent call (replay, revisit, reload)
 * returns `false`.  Callers MUST check the return value before granting XP.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "clinica.objectives.v1";
/** Tracks which objective IDs have had their 10 XP actually paid out.
 *  Separate from completion so we can safely backfill existing players. */
const XP_KEY = "clinica.objectives.xp.v1";

// ── Objective identifiers ──────────────────────────────────────────────────

export type ObjectiveId =
  | "obj_prologue_done"          // step 1  — recall stabilised (end of prologue)
  | "obj_recalled"               // step 2  — meet the System on the main hub
  | "obj_class_result"           // step 3  — complete the class diagnostic
  | "obj_university_arrived"     // step 4  — open Clinica University
  | "obj_cue_hunt_done"          // step 5  — complete Cue Hunt
  | "obj_triage_done"            // step 6  — complete Rapid Triage
  | "obj_stabilize_done"         // step 7  — complete Stabilize Stack
  | "obj_fading_apprentice_done" // step 8  — complete all 3 Fading Apprentice games
  | "obj_lotus_visited"          // step 9  — continue chapter 1 journey / open lessons
  | "obj_lotus_first_lesson"     // step 10 — complete Lotus Lesson: Hydration Basics
  | "obj_recruit_preview"        // step 11 — visit the Recruitment Hall
  | "obj_ward_shift_first"       // step 12 — complete first simulation shift
  | "obj_codex_visited"          // step 13 — explore the Codex
  | "obj_realm_visited"          // step 14 — visit your Realm Sanctuary
  | "obj_daily_checkin";         // step 15 — complete Daily Ward Rounds

export interface ObjectiveDef {
  id: ObjectiveId;
  step: number;
  title: string;
  description: string;
  xpReward: number;
}

export const OBJECTIVES: ObjectiveDef[] = [
  {
    id: "obj_prologue_done",
    step: 1,
    title: "Recall Stabilized",
    description: "Your story begins. The prologue shift is over — you have been Recalled.",
    xpReward: 10,
  },
  {
    id: "obj_recalled",
    step: 2,
    title: "Meet the System",
    description: "The System introduces itself on the main hub. Your guide has arrived.",
    xpReward: 10,
  },
  {
    id: "obj_class_result",
    step: 3,
    title: "Complete Your Class Diagnostic",
    description: "Discover the clinical path that matches your aptitude.",
    xpReward: 10,
  },
  {
    id: "obj_university_arrived",
    step: 4,
    title: "Open Clinica University",
    description: "Enter Clinica University and meet The Fading Apprentice case chain.",
    xpReward: 10,
  },
  {
    id: "obj_cue_hunt_done",
    step: 5,
    title: "Complete Clinical Cue Hunt",
    description: "Find all three clinical signs hidden in The Fading Apprentice.",
    xpReward: 10,
  },
  {
    id: "obj_triage_done",
    step: 6,
    title: "Complete Rapid Triage",
    description: "Sort all three patients by urgency — fast and decisive.",
    xpReward: 10,
  },
  {
    id: "obj_stabilize_done",
    step: 7,
    title: "Complete Stabilize Stack",
    description: "Build the safe care sequence that keeps the Apprentice alive.",
    xpReward: 10,
  },
  {
    id: "obj_fading_apprentice_done",
    step: 8,
    title: "Complete The Fading Apprenticeship",
    description: "Finish all three stages of the case chain: Cue Hunt, Triage, and Stabilize.",
    xpReward: 10,
  },
  {
    id: "obj_lotus_visited",
    step: 9,
    title: "Continue Chapter 1 Journey",
    description: "Open Lotus Lessons and start the next phase of your Chapter 1 path.",
    xpReward: 10,
  },
  {
    id: "obj_lotus_first_lesson",
    step: 10,
    title: "Complete Lotus Lesson: Hydration Basics",
    description: "Finish your first structured lesson and reinforce what you learned.",
    xpReward: 10,
  },
  {
    id: "obj_recruit_preview",
    step: 11,
    title: "Visit the Recruitment Hall",
    description: "See the Summoning Hall where healers answer the call.",
    xpReward: 10,
  },
  {
    id: "obj_ward_shift_first",
    step: 12,
    title: "Complete First Simulation Shift",
    description: "Run your first real Ward Shift against a live clinical challenge.",
    xpReward: 10,
  },
  {
    id: "obj_codex_visited",
    step: 13,
    title: "Explore the Codex",
    description: "Open the Research Library and read a clinical entry.",
    xpReward: 10,
  },
  {
    id: "obj_realm_visited",
    step: 14,
    title: "Visit Your Realm Sanctuary",
    description: "Enter your Realm and see the kingdom you are building.",
    xpReward: 10,
  },
  {
    id: "obj_daily_checkin",
    step: 15,
    title: "Complete Daily Ward Rounds",
    description: "Finish your first daily objective loop and unlock full progression.",
    xpReward: 10,
  },
];

// ── Storage helpers ────────────────────────────────────────────────────────

type ObjectiveRecord = Partial<Record<ObjectiveId, boolean>>;

async function load(): Promise<ObjectiveRecord> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ObjectiveRecord) : {};
  } catch {
    return {};
  }
}

async function save(record: ObjectiveRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(record));
  } catch {}
}

// ── XP-paid tracking (separate from completion) ────────────────────────────
// completeObjective() records that a step is done.
// markObjectiveXpGranted() records that the 10 XP was actually added to the
// player total.  Keeping them separate lets us backfill existing players who
// completed a step before this XP-grant code was in place.

async function loadXpRecord(): Promise<ObjectiveRecord> {
  try {
    const raw = await AsyncStorage.getItem(XP_KEY);
    return raw ? (JSON.parse(raw) as ObjectiveRecord) : {};
  } catch {
    return {};
  }
}

/** True if 10 XP has already been added to the player for this objective. */
export async function isObjectiveXpGranted(id: ObjectiveId): Promise<boolean> {
  const rec = await loadXpRecord();
  return rec[id] === true;
}

/**
 * Record that 10 XP was just added for this objective.
 * Call immediately after applyRewards / updateState succeeds.
 */
export async function markObjectiveXpGranted(id: ObjectiveId): Promise<void> {
  try {
    const rec = await loadXpRecord();
    rec[id] = true;
    await AsyncStorage.setItem(XP_KEY, JSON.stringify(rec));
  } catch {}
}

/** Returns the set of objective IDs whose XP has been granted. */
export async function getGrantedXpSet(): Promise<Set<ObjectiveId>> {
  const rec = await loadXpRecord();
  return new Set(
    Object.entries(rec)
      .filter(([, v]) => v === true)
      .map(([k]) => k as ObjectiveId),
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Returns the set of completed objective IDs. */
export async function getObjectiveProgress(): Promise<Set<ObjectiveId>> {
  const record = await load();
  return new Set(
    Object.entries(record)
      .filter(([, v]) => v === true)
      .map(([k]) => k as ObjectiveId)
  );
}

/** True if this specific objective has already been completed. */
export async function isObjectiveComplete(id: ObjectiveId): Promise<boolean> {
  const record = await load();
  return record[id] === true;
}

/**
 * Mark an objective as complete.
 *
 * Returns `true` if this is the **first** time this objective is being
 * completed.  Callers should grant 10 XP when the return value is `true`
 * and skip the grant otherwise — this is the sole deduplication mechanism.
 */
export async function completeObjective(id: ObjectiveId): Promise<boolean> {
  const record = await load();
  if (record[id] === true) return false; // already done — no XP
  record[id] = true;
  await save(record);
  return true; // new completion — caller should grant 10 XP
}

/**
 * Returns the first incomplete objective, or null if all are done.
 * Pass the already-loaded completed set to avoid a redundant read.
 */
export function getCurrentObjective(
  completed: Set<ObjectiveId>
): ObjectiveDef | null {
  return OBJECTIVES.find((o) => !completed.has(o.id)) ?? null;
}

/**
 * Returns the def for a specific objective, or null if not found.
 */
export function getObjectiveDef(id: ObjectiveId): ObjectiveDef | null {
  return OBJECTIVES.find((o) => o.id === id) ?? null;
}

/** Full wipe — only for dev/reset flows. */
export async function resetObjectives(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
