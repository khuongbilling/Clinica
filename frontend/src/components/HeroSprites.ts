// Static require map for hero portraits — RN cannot resolve dynamic `require()`.
// Add new heroes here when art is generated.

import type { ImageSourcePropType } from 'react-native';

const SPRITES: Record<string, ImageSourcePropType> = {
  novice_guardian: require('../../assets/heroes/novice_guardian.png'),
  night_watcher: require('../../assets/heroes/night_watcher.png'),
  apprentice_seer: require('../../assets/heroes/apprentice_seer.png'),
  junior_warden: require('../../assets/heroes/junior_warden.png'),
  data_acolyte: require('../../assets/heroes/data_acolyte.png'),
  village_caretaker: require('../../assets/heroes/village_caretaker.png'),
  storm_runner: require('../../assets/heroes/storm_runner.png'),
  infection_warden: require('../../assets/heroes/infection_warden.png'),
  wound_sage: require('../../assets/heroes/wound_sage.png'),
  mindkeeper: require('../../assets/heroes/mindkeeper.png'),
};

export function getHeroSprite(heroId: string): ImageSourcePropType | undefined {
  return SPRITES[heroId];
}

export function hasHeroSprite(heroId: string): boolean {
  return heroId in SPRITES;
}
