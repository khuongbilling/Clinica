const BATTLE_SPRITES: Record<string, any> = {
  novice_guardian: require('../../assets/heroes/battle/novice_guardian.png'),
  night_watcher: require('../../assets/heroes/battle/night_watcher.png'),
  apprentice_seer: require('../../assets/heroes/battle/apprentice_seer.png'),
  junior_warden: require('../../assets/heroes/battle/junior_warden.png'),
  data_acolyte: require('../../assets/heroes/battle/data_acolyte.png'),
  village_caretaker: require('../../assets/heroes/battle/village_caretaker.png'),
  storm_runner: require('../../assets/heroes/battle/storm_runner.png'),
  infection_warden: require('../../assets/heroes/battle/infection_warden.png'),
  wound_sage: require('../../assets/heroes/battle/wound_sage.png'),
  mindkeeper: require('../../assets/heroes/battle/mindkeeper.png'),
};

// All battle-sprite modules, for cache preloading at game start.
export const HERO_BATTLE_SPRITE_MODULES = Object.values(BATTLE_SPRITES);

export function getHeroBattleSprite(heroId: string): any | null {
  return BATTLE_SPRITES[heroId] ?? null;
}
