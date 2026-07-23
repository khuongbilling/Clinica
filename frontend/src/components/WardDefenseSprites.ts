// Dedicated chibi/donghua sprite set for the 10 Ward Defense units.
// Generated to match the full-body transparent-bg cel-shaded style used
// across the rest of the game. Kept separate from HeroBattleSprites so
// the WD board can swap art without touching the main hero roster.
const WD_SPRITES: Record<string, any> = {
  ward_scout:      require('../../assets/heroes/battle/wd/ward_scout_wd.png'),
  reassess_sage:   require('../../assets/heroes/battle/wd/reassess_sage_wd.png'),
  mist_caster:     require('../../assets/heroes/battle/wd/mist_caster_wd.png'),
  herbal_chemist:  require('../../assets/heroes/battle/wd/herbal_chemist_wd.png'),
  o2_healer:       require('../../assets/heroes/battle/wd/o2_healer_wd.png'),
  guardian:        require('../../assets/heroes/battle/wd/guardian_wd.png'),
  rhythm_medic:    require('../../assets/heroes/battle/wd/rhythm_medic_wd.png'),
  lantern_scribe:  require('../../assets/heroes/battle/wd/lantern_scribe_wd.png'),
  fever_warden:    require('../../assets/heroes/battle/wd/fever_warden_wd.png'),
  airway_sentinel: require('../../assets/heroes/battle/wd/airway_sentinel_wd.png'),
};

export const WD_SPRITE_MODULES = Object.values(WD_SPRITES);

export function getWardDefenseSprite(unitId: string): any | null {
  return WD_SPRITES[unitId] ?? null;
}
