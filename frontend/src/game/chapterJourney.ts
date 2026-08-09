/**
 * Chapter Journey — Phase 1 Map (Chapters 1–10) + Phase 2 Scaffold (Chapters 41–43)
 *
 * Single source of truth for the Chapter Journey Map shell.
 * Chapters 1–8 are University-supervised simulations.
 * Chapter 9 transitions to real-world ward battles.
 * Chapter 10 is the Phase 1 finale.
 *
 * Phase 2 (Chapters 11–40, Books II–IV of Age I) — structural shell defined in
 * journeyHierarchy.ts; chapter content to be added by the narrative team.
 *
 * Phase 2 — Age II: The Outer Wards (Chapters 41–80):
 *   Chapters 41–43 are defined here as skeleton stubs so Age II Book V renders
 *   real nodes.  Chapters 44–80 will be filled in as the narrative expands.
 *
 * ECONOMY: uses only Ward Coins, University Credits, Codex Shards,
 * Lotus Gems, and Refined Lotus Gems. No new currencies added.
 */

import type { AppRoute } from './routes';

// ── Map mode ─────────────────────────────────────────────────────────────────
/**
 * Determines which map renderer is used for a chapter.
 * Default (undefined / 'scrollable_chapter') → existing per-chapter visual maps.
 * 'fogbound_tiles'   → hex tile grid with fog-of-war reveal mechanic.
 * 'branching_triage' → branching decision tree map (coming soon).
 * 'ward_restoration' → restoration/build map (coming soon).
 * 'dual_state'       → day/night or dual-phase map (coming soon).
 */
export type MapMode =
  | 'scrollable_chapter'
  | 'fogbound_tiles'
  | 'branching_triage'
  | 'ward_restoration'
  | 'dual_state';

// ── Part types ───────────────────────────────────────────────────────────────

export type ChapterPartType =
  | "battle"          // Ward Shift simulation or real enemy fight
  | "mini_boss"       // Chapter mini-boss encounter (harder Ward Shift node)
  | "ward_defense"    // Ward Defense wave / encounter node
  | "minigame"        // LEGACY — use "story" type; kept in union for type safety
  | "lesson"          // LEGACY — use "story" type; kept in union for type safety
  | "story"           // Story cutscene / narrative beat (also used for converted challenge/minigame beats)
  | "memory_fragment" // First-memory / recall story beat (anchor nodes for Chapters 1–4)
  | "challenge"       // LEGACY — all challenge nodes converted to story beats; kept for type safety
  | "reflection"      // Post-chapter reflection / debrief beat
  | "reward"          // Chapter reward node
  | "realm"           // Realm task
  | "mode_preview"    // LEGACY — use "story" type; kept in union for type safety
  | "chain"           // LEGACY — use "story" type; kept in union for type safety
  | "community"       // Community Board / public health task (Ch7 placeholder only)
  | "arena";          // LEGACY — use "story" type; kept in union for type safety

// ── Data interfaces ──────────────────────────────────────────────────────────

// ── P7: Inline health scenario (story/reflection/realm placeholder nodes) ─────

export interface NodeScenarioChoice {
  text: string;
  /** True for the single correct answer. */
  correct: boolean;
  /** One-sentence feedback shown after the player selects this choice. */
  feedback: string;
}

/**
 * A relatable everyday health scenario attached to a story / reflection node.
 * Shown as an inline choose-A/B/C panel in ChapterJourneyMap.
 * Completing it (any answer) gates the CLAIM button — no wrong-answer lock.
 */
export interface NodeScenario {
  /** 2–3 sentence relatable health prompt (no clinical jargon). */
  prompt: string;
  /** Optional one-liner grounding the scenario in real-world / healer life. */
  healthHook?: string;
  /** Exactly 3 choices; exactly one should have correct: true. */
  choices: [NodeScenarioChoice, NodeScenarioChoice, NodeScenarioChoice];
}

// ── Part definition ───────────────────────────────────────────────────────────

export interface ChapterPart {
  id: string;
  part: number;         // 1-indexed within the chapter
  type: ChapterPartType;
  title: string;
  description: string;
  icon: string;         // Ionicons glyph
  route?: string;       // deep-link to the actual screen if actionable now
  isPlaceholder?: boolean; // part content not yet built; shell only
  // Reward preview shown on the part card (informational only — actual grants
  // happen inside the destination screen via objectiveProgress/applyRewards)
  rewardXp?: number;
  rewardCredits?: number; // University Credits
  rewardCoins?: number;   // Ward Coins
  rewardShards?: number;  // Codex Shards
  /** P7: Optional inline health scenario that gates the CLAIM button. */
  scenario?: NodeScenario;
}

export interface Chapter {
  number: number;       // 1–10
  id: string;           // "chapter_1" … "chapter_10"
  levelGate: number;    // minimum Player Level required to unlock
  theme: string;        // short thematic label
  purpose: string;      // clinical/gameplay purpose
  accentColor: string;  // ui accent per chapter
  icon: string;         // Ionicons chapter icon
  parts: ChapterPart[];
  phaseFinale?: boolean;         // true for Ch.10
  realWorldTransition?: boolean; // true for Ch.9
  simulationEra?: boolean;       // true for Ch.1–8 (University-supervised simulations)
  /**
   * Push 9: Which map renderer to use for this chapter.
   * Defaults to 'scrollable_chapter' (existing visual maps) when undefined.
   */
  mapMode?: MapMode;
  /** Bonus XP awarded on chapter completion (informational only). */
  completionXp?: number;
  /**
   * J1: University prep tips shown as a recommendation panel below the node list.
   * These are NOT map nodes — they are mini-game/lesson activities in the University
   * that players are encouraged to complete before tackling the chapter battles.
   */
  prepTips?: readonly string[];
  /**
   * J5: Failure hint shown on the result screen after a loss against an enemy
   * at this chapter's difficulty. Encourages targeted University practice.
   */
  failureHint?: ChapterFailureHint;
  /**
   * P1: Node IDs that must appear in the player's claimed_journey_nodes before
   * the NEXT chapter can be unlocked.  The level gate still controls overall
   * access; this is an additional completion gate layered on top.
   * Callers must pass claimedNodeIds to getChapterStatus / getCurrentChapter
   * for this gate to take effect (backward-compat: omitting the param skips it).
   */
  requiredCompletionNodes?: string[];
}

// ── J5: Failure hint per chapter ─────────────────────────────────────────────

export interface ChapterFailureHint {
  /** Short encouraging text shown after a loss (1–2 sentences). */
  text: string;
  /** 2–4 specific practice activities to try at University. */
  practices: readonly string[];
  /** Primary deep link route (University hub). */
  primaryRoute: AppRoute;
  /** Secondary deep link route (Hero Skill Academy). */
  secondaryRoute: AppRoute;
}

// ── Chapter accent palette (one per chapter, warm-dark donghua tones) ────────

const C: Record<number, string> = {
  // ── Phase 1 — Age I: Foundation (Chapters 1–10) ──────────────────────────
  1:  "#D4AF37", // gold — Fading Apprentice
  2:  "#F59E0B", // amber — Ward Rotation
  3:  "#B0DEFF", // pale sky — Breath
  4:  "#EF4444", // red — Code Rush
  5:  "#34D399", // emerald — Sanctuary
  6:  "#8B5CF6", // violet — Boss Ward
  7:  "#F472B6", // rose — Community
  8:  "#A78BFA", // soft purple — Advanced Trials
  9:  "#06B6D4", // cyan — Real Ward
  10: "#F97316", // fire orange — Phase Finale

  // ── Phase 2 — Age I: Foundation continued (Chapters 11–40, Books II–IV) ──
  // Accent colours reserved; chapter content to be added by narrative team.
  // Book II: Anatomy of Duty (11–20) — steel-blue to deep teal
  11: "#38BDF8", // sky blue
  12: "#22D3EE", // cyan
  13: "#2DD4BF", // teal
  14: "#14B8A6", // mid teal
  15: "#0D9488", // deep teal
  16: "#0891B2", // ocean
  17: "#0284C7", // strong sky
  18: "#0369A1", // dark sky
  19: "#1D4ED8", // deep blue
  20: "#3730A3", // indigo — Book II finale
  // Book III: The Living Ward (21–30) — warm amber to burnt coral
  21: "#FCD34D", // warm gold
  22: "#FBBF24", // amber
  23: "#F59E0B", // deep amber
  24: "#F97316", // orange
  25: "#EA580C", // burnt orange
  26: "#DC2626", // red
  27: "#B91C1C", // deep red
  28: "#991B1B", // crimson
  29: "#C2410C", // brick
  30: "#9A3412", // terracotta — Book III finale
  // Book IV: Before the Oath (31–40) — lavender to rose gold
  31: "#C4B5FD", // soft violet
  32: "#A78BFA", // violet
  33: "#9333EA", // purple
  34: "#7C3AED", // deep violet
  35: "#6D28D9", // indigo-violet
  36: "#DB2777", // cerise
  37: "#BE185D", // deep rose
  38: "#9D174D", // burgundy
  39: "#E11D48", // rose red
  40: "#BE123C", // crimson rose — Book IV / Age I finale

  // ── Phase 2 — Age II: The Outer Wards (Chapters 41–80) ───────────────────
  // Book V: The Emergency Floor (41–50) — urgent reds and warning oranges
  41: "#FF6B6B", // coral red — Emergency Floor entry
  42: "#FF8C42", // rescue orange — Triage Under Pressure
  43: "#FFAA00", // amber signal — The Night Team
  44: "#E85D04", // deep burn — coming soon placeholder
  45: "#DC2F02", // alarm red — coming soon placeholder
  46: "#D62828", // crisis — coming soon placeholder
  47: "#E63946", // scarlet — coming soon placeholder
  48: "#F72585", // hot shock pink — coming soon placeholder
  49: "#B5179E", // deep magenta — coming soon placeholder
  50: "#7209B7", // dark violet — Book V finale
  // Book VI: Critical Care (51–60) — cool clinical greens and teals
  51: "#4CC9F0", // icy blue — ICU intro
  52: "#4895EF", // monitor blue
  53: "#3A86FF", // electric blue
  54: "#45B69C", // critical teal
  55: "#1B998B", // ward teal
  56: "#2EC4B6", // pulse teal
  57: "#CBF3F0", // pale monitor
  58: "#52B788", // life-green
  59: "#40916C", // deep life-green
  60: "#1B4332", // night ICU — Book VI finale
  // Book VII: Specialist Rotations (61–70) — specialist golds and purples
  61: "#CDB4DB", // soft lavender — Specialist intro
  62: "#FFC8DD", // petal rose
  63: "#FFAFCC", // blush
  64: "#BDE0FE", // pale specialist blue
  65: "#A2D2FF", // soft clinical blue
  66: "#F4D35E", // specialist gold
  67: "#EE964B", // golden amber
  68: "#F95738", // intervention red
  69: "#E63946", // alert scarlet
  70: "#A8201A", // deep specialist — Book VII finale
  // Book VIII: The Ward That Never Sleeps (71–80) — midnight and dawn palette
  71: "#2B2D42", // midnight ward
  72: "#3D405B", // deep dusk
  73: "#4A4E69", // twilight
  74: "#9A8C98", // dusk grey
  75: "#C9ADA7", // dawn rose
  76: "#F2E9E4", // pre-dawn white
  77: "#22223B", // deep night
  78: "#4A4E69", // shift change
  79: "#9A8C98", // late ward grey
  80: "#F4A261", // dawn gold — Age II finale

  // ── Saga II — The Outer Reaches (Chapters 81+) ───────────────────────────
  // Age I: The Reckoning (81–120)
  // Book I: Into the Dark (81–90)
  81: "#6A0572", // deep reach violet — Outer Reaches entry
  82: "#9B72CF", // saga II violet
  83: "#7B2D8B", // dark orchid
  84: "#5C2A9D", // indigo reach
  85: "#3A1078", // deep space blue
  86: "#1B1464", // midnight navy
  87: "#0E6BA8", // outer ocean
  88: "#0A2472", // void blue
  89: "#032B43", // abyssal
  90: "#16213E", // outer finale — Book I (Saga II)
};

