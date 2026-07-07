// Apothecary Market catalog — non-consumable shop content.
// Battle consumables live in items.ts (ITEMS). This file defines the shop's
// cosmetic, permanent, ward-defense, and refill offerings plus their pricing.

// ---------- Hero Skins (cosmetic only) ----------
// Skins are purely visual: they render a colored aura + accent frame on hero
// cards. They never change stats, effects, or gameplay in any way.
export interface ShopSkin {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  auraColor: string;   // glow behind the hero portrait
  accentColor: string; // frame / border accent
  icon: string;        // Ionicons name
  // Optional ward-arena backdrop this skin swaps in during Ward Shift battles.
  // Only set for "ward skins" (e.g. the Bloom Ward Skin) — plain aura skins omit it.
  wardBackdrop?: ReturnType<typeof require>;
  // When true the skin is NOT crown-purchasable; it is earned elsewhere (e.g.
  // the Miasma Bloom Token Exchange) and only ever equipped once owned.
  exchangeOnly?: boolean;
}

export const SKINS: ShopSkin[] = [
  {
    id: 'skin_verdant',
    name: 'Verdant Regalia',
    subtitle: 'Growth Aura',
    description: 'A living green halo wreathes your healers. Purely cosmetic — no effect on battle.',
    price: 400,
    auraColor: '#34d399',
    accentColor: '#059669',
    icon: 'leaf',
  },
  {
    id: 'skin_ember',
    name: 'Ember Regalia',
    subtitle: 'Fire Aura',
    description: 'Warm ember light rings each hero. Purely cosmetic — no effect on battle.',
    price: 400,
    auraColor: '#fb923c',
    accentColor: '#ea580c',
    icon: 'flame',
  },
  {
    id: 'skin_tidal',
    name: 'Tidal Regalia',
    subtitle: 'River Aura',
    description: 'Cool tidal blues flow around your healers. Purely cosmetic — no effect on battle.',
    price: 400,
    auraColor: '#38bdf8',
    accentColor: '#0284c7',
    icon: 'water',
  },
  {
    id: 'skin_royal',
    name: 'Royal Regalia',
    subtitle: 'Crown Aura',
    description: 'A regal gold-and-violet crown aura for the truly wealthy. Purely cosmetic.',
    price: 1200,
    auraColor: '#c084fc',
    accentColor: '#facc15',
    icon: 'diamond',
  },
  {
    id: 'skin_bloom_ward',
    name: 'Bloom Ward Skin',
    subtitle: 'Bioluminescent Ward',
    description: 'Reclaims the Miasma Bloom for the light — glowing petals and spore-lanterns transform your Ward Shift arena, plus a soft rose-teal aura on your healers. Earned from the Token Exchange. Purely cosmetic.',
    price: 0,
    auraColor: '#f472b6',
    accentColor: '#2dd4bf',
    icon: 'color-palette',
    wardBackdrop: require('@/assets/images/battle_bg/bloom_ward.png'),
    exchangeOnly: true,
  },
];

export function findSkin(id: string): ShopSkin | undefined {
  return SKINS.find(s => s.id === id);
}

// ---------- Permanent Upgrades (expensive crown sinks) ----------
// Each upgrade is bought once and applies forever to every standard battle.
// Effects map 1:1 onto real initBattle options so the described benefit is
// exactly what the engine applies (mechanic honesty).
export interface ShopUpgrade {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  icon: string;
  effect: {
    apBonus?: number;                // +starting Action Points each battle
    startingStabilityBonus?: number; // +starting patient Stability
    enemyDamageReduction?: number;   // % less damage from enemy turns
    revealOneExtraClue?: boolean;    // one hidden clue revealed at start
  };
}

export const UPGRADES: ShopUpgrade[] = [
  {
    id: 'upg_meditation',
    name: 'Battle Meditation',
    subtitle: 'Permanent • +1 Starting AP',
    description: 'Begin every battle with +1 Action Point to spend. Applies forever.',
    price: 1500,
    icon: 'flash',
    effect: { apBonus: 1 },
  },
  {
    id: 'upg_aegis',
    name: 'Aegis Training',
    subtitle: 'Permanent • +12 Starting Stability',
    description: 'Every patient starts 12% more stable. Applies forever.',
    price: 1800,
    icon: 'shield-half',
    effect: { startingStabilityBonus: 12 },
  },
  {
    id: 'upg_intuition',
    name: "Clinician's Intuition",
    subtitle: 'Permanent • Reveal 1 clue at start',
    description: 'One hidden clue is revealed at the start of every battle. Applies forever.',
    price: 2200,
    icon: 'eye',
    effect: { revealOneExtraClue: true },
  },
  {
    id: 'upg_resolve',
    name: 'Hardened Resolve',
    subtitle: 'Permanent • Enemy damage -12%',
    description: 'Disease spirits deal 12% less damage on their turns. Applies forever.',
    price: 2600,
    icon: 'fitness',
    effect: { enemyDamageReduction: 12 },
  },
];

