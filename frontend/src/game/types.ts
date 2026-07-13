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
  // 1–8: simulation-era enemies (Ch.1–8); 9–10: real-world ward encounters (Ch.9+)
  difficulty: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
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
  // Prologue "Silent Infarct" style story bosses: this fight is narratively
  // scripted to end in defeat (hidden pathology, resisted treatment) — no
  // normal Game Over/rewards flow, see battle.tsx + lotus-recall.tsx.
  scriptedLoss?: boolean;
  // World Event boss (e.g. Verdantha): lives in ENEMIES so battle/result can
  // resolve it, but must be excluded from the normal Ward Shift encounter pool
  // and only reachable through its gated World Boss entry point.
  worldBoss?: boolean;
  // C6: Chapter 9 real-world counterparts. simulationCounterpart links this
  // enemy back to its simulation-era precursor. chapterGate means this enemy
  // should only appear in encounters gated to this chapter or higher.
  simulationCounterpart?: string; // id of the simulation-era enemy this is derived from
  chapterGate?: number;           // minimum chapter to encounter in ward shifts
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
  // Push 1 prologue: false for brand-new players until they finish the
  // tutorial win -> scripted boss loss -> Lotus Recall sequence. Defaults
  // true for pre-existing players so they never re-enter the prologue flow.
  prologue_complete?: boolean;
  // Push 2 post-recall onboarding: two resumable sub-steps that run right
  // after Lotus Recall, before the player reaches the normal hub. Both
  // default true for pre-existing players so they are never re-entered.
  identity_restored?: boolean;
  diagnostic_intro_seen?: boolean;
  // Chosen hand-drawn portrait avatar id (see game/avatars.ts). Empty string
  // falls back to the aptitude Ionicon in the header/profile.
  avatar_id?: string;
  rank: string;
  rank_index: number;
  xp: number;
  // Player Level — account-wide progression, independent of per-hero Level.
  // Derived from `xp` via progression.ts but persisted for fast reads and
  // to detect level-ups (stamina cap, feature unlocks, Player Class tiers).
  player_level?: number;
  // Class Tree (Push 6) — account-level class identity, additive to the
  // legacy `player_class` onboarding flavor field above. See
  // src/game/classTree.ts for the full class/ability/materials model.
  class_tree_id?: string | null;
  class_progress?: Record<string, number[]>;
  // Push 6 — snapshot of the class-diagnostic quiz result at the moment the
  // player's class was last confirmed. Purely descriptive (never re-derives
  // gameplay); lets the read-only "Review Class Result" screen show the same
  // resonance/second-fit context the player saw during onboarding without
  // having to re-run or re-store the full quiz answers. Backfilled for
  // legacy players in normalizeProgression so it is never left undefined.
  class_diagnostic_resonance?: string | null;
  class_diagnostic_secondary?: string | null;
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
  // Ward Defense: Code Rush waves cleared/survived across all runs. Distinct from
  // runs_completed (whole battles); powers the honest "Perimeter Held" milestone.
  ward_defense_waves: number;
  bosses_defeated: string[];
  failure_counts: Record<string, number>;
  inventory: Record<string, number>;
  codex_shards: number;
  crowns: number;
  // Economy Foundation (Push 2) — earned effort-premium currency, converted at the
  // Sanctuary Bank into Refined Lotus Gems. See src/game/economy.ts for full docs.
  insight_crystals?: number;
  // Earned premium-equivalent currency (weaker purchasing power than Lotus Gems).
  refined_lotus_gems?: number;
  // Paid premium currency placeholder — no real payment system wired up yet.
  lotus_gems_paid?: number;
  // Ward Defense unit recruitment/progression currency, separate from Codex Shards.
  ward_sigils?: number;
  // Miasma Bloom world event — Epidemic Tokens earned by completing Ward Shift
  // runs against the outbreak. Track real player contribution to the event.
  epidemic_tokens?: number;
  owned_skins?: string[];
  // Hero-aura cosmetic slot (Verdant/Ember/Tidal/Royal auras).
  equipped_skin?: string;
  // Independent ward-arena backdrop cosmetic slot (skins with a wardBackdrop,
  // e.g. Bloom Ward). Kept separate from equipped_skin so a player can wear a
  // hero aura AND a ward backdrop at the same time.
  equipped_ward_skin?: string;
  owned_upgrades?: string[];
  owned_units?: Record<string, number>;
  unit_shards?: Record<string, number>;
  ward_loadout?: string[];
  summon_history: { hero: string; rarity: number; duplicate: boolean; date: string }[];
  enemy_mastery?: Record<string, number>;
  // C3 — best star rating achieved per enemy (keyed by enemy.id).
  // Drives replay badges, auto-sweep unlock (2★+), and sweep reward tiers.
  // Backfilled as {} for existing players in normalizeProgression.
  battle_stars?: Record<string, number>;
  // C4 — one-time claim tracking for the 3 milestone reward categories.
  // Backfilled as [] for existing players in normalizeProgression.
  claimed_level_rewards?: string[];    // ids from LEVEL_MILESTONES (e.g. "lvl_2")
  claimed_chapter_chests?: string[];  // ids from CHAPTER_CHESTS  (e.g. "chest_ch1")
  claimed_chapter_3star?: string[];   // ids from CHAPTER_3STAR_REWARDS ("3star_ch1")
  chapter_progress?: number;
  // Clinica University — shared trainee materials keyed by trainee id (see university.ts)
  class_trainees?: Record<string, number>;
  // Clinica University — global progression currency
  university_credits?: number;
  // C5 — Level 2 unlock celebration modal. True once the player has seen the
  // "Apprentice Path Opened" moment (Summoning Hall + Daily/Weekly Rounds unlock).
  // Backfilled as true for existing players who are already Level 2+.
  seen_lv2_unlock?: boolean;
  // Push 5 — Memory Reminiscence: has the player seen the post-recall
  // reminiscence story scene (modern-world origin -> Silent Infarct -> Lotus
  // Recall)? Gates the one-time redirect from post-recall into /reminiscence.
  seen_reminiscence?: boolean;
  // Manhwa story layer — ids of story scenes (see storyScenes.ts) the player
  // has watched. Drives one-time auto-triggers at chapter milestones and the
  // "NEW" badges in the Profile Story Gallery.
  story_scenes_seen?: string[];
  // Clinica University — Lessons & Simulations MVP
  lessons_completed?: string[];
  simulations_completed?: string[];
  badge_progress?: Record<string, number>;
  // World Event — Miasma Bloom milestone rewards the player has claimed.
  claimed_milestones?: string[];
  // Cosmetic profile Titles the player has earned (see EVENT_TITLES). Purely
  // decorative — no stat effect. `active_title` is the one shown under the name.
  owned_titles?: string[];
  active_title?: string;
  region_progress?: Record<string, number>;
  stamina?: number;
  stamina_updated_at?: string;
  wellness?: import('./wellness').WellnessState;
  // Daily Ward Rounds — login streak, 3 rotating daily objectives, and a weekly
  // goal. Free-to-earn engagement loop; see src/game/dailyRounds.ts.
  daily_rounds?: import('./dailyRounds').DailyRoundsState;
  // Clinical Cue — lightweight per-topic progress counter (Codex/University hook).
  // Additive only; never blocks battle flow.
  cue_topic_progress?: Record<string, number>;
  // Push 3.6 — Realm plot system. buildingId -> plotId, and plotId -> decorationId.
  // Both are cosmetic/layout-only; they never gate gameplay.
  realm_layout?: Record<string, string>;
  realm_decor?: Record<string, string>;
  // Realm hero assignment — buildingId -> per-slot hero ids ("" = empty slot).
  // Assigned heroes boost a producer building's point rate; heroes are never
  // locked out of battles or teams by being assigned here.
  realm_assignments?: Record<string, string[]>;
  // Realm point production — buildingId -> { points, updatedAt } accrual
  // snapshot. Points accrue over real time and are collected into a wallet
  // currency (see realm.ts RealmProduction / computeAccruedPoints).
  realm_production?: Record<string, { points: number; updatedAt: string }>;
  // Push 5.6 — per-player random terrain seed. Assigned once at player
  // creation; drives a deterministic, unique terrain-texture distribution
  // for this player's Realm (see generatePlayerTerrain). Purely cosmetic —
  // never changes what/where a building can be placed.
  realm_seed?: number;
}
