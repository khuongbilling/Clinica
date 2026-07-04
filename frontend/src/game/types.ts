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
  systemType?: string; // 'Universal', 'Air', 'River', etc.
  cost: number;
  description: string;
  shortEffect?: string; // brief mechanical summary for button
  rpgDescription?: string; // fantasy flavor
  beginnerExplanation?: string; // plain language
  nclexExplanation?: string; // clinical NCLEX-style
  // Effects
  reveal?: number;
  stabilize?: number;
  strike?: number;
  cleanse?: boolean;
  shield?: number;
  blockSpread?: boolean; // stops the next enemy 'spread' attack once (e.g. Isolation Seal)
  risk?: {
    ifSystem?: ElementSystem;
    penalty?: number;
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
  // Hero identity (Phase 2)
  faction?: string;
  quote?: string;
  backstory?: string;
  bestAgainst?: string;
  medicalFocus?: string;
  bondLevel?: number;
  bondExp?: number;
  // Evolution overlay — set when a hero is materialized with its owner's star progression.
  star?: number;
}

export interface ClueCard {
  id: string;
  label: string;
  detail: string;
  hidden: boolean;
}

export type EnemyBehaviorTag = 'hypoxia' | 'mucus' | 'panic' | 'wheeze' | 'shock';

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
  corruption: number; // enemy HP equivalent (no upper limit — bosses can exceed 100)
  stabilityResistance?: number; // hidden 0..0.8: bosses/elites shrug off stabilization, so the patient recovers LESS than a skill's listed number (0 = normal enemy)
  teaches: string[]; // codex ids unlocked on victory
  // Multi-enemy wave pressure archetype (affliction adds that ride alongside a primary enemy)
  behaviorTag?: EnemyBehaviorTag;
  isAffliction?: boolean; // small companion enemy, not a standalone encounter
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
  recommended_aptitude?: Aptitude | null;
  learning_goal?: string | null;
  learning_profile?: string | null;
  difficulty?: string | null;
  player_class?: string | null;
  system_affinity?: string | null;
  explanation_style?: string | null;
  codex_depth: string;
  onboarding_complete: boolean;
  rank: string;
  rank_index: number;
  xp: number;
  // Player Level — account-wide progression, independent of per-hero Level.
  // Derived from `xp` via progression.ts but persisted for fast reads and
  // to detect level-ups (stamina cap, feature unlocks, Player Class tiers).
  player_level?: number;
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
  hero_progression?: Record<string, { star: number; copies: number; level?: number; xp?: number; locked?: boolean; favorite?: boolean }>;
  active_team: string[];
  kingdom_levels: Record<string, number>;
  runs_completed: number;
  bosses_defeated: string[];
  failure_counts: Record<string, number>;
  inventory: Record<string, number>;
  codex_shards: number;
  crowns: number;
  owned_skins?: string[];
  equipped_skin?: string;
  owned_upgrades?: string[];
  owned_units?: Record<string, number>;
  unit_shards?: Record<string, number>;
  ward_loadout?: string[];
  summon_history: { hero: string; rarity: number; duplicate: boolean; date: string }[];
  enemy_mastery?: Record<string, number>;
  chapter_progress?: number;
  // Clinica University — shared trainee materials keyed by trainee id (see university.ts)
  class_trainees?: Record<string, number>;
  // Clinica University — global progression currency
  university_credits?: number;
  // Clinica University — Lessons & Simulations MVP
  lessons_completed?: string[];
  simulations_completed?: string[];
  badge_progress?: Record<string, number>;
  region_progress?: Record<string, number>;
  stamina?: number;
  stamina_updated_at?: string;
  wellness?: import('./wellness').WellnessState;
  // Clinical Cue — lightweight per-topic progress counter (Codex/University hook).
  // Additive only; never blocks battle flow.
  cue_topic_progress?: Record<string, number>;
}
