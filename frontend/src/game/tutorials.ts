export type TutorialId =
  | "prologueBattle"
  | "firstBattle"
  | "firstKingdom"
  | "firstSummon";

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  placement: "top" | "center" | "bottom";
  requireAction: boolean;
  requiredActionType?: string;
  nextText?: string;
}

export const TUTORIAL_LABELS: Record<TutorialId, string> = {
  prologueBattle: "Your First Shift",
  firstBattle: "Battle Basics",
  firstKingdom: "Kingdom Basics",
  firstSummon: "Hero Summoning",
};

export const TUTORIALS: Record<TutorialId, TutorialStep[]> = {
  prologueBattle: [
    {
      id: "prologue_welcome",
      title: "Welcome to the Ward",
      body: "A patient needs you. Patient Stability shows how safe they are. Disease Corruption shows how far the illness has progressed. Keep Stability above 0 and bring Corruption to 0 to win.",
      placement: "center",
      requireAction: false,
      nextText: "BEGIN",
    },
    {
      id: "prologue_scout",
      title: "Step 1: Scout",
      body: "Always assess before you act. Select a hero and use a skill labeled SCOUT to reveal what's really going on with the patient.",
      placement: "top",
      requireAction: true,
      requiredActionType: "scout",
      nextText: "USE A SCOUT SKILL",
    },
    {
      id: "prologue_stabilize",
      title: "Step 2: Stabilize",
      body: "With clues revealed, protect the patient first. Use a skill labeled STABILIZE to shore up their Stability.",
      placement: "top",
      requireAction: true,
      requiredActionType: "stabilize",
      nextText: "USE A STABILIZE SKILL",
    },
    {
      id: "prologue_treat",
      title: "Step 3: Treat",
      body: "Now fight the disease directly. Use a skill labeled STRIKE to reduce Disease Corruption.",
      placement: "top",
      requireAction: true,
      requiredActionType: "strike",
      nextText: "USE A STRIKE SKILL",
    },
    {
      id: "prologue_reassess",
      title: "Step 4: Reassess",
      body: "Good nursing never stops checking in. Use a skill labeled ANALYZE (or REASSESS) to confirm the patient is responding to treatment.",
      placement: "top",
      requireAction: true,
      requiredActionType: "analyze",
      nextText: "USE AN ANALYZE SKILL",
    },
    {
      id: "prologue_done",
      title: "Scout. Stabilize. Treat. Reassess.",
      body: "This four-step rhythm is the heart of every shift you'll ever run. Keep repeating it — Scout, Stabilize, Treat, Reassess — until the patient is safe.",
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
      placement: "top",
      requireAction: true,
      requiredActionType: "scout",
      nextText: "USE A SCOUT SKILL",
    },
    {
      id: "use_stabilize",
      title: "Stabilize the Patient",
      body: "Now use a Stabilize skill. Stabilizing improves patient safety and can restore AP on future turns. Look for skills labeled STABILIZE.",
      placement: "top",
      requireAction: true,
      requiredActionType: "stabilize",
      nextText: "USE A STABILIZE SKILL",
    },
    {
      id: "use_counter",
      title: "Counter the Disease",
      body: "Use a Strike skill to directly reduce Disease Corruption. Matching the enemy's system type deals extra damage. Look for skills labeled STRIKE.",
      placement: "top",
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
      placement: "top",
      requireAction: true,
      requiredActionType: "summon",
      nextText: "TAP SUMMON",
    },
  ],
};
