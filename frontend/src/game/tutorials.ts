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
      body: "I won't sugarcoat it — this patient needs real help. Two numbers tell you how they're doing: Stability is how safe they are, Corruption is how far the disease has taken hold. Keep Stability from hitting zero and bring Corruption to zero. I'll walk you through each step.",
      placement: "center",
      requireAction: false,
      nextText: "I'M READY",
    },
    {
      id: "prologue_cue",
      title: "Read the Signs First",
      body: "Before you act, a clinical question will appear. Take a moment — there's always a reason one answer is better than the others. A correct answer strengthens your actions this turn. An explanation follows either way. It won't delay you.",
      placement: "top",
      requireAction: true,
      requiredActionType: "cue",
      nextText: "ANSWER THE QUESTION",
    },
    {
      id: "prologue_skills",
      title: "Your Team's Skills",
      body: "Each healer brings clinical skills to the shift. Tap a skill to use it. Long-press any skill or item if you want to read the reasoning behind it first. Reading costs you nothing — use it whenever you're unsure.",
      placement: "center",
      requireAction: false,
      nextText: "UNDERSTOOD",
    },
    {
      id: "prologue_scout",
      title: "Step 1: Scout",
      body: "Don't rush to treat what you haven't assessed. Novice Guardian has Lantern of Clues ready — use it to surface what this patient actually needs before you do anything else.",
      placement: "center",
      requireAction: true,
      requiredSkillId: "lantern_of_clues",
      nextText: "USE LANTERN OF CLUES",
    },
    {
      id: "prologue_stabilize",
      title: "Step 2: Stabilize",
      body: "Good. Now you know the picture. Village Caretaker's Guardian's Touch will shore up Stability — buy the patient some time. Stability before everything else.",
      placement: "center",
      requireAction: true,
      requiredSkillId: "guardians_touch",
      nextText: "USE GUARDIAN'S TOUCH",
    },
    {
      id: "prologue_endturn",
      title: "Pass the Time",
      body: "Both healers have done what they can this turn. End the turn and let the team reset. Disease doesn't wait — neither should you.",
      placement: "center",
      requireAction: true,
      requiredActionType: "endTurn",
      nextText: "END THE TURN",
    },
    {
      id: "prologue_counter",
      title: "Step 3: Counter",
      body: "The patient is steadier. Now push the disease back. Novice Guardian's Breath of Dawn reduces Corruption directly — this is where you go on the offensive.",
      placement: "center",
      requireAction: true,
      requiredSkillId: "breath_of_dawn",
      nextText: "USE BREATH OF DAWN",
    },
    {
      id: "prologue_reassess",
      title: "Step 4: Reassess",
      body: "Never assume improvement — confirm it. Village Caretaker's Reassess will check on the patient and close the care chain. This completes the shift.",
      placement: "center",
      requireAction: true,
      requiredSkillId: "reassess",
      nextText: "USE REASSESS",
    },
    {
      id: "prologue_done",
      title: "Scout. Stabilize. Counter. Reassess.",
      body: "That's the care chain. Four steps, in that order, every shift. It's not complicated — it's just good clinical practice. The patient is safe. You did well.",
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
      body: "Welcome to the Grand Ward Sanctuary. This is your realm to build, heal, and grow — not to attack or defend against anyone. Each battle you win earns Codex Shards you can spend on new buildings and upgrades here.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "kingdom_buildings",
      title: "Sanctuary Inventory",
      body: "The grid starts mostly empty — open Sanctuary Inventory to place buildings you've unlocked onto compatible plots, then move or store them anytime. The Research Library holds your Codex entries. The Training Hall manages your team. The Apothecary stocks your items.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "kingdom_place",
      title: "Place a Building",
      body: "Open the Sanctuary Inventory (bottom-left button) and place any building onto an empty plot. Tap the green tile to confirm. Roads connect everything automatically.",
      placement: "bottom",
      requireAction: true,
      requiredActionType: "placeBuilding",
      nextText: "OPEN INVENTORY & PLACE",
    },
    {
      id: "kingdom_done",
      title: "Your Sanctuary is Growing",
      body: "Head to the home screen to start a clinical encounter. Each battle teaches a real nursing concept. The Codex tab holds deeper explanations after you win.",
      placement: "center",
      requireAction: false,
      nextText: "LET'S GO",
    },
  ],

  firstSummon: [
    {
      id: "summon_intro",
      title: "Recruitment Hall",
      body: "Codex Shards are earned from battles and lessons. Spend them here to summon new healers. Each hero has unique clinical skills tied to a body system.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "summon_roles",
      title: "Hero Roles",
      body: "Scouts reveal clues. Stabilizers protect the patient. Strikers counter disease. Coordinators support the team. Build a balanced team for hard battles.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "summon_action",
      title: "Call a Healer",
      body: "Tap FREE DAILY RECRUITMENT (no shards needed!) or SINGLE RECRUITMENT below to enroll a new healer. Duplicates convert to Hero Shards. Add your heroes to the active team before the next battle.",
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
      title: "Ward Defense: Airway Code Rush",
      body: "Disease spirits advance along the road toward the Vital Lantern — your patient's lifeline. Deploy healer units on tiles to intercept and defeat them before they reach it.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "wd_ap",
      title: "Action Points & Deployment",
      body: "Each healer unit costs Action Points (AP) to deploy. AP regenerates slowly over time and spikes when you answer a Clinical Question correctly before a wave. Choose your units wisely.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "wd_deploy",
      title: "Deploy a Healer",
      body: "Select a unit from the dock at the bottom, then tap an empty tile on the board to deploy it. Ward Scout is affordable — try deploying one now.",
      placement: "bottom",
      requireAction: true,
      requiredActionType: "deploy",
      nextText: "DEPLOY A UNIT",
    },
    {
      id: "wd_merge",
      title: "Care Synthesis — Merge & Upgrade",
      body: "Deploy two identical same-level units and tap SYNTHESIZE to merge them into a stronger one. Stronger units deal more damage and have greater range. Try it whenever the button appears.",
      placement: "bottom",
      requireAction: true,
      requiredActionType: "merge",
      nextText: "SYNTHESIZE TWO UNITS",
    },
    {
      id: "wd_done",
      title: "Protect the Vital Lantern",
      body: "Matched units deal bonus damage — Assess units reveal weaknesses first, then Treat units hit hard. Watch the Corruption and Stability bars above. Good luck!",
      placement: "center",
      requireAction: false,
      nextText: "BEGIN THE DEFENSE",
    },
  ],

  // ── Hall of Heroes first-entry tutorial ──
  firstHeroTeam: [
    {
      id: "heroes_intro",
      title: "Your Healer Roster",
      body: "This is the Hall of Heroes — every healer you've recruited lives here. You can bring up to 3 into your active team for clinical shifts.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "heroes_set",
      title: "Set Your Active Team",
      body: "Tap the + button on any owned hero card to add them to your active team. Tap again to remove. Changes save instantly — build your best lineup now.",
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
      title: "The Lotus Plate Journal",
      body: "This is your off-shift wellness space. Log meals, hydration, and habits to grow your Nutrition Garden and earn Nourishment Petals. No stamina cost — ever.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "lotus_garden",
      title: "Nutrition Garden",
      body: "The four garden meters — Hydration, Fiber, Protein, and Heart — grow as you log entries. Keep them healthy and the garden flourishes. Purely for your well-being, never for combat power.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "lotus_log",
      title: "Log Your First Entry",
      body: "Tap LOG A MEAL OR CHECK-IN to build your first plate or log a habit check-in. Every entry earns Nourishment Petals for cosmetic rewards.",
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
      body: "SYSTEM: Recall sequence stabilized.\n\nI am the System — the presence bound to you since the Recall. My true form is still shadow to you; prove yourself, and I will come into focus.",
      placement: "center",
      requireAction: false,
      nextText: "CONTINUE",
    },
    {
      id: "system_topbar",
      title: "Your Command Screen",
      body: "SYSTEM: Main ward interface restored.\n\nThis is your command screen. From here you will study, train, enter simulations, and return to the ward when ready. The bar above tracks your Stamina and currencies.",
      placement: "top",
      requireAction: false,
      banner: true,
      nextText: "UNDERSTOOD",
    },
    {
      id: "system_to_university",
      title: "First Objective",
      body: "First objective: begin corrective training at Clinica University. The Fading Apprentice case chain awaits — learn to see before you heal.",
      placement: "center",
      requireAction: false,
      nextText: "GO TO UNIVERSITY",
    },
  ],

  systemWardHub: [
    {
      id: "system_ward_intro",
      title: "The Ward",
      body: "This is the Ward — where you take clinical shifts against the corruption. Choose a case, read the patient, and hold the line. Each shift you complete makes you stronger and reveals more of the Realm.",
      placement: "center",
      requireAction: false,
      nextText: "GO ON",
    },
    {
      id: "system_ward_university",
      title: "Answer the Call to Learn",
      body: "The University awaits. Go there now — your first case chain, The Fading Apprentice, will sharpen the reasoning you need for every shift ahead.",
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
      body: "You've grown enough to trade. The Market spends your hard-earned currency on supplies, upgrades, and cosmetics — never on shortcuts to victory. Spend wisely; a healer's resources are precious.",
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
      title: "The System",
      body: "Before you treat, learn to see. Three signs of dehydration are hidden in this scene. I will guide you to each one — tap exactly where I point.",
      placement: "center",
      requireAction: false,
      nextText: "SHOW ME",
    },
    {
      id: "cue_hunt_clue1",
      title: "Clue 1 of 3 — Dry Lips",
      body: "Cracked, dry lips are an early sign of fluid loss. Tap them now.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "clue_dry_lips",
      nextText: "TAP THE DRY LIPS",
    },
    {
      id: "cue_hunt_clue2",
      title: "Clue 2 of 3 — Weak Posture",
      body: "A slumped, weak posture signals fatigue and dehydration. Tap the posture zone.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "clue_weak_posture",
      nextText: "TAP THE WEAK POSTURE",
    },
    {
      id: "cue_hunt_clue3",
      title: "Clue 3 of 3 — Water Flask",
      body: "Something nearby tells you she desperately needs water. Find it and tap it.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "clue_water_flask",
      nextText: "TAP THE WATER FLASK",
    },
  ],

  rapidTriageIntro: [
    {
      id: "triage_open",
      title: "Decide Fast",
      body: "Triage sorts patients by urgency. Three patients need you. I'll guide each one — only the correct answer is available. Pay attention to the signs, then act.",
      placement: "center",
      requireAction: false,
      nextText: "READY",
    },
    {
      id: "triage_card1",
      title: "Patient 1 — Read Her Signs",
      body: "Dizzy but alert, able to drink. Needs attention soon — not a crisis, not something to ignore. Tap Urgent.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "triage_urgent",
      nextText: "TAP URGENT",
      progressLabel: "Card 1 / 3",
    },
    {
      id: "triage_card2",
      title: "Patient 2 — Read His Signs",
      body: "Confused elder. Low blood pressure. Unable to drink. These are danger signs — this patient cannot wait. Tap Emergency.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "triage_emergency",
      nextText: "TAP EMERGENCY",
      progressLabel: "Card 2 / 3",
    },
    {
      id: "triage_card3",
      title: "Patient 3 — Read Her Signs",
      body: "A student with no symptoms, asking about hydration. Alert, well, no urgency whatsoever. Tap Routine.",
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
      title: "Patient 2 — Read His Signs",
      body: "Confused elder. Low blood pressure. Unable to drink. These are danger signs — this patient cannot wait. Tap Emergency.",
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
      title: "Patient 3 — Read Her Signs",
      body: "A student with no symptoms, asking about hydration. Alert, well, no urgency whatsoever. Tap Routine.",
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
      title: "The System",
      body: "Three actions in the correct order will stabilize this patient. I will guide each step — follow the glow.",
      placement: "center",
      requireAction: false,
      nextText: "UNDERSTOOD",
    },
    {
      id: "stabilize_step1",
      title: "Step 1 — Check Safety",
      body: "Always assess responsiveness first — before anything else. Tap Assess mental status.",
      placement: "bottom",
      requireAction: true,
      requiredTargetId: "action_assess_mental_status",
      nextText: "TAP ASSESS MENTAL STATUS",
    },
    {
      id: "stabilize_step2",
      title: "Step 2 — Confirm Stability",
      body: "Now map the patient's vital signs. Tap Check vitals.",
      placement: "bottom",
      requireAction: true,
      requiredTargetId: "action_check_vitals",
      nextText: "TAP CHECK VITALS",
    },
    {
      id: "stabilize_step3",
      title: "Step 3 — Support Recovery",
      body: "Once swallowing is confirmed safe, begin gentle rehydration. Tap Offer oral fluids.",
      placement: "bottom",
      requireAction: true,
      requiredTargetId: "action_oral_fluids",
      nextText: "TAP OFFER ORAL FLUIDS",
    },
  ],

  mealcraftIntro: [
    {
      id: "mealcraft_open",
      title: "The System",
      body: "Build a plate that keeps blood sugar steady. Start with a protein.",
      placement: "center",
      requireAction: false,
      nextText: "GOT IT",
    },
    {
      id: "mealcraft_first_tap",
      title: "Add protein first.",
      body: "Tap the grilled chicken to anchor the plate.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "food_grilled_chicken",
      nextText: "TAP GRILLED CHICKEN",
    },
  ],
};
