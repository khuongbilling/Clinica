// Static require map for enemy (Disease Corruption) portraits.
// Add new enemies here when art is generated.

import type { ImageSourcePropType } from 'react-native';

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
};

export function getEnemySprite(enemyId: string): ImageSourcePropType | undefined {
  return SPRITES[enemyId];
}

export function hasEnemySprite(enemyId: string): boolean {
  return enemyId in SPRITES;
}
