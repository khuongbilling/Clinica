/**
 * Hero attack-pose sprites.
 *
 * Per-hero overrides take priority; the ClassFamily sprite is the fallback for
 * any hero without a bespoke attack frame.  New rare/epic hero art goes in
 * HERO_ATTACK_SPRITE_OVERRIDES keyed by hero ID.
 */

import type { ClassFamily } from '@/src/game/types';

// ── Per-hero bespoke attack sprites (rare / epic heroes) ──────────────────────
const HERO_ATTACK_SPRITE_OVERRIDES: Record<string, any> = {
  airway_warden:     require('../../assets/heroes/battle/attack/airway_warden_atk.png'),
  microbe_seer:      require('../../assets/heroes/battle/attack/microbe_seer_atk.png'),
  ward_pharmacist:   require('../../assets/heroes/battle/attack/ward_pharmacist_atk.png'),
  iron_tendon_adept: require('../../assets/heroes/battle/attack/iron_tendon_adept_atk.png'),
};

// ── Per-family fallback sprites ───────────────────────────────────────────────
const FAMILY_ATTACK_SPRITES: Partial<Record<ClassFamily, any>> = {
  Wardborn:     require('../../assets/heroes/battle/attack/role_wardborn_atk.png'),
  Lifebreath:   require('../../assets/heroes/battle/attack/role_lifebreath_atk.png'),
  Truthseer:    require('../../assets/heroes/battle/attack/role_truthseer_atk.png'),
  Remedybound:  require('../../assets/heroes/battle/attack/role_remedybound_atk.png'),
  Restorebound: require('../../assets/heroes/battle/attack/role_restorebound_atk.png'),
  Realmbound:   require('../../assets/heroes/battle/attack/role_realmbound_atk.png'),
};

// All attack-sprite modules, for cache preloading alongside HERO_BATTLE_SPRITE_MODULES.
export const HERO_ATTACK_SPRITE_MODULES = [
  ...Object.values(HERO_ATTACK_SPRITE_OVERRIDES),
  ...Object.values(FAMILY_ATTACK_SPRITES),
].filter(Boolean);

/**
 * Return the attack-pose asset for a hero.
 *
 * Checks hero-ID-specific overrides first, then falls back to the family
 * sprite, then null (prologue heroes, legacy originals, unknown families).
 */
export function getHeroAttackSprite(
  family: ClassFamily | null | undefined,
  heroId?: string | null,
): any | null {
  if (heroId && HERO_ATTACK_SPRITE_OVERRIDES[heroId]) {
    return HERO_ATTACK_SPRITE_OVERRIDES[heroId];
  }
  if (!family) return null;
  return FAMILY_ATTACK_SPRITES[family] ?? null;
}
