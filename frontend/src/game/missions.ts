import type { ActionType } from "./types";

export interface MissionMeta {
  missionTitle: string;
  story: string;
  recommendedRoles: string[];
  winCondition: string;
  starGoals: [string, string, string];
  victoryTitle: string;
  clinicalSummary: string;
  kingdomRegion: string;
  kingdomMax: number;
  guidedFeedback: Partial<Record<ActionType | string, string>>;
}

const DEFAULT_GUIDED_FEEDBACK: Partial<Record<string, string>> = {
  scout:    "You gathered information. Clues help you avoid guessing.",
  stabilize:"Stability improved. A stable patient gives the team more time.",
  strike:   "Disease Corruption dropped. The disease process is being controlled.",
  analyze:  "Reassessment confirms whether the action worked.",
  support:  "Your team provided support. Good coordination helps the patient.",
  shield:   "You protected the patient from worsening.",
  cleanse:  "You cleared a harmful process from the patient.",
  command:  "You coordinated the team's response effectively.",
};

export const MISSIONS: Record<string, MissionMeta> = {
  air_sprite: {
    missionTitle:    "Restore the Air Temple",
    story:           "The Air Temple is collapsing. A patient is breathing fast, sitting upright, and losing oxygen glow.",
    recommendedRoles:["Scout", "Air support", "Stabilizer"],
    winCondition:    "Keep Stability above 0 and reduce Corruption to 0",
    starGoals: [
      "Win the battle",
      "Complete the care chain",
      "Win within 4 turns with no unsafe actions and no more than 2 Care Attempts",
    ],
    victoryTitle:    "Air Temple Restored",
    clinicalSummary: "A patient with asthma was breathing fast and losing oxygen. Your team assessed the situation, kept them stable, and controlled the attack.",
    kingdomRegion:   "Air Region",
    kingdomMax:      5,
    guidedFeedback: {
      scout:    "You found a hidden clue. Clues help you avoid guessing.",
      stabilize:"Stability improved. A stable patient gives the team more time.",
      strike:   "Disease Corruption dropped. This means the disease process is being controlled.",
      analyze:  "Reassessment confirms whether the action worked.",
    },
  },

  water_sprite: {
    missionTitle:    "Restore the River Temple",
    story:           "The River Temple is running dry. A patient has poor circulation and falling blood pressure.",
    recommendedRoles:["Stabilizer", "River support", "Scout"],
    winCondition:    "Keep Stability above 0 and reduce Corruption to 0",
    starGoals: [
      "Win the battle",
      "Complete the care chain",
      "Win efficiently with no unsafe actions",
    ],
    victoryTitle:    "River Temple Restored",
    clinicalSummary: "A patient with low blood volume was losing circulation. Your team stabilized them and restored flow through the River system.",
    kingdomRegion:   "River Region",
    kingdomMax:      5,
    guidedFeedback:  DEFAULT_GUIDED_FEEDBACK,
  },

  energy_sprite: {
    missionTitle:    "Restore the Energy Temple",
    story:           "The Energy Temple flickers. A patient has dangerously low blood sugar and is confused.",
    recommendedRoles:["Stabilizer", "Scout", "Specialist"],
    winCondition:    "Keep Stability above 0 and reduce Corruption to 0",
    starGoals: [
      "Win the battle",
      "Complete the care chain",
      "Win with no unsafe actions",
    ],
    victoryTitle:    "Energy Temple Restored",
    clinicalSummary: "A patient with low blood sugar was becoming confused and weak. Your team identified the cause and restored their energy.",
    kingdomRegion:   "Energy Region",
    kingdomMax:      5,
    guidedFeedback:  DEFAULT_GUIDED_FEEDBACK,
  },

  fire_sprite: {
    missionTitle:    "Contain the Fire Corruption",
    story:           "A Fire corruption spreads through the wound. A patient has a localized infection that threatens to spread.",
    recommendedRoles:["Scout", "Strike", "Shield"],
    winCondition:    "Keep Stability above 0 and reduce Corruption to 0",
    starGoals: [
      "Win the battle",
      "Complete the care chain",
      "Win with no unsafe actions",
    ],
    victoryTitle:    "Fire Corruption Contained",
    clinicalSummary: "A patient had a localized infection. Your team identified the source, isolated the spread, and cleared the infection.",
    kingdomRegion:   "Fire Region",
    kingdomMax:      5,
    guidedFeedback:  DEFAULT_GUIDED_FEEDBACK,
  },

  storm_sprite: {
    missionTitle:    "Calm the Storm Corruption",
    story:           "The Storm Temple roars. A patient has early sepsis — the infection is entering the bloodstream.",
    recommendedRoles:["Scout", "Strike", "Stabilizer"],
    winCondition:    "Keep Stability above 0 and reduce Corruption to 0",
    starGoals: [
      "Win the battle",
      "Complete the care chain",
      "Win within 5 turns with no unsafe actions",
    ],
    victoryTitle:    "Storm Corruption Calmed",
    clinicalSummary: "A patient showed early signs of sepsis. Your team identified the infection quickly and stabilized them before it could worsen.",
    kingdomRegion:   "Storm Region",
    kingdomMax:      5,
    guidedFeedback:  DEFAULT_GUIDED_FEEDBACK,
  },

  lord_imbalance: {
    missionTitle:    "Face the Fading Core",
    story:           "The Core of Clinica is failing. Multiple systems are collapsing at once — Air, River, and Mind all faltering.",
    recommendedRoles:["All roles", "Prioritize the worst system first"],
    winCondition:    "Keep Stability above 0 through all stages and reduce Corruption to 0",
    starGoals: [
      "Win the battle",
      "Complete the care chain",
      "Win with no unsafe actions and no emergency calls",
    ],
    victoryTitle:    "The Core Restored",
    clinicalSummary: "A critically ill patient with multi-system failure. Your team triaged, prioritized, and systematically addressed each failing system.",
    kingdomRegion:   "Core",
    kingdomMax:      1,
    guidedFeedback:  DEFAULT_GUIDED_FEEDBACK,
  },
};

export function getMission(enemyId: string): MissionMeta | null {
  return MISSIONS[enemyId] ?? null;
}

export function getGuidedFeedback(enemyId: string, actionType: string): string | null {
  const mission = MISSIONS[enemyId];
  const feedback = mission?.guidedFeedback?.[actionType] ?? DEFAULT_GUIDED_FEEDBACK[actionType];
  return feedback ?? null;
}
