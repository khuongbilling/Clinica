import { ActionClinical } from './clinical';

export type SkillCardType =
  | 'oxygen_support'
  | 'airway_clearance'
  | 'positioning'
  | 'reassess'
  | 'rapid_response'
  | 'protective_ward';

export interface SkillCard {
  id: string;
  type: SkillCardType;
  name: string;
  rpgFlavor: string;
  shortEffect: string;
  costAP: number;
  systemType: string;
  stabilize?: number;
  strike?: number;
  shield?: number;
  reveal?: number;
}

export const CARD_POOL: SkillCard[] = [
  {
    id: 'card_oxygen_support',
    type: 'oxygen_support',
    name: 'Oxygen Support',
    rpgFlavor: 'A radiant breath of pure air steadies failing lungs.',
    shortEffect: '+12 Stability',
    costAP: 1,
    systemType: 'Air',
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
    reveal: 1,
  },
  {
    id: 'card_rapid_response',
    type: 'rapid_response',
    name: 'Rapid Response',
    rpgFlavor: 'Calls the ward\u2019s emergency guard to shield the patient.',
    shortEffect: 'Shield 50% next hit',
    costAP: 2,
    systemType: 'Universal',
    shield: 50,
  },
  {
    id: 'card_protective_ward',
    type: 'protective_ward',
    name: 'Protective Ward',
    rpgFlavor: 'Wraps the patient in a shimmering ward of safety.',
    shortEffect: '+6 Stability, Shield 25%',
    costAP: 2,
    systemType: 'Protection',
    stabilize: 6,
    shield: 25,
  },
];

export const CARD_CLINICAL: Record<string, ActionClinical> = {
  card_oxygen_support: { clinicalTags: ['oxygenation', 'respiratory'], appropriateForSystems: ['Air'], chainRoles: ['Stabilize'] },
  card_airway_clearance: { clinicalTags: ['airway', 'respiratory'], appropriateForSystems: ['Air'], chainRoles: ['Counter'] },
  card_positioning: { clinicalTags: ['general support', 'comfort'], chainRoles: ['Stabilize'] },
  card_reassess: { clinicalTags: ['reassessment', 'assessment'], chainRoles: ['Reassess', 'Scout'] },
  card_rapid_response: { clinicalTags: ['escalation', 'emergency'], chainRoles: ['Protect'] },
  card_protective_ward: { clinicalTags: ['safety', 'protect'], appropriateForSystems: ['Protection'], chainRoles: ['Protect'] },
};

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
