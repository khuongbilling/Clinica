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
  | "reflection"      // Post-chapter reflection / debrief beat
  | "reward"          // Chapter reward node
  | "realm"           // Realm task
  | "mode_preview"    // First intro to a new mode (Boss Ward, etc.)
  | "chain"           // Clinical chain mini-sequence
  | "community"       // Community Board / public health task
  | "arena";          // Arena / duel format

// ── Data interfaces ──────────────────────────────────────────────────────────

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
    parts: [
      {
        id: "c1p1",
        part: 1,
        type: "story",
        title: "The System Awakens",
        description: "You are summoned into the Kingdom of Healing. The System speaks for the first time — the ward is already under threat.",
        icon: "film-outline",
        route: "/story-scene?sceneId=chapter_01",
        rewardXp: 5,
      },
      {
        id: "c1p2",
        part: 2,
        type: "battle",
        title: "First Simulation — Dehydration Wisp",
        description: "Your first supervised encounter. The Wisp feeds on lost fluids. Read the cues, act fast, earn your star.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 15,
        rewardCoins: 15,
      },
      {
        id: "c1p3",
        part: 3,
        type: "story",
        title: "Mentor Bai's Warning",
        description: "Master Bai appears in the ward corridor. Something darker than a Wisp is stirring deeper in the realm.",
        icon: "book-outline",
        isPlaceholder: true,
        rewardXp: 5,
      },
      {
        id: "c1p4",
        part: 4,
        type: "battle",
        title: "Simulation — The Fading Apprentice",
        description: "A student healer is deteriorating. The cues are subtler this time — don't let the silence mislead you.",
        icon: "medical-outline",
        route: "/shift",
        rewardXp: 20,
        rewardCoins: 20,
      },
      {
        id: "c1p5",
        part: 5,
        type: "mini_boss",
        title: "Trial: The Fading Apprentice",
        description: "The chapter trial. Face a harder form of the Apprentice's condition — apply everything the ward has taught you.",
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
 * A chapter is "active" if the player meets its level gate but not the next.
 */
export function getCurrentChapter(playerLevel: number): Chapter {
  let active = CHAPTERS[0];
  for (const ch of CHAPTERS) {
    if (playerLevel >= ch.levelGate) active = ch;
    else break;
  }
  return active;
}

/**
 * Returns the status of a chapter relative to a given player level.
 * "complete" = player has surpassed this chapter's range (next chapter also unlocked).
 * "active"   = this is the player's current chapter.
 * "locked"   = player hasn't met the level gate yet.
 */
export type ChapterStatus = "complete" | "active" | "locked";

export function getChapterStatus(chapter: Chapter, playerLevel: number): ChapterStatus {
  const idx = CHAPTERS.findIndex((c) => c.id === chapter.id);
  const next = CHAPTERS[idx + 1];
  if (playerLevel < chapter.levelGate) return "locked";
  if (!next || playerLevel < next.levelGate) return "active";
  return "complete";
}

/**
 * Returns the next actionable part for the active chapter.
 * Chapters 2–10 are all placeholders for now; Chapter 1's first 3 parts have routes.
 */
export function getNextRecommendedPart(playerLevel: number): {
  chapter: Chapter;
  part: ChapterPart;
} | null {
  const ch = getCurrentChapter(playerLevel);
  const part = ch.parts.find((p) => p.route && !p.isPlaceholder) ?? ch.parts[0];
  return { chapter: ch, part };
}

/** Phase 1 summary used in locked-chapter previews. */
export const PHASE_1_SUMMARY =
  "Phase 1 covers your first era as a summoned healer — from clinical chain basics " +
  "through University simulations, Ward Defense, Boss Wards, and finally your first " +
  "real-world battles. Phase 1 ends with the Silent Infarction rematch at Chapter 10.";
