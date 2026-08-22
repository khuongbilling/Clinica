export type Aptitude = 'guardian' | 'sage' | 'warden' | 'weaver';

export type ElementSystem =
  | 'Air' | 'River' | 'Fire' | 'Energy' | 'Storm'
  | 'Mind' | 'Filter' | 'Forge' | 'Protection' | 'Growth';

export type HeroRole = 'Assessor' | 'Stabilizer' | 'Analyst' | 'Coordinator' | 'Educator' | 'Specialist'
  | 'Scout' | 'Striker' | 'Restorer' | 'Preventer' | 'SystemsLeader';

export type ClassFamily =
  | 'Wardborn' | 'Lifebreath' | 'Truthseer'
  | 'Remedybound' | 'Restorebound' | 'Realmbound';

export type LaunchRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export type ActionType = 'scout' | 'strike' | 'stabilize' | 'shield' | 'command' | 'analyze' | 'support' | 'counter';

// ─────────────────────────────────────────────────────────────────────────────
// Affinity families (Combat Scaling Push 5 — data layer only).
// 11 clinical domains that heroes excel/struggle in and enemies belong to.
// No multipliers are activated by these fields yet; they exist purely as
// data so future pushes can build matching bonuses on top of them.
// ─────────────────────────────────────────────────────────────────────────────
export type AffinityFamily =
  | 'Fluid / Hydration'
  | 'Airway / Respiratory'
  | 'Fire / Inflammation'
  | 'Protection / Immune'
  | 'Energy / Metabolic'
  | 'Storm / Cardiac'
  | 'Mind / Neuro-Psych'
  | 'Growth / Endocrine'
  | 'Filter / Renal'
  | 'Wound / Tissue'
  | 'Community / Public Health';

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
  // Effects (fixed values — used when range fields absent)
  reveal?: number;
  stabilize?: number;
  strike?: number;
  cleanse?: boolean;
  shield?: number;
  blockSpread?: boolean; // stops the next enemy 'spread' attack once (e.g. Isolation Seal)
  // Base ranges (Combat Scaling Push 1) — engine rolls within [min, max] each use
  strikeRange?: [number, number];
  stabilizeRange?: [number, number];
  shieldRange?: [number, number];
  risk?: {
    ifSystem?: AffinityFamily;
    penalty?: number;
    description: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero combat stats (Combat Scaling Push 3 — data layer only).
// These five stats gate future per-skill multipliers in skillCalc.ts.
// All modifiers default to ×1.00 until Push 4 activates them.
// ─────────────────────────────────────────────────────────────────────────────
export interface HeroCombatStats {
  /** Improves Scout, cue reveal, weakness/resistance discovery. */
  insight: number;
  /** Improves Stability restoration and recovery. */
  carePower: number;
  /** Improves Corruption reduction from Treat/Counter skills. */
  intervention: number;
  /** Improves Stability loss prevention and Instability reduction. */
  guard: number;
  /** Improves AP efficiency, leader effects, cards, items, Call for Help, and team synergy. */
  coordination: number;
}

export interface Hero {
  id: string;
  gender?: 'female' | 'male' | 'nonbinary';
  name: string;
  title: string;
  rarity: 3 | 4 | 5 | 6 | 7;
  role: HeroRole;
  element: ElementSystem;
  description: string;
  /** Combat stat profile — all five values required. */
  stats: HeroCombatStats;
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
  // Locked legendary heroes: not grantable, not in gacha pool — teaser/preview only.
  locked?: boolean;
  // Star lore: five short biography chapters revealed as the hero is promoted.
  // ★1 is always visible; ★2-★5 unlock when prog.star >= entry.star.
  // Optional — heroes without this field show no star lore section.
  starLore?: { star: 1 | 2 | 3 | 4 | 5; title: string; text: string }[];
  // Affinity data (Push 5 — data layer, no battle multipliers yet).
  strongAffinities?: AffinityFamily[]; // clinical domains this hero excels in
  weakAffinities?: AffinityFamily[];   // clinical domains this hero struggles with
  roleTags?: string[];                 // functional descriptors for filtering/UI (e.g. 'healer', 'scout')
  // Image generation prompt describing the hero's appearance, gender, and visual style.
  artPrompt?: string;
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
  // 1–8: simulation-era enemies (Ch.1–8); 9–10: real-world ward encounters (Ch.9+)
  difficulty: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  visibleClues: ClueCard[];
  hiddenClues: ClueCard[];
  dangerTrigger: string;
  bestCounters: ActionType[];
  // weakSystem was removed in Push 1 of the Elemental Counter Overhaul.
  // Use weakElement: ElementSystem | null instead.
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
  // True for enemies that genuinely fly/float (wisps, spirits, specters, shades,
  // fire imps, etc.). Drives the vertical bob idle animation in BattlefieldScene —
  // grounded enemies skip the float and only breathe-scale.
  floats?: boolean;
  // Affinity data (Push 5 — data layer, no battle multipliers yet).
  primaryAffinity?: AffinityFamily;   // main clinical domain (derived from primarySystem)
  /** @deprecated Use secondaryAffinities (array) instead. */
  secondaryAffinity?: AffinityFamily; // secondary domain if enemy spans two systems
  resistanceTags?: string[];          // treatment approaches that are less effective
  weaknessTags?: string[];            // treatment approaches that work best
  // Elemental Counter Overhaul (Push 1 — data & calculation).
  /** Narrative label for the enemy's corruption pathology (e.g. 'Depletion', 'Inferno'). Required. */
  corruptionAspect: string;
  /** Hero element that deals ×1.30 strike damage. Replaces weakSystem. null = no elemental counter. Required. */
  weakElement: ElementSystem | null;
  /** Element that is resistant / deals reduced damage to this enemy. */
  resistantElement?: ElementSystem | null;
  /** All affinity families this enemy belongs to (array form of secondaryAffinity). Required. */
  secondaryAffinities: AffinityFamily[];
  /** Visual flavour tags for UI (e.g. 'fungal', 'cardiac', 'airborne'). */
  visualTags?: string[];
  /** Per-phase weakness overrides for boss enemies (e.g. Verdantha). Push 3 activates runtime resolution. */
  phases?: Array<{ phaseId: string; weakElementOverride: ElementSystem | null }>;
  // Enemy defense profile (Push 7 — data + active).
  /** Display level; equals difficulty. Handy for future scaling UI. */
  enemyLevel?: number;
  /**
   * 0.0–0.35: fraction by which corruption-lowering effects (strike) are reduced.
   * Chapter 1 enemies: 0.00–0.04. Bosses: 0.25–0.35.
   */
  corruptionResistance?: number;
  /**
   * 0.0–0.25: amplifies enemy instability damage each enemy turn
   * (applied as a multiplier on baseDmg in endPlayerTurn).
   */
  stabilityPressure?: number;
  /**
   * 0.0–0.45: fraction by which ALL skill effects are reduced when hidden clues
   * remain unrevealed. Scales down progressively as Scout / Reassess reveals clues.
   * 0 for enemies with no hidden clues.
   */
  hiddenDefense?: number;
  /**
   * 0.0–0.20: dampens the affinity-family strong-match bonus.
   * Reduces ×1.15 advantage by this fraction (e.g. 0.1 → ×1.135 effective).
   * Does not affect weak-match penalty.
   */
  affinityResistance?: number;
  /**
   * true: caps single-hit corruption reduction at 40% of current corruption,
   * preventing one-turn burst deletion of bosses.
   */
  bossGuard?: boolean;
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
  /** Opaque per-player credential, returned only at account creation. */
  economy_token?: string;
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
  // Push 8 — Lotus Recall character-creation choices (set once during
  // identity_reconstruction_character_creation prologue phase). All optional
  // so pre-existing players are never disrupted by a missing field.
  pronouns?: string | null;
  char_skin_tone?: number | null;   // index 0-5 into SKIN_TONES palette
  char_hair_style?: number | null;  // index 0-4 into HAIR_STYLES list
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
  /** First Night Market ticket permanently unlocks future-market access. */
  night_market_unlocked?: boolean;
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
  // P16: ISO datetime of last free daily recruitment (undefined = never used; cooldown 24 h).
  last_free_summon_at?: string;
  // Push 5 — Tutorial Recruitment Ceremony. Two guaranteed-hero summons given
  // before the first Ward Shift so the player enters with a real party.
  // Backfilled true for returning players who already own the relevant heroes.
  tutorial_summon_1_done?: boolean;
  tutorial_summon_2_done?: boolean;
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
  // Tutorial battle — one-time "Florence Nightingale lends her light" cameo
  // shown at the start of the prologue tutorial battle. Backfilled as true for
  // existing players (already past the tutorial); false for brand-new players.
  seen_florence_cameo?: boolean;
  // Prologue boss battle — one-time Master Bai warning narration shown after
  // the objective modal is dismissed on the scripted-loss Silent Infarct boss.
  // Backfilled as true for existing players; false for brand-new players.
  seen_boss_narrator?: boolean;
  // New cinematic prologue framework (Push 1 v2). Backfilled true for existing
  // players so they are never re-routed into the new prologue. New players start
  // at the first phase and advance through all 11 before reaching the hub.
  opening_prologue_complete?: boolean;
  // Current phase within the new cinematic prologue. null when not yet started.
  // Persisted on each advance so the app can resume after a crash or close.
  opening_prologue_phase?: string | null;
  // Set true once memory_echo_award_scene items have been granted, preventing
  // duplicate rewards if the player exits and re-enters that phase.
  prologue_rewards_claimed?: boolean;
  // Push 5 — Memory Reminiscence: has the player seen the post-recall
  // reminiscence story scene (modern-world origin -> Silent Infarct -> Lotus
  // Recall)? Gates the one-time redirect from post-recall into /reminiscence.
  seen_reminiscence?: boolean;
  seen_university_intro?: boolean;
  // Manhwa story layer — ids of story scenes (see storyScenes.ts) the player
  // has watched. Drives one-time auto-triggers at chapter milestones and the
  // "NEW" badges in the Profile Story Gallery.
  story_scenes_seen?: string[];
  // J2 — one-time claim tracking for Journey Map node first-clear rewards.
  // Keyed by ChapterPart.id (e.g. "c1n1"). Backfilled as [] for existing players.
  claimed_journey_nodes?: string[];
  // J3 — University practice activity completion counters.
  // Incremented by completeUniPractice; drives milestone unlock checks.
  uni_cue_lab_count?: number;
  uni_triage_count?: number;
  uni_stack_count?: number;
  // J3 — once-only University practice milestone claims (ids from UNI_PRACTICE_MILESTONES).
  // Also covers Lotus Lesson count milestones. Backfilled as [] for existing players.
  uni_practice_milestones_claimed?: string[];
  // Clinica University — Lessons & Simulations MVP
  lessons_completed?: string[];
  simulations_completed?: string[];
  badge_progress?: Record<string, number>;
  // World Event — Miasma Bloom milestone rewards the player has claimed.
  claimed_milestones?: string[];
  claimed_daily_milestones?: string[];
  // Cosmetic profile Titles the player has earned (see EVENT_TITLES). Purely
  // decorative — no stat effect. `active_title` is the one shown under the name.
  owned_titles?: string[];
  active_title?: string;
  region_progress?: Record<string, number>;
  stamina?: number;
  stamina_updated_at?: string;
  // Age 1 economy bookkeeping is intentionally hidden from the HUD.
  age1_reward_day?: string;
  age1_reward_units?: number;
  age1_stamina_bonus_day?: string;
  age1_stamina_bonus_sources?: string[];
  age1_stamina_bonus_week?: string;
  age1_refill_day?: string;
  age1_refill_amount?: number;
  wellness?: import('./wellness').WellnessState;
  // Daily Ward Rounds — login streak, 3 rotating daily objectives, and a weekly
  // goal. Free-to-earn engagement loop; see src/game/dailyRounds.ts.
  daily_rounds?: import('./dailyRounds').DailyRoundsState;
  // Clinical Cue — lightweight per-topic progress counter (Codex/University hook).
  // Additive only; never blocks battle flow.
  cue_topic_progress?: Record<string, number>;
  // J4 — Hero Skill Academy upgrade ranks. Keyed by upgradeId (see heroSkillAcademy.ts).
  // Value = current rank (0 = not purchased; 1 = Rank I active; 2 = Rank II active).
  // Backfilled as {} for existing players in normalizeProgression.
  hero_skill_upgrades?: Record<string, number>;
  // Push 4 — University Practice Curriculum. Tracks which structured curriculum
  // modules the player has claimed rewards for (ids from practiceCurriculum.ts).
  // Backfilled as [] for existing players in normalizeProgression.
  practice_modules_completed?: string[];
  // Push 4 — one-time "seen" flag for the Practice Curriculum guided intro.
  // Set true once the player dismisses the intro narrator card on first visit.
  seen_practice_curriculum?: boolean;
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
  // P8 — Battle Card Deck: up to 3 card IDs loaded before each battle via the
  // loadout screen. Limited-use (each card can only be played once per battle).
  // Empty array or undefined → battle uses legacy random-draw pool.
  equipped_cards?: string[];
  // One-time "what are cards?" tutorial shown the first time the Cards tab is
  // opened in battle. Undefined/false means not yet seen.
  seen_card_tutorial?: boolean;
  // P9 — one-time "how does Call for Help work?" tutorial shown the first
  // time the Call tab is opened in battle. Undefined/false = not yet seen.
  seen_call_tutorial?: boolean;
  // Push 3 — one-time Elemental Counter tutorial shown at the start of the
  // Fluid Phantom encounter (Chapter 1 trial boss). Undefined/false = not yet seen.
  seen_fluid_phantom_counter_tutorial?: boolean;
  // Push 3 — one-time Clinical Expertise tutorial shown at the start of the
  // Lord Imbalance encounter (Chapter 1 story boss). Undefined/false = not yet seen.
  seen_lord_imbalance_expertise_tutorial?: boolean;
  // Push 10 — hero equipment loadouts. heroId → slotId → itemId.
  // Only items with status: "active" in equipment.ts take effect in battle.
  // Backfilled as {} for existing players in normalizeProgression.
  hero_equipment?: Record<string, Record<string, string>>;
  // Push 10 (Task 270) — owned equipment items (by item id from equipment.ts).
  // Earned through Ward Shift clears, University milestones, boss defeats, and
  // Daily Rounds milestones. Backfilled as [] for existing players.
  owned_equipment?: string[];
  // Task 513 — Specialization branches (Lv40+). Maps classId → chosen
  // specialization id (e.g. 'triage_commander'). Permanently locked once set
  // per class. Backfilled as {} for existing players in normalizeProgression.
  class_specialization?: Record<string, string>;
  // Task 570 — Chapter-level Area Boss key progression.
  // Maps str(chapter_id) → { keys_collected: number; claimed_tile_ids: string[] }.
  // Chapter-scoped — keys carry across Rechallenge Map (new runs for same chapter).
  // Keys reset only when the Chapter Boss is defeated (permanent chapter completion).
  // Backfilled as {} for existing players in normalizeProgression.
  chapter_boss_keys?: Record<string, { keys_collected: number; claimed_tile_ids: string[] }>;
  /**
   * Canonical shift per choice chapter (Book I: Ch4/7/9/10) — the TimeOfDay
   * of the player's FIRST CLEAR of that chapter.  Written once at first clear
   * and never mutated by UI tab switching; inherit chapters (Ch5-6, Ch8) read
   * it via chapterShiftRules.  Keys are chapter numbers as strings.
   */
  canonical_shifts?: Record<string, 'day' | 'evening' | 'night'>;
}
