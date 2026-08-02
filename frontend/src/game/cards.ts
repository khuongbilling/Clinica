import { ActionClinical } from './clinical';

// ── Card chain-role type ───────────────────────────────────────────────────────
// Assess / Stabilize / Treat / Reassess → count toward the clinical pathway.
// Support → does NOT advance the pathway (shields, buffs, emergency calls).

export type CardChainType = 'Assess' | 'Stabilize' | 'Treat' | 'Reassess' | 'Support';

export type SkillCardType =
  | 'oxygen_support'
  | 'airway_clearance'
  | 'positioning'
  | 'reassess'
  | 'rapid_response'
  | 'protective_ward'
  // P8 starter cards
  | 'focused_assessment'
  | 'hydration_support'
  | 'treatment_protocol'
  | 'reassessment_checklist'
  | 'emergency_call';

export interface SkillCard {
  id: string;
  type: SkillCardType;
  name: string;
  rpgFlavor: string;
  shortEffect: string;
  costAP: number;
  systemType: string;
  // P8 — clinical chain classification and how this card was/can be acquired.
  cardChainType: CardChainType;
  source: string;
  stabilize?: number;
  strike?: number;
  shield?: number;
  reveal?: number;
}

export const CARD_POOL: SkillCard[] = [
  // ── Legacy pool cards ─────────────────────────────────────────────────────────
  {
    id: 'card_oxygen_support',
    type: 'oxygen_support',
    name: 'Oxygen Support',
    rpgFlavor: 'A radiant breath of pure air steadies failing lungs.',
    shortEffect: '+12 Stability',
    costAP: 1,
    systemType: 'Air',
    cardChainType: 'Stabilize',
    source: 'University Research',
    stabilize: 12,
  },
  {
    id: 'card_airway_clearance',
    type: 'airway_clearance',
    name: 'Airway Clearance',
    rpgFlavor: 'Clears the corrupted mist choking the airway.',
    shortEffect: '-10 Corruption',
    costAP: 1,
    systemType: 'Air',
    cardChainType: 'Treat',
    source: 'Apothecary Market',
    strike: 10,
  },
  {
    id: 'card_positioning',
    type: 'positioning',
    name: 'Positioning',
    rpgFlavor: 'Repositions the patient to ease strain on every system.',
    shortEffect: '+8 Stability',
    costAP: 1,
    systemType: 'Universal',
    cardChainType: 'Stabilize',
    source: 'Battle Reward',
    stabilize: 8,
  },
  {
    id: 'card_reassess',
    type: 'reassess',
    name: 'Reassess',
    rpgFlavor: 'A steady gaze re-reads the patient, disarming the coming rebound.',
    shortEffect: 'Reveal 1 clue, disarm rebound',
    costAP: 1,
    systemType: 'Universal',
    cardChainType: 'Reassess',
    source: 'University Research',
    reveal: 1,
  },
  {
    id: 'card_rapid_response',
    type: 'rapid_response',
    name: 'Rapid Response',
    rpgFlavor: 'Calls the ward\'s emergency guard to shield the patient.',
    shortEffect: 'Protection 50% next Instability',
    costAP: 2,
    systemType: 'Universal',
    cardChainType: 'Support',
    source: 'Event Reward',
    shield: 50,
  },
  {
    id: 'card_protective_ward',
    type: 'protective_ward',
    name: 'Protective Ward',
    rpgFlavor: 'Wraps the patient in a shimmering ward of safety.',
    shortEffect: '+6 Stability, Protection 25%',
    costAP: 2,
    systemType: 'Protection',
    cardChainType: 'Support',
    source: 'Faction Research',
    stabilize: 6,
    shield: 25,
  },

  // ── P8 Starter Cards ──────────────────────────────────────────────────────────
  // These five cards are the foundational clinical-chain tools given to every
  // player. Each one slots into a specific pathway role (Assess/Stabilize/Treat/
  // Reassess/Support) and can be loaded into the 3 card slots in the loadout.
  {
    id: 'card_focused_assessment',
    type: 'focused_assessment',
    name: 'Focused Assessment Card',
    rpgFlavor: 'A methodical sweep of the patient\'s signs — nothing escapes the trained eye.',
    shortEffect: 'Reveal 2 clues',
    costAP: 1,
    systemType: 'Universal',
    cardChainType: 'Assess',
    source: 'University Research',
    reveal: 2,
  },
  {
    id: 'card_hydration_support',
    type: 'hydration_support',
    name: 'Hydration Support Card',
    rpgFlavor: 'A steady infusion restores the patient\'s inner equilibrium.',
    shortEffect: '+14 Stability',
    costAP: 1,
    systemType: 'River',
    cardChainType: 'Stabilize',
    source: 'Apothecary Market',
    stabilize: 14,
  },
  {
    id: 'card_treatment_protocol',
    type: 'treatment_protocol',
    name: 'Treatment Protocol Card',
    rpgFlavor: 'The correct intervention, delivered with clinical precision, strikes at the heart of disease.',
    shortEffect: '-12 Corruption',
    costAP: 1,
    systemType: 'Universal',
    cardChainType: 'Treat',
    source: 'Battle Reward',
    strike: 12,
  },
  {
    id: 'card_reassessment_checklist',
    type: 'reassessment_checklist',
    name: 'Reassessment Checklist Card',
    rpgFlavor: 'Systematic re-evaluation closes old gaps and disarms lurking danger.',
    shortEffect: 'Reveal 1 clue, disarm rebound, Protection 15%',
    costAP: 1,
    systemType: 'Universal',
    cardChainType: 'Reassess',
    source: 'University Research',
    reveal: 1,
    shield: 15,
  },
  {
    id: 'card_emergency_call',
    type: 'emergency_call',
    name: 'Emergency Call Card',
    rpgFlavor: 'Reinforcements arrive, buying precious time — but the diagnosis must still be made.',
    shortEffect: 'Protection 35% — does not advance chain',
    costAP: 1,
    systemType: 'Universal',
    cardChainType: 'Support',
    source: 'Event Reward',
    shield: 35,
  },
];

