export type Aptitude = 'guardian' | 'sage' | 'warden' | 'weaver';

export type ElementSystem =
  | 'Air' | 'River' | 'Fire' | 'Energy' | 'Storm'
  | 'Mind' | 'Filter' | 'Forge' | 'Protection' | 'Growth';

export type HeroRole = 'Assessor' | 'Stabilizer' | 'Analyst' | 'Coordinator' | 'Educator' | 'Specialist';

export type ActionType = 'scout' | 'strike' | 'stabilize' | 'shield' | 'cleanse' | 'command' | 'analyze' | 'support';

export interface HeroSkill {
  id: string;
  name: string;
  type: ActionType;
  cost: number;
  description: string;
  // Effects
  reveal?: number; // hidden clues revealed
  stabilize?: number; // restore stability %
  strike?: number; // reduce enemy corruption
  cleanse?: boolean;
  shield?: number; // dmg reduction on next enemy turn
  // Risks (clinical reasoning)
  risk?: {
    ifSystem?: ElementSystem;
    penalty?: number; // stability damage
    description: string;
  };
}

export interface Hero {
  id: string;
  name: string;
  title: string;
  rarity: 3 | 4 | 5 | 6 | 7;
  role: HeroRole;
  element: ElementSystem;
  description: string;
  skills: HeroSkill[];
}

export interface ClueCard {
  id: string;
  label: string;
  detail: string;
  hidden: boolean;
}

export interface Enemy {
  id: string;
  name: string;
  realWorld: string;
  primarySystem: ElementSystem;
  secondarySystem?: ElementSystem;
  difficulty: 1 | 2 | 3 | 4 | 5;
  visibleClues: ClueCard[];
  hiddenClues: ClueCard[];
  dangerTrigger: string;
  bestCounters: ActionType[];
  weakSystem?: ElementSystem; // taking action in this system deals extra
  instability: number; // stability decay per enemy turn
  startingStability: number; // patient starting stability %
  corruption: number; // enemy HP equivalent
  teaches: string[]; // codex ids unlocked on victory
}

export interface CodexEntry {
  id: string;
  title: string;
  system: ElementSystem;
  level: 1 | 2 | 3 | 4;
  body: string;
}

export interface Building {
  id: string;
  name: string;
  description: string;
  unlocks: string;
  maxLevel: number;
}

export type Rank = {
  name: string;
  xpRequired: number;
};

export interface PlayerState {
  id: string;
  name: string;
  aptitude: Aptitude;
  rank: string;
  rank_index: number;
  xp: number;
  mastery: {
    assessment: number;
    stabilization: number;
    pharmacology: number;
    judgment: number;
    command: number;
    systems: number;
  };
  codex_unlocked: string[];
  heroes_owned: string[];
  kingdom_levels: Record<string, number>;
  runs_completed: number;
  bosses_defeated: string[];
}
