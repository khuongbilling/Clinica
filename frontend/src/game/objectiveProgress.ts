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
  | "obj_prologue_done"          // step 1  — prologue battle complete (Recall Stabilized)
  | "obj_lotus_recall"           // step 2  — Lotus Recall cinematic watched
  | "obj_identity_done"          // step 3  — identity restoration complete (name saved)
  | "obj_diagnostic_done"        // step 4  — class diagnostic quiz answered
  | "obj_class_result"           // step 5  — class registered (confirmClassDiagnostic)
  | "obj_memory_seen"            // step 6  — Memory Reminiscence scene completed
  | "obj_university_arrived"     // step 7  — open Clinica University
  | "obj_cue_hunt_done"          // step 8  — complete Cue Hunt
  | "obj_triage_done"            // step 9  — complete Rapid Triage
  | "obj_stabilize_done"         // step 10 — complete Stabilize Stack
  | "obj_fading_apprentice_done" // step 11 — complete all 3 Fading Apprentice games
  | "obj_lotus_visited"          // step 12 — continue chapter 1 journey / open lessons
  | "obj_lotus_first_lesson"     // step 13 — complete Lotus Lesson: Hydration Basics
  | "obj_recruit_preview"        // step 14 — visit the Recruitment Hall
  | "obj_ward_shift_first";      // step 15 — complete first simulation shift

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
    title: "Prologue Battle",
    description: "Your story begins. Face the Silent Infarction and answer the call of the Recall.",
    xpReward: 10,
  },
  {
    id: "obj_lotus_recall",
    step: 2,
    title: "Lotus Recall",
    description: "The patient is gone — but the lotus light draws you back. A second chance begins.",
    xpReward: 10,
  },
  {
    id: "obj_identity_done",
    step: 3,
    title: "Identity Restored",
    description: "The System registers you. Your name and presence are confirmed in the Sanctuary.",
    xpReward: 10,
  },
  {
    id: "obj_diagnostic_done",
    step: 4,
    title: "Class Diagnostic",
    description: "The System reads your instincts and patterns. Your clinical aptitude takes shape.",
    xpReward: 10,
  },
  {
    id: "obj_class_result",
    step: 5,
    title: "Class Registered",
    description: "Your clinical path is confirmed. This is a starting point — not a lock.",
    xpReward: 10,
  },
  {
    id: "obj_memory_seen",
    step: 6,
    title: "Memory Unlocked",
    description: "Fragments of your former life surface. Understand what brought you here.",
    xpReward: 10,
  },
  {
    id: "obj_university_arrived",
    step: 7,
    title: "Open Clinica University",
    description: "Enter Clinica University and meet The Fading Apprentice case chain.",
    xpReward: 10,
  },
  {
    id: "obj_cue_hunt_done",
    step: 8,
    title: "Complete Clinical Cue Hunt",
    description: "Find all three clinical signs hidden in The Fading Apprentice.",
    xpReward: 10,
  },
  {
    id: "obj_triage_done",
    step: 9,
    title: "Complete Rapid Triage",
    description: "Sort all three patients by urgency — fast and decisive.",
    xpReward: 10,
  },
  {
    id: "obj_stabilize_done",
    step: 10,
    title: "Complete Stabilize Stack",
    description: "Build the safe care sequence that keeps the Apprentice alive.",
    xpReward: 10,
  },
  {
    id: "obj_fading_apprentice_done",
    step: 11,
    title: "Complete The Fading Apprenticeship",
    description: "Finish all three stages of the case chain: Cue Hunt, Triage, and Stabilize.",
    xpReward: 10,
  },
  {
    id: "obj_lotus_visited",
    step: 12,
    title: "Continue Chapter 1 Journey",
    description: "Open Lotus Lessons and start the next phase of your Chapter 1 path.",
    xpReward: 10,
  },
  {
    id: "obj_lotus_first_lesson",
    step: 13,
    title: "Complete Lotus Lesson: Hydration Basics",
    description: "Finish your first structured lesson and reinforce what you learned.",
    xpReward: 10,
  },
  {
    id: "obj_recruit_preview",
    step: 14,
    title: "Visit the Recruitment Hall",
    description: "See the Summoning Hall where healers answer the call.",
    xpReward: 10,
  },
  {
    id: "obj_ward_shift_first",
    step: 15,
    title: "Complete First Simulation Shift",
    description: "Run your first real Ward Shift against a live clinical challenge.",
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

/**
 * Reconcile the first 6 onboarding objectives against PlayerState flags.
 *
 * If a player bypassed a flow step (crash, replay, existing account backfill),
 * the objective may never have been written to `clinica.objectives.v1` even
 * though the PlayerState flag proves the step was completed.  This call fills
 * any such gaps so `getCurrentObjective` never regresses to a step the player
 * already passed.
 *
 * Idempotent — safe to call on every boot.  Only writes to AsyncStorage when
 * at least one gap is found.  Does NOT touch the XP-paid record; the
 * university/index.tsx catch-up grant handles missing XP on first University
 * visit (objectives 1–6 are in its catch-up loop by design).
 *
 * Returns the list of objective IDs that were newly written by this call,
 * so callers that want immediate XP recovery can iterate the list.
 */
export async function reconcileEarlyObjectives(player: {
  prologue_complete?: boolean;
  identity_restored?: boolean;
  diagnostic_intro_seen?: boolean;
  class_tree_id?: string | null;
  seen_reminiscence?: boolean;
  lessons_completed?: string[] | null;
  runs_completed?: number | null;
}): Promise<ObjectiveId[]> {
  try {
    const record = await load();
    const newly: ObjectiveId[] = [];

    const mark = (id: ObjectiveId) => {
      if (!record[id]) { record[id] = true; newly.push(id); }
    };

    // Step 1 — prologue battle finished
    if (player.prologue_complete) mark("obj_prologue_done");
    // Step 2 — Lotus Recall cinematic: no direct flag, but identity_restored
    //           implies the player passed through lotus-recall first
    if (player.identity_restored) mark("obj_lotus_recall");
    // Step 3 — identity name saved
    if (player.identity_restored) mark("obj_identity_done");
    // Step 4 — class diagnostic quiz answered
    if (player.diagnostic_intro_seen) mark("obj_diagnostic_done");
    // Step 5 — class registered (class_tree_id is written by confirmClassDiagnostic;
    //           it is also backfilled by normalizeProgression for legacy accounts,
    //           so diagnostic_intro_seen is the binding gate here)
    if (player.diagnostic_intro_seen && player.class_tree_id) mark("obj_class_result");
    // Step 6 — reminiscence scene completed
    if (player.seen_reminiscence) mark("obj_memory_seen");

    // Steps 12–15 — backfill from later PlayerState flags so existing players
    // whose objective storage never got written (crash, account transfer, etc.)
    // are not hard-blocked at a step they already passed.
    const lotusLessons = player.lessons_completed ?? [];
    const hasLotusLesson = lotusLessons.some((id) => id.startsWith("lotus:"));
    // Step 12 — visited Lotus Lessons (any lotus completion implies the visit)
    if (hasLotusLesson) mark("obj_lotus_visited");
    // Step 13 — completed first Lotus Lesson
    if (hasLotusLesson) mark("obj_lotus_first_lesson");
    // Step 15 — completed first Ward Shift simulation
    if ((player.runs_completed ?? 0) > 0) mark("obj_ward_shift_first");

    if (newly.length > 0) await save(record);
    return newly;
  } catch {
    return [];
  }
}
