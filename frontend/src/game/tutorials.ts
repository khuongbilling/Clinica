export type TutorialId =
  | "prologueBattle"
  | "firstBattle"
  | "firstKingdom"
  | "firstSummon"
  | "firstWardDefense"
  | "firstHeroTeam"
  | "firstLotusEntry"
  | "systemHubIntro"
  | "systemWardHub"
  | "systemShops"
  // ── University mini-game tutorials (System-narrated, forced, no skip/close) ──
  | "cueHuntIntro"
  | "rapidTriageIntro"
  | "rapidTriageCard2"
  | "rapidTriageCard3"
  | "stabilizeIntro"
  // ── Off-Shift mini-game tutorials ──
  | "mealcraftIntro";

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  placement: "top" | "center" | "bottom";
  requireAction: boolean;
  requiredActionType?: string;
  /** When set, the step is only satisfied by tapping this exact skill id. */
  requiredSkillId?: string;
  /**
   * When set on a requireAction step, the step is satisfied by calling
   * onTargetTap(requiredTargetId) from the game screen. After the dialogue box
   * is dismissed, TutorialOverlay renders a BLOCKING scrim that captures all
   * taps; only the element rendered above zIndex 9500 (the highlighted target)
   * is reachable. Use useHighlightTarget(id) in the game screen to get the
   * correct style + press handler automatically.
   */
  requiredTargetId?: string;
  /**
   * Informational forced banner: renders as a positioned narrative box (like a
   * requireAction step) but advances via its own "Next" button rather than a
   * game action. Used by the System-narrated hub onboarding to point at real
   * on-screen UI (top stamina/currency bar, Ward banner, Shops) without needing
   * to hook a gameplay action.
   */
  banner?: boolean;
  nextText?: string;
  /**
   * Override the "X / Y" step counter shown in the tutorial overlay.
   * Use for multi-part tutorial sequences where steps belong to different
   * TutorialIds but should show a single consistent counter to the player
   * (e.g. Rapid Triage cards: "Card 1 / 3", "Card 2 / 3", "Card 3 / 3").
   * When absent the default "stepIndex+1 / totalSteps" label is shown.
   */
  progressLabel?: string;
}

export const TUTORIAL_LABELS: Record<TutorialId, string> = {
  prologueBattle: "Your First Shift",
  firstBattle: "Battle Basics",
  firstKingdom: "Sanctuary Basics",
  firstSummon: "Hero Summoning",
  firstWardDefense: "Ward Defense",
  firstHeroTeam: "Your Active Team",
  firstLotusEntry: "Lotus Plate Journal",
  systemHubIntro: "The System Awakens",
  systemWardHub: "The Ward",
  systemShops: "The Apothecary Market",
  cueHuntIntro: "Cue Hunt",
  rapidTriageIntro: "Rapid Triage",
  rapidTriageCard2: "Rapid Triage",
  rapidTriageCard3: "Rapid Triage",
  stabilizeIntro: "Stabilize Stack",
  mealcraftIntro: "Mealcraft: Lotus Plate",
};

// Narrator timeline: the System did not exist until the player was Recalled
// (end of the prologue). Both the prologue battle AND the second battle
// (firstBattle) are narrated by Master Bai — the Recall hasn't happened yet.
// Everything after those two is narrated by the System (dark silhouette until
// Player Level 10, then coloured by aptitude).
export function isSystemTutorial(id: TutorialId | null | undefined): boolean {
  return !!id && id !== "prologueBattle" && id !== "firstBattle";
}

// University mini-game tutorials are fully forced: no close, no skip, no X.
// The tap-to-reveal → tap-to-dismiss → highlight-and-block flow is the only
// path. Add any new mini-game tutorial ID here to opt it into that behavior.
export const FORCED_TUTORIAL_IDS: TutorialId[] = [
  "cueHuntIntro",
  "rapidTriageIntro",
  "rapidTriageCard2",
  "rapidTriageCard3",
  "stabilizeIntro",
  "mealcraftIntro",
];

export function isForcedTutorial(id: TutorialId | null | undefined): boolean {
  return !!id && FORCED_TUTORIAL_IDS.includes(id);
}

