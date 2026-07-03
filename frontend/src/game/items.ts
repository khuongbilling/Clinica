import { ElementSystem } from './types';

export interface Item {
  id: string;
  name: string;
  displayName: string;
  rpgSubtitle: string;
  shortEffect: string;
  systemType: string;
  itemType: 'Pharmacy' | 'Intervention' | 'Safety' | 'Scout';
  costAP: number;
  target: 'corruption' | 'stability' | 'shield' | 'clue';
  baseEffect: number;
  requiredClueKeyword: string | null;
  requiredClueLabel: string;
  bonusVsSystem: ElementSystem | null;
  bonusEffect: number;
  description: string;
  beginnerExplanation: string;
  clinicalExplanation: string;
  price: number;
}

export const ITEMS: Item[] = [
  {
    id: 'I001',
    name: 'Albuterol Mist',
    displayName: 'Bronchodilator Mist',
    rpgSubtitle: 'Air Pharmacy Item',
    shortEffect: 'Requires Wheezing • -30 Corruption',
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
    clinicalExplanation: 'Represents a bronchodilator-type intervention such as albuterol for bronchospasm/wheezing — anticipate or administer as ordered or per protocol.',
    price: 40,
  },
  {
    id: 'I002',
    name: 'Glucose Gel',
    displayName: 'Glucose Spark Gel',
    rpgSubtitle: 'Energy Pharmacy Item',
    shortEffect: 'Requires Low Glucose • -22 Corruption',
    systemType: 'Energy',
    itemType: 'Pharmacy',
    costAP: 2,
    target: 'corruption',
    baseEffect: 22,
    requiredClueKeyword: 'glucose',
    requiredClueLabel: 'Low Glucose',
    bonusVsSystem: 'Energy',
    bonusEffect: 14,
    description: 'Treats energy deficit directly when low glucose is confirmed.',
    beginnerExplanation: 'Glucose directly fixes the low blood sugar causing the problem.',
    clinicalExplanation: 'Glucose replacement directly treats hypoglycemia — administering glucose per protocol resolves the underlying energy deficit and reduces the disease burden.',
    price: 30,
  },
  {
    id: 'I003',
    name: 'Fluid Bolus',
    displayName: 'River Bolus',
    rpgSubtitle: 'River Intervention Item',
    shortEffect: 'Requires Low BP • +25 Stability',
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
    clinicalExplanation: 'Represents fluid support for hypotension/perfusion concerns when appropriate and ordered/protocol-based.',
    price: 35,
  },
  {
    id: 'I004',
    name: 'Isolation Kit',
    displayName: 'Barrier Kit',
    rpgSubtitle: 'Protection Safety Item',
    shortEffect: 'Blocks Spread',
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
    clinicalExplanation: 'Represents PPE, isolation precautions, and transmission prevention.',
    price: 30,
  },
  {
    id: 'I005',
    name: 'Lab Token',
    displayName: 'Codex Lab Sigil',
    rpgSubtitle: 'Scout Item',
    shortEffect: 'Reveal Hidden Clue',
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
    clinicalExplanation: 'Represents obtaining additional clinical data to clarify the problem.',
    price: 15,
  },
  {
    id: 'I006',
    name: 'Antipyretic Draught',
    displayName: 'Fever-Break Draught',
    rpgSubtitle: 'Fire Pharmacy Item',
    shortEffect: 'Best vs Fire • -24 Corruption',
    systemType: 'Fire',
    itemType: 'Pharmacy',
    costAP: 2,
    target: 'corruption',
    baseEffect: 24,
    requiredClueKeyword: null,
    requiredClueLabel: '',
    bonusVsSystem: 'Fire',
    bonusEffect: 12,
    description: 'Cools a burning fever and eases inflammatory spread.',
    beginnerExplanation: 'This brings down a high fever.',
    clinicalExplanation: 'Represents antipyretic/anti-inflammatory support (e.g., acetaminophen) for fever from infection or inflammation, per orders/protocol.',
    price: 35,
  },
  {
    id: 'I007',
    name: 'Oxygen Sigil',
    displayName: 'Breath-of-Air Sigil',
    rpgSubtitle: 'Air Intervention Item',
    shortEffect: 'Best vs Air • +22 Stability',
    systemType: 'Air',
    itemType: 'Intervention',
    costAP: 2,
    target: 'stability',
    baseEffect: 22,
    requiredClueKeyword: null,
    requiredClueLabel: '',
    bonusVsSystem: 'Air',
    bonusEffect: 10,
    description: 'Restores oxygenation when breathing falters.',
    beginnerExplanation: 'This gives the patient more oxygen.',
    clinicalExplanation: 'Represents supplemental oxygen support for hypoxia/low oxygen saturation, titrated per orders/protocol.',
    price: 35,
  },
  {
    id: 'I008',
    name: 'Calming Elixir',
    displayName: 'Still-Mind Elixir',
    rpgSubtitle: 'Mind Intervention Item',
    shortEffect: 'Best vs Mind • +20 Stability',
    systemType: 'Mind',
    itemType: 'Intervention',
    costAP: 2,
    target: 'stability',
    baseEffect: 20,
    requiredClueKeyword: null,
    requiredClueLabel: '',
    bonusVsSystem: 'Mind',
    bonusEffect: 10,
    description: 'Settles panic and eases acute distress.',
    beginnerExplanation: 'This helps a frightened patient feel calm.',
    clinicalExplanation: 'Represents non-pharmacologic de-escalation and anxiolytic support for acute anxiety/panic, per orders/protocol.',
    price: 30,
  },
  {
    id: 'I009',
    name: 'Analgesic Balm',
    displayName: 'Ease-Pain Balm',
    rpgSubtitle: 'Mind Pharmacy Item',
    shortEffect: 'Best vs Mind • +16 Stability',
    systemType: 'Mind',
    itemType: 'Pharmacy',
    costAP: 1,
    target: 'stability',
    baseEffect: 16,
    requiredClueKeyword: null,
    requiredClueLabel: '',
    bonusVsSystem: 'Mind',
    bonusEffect: 8,
    description: 'Relieves pain so the patient can stabilize.',
    beginnerExplanation: 'This helps with pain.',
    clinicalExplanation: 'Represents appropriate analgesia for reported pain after assessment, per orders/protocol.',
    price: 25,
  },
  {
    id: 'I010',
    name: 'Rhythm Elixir',
    displayName: 'Steady-Beat Elixir',
    rpgSubtitle: 'Storm Intervention Item',
    shortEffect: 'Best vs Storm • +20 Stability',
    systemType: 'Storm',
    itemType: 'Intervention',
    costAP: 2,
    target: 'stability',
    baseEffect: 20,
    requiredClueKeyword: null,
    requiredClueLabel: '',
    bonusVsSystem: 'Storm',
    bonusEffect: 10,
    description: 'Steadies an erratic heart rhythm.',
    beginnerExplanation: 'This helps steady the heartbeat.',
    clinicalExplanation: 'Represents rhythm/rate support for dysrhythmia and unstable heart rate, per orders/protocol.',
    price: 40,
  },
  {
    id: 'I011',
    name: 'Antiemetic Charm',
    displayName: 'Settle-Gut Charm',
    rpgSubtitle: 'Filter Pharmacy Item',
    shortEffect: 'Best vs Filter • -18 Corruption',
    systemType: 'Filter',
    itemType: 'Pharmacy',
    costAP: 1,
    target: 'corruption',
    baseEffect: 18,
    requiredClueKeyword: null,
    requiredClueLabel: '',
    bonusVsSystem: 'Filter',
    bonusEffect: 10,
    description: 'Calms nausea and protects fluid balance.',
    beginnerExplanation: 'This helps with feeling sick to the stomach.',
    clinicalExplanation: 'Represents antiemetic support for nausea/vomiting to protect hydration and electrolytes, per orders/protocol.',
    price: 28,
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
    description: 'Unlocks Open Airflow. Strongest when respiratory clues are present.',
  },
  {
    id: 'call_pharmacy',
    name: 'Call Pharmacy',
    costAP: 2,
    effect: 'addRelevantItem',
    description: 'Prepares a context-relevant item (-1 AP). Needs at least one clue revealed.',
  },
  {
    id: 'call_rapid',
    name: 'Call Rapid Response',
    costAP: 3,
    effect: 'rapidResponse',
    description: 'Emergency only (Stability ≤ 30). +15 Stability + block next enemy attack.',
  },
  {
    id: 'call_infection',
    name: 'Call Infection Control',
    costAP: 2,
    effect: 'unlockAction',
    actionId: 'containment_order',
    description: 'Unlocks Containment Order. Strongest against infection/spread problems.',
  },
];

// Temporary battle actions unlocked via Call Team
export interface TempAction {
  id: string;
  name: string;
  costAP: number;
  description: string;
  shortEffect?: string;
  systemType?: string;
  stabilize?: number;
  strike?: number;
  shield?: number;
}

export const TEMP_ACTIONS: Record<string, TempAction> = {
  open_airflow: {
    id: 'open_airflow',
    name: 'Open Airflow',
    costAP: 1,
    systemType: 'Air',
    description: 'Open the airway. Corruption -25, Stability +10.',
    shortEffect: 'Air Counter • -25 Corruption · +10 Stability',
    strike: 25,
    stabilize: 10,
  },
  containment_order: {
    id: 'containment_order',
    name: 'Containment Order',
    costAP: 1,
    systemType: 'Protection',
    description: 'Halt spread. Corruption -20, Shield 30%.',
    shortEffect: 'Protect Counter • -20 Corruption · 30% Shield',
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
