// Static require map for enemy (Disease Corruption) portraits.
// Add new enemies here when art is generated.

import type { ImageSourcePropType } from 'react-native';
import { allChapterEnemyRefs } from '../game/chapterContent';

const SPRITES: Record<string, ImageSourcePropType> = {
  air_sprite: require('../../assets/enemies/air_sprite.png'),
  river_sludge: require('../../assets/enemies/river_sludge.png'),
  energy_lock: require('../../assets/enemies/energy_lock.png'),
  fire_imp: require('../../assets/enemies/fire_imp.png'),
  septara_seed: require('../../assets/enemies/septara_seed.png'),
  cardion_echo: require('../../assets/enemies/cardion_echo.png'),
  glycora_spark: require('../../assets/enemies/glycora_spark.png'),
  pulmora_wisp: require('../../assets/enemies/pulmora_wisp.png'),
  electrox_flicker: require('../../assets/enemies/electrox_flicker.png'),
  mind_fog: require('../../assets/enemies/mind_fog.png'),
  lord_imbalance: require('../../assets/enemies/lord_imbalance.png'),
  dehydration_wisp: require('../../assets/enemies/dehydration_wisp.png'),
  fluid_phantom: require('../../assets/enemies/fluid_phantom.png'),
  dehydration_specter: require('../../assets/enemies/dehydration_specter.png'),
  silent_infarct: require('../../assets/enemies/silent_infarct.png'),
  verdantha: require('../../assets/enemies/verdantha.png'),
  fever_shade: require('../../assets/enemies/fever_shade.png'),
  gale_spirit: require('../../assets/enemies/gale_spirit.png'),
  ward_cascade: require('../../assets/enemies/ward_cascade.png'),
  // Ch6–8 trial mini-bosses — dedicated battle sprites.
  imbalance_core: require('../../assets/enemies/imbalance_core.png'),
  contagion_wraith: require('../../assets/enemies/contagion_wraith.png'),
  crisis_convergence: require('../../assets/enemies/crisis_convergence.png'),
};

/**
 * Every package alias has an intentional source family.  Keeping this mapping
 * adjacent to Metro's static require table avoids accidental runtime fallback
 * art while allowing a recolour/name/FX variant to share the approved sprite.
 */
export const ENEMY_REUSABLE_ART_SOURCE: Record<string, string> = {};
for (const entry of allChapterEnemyRefs()) {
  if (entry.id !== entry.artSourceId) {
    ENEMY_REUSABLE_ART_SOURCE[entry.id] = entry.artSourceId;
    const source = SPRITES[entry.artSourceId];
    if (!source) throw new Error(`[EnemySprites] missing approved art source '${entry.artSourceId}' for '${entry.id}'`);
    SPRITES[entry.id] = source;
  }
}

// All enemy portrait modules, for cache preloading at game start.
export const ENEMY_SPRITE_MODULES = Object.values(SPRITES);

export function getEnemySprite(enemyId: string): ImageSourcePropType | undefined {
  return SPRITES[enemyId];
}

export function hasEnemySprite(enemyId: string): boolean {
  return enemyId in SPRITES;
}

export function getEnemySpriteArtSource(enemyId: string): string | undefined {
  return ENEMY_REUSABLE_ART_SOURCE[enemyId] ?? (hasEnemySprite(enemyId) ? enemyId : undefined);
}
