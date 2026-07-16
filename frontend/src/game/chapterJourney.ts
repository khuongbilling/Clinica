/**
 * Chapter Journey — Phase 1 Map (Chapters 1–10)
 *
 * Single source of truth for the Chapter Journey Map shell.
 * Chapters 1–8 are University-supervised simulations.
 * Chapter 9 transitions to real-world ward battles.
 * Chapter 10 is the Phase 1 finale.
 *
 * Phase 2 (Chapters 11–20) is NOT defined here — only Phase 1.
 *
 * ECONOMY: uses only Ward Coins, University Credits, Codex Shards,
 * Lotus Gems, and Refined Lotus Gems. No new currencies added.
 */

// ── Part types ───────────────────────────────────────────────────────────────

export type ChapterPartType =
  | "battle"          // Ward Shift simulation or real enemy fight
  | "mini_boss"       // Chapter mini-boss encounter (harder Ward Shift node)
  | "ward_defense"    // Ward Defense wave / encounter node
  | "minigame"        // Cue Hunt / Rapid Triage / Stabilize Stack (University only — not on map)
  | "lesson"          // Lotus Lesson node
  | "story"           // Story cutscene / narrative beat
  | "memory_fragment" // P1: first-memory / recall story beat (replaces plain "story" for anchor nodes)
  | "challenge"       // P1: skill-challenge mini-game node (Rapid Triage, Stabilize Stack, Cue Hunt)
  | "reflection"      // Post-chapter reflection / debrief beat
  | "reward"          // Chapter reward node
  | "realm"           // Realm task
  | "mode_preview"    // First intro to a new mode (Boss Ward, etc.)
  | "chain"           // Clinical chain mini-sequence
  | "community"       // Community Board / public health task
  | "arena";          // Arena / duel format

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
  rewardShards?: number;  // Summoning Shards
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
  primaryRoute: string;
  /** Secondary deep link route (Hero Skill Academy). */
  secondaryRoute: string;
}

// ── Chapter accent palette (one per chapter, warm-dark donghua tones) ────────

const C: Record<number, string> = {
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
};

// ── Phase 1 chapter definitions ───────────────────────────────────────────────