// ── Phase 1 chapter definitions ───────────────────────────────────────────────

export const CHAPTERS: Chapter[] = [

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 1 — The Fading Apprentice (6 nodes, Level 1)
  // memory_fragment → story → story → battle → reflection → mini_boss
  // University prep (NOT map nodes): Cue Hunt · Rapid Triage · Stabilize Stack · Hydration Lesson
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 1,
    id: "chapter_1",
    levelGate: 1,
    theme: "The Fading Apprentice",
    purpose: "Enter the ward, face the first disease-spirit, earn your first star",
    accentColor: C[1],
    icon: "sparkles-outline",
    simulationEra: true,
    completionXp: 30,
    // Push 9: set to fogbound_tiles so the new hex-grid renderer can be exercised.
    mapMode: 'fogbound_tiles',
    prepTips: [
      "Cue Hunt Lab — find three hidden clinical cues",
      "Rapid Triage Hall — sort patients by urgency",
      "Stabilize Stack Lab — build the safe care sequence",
      "Lotus Lesson: Hydration Basics — fluids as first language",
    ],
    failureHint: {
      text: "Hydration cases hide their cues. Practice spotting the early signs before they fade — then your Assess and Stabilize actions will land much harder.",
      practices: [
        "Clinical Cue Lab: Hydration Signs — spot the hidden fluid cues",
        "Rapid Triage Hall: What Matters First — urgency under time pressure",
        "Stabilize Stack Lab: Steady Hands — safe sequencing from mild to severe",
        "Lotus Lesson: Hydration Basics — fluids as first language",
      ],
      primaryRoute: "/university",
      secondaryRoute: "/university/skill-academy",
    },
    // P1: required nodes that must be cleared before Chapter 2 unlocks.
    // c1n4 = First Ward Shift (Dehydration Wisp), c1n6 = Chapter Trial.
    requiredCompletionNodes: ["c1n4", "c1n6"],
    parts: [
      // ── Node 1 — Memory Fragment ──────────────────────────────────────────
      {
        id: "c1n1",
        part: 1,
        type: "memory_fragment",
        title: "The Recall Awakens",
        description: "You are summoned into the Kingdom of Healing. The System speaks for the first time — the ward is already under threat.",
        icon: "film-outline",
        route: "/story-scene?sceneId=chapter_01",
        rewardXp: 5,
      },
      // ── Node 2 — Story Beat ───────────────────────────────────────────────
      {
        id: "c1n2",
        part: 2,
        type: "story",
        title: "Your First Triage Call",
        description: "The ward throws three demands at you at once. The System watches — not to score you, but to see how you think.",
        icon: "book-outline",
        rewardXp: 10,
        rewardCoins: 20,
        scenario: {
          prompt: "A patient presses their call button, a monitor alarm sounds across the corridor, and the charge nurse asks for a status update — all at the same moment. What do you attend to first?",
          healthHook: "Urgency is a skill. Knowing what cannot wait is the core of clinical priority.",
          choices: [
            {
              text: "Answer the charge nurse — they're senior and their request comes first",
              correct: false,
              feedback: "Hierarchy matters, but a direct patient safety alert overrides task queuing. The physiological alarm comes first.",
            },
            {
              text: "Go to the monitor alarm — a physiological alert signals an immediate safety need",
              correct: true,
              feedback: "Clinical alarms are designed to flag time-sensitive events. Address direct patient safety before communication tasks.",
            },
            {
              text: "Respond to the call button — they asked, so they need help now",
              correct: false,
              feedback: "A call button is important, but a monitor alarm represents a measurable change in condition — that takes priority.",
            },
          ],
        },
      },
      // ── Node 3 — Story Beat ───────────────────────────────────────────────
      {
        id: "c1n3",
        part: 3,
        type: "story",
        title: "The Right Order",
        description: "Master Bai murmurs in the corridor: 'Sequence is not a preference — it is protection.' You begin to understand what that means.",
        icon: "book-outline",
        rewardXp: 10,
        rewardCoins: 20,
        scenario: {
          prompt: "A dehydrated patient is asking for food. They haven't had any fluids yet. A junior colleague wants to bring a meal first — it'll cheer them up. What's the clinically sound approach?",
          healthHook: "Order of care isn't pedantic — it's safety. The sequence exists because bodies respond differently when steps are skipped.",
          choices: [
            {
              text: "Food first — it's what they want, and it'll help their mood",
              correct: false,
              feedback: "Well-meaning, but feeding before rehydration in a dehydrated patient can worsen nausea and delay recovery.",
            },
            {
              text: "Rehydrate first, then reassess before introducing food",
              correct: true,
              feedback: "Correct sequencing is a clinical skill. Fluids before food is standard practice in dehydration — it's kinder in the long run.",
            },
            {
              text: "Both at the same time — they can eat while the IV runs",
              correct: false,
              feedback: "This skips the reason the sequence matters. Without rehydrating first, food tolerance is unpredictable and reassessment is bypassed.",
            },
          ],
        },
      },
      // ── Node 4 — Ward Shift ───────────────────────────────────────────────
      {
        id: "c1n4",
        part: 4,
        type: "battle",
        title: "First Shift — Dehydration Wisp",
        description: "Your first supervised encounter. The Wisp feeds on lost fluids. Read the cues, act fast, earn your star.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 20,
        rewardCoins: 20,
      },
      // ── Node 5 — Reflection ───────────────────────────────────────────────
      {
        id: "c1n5",
        part: 5,
        type: "reflection",
        title: "Mentor Bai's Warning",
        description: "Master Bai appears in the ward corridor. Something darker than a Wisp is stirring deeper in the realm.",
        icon: "alert-circle-outline",
        isPlaceholder: true,
        rewardXp: 5,
        scenario: {
          prompt: "A patient who just finished their IV fluids is quiet and not asking for anything. Before you chart them as stable, what should you do?",
          healthHook: "Silence isn't always recovery — in wards and in daily life.",
          choices: [
            {
              text: "Ask the nurse if they need another IV bag started",
              correct: false,
              feedback: "More IV fluid is given on clinical need — not just because the last bag finished.",
            },
            {
              text: "Reassess their vitals and ask how they're feeling",
              correct: true,
              feedback: "Reassessment after treatment is the clinical standard before charting any patient stable.",
            },
            {
              text: "Let them rest — they've had enough attention for now",
              correct: false,
              feedback: "Rest is helpful, but 'resting' and 'stable' aren't the same — evidence must support the status.",
            },
          ],
        },
      },
      // ── Node 6 — Chapter Trial (Mini-Boss) ───────────────────────────────
      {
        id: "c1n6",
        part: 6,
        type: "mini_boss",
        title: "Trial: The Fluid Phantom",
        description: "The chapter trial. A phantom of fluid loss — harder than any ward shift, but still within reach of a first-rotation healer. Read the cues, apply the sequence, claim your first chapter star.",
        icon: "skull-outline",
        route: "/battle?enemyId=fluid_phantom",
        rewardXp: 30,
        rewardCoins: 25,
        rewardShards: 5,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 2 — The First Ward Rotation (8 nodes, Level 2)
  // memory_fragment → story → story → story → battle → memory_fragment → mini_boss → reflection
  // University prep (NOT map nodes): Fever Lesson · Fever Cue Hunt · Reassess Stabilize Stack
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 2,
    id: "chapter_2",
    levelGate: 2,
    theme: "The First Ward Rotation",
    purpose: "Fever cases, reassessment, Summoning Hall opens",
    accentColor: C[2],
    icon: "pulse-outline",
    simulationEra: true,
    completionXp: 40,
    prepTips: [
      "Lotus Lesson: Fever & Warmth — temperature as diagnostic signal",
      "Cue Hunt Lab: Fever Signs — find the hidden heat clues",
      "Rapid Triage Hall: Worsening Patient — catch the change in time",
      "Stabilize Stack Lab: Reassess Before You Celebrate",
    ],
    failureHint: {
      text: "Fever enemies apply pressure over time and can spike again after you stabilise. Reassessment isn't optional — it's the core skill this chapter trains.",
      practices: [
        "Lotus Lesson: Fever & Warmth — temperature as diagnostic signal",
        "Clinical Cue Lab: Fever Signs — find the hidden heat clues",
        "Rapid Triage Hall: Worsening Patient — catch the change in time",
        "Stabilize Stack Lab: Reassess Before You Celebrate — check twice",
      ],
      primaryRoute: "/university",
      secondaryRoute: "/university/skill-academy",
    },
    // P8: required nodes that must be cleared before Chapter 3 unlocks.
    // c2p5 = Fever Imp Simulation (Ward Shift), c2p8 = Trial: Fever Shade (mini-boss, last node).
    requiredCompletionNodes: ["c2p5", "c2p8"],
    parts: [
      // ── Node 1 — Memory Fragment ──────────────────────────────────────────
      {
        id: "c2p1",
        part: 1,
        type: "memory_fragment",
        title: "First Rotation Briefing",
        description: "The System outlines the week ahead. Multiple patients. Fever is the first enemy. The Apprentice's fate hangs in recent memory.",
        icon: "film-outline",
        isPlaceholder: true,
        rewardXp: 5,
        rewardCoins: 20,
        scenario: {
          prompt: "A friend texts you: 'Had a headache since yesterday, feel warm, skipped dinner.' They ask if they should just sleep it off. What do you say?",
          healthHook: "Fever and missed meals together are a signal worth taking seriously.",
          choices: [
            {
              text: "Just drink water and you'll be fine",
              correct: false,
              feedback: "Hydration helps, but this combination of symptoms needs temperature measurement and food too.",
            },
            {
              text: "Check your temperature, have a light meal, and rest — let me know if it gets worse",
              correct: true,
              feedback: "Clear, practical, and appropriate — this is what good clinical sense looks like in everyday life.",
            },
            {
              text: "Go to A&E immediately",
              correct: false,
              feedback: "Escalation is important, but these symptoms aren't yet an emergency — monitoring and self-care come first.",
            },
          ],
        },
      },
      // ── Node 2 — Story Beat ───────────────────────────────────────────────
      {
        id: "c2p2",
        part: 2,
        type: "story",
        title: "Reading the Signs",
        description: "The Fever Imp's calling card isn't always temperature — it's the pattern. A flushed face, an unusual quiet, a missed meal. The System teaches you to see before the charts catch up.",
        icon: "book-outline",
        rewardXp: 10,
        rewardCoins: 15,
        scenario: {
          prompt: "A family member who seemed fine this morning is now slightly flushed, unusually quiet, and says they feel 'a bit warm' when you ask. They insist they're okay. What's the thoughtful response?",
          healthHook: "Early fever looks subtle. The quiet ones are sometimes the ones to watch.",
          choices: [
            {
              text: "Trust them — they know their own body best",
              correct: false,
              feedback: "Self-report is valuable, but flushing plus behaviour change plus warmth together is a pattern worth assessing — not just accepting.",
            },
            {
              text: "Note the change from their earlier state and ask a few more questions — this pattern is worth a closer look",
              correct: true,
              feedback: "Change from baseline is a key clinical signal. Quiet, flushed, and warm together deserves more than 'I'm fine.'",
            },
            {
              text: "Offer them water and suggest they rest — probably just tired",
              correct: false,
              feedback: "Rest and fluids are supportive, but this dismisses a recognisable symptom pattern without assessing it first.",
            },
          ],
        },
      },
      // ── Node 3 — Story Beat ───────────────────────────────────────────────
      {
        id: "c2p3",
        part: 3,
        type: "story",
        title: "The Changing Patient",
        description: "The ward shifts. A patient who was improving an hour ago now seems different — harder to read. The System says: 'Numbers don't change their mind. Patients do.'",
        icon: "book-outline",
        rewardXp: 10,
        rewardCoins: 15,
        scenario: {
          prompt: "A patient's temperature normalised after treatment and you've moved on to other tasks. Two hours later, a colleague mentions the patient 'seems a bit off' but hasn't asked for anything. What do you do?",
          healthHook: "Improvement isn't always permanent. Reassessment is part of the care cycle, not an interruption to it.",
          choices: [
            {
              text: "They're stable — don't disturb their rest unless they call",
              correct: false,
              feedback: "A report of 'seeming off' after treatment is a clinical prompt, not just a social observation. It requires assessment.",
            },
            {
              text: "Go to them and reassess — a colleague's concern is a valid clinical cue",
              correct: true,
              feedback: "Colleague observations are part of the clinical picture. 'Seems off' after treatment is exactly the change that warrants reassessment.",
            },
            {
              text: "Chart them stable — the vital signs from before were fine",
              correct: false,
              feedback: "Previous readings don't cover current state. Charting stable without reassessment is a documentation gap and a care gap.",
            },
          ],
        },
      },
      // ── Node 4 — Story Beat ───────────────────────────────────────────────
      {
        id: "c2p4",
        part: 4,
        type: "story",
        title: "Before You Chart Stable",
        description: "The Imp cools. But the System flags a pattern: low-grade fever can mask its return. 'Stable is a conclusion,' it says, 'not a hope.'",
        icon: "book-outline",
        rewardXp: 10,
        rewardCoins: 15,
        scenario: {
          prompt: "A patient's fever resolved overnight and they're chatting comfortably this morning. A junior colleague is about to chart 'stable — no further action.' What do you check first?",
          healthHook: "A good outcome isn't complete until you know why it happened and confirmed it's holding.",
          choices: [
            {
              text: "Nothing — if they're comfortable and the fever's gone, stable is accurate",
              correct: false,
              feedback: "Comfort is encouraging, but 'stable' requires confirmed observations across multiple parameters, not just temperature.",
            },
            {
              text: "Verify that the underlying cause was identified and addressed — not just the symptom",
              correct: true,
              feedback: "Treating a fever without identifying its source leaves the patient vulnerable to relapse. Stability means cause addressed, not just numbers normal.",
            },
            {
              text: "Just double-check the temperature reading to be sure",
              correct: false,
              feedback: "Temperature is one data point. Stable status requires a full reassessment — vital signs, symptoms, and clinical impression.",
            },
          ],
        },
      },
      // ── Node 5 — Ward Shift ───────────────────────────────────────────────
      {
        id: "c2p5",
        part: 5,
        type: "battle",
        title: "Simulation — Fever Imp",
        description: "A low-grade fever case becomes a full ward crisis. Apply your cue-reading and reassessment — this is the real simulation.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 20,
        rewardCoins: 30,
      },
      // ── Node 6 — Memory Fragment ──────────────────────────────────────────
      {
        id: "c2p6",
        part: 6,
        type: "memory_fragment",
        title: "The First Ally",
        description: "A seasoned healer notices your technique. An alliance forms — and a warning about the Fever Shade is delivered.",
        icon: "people-outline",
        isPlaceholder: true,
        rewardXp: 5,
        scenario: {
          prompt: "You treated a patient with a fever earlier. Their temperature is now normal. Two hours later they mention feeling cold and shivery. What does this suggest?",
          healthHook: "Conditions reassert themselves — recovery isn't always linear.",
          choices: [
            {
              text: "They're probably just cold from the air conditioning",
              correct: false,
              feedback: "Environmental cold is possible, but new chills after fever treatment require clinical reassessment first.",
            },
            {
              text: "The fever may be returning — reassess their vitals now",
              correct: true,
              feedback: "Chills after treatment can signal a returning or worsening condition. Reassess before assuming all is well.",
            },
            {
              text: "The medication worked — this is a normal recovery phase",
              correct: false,
              feedback: "Don't attribute new symptoms to recovery without evidence. The clinical picture must guide your thinking.",
            },
          ],
        },
      },
      // ── Node 7 — Reflection ───────────────────────────────────────────────
      {
        id: "c2p7",
        part: 7,
        type: "reflection",
        title: "Rotation Complete",
        description: "The ward holds. Fever is understood, not feared. The System seals the chapter — and the door to Chapter 3 begins to glow.",
        icon: "checkmark-circle-outline",
        isPlaceholder: true,
        rewardXp: 10,
        rewardCoins: 25,
      },
      // ── Node 8 — Chapter Trial (Mini-Boss, last node) ─────────────────────
      {
        id: "c2p8",
        part: 8,
        type: "mini_boss",
        title: "Trial: Fever Shade",
        description: "The Fever Imp's heavier cousin. Higher corruption pressure, hidden spread risk — apply your full rotation knowledge.",
        icon: "skull-outline",
        route: "/battle?enemyId=fever_shade",
        rewardXp: 35,
        rewardCoins: 35,
        rewardShards: 20,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 3 — Breath Before Battle (9 nodes, Level 4)
  // memory → story → story → battle →
  //     memory → story → battle → reflection → mini-boss
  // University prep: Breathing Lesson · Shortness Cue Hunt · Airway Triage
  // Level gate raised to 4 (P23): players must grind ~200 XP after Ch2 via
  // University practice, daily quests, or shift replays — creates intentional
  // pacing gap before the airway difficulty spike.
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 3,
    id: "chapter_3",
    levelGate: 4,
    theme: "Breath Before Battle",
    purpose: "Airway and respiratory cases; ABCDE priority in practice",
    accentColor: C[3],
    icon: "cloud-outline",
    simulationEra: true,
    completionXp: 50,
    prepTips: [
      "Lotus Lesson: Breathing Basics — SpO₂, respiratory rate, effort",
      "Cue Hunt Lab: Shortness of Breath — spot the airway distress signs",
      "Rapid Triage Hall: Airway First — ABCDE in a crowded corridor",
      "Stabilize Stack Lab: Open the Air Path — sequence matters",
    ],
    failureHint: {
      text: "Airway enemies hide their severity. Assess early to reveal hidden cues — once the wheeze goes silent, the window is closing fast.",
      practices: [
        "Lotus Lesson: Breathing Basics — SpO₂, respiratory rate, effort",
        "Clinical Cue Lab: Shortness of Breath — spot the airway distress signs",
        "Rapid Triage Hall: Airway First — ABCDE in a crowded corridor",
        "Stabilize Stack Lab: Open the Air Path — sequence before treatment",
      ],
      primaryRoute: "/university",
      secondaryRoute: "/university/skill-academy",
    },
    // P9: required nodes that must be cleared before Chapter 4 unlocks.
    // c3p7 = Breath Under Pressure (battle), c3p9 = Trial: Breathless Gale Spirit (mini-boss, last node).
    requiredCompletionNodes: ["c3p7", "c3p9"],
    parts: [
      // ── Node 1 — Memory Fragment ──────────────────────────────────────────
      {
        id: "c3p1",
        part: 1,
        type: "memory_fragment",
        title: "The Breathless Hall",
        description: "A string of respiratory cases floods the ward. The air itself feels thin. The System warns: airway cannot wait.",
        icon: "book-outline",
        isPlaceholder: true,
        rewardXp: 5,
        scenario: {
          prompt: "Your colleague says they feel 'a bit short of breath' while sitting at their desk. They haven't exercised and seem slightly anxious. What's your first thought?",
          healthHook: "Unexplained shortness of breath at rest is always worth a second look.",
          choices: [
            {
              text: "They're probably just stressed — breathing exercises should help",
              correct: false,
              feedback: "Anxiety can cause breathlessness, but physical causes must be ruled out first when it occurs at rest.",
            },
            {
              text: "Ask if they feel chest tightness or pain, and observe their breathing rate",
              correct: true,
              feedback: "This is the right first step — screen for red flags before attributing rest-onset breathlessness to stress.",
            },
            {
              text: "Offer them water and suggest a 10-minute break",
              correct: false,
              feedback: "Comfort measures are kind, but don't delay assessment of unexplained breathlessness at rest.",
            },
          ],
        },
      },
      // ── Node 2 — Story Beat ───────────────────────────────────────────────
      {
        id: "c3p2",
        part: 2,
        type: "story",
        title: "Eyes on the Ward",
        description: "Respiratory distress is rarely announced — it's observed. The System walks you through the posture, the colour, the effort. By the time the patient speaks, you should already know.",
        icon: "book-outline",
        rewardXp: 20,
        rewardCoins: 20,
        scenario: {
          prompt: "You're walking through the ward and notice a patient across the room sitting forward with their elbows on their knees, breathing visibly harder than before. They haven't pressed the call button. What do you do?",
          healthHook: "Respiratory distress is a posture before it's a complaint. The forward-lean tripod position is a textbook sign.",
          choices: [
            {
              text: "Wait — if they needed help, they'd call for it",
              correct: false,
              feedback: "Patients in respiratory distress often can't spare the breath to call. The tripod posture is a clinical cue, not a social one.",
            },
            {
              text: "Go to them immediately — forward posture and visible breathing effort are respiratory distress cues",
              correct: true,
              feedback: "The tripod position is one of the clearest non-verbal signs of breathing difficulty. Don't wait for the patient to ask.",
            },
            {
              text: "Alert the charge nurse and wait for their instructions",
              correct: false,
              feedback: "Alerting the team is appropriate — but go to the patient first. Direct assessment cannot wait for delegation.",
            },
          ],
        },
      },
      // ── Node 3 — Story Beat ───────────────────────────────────────────────
      {
        id: "c3p3",
        part: 3,
        type: "story",
        title: "Airway First",
        description: "Master Bai's voice cuts through the rush: 'Nothing else matters if the airway is closed.' The ABCDE framework isn't a mnemonic — it's a survival order.",
        icon: "book-outline",
        rewardXp: 20,
        rewardCoins: 20,
        scenario: {
          prompt: "A patient is unresponsive after a procedure. Your colleague immediately reaches for the medication chart to check what they were given. What do you do first?",
          healthHook: "ABCDE starts with Airway for a reason — without a patent airway, every other intervention is irrelevant.",
          choices: [
            {
              text: "Help with the medication chart — knowing what they took is essential",
              correct: false,
              feedback: "Medication review matters, but not before confirming the airway is open and breathing is present.",
            },
            {
              text: "Check the airway first — tilt the head, look for movement, listen for breath",
              correct: true,
              feedback: "A is for Airway. Before anything else, confirm the airway is patent. This is the non-negotiable first step.",
            },
            {
              text: "Call the emergency team immediately and stand back",
              correct: false,
              feedback: "Calling for help is right, but you must simultaneously check the airway — delay in the first seconds can be fatal.",
            },
          ],
        },
      },
      // ── Node 4 — Battle ────────────────────────────────────────────────────
      {
        id: "c3p4",
        part: 4,
        type: "battle",
        title: "Simulation — The Hidden Wheeze",
        description: "A patient who looks calm but isn't. The cues are quiet. Find the wheeze before the corridor hears the alarm.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 20,
        rewardCoins: 20,
      },
      // ── Node 5 — Memory Fragment ──────────────────────────────────────────
      {
        id: "c3p5",
        part: 5,
        type: "memory_fragment",
        title: "The Corridor Doesn't Pause",
        description: "Three simultaneous demands. The System watches. Only one can be first — and the ward remembers which you chose.",
        icon: "film-outline",
        isPlaceholder: true,
        rewardXp: 5,
        rewardCoins: 30,
        scenario: {
          prompt: "Three things need attention at once: a patient alarm is going off, a colleague is calling from across the ward, and a medication needs your signature. What do you attend to first?",
          healthHook: "Priority frameworks aren't just clinical — they help in any high-pressure situation.",
          choices: [
            {
              text: "Sign the medication — it's quick and then I'm free",
              correct: false,
              feedback: "Speed alone doesn't set priority. A patient alarm signals a direct safety need that can't be queued.",
            },
            {
              text: "Respond to the patient alarm — safety comes before tasks",
              correct: true,
              feedback: "ABCDE in practice: the patient's physiological safety outranks administrative tasks every time.",
            },
            {
              text: "Answer my colleague first — they might have critical information",
              correct: false,
              feedback: "Verbal communication can wait seconds. A patient in alarm cannot.",
            },
          ],
        },
      },
      // ── Node 6 — Story Beat ───────────────────────────────────────────────
      {
        id: "c3p6",
        part: 6,
        type: "story",
        title: "Ordering the Breath",
        description: "The System pauses the memory. 'You have three tools,' it says. 'Position. Oxygen. Monitor. All matter — but only one can open the path before the others reach it.'",
        icon: "book-outline",
        rewardXp: 20,
        rewardCoins: 20,
        scenario: {
          prompt: "A patient is breathless and anxious. You have three things to do: sit them upright, apply supplemental oxygen, and attach a SpO₂ monitor. In what order do you act?",
          healthHook: "Positioning before oxygen isn't just a rule — an upright patient uses their airways more efficiently, making the oxygen more effective when it arrives.",
          choices: [
            {
              text: "Oxygen first — that's the most critical intervention",
              correct: false,
              feedback: "Oxygen is essential, but if the patient is slumped, delivery is compromised. Positioning first maximises oxygen benefit.",
            },
            {
              text: "Sit them upright first, then oxygen, then monitor",
              correct: true,
              feedback: "Correct sequence. Position opens the airway and reduces work of breathing; oxygen then works as intended; the monitor confirms effect.",
            },
            {
              text: "Monitor first — you need a baseline SpO₂ before any intervention",
              correct: false,
              feedback: "Monitoring while the patient continues to deteriorate costs precious seconds. Intervene first, monitor as you go.",
            },
          ],
        },
      },
      // ── Node 7 — Battle ────────────────────────────────────────────────────
      {
        id: "c3p7",
        part: 7,
        type: "battle",
        title: "Simulation — Breath Under Pressure",
        description: "A deteriorating patient, two competing priorities. Apply what you know — and make the call before the window closes.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 25,
        rewardCoins: 25,
      },
      // ── Node 8 — Reflection ───────────────────────────────────────────────
      {
        id: "c3p8",
        part: 8,
        type: "reflection",
        title: "What Air Teaches",
        description: "A quiet moment after the storm. Reflect on the breath — and why oxygen is the first language of clinical urgency.",
        icon: "leaf-outline",
        isPlaceholder: true,
        rewardXp: 10,
        rewardCoins: 35,
        scenario: {
          prompt: "After a long shift you notice your own breathing getting faster and shallower — you're stressed. What's the quickest way to slow it down physiologically?",
          healthHook: "The techniques we use for patients work for healers too.",
          choices: [
            {
              text: "Drink coffee — it clears your head and helps you focus",
              correct: false,
              feedback: "Caffeine can worsen anxious breathing by increasing heart rate — the opposite of what you need right now.",
            },
            {
              text: "Breathe out slowly for longer than you breathe in",
              correct: true,
              feedback: "A longer exhale activates the calming reflex (parasympathetic nervous system). This is also what we teach patients.",
            },
            {
              text: "Hold your breath for 10 seconds to reset the pattern",
              correct: false,
              feedback: "Breath-holding raises CO₂ and anxiety. Controlled extended exhale is the correct clinical approach.",
            },
          ],
        },
      },
      // ── Node 9 — Chapter Trial (Mini-Boss, last node) ─────────────────────
      {
        id: "c3p9",
        part: 9,
        type: "mini_boss",
        title: "Trial: Breathless Gale Spirit",
        description: "The Air Sprite's advanced form. Full respiratory cascade — intervene before SpO₂ drops beyond recovery.",
        icon: "skull-outline",
        route: "/battle?enemyId=gale_spirit",
        rewardXp: 35,
        rewardCoins: 30,
        rewardShards: 5,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 4 — Code Rush (9 nodes, Level 6)
  // memory → story → battle → ward_defense →
  //      memory → story → ward_defense → reflection → mini-boss(WD)
  // University prep: Crowded Ward Triage · Protect the Ward Stabilize Stack
  // Level gate raised to 6 (P23): players completing Ch3 will be ~Level 5;
  // ~340 XP grind to Level 6 via University practice, replays, daily/weekly
  // quests before Ward Defense content begins.
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 4,
    id: "chapter_4",
    levelGate: 6,
    theme: "Code Rush",
    purpose: "Ward Defense introduction; multi-threat corridor management",
    accentColor: C[4],
    icon: "shield-outline",
    simulationEra: true,
    completionXp: 60,
    prepTips: [
      "Rapid Triage Hall: Crowded Ward — who needs the bed first",
      "Stabilize Stack Lab: Protect the Ward — sequential damage control",
      "Cue Hunt Lab: Crowded Ward Warning — spot the overload signal",
      "Lotus Lesson: Safety and Prioritization — ABCDE under volume",
    ],
    failureHint: {
      text: "Code Rush enemies hit in waves — priority decisions matter more than damage output. Practice triage and ward positioning before you return.",
      practices: [
        "Rapid Triage Hall: Who Needs the Bed First — priority under volume",
        "Stabilize Stack Lab: Protect the Ward — sequential damage control",
        "Clinical Cue Lab: Crowded Ward Warning — spot the overload signal",
        "Lotus Lesson: Safety and Prioritization — ABCDE under pressure",
      ],
      primaryRoute: "/university",
      secondaryRoute: "/university/skill-academy",
    },
    // P10: required nodes that must be cleared before Chapter 5 unlocks.
    // c4p7 = Code Rush Second Wave (WD), c4p9 = Trial: Hold the Line (WD mini-boss, last node).
    requiredCompletionNodes: ["c4p7", "c4p9"],
    parts: [
      // ── Node 1 — Memory Fragment ──────────────────────────────────────────
      {
        id: "c4p1",
        part: 1,
        type: "memory_fragment",
        title: "The Ward Doors Shake",
        description: "An alert rings across the corridor. Multiple disease-forms breach the perimeter at once. The ward must hold its ground.",
        icon: "book-outline",
        isPlaceholder: true,
        rewardXp: 5,
        scenario: {
          prompt: "Three patients need attention: one has a wound that's actively bleeding, one hasn't had their morning medication, and one is asking about discharge paperwork. Who do you see first?",
          healthHook: "Triage isn't just a ward skill — it applies in family, work, and daily life.",
          choices: [
            {
              text: "The medication — skipping doses can be dangerous",
              correct: false,
              feedback: "Delayed medication is a concern, but visible active bleeding takes immediate priority over scheduled tasks.",
            },
            {
              text: "The bleeding patient — visible blood loss is an urgent safety need",
              correct: true,
              feedback: "Active bleeding is always prioritised. Medication and paperwork wait when direct patient safety is at stake.",
            },
            {
              text: "The discharge paperwork — then everyone moves on faster",
              correct: false,
              feedback: "Administrative efficiency never overrides patient safety needs.",
            },
          ],
        },
      },
      // ── Node 2 — Story Beat ───────────────────────────────────────────────
      {
        id: "c4p2",
        part: 2,
        type: "story",
        title: "The Surge Begins",
        description: "Three alerts at once. The corridor feels smaller. The System speaks quietly: 'Everyone thinks they're the most urgent. Only one is right.'",
        icon: "book-outline",
        rewardXp: 22,
        rewardCoins: 25,
        scenario: {
          prompt: "Three patients need attention at the same time: one is asking for pain relief, one has a monitor alarm sounding, and one is overdue for a wound dressing. You're the only one free. Who do you see first?",
          healthHook: "Pain, safety alerts, and scheduled care are all real needs — but they don't carry equal urgency.",
          choices: [
            {
              text: "The patient asking for pain relief — they're suffering right now",
              correct: false,
              feedback: "Pain is important, but it's rarely immediately life-threatening. Physiological alarms signal potential emergencies that can't wait.",
            },
            {
              text: "The monitor alarm — physiological alerts signal immediate safety needs",
              correct: true,
              feedback: "A monitor alarm indicates a measurable change in a patient's condition. It demands immediate assessment before pain relief or scheduled tasks.",
            },
            {
              text: "The wound dressing — it's overdue and delay could cause complications",
              correct: false,
              feedback: "Wound care is important, but scheduled tasks give way to active physiological events. Address the alarm first.",
            },
          ],
        },
      },
      // ── Node 3 — Battle ────────────────────────────────────────────────────
      {
        id: "c4p3",
        part: 3,
        type: "battle",
        title: "Simulation — Crowded Ward Warning",
        description: "Volume pressure mounts. Multiple active patients, single team. Triage hard and don't let the overload tip into chaos.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 20,
        rewardCoins: 20,
      },
      // ── Node 4 — Ward Defense: First Wave ────────────────────────────────
      {
        id: "c4p4",
        part: 4,
        type: "ward_defense",
        title: "Code Rush — First Wave",
        description: "Deploy your heroes. Intercept the first disease-wave before it reaches your patients. Position matters.",
        icon: "shield-half-outline",
        route: "/ward-defense",
        rewardXp: 25,
        rewardCoins: 25,
      },
      // ── Node 5 — Memory Fragment ──────────────────────────────────────────
      {
        id: "c4p5",
        part: 5,
        type: "memory_fragment",
        title: "Holding the Line",
        description: "The first wave repelled. But the System confirms: a second wave is forming. The corridor must hold once more.",
        icon: "flag-outline",
        isPlaceholder: true,
        rewardXp: 5,
        scenario: {
          prompt: "After managing a difficult first wave of patients, you feel the urge to relax. But a junior colleague looks worried about another patient in the corner. What do you do?",
          healthHook: "In healthcare and in life, the second wave often follows the first.",
          choices: [
            {
              text: "You've done your part — let the junior handle it",
              correct: false,
              feedback: "Stepping back after one success is a common error. Clinical responsibility doesn't stop when you feel tired.",
            },
            {
              text: "Ask your colleague what they see — then assess together",
              correct: true,
              feedback: "Collaborative assessment and curiosity are core clinical habits. Two pairs of eyes catch more than one.",
            },
            {
              text: "Finish your documentation first, then check on the patient",
              correct: false,
              feedback: "Documentation matters, but an actively worried colleague signals that patient safety responds now — not later.",
            },
          ],
        },
      },
      // ── Node 6 — Story Beat ───────────────────────────────────────────────
      {
        id: "c4p6",
        part: 6,
        type: "story",
        title: "Holding Position",
        description: "The second wave is forming. A junior colleague wants to do everything at once to save time. The System flags the instinct — then shows what sequential care actually prevents.",
        icon: "book-outline",
        rewardXp: 22,
        rewardCoins: 25,
        scenario: {
          prompt: "A patient is deteriorating under pressure. A colleague says 'let's do everything at once — it'll be faster.' Three active interventions are queued. What's the more reliable approach?",
          healthHook: "Parallel action feels efficient — but in clinical care, layered interventions without sequencing create unpredictable effects and missed feedback.",
          choices: [
            {
              text: "Do everything simultaneously — speed saves lives",
              correct: false,
              feedback: "Simultaneous interventions without sequencing make it impossible to attribute effect or catch unexpected responses before they escalate.",
            },
            {
              text: "Prioritise the most urgent intervention, apply it, then reassess before the next",
              correct: true,
              feedback: "Sequential care lets you see what's working and adapt. It's not slower — it's more accurate under pressure.",
            },
            {
              text: "Wait for a senior before acting — this is too complex to handle alone",
              correct: false,
              feedback: "Escalating is appropriate, but not at the cost of inaction when immediate interventions are available and indicated.",
            },
          ],
        },
      },
      // ── Node 7 — Ward Defense: Second Wave ───────────────────────────────
      {
        id: "c4p7",
        part: 7,
        type: "ward_defense",
        title: "Code Rush — Second Wave",
        description: "Stronger. Faster. The second wave doesn't stop at the corridor. Fortify your deployment — protect every patient.",
        icon: "shield-half-outline",
        route: "/ward-defense",
        rewardXp: 30,
        rewardCoins: 30,
      },
      // ── Node 8 — Reflection ───────────────────────────────────────────────
      {
        id: "c4p8",
        part: 8,
        type: "reflection",
        title: "After the Rush",
        description: "The ward is quiet. The corridor holds. A moment to breathe — and remember what made the difference.",
        icon: "leaf-outline",
        isPlaceholder: true,
        rewardXp: 10,
        rewardCoins: 35,
        scenario: {
          prompt: "You've just finished a demanding and chaotic shift. A colleague suggests grabbing a meal together before heading home. Beyond just being social, what's the clinical reason this might be genuinely good advice?",
          healthHook: "How you recover after stress affects your next performance — and your long-term health.",
          choices: [
            {
              text: "It's just a social habit — eating together doesn't affect recovery",
              correct: false,
              feedback: "Shared meals measurably reduce cortisol compared to eating alone, which is directly relevant to post-shift physiological recovery.",
            },
            {
              text: "Eating after sustained stress helps replenish glucose, and sharing it with someone accelerates nervous-system recovery",
              correct: true,
              feedback: "Both nutrition and social connection are active recovery tools — not luxuries. This is the same advice we give patients after procedures.",
            },
            {
              text: "You should go straight home — rest is more important than food",
              correct: false,
              feedback: "Both matter. Skipping food after sustained cortisol stress delays recovery. Rest and refuelling work together.",
            },
          ],
        },
      },
      // ── Node 9 — Chapter Trial (Mini-Boss, last node) ─────────────────────
      {
        id: "c4p9",
        part: 9,
        type: "mini_boss",
        title: "Trial: Hold the Line",
        description: "The Code Rush finale. An overwhelming surge tests every defensive skill you have. The ward survives — or it doesn't.",
        icon: "skull-outline",
        route: "/ward-defense",
        rewardXp: 40,
        rewardCoins: 35,
        rewardShards: 10,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 5 — Building the Sanctuary (8 nodes, Level 7)
  // J1: story → realm → battle → story → battle → ward_defense → battle → mini-boss
  // University prep: Recovery Lesson · Fatigue Cue Hunt · Multi-Step Stabilize Stack
  // Level gate raised to 7 (P23): players completing Ch4 will be ~Level 6;
  // ~450 XP grind to Level 7 via Realm, replays, University, daily quests.
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 5,
    id: "chapter_5",
    levelGate: 7,
    theme: "Building the Sanctuary",
    purpose: "Realm foundation; recovery and circulation cases; Sanctuary as base of operations",
    accentColor: C[5],
    icon: "home-outline",
    simulationEra: true,
    completionXp: 80,
    requiredCompletionNodes: ["c5p7", "c5p8"],
    prepTips: [
      "Lotus Lesson: Recovery and Reassessment — healing after the storm",
      "Cue Hunt Lab: Fatigue and Recovery — subtle signs of ongoing deterioration",
      "Stabilize Stack Lab: Multi-Step Care Plan — four phases, two risks",
      "Rapid Triage Hall: Changing Priority — the patient who recovers and the one who doesn't",
    ],
    failureHint: {
      text: "Sanctuary cases need multi-step care — each intervention must build on the last. Missing one step collapses the whole chain. Practice the full sequence.",
      practices: [
        "Lotus Lesson: Recovery and Reassessment — healing after the storm",
        "Clinical Cue Lab: Fatigue and Recovery — subtle signs of ongoing deterioration",
        "Stabilize Stack Lab: Multi-Step Care Plan — four phases, two risks",
        "Rapid Triage Hall: Changing Priority — the patient who recovers then doesn't",
      ],
      primaryRoute: "/university",
      secondaryRoute: "/university/skill-academy",
    },
    parts: [
      {
        id: "c5p1",
        part: 1,
        type: "story",
        title: "The Empty Atrium",
        description: "The Realm opens for the first time. A vast, quiet space waits — the Sanctuary begins here, with a single foundation stone.",
        icon: "book-outline",
        isPlaceholder: true,
        rewardXp: 5,
        scenario: {
          prompt: "A patient who was very unwell last week is now sitting up, eating, and chatting with visitors. A family member asks if they can go home today. What's the thoughtful answer?",
          healthHook: "Looking well and being clinically ready for discharge are not the same thing.",
          choices: [
            {
              text: "They look great — I'd say yes!",
              correct: false,
              feedback: "Visual improvement is encouraging but never sufficient for discharge without a proper clinical review.",
            },
            {
              text: "The clinical team needs to assess their vitals and recovery markers before we can say",
              correct: true,
              feedback: "Discharge requires systematic review, not just visual impression. This is the right answer to give families.",
            },
            {
              text: "They need at least another week just to be safe",
              correct: false,
              feedback: "Unnecessary hospital stays carry their own risks — evidence-based timing always matters more than assumed safety.",
            },
          ],
        },
      },
      {
        id: "c5p2",
        part: 2,
        type: "realm",
        title: "Place the First Ward Space",
        description: "Lay the foundation of your Sanctuary. The Atrium anchors everything — every building, every healer, every recovery.",
        icon: "home-outline",
        route: "/(tabs)/kingdom",
        isPlaceholder: true,
        rewardXp: 15,
      },
      {
        id: "c5p3",
        part: 3,
        type: "battle",
        title: "Simulation — River Sludge",
        description: "A sluggish circulation case. Fluids move too slowly, pressure drops. Apply fluid management and cardiac monitoring.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 20,
        rewardCoins: 20,
      },
      {
        id: "c5p4",
        part: 4,
        type: "story",
        title: "Healing Beyond Battle",
        description: "The System speaks of recovery — not just victory. A ward that heals must also be a place where healers can breathe.",
        icon: "leaf-outline",
        isPlaceholder: true,
        rewardXp: 5,
        scenario: {
          prompt: "After a particularly hard shift, you feel drained but have another shift tomorrow. A colleague offers to cover your last 30 minutes. What's the clinically wise thing to do?",
          healthHook: "Healer wellbeing is a patient safety issue, not a personal comfort one.",
          choices: [
            {
              text: "Push through — you started it, you finish it",
              correct: false,
              feedback: "Fatigue impairs clinical decision-making. Accepting help is professional, not weak.",
            },
            {
              text: "Accept the offer — rest is part of the care cycle",
              correct: true,
              feedback: "A rested healer makes safer decisions. Recognising your limits is a clinical skill, not a failure.",
            },
            {
              text: "Accept but feel guilty — you should have managed better",
              correct: false,
              feedback: "Guilt over appropriate rest is counterproductive and unsustainable. Self-care enables patient care.",
            },
          ],
        },
      },
      {
        id: "c5p5",
        part: 5,
        type: "battle",
        title: "Simulation — Tired After Treatment",
        description: "A patient who improved — then didn't. Post-treatment fatigue masks a second threat. Reassess before you celebrate.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 25,
        rewardCoins: 25,
      },
      {
        id: "c5p6",
        part: 6,
        type: "ward_defense",
        title: "Supply Hall Under Pressure",
        description: "The Sanctuary's supply lines are targeted. Defend the corridor — the ward cannot function if its resources fall.",
        icon: "shield-half-outline",
        route: "/ward-defense",
        rewardXp: 30,
        rewardCoins: 30,
      },
      {
        id: "c5p7",
        part: 7,
        type: "battle",
        title: "Simulation — Multi-Step Care Plan",
        description: "A complex case requiring sequential interventions. Each step builds on the last — skip one and the chain collapses.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 30,
        rewardCoins: 30,
      },
      {
        id: "c5p8",
        part: 8,
        type: "mini_boss",
        title: "Trial: The Sanctuary Breathes",
        description: "The chapter finale. A full cascade — circulation, airways, and defensive pressure at once. The Sanctuary earns its name here.",
        icon: "skull-outline",
        route: "/battle?enemyId=ward_cascade",
        rewardXp: 50,
        rewardCoins: 40,
        rewardShards: 15,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 6 — First Boss Ward (6 parts, Level 10)
  // Boss Ward intro
  // Level gate raised to 10 (P23): significant milestone before Boss Ward;
  // players completing Ch5 will be ~Level 8-9; grind to Level 10 via Realm
  // production, Ward Defense replays, University, daily/weekly quests.
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 6,
    id: "chapter_6",
    levelGate: 10,
    theme: "First Boss Ward",
    purpose: "Boss Ward intro — high-stakes multi-phase encounter",
    accentColor: C[6],
    icon: "skull-outline",
    simulationEra: true,
    requiredCompletionNodes: ["c6p5", "c6p7"],
    parts: [
      {
        id: "c6p1",
        part: 1,
        type: "story",
        title: "Story: The Warning Bell",
        description: "A critical alert flags a deteriorating patient. Something bigger than a common cue is stirring.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c6p2",
        part: 2,
        type: "story",
        title: "What Waits Beyond the Ward",
        description: "The chamber at the end of the corridor is different. Bigger. Louder. The System says nothing — but it watches.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c6p3",
        part: 3,
        type: "story",
        title: "The Quiet Reading",
        description: "Numbers that look fine. A patient who looks calm. The System flags something the chart does not say.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c6p4",
        part: 4,
        type: "battle",
        title: "Ward Shift: Energy Lock",
        description: "A metabolic case as a warm-up. Prepare your team's AP curve for the boss ahead.",
        icon: "medical-outline",
        route: "/shift",
        isPlaceholder: true,
      },
      {
        id: "c6p5",
        part: 5,
        type: "battle",
        title: "Boss Ward: Minor Imbalance",
        description: "The Minor Imbalance is a smaller precursor to Lord Imbalance. A multi-phase metabolic emergency.",
        icon: "skull-outline",
        route: "/boss",
        isPlaceholder: true,
      },
      {
        id: "c6p6",
        part: 6,
        type: "reward",
        title: "Debrief: Why Power Failed Before",
        description: "Reflect on the metabolic chain. Why does energy imbalance cascade? What did the boss teach you?",
        icon: "flag-outline",
        isPlaceholder: true,
      },
      // ── Node 7 — Chapter Trial (Mini-Boss) ───────────────────────────────
      {
        id: "c6p7",
        part: 7,
        type: "mini_boss",
        title: "Trial: Imbalance Core",
        description: "The chapter trial. A concentrated metabolic crisis — electrolyte storm, cardiac instability, and rising acid. Survive the convergence to claim your Chapter 6 star.",
        icon: "skull-outline",
        route: "/battle?enemyId=imbalance_core",
        rewardXp: 50,
        rewardCoins: 40,
        rewardShards: 8,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 7 — The Community Board (7 parts, Level 9)
  // Public health participation
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 7,
    id: "chapter_7",
    levelGate: 9,
    theme: "The Community Board",
    purpose: "Public health participation and outbreak awareness",
    accentColor: C[7],
    icon: "people-outline",
    simulationEra: true,
    requiredCompletionNodes: ["c7p5", "c7p8"],
    parts: [
      {
        id: "c7p1",
        part: 1,
        type: "story",
        title: "Story: Reports Across the City",
        description: "Scattered illness reports emerge from the realm. Something larger than a single patient is brewing.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c7p2",
        part: 2,
        type: "story",
        title: "Beyond the Ward Walls",
        description: "The reports are not from your patients. They are from the city. Something is moving through the population.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c7p3",
        part: 3,
        type: "story",
        title: "The Pattern Emerges",
        description: "Three cases. Different wards. One source. The System draws a line between them.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c7p4",
        part: 4,
        type: "story",
        title: "The First Line Holds",
        description: "Containment begins with a single practitioner. The System traces every contact the hands make.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c7p5",
        part: 5,
        type: "battle",
        title: "Ward Shift: Fire Imp",
        description: "An infectious fever case with spread risk. Apply isolation principles during the shift.",
        icon: "medical-outline",
        route: "/shift",
        isPlaceholder: true,
      },
      {
        id: "c7p6",
        part: 6,
        type: "community",
        title: "Community Board Contribution",
        description: "Submit your outbreak report to the Board. Your findings shape the realm's public health response.",
        icon: "globe-outline",
        isPlaceholder: true,
      },
      {
        id: "c7p7",
        part: 7,
        type: "reward",
        title: "Chapter Finale: The First Cluster",
        description: "Three linked cases, one source. Close the cluster and prevent further spread.",
        icon: "flag-outline",
        isPlaceholder: true,
      },
      // ── Node 8 — Chapter Trial (Mini-Boss) ───────────────────────────────
      {
        id: "c7p8",
        part: 8,
        type: "mini_boss",
        title: "Trial: Contagion Wraith",
        description: "The chapter trial. The outbreak cluster's final form. Three linked cases, one airborne source, one chance to contain it. Stop the spread and earn your Chapter 7 star.",
        icon: "skull-outline",
        route: "/battle?enemyId=contagion_wraith",
        rewardXp: 55,
        rewardCoins: 45,
        rewardShards: 8,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 8 — Advanced Simulation Trials (7 parts, Level 12)
  // Harder simulation, Arena preview
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 8,
    id: "chapter_8",
    levelGate: 12,
    theme: "Advanced Simulation Trials",
    purpose: "Harder simulations and Arena preview before real-world transition",
    accentColor: C[8],
    icon: "trophy-outline",
    simulationEra: true,
    requiredCompletionNodes: ["c8p4", "c8p8"],
    parts: [
      {
        id: "c8p1",
        part: 1,
        type: "story",
        title: "Story: Final Simulation Clearance",
        description: "The University's evaluation board meets. One final assessment stands between you and the real ward.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c8p2",
        part: 2,
        type: "story",
        title: "Two Patients, One Nurse",
        description: "Two alarms. Two patients. One decision. The System does not offer a pause button.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c8p3",
        part: 3,
        type: "story",
        title: "The Hardest Call",
        description: "Acuity levels overlap. The obvious choice is not always the right one.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c8p4",
        part: 4,
        type: "battle",
        title: "Simulation Shift: Mind Fog",
        description: "A neurological case — confusion, altered GCS. Think beyond the obvious.",
        icon: "medical-outline",
        route: "/shift",
        isPlaceholder: true,
      },
      {
        id: "c8p5",
        part: 5,
        type: "story",
        title: "The Evaluation Board",
        description: "A different kind of ward encounter. One case. One examiner. No retry.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c8p6",
        part: 6,
        type: "story",
        title: "Layers of Care",
        description: "Four interventions. Two complications. The System wants to see them in order.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c8p7",
        part: 7,
        type: "reward",
        title: "Final Clearance",
        description: "The evaluation board's last test. One patient, one concealed detail, no second attempt.",
        icon: "flag-outline",
        isPlaceholder: true,
      },
      // ── Node 8 — Chapter Trial (Mini-Boss) ───────────────────────────────
      {
        id: "c8p8",
        part: 8,
        type: "mini_boss",
        title: "Trial: Crisis Convergence",
        description: "The chapter trial. The hardest simulation yet: two simultaneous deteriorations, a hidden hyponatraemia, and one overloaded nurse. Prove your clinical judgment to earn your Chapter 8 star.",
        icon: "skull-outline",
        route: "/battle?enemyId=crisis_convergence",
        rewardXp: 60,
        rewardCoins: 50,
        rewardShards: 10,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 9 — First Real Ward (8 parts, Level 15)
  // TRANSITION: simulations end → real-world ward battles begin
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 9,
    id: "chapter_9",
    levelGate: 15,
    theme: "First Real Ward",
    purpose: "Transition from simulation to real-world ward battles",
    accentColor: C[9],
    icon: "business-outline",
    realWorldTransition: true,
    requiredCompletionNodes: ["c9p3", "c9p7", "c9p8"],
    parts: [
      {
        id: "c9p1",
        part: 1,
        type: "story",
        title: "The Simulation Doors Open",
        description: "The sealed simulation chamber powers down for the last time. For the first time, the ward did not reset.",
        icon: "film-outline",
        route: "/story-scene?sceneId=chapter_09",
      },
      {
        id: "c9p2",
        part: 2,
        type: "story",
        title: "Real Ward Briefing",
        description: "No simulation safety net. Real patients, real stakes — the signs are still there, but hesitation now has a cost.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        // Chapter 9 Trial — the Dehydration Specter returns in its true form.
        // This is the simulation-era Specter reawakened as a Ch9-difficulty boss:
        // fewer visible cues, higher corruption, active stability resistance.
        // Must be won before Chapter 9 completion is granted.
        id: "c9p3",
        part: 3,
        type: "mini_boss",
        title: "Trial: The Specter Returns",
        description: "The Fluid Phantom you faced in Chapter 1 was a shadow of this. The Dehydration Specter is the original — no visible cues to guide you, corruption that resists stabilisation, and a pace that does not wait. Face it at full severity.",
        icon: "skull-outline",
        route: "/battle?enemyId=dehydration_specter",
        rewardXp: 80,
        rewardCoins: 60,
        rewardShards: 20,
      },
      {
        id: "c9p4",
        part: 4,
        type: "battle",
        title: "Real Ward Shift: Breathless Gale Spirit",
        description: "The Air Sprite's true form. Real respiratory deterioration — intervene before SpO₂ drops further. Airway does not wait.",
        icon: "medical-outline",
        route: "/shift",
        isPlaceholder: true,
      },
      {
        id: "c9p5",
        part: 5,
        type: "story",
        title: "The Pace Changes",
        description: "Simulation rounds had a rhythm. The real ward does not.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c9p6",
        part: 6,
        type: "story",
        title: "Committed",
        description: "The simulation always reset. This one does not. Apply ABCDE — and hold the call.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c9p7",
        part: 7,
        type: "battle",
        title: "Real Enemy Finale: Burning Fever Shade",
        description: "The Fever Imp's true form — systemic infection with hidden spread vectors. Read the complicating clues before treating.",
        icon: "skull-outline",
        route: "/shift",
        isPlaceholder: true,
      },
      {
        id: "c9p8",
        part: 8,
        type: "reward",
        title: "Chapter Finale: The Ward That Does Not Pause",
        description: "The simulation era is behind you. The real ward does not pause, does not forgive, and does not reset. You are ready.",
        icon: "flag-outline",
        isPlaceholder: true,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 10 — Return to the Silent Infarction (8 parts, Level 18)
  // PHASE 1 FINALE — ends the first era
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 10,
    id: "chapter_10",
    levelGate: 18,
    theme: "Return to the Silent Infarction",
    purpose: "Phase 1 finale — the first rematch and era conclusion",
    accentColor: C[10],
    icon: "bonfire-outline",
    phaseFinale: true,
    requiredCompletionNodes: ["c10p6", "c10p8"],
    parts: [
      {
        id: "c10p1",
        part: 1,
        type: "story",
        title: "Story: What the Recall Could Not Erase",
        description: "A memory surfaces: the silent infarction from the earliest days. It was never fully resolved.",
        icon: "film-outline",
        isPlaceholder: true,
      },
      {
        id: "c10p2",
        part: 2,
        type: "story",
        title: "The Silent Pattern",
        description: "A quiet presentation. Vital signs holding. The System marks something in the chart that most eyes pass over.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c10p3",
        part: 3,
        type: "battle",
        title: "Ward Shift: Storm Echo",
        description: "A multi-system storm — sepsis-adjacent. The hardest real-ward shift of Phase 1.",
        icon: "medical-outline",
        route: "/shift",
        isPlaceholder: true,
      },
      {
        id: "c10p4",
        part: 4,
        type: "story",
        title: "Diagnostic Under Fire",
        description: "One case. One examiner. The final test of everything the ward has taught.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c10p5",
        part: 5,
        type: "realm",
        title: "Realm Task: Prepare the Sanctuary",
        description: "The Realm must be ready. Fortify your Sanctuary before the finale encounter.",
        icon: "home-outline",
        route: "/kingdom",
        isPlaceholder: true,
      },
      {
        id: "c10p6",
        part: 6,
        type: "battle",
        title: "Boss Ward: Lord Imbalance Echo",
        description: "Lord Imbalance appears again — stronger, with an additional phase unlocked.",
        icon: "skull-outline",
        route: "/boss",
        isPlaceholder: true,
      },
      {
        id: "c10p7",
        part: 7,
        type: "story",
        title: "Cutscene: The Silent Infarction Returns",
        description: "The final scene unfolds. The body's silence broke — and you were there to hear it.",
        icon: "film-outline",
        isPlaceholder: true,
      },
      {
        id: "c10p8",
        part: 8,
        type: "battle",
        title: "Phase Finale: Silent Infarction, First Rematch",
        description: "The Phase 1 boss. The Silent Infarction — now fully formed. Win to close Phase 1.",
        icon: "bonfire-outline",
        route: "/battle",
        isPlaceholder: true,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2 — AGE II: THE OUTER WARDS
  // Chapters 41–80 · The Emergency Floor, Critical Care, Specialist Rotations,
  // and the Ward That Never Sleeps.
  //
  // Chapters 41–43 are skeleton stubs that give Age II Book V its first real
  // nodes.  Chapters 44–80 will be fleshed out by the narrative team.
  // ═══════════════════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 41 — First Outer Ward (5 nodes, Level 30)
  // Opening chapter of Age II.  The Emergency Floor — no simulation safety net.
  // story → story → battle → reflection → mini_boss
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 41,
    id: "chapter_41",
    levelGate: 30,
    theme: "First Outer Ward",
    purpose: "Enter the Emergency Floor — the first Age II encounter with unfiltered urgency",
    accentColor: C[41],
    icon: "alert-circle-outline",
    simulationEra: false,
    completionXp: 80,
    prepTips: [
      "Cue Hunt Lab: Emergency Signs — spot the rapid-deterioration markers",
      "Rapid Triage Hall: Mass Casualty Drill — sort under extreme pressure",
      "Stabilize Stack Lab: ABCDE in the Field — airway-first sequencing",
      "Lotus Lesson: Adrenaline & Calm — managing stress during crises",
    ],
    failureHint: {
      text: "Emergency cases move faster than ward shifts and punish hesitation. Drill your ABCDE sequence until it is automatic — the cues are there if you look in order.",
      practices: [
        "Clinical Cue Lab: Rapid Deterioration Signs — time-pressure spotting",
        "Rapid Triage Hall: Mass Casualty Drill — sustained high-acuity focus",
        "Stabilize Stack Lab: ABCDE First — locked sequencing under pressure",
        "Lotus Lesson: Adrenaline & Calm — regulate before you react",
      ],
      primaryRoute: "/university",
      secondaryRoute: "/university/skill-academy",
    },
    requiredCompletionNodes: ["c41p3", "c41p5"],
    parts: [
      {
        id: "c41p1",
        part: 1,
        type: "story",
        title: "Beyond the Training Doors",
        description: "The simulation chamber is gone. The Emergency Floor does not reset, does not pause, and does not grade on a curve. The System's voice is quieter here — it watches instead of guides.",
        icon: "book-outline",
        isPlaceholder: true,
        rewardXp: 15,
        rewardCoins: 30,
      },
      {
        id: "c41p2",
        part: 2,
        type: "story",
        title: "The First Real Triage",
        description: "Three patients. One nurse. The floor does not care which one you feel most prepared for. The System marks your priority choice — and the clock starts now.",
        icon: "book-outline",
        isPlaceholder: true,
        rewardXp: 15,
        rewardCoins: 30,
      },
      {
        id: "c41p3",
        part: 3,
        type: "battle",
        title: "Emergency Shift: Haemorrhagic Wraith",
        description: "A trauma patient — blood pressure dropping, source not yet identified. Stop the cascade before the Wraith compounds the collapse.",
        icon: "medical-outline",
        route: "/shift",
        isPlaceholder: true,
        rewardXp: 40,
        rewardCoins: 40,
      },
      {
        id: "c41p4",
        part: 4,
        type: "reflection",
        title: "After the Adrenaline",
        description: "The patient stabilised. The System asks: what did you see first, and what did you almost miss? The debrief on the Emergency Floor is brief — another case is already waiting.",
        icon: "alert-circle-outline",
        isPlaceholder: true,
        rewardXp: 10,
        rewardCoins: 15,
      },
      {
        id: "c41p5",
        part: 5,
        type: "mini_boss",
        title: "Trial: The Collapse Shade",
        description: "The chapter trial. A multi-system collapse — haemorrhage layered with early sepsis. Identify the compound threat and resolve both before the window closes.",
        icon: "skull-outline",
        route: "/battle?enemyId=collapse_shade",
        isPlaceholder: true,
        rewardXp: 80,
        rewardCoins: 60,
        rewardShards: 20,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 42 — Triage Under Pressure (5 nodes, Level 31)
  // Mass-casualty scenario.  Sorting and prioritising under simultaneous demand.
  // story → battle → story → ward_defense → mini_boss
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 42,
    id: "chapter_42",
    levelGate: 31,
    theme: "Triage Under Pressure",
    purpose: "Mass-casualty triage — rapid prioritisation with imperfect information",
    accentColor: C[42],
    icon: "people-outline",
    simulationEra: false,
    completionXp: 85,
    prepTips: [
      "Rapid Triage Hall: Mass Casualty Drill — sustained multi-patient prioritisation",
      "Cue Hunt Lab: Concurrent Signs — find overlapping cues across two patients",
      "Lotus Lesson: Decision Fatigue — why the fourth decision is harder than the first",
    ],
    failureHint: {
      text: "Triage enemies attack your decision-making, not just your patient. Practise sorting quickly — the penalty is worse on the patients you reach last.",
      practices: [
        "Rapid Triage Hall: Mass Casualty Drill — speed and accuracy together",
        "Clinical Cue Lab: Concurrent Signs — reading two situations at once",
        "Lotus Lesson: Decision Fatigue — sustaining judgment under load",
      ],
      primaryRoute: "/university",
      secondaryRoute: "/university/skill-academy",
    },
    requiredCompletionNodes: ["c42p2", "c42p5"],
    parts: [
      {
        id: "c42p1",
        part: 1,
        type: "story",
        title: "The Surge",
        description: "A multi-vehicle incident fills the bay. Nine patients. Four acuity levels. The System flags a timer — the window for each prioritisation decision is shrinking.",
        icon: "book-outline",
        isPlaceholder: true,
        rewardXp: 15,
        rewardCoins: 30,
      },
      {
        id: "c42p2",
        part: 2,
        type: "battle",
        title: "Emergency Shift: Surge Wraith",
        description: "The Surge Wraith embodies competing critical demands — hit one patient and it redirects pressure to another. Spread your care correctly or the wave consumes both.",
        icon: "medical-outline",
        route: "/shift",
        isPlaceholder: true,
        rewardXp: 45,
        rewardCoins: 45,
      },
      {
        id: "c42p3",
        part: 3,
        type: "story",
        title: "Between the Calls",
        description: "A moment of relative quiet in the bay. The System surfaces what the triage chart does not show — the patient who is quiet is not always stable.",
        icon: "book-outline",
        isPlaceholder: true,
        rewardXp: 15,
        rewardCoins: 20,
      },
      {
        id: "c42p4",
        part: 4,
        type: "ward_defense",
        title: "Bay Perimeter: The Overflow Ward",
        description: "The bay spills into the corridor. Defend the overflow perimeter — each wave of patients tests the priority system you built.",
        icon: "shield-half-outline",
        route: "/ward-defense",
        isPlaceholder: true,
        rewardXp: 40,
        rewardCoins: 40,
      },
      {
        id: "c42p5",
        part: 5,
        type: "mini_boss",
        title: "Trial: The Mass Event Spectre",
        description: "The chapter trial. A mass-casualty event crystallised into one encounter — simultaneous haemorrhage, toxicology, and airway threats across three linked patients. Prioritise correctly to earn your Chapter 42 star.",
        icon: "skull-outline",
        route: "/battle?enemyId=mass_event_spectre",
        isPlaceholder: true,
        rewardXp: 85,
        rewardCoins: 65,
        rewardShards: 22,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 43 — The Night Team (5 nodes, Level 32)
  // Reduced staffing, lower visibility, heightened autonomy.
  // story → battle → story → battle → mini_boss
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 43,
    id: "chapter_43",
    levelGate: 32,
    theme: "The Night Team",
    purpose: "Night-shift autonomy — fewer hands, harder cues, escalation decisions",
    accentColor: C[43],
    icon: "moon-outline",
    simulationEra: false,
    completionXp: 90,
    prepTips: [
      "Lotus Lesson: Night Physiology — how bodies change at night and why cues shift",
      "Cue Hunt Lab: Low-Light Signs — subtle overnight presentation patterns",
      "Rapid Triage Hall: Solo Nurse Drill — independent decision-making without backup",
    ],
    failureHint: {
      text: "Night-shift enemies exploit exhaustion and delay — cues are subtler and escalation windows are narrower. Practise independent decision-making so hesitation costs nothing.",
      practices: [
        "Lotus Lesson: Night Physiology — overnight physiology and shifted baselines",
        "Clinical Cue Lab: Low-Light Signs — subtle presentations under low alertness",
        "Rapid Triage Hall: Solo Nurse Drill — autonomous action without prompts",
      ],
      primaryRoute: "/university",
      secondaryRoute: "/university/skill-academy",
    },
    requiredCompletionNodes: ["c43p2", "c43p5"],
    parts: [
      {
        id: "c43p1",
        part: 1,
        type: "story",
        title: "Lights Down",
        description: "The day team hands over. The ward is quieter — but the System knows that quiet does not mean safe. Three patients flagged for overnight watch. One of them will deteriorate before 03:00.",
        icon: "book-outline",
        isPlaceholder: true,
        rewardXp: 15,
        rewardCoins: 30,
      },
      {
        id: "c43p2",
        part: 2,
        type: "battle",
        title: "Night Shift: The Dusk Phantom",
        description: "The Dusk Phantom masks corruption behind normal overnight vitals. Read the pattern across three observations — the deviation only becomes clear in sequence.",
        icon: "medical-outline",
        route: "/shift",
        isPlaceholder: true,
        rewardXp: 50,
        rewardCoins: 50,
      },
      {
        id: "c43p3",
        part: 3,
        type: "story",
        title: "The Escalation Call",
        description: "03:17. The patient you flagged is deteriorating faster than the chart predicted. The registrar is not on the floor. The System asks: when do you call, and what do you say?",
        icon: "book-outline",
        isPlaceholder: true,
        rewardXp: 15,
        rewardCoins: 25,
      },
      {
        id: "c43p4",
        part: 4,
        type: "battle",
        title: "Night Shift: Silence Wraith",
        description: "The ward quiets again — deceptively. The Silence Wraith uses low-acuity presentation to buy time for a second deterioration. Catch the masked progression before dawn.",
        icon: "medical-outline",
        route: "/shift",
        isPlaceholder: true,
        rewardXp: 50,
        rewardCoins: 50,
      },
      {
        id: "c43p5",
        part: 5,
        type: "mini_boss",
        title: "Trial: The Night Sovereign",
        description: "The chapter trial. The Night Sovereign commands both the Dusk Phantom and Silence Wraith in concert — alternating masked corruption and rapid-onset deterioration. Hold the ward through the darkest hour to earn your Chapter 43 star.",
        icon: "skull-outline",
        route: "/battle?enemyId=night_sovereign",
        isPlaceholder: true,
        rewardXp: 90,
        rewardCoins: 70,
        rewardShards: 25,
      },
    ],
  },
];

// ── Helper functions ──────────────────────────────────────────────────────────

/**
 * Returns the chapter a player is currently on based on their Player Level.
 *
 * P1: Accepts an optional claimedNodeIds array. When provided, the function
 * also enforces each chapter's requiredCompletionNodes gate — a chapter is
 * only considered "reached" if the previous chapter's required nodes are all
 * in claimedNodeIds.  Omitting the parameter preserves the original level-only
 * behaviour for call sites that haven't been updated yet.
 */
export function getCurrentChapter(
  playerLevel: number,
  claimedNodeIds?: string[],
): Chapter {
  let active = CHAPTERS[0];
  for (let i = 0; i < CHAPTERS.length; i++) {
    const ch = CHAPTERS[i];
    if (playerLevel < ch.levelGate) break;
    // Completion gate: if claimedNodeIds are provided, ensure the previous
    // chapter's requiredCompletionNodes are all cleared before advancing.
    if (i > 0 && claimedNodeIds) {
      const prev = CHAPTERS[i - 1];
      if (prev.requiredCompletionNodes?.length) {
        const allDone = prev.requiredCompletionNodes.every((id) =>
          claimedNodeIds.includes(id),
        );
        if (!allDone) break;
      }
    }
    active = ch;
  }
  return active;
}

/**
 * Returns the status of a chapter relative to a given player level.
 * "complete" = player has surpassed this chapter's range (next chapter also unlocked).
 * "active"   = this is the player's current chapter.
 * "locked"   = player hasn't met the level gate yet (or completion gate blocked it).
 *
 * P1: Pass claimedNodeIds to enable the completion gate — Chapter N+1 is locked
 * until all of Chapter N's requiredCompletionNodes appear in claimedNodeIds.
 * Omitting the parameter preserves level-only logic for un-updated call sites.
 */
export type ChapterStatus = "complete" | "active" | "locked";

export function getChapterStatus(
  chapter: Chapter,
  playerLevel: number,
  claimedNodeIds?: string[],
): ChapterStatus {
  const idx = CHAPTERS.findIndex((c) => c.id === chapter.id);

  // Base level gate.
  if (playerLevel < chapter.levelGate) return "locked";

  // Completion gate: check that the previous chapter's requiredCompletionNodes
  // are all cleared before treating this chapter as accessible.
  if (idx > 0 && claimedNodeIds) {
    const prev = CHAPTERS[idx - 1];
    if (prev.requiredCompletionNodes?.length) {
      const allDone = prev.requiredCompletionNodes.every((id) =>
        claimedNodeIds.includes(id),
      );
      if (!allDone) return "locked";
    }
  }

  const next = CHAPTERS[idx + 1];
  if (!next || playerLevel < next.levelGate) return "active";
  // P8: gate "complete" on THIS chapter's own requiredCompletionNodes being cleared.
  if (claimedNodeIds && chapter.requiredCompletionNodes?.length) {
    const allDone = chapter.requiredCompletionNodes.every((id) =>
      claimedNodeIds.includes(id),
    );
    if (!allDone) return "active";
  }
  return "complete";
}

/**
 * Returns the next actionable part for the active chapter.
 *
 * P1: Pass claimedNodeIds to skip already-claimed nodes and return the first
 * unclaimed part with a route instead of always the first routable part.
 */
export function getNextRecommendedPart(
  playerLevel: number,
  claimedNodeIds?: string[],
): {
  chapter: Chapter;
  part: ChapterPart;
} | null {
  const ch = getCurrentChapter(playerLevel, claimedNodeIds);

  // First unclaimed non-placeholder part that has a navigable route.
  const unclaimed = claimedNodeIds
    ? ch.parts.find(
        (p) => p.route && !p.isPlaceholder && !claimedNodeIds.includes(p.id),
      )
    : null;

  const part =
    unclaimed ??
    ch.parts.find((p) => p.route && !p.isPlaceholder) ??
    ch.parts[0];

  return { chapter: ch, part };
}

/**
 * J5: Returns the failure hint for a given chapter number (1–10), or null if
 * no hint is defined. Used by the battle result screen to surface contextual
 * University practice recommendations after a loss.
 */
export function getChapterFailureHint(chapterNumber: number): ChapterFailureHint | null {
  const ch = CHAPTERS.find((c) => c.number === chapterNumber);
  return ch?.failureHint ?? null;
}

/** Phase 1 summary used in locked-chapter previews. */
export const PHASE_1_SUMMARY =
  "Phase 1 covers your first era as a summoned healer — from clinical chain basics " +
  "through University simulations, Ward Defense, Boss Wards, and finally your first " +
  "real-world battles. Phase 1 ends with the Silent Infarction rematch at Chapter 10.";

/** Phase 2 — Age II summary used in locked-chapter and hierarchy previews. */
export const PHASE_2_OUTER_WARDS_SUMMARY =
  "Age II: The Outer Wards takes you beyond the training grounds into the Emergency " +
  "Floor, Critical Care, Specialist Rotations, and finally the ward that never sleeps. " +
  "Stakes are higher, cues are subtler, and the enemies are stronger than anything " +
  "seen in Age I.";
