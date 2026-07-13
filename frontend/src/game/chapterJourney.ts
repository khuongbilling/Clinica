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
  | "minigame"        // Cue Hunt / Rapid Triage / Stabilize Stack
  | "lesson"          // Lotus Lesson node
  | "story"           // Story cutscene / narrative beat
  | "reward"          // Chapter reward / reflection node
  | "realm"           // Realm task
  | "mode_preview"    // First intro to a new mode (Ward Defense, Boss Ward, etc.)
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
  // Chapter 1 — The Fading Apprentice (5 parts, Level 1)
  // Clinical chain basics: Notice → Triage → Stabilize → Reinforce → Shift
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 1,
    id: "chapter_1",
    levelGate: 1,
    theme: "The Fading Apprentice",
    purpose: "Clinical chain basics",
    accentColor: C[1],
    icon: "sparkles-outline",
    parts: [
      {
        id: "c1p1",
        part: 1,
        type: "minigame",
        title: "Cue Hunt: The Fading Apprentice",
        description: "Identify the three hidden clinical cues. Notice before you act.",
        icon: "search-outline",
        route: "/university/cue-hunt",
      },
      {
        id: "c1p2",
        part: 2,
        type: "minigame",
        title: "Triage: What Matters First?",
        description: "Choose the right priority order. Learn what demands your attention first.",
        icon: "list-outline",
        route: "/university/rapid-triage",
      },
      {
        id: "c1p3",
        part: 3,
        type: "minigame",
        title: "Stabilize Stack",
        description: "Build the correct care sequence. Scout → Stabilize → Treat → Reassess.",
        icon: "layers-outline",
        route: "/university/stabilize-stack",
      },
      {
        id: "c1p4",
        part: 4,
        type: "lesson",
        title: "Lotus Lesson: Hydration Basics",
        description: "Reinforce early wellness and cue recognition. Fluids as the body's first language.",
        icon: "water-outline",
        route: "/university/lessons",
      },
      {
        id: "c1p5",
        part: 5,
        type: "battle",
        title: "First Simulation Shift",
        description: "Enter your first supervised simulation. Face the Dehydration Wisp, earn your star rating and first XP.",
        icon: "medical-outline",
        route: "/shift",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 2 — The First Ward Rotation (6 parts, Level 2)
  // Shifts, summon unlock preview, daily/weekly unlock preview
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 2,
    id: "chapter_2",
    levelGate: 2,
    theme: "The First Ward Rotation",
    purpose: "Ward Shifts, Summoning Hall preview, Daily Rounds unlock",
    accentColor: C[2],
    icon: "pulse-outline",
    parts: [
      {
        id: "c2p1",
        part: 1,
        type: "story",
        title: "Story: First Rotation Briefing",
        description: "The System outlines what a real ward rotation looks like. The Apprentice's fate hangs in memory.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c2p2",
        part: 2,
        type: "lesson",
        title: "Lotus Lesson: Fever & Warmth",
        description: "Understand fever as a defence mechanism. Body temperature as a diagnostic signal.",
        icon: "flame-outline",
        route: "/university/lessons",
        isPlaceholder: true,
      },
      {
        id: "c2p3",
        part: 3,
        type: "battle",
        title: "Simulation Shift: Fever Imp",
        description: "A low-grade fever case. Apply what you learned — read the cues, treat the cause.",
        icon: "medical-outline",
        route: "/shift",
        isPlaceholder: true,
      },
      {
        id: "c2p4",
        part: 4,
        type: "mode_preview",
        title: "Summoning Hall Tutorial",
        description: "The Recruitment Hall opens. Learn how to call your first hero from the gacha.",
        icon: "star-outline",
        route: "/university/recruit",
        isPlaceholder: true,
      },
      {
        id: "c2p5",
        part: 5,
        type: "chain",
        title: "Clinical Chain: Reassess Before You Celebrate",
        description: "The Reassess mechanic in practice. Confirm the patient improved — or catch a hidden change.",
        icon: "refresh-outline",
        isPlaceholder: true,
      },
      {
        id: "c2p6",
        part: 6,
        type: "battle",
        title: "Chapter Finale: The Patient Who Changed Twice",
        description: "A dynamic case where vitals shift mid-shift. Apply reassessment when it matters most.",
        icon: "flag-outline",
        route: "/shift",
        isPlaceholder: true,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 3 — Breath Before Battle (6 parts, Level 3)
  // Breathing basics, Rapid Rounds preview
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 3,
    id: "chapter_3",
    levelGate: 3,
    theme: "Breath Before Battle",
    purpose: "Breathing basics and Rapid Rounds preview",
    accentColor: C[3],
    icon: "cloud-outline",
    parts: [
      {
        id: "c3p1",
        part: 1,
        type: "lesson",
        title: "Lotus Lesson: Breathing Basics",
        description: "Oxygen as a lifeline. Read respiratory rate, effort, and SpO₂ the way the body broadcasts them.",
        icon: "water-outline",
        route: "/university/lessons",
        isPlaceholder: true,
      },
      {
        id: "c3p2",
        part: 2,
        type: "minigame",
        title: "Cue Hunt: Shortness of Breath",
        description: "Find the airway distress signs hidden in a new patient scene.",
        icon: "search-outline",
        isPlaceholder: true,
      },
      {
        id: "c3p3",
        part: 3,
        type: "minigame",
        title: "Triage: Airway First",
        description: "Sort respiratory patients by urgency. Airway always leads the ABCDE framework.",
        icon: "list-outline",
        isPlaceholder: true,
      },
      {
        id: "c3p4",
        part: 4,
        type: "battle",
        title: "Simulation Shift: Air Sprite",
        description: "An airway case — mild respiratory distress. Apply oxygen therapy and monitor closely.",
        icon: "medical-outline",
        route: "/shift",
        isPlaceholder: true,
      },
      {
        id: "c3p5",
        part: 5,
        type: "mode_preview",
        title: "Rapid Rounds Preview",
        description: "A first look at the fast-paced Rapid Rounds format. Speed and accuracy under pressure.",
        icon: "timer-outline",
        isPlaceholder: true,
      },
      {
        id: "c3p6",
        part: 6,
        type: "battle",
        title: "Finale: The Breathless Hall",
        description: "Multiple struggling patients. Practice prioritising airway before anything else.",
        icon: "flag-outline",
        route: "/shift",
        isPlaceholder: true,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 4 — Code Rush (5 parts, Level 4)
  // Ward Defense intro
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 4,
    id: "chapter_4",
    levelGate: 4,
    theme: "Code Rush",
    purpose: "Ward Defense intro",
    accentColor: C[4],
    icon: "shield-outline",
    parts: [
      {
        id: "c4p1",
        part: 1,
        type: "story",
        title: "Story: The Ward Doors Shake",
        description: "An alert rings. Multiple disease-forms breach the corridor. The ward must hold.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c4p2",
        part: 2,
        type: "mode_preview",
        title: "Ward Defense Tutorial",
        description: "Learn to deploy heroes and intercept waves before they reach your patients.",
        icon: "shield-outline",
        route: "/ward-defense",
        isPlaceholder: true,
      },
      {
        id: "c4p3",
        part: 3,
        type: "battle",
        title: "Ward Defense Wave",
        description: "Your first real wave. Position, intercept, and protect the wards.",
        icon: "alert-outline",
        route: "/ward-defense",
        isPlaceholder: true,
      },
      {
        id: "c4p4",
        part: 4,
        type: "minigame",
        title: "Stabilize Stack: Protect the Ward",
        description: "After the wave, stabilize the patients who took damage. Order matters.",
        icon: "layers-outline",
        route: "/university/stabilize-stack",
        isPlaceholder: true,
      },
      {
        id: "c4p5",
        part: 5,
        type: "battle",
        title: "Chapter Finale: Hold the Line",
        description: "A two-wave assault. Hold your formation — the corridor must not fall.",
        icon: "flag-outline",
        route: "/ward-defense",
        isPlaceholder: true,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter 5 — Building the Sanctuary (6 parts, Level 5)
  // Realm intro
  // ─────────────────────────────────────────────────────────────────────────
  {
    number: 5,
    id: "chapter_5",
    levelGate: 5,
    theme: "Building the Sanctuary",
    purpose: "Realm intro and first building placement",
    accentColor: C[5],
    icon: "home-outline",
    parts: [
      {
        id: "c5p1",
        part: 1,
        type: "story",
        title: "Story: The Empty Atrium",
        description: "The Realm opens. A vast, quiet space — ready to be shaped by your healing work.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c5p2",
        part: 2,
        type: "realm",
        title: "Place Your First Building",
        description: "Unlock the Lotus Library. Place your first Realm building to begin production.",
        icon: "home-outline",
        route: "/kingdom",
        isPlaceholder: true,
      },
      {
        id: "c5p3",
        part: 3,
        type: "realm",
        title: "Realm Task: Assign a Hero",
        description: "Assign one of your heroes to the Lotus Library. Assigned heroes boost production.",
        icon: "person-outline",
        route: "/kingdom",
        isPlaceholder: true,
      },
      {
        id: "c5p4",
        part: 4,
        type: "lesson",
        title: "Lotus Journal Wellness Link",
        description: "Your Realm reflects your wellness practice. Open the Lotus Plate Journal and log your first entry.",
        icon: "journal-outline",
        isPlaceholder: true,
      },
      {
        id: "c5p5",
        part: 5,
        type: "battle",
        title: "Simulation Shift: River Sludge",
        description: "A sluggish circulation case. Apply fluid management and cardiac monitoring.",
        icon: "medical-outline",
        route: "/shift",
        isPlaceholder: true,
      },
      {
        id: "c5p6",
        part: 6,
        type: "reward",
        title: "Chapter Finale: The Sanctuary Breathes",
        description: "The Realm takes its first breath. Reflect on what you've built — the ward and the world beyond it.",
        icon: "flag-outline",
        isPlaceholder: true,
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
        title: "Cutscene: The Simulation Doors Open",
        description: "The University's sealed simulation chamber powers down. Beyond it: the true ward.",
        icon: "film-outline",
        isPlaceholder: true,
      },
      {
        id: "c9p2",
        part: 2,
        type: "story",
        title: "Real Ward Briefing",
        description: "Your supervising healer briefs you. Real patients — no reset button, no controlled outcomes.",
        icon: "book-outline",
        isPlaceholder: true,
      },
      {
        id: "c9p3",
        part: 3,
        type: "battle",
        title: "First Real Enemy: True Dehydration Wraith",
        description: "The simulated Wisp had limits. The Wraith does not. Real fluids, real consequences.",
        icon: "skull-outline",
        route: "/shift",
        isPlaceholder: true,
      },
      {
        id: "c9p4",
        part: 4,
        type: "battle",
        title: "Real Ward Shift: Airway Counterpart",
        description: "The Air Sprite's true form. Real respiratory distress — intervene before SpO₂ drops further.",
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
        title: "Real Enemy Finale: True Fever Imp",
        description: "The Fever Imp's true form — systemic infection with complicating factors.",
        icon: "skull-outline",
        route: "/shift",
        isPlaceholder: true,
      },
      {
        id: "c9p8",
        part: 8,
        type: "reward",
        title: "Chapter Finale: The Ward That Does Not Pause",
        description: "Reflect on the crossing. Simulations prepared you — but the real ward never waits.",
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
