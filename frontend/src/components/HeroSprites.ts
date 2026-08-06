// Static require map for hero portraits — RN cannot resolve dynamic `require()`.
// Add new heroes here when art is generated.

import type { ImageSourcePropType } from 'react-native';

const SPRITES: Record<string, ImageSourcePropType> = {
  // ── Existing epic/prologue heroes ──
  novice_guardian: require('../../assets/heroes/portraits/novice_guardian.png'),
  night_watcher: require('../../assets/heroes/portraits/night_watcher.png'),
  apprentice_seer: require('../../assets/heroes/portraits/apprentice_seer.png'),
  junior_warden: require('../../assets/heroes/portraits/junior_warden.png'),
  data_acolyte: require('../../assets/heroes/portraits/data_acolyte.png'),
  village_caretaker: require('../../assets/heroes/portraits/village_caretaker.png'),
  storm_runner: require('../../assets/heroes/portraits/storm_runner.png'),
  infection_warden: require('../../assets/heroes/portraits/infection_warden.png'),
  wound_sage: require('../../assets/heroes/portraits/wound_sage.png'),
  mindkeeper: require('../../assets/heroes/portraits/mindkeeper.png'),

  // ── WARDBORN commons ──
  wardlight_apprentice: require('../../assets/heroes/portraits/wardlight_apprentice.png'),
  gentle_hands_aide: require('../../assets/heroes/portraits/gentle_hands_aide.png'),
  safety_watch_initiate: require('../../assets/heroes/portraits/safety_watch_initiate.png'),
  care_chain_initiate: require('../../assets/heroes/portraits/care_chain_initiate.png'),
  comfort_scribe: require('../../assets/heroes/portraits/comfort_scribe.png'),
  record_keeper_initiate: require('../../assets/heroes/portraits/record_keeper_initiate.png'),

  // ── WARDBORN uncommons ──
  bedside_guardian: require('../../assets/heroes/portraits/bedside_guardian.png'),
  triage_lantern: require('../../assets/heroes/portraits/triage_lantern.png'),
  mindward_listener: require('../../assets/heroes/portraits/mindward_listener.png'),
  infection_watcher: require('../../assets/heroes/portraits/infection_watcher.png'),
  quality_sealbearer: require('../../assets/heroes/portraits/quality_sealbearer.png'),

  // ── WARDBORN rares ──
  night_ward_sentinel: require('../../assets/heroes/portraits/night_ward_sentinel.png'),
  crisis_calm_keeper: require('../../assets/heroes/portraits/crisis_calm_keeper.png'),
  safety_auditor: require('../../assets/heroes/portraits/safety_auditor.png'),

  // ── LIFEBREATH commons ──
  breath_aide: require('../../assets/heroes/portraits/breath_aide.png'),
  airway_apprentice: require('../../assets/heroes/portraits/airway_apprentice.png'),
  pulsewind_initiate: require('../../assets/heroes/portraits/pulsewind_initiate.png'),
  nebula_trainee: require('../../assets/heroes/portraits/nebula_trainee.png'),
  vapor_aide: require('../../assets/heroes/portraits/vapor_aide.png'),
  cascade_aide: require('../../assets/heroes/portraits/cascade_aide.png'),

  // ── LIFEBREATH uncommons ──
  breath_lantern: require('../../assets/heroes/portraits/breath_lantern.png'),
  emergency_airway_warden: require('../../assets/heroes/portraits/emergency_airway_warden.png'),
  pulmonary_guide: require('../../assets/heroes/portraits/pulmonary_guide.png'),
  sleepwind_keeper: require('../../assets/heroes/portraits/sleepwind_keeper.png'),
  icu_breathkeeper: require('../../assets/heroes/portraits/icu_breathkeeper.png'),

  // ── LIFEBREATH rares ──
  breathstride_therapist: require('../../assets/heroes/portraits/breathstride_therapist.png'),
  airway_warden: require('../../assets/heroes/portraits/airway_warden.png'),
  night_breath_warden: require('../../assets/heroes/portraits/night_breath_warden.png'),

  // ── TRUTHSEER commons ──
  anatomy_scribe: require('../../assets/heroes/portraits/anatomy_scribe.png'),
  whitecoat_initiate: require('../../assets/heroes/portraits/whitecoat_initiate.png'),
  image_apprentice: require('../../assets/heroes/portraits/image_apprentice.png'),
  sample_runner: require('../../assets/heroes/portraits/sample_runner.png'),
  vial_keeper: require('../../assets/heroes/portraits/vial_keeper.png'),
  pathlight_initiate: require('../../assets/heroes/portraits/pathlight_initiate.png'),

  // ── TRUTHSEER uncommons ──
  resident_of_dawn: require('../../assets/heroes/portraits/resident_of_dawn.png'),
  codefire_physician: require('../../assets/heroes/portraits/codefire_physician.png'),
  radiant_lens: require('../../assets/heroes/portraits/radiant_lens.png'),
  lablight_technologist: require('../../assets/heroes/portraits/lablight_technologist.png'),
  hematology_threader: require('../../assets/heroes/portraits/hematology_threader.png'),

  // ── TRUTHSEER rares ──
  wardround_doctor: require('../../assets/heroes/portraits/wardround_doctor.png'),
  spiral_ct_seer: require('../../assets/heroes/portraits/spiral_ct_seer.png'),
  microbe_seer: require('../../assets/heroes/portraits/microbe_seer.png'),

  // ── REMEDYBOUND commons ──
  shelfmark_apprentice: require('../../assets/heroes/portraits/shelfmark_apprentice.png'),
  dose_scribe: require('../../assets/heroes/portraits/dose_scribe.png'),
  mortar_initiate: require('../../assets/heroes/portraits/mortar_initiate.png'),
  garden_apprentice: require('../../assets/heroes/portraits/garden_apprentice.png'),
  plate_initiate: require('../../assets/heroes/portraits/plate_initiate.png'),
  hydration_scribe: require('../../assets/heroes/portraits/hydration_scribe.png'),

  // ── REMEDYBOUND uncommons ──
  lotus_apothecary: require('../../assets/heroes/portraits/lotus_apothecary.png'),
  clinic_dosekeeper: require('../../assets/heroes/portraits/clinic_dosekeeper.png'),
  compound_hand: require('../../assets/heroes/portraits/compound_hand.png'),
  lotus_dietitian: require('../../assets/heroes/portraits/lotus_dietitian.png'),
  glucose_lantern: require('../../assets/heroes/portraits/glucose_lantern.png'),

  // ── REMEDYBOUND rares ──
  ward_pharmacist: require('../../assets/heroes/portraits/ward_pharmacist.png'),
  antidote_alchemist: require('../../assets/heroes/portraits/antidote_alchemist.png'),
  metabolic_garden_sage: require('../../assets/heroes/portraits/metabolic_garden_sage.png'),

  // ── RESTOREBOUND commons ──
  stepwise_aide: require('../../assets/heroes/portraits/stepwise_aide.png'),
  gait_apprentice: require('../../assets/heroes/portraits/gait_apprentice.png'),
  stretch_hand: require('../../assets/heroes/portraits/stretch_hand.png'),
  function_aide: require('../../assets/heroes/portraits/function_aide.png'),
  routine_keeper: require('../../assets/heroes/portraits/routine_keeper.png'),
  grip_apprentice: require('../../assets/heroes/portraits/grip_apprentice.png'),

  // ── RESTOREBOUND uncommons ──
  gait_lantern: require('../../assets/heroes/portraits/gait_lantern.png'),
  neurostep_seer: require('../../assets/heroes/portraits/neurostep_seer.png'),
  bonepath_guide: require('../../assets/heroes/portraits/bonepath_guide.png'),
  lifeweave_therapist: require('../../assets/heroes/portraits/lifeweave_therapist.png'),
  mindroutine_keeper: require('../../assets/heroes/portraits/mindroutine_keeper.png'),

  // ── RESTOREBOUND rares ──
  acute_step_warden: require('../../assets/heroes/portraits/acute_step_warden.png'),
  iron_tendon_adept: require('../../assets/heroes/portraits/iron_tendon_adept.png'),
  cognitive_rehab_specialist: require('../../assets/heroes/portraits/cognitive_rehab_specialist.png'),

  // ── REALMBOUND commons ──
  village_health_aide: require('../../assets/heroes/portraits/village_health_aide.png'),
  banner_scribe: require('../../assets/heroes/portraits/banner_scribe.png'),
  clean_water_runner: require('../../assets/heroes/portraits/clean_water_runner.png'),
  care_guide: require('../../assets/heroes/portraits/care_guide.png'),
  return_path_scribe: require('../../assets/heroes/portraits/return_path_scribe.png'),
  data_threader_initiate: require('../../assets/heroes/portraits/data_threader_initiate.png'),

  // ── REALMBOUND uncommons ──
  community_lantern: require('../../assets/heroes/portraits/community_lantern.png'),
  health_banner_guide: require('../../assets/heroes/portraits/health_banner_guide.png'),
  clean_water_sentinel: require('../../assets/heroes/portraits/clean_water_sentinel.png'),
  resource_lantern: require('../../assets/heroes/portraits/resource_lantern.png'),
  discharge_planner: require('../../assets/heroes/portraits/discharge_planner.png'),

  // ── REALMBOUND rares ──
  pattern_seer: require('../../assets/heroes/portraits/pattern_seer.png'),
  environmental_seal_warden: require('../../assets/heroes/portraits/environmental_seal_warden.png'),
  chartweave_analyst: require('../../assets/heroes/portraits/chartweave_analyst.png'),
  florence_nightingale: require('../../assets/images/nightingale_vn_bust.png'),

  // Prologue loaner heroes — tutorial + boss battles
  prologue_nightingale:  require('../../assets/images/nightingale_vn_bust.png'),
  prologue_fleming:      require('../../assets/images/fleming_vn_bust.png'),
  // The Prodigy — Former Self at peak legendary power (prologue pre-recall only)
  prologue_the_prodigy:  require('../../assets/images/prodigy_battle_sprite.png'),
  the_prodigy:           require('../../assets/images/prodigy_battle_sprite.png'),

  // The Prodigy — former self portrait card (dedicated loadout portrait)
  prologue_former_self:  require('../../assets/images/prodigy_vn_bust.png'),
  former_self:           require('../../assets/images/prodigy_vn_bust.png'),
};

// All portrait modules, for cache preloading at game start.
export const HERO_SPRITE_MODULES = Object.values(SPRITES);

export function getHeroSprite(heroId: string): ImageSourcePropType | undefined {
  return SPRITES[heroId];
}

export function hasHeroSprite(heroId: string): boolean {
  return heroId in SPRITES;
}
