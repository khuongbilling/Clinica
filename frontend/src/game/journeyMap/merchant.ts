/** Stable, persisted Traveling Merchant inventory generation for Age 1. */

import type { JourneyTile } from './types';

export const COVENANT_SKILL_FRAGMENT = 'Covenant Skill Fragment';
export const BLANK_COVENANT_SCROLL = 'Blank Covenant Scroll';
export const NIGHT_MARKET_TICKET = 'Night Market Ticket';
export const MERCHANT_SLOT_COUNT = 6;

export type MerchantStock = NonNullable<JourneyTile['merchantInventory']>[number];

function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const COMMON = ['Lab Token', 'Albuterol Mist', 'Glucose Gel', 'Fluid Bolus', 'Isolation Kit'] as const;
const RARE = ['exp_scroll_sm', 'exp_scroll_md'] as const;

/** Exactly one ultra roll per generated inventory: 0.5% fragment, 0.1% ticket. */
export function generateMerchantInventory(
  runSeed: string,
  tileId: string,
  chapterId: number,
  alreadyUnlockedNightMarket = false,
): MerchantStock[] {
  const chapter = Math.max(5, Math.min(10, chapterId));
  const base = `${runSeed}:merchant:${tileId}`;
  const stock: MerchantStock[] = Array.from({ length: MERCHANT_SLOT_COUNT }, (_, index) => {
    const name = index === 5
      ? RARE[hash(`${base}:rare`) % RARE.length]
      : COMMON[hash(`${base}:${index}`) % COMMON.length];
    const quantity = name.startsWith('exp_') ? 1 : 1 + (hash(`${base}:qty:${index}`) % 2);
    return {
      id: `${tileId}:${index}`,
      name,
      quantity,
      price: (index === 5 ? 70 : 20) + chapter * (index === 5 ? 8 : 3),
      rarity: index === 5 ? 'rare' : 'common',
    };
  });

  const ultra = hash(`${base}:ultra`) % 10_000;
  if (ultra < 50) {
    stock[5] = { ...stock[5], name: COVENANT_SKILL_FRAGMENT, quantity: 1, price: 800, rarity: 'ultra' };
  } else if (ultra < 60 && !alreadyUnlockedNightMarket) {
    stock[5] = { ...stock[5], name: NIGHT_MARKET_TICKET, quantity: 1, price: 1_200, rarity: 'ultra' };
  }
  // A duplicate Night Market ticket is intentionally replaced with rare stock.
  return stock;
}

export function assembleCovenantScroll(inventory: Record<string, number>) {
  const fragments = inventory[COVENANT_SKILL_FRAGMENT] ?? 0;
  if (fragments < 3) return { ok: false as const, inventory, message: 'Three Covenant Skill Fragments are required.' };
  return {
    ok: true as const,
    inventory: {
      ...inventory,
      [COVENANT_SKILL_FRAGMENT]: fragments - 3,
      [BLANK_COVENANT_SCROLL]: (inventory[BLANK_COVENANT_SCROLL] ?? 0) + 1,
    },
    message: 'A Blank Covenant Scroll has been assembled. It is prestige content for a future system.',
  };
}

export function hasNightMarketAccess(inventory: Record<string, number>, persistedUnlock = false) {
  return persistedUnlock || (inventory[NIGHT_MARKET_TICKET] ?? 0) > 0;
}