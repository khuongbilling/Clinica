/**
 * Prologue State Framework — Push 1 v3
 *
 * 9-phase cinematic prologue for brand-new players.
 * After the final phase (lotus_recall_cinematic) the prologue is marked
 * complete and the player is routed to /post-recall for name + class
 * diagnostic, then /reminiscence, then the hub.
 *
 *   1. opening_memory_cinematic           — fragments of a former life
 *   2. former_self_battlefield_cutscene   — Former Self intro at high power on the ward battlefield
 *   3. opening_battle_tutorial            — guided tutorial battle vs Dehydration Wisp
 *   4. former_self_victory_boast          — post-battle overconfidence beat
 *   5. warning_dialogue_scene             — Master Bai + Nightingale + Fleming warn the Former Self
 *   6. silent_infarction_initial_reveal   — Silent Infarction trap reveals itself
 *   7. former_self_support_loadout        — temporary prologue loadout (NF auto-added)
 *   8. scripted_defeat                    — real battle vs Silent Infarct (scripted loss)
 *   9. lotus_recall_cinematic             — Lotus Recall defeat cinematic → /post-recall
 */

// ---------------------------------------------------------------------------
// Phase order
// ---------------------------------------------------------------------------

export const PROLOGUE_PHASES = [
  'opening_memory_cinematic',
  'former_self_battlefield_cutscene',
  'opening_battle_tutorial',
  'former_self_victory_boast',
  'warning_dialogue_scene',
  'silent_infarction_initial_reveal',
  'former_self_support_loadout',
  'scripted_defeat',
  'lotus_recall_cinematic',
] as const;

export type ProloguePhase = typeof PROLOGUE_PHASES[number];

export const PROLOGUE_PHASE_LABELS: Record<ProloguePhase, string> = {
  opening_memory_cinematic:                    'Awakening',
  former_self_battlefield_cutscene:            'The Battlefield',
  opening_battle_tutorial:                     'First Response',
  former_self_victory_boast:                   'The Overconfidence',
  warning_dialogue_scene:                      'The Warning',
  silent_infarction_initial_reveal:            'The Silent Infarction',
  former_self_support_loadout:                 'Prepare for Battle',
  scripted_defeat:                             'The Fall',
  lotus_recall_cinematic:                      'Lotus Recall',
};

export const PROLOGUE_PHASE_DESCRIPTIONS: Record<ProloguePhase, string> = {
  opening_memory_cinematic:
    'Fragments of a life before. Warmth fading. A voice calling you back.',
  former_self_battlefield_cutscene:
    'The ward floor — your former domain. Florence and Fleming stand beside you.',
  opening_battle_tutorial:
    'A Dehydration Wisp — small, containable. The kind of enemy that used to be training.',
  former_self_victory_boast:
    'The shift ends too easily. The Former Self does not notice the warning signs.',
  warning_dialogue_scene:
    'Master Bai urges caution. The Former Self does not listen.',
  silent_infarction_initial_reveal:
    'Something is wrong. The silence has a shape, and it is spreading.',
  former_self_support_loadout:
    'Choose your tools. The legendary healers offer their support.',
  scripted_defeat:
    'The corruption is too great. Even legends fall before it.',
  lotus_recall_cinematic:
    'A lotus blooms in the dark. The kingdom pulls you through.',
};

// ---------------------------------------------------------------------------
// Temporary prologue IDs (never persisted in the player roster)
// ---------------------------------------------------------------------------

export const PROLOGUE_TEMP_IDS = {
  THE_PRODIGY:       'prologue_the_prodigy',
  FORMER_SELF:       'prologue_former_self',   // alias kept for any legacy references
  NIGHTINGALE_TEMP:  'prologue_nightingale',
  FLEMING_TEMP:      'prologue_fleming',
  MASTER_BAI:        'prologue_master_bai',
  SILENT_INFARCTION: 'prologue_silent_infarction',
} as const;

export type PrologueTempId = typeof PROLOGUE_TEMP_IDS[keyof typeof PROLOGUE_TEMP_IDS];

/** Returns true if the given id is a temporary prologue-only identifier. */
export function isPrologueTempId(id: string): boolean {
  return (Object.values(PROLOGUE_TEMP_IDS) as string[]).includes(id);
}

// ---------------------------------------------------------------------------
// Prologue AP tuning — PRE-RECALL POWER FANTASY ONLY
// DO NOT copy these values to post-recall initBattle options.
// High AP represents The Prodigy at peak legendary power, not normal play.
// ---------------------------------------------------------------------------

/** @prologue-pre-recall-only */
export const PROLOGUE_AP_CONFIG = {
  startingAP:  9,   // 8–10 range; feel powerful from the first turn
  apPerTurn:   7,   // 6–8 range; legendary healers never run dry
} as const;

// ---------------------------------------------------------------------------
// Legendary prologue skill definitions (Clinica language)
// Used in PrologueBattleTutorial and PrologueScriptedBattle.
// These are display + narrative data; effect fields are not wired to
// the main battle engine (prologue components are self-contained).
// ---------------------------------------------------------------------------

export interface PrologueSkill {
  id:          string;
  name:        string;
  apCost:      number;
  description: string;
  shortEffect: string;
  battleLog:   string;
  chainRole:   'Scout' | 'Stabilize' | 'Counter' | 'Reassess';
  /** Warning logged instead of normal battle log when used out of optimal order */
  warningLog?: string;
}

