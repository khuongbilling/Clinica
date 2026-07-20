/**
 * Canonical hero visual resolver.
 *
 * Single source of truth for resolving a hero's art assets + visual metadata.
 * Wire ALL battle entry points (tutorial, prologue, Ward Shift, boss, replay)
 * through this helper — fix or extend here, not at individual call sites.
 */

import type { ImageSourcePropType } from 'react-native';
import { getHeroSprite, hasHeroSprite } from './HeroSprites';
import { getHeroBattleSprite } from './HeroBattleSprites';
import { HEROES } from '@/src/game/content';
import { LAUNCH_ROSTER, FAMILY_COLORS, RARITY_LABELS } from '@/src/game/heroRoster';
import type { ClassFamily, ElementSystem, HeroRole, LaunchRarity } from '@/src/game/types';

// ── Fallback assets ──────────────────────────────────────────────────────────

const DEFAULT_COLOR = '#5ECBC8';

// ── Metadata resolution ──────────────────────────────────────────────────────

export interface HeroVisualMeta {
  family: ClassFamily | null;
  role: HeroRole | null;
  rarity: LaunchRarity | null;
  rarityLabel: string;
  element: ElementSystem | null;
  familyColor: string;
  fallbackInitial: string;
  isPrologue: boolean;
  isLocked: boolean;
}

const PROLOGUE_IDS = new Set(['prologue_nightingale', 'prologue_fleming', 'former_self', 'prologue_former_self']);
const LOCKED_IDS   = new Set(['florence_nightingale']);

function resolveMeta(heroId: string, heroName?: string): HeroVisualMeta {
  // Check LAUNCH_ROSTER first (has ClassFamily / LaunchRarity).
  const roster = LAUNCH_ROSTER.find(h => h.id === heroId);
  if (roster) {
    return {
      family:        roster.family,
      role:          roster.role,
      rarity:        roster.rarityTier,
      rarityLabel:   RARITY_LABELS[roster.rarityTier] ?? roster.rarityTier,
      element:       roster.element,
      familyColor:   FAMILY_COLORS[roster.family] ?? DEFAULT_COLOR,
      fallbackInitial: roster.name[0] ?? '?',
      isPrologue:    PROLOGUE_IDS.has(heroId),
      isLocked:      LOCKED_IDS.has(heroId),
    };
  }

  // Check HEROES (content.ts — original 10 + prologue loaners).
  const contentHero = HEROES.find(h => h.id === heroId);
  if (contentHero) {
    return {
      family:        null,
      role:          contentHero.role ?? null,
      rarity:        null,
      rarityLabel:   contentHero.rarity === 5 ? 'Legendary' : contentHero.rarity === 4 ? 'Epic' : 'Rare',
      element:       contentHero.element ?? null,
      familyColor:   DEFAULT_COLOR,
      fallbackInitial: contentHero.name[0] ?? '?',
      isPrologue:    PROLOGUE_IDS.has(heroId),
      isLocked:      LOCKED_IDS.has(heroId),
    };
  }

  // Prologue special heroes not in either roster.
  if (PROLOGUE_IDS.has(heroId)) {
    const name = heroName ?? heroId;
    return {
      family:        null,
      role:          null,
      rarity:        null,
      rarityLabel:   'Prologue',
      element:       null,
      familyColor:   '#C792EA',
      fallbackInitial: name[0]?.toUpperCase() ?? '?',
      isPrologue:    true,
      isLocked:      false,
    };
  }

  // Unknown hero — provide safe defaults.
  const name = heroName ?? heroId;
  return {
    family:        null,
    role:          null,
    rarity:        null,
    rarityLabel:   'Unknown',
    element:       null,
    familyColor:   DEFAULT_COLOR,
    fallbackInitial: name[0]?.toUpperCase() ?? '?',
    isPrologue:    false,
    isLocked:      false,
  };
}

// ── Main public API ──────────────────────────────────────────────────────────

export interface HeroVisuals extends HeroVisualMeta {
  portraitAsset:     ImageSourcePropType | null;
  battleSpriteAsset: any | null;
  hasPortrait:       boolean;
  hasBattleSprite:   boolean;
}

/**
 * Resolve all visual data for a hero by ID.
 *
 * @param heroId   - The hero's canonical ID (must match HeroSprites / HeroBattleSprites keys).
 * @param heroName - Optional display name used only for the fallback initial when metadata lookup fails.
 */
export function getHeroVisuals(heroId: string, heroName?: string): HeroVisuals {
  const portraitAsset     = getHeroSprite(heroId) ?? null;
  const battleSpriteAsset = getHeroBattleSprite(heroId);
  const hasPortrait       = hasHeroSprite(heroId);
  const hasBattleSprite   = battleSpriteAsset !== null;
  const meta              = resolveMeta(heroId, heroName);

  if (__DEV__) {
    if (!hasPortrait)     console.warn(`[HeroVisuals] Missing portrait for hero: "${heroId}"`);
    if (!hasBattleSprite) console.warn(`[HeroVisuals] Missing battle sprite for hero: "${heroId}"`);
  }

  return {
    ...meta,
    portraitAsset,
    battleSpriteAsset,
    hasPortrait,
    hasBattleSprite,
  };
}
