import { ElementSystem } from './types';

export interface Item {
  id: string;
  name: string;
  systemType: string;
  itemType: 'Pharmacy' | 'Intervention' | 'Safety' | 'Scout';
  costAP: number;
  target: 'corruption' | 'stability' | 'shield' | 'clue';
  baseEffect: number;
  requiredClueKeyword: string | null; // substring match against revealed clue labels
  requiredClueLabel: string; // human-readable for error messages
  bonusVsSystem: ElementSystem | null;
  bonusEffect: number;
  description: string;
  beginnerExplanation: string;
  clinicalExplanation: string;
}

export const ITEMS: Item[] = [
  {
    id: 'I001',
    name: 'Albuterol Mist',
    systemType: 'Air',
    itemType: 'Pharmacy',
    costAP: 2,
    target: 'corruption',
    baseEffect: 30,
    requiredClueKeyword: 'wheez',
    requiredClueLabel: 'Wheezing',
    bonusVsSystem: 'Air',
    bonusEffect: 10,
    description: 'Opens narrowed airflow when wheezing is present.',
    beginnerExplanation: 'This helps open tight airways.',
    clinicalExplanation: 'Bronchodilator-type intervention for bronchospasm/wheezing.',
  },
  {
    id: 'I002',
    name: 'Glucose Gel',
    systemType: 'Energy',
    itemType: 'Pharmacy',
    costAP: 2,
    target: 'stability',
    baseEffect: 30,
    requiredClueKeyword: 'glucose',
    requiredClueLabel: 'Low Glucose',
    bonusVsSystem: 'Energy',
    bonusEffect: 10,
    description: 'Restores energy when low glucose is revealed.',
    beginnerExplanation: 'This gives the body fast sugar energy.',
    clinicalExplanation: 'Rapid glucose support for hypoglycemia symptoms.',
  },
  {
    id: 'I003',
    name: 'Fluid Bolus',
    systemType: 'River',
    itemType: 'Intervention',
    costAP: 2,
    target: 'stability',
    baseEffect: 25,
    requiredClueKeyword: 'bp',
    requiredClueLabel: 'Low Blood Pressure',
    bonusVsSystem: 'River',
    bonusEffect: 10,
    description: 'Supports circulation when low blood pressure is revealed.',
    beginnerExplanation: 'This helps restore circulation.',
    clinicalExplanation: 'Fluid support may improve perfusion when hypotension is present.',
  },
  {
    id: 'I004',
    name: 'Isolation Kit',
    systemType: 'Protection',
    itemType: 'Safety',
    costAP: 1,
    target: 'shield',
    baseEffect: 30,
    requiredClueKeyword: null,
    requiredClueLabel: '',
    bonusVsSystem: 'Fire',
    bonusEffect: 15,
    description: 'Reduces infection spread.',
    beginnerExplanation: 'This helps stop germs from spreading.',
    clinicalExplanation: 'Isolation and PPE reduce transmission risk.',
  },
  {
    id: 'I005',
    name: 'Lab Token',
    systemType: 'Universal',
    itemType: 'Scout',
    costAP: 1,
    target: 'clue',
    baseEffect: 1,
    requiredClueKeyword: null,
    requiredClueLabel: '',
    bonusVsSystem: null,
    bonusEffect: 0,
    description: 'Reveal one hidden clue.',
    beginnerExplanation: 'This helps you find what is wrong.',
    clinicalExplanation: 'Additional data can clarify the priority problem.',
  },
];

export function findItem(name: string): Item | undefined {
  return ITEMS.find(i => i.name === name);
}

// ---------- Call Team Options ----------
export interface CallOption {
  id: string;
  name: string;
  costAP: number;
  effect: 'unlockAction' | 'addRelevantItem' | 'rapidResponse';
  actionId?: string;
  description: string;
}

export const CALL_OPTIONS: CallOption[] = [
  {
    id: 'call_respiratory',
    name: 'Call Respiratory Support',
    costAP: 2,
    effect: 'unlockAction',
    actionId: 'open_airflow',
    description: 'Respiratory Support joins. Unlocks Open Airflow.',
  },
  {
    id: 'call_pharmacy',
    name: 'Call Pharmacy',
    costAP: 2,
    effect: 'addRelevantItem',
    description: 'Pharmacy prepares a useful intervention based on the situation.',
  },
  {
    id: 'call_rapid',
    name: 'Call Rapid Response',
    costAP: 2,
    effect: 'rapidResponse',
    description: 'Block next attack and +10 Stability. (Stability ≤ 30)',
  },
  {
    id: 'call_infection',
    name: 'Call Infection Control',
    costAP: 2,
    effect: 'unlockAction',
    actionId: 'containment_order',
    description: 'Infection Control joins. Unlocks Containment Order.',
  },
];

// Temporary battle actions unlocked via Call Team
export interface TempAction {
  id: string;
  name: string;
  costAP: number;
  description: string;
  stabilize?: number;
  strike?: number;
  shield?: number;
}

export const TEMP_ACTIONS: Record<string, TempAction> = {
  open_airflow: {
    id: 'open_airflow',
    name: 'Open Airflow',
    costAP: 1,
    description: 'Open the airway. Strike 25 + stabilize 10.',
    strike: 25,
    stabilize: 10,
  },
  containment_order: {
    id: 'containment_order',
    name: 'Containment Order',
    costAP: 1,
    description: 'Halt spread. Strike 20 + shield 30%.',
    strike: 20,
    shield: 30,
  },
};

// Check if any revealed clue label matches the item's keyword
export function isClueRevealed(revealedLabels: string[], keyword: string | null): boolean {
  if (!keyword) return true;
  const kw = keyword.toLowerCase();
  return revealedLabels.some(l => l.toLowerCase().includes(kw));
}