/** The Prodigy — peak-power legendary clinician (Former Self) */
export const PRODIGY_SKILLS: readonly PrologueSkill[] = [
  {
    id:          'brilliant_intervention',
    name:        'Brilliant Intervention',
    apCost:      3,
    description: 'Lower Corruption by 12. If used before Scout, hidden Corruption Spread increases by 2.',
    shortEffect: '-12 Corruption',
    battleLog:   'Brilliant Intervention lowered Corruption by 12.',
    warningLog:  'The intervention was powerful, but something hidden continued to spread.',
    chainRole:   'Counter',
  },
  {
    id:          'radiant_stabilization',
    name:        'Radiant Stabilization',
    apCost:      2,
    description: 'Restore 8 Stability.',
    shortEffect: '+8 Stability',
    battleLog:   'Radiant Stabilization restored 8 Stability.',
    chainRole:   'Stabilize',
  },
  {
    id:          'overconfident_advance',
    name:        'Overconfident Advance',
    apCost:      1,
    description: 'Lower visible Corruption by 5. Increases hidden risk if hidden cues remain unrevealed.',
    shortEffect: '-5 Corruption (visible only)',
    battleLog:   'Overconfident Advance reduced visible Corruption by 5.',
    warningLog:  'Overconfident Advance pushed back the surface — but the hidden cues remain.',
    chainRole:   'Counter',
  },
];

/** Florence Nightingale — legendary support (prologue version) */
export const NIGHTINGALE_PROLOGUE_SKILLS: readonly PrologueSkill[] = [
  {
    id:          'lamp_of_observation',
    name:        'Lamp of Observation',
    apCost:      2,
    description: 'Reveal hidden Clinical Cues. Reduce incoming Instability by 3 this turn.',
    shortEffect: 'Reveal Cues  ·  -3 Instability',
    battleLog:   'Nightingale\'s Lamp illuminates hidden Clinical Cues. The picture becomes clearer.',
    chainRole:   'Scout',
  },
  {
    id:          'ward_vigil',
    name:        'Ward Vigil',
    apCost:      3,
    description: 'Prevent the next Stability loss event and restore 5 Stability.',
    shortEffect: 'Block next Stability loss  ·  +5 Stability',
    battleLog:   'Ward Vigil holds. Nightingale shields the patient from the next blow.',
    chainRole:   'Stabilize',
  },
  {
    id:          'pattern_of_care',
    name:        'Pattern of Care',
    apCost:      2,
    description: 'After Reassess this turn, restore 3 additional Stability if a correct cue was found.',
    shortEffect: '+3 Stability (after correct Reassess)',
    battleLog:   'Pattern of Care: a correct cue was confirmed. Additional Stability restored.',
    chainRole:   'Reassess',
  },
];

/** Sir Alexander Fleming — legendary assessment (prologue version) */
export const FLEMING_PROLOGUE_SKILLS: readonly PrologueSkill[] = [
  {
    id:          'culture_and_sensitivity',
    name:        'Culture and Sensitivity',
    apCost:      2,
    description: 'Reveal one weakness and one resistance. The next correct Counter lowers Corruption by 5 more.',
    shortEffect: 'Reveal Weakness + Resistance  ·  +5 next Counter',
    battleLog:   'Fleming\'s analysis marks the pathway. Targeted intervention is confirmed.',
    chainRole:   'Scout',
  },
  {
    id:          'targeted_antidote',
    name:        'Targeted Antidote',
    apCost:      3,
    description: 'Lower Corruption by 10. If a weakness is revealed, lower by 15 instead.',
    shortEffect: '-10 Corruption  (or -15 if weakness known)',
    battleLog:   'Targeted Antidote strikes where it hurts. Corruption falls sharply.',
    chainRole:   'Counter',
  },
  {
    id:          'resistance_warning',
    name:        'Resistance Warning',
    apCost:      2,
    description: 'Prevent the next ineffective treatment penalty and reduce Corruption Spread by 4.',
    shortEffect: 'Block next penalty  ·  -4 Corruption Spread',
    battleLog:   'Resistance Warning issued. The next ineffective treatment causes no harm.',
    chainRole:   'Stabilize',
  },
];

// ---------------------------------------------------------------------------
// Prologue enemy skill definitions (Clinica language, for narrative display)
// ---------------------------------------------------------------------------

export interface PrologueEnemySkill {
  name:        string;
  description: string;
  battleLog:   string;
}

/** Silent Infarction — the scripted-defeat prologue boss */
export const SILENT_INFARCTION_SKILLS: readonly PrologueEnemySkill[] = [
  {
    name:        'Hidden Deterioration',
    description: 'Lower Stability by 6 unless a hidden cue has been revealed.',
    battleLog:   'The Silent Infarction deteriorates beneath the surface. Stability falls by 6.',
  },
  {
    name:        'False Reassurance',
    description: 'Hide one Clinical Cue and increase Corruption Spread by 4.',
    battleLog:   'False Reassurance conceals a cue. Corruption Spread increases by 4.',
  },
  {
    name:        'Unseen Collapse',
    description: 'Scripted prologue finale — the trap springs, causing catastrophic damage.',
    battleLog:   'The trap springs. The damage runs far deeper than any strike.',
  },
];

/** Dehydration Wisp — tutorial battle 1 enemy (Hydration Monster narrative name) */
export const HYDRATION_MONSTER_SKILLS: readonly PrologueEnemySkill[] = [
  {
    name:        'Drying Pulse',
    description: 'Lower Stability by 4 and add 2 Corruption Spread unless the Hydration Cue is identified.',
    battleLog:   'Drying Pulse drains the patient\'s reserves. Stability -4, Corruption Spread rising.',
  },
  {
    name:        'Thirst Signal',
    description: 'Create a visible Clinical Cue that can be found with Scout.',
    battleLog:   'The enemy reveals itself — a visible cue emerges. Use Scout to read it.',
  },
];

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
