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
      title: "Welcome to the Ward",
      body: "A patient needs you. Patient Stability shows how safe they are. Disease Corruption shows how far the illness has progressed. Keep Stability above 0 and bring Corruption to 0 to win. I'll walk you through every step.",
      placement: "center",
      requireAction: false,
      nextText: "BEGIN",
    },
    {
      id: "prologue_cue",
      title: "First: A Clinical Cue",
      body: "A Clinical Cue appears above. Read the question, weigh the options, tap the answer you believe is correct. A right answer powers up your stabilizing actions this turn. A short explanation will appear after you answer. It won't block the shift.",
      placement: "top",
      requireAction: true,
      requiredActionType: "cue",
      nextText: "ANSWER CORRECTLY",
    },
    {
      id: "prologue_skills",
      title: "Reading Your Skills",
      body: "Each hero carries clinical skills. Tap a skill to use it. Long-press any skill or item to read the reasoning behind it. Long-pressing never costs a turn.",
      placement: "center",
      requireAction: false,
      nextText: "GOT IT",
    },
    {
      id: "prologue_scout",
      title: "Step 1: Scout",
      body: "Always assess before you act. Novice Guardian is ready — tap LANTERN OF CLUES to reveal what's really going on with the patient.",
      placement: "center",
      requireAction: true,
      requiredSkillId: "lantern_of_clues",
      nextText: "TAP LANTERN OF CLUES",
    },
    {
      id: "prologue_stabilize",
      title: "Step 2: Stabilize",
      body: "With clues revealed, protect the patient first. Village Caretaker is now ready — tap GUARDIAN'S TOUCH to shore up Stability and start treating.",
      placement: "center",
      requireAction: true,
      requiredSkillId: "guardians_touch",
      nextText: "TAP GUARDIAN'S TOUCH",
    },
    {
      id: "prologue_endturn",
      title: "End the Turn",
      body: "Both healers have acted this turn. Tap END TURN to give your team fresh time to continue the care chain.",
      placement: "center",
      requireAction: true,
      requiredActionType: "endTurn",
      nextText: "TAP END TURN",
    },
    {
      id: "prologue_counter",
      title: "Step 3: Counter",
      body: "Now strike the disease directly. Novice Guardian is ready again — tap BREATH OF DAWN to drive down Disease Corruption.",
      placement: "center",
      requireAction: true,
      requiredSkillId: "breath_of_dawn",
      nextText: "TAP BREATH OF DAWN",
    },
    {
      id: "prologue_reassess",
      title: "Step 4: Reassess",
      body: "Good nursing never stops checking in. Village Caretaker is ready — tap REASSESS to confirm the patient is responding. This completes the care chain and finishes the shift.",
      placement: "center",
      requireAction: true,
      requiredSkillId: "reassess",
      nextText: "TAP REASSESS",
    },
    {
      id: "prologue_done",
      title: "Scout. Stabilize. Counter. Reassess.",
      body: "A complete care chain. This four-step rhythm is the heart of every shift. Scout. Stabilize. Counter. Reassess. The patient is safe.",
      placement: "center",
      requireAction: false,
      nextText: "FINISH THE SHIFT",
    },
  ],

  firstBattle: [
    {
      id: "first_battle_brief",
      title: "Remember the Chain",
      body: "Scout first — reveal what the patient truly needs. Then Stabilize to buy time. Then Strike to drive back the illness. That sequence is your clinical chain. This patient is in a bad way. Do what you can. I won't guide your hand from here.",
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
      body: "Tap the SINGLE RECRUITMENT button below to call a new hero to your team. Duplicate heroes refund Shards. Add new heroes to your active team before the next battle.",
      placement: "bottom",
      requireAction: true,
      requiredActionType: "summon",
      nextText: "TAP SINGLE RECRUITMENT",
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
      title: "The System Awakens",
      body: "…So. You've returned. I am the System — the presence bound to you since the Recall. My true form is still shadow to you; prove yourself, and I will come into focus. For now, let me show you your Ward.",
      placement: "center",
      requireAction: false,
      nextText: "WHO ARE YOU?",
    },
    {
      id: "system_topbar",
      title: "Your Vitals",
      body: "Up here I track everything that matters: your Shift Stamina — the energy each Ward Shift costs — and your currencies. Stamina recovers over time. Watch this bar; it is your lifeline.",
      placement: "top",
      requireAction: false,
      banner: true,
      nextText: "UNDERSTOOD",
    },
    {
      id: "system_to_ward",
      title: "To the Ward",
      body: "A patient is waiting. Open the Ward and begin your first Shift — I will be watching. Everything else — the Realm, the University, the Market — opens to you as you grow stronger.",
      placement: "center",
      requireAction: false,
      nextText: "ENTER THE WARD",
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
      body: "The University awaits. Your first lessons reward your first heroes — and sharpen the reasoning you will need for harder cases ahead.",
      placement: "center",
      requireAction: false,
      banner: true,
      nextText: "I WILL STUDY",
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
      body: "Before you treat, learn to see. Tap the dry lips.",
      placement: "center",
      requireAction: false,
      nextText: "UNDERSTOOD",
    },
    {
      id: "cue_hunt_first_tap",
      title: "Tap it now.",
      body: "The dry lips. Find it in the scene.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "clue_dry_lips",
      nextText: "TAP THE DRY LIPS",
    },
  ],

  rapidTriageIntro: [
    {
      id: "triage_open",
      title: "Decide Fast",
      body: "Now decide how quickly this patient needs help. Speed and accuracy both matter here.",
      placement: "center",
      requireAction: false,
      nextText: "READY",
    },
    {
      id: "triage_first_card",
      title: "Sort the Patient",
      body: "Tap the right category for this patient.",
      placement: "top",
      requireAction: true,
      requiredTargetId: "triage_urgent",
      nextText: "TAP URGENT",
    },
  ],

  stabilizeIntro: [
    {
      id: "stabilize_open",
      title: "The System",
      body: "Act in order. First, check how unstable the patient is.",
      placement: "center",
      requireAction: false,
      nextText: "UNDERSTOOD",
    },
    {
      id: "stabilize_first_action",
      title: "Tap it now.",
      body: "Check her mental state. Scroll down to find Assess Mental Status in the action tiles.",
      placement: "bottom",
      requireAction: true,
      requiredTargetId: "action_assess_mental_status",
      nextText: "TAP ASSESS MENTAL STATUS",
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
