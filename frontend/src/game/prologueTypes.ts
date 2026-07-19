/**
 * Prologue State Framework — Push 1
 *
 * Defines the 11-phase new cinematic prologue, temporary hero/enemy IDs used
 * only during the sequence, and permanent post-rebirth identifiers granted once
 * the sequence completes.  Nothing here modifies the permanent player roster —
 * all PROLOGUE_TEMP_IDS must be kept out of heroes_owned / hero_progression.
 */

// ---------------------------------------------------------------------------
// Phase order
// ---------------------------------------------------------------------------

export const PROLOGUE_PHASES = [
  'opening_memory_cinematic',
  'former_self_battlefield_cutscene',
  'silent_infarction_initial_reveal',
  'former_self_support_loadout',
  'opening_battle_tutorial',
  'scripted_defeat',
  'lotus_recall_cinematic',
  'identity_reconstruction_character_creation',
  'post_rebirth_awakening',
  'memory_echo_award_scene',
  'clinica_university_introduction',
] as const;

export type ProloguePhase = typeof PROLOGUE_PHASES[number];

export const PROLOGUE_PHASE_LABELS: Record<ProloguePhase, string> = {
  opening_memory_cinematic:                    'Awakening',
  former_self_battlefield_cutscene:            'The Battlefield',
  silent_infarction_initial_reveal:            'The Silent Infarction',
  former_self_support_loadout:                 'Prepare for Battle',
  opening_battle_tutorial:                     'First Contact',
  scripted_defeat:                             'The Fall',
  lotus_recall_cinematic:                      'Lotus Recall',
  identity_reconstruction_character_creation:  'Who Were You?',
  post_rebirth_awakening:                      'Rebirth',
  memory_echo_award_scene:                     'Memory Echoes',
  clinica_university_introduction:             'Enter the Kingdom',
};

export const PROLOGUE_PHASE_DESCRIPTIONS: Record<ProloguePhase, string> = {
  opening_memory_cinematic:
    'Fragments of a life before. Warmth fading. A voice calling you back.',
  former_self_battlefield_cutscene:
    'The ward floor — your former domain. Florence and Fleming stand beside you.',
  silent_infarction_initial_reveal:
    'Something is wrong. The silence has a shape, and it is spreading.',
  former_self_support_loadout:
    'Choose your tools. The legendary healers offer their support.',
  opening_battle_tutorial:
    'Engage the Silent Infarction. Learn the rhythms of the ward.',
  scripted_defeat:
    'The corruption is too great. Even legends fall before it.',
  lotus_recall_cinematic:
    'A lotus blooms in the dark. The kingdom pulls you through.',
  identity_reconstruction_character_creation:
    'You remember who you were. Now decide who you will become.',
  post_rebirth_awakening:
    'The ward materialises around you. You are new — and needed.',
  memory_echo_award_scene:
    'The echoes of Florence and Fleming remain. Their light is yours to carry.',
  clinica_university_introduction:
    'Master Bai opens the doors of Clinica University.',
};

// ---------------------------------------------------------------------------
// Temporary prologue IDs (never persisted in the player roster)
// ---------------------------------------------------------------------------

export const PROLOGUE_TEMP_IDS = {
  FORMER_SELF:       'prologue_former_self',
  NIGHTINGALE_TEMP:  'prologue_nightingale_legendary',
  FLEMING_TEMP:      'prologue_fleming_legendary',
  MASTER_BAI:        'prologue_master_bai',
  SILENT_INFARCTION: 'prologue_silent_infarction',
} as const;

export type PrologueTempId = typeof PROLOGUE_TEMP_IDS[keyof typeof PROLOGUE_TEMP_IDS];

/** Returns true if the given id is a temporary prologue-only identifier. */
export function isPrologueTempId(id: string): boolean {
  return (Object.values(PROLOGUE_TEMP_IDS) as string[]).includes(id);
}

// ---------------------------------------------------------------------------
// Permanent post-rebirth identifiers granted after the prologue
// ---------------------------------------------------------------------------

export const MEMORY_ECHO_IDS = {
  NIGHTINGALE_ECHO:   'nightingale_memory_echo',
  FLEMING_ECHO:       'fleming_memory_echo',
  NIGHTINGALE_LOCKED: 'nightingale_legendary_locked',
  FLEMING_LOCKED:     'fleming_legendary_locked',
} as const;

/**
 * Inventory item IDs granted in the memory_echo_award_scene phase.
 * These are non-hero collectibles (codex entries / lore echoes), not roster
 * slots, so they live in inventory rather than heroes_owned.
 */
export const PROLOGUE_AWARD_ITEMS: readonly string[] = [
  MEMORY_ECHO_IDS.NIGHTINGALE_ECHO,
  MEMORY_ECHO_IDS.FLEMING_ECHO,
];

// ---------------------------------------------------------------------------
// Phase navigation helpers
// ---------------------------------------------------------------------------

export function prologuePhaseIndex(phase: ProloguePhase): number {
  return PROLOGUE_PHASES.indexOf(phase);
}

export function nextProloguePhase(phase: ProloguePhase): ProloguePhase | null {
  const idx = prologuePhaseIndex(phase);
  if (idx < 0 || idx >= PROLOGUE_PHASES.length - 1) return null;
  return PROLOGUE_PHASES[idx + 1];
}

export function isValidProloguePhase(phase: unknown): phase is ProloguePhase {
  return typeof phase === 'string' && (PROLOGUE_PHASES as readonly string[]).includes(phase);
}

export const PROLOGUE_FIRST_PHASE: ProloguePhase = PROLOGUE_PHASES[0];
export const PROLOGUE_LAST_PHASE:  ProloguePhase = PROLOGUE_PHASES[PROLOGUE_PHASES.length - 1];
