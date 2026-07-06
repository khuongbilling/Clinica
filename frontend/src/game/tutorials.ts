export type TutorialId =
  | "prologueBattle"
  | "firstBattle"
  | "firstKingdom"
  | "firstSummon"
  | "systemHubIntro"
  | "systemWardHub"
  | "systemShops";

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
  firstKingdom: "Kingdom Basics",
  firstSummon: "Hero Summoning",
  systemHubIntro: "The System Awakens",
  systemWardHub: "The Ward",
  systemShops: "The Apothecary Market",
};

// Tutorials narrated by "the System" — the overlay renders its donghua portrait
// (a dark silhouette until Player Level 10, then colored by aptitude) and its
// name in place of the generic GUIDE badge, and treats them as forced (no skip).
export const SYSTEM_TUTORIAL_IDS: TutorialId[] = ["systemHubIntro", "systemWardHub", "systemShops"];

export function isSystemTutorial(id: TutorialId | null | undefined): boolean {
  return !!id && SYSTEM_TUTORIAL_IDS.includes(id);
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
      body: "A Clinical Cue is a quick judgement check drawn from the patient in front of you. Read the question, weigh the options, and tap the answer you believe is CORRECT. A right answer earns a bonus that strengthens every stabilizing action this turn. After you answer, a short explanation slides in — you can keep playing while you read it, it won't block the shift.",
      placement: "top",
      requireAction: true,
      requiredActionType: "cue",
      nextText: "ANSWER CORRECTLY",
    },
    {
      id: "prologue_skills",
      title: "Reading Your Skills",
      body: "Each hero carries clinical skills. Tap a skill to use it. Long-press any skill, item, or call to open its full detail — the real nursing and NCLEX reasoning behind it. Long-pressing never costs a turn, so explore whenever you're curious.",
      placement: "center",
      requireAction: false,
      nextText: "GOT IT",
    },
    {
      id: "prologue_scout",
      title: "Step 1: Scout",
      body: "Always assess before you act. Novice Guardian is ready — tap LANTERN OF CLUES to reveal what's really going on with the patient.",
      placement: "bottom",
      requireAction: true,
      requiredSkillId: "lantern_of_clues",
      nextText: "TAP LANTERN OF CLUES",
    },
    {
      id: "prologue_stabilize",
      title: "Step 2: Stabilize",
      body: "With clues revealed, protect the patient first. Village Caretaker is now ready — tap GUARDIAN'S TOUCH to shore up Stability and start treating.",
      placement: "bottom",
      requireAction: true,
      requiredSkillId: "guardians_touch",
      nextText: "TAP GUARDIAN'S TOUCH",
    },
    {
      id: "prologue_endturn",
      title: "End the Turn",
      body: "Both healers have acted this turn. Tap END TURN to give your team fresh time to continue the care chain.",
      placement: "bottom",
      requireAction: true,
      requiredActionType: "endTurn",
      nextText: "TAP END TURN",
    },
    {
      id: "prologue_counter",
      title: "Step 3: Counter",
      body: "Now strike the disease directly. Novice Guardian is ready again — tap BREATH OF DAWN to drive down Disease Corruption.",
      placement: "bottom",
      requireAction: true,
      requiredSkillId: "breath_of_dawn",
      nextText: "TAP BREATH OF DAWN",
    },
    {
      id: "prologue_reassess",
      title: "Step 4: Reassess",
      body: "Good nursing never stops checking in. Village Caretaker is ready — tap REASSESS to confirm the patient is responding. This completes the care chain and finishes the shift.",
      placement: "bottom",
      requireAction: true,
      requiredSkillId: "reassess",
      nextText: "TAP REASSESS",
    },
    {
      id: "prologue_done",
      title: "Scout. Stabilize. Counter. Reassess.",
      body: "Perfect — a complete care chain! This four-step rhythm is the heart of every shift you'll ever run. Follow it and you'll earn top marks. The patient is safe.",
      placement: "center",
      requireAction: false,
      nextText: "FINISH THE SHIFT",
    },
  ],

  firstBattle: [
    {
      id: "battle_goal",
      title: "Battle Goal",
      body: "Patient Stability shows how safe the patient is. Disease Corruption shows how much the illness has taken hold. Keep Stability above 0 and reduce Corruption to win.",
      placement: "center",
      requireAction: false,
      nextText: "GOT IT",
    },
    {
      id: "action_points",
      title: "Clinical Time",
      body: "Action Points (AP) are your team's time this turn. Skills cost AP. Press END TURN when you're done. If Stability drops too low, your team gets fewer AP.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "hero_select",
      title: "Choose a Hero",
      body: "Each hero acts once per turn. Tap a hero name above to select them, then choose their action in the panel below. Heroes have different skills and system affinities.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "use_scout",
      title: "Scout First",
      body: "Select a hero and use a Scout skill in the ACTIONS tab. Scouts reveal hidden clues — clues show you what the patient really needs. Look for skills labeled SCOUT.",
      placement: "bottom",
      requireAction: true,
      requiredActionType: "scout",
      nextText: "USE A SCOUT SKILL",
    },
    {
      id: "use_stabilize",
      title: "Stabilize the Patient",
      body: "Now use a Stabilize skill. Stabilizing improves patient safety and can restore AP on future turns. Look for skills labeled STABILIZE.",
      placement: "bottom",
      requireAction: true,
      requiredActionType: "stabilize",
      nextText: "USE A STABILIZE SKILL",
    },
    {
      id: "use_counter",
      title: "Counter the Disease",
      body: "Use a Strike skill to directly reduce Disease Corruption. Matching the enemy's system type deals extra damage. Look for skills labeled STRIKE.",
      placement: "bottom",
      requireAction: true,
      requiredActionType: "strike",
      nextText: "USE A STRIKE SKILL",
    },
    {
      id: "care_chain_done",
      title: "Care Chain Complete",
      body: "Scout → Stabilize → Counter. This is the care chain. Following it earns better rewards and wins battles faster. End your turn and keep fighting!",
      placement: "center",
      requireAction: false,
      nextText: "FINISH TUTORIAL",
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
      body: "The grid starts mostly empty — open Sanctuary Inventory to place buildings you've unlocked onto compatible plots, then move or store them anytime. The Research Library holds your Codex entries. The Training Hall manages your team. The Apothecary stocks your items. Roads connect everything automatically.",
      placement: "center",
      requireAction: false,
      nextText: "NEXT",
    },
    {
      id: "kingdom_done",
      title: "Enter the Core",
      body: "Head to the home screen to start a clinical encounter. Each battle teaches a real nursing concept. The Codex tab holds deeper explanations after you win.",
      placement: "center",
      requireAction: false,
      nextText: "LET'S GO",
    },
  ],

  firstSummon: [
    {
      id: "summon_intro",
      title: "Summon Hall",
      body: "Codex Shards are earned from battles. Spend them here to summon new healers. Each hero has unique clinical skills tied to a body system.",
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
      body: "Tap the Summon button below to call a new hero to your team. Duplicate heroes refund Shards. Add new heroes to your active team before the next battle.",
      placement: "bottom",
      requireAction: true,
      requiredActionType: "summon",
      nextText: "TAP SUMMON",
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
      body: "This banner leads to Clinica University. Your first lessons there teach the reasoning behind every treatment — and reward you with your first heroes. Learning is not optional here. It is power.",
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
};
