// Static require map for hero portraits — RN cannot resolve dynamic `require()`.
// Add new heroes here when art is generated.

import type { ImageSourcePropType } from 'react-native';

const SPRITES: Record<string, ImageSourcePropType> = {
  // ── Existing epic/prologue heroes ──
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

  // ── WARDBORN commons ──
  wardlight_apprentice: require('../../assets/heroes/wardlight_apprentice.png'),
  gentle_hands_aide: require('../../assets/heroes/gentle_hands_aide.png'),
  safety_watch_initiate: require('../../assets/heroes/safety_watch_initiate.png'),
  care_chain_initiate: require('../../assets/heroes/care_chain_initiate.png'),
  comfort_scribe: require('../../assets/heroes/comfort_scribe.png'),
  record_keeper_initiate: require('../../assets/heroes/record_keeper_initiate.png'),

  // ── WARDBORN uncommons ──
  bedside_guardian: require('../../assets/heroes/bedside_guardian.png'),
  triage_lantern: require('../../assets/heroes/triage_lantern.png'),
  mindward_listener: require('../../assets/heroes/mindward_listener.png'),
  infection_watcher: require('../../assets/heroes/infection_watcher.png'),
  quality_sealbearer: require('../../assets/heroes/quality_sealbearer.png'),

  // ── WARDBORN rares ──
  night_ward_sentinel: require('../../assets/heroes/night_ward_sentinel.png'),
  crisis_calm_keeper: require('../../assets/heroes/crisis_calm_keeper.png'),
  safety_auditor: require('../../assets/heroes/safety_auditor.png'),

  // ── LIFEBREATH commons ──
  breath_aide: require('../../assets/heroes/breath_aide.png'),
  airway_apprentice: require('../../assets/heroes/airway_apprentice.png'),
  pulsewind_initiate: require('../../assets/heroes/pulsewind_initiate.png'),
  nebula_trainee: require('../../assets/heroes/nebula_trainee.png'),
  vapor_aide: require('../../assets/heroes/vapor_aide.png'),
  cascade_aide: require('../../assets/heroes/cascade_aide.png'),

  // ── LIFEBREATH uncommons ──
  breath_lantern: require('../../assets/heroes/breath_lantern.png'),
  emergency_airway_warden: require('../../assets/heroes/emergency_airway_warden.png'),
  pulmonary_guide: require('../../assets/heroes/pulmonary_guide.png'),
  sleepwind_keeper: require('../../assets/heroes/sleepwind_keeper.png'),
  icu_breathkeeper: require('../../assets/heroes/icu_breathkeeper.png'),

  // ── LIFEBREATH rares ──
  breathstride_therapist: require('../../assets/heroes/breathstride_therapist.png'),
  airway_warden: require('../../assets/heroes/airway_warden.png'),
  night_breath_warden: require('../../assets/heroes/night_breath_warden.png'),

  // ── TRUTHSEER commons ──
  anatomy_scribe: require('../../assets/heroes/anatomy_scribe.png'),
  whitecoat_initiate: require('../../assets/heroes/whitecoat_initiate.png'),
  image_apprentice: require('../../assets/heroes/image_apprentice.png'),
  sample_runner: require('../../assets/heroes/sample_runner.png'),
  vial_keeper: require('../../assets/heroes/vial_keeper.png'),
  pathlight_initiate: require('../../assets/heroes/pathlight_initiate.png'),

  // ── TRUTHSEER uncommons ──
  resident_of_dawn: require('../../assets/heroes/resident_of_dawn.png'),
  codefire_physician: require('../../assets/heroes/codefire_physician.png'),
  radiant_lens: require('../../assets/heroes/radiant_lens.png'),
  lablight_technologist: require('../../assets/heroes/lablight_technologist.png'),
  hematology_threader: require('../../assets/heroes/hematology_threader.png'),

  // ── TRUTHSEER rares ──
  wardround_doctor: require('../../assets/heroes/wardround_doctor.png'),
  spiral_ct_seer: require('../../assets/heroes/spiral_ct_seer.png'),
  microbe_seer: require('../../assets/heroes/microbe_seer.png'),

  // ── REMEDYBOUND commons ──
  shelfmark_apprentice: require('../../assets/heroes/shelfmark_apprentice.png'),
  dose_scribe: require('../../assets/heroes/dose_scribe.png'),
  mortar_initiate: require('../../assets/heroes/mortar_initiate.png'),
  garden_apprentice: require('../../assets/heroes/garden_apprentice.png'),
  plate_initiate: require('../../assets/heroes/plate_initiate.png'),
  hydration_scribe: require('../../assets/heroes/hydration_scribe.png'),

  // ── REMEDYBOUND uncommons ──
  lotus_apothecary: require('../../assets/heroes/lotus_apothecary.png'),
  clinic_dosekeeper: require('../../assets/heroes/clinic_dosekeeper.png'),
  compound_hand: require('../../assets/heroes/compound_hand.png'),
  lotus_dietitian: require('../../assets/heroes/lotus_dietitian.png'),
  glucose_lantern: require('../../assets/heroes/glucose_lantern.png'),

  // ── REMEDYBOUND rares ──
  ward_pharmacist: require('../../assets/heroes/ward_pharmacist.png'),
  antidote_alchemist: require('../../assets/heroes/antidote_alchemist.png'),
  metabolic_garden_sage: require('../../assets/heroes/metabolic_garden_sage.png'),

  // ── RESTOREBOUND commons ──
  stepwise_aide: require('../../assets/heroes/stepwise_aide.png'),
  gait_apprentice: require('../../assets/heroes/gait_apprentice.png'),
  stretch_hand: require('../../assets/heroes/stretch_hand.png'),
  function_aide: require('../../assets/heroes/function_aide.png'),
  routine_keeper: require('../../assets/heroes/routine_keeper.png'),
  grip_apprentice: require('../../assets/heroes/grip_apprentice.png'),

  // ── RESTOREBOUND uncommons ──
  gait_lantern: require('../../assets/heroes/gait_lantern.png'),
  neurostep_seer: require('../../assets/heroes/neurostep_seer.png'),
  bonepath_guide: require('../../assets/heroes/bonepath_guide.png'),
  lifeweave_therapist: require('../../assets/heroes/lifeweave_therapist.png'),
  mindroutine_keeper: require('../../assets/heroes/mindroutine_keeper.png'),

  // ── RESTOREBOUND rares ──
  acute_step_warden: require('../../assets/heroes/acute_step_warden.png'),
  iron_tendon_adept: require('../../assets/heroes/iron_tendon_adept.png'),
  cognitive_rehab_specialist: require('../../assets/heroes/cognitive_rehab_specialist.png'),

  // ── REALMBOUND commons ──
  village_health_aide: require('../../assets/heroes/village_health_aide.png'),
  banner_scribe: require('../../assets/heroes/banner_scribe.png'),
  clean_water_runner: require('../../assets/heroes/clean_water_runner.png'),
  care_guide: require('../../assets/heroes/care_guide.png'),
  return_path_scribe: require('../../assets/heroes/return_path_scribe.png'),
  data_threader_initiate: require('../../assets/heroes/data_threader_initiate.png'),

  // ── REALMBOUND uncommons ──
  community_lantern: require('../../assets/heroes/community_lantern.png'),
  health_banner_guide: require('../../assets/heroes/health_banner_guide.png'),
  clean_water_sentinel: require('../../assets/heroes/clean_water_sentinel.png'),
  resource_lantern: require('../../assets/heroes/resource_lantern.png'),
  discharge_planner: require('../../assets/heroes/discharge_planner.png'),

  // ── REALMBOUND rares ──
  pattern_seer: require('../../assets/heroes/pattern_seer.png'),
  environmental_seal_warden: require('../../assets/heroes/environmental_seal_warden.png'),
  chartweave_analyst: require('../../assets/heroes/chartweave_analyst.png'),
  florence_nightingale: require('../../assets/heroes/florence_nightingale.png'),

  // Prologue loaner heroes — tutorial + boss battles
  prologue_nightingale:  require('../../assets/heroes/florence_nightingale.png'),
  prologue_fleming:      require('../../assets/images/fleming_portrait.png'),
  // The Prodigy — Former Self at peak legendary power (prologue pre-recall only)
  prologue_the_prodigy:  require('../../assets/heroes/battle/the_prodigy.png'),
  the_prodigy:           require('../../assets/heroes/battle/the_prodigy.png'),

  // The Prodigy — former self portrait card (dedicated loadout portrait)
  prologue_former_self:  require('../../assets/images/the_prodigy_portrait.png'),
  former_self:           require('../../assets/images/the_prodigy_portrait.png'),
};

// All portrait modules, for cache preloading at game start.
export const HERO_SPRITE_MODULES = Object.values(SPRITES);

export function getHeroSprite(heroId: string): ImageSourcePropType | undefined {
  return SPRITES[heroId];
}

export function hasHeroSprite(heroId: string): boolean {
  return heroId in SPRITES;
}