export function findUpgrade(id: string): ShopUpgrade | undefined {
  return UPGRADES.find(u => u.id === id);
}

// Fold every owned upgrade into a single bundle of initBattle option deltas.
export function aggregateUpgradeEffects(ownedIds: string[] | undefined): {
  apBonus: number;
  startingStabilityBonus: number;
  enemyDamageReduction: number;
  revealOneExtraClue: boolean;
} {
  const acc = { apBonus: 0, startingStabilityBonus: 0, enemyDamageReduction: 0, revealOneExtraClue: false };
  for (const id of ownedIds || []) {
    const u = findUpgrade(id);
    if (!u) continue;
    acc.apBonus += u.effect.apBonus || 0;
    acc.startingStabilityBonus += u.effect.startingStabilityBonus || 0;
    acc.enemyDamageReduction += u.effect.enemyDamageReduction || 0;
    acc.revealOneExtraClue = acc.revealOneExtraClue || !!u.effect.revealOneExtraClue;
  }
  return acc;
}

// ---------- Ward Defense Boosts (consumable, per-run) ----------
// Bought into the inventory, then activated in the Ward Defense lobby to apply
// to the next run's opening state. Consumed on use.
export interface WardBoost {
  id: string;
  name: string;        // also the inventory key
  subtitle: string;
  description: string;
  price: number;
  icon: string;
  effect: {
    startAP?: number;      // +Action Points at run start (cap MAX_AP)
    startShield?: number;  // opening damage-shield duration in ticks (halves incoming Stability loss)
  };
}

export const WARD_BOOSTS: WardBoost[] = [
  {
    id: 'ward_reinforce',
    name: 'Reinforcement Draft',
    subtitle: 'Ward Defense • +3 starting AP',
    description: 'Deploy the next Ward Defense run with +3 Action Points ready. Consumed on use.',
    price: 120,
    icon: 'flash',
    effect: { startAP: 3 },
  },
  {
    id: 'ward_lantern',
    name: 'Lantern Ward',
    subtitle: 'Ward Defense • +2 AP & brief shield',
    description: 'A steady opening: begin the next Ward Defense run with +2 Action Points and a short barrier that halves incoming Stability damage for the first ~7 seconds. Consumed on use.',
    price: 100,
    icon: 'bulb',
    effect: { startAP: 2, startShield: 14 },
  },
  {
    id: 'ward_bulwark',
    name: 'Bulwark Sigil',
    subtitle: 'Ward Defense • opening damage shield',
    description: 'Open the next Ward Defense run behind a barrier that halves incoming Stability damage for the first ~15 seconds. Consumed on use.',
    price: 140,
    icon: 'shield',
    effect: { startShield: 30 },
  },
];

export function findWardBoost(id: string): WardBoost | undefined {
  return WARD_BOOSTS.find(w => w.id === id);
}

export function findWardBoostByName(name: string): WardBoost | undefined {
  return WARD_BOOSTS.find(w => w.name === name);
}

// ---------- Stamina / Energy Refills ----------
export interface StaminaPack {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  amount: number; // stamina points restored (capped at MAX_STAMINA)
  icon: string;
}

export const STAMINA_PACKS: StaminaPack[] = [
  {
    id: 'stam_small',
    name: 'Traveller\'s Tonic',
    subtitle: '+2 Stamina',
    description: 'A quick pick-me-up to squeeze in another shift.',
    price: 60,
    amount: 2,
    icon: 'cafe',
  },
  {
    id: 'stam_full',
    name: 'Full Rest Draught',
    subtitle: 'Refill to full',
    description: 'Restore your Stamina completely and get back to healing.',
    price: 150,
    amount: 99,
    icon: 'bed',
  },
];
