/**
 * Role-based hero attack-pose sprites.
 *
 * One attack-action PNG per ClassFamily, shown when a hero fires an action
 * during the lunge animation window.  Keyed by ClassFamily so any hero from
 * that family shares the same dynamic attack frame — individual per-hero art
 * is out of scope for this pass.
 */

import type { ClassFamily } from '@/src/game/types';

const ATTACK_SPRITES: Partial<Record<ClassFamily, any>> = {
  Wardborn:     require('../../assets/heroes/battle/attack/role_wardborn_atk.png'),
  Lifebreath:   require('../../assets/heroes/battle/attack/role_lifebreath_atk.png'),
  Truthseer:    require('../../assets/heroes/battle/attack/role_truthseer_atk.png'),
  Remedybound:  require('../../assets/heroes/battle/attack/role_remedybound_atk.png'),
  Restorebound: require('../../assets/heroes/battle/attack/role_restorebound_atk.png'),
  Realmbound:   require('../../assets/heroes/battle/attack/role_realmbound_atk.png'),
};

// All attack-sprite modules, for cache preloading alongside HERO_BATTLE_SPRITE_MODULES.
export const HERO_ATTACK_SPRITE_MODULES = Object.values(ATTACK_SPRITES).filter(Boolean);

/**
 * Return the attack-pose asset for a hero's ClassFamily, or null if the family
 * is unknown (prologue heroes, legacy originals, etc.).
 */
export function getHeroAttackSprite(family: ClassFamily | null | undefined): any | null {
  if (!family) return null;
  return ATTACK_SPRITES[family] ?? null;
}