export const TUTORIALS: Record<TutorialId, TutorialStep[]> = {
  prologueBattle: [
    {
      id: "prologue_welcome",
      title: "Your First Patient",
      body: "I won't sugarcoat it. This patient needs real help. Two numbers tell you how they're doing: Stability is how safe they are, Corruption is how far the disease has taken hold. Keep Stability from hitting zero and bring Corruption to zero. I'll walk you through each step.",
      placement: "center",
      requireAction: false,
      nextText: "I'M READY",
    },
    {
      id: "prologue_cue",
      title: "Read the Signs First",
      body: "Before you act, a clinical question will appear. Take a moment. There's always a reason one answer is better than the others. A correct answer strengthens your actions this turn. An explanation follows either way. It won't delay you.",
      placement: "top",
      requireAction: true,
      requiredActionType: "cue",
      nextText: "ANSWER THE QUESTION",
    },
    {
      id: "prologue_skills",
      title: "Your Team's Skills",
      body: "Each healer brings clinical skills to the shift. Tap a skill to use it. Long-press any skill or item if you want to read the reasoning behind it first. Reading costs you nothing; use it whenever you're unsure.",
      placement: "center",
      requireAction: false,
      nextText: "UNDERSTOOD",
    },
    {
      id: "prologue_scout",
      title: "Step 1: Scout",
      body: "Don't rush to treat what you haven't assessed. Novice Guardian has Lantern of Clues ready. Use it to surface what this patient actually needs before you do anything else.",
      placement: "center",
      requireAction: true,
      requiredSkillId: "lantern_of_clues",
      nextText: "USE LANTERN OF CLUES",
    },
    {
      id: "prologue_stabilize",
      title: "Step 2: Stabilize",
      body: "Good. Now you know the picture. Village Caretaker's Guardian's Touch will shore up Stability. Buy the patient some time. Stability before everything else.",
      placement: "center",
      requireAction: true,
      requiredSkillId: "guardians_touch",
      nextText: "USE GUARDIAN'S TOUCH",
    },
    {
      id: "prologue_endturn",
      title: "Pass the Time",
      body: "Both healers have done what they can this turn. End the turn and let the team reset. Disease doesn't wait. Neither should you.",
      placement: "center",
      requireAction: true,
      requiredActionType: "endTurn",
      nextText: "END THE TURN",
    },
    {
      id: "prologue_counter",
      title: "Step 3: Counter",
      body: "The patient is steadier. Now push the disease back. Novice Guardian's Breath of Dawn reduces Corruption directly. This is where you go on the offensive.",
      placement: "center",
      requireAction: true,
      requiredSkillId: "breath_of_dawn",
      nextText: "USE BREATH OF DAWN",
    },
    {
      id: "prologue_reassess",
      title: "Step 4: Reassess",
      body: "Never assume improvement. Confirm it. Village Caretaker's Reassess will check on the patient and close the care chain. This completes the shift.",
      placement: "center",
      requireAction: true,
      requiredSkillId: "reassess",
      nextText: "USE REASSESS",
    },
    {
      id: "prologue_done",
      title: "Scout. Stabilize. Counter. Reassess.",
      body: "That's the care chain. Four steps, in that order, every shift. It's not complicated. It's just good clinical practice. The patient is safe. You did well.",
      placement: "center",
      requireAction: false,
      nextText: "FINISH THE SHIFT",
    },
  ],

  firstBattle: [
    {
      id: "first_battle_brief",
      title: "You Know the Chain",
      body: "Scout first. Reveal what the patient actually needs before you act. Then Stabilize, to protect them while you work. Then Counter, to push the disease back. Then Reassess, because good care confirms before it moves on. This case is harder than the last. I won't be guiding your hand from here. Trust the chain.",
      placement: "center",
      requireAction: false,
      banner: true,
      nextText: "BEGIN",
    },
  ],

  firstKingdom: [
    {
      id: "kingdom_overview",
      title: "Your Sanctuary",
      body: "SYSTEM: Sanctuary interface loaded. This is the Grand Ward Sanctuary, your base to build and expand. It is not a combat zone. Each battle you win earns Codex Shards you can spend on buildings and upgrades here.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "kingdom_buildings",
      title: "Sanctuary Inventory",
      body: "SYSTEM: Inventory system active. The grid starts mostly empty. Open Sanctuary Inventory to place buildings you have unlocked onto compatible plots. You can move or store them anytime. The Research Library holds your Codex. The Training Hall manages your team. The Apothecary stocks your items.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "kingdom_place",
      title: "Place a Building",
      body: "Open the Sanctuary Inventory (bottom-left button) and place any building onto an empty plot. Tap the green tile to confirm. Roads connect automatically.",
      placement: "bottom",
      requireAction: true,
      requiredActionType: "placeBuilding",
      nextText: "OPEN INVENTORY & PLACE",
    },
    {
      id: "kingdom_done",
      title: "Sanctuary Growing",
      body: "SYSTEM: Orientation complete. Return to the home screen when ready for a clinical encounter. Each battle covers a real nursing concept. The Codex holds deeper explanations after you win.",
      placement: "center",
      requireAction: false,
      nextText: "LET'S GO",
    },
  ],

  firstSummon: [
    {
      id: "summon_intro",
      title: "Recruitment Hall",
      body: "SYSTEM: Healer acquisition interface loaded. Codex Shards are earned from battles and lessons. Spend them here to recruit healers. Each hero carries clinical skills tied to a specific body system.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "summon_roles",
      title: "Healer Classifications",
      body: "SYSTEM: Role taxonomy logged. Scouts reveal diagnostic clues. Stabilizers protect patient Stability. Strikers reduce Disease Corruption. Coordinators provide team support. A balanced team performs better under pressure.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "summon_action",
      title: "Recruit a Healer",
      body: "SYSTEM: Recruitment options active. Use FREE DAILY RECRUITMENT (no shards required) or SINGLE RECRUITMENT to enroll a new healer. Duplicate recruits convert to Hero Shards. Assign recruited heroes to your active team before the next shift.",
      placement: "bottom",
      requireAction: true,
      requiredActionType: "summon",
      nextText: "TAP FREE OR SINGLE RECRUITMENT",
    },
  ],

  // ── Ward Defense first-entry tutorial ──
  firstWardDefense: [
    {
      id: "wd_intro",
      title: "Ward Defense",
      body: "SYSTEM: Ward Defense interface loaded. Disease entities advance along the road toward the Vital Lantern. If they reach it, the patient is lost. Deploy healer units on the board to intercept them.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "wd_ap",
      title: "Action Points",
      body: "SYSTEM: Resource system active. Each healer unit costs Action Points (AP) to deploy. AP regenerates over time and increases when you answer a Clinical Question correctly before a wave. Deploy strategically.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "wd_deploy",
      title: "Deploy a Healer",
      body: "Select a unit from the dock at the bottom, then tap an empty tile on the board to place it. Ward Scout is a low-cost starting option. Deploy one now.",
      placement: "bottom",
      requireAction: true,
      requiredActionType: "deploy",
      nextText: "DEPLOY A UNIT",
    },
    {
      id: "wd_merge",
      title: "Care Synthesis",
      body: "Deploy two identical same-level units and tap SYNTHESIZE to merge them into a stronger one. Stronger units deal more damage and cover greater range. Use this whenever the option appears.",
      placement: "bottom",
      requireAction: true,
      requiredActionType: "merge",
      nextText: "SYNTHESIZE TWO UNITS",
    },
    {
      id: "wd_done",
      title: "Protect the Vital Lantern",
      body: "Matched units deal bonus damage. Assess units reveal enemy weaknesses first; Treat units follow with increased impact. Monitor the Corruption and Stability bars above. Begin when ready.",
      placement: "center",
      requireAction: false,
      nextText: "BEGIN THE DEFENSE",
    },
  ],

  // ── Hall of Heroes first-entry tutorial ──
  firstHeroTeam: [
    {
      id: "heroes_intro",
      title: "Healer Roster",
      body: "SYSTEM: Hall of Heroes interface loaded. All recruited healers are stored here. Up to 3 can be assigned to your active team for clinical shifts.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "heroes_set",
      title: "Assign Active Team",
      body: "SYSTEM: Team configuration required. Tap the + button on any owned hero card to add them to your active team. Tap again to remove. Changes save immediately.",
      placement: "bottom",
      requireAction: true,
      requiredActionType: "setTeam",
      nextText: "ADD A HERO TO TEAM",
    },
  ],

  // ── Lotus Plate Journal first-entry tutorial ──
  firstLotusEntry: [
    {
      id: "lotus_intro",
      title: "Lotus Plate Journal",
      body: "SYSTEM: Wellness interface loaded. This is your off-shift space. Log meals, hydration, and habits to grow your Nutrition Garden and earn Nourishment Petals. No Stamina cost.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "lotus_garden",
      title: "Nutrition Garden",
      body: "SYSTEM: Garden metrics active. Four meters track your logged inputs: Hydration, Fiber, Protein, and Heart. Consistent logging keeps them healthy. This space supports your well-being, not combat performance.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "lotus_log",
      title: "Log Your First Entry",
      body: "Tap LOG A MEAL OR CHECK-IN to build your first plate or record a habit check-in. Every entry earns Nourishment Petals for cosmetic rewards.",
      placement: "bottom",
      requireAction: true,
      requiredActionType: "logEntry",
      nextText: "TAP LOG A MEAL",
    },
  ],

  // ── System-narrated guided-onboarding sequence (hub-level, forced banners) ──
  systemHubIntro: [
    {
      id: "system_awaken",
      title: "The System",
      body: "SYSTEM: Recall sequence stabilized.\n\nI am the System, the entity bound to you since the Recall. My full designation remains restricted. Demonstrate competency; access will expand.",
      placement: "center",
      requireAction: false,
      nextText: "CONTINUE",
    },
    {
      id: "system_topbar",
      title: "Your Command Screen",
      body: "SYSTEM: Command interface restored.\n\nCommand screen active. Available functions: study, training, simulation entry, ward return. The bar above monitors your Stamina and resource currencies.",
      placement: "top",
      requireAction: false,
      banner: true,
      nextText: "UNDERSTOOD",
    },
    {
      id: "system_to_university",
      title: "First Objective",
      body: "SYSTEM: Corrective training required.\n\nReport to Clinica University. The Fading Apprentice case chain is your first assigned objective. Complete it.",
      placement: "center",
      requireAction: false,
      nextText: "GO TO UNIVERSITY",
    },
  ],

  systemWardHub: [
    {
      id: "system_ward_intro",
      title: "The Ward",
      body: "SYSTEM: Ward operations interface loaded.\n\nClinical shifts are conducted here. Select a case, assess the patient, and prevent Corruption from advancing. Completed shifts yield progression data and Realm access.",
      placement: "center",
      requireAction: false,
      nextText: "GO ON",
    },
    {
      id: "system_ward_university",
      title: "Training Required",
      body: "SYSTEM: Prerequisite training incomplete.\n\nNavigate to Clinica University now. The Fading Apprentice case chain must be completed before shift access is granted.",
      placement: "center",
      requireAction: true,
      requiredActionType: "navigateToUniversity",
      banner: true,
      nextText: "ENTER THE UNIVERSITY",
    },
  ],

  systemShops: [
    {
      id: "system_shops_intro",
      title: "The Apothecary Market",
      body: "SYSTEM: Market access unlocked.\n\nCurrency expenditure options: supplies, upgrades, cosmetics. No performance shortcuts are available. Allocate resources with precision.",
      placement: "center",
      requireAction: false,
      nextText: "SHOW ME",
    },
  ],

  // ── University mini-game tutorials ──────────────────────────────────────
  // All three follow the same forced flow:
  //   1. Intro step (modal) — tap to reveal, tap again to advance.
  //   2. Target step (positioned box, requireAction + requiredTargetId):
  //      tap to reveal → tap again → box dismisses → blocking scrim appears →
  //      only the highlighted target (zIndex 9500) is tappable → tap it to advance.
  // Narrated by the System (isSystemTutorial returns true for all three).
  // No close button, no skip button, no X — tap flow only.

  cueHuntIntro: [
    {
      id: "cue_hunt_open",
      title: "Cue Hunt",
      body: "SYSTEM: Diagnostic scan initiated. Three signs of dehydration are present in this scene. Each will be highlighted in sequence. Tap exactly where indicated.",
      placement: "center",
      requireAction: false,
      nextText: "SHOW ME",
    },
    {
      id: "cue_hunt_clue1",
      title: "Clue 1 of 3: Dry Lips",
      body: "Cracked, dry lips are an early sign of fluid loss. Tap them now.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "clue_dry_lips",
      nextText: "TAP THE DRY LIPS",
    },
    {
      id: "cue_hunt_clue2",
      title: "Clue 2 of 3: Weak Posture",
      body: "Slumped, weak posture indicates fatigue and dehydration. Tap the posture zone.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "clue_weak_posture",
      nextText: "TAP THE WEAK POSTURE",
    },
    {
      id: "cue_hunt_clue3",
      title: "Clue 3 of 3: Water Flask",
      body: "Something nearby confirms she needs fluid urgently. Find it and tap it.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "clue_water_flask",
      nextText: "TAP THE WATER FLASK",
    },
  ],

  rapidTriageIntro: [
    {
      id: "triage_open",
      title: "Rapid Triage",
      body: "SYSTEM: Triage exercise loaded. Three patients require urgency classification. Only the correct option is active for each. Read the clinical signs, then act.",
      placement: "center",
      requireAction: false,
      nextText: "READY",
    },
    {
      id: "triage_card1",
      title: "Patient 1: Read Her Signs",
      body: "Dizzy but alert, able to drink. Needs attention soon; not a critical emergency. Tap Urgent.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "triage_urgent",
      nextText: "TAP URGENT",
      progressLabel: "Card 1 / 3",
    },
    {
      id: "triage_card2",
      title: "Patient 2: Read His Signs",
      body: "Confused elder. Low blood pressure. Unable to drink. These are danger signs; this patient cannot wait. Tap Emergency.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "triage_emergency",
      nextText: "TAP EMERGENCY",
      progressLabel: "Card 2 / 3",
    },
    {
      id: "triage_card3",
      title: "Patient 3: Read Her Signs",
      body: "A student with no symptoms, asking about hydration. Alert, well, no clinical urgency. Tap Routine.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "triage_routine",
      nextText: "TAP ROUTINE",
      progressLabel: "Card 3 / 3",
    },
  ],

  // P1: rapidTriageCard2 and rapidTriageCard3 were previously started mid-game
  // as separate 1-step tutorials, which caused the counter to show "1 / 1"
  // for cards 2 and 3 — inconsistent with card 1's "2 / 2" display.
  // The mid-game startTutorial() calls have been removed from rapid-triage.tsx.
  // These entries are kept in the union for backward-compat (existing saves that
  // have rapidTriageCard2/Card3 = true in storage remain valid).
  rapidTriageCard2: [
    {
      id: "triage_card2_intro",
      title: "Patient 2: Read His Signs",
      body: "Confused elder. Low blood pressure. Unable to drink. These are danger signs; this patient cannot wait. Tap Emergency.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "triage_emergency",
      nextText: "TAP EMERGENCY",
      progressLabel: "Card 2 / 3",
    },
  ],

  rapidTriageCard3: [
    {
      id: "triage_card3_intro",
      title: "Patient 3: Read Her Signs",
      body: "A student with no symptoms, asking about hydration. Alert, well, no clinical urgency. Tap Routine.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "triage_routine",
      nextText: "TAP ROUTINE",
      progressLabel: "Card 3 / 3",
    },
  ],

  stabilizeIntro: [
    {
      id: "stabilize_open",
      title: "Stabilize Stack",
      body: "SYSTEM: Stabilization protocol loaded. Three actions must be performed in the correct order. Follow the highlighted step.",
      placement: "center",
      requireAction: false,
      nextText: "UNDERSTOOD",
    },
    {
      id: "stabilize_step1",
      title: "Step 1: Check Safety",
      body: "Assess responsiveness before anything else. Tap Assess mental status.",
      placement: "bottom",
      requireAction: true,
      requiredTargetId: "action_assess_mental_status",
      nextText: "TAP ASSESS MENTAL STATUS",
    },
    {
      id: "stabilize_step2",
      title: "Step 2: Confirm Stability",
      body: "Map the patient's vital signs. Tap Check vitals.",
      placement: "bottom",
      requireAction: true,
      requiredTargetId: "action_check_vitals",
      nextText: "TAP CHECK VITALS",
    },
    {
      id: "stabilize_step3",
      title: "Step 3: Support Recovery",
      body: "With swallowing confirmed safe, begin gentle rehydration. Tap Offer oral fluids.",
      placement: "bottom",
      requireAction: true,
      requiredTargetId: "action_oral_fluids",
      nextText: "TAP OFFER ORAL FLUIDS",
    },
  ],

  mealcraftIntro: [
    {
      id: "mealcraft_open",
      title: "Mealcraft: Lotus Plate",
      body: "SYSTEM: Plate-building interface loaded. Objective: construct a balanced meal that supports stable blood sugar. Begin with a protein source.",
      placement: "center",
      requireAction: false,
      nextText: "GOT IT",
    },
    {
      id: "mealcraft_first_tap",
      title: "Add Protein First",
      body: "Tap the grilled chicken to anchor the plate.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "food_grilled_chicken",
      nextText: "TAP GRILLED CHICKEN",
    },
  ],
};