// ── Clinical metadata (pathway roles, tags, system affinity) ──────────────────
// pathwayRoles drives canAdvancePathway().
// Support cards MUST have pathwayRoles: [] — they never advance the care pathway.

export const CARD_CLINICAL: Record<string, ActionClinical> = {
  card_oxygen_support:         { clinicalTags: ['oxygenation', 'respiratory'], appropriateForSystems: ['Air'], pathwayRoles: ['stabilize'],         diseaseCategory: 'respiratory' },
  card_airway_clearance:       { clinicalTags: ['airway', 'respiratory'],      appropriateForSystems: ['Air'], pathwayRoles: ['treat'],              diseaseCategory: 'respiratory' },
  card_positioning:            { clinicalTags: ['general support', 'comfort'],                                 pathwayRoles: ['stabilize'],          diseaseCategory: 'general' },
  card_reassess:               { clinicalTags: ['reassessment', 'assessment'],                                 pathwayRoles: ['reassess', 'assess'], diseaseCategory: 'general' },
  // Support cards — explicitly empty pathwayRoles so they never advance the pathway.
  card_rapid_response:         { clinicalTags: ['escalation', 'emergency'],                                    pathwayRoles: [],                     diseaseCategory: 'general' },
  card_protective_ward:        { clinicalTags: ['safety', 'protect'],          appropriateForSystems: ['Protection'], pathwayRoles: [],             diseaseCategory: 'safety' },
  // P8 starter cards
  card_focused_assessment:     { clinicalTags: ['assessment', 'observation'],                                  pathwayRoles: ['assess'],             diseaseCategory: 'general' },
  card_hydration_support:      { clinicalTags: ['hydration', 'fluid support'], appropriateForSystems: ['River'], pathwayRoles: ['stabilize'],       diseaseCategory: 'circulatory' },
  card_treatment_protocol:     { clinicalTags: ['treatment', 'intervention'],                                  pathwayRoles: ['treat'],              diseaseCategory: 'general' },
  card_reassessment_checklist: { clinicalTags: ['reassessment', 'systematic review'],                          pathwayRoles: ['reassess'],           diseaseCategory: 'general' },
  card_emergency_call:         { clinicalTags: ['emergency', 'escalation'],                                    pathwayRoles: [],                     diseaseCategory: 'general' },
};

// Cards every player has access to in their loadout picker (P8 starter set).
// Advanced cards from shops, events, or faction research will be added in later pushes.
export const STARTER_CARD_IDS: string[] = [
  'card_focused_assessment',
  'card_hydration_support',
  'card_treatment_protocol',
  'card_reassessment_checklist',
  'card_emergency_call',
];

// All card IDs available to players right now (starter + legacy pool).
export const ALL_AVAILABLE_CARD_IDS: string[] = CARD_POOL.map(c => c.id);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Random draw — used as legacy fallback when no cards are equipped. */
export function drawCards(count: number, exclude: string[] = []): string[] {
  const pool = CARD_POOL.filter(c => !exclude.includes(c.id));
  const source = pool.length > 0 ? pool : CARD_POOL;
  const drawn: string[] = [];
  for (let i = 0; i < count; i++) {
    drawn.push(source[Math.floor(Math.random() * source.length)].id);
  }
  return drawn;
}

export function getCard(id: string): SkillCard | undefined {
  return CARD_POOL.find(c => c.id === id);
}

// Chain-type config for UI rendering.
export const CHAIN_TYPE_CONFIG: Record<CardChainType, { icon: string; color: string; label: string; advancesChain: boolean }> = {
  Assess:    { icon: 'eye',               color: '#A6D8F6', label: 'Assess',    advancesChain: true },
  Stabilize: { icon: 'heart',             color: '#4FD8C4', label: 'Stabilize', advancesChain: true },
  Treat:     { icon: 'flash',             color: '#F97316', label: 'Treat',     advancesChain: true },
  Reassess:  { icon: 'refresh-circle',    color: '#BBA7EA', label: 'Reassess',  advancesChain: true },
  Support:   { icon: 'shield-checkmark',  color: '#E8C868', label: 'Support',   advancesChain: false },
};
