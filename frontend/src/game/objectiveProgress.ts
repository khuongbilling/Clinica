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

// ── Objective identifiers ──────────────────────────────────────────────────

export type ObjectiveId =
  | "obj_prologue_done"       // step 1  — complete the prologue shift
  | "obj_recalled"            // step 2  — experience the Recall / post-recall
  | "obj_class_result"        // step 3  — see your Class Result
  | "obj_university_arrived"  // step 4  — enter the University for the first time
  | "obj_cue_hunt_done"       // step 5  — complete Cue Hunt
  | "obj_triage_done"         // step 6  — complete Rapid Triage
  | "obj_stabilize_done"      // step 7  — complete Stabilize Stack
  | "obj_fading_apprentice_done" // step 8 — complete all 3 Fading Apprentice games
  | "obj_lotus_visited"       // step 9  — visit Lotus Lessons
  | "obj_lotus_first_lesson"  // step 10 — complete a Lotus Lesson
  | "obj_recruit_preview"     // step 11 — visit University Recruitment
  | "obj_ward_shift_first"    // step 12 — complete first non-prologue Ward Shift
  | "obj_codex_visited"       // step 13 — open the Codex
  | "obj_realm_visited"       // step 14 — visit the Realm
  | "obj_daily_checkin";      // step 15 — complete first Daily Ward Rounds

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
    title: "Complete Your First Shift",
    description: "Finish the prologue shift and experience the full care chain.",
    xpReward: 10,
  },
  {
    id: "obj_recalled",
    step: 2,
    title: "Experience the Recall",
    description: "Witness the moment that binds you to the System.",
    xpReward: 10,
  },
  {
    id: "obj_class_result",
    step: 3,
    title: "Discover Your Class",
    description: "Learn which clinical path fits your aptitude.",
    xpReward: 10,
  },
  {
    id: "obj_university_arrived",
    step: 4,
    title: "Enter the University",
    description: "Arrive at Clinica University and begin your studies.",
    xpReward: 10,
  },
  {
    id: "obj_cue_hunt_done",
    step: 5,
    title: "Complete Cue Hunt",
    description: "Find all three clinical signs in The Fading Apprentice.",
    xpReward: 10,
  },
  {
    id: "obj_triage_done",
    step: 6,
    title: "Complete Rapid Triage",
    description: "Sort all three patients by urgency without hesitation.",
    xpReward: 10,
  },
  {
    id: "obj_stabilize_done",
    step: 7,
    title: "Complete Stabilize Stack",
    description: "Build the care sequence that saves the Apprentice.",
    xpReward: 10,
  },
  {
    id: "obj_fading_apprentice_done",
    step: 8,
    title: "Complete The Fading Apprentice",
    description: "Finish all three stages of the case chain.",
    xpReward: 10,
  },
  {
    id: "obj_lotus_visited",
    step: 9,
    title: "Open Lotus Lessons",
    description: "Visit the lesson library and choose where to start.",
    xpReward: 10,
  },
  {
    id: "obj_lotus_first_lesson",
    step: 10,
    title: "Complete a Lotus Lesson",
    description: "Finish your first structured learning lesson.",
    xpReward: 10,
  },
  {
    id: "obj_recruit_preview",
    step: 11,
    title: "Visit Recruitment",
    description: "See the Recruitment Hall where healers are summoned.",
    xpReward: 10,
  },
  {
    id: "obj_ward_shift_first",
    step: 12,
    title: "Run a Ward Shift",
    description: "Complete your first real clinical shift outside the prologue.",
    xpReward: 10,
  },
  {
    id: "obj_codex_visited",
    step: 13,
    title: "Open the Codex",
    description: "Browse the Research Library and read a clinical entry.",
    xpReward: 10,
  },
  {
    id: "obj_realm_visited",
    step: 14,
    title: "Visit Your Sanctuary",
    description: "Enter your Realm and see the world you are building.",
    xpReward: 10,
  },
  {
    id: "obj_daily_checkin",
    step: 15,
    title: "Complete Daily Ward Rounds",
    description: "Finish your first daily objective loop.",
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