export const CHAPTERS: Chapter[] = [

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 1 — The Fading Apprentice (5 nodes, Level 1)
  // J1: story → battle → story → battle → mini-boss
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
    prepTips: [
      "Cue Hunt Lab — find three hidden clinical cues",
      "Rapid Triage Hall — sort patients by urgency",
      "Stabilize Stack Lab — build the safe care sequence",
      "Lotus Lesson: Hydration Basics — fluids as first language",
    ],
    failureHint: {
      text: "Hydration cases hide their cues. Practice spotting the early signs before they fade — then your Scout and Stabilize actions will land much harder.",
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
      // ── Node 2 — Challenge: Rapid Triage ─────────────────────────────────
      {
        id: "c1n2",
        part: 2,
        type: "challenge",
        title: "Rapid Triage Drill",
        description: "Three patients, one correct order. Read the signs and decide who needs help first — urgency determines survival.",
        icon: "shuffle-outline",
        route: "/university/rapid-triage",
        rewardXp: 10,
        rewardCredits: 10,
      },
      // ── Node 3 — Challenge: Stabilize Stack ──────────────────────────────
      {
        id: "c1n3",
        part: 3,
        type: "challenge",
        title: "Stabilize Stack",
        description: "The right care steps in the right order. Build the safe sequence before the patient deteriorates further.",
        icon: "layers-outline",
        route: "/university/stabilize-stack",
        rewardXp: 10,
        rewardCredits: 10,
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
        title: "Trial: The Fading Apprentice",
        description: "The chapter trial. Face the apprentice's condition at full severity — apply everything the ward has taught you.",
        icon: "skull-outline",
        route: "/shift",
        rewardXp: 30,
        rewardCoins: 25,
        rewardShards: 5,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 2 — The First Ward Rotation (6 nodes, Level 2)
  // J1: story → battle → story → battle → battle → mini-boss
  // University prep: Fever Lesson · Fever Cue Hunt · Reassess Stabilize Stack
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
    parts: [
      {
        id: "c2p1",
        part: 1,
        type: "story",
        title: "First Rotation Briefing",
        description: "The System outlines the week ahead. Multiple patients. Multiple threats. The Apprentice's fate hangs in recent memory.",
        icon: "book-outline",
        isPlaceholder: true,
        rewardXp: 5,
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
      {
        id: "c2p2",
        part: 2,
        type: "battle",
        title: "Simulation — Fever Imp",
        description: "A low-grade fever case. Treat the source, not just the symptom. Read the cues before you act.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 15,
        rewardCoins: 15,
      },
      {
        id: "c2p3",
        part: 3,
        type: "story",
        title: "The First Ally",
        description: "A seasoned healer notices your technique. An alliance forms — and a warning is delivered about what lies ahead.",
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
      {
        id: "c2p4",
        part: 4,
        type: "battle",
        title: "Simulation — The Patient Who Changed Twice",
        description: "Vitals shift mid-shift. A stable patient suddenly isn't. Reassessment is not optional — it's the skill.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 20,
        rewardCoins: 20,
      },
      {
        id: "c2p5",
        part: 5,
        type: "battle",
        title: "Simulation — Warmth in the Ward",
        description: "Fever spreads to a second patient. Multiple active cases — prioritise, monitor, don't let the ward tip.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 20,
        rewardCoins: 20,
      },
      {
        id: "c2p6",
        part: 6,
        type: "mini_boss",
        title: "Trial: Fever Shade",
        description: "The Fever Imp's heavier cousin. Higher corruption pressure, hidden spread risk — apply your full rotation knowledge.",
        icon: "skull-outline",
        route: "/shift",
        rewardXp: 35,
        rewardCoins: 30,
        rewardShards: 5,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 3 — Breath Before Battle (7 nodes, Level 3)
  // J1: story → battle → battle → story → battle → mini-boss → reflection
  // University prep: Breathing Lesson · Shortness Cue Hunt · Airway Triage
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 3,
    id: "chapter_3",
    levelGate: 3,
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
      text: "Airway enemies hide their severity. Scout early to reveal hidden cues — once the wheeze goes silent, the window is closing fast.",
      practices: [
        "Lotus Lesson: Breathing Basics — SpO₂, respiratory rate, effort",
        "Clinical Cue Lab: Shortness of Breath — spot the airway distress signs",
        "Rapid Triage Hall: Airway First — ABCDE in a crowded corridor",
        "Stabilize Stack Lab: Open the Air Path — sequence before treatment",
      ],
      primaryRoute: "/university",
      secondaryRoute: "/university/skill-academy",
    },
    parts: [
      {
        id: "c3p1",
        part: 1,
        type: "story",
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
      {
        id: "c3p2",
        part: 2,
        type: "battle",
        title: "Simulation — Air Sprite",
        description: "Mild respiratory distress. Apply oxygen therapy, monitor SpO₂, and read the effort behind each breath.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 15,
        rewardCoins: 15,
      },
      {
        id: "c3p3",
        part: 3,
        type: "battle",
        title: "Simulation — The Hidden Wheeze",
        description: "A patient who looks calm but isn't. The cues are quiet. Find the wheeze before the corridor hears the alarm.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 20,
        rewardCoins: 20,
      },
      {
        id: "c3p4",
        part: 4,
        type: "story",
        title: "A Lesson in Priority",
        description: "Master Bai drills the ABCDE framework in the corridor. Why airway always leads — and what happens when it doesn't.",
        icon: "school-outline",
        isPlaceholder: true,
        rewardXp: 5,
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
      {
        id: "c3p5",
        part: 5,
        type: "battle",
        title: "Simulation — Breath Under Pressure",
        description: "A deteriorating patient, two competing priorities. Apply what you know — and make the call before the window closes.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 25,
        rewardCoins: 25,
      },
      {
        id: "c3p6",
        part: 6,
        type: "mini_boss",
        title: "Trial: Breathless Gale Spirit",
        description: "The Air Sprite's advanced form. Full respiratory cascade — intervene before SpO₂ drops beyond recovery.",
        icon: "skull-outline",
        route: "/shift",
        rewardXp: 35,
        rewardCoins: 30,
        rewardShards: 5,
      },
      {
        id: "c3p7",
        part: 7,
        type: "reflection",
        title: "What Air Teaches",
        description: "A quiet moment after the storm. Reflect on the breath — and why oxygen is the first language of clinical urgency.",
        icon: "leaf-outline",
        isPlaceholder: true,
        rewardXp: 10,
        rewardCredits: 10,
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
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 4 — Code Rush (6 nodes, Level 4)
  // J1: story → battle → ward_defense → story → ward_defense → mini-boss
  // University prep: Crowded Ward Triage · Protect the Ward Stabilize Stack
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 4,
    id: "chapter_4",
    levelGate: 4,
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
    parts: [
      {
        id: "c4p1",
        part: 1,
        type: "story",
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
      {
        id: "c4p2",
        part: 2,
        type: "battle",
        title: "Simulation — Crowded Ward Warning",
        description: "Volume pressure mounts. Multiple active patients, single team. Triage hard and don't let the overload tip into chaos.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 20,
        rewardCoins: 20,
      },
      {
        id: "c4p3",
        part: 3,
        type: "ward_defense",
        title: "Code Rush — First Wave",
        description: "Deploy your heroes. Intercept the first disease-wave before it reaches your patients. Position matters.",
        icon: "shield-half-outline",
        route: "/ward-defense",
        rewardXp: 25,
        rewardCoins: 25,
      },
      {
        id: "c4p4",
        part: 4,
        type: "story",
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
      {
        id: "c4p5",
        part: 5,
        type: "ward_defense",
        title: "Code Rush — Second Wave",
        description: "Stronger. Faster. The second wave doesn't stop at the corridor. Fortify your deployment — protect every patient.",
        icon: "shield-half-outline",
        route: "/ward-defense",
        rewardXp: 30,
        rewardCoins: 30,
      },
      {
        id: "c4p6",
        part: 6,
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
  // Chapter 5 — Building the Sanctuary (8 nodes, Level 5)
  // J1: story → realm → battle → story → battle → ward_defense → battle → mini-boss
  // University prep: Recovery Lesson · Fatigue Cue Hunt · Multi-Step Stabilize Stack
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 5,
    id: "chapter_5",
    levelGate: 5,
    theme: "Building the Sanctuary",
    purpose: "Realm foundation; recovery and circulation cases; Sanctuary as base of operations",
    accentColor: C[5],
    icon: "home-outline",
    simulationEra: true,
    completionXp: 80,
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
        rewardCredits: 10,
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
        route: "/shift",
        rewardXp: 50,
        rewardCoins: 40,
        rewardShards: 15,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 6 — First Boss Ward (6 parts, Level 7)
  // Boss Ward intro
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 6,
    id: "chapter_6",
    levelGate: 7,
    theme: "First Boss Ward",
    purpose: "Boss Ward intro — high-stakes multi-phase encounter",
    accentColor: C[6],
    icon: "skull-outline",
    simulationEra: true,
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
        type: "mode_preview",
        title: "Boss Ward Tutorial",
        description: "Boss Wards are multi-phase clinical emergencies. Understand the phases before the encounter begins.",
        icon: "skull-outline",
        route: "/boss",
        isPlaceholder: true,
      },
      {
        id: "c6p3",
        part: 3,
        type: "minigame",
        title: "Cue Hunt: Hidden Deterioration",
        description: "Some clinical changes hide behind stable-looking readings. Find what the chart conceals.",
        icon: "search-outline",
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
        type: "mode_preview",
        title: "Community Health Board Tutorial",
        description: "The Community Board lets you contribute to population-level health interventions.",
        icon: "people-outline",
        isPlaceholder: true,
      },
      {
        id: "c7p3",
        part: 3,
        type: "lesson",
        title: "Lesson: What Is an Outbreak?",
        description: "Epidemiology basics — how disease spreads from patient to community to population.",
        icon: "cellular-outline",
        route: "/university/lessons",
        isPlaceholder: true,
      },
      {
        id: "c7p4",
        part: 4,
        type: "chain",
        title: "Clinical Chain: Handwashing and Spread",
        description: "Infection control as intervention. Practice the Infection Control skill sequence.",
        icon: "hand-left-outline",
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
        type: "minigame",
        title: "Cue Hunt: Competing Priorities",
        description: "Two patients, overlapping cues. Which signal is urgent? Which is incidental?",
        icon: "search-outline",
        isPlaceholder: true,
      },
      {
        id: "c8p3",
        part: 3,
        type: "minigame",
        title: "Triage: Who First?",
        description: "A more complex triage — acuity levels blend. Apply your full clinical reasoning.",
        icon: "list-outline",
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
        type: "mode_preview",
        title: "Arena Preview",
        description: "The Arena opens for a single diagnostic duel. Speed and precision decide your score.",
        icon: "flash-outline",
        isPlaceholder: true,
      },
      {
        id: "c8p6",
        part: 6,
        type: "minigame",
        title: "Stabilize Stack: Multi-Step Plan",
        description: "The most complex stabilization yet. Four care phases, two complicating factors.",
        icon: "layers-outline",
        route: "/university/stabilize-stack",
        isPlaceholder: true,
      },
      {
        id: "c8p7",
        part: 7,
        type: "reward",
        title: "Finale: Trial of the Hidden Cue",
        description: "The evaluation board's final test. Find the hidden cue buried among normal readings.",
        icon: "flag-outline",
        isPlaceholder: true,
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
        id: "c9p3",
        part: 3,
        type: "battle",
        title: "First Real Enemy: True Dehydration Wraith",
        description: "The Dehydration Wisp was a controlled echo. This is the original — higher corruption pressure, fewer visible cues, no margin for delay.",
        icon: "skull-outline",
        route: "/shift",
        isPlaceholder: true,
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
        type: "mode_preview",
        title: "Rapid Rounds: Real Ward Rush",
        description: "Your first Rapid Rounds session on a real ward. Prioritise faster — stakes are real.",
        icon: "timer-outline",
        isPlaceholder: true,
      },
      {
        id: "c9p6",
        part: 6,
        type: "minigame",
        title: "Triage: No Reset Button",
        description: "Real triage means a wrong call stays wrong. Apply ABCDE — and commit.",
        icon: "list-outline",
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
        type: "chain",
        title: "Clinical Chain: Hidden Cardiac Cue",
        description: "Troponin. ST changes. A quiet, dangerous presentation. Catch it before the cascade.",
        icon: "heart-outline",
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
        type: "arena",
        title: "Arena Duel: Diagnostic Trial",
        description: "One-on-one: your clinical reasoning versus a simulated adversary. Speed and precision.",
        icon: "flash-outline",
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
