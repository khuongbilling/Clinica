const BATTLE_SPRITES: Record<string, any> = {
  // ── Existing epic/prologue heroes ──
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

  // ── WARDBORN commons ──
  wardlight_apprentice: require('../../assets/heroes/battle/wardlight_apprentice.png'),
  gentle_hands_aide: require('../../assets/heroes/battle/gentle_hands_aide.png'),
  safety_watch_initiate: require('../../assets/heroes/battle/safety_watch_initiate.png'),
  care_chain_initiate: require('../../assets/heroes/battle/care_chain_initiate.png'),
  comfort_scribe: require('../../assets/heroes/battle/comfort_scribe.png'),
  record_keeper_initiate: require('../../assets/heroes/battle/record_keeper_initiate.png'),

  // ── WARDBORN uncommons ──
  bedside_guardian: require('../../assets/heroes/battle/bedside_guardian.png'),
  triage_lantern: require('../../assets/heroes/battle/triage_lantern.png'),
  mindward_listener: require('../../assets/heroes/battle/mindward_listener.png'),
  infection_watcher: require('../../assets/heroes/battle/infection_watcher.png'),
  quality_sealbearer: require('../../assets/heroes/battle/quality_sealbearer.png'),

  // ── WARDBORN rares ──
  night_ward_sentinel: require('../../assets/heroes/battle/night_ward_sentinel.png'),
  crisis_calm_keeper: require('../../assets/heroes/battle/crisis_calm_keeper.png'),
  safety_auditor: require('../../assets/heroes/battle/safety_auditor.png'),

  // ── LIFEBREATH commons ──
  breath_aide: require('../../assets/heroes/battle/breath_aide.png'),
  airway_apprentice: require('../../assets/heroes/battle/airway_apprentice.png'),
  pulsewind_initiate: require('../../assets/heroes/battle/pulsewind_initiate.png'),
  nebula_trainee: require('../../assets/heroes/battle/nebula_trainee.png'),
  vapor_aide: require('../../assets/heroes/battle/vapor_aide.png'),
  cascade_aide: require('../../assets/heroes/battle/cascade_aide.png'),

  // ── LIFEBREATH uncommons ──
  breath_lantern: require('../../assets/heroes/battle/breath_lantern.png'),
  emergency_airway_warden: require('../../assets/heroes/battle/emergency_airway_warden.png'),
  pulmonary_guide: require('../../assets/heroes/battle/pulmonary_guide.png'),
  sleepwind_keeper: require('../../assets/heroes/battle/sleepwind_keeper.png'),
  icu_breathkeeper: require('../../assets/heroes/battle/icu_breathkeeper.png'),

  // ── LIFEBREATH rares ──
  breathstride_therapist: require('../../assets/heroes/battle/breathstride_therapist.png'),
  airway_warden: require('../../assets/heroes/battle/airway_warden.png'),
  night_breath_warden: require('../../assets/heroes/battle/night_breath_warden.png'),

  // ── TRUTHSEER commons ──
  anatomy_scribe: require('../../assets/heroes/battle/anatomy_scribe.png'),
  whitecoat_initiate: require('../../assets/heroes/battle/whitecoat_initiate.png'),
  image_apprentice: require('../../assets/heroes/battle/image_apprentice.png'),
  sample_runner: require('../../assets/heroes/battle/sample_runner.png'),
  vial_keeper: require('../../assets/heroes/battle/vial_keeper.png'),
  pathlight_initiate: require('../../assets/heroes/battle/pathlight_initiate.png'),

  // ── TRUTHSEER uncommons ──
  resident_of_dawn: require('../../assets/heroes/battle/resident_of_dawn.png'),
  codefire_physician: require('../../assets/heroes/battle/codefire_physician.png'),
  radiant_lens: require('../../assets/heroes/battle/radiant_lens.png'),
  lablight_technologist: require('../../assets/heroes/battle/lablight_technologist.png'),
  hematology_threader: require('../../assets/heroes/battle/hematology_threader.png'),

  // ── TRUTHSEER rares ──
  wardround_doctor: require('../../assets/heroes/battle/wardround_doctor.png'),
  spiral_ct_seer: require('../../assets/heroes/battle/spiral_ct_seer.png'),
  microbe_seer: require('../../assets/heroes/battle/microbe_seer.png'),

  // ── REMEDYBOUND commons ──
  shelfmark_apprentice: require('../../assets/heroes/battle/shelfmark_apprentice.png'),
  dose_scribe: require('../../assets/heroes/battle/dose_scribe.png'),
  mortar_initiate: require('../../assets/heroes/battle/mortar_initiate.png'),
  garden_apprentice: require('../../assets/heroes/battle/garden_apprentice.png'),
  plate_initiate: require('../../assets/heroes/battle/plate_initiate.png'),
  hydration_scribe: require('../../assets/heroes/battle/hydration_scribe.png'),

  // ── REMEDYBOUND uncommons ──
  lotus_apothecary: require('../../assets/heroes/battle/lotus_apothecary.png'),
  clinic_dosekeeper: require('../../assets/heroes/battle/clinic_dosekeeper.png'),
  compound_hand: require('../../assets/heroes/battle/compound_hand.png'),
  lotus_dietitian: require('../../assets/heroes/battle/lotus_dietitian.png'),
  glucose_lantern: require('../../assets/heroes/battle/glucose_lantern.png'),

  // ── REMEDYBOUND rares ──
  ward_pharmacist: require('../../assets/heroes/battle/ward_pharmacist.png'),
  antidote_alchemist: require('../../assets/heroes/battle/antidote_alchemist.png'),
  metabolic_garden_sage: require('../../assets/heroes/battle/metabolic_garden_sage.png'),

  // ── RESTOREBOUND commons ──
  stepwise_aide: require('../../assets/heroes/battle/stepwise_aide.png'),
  gait_apprentice: require('../../assets/heroes/battle/gait_apprentice.png'),
  stretch_hand: require('../../assets/heroes/battle/stretch_hand.png'),
  function_aide: require('../../assets/heroes/battle/function_aide.png'),
  routine_keeper: require('../../assets/heroes/battle/routine_keeper.png'),
  grip_apprentice: require('../../assets/heroes/battle/grip_apprentice.png'),

  // ── RESTOREBOUND uncommons ──
  gait_lantern: require('../../assets/heroes/battle/gait_lantern.png'),
  neurostep_seer: require('../../assets/heroes/battle/neurostep_seer.png'),
  bonepath_guide: require('../../assets/heroes/battle/bonepath_guide.png'),
  lifeweave_therapist: require('../../assets/heroes/battle/lifeweave_therapist.png'),
  mindroutine_keeper: require('../../assets/heroes/battle/mindroutine_keeper.png'),

  // ── RESTOREBOUND rares ──
  acute_step_warden: require('../../assets/heroes/battle/acute_step_warden.png'),
  iron_tendon_adept: require('../../assets/heroes/battle/iron_tendon_adept.png'),
  cognitive_rehab_specialist: require('../../assets/heroes/battle/cognitive_rehab_specialist.png'),

  // ── REALMBOUND commons ──
  village_health_aide: require('../../assets/heroes/battle/village_health_aide.png'),
  banner_scribe: require('../../assets/heroes/battle/banner_scribe.png'),
  clean_water_runner: require('../../assets/heroes/battle/clean_water_runner.png'),
  care_guide: require('../../assets/heroes/battle/care_guide.png'),
  return_path_scribe: require('../../assets/heroes/battle/return_path_scribe.png'),
  data_threader_initiate: require('../../assets/heroes/battle/data_threader_initiate.png'),

  // ── REALMBOUND uncommons ──
  community_lantern: require('../../assets/heroes/battle/community_lantern.png'),
  health_banner_guide: require('../../assets/heroes/battle/health_banner_guide.png'),
  clean_water_sentinel: require('../../assets/heroes/battle/clean_water_sentinel.png'),
  resource_lantern: require('../../assets/heroes/battle/resource_lantern.png'),
  discharge_planner: require('../../assets/heroes/battle/discharge_planner.png'),

  // ── REALMBOUND rares ──
  pattern_seer: require('../../assets/heroes/battle/pattern_seer.png'),
  environmental_seal_warden: require('../../assets/heroes/battle/environmental_seal_warden.png'),
  chartweave_analyst: require('../../assets/heroes/battle/chartweave_analyst.png'),
  florence_nightingale: require('../../assets/heroes/battle/florence_nightingale.png'),

  // ── Prologue loaner heroes (tutorial + scripted-loss boss) ──
  prologue_nightingale:  require('../../assets/heroes/battle/prologue_nightingale.png'),
  prologue_fleming:      require('../../assets/heroes/battle/prologue_fleming.png'),
  prologue_the_prodigy:  require('../../assets/heroes/battle/the_prodigy.png'),

  // ── Former Self / The Prodigy (scripted prologue battle) ──
  former_self:           require('../../assets/heroes/battle/the_prodigy.png'),
  prologue_former_self:  require('../../assets/heroes/battle/the_prodigy.png'),
  the_prodigy:           require('../../assets/heroes/battle/the_prodigy.png'),
};

// All battle-sprite modules, for cache preloading at game start.
export const HERO_BATTLE_SPRITE_MODULES = Object.values(BATTLE_SPRITES);

export function getHeroBattleSprite(heroId: string): any | null {
  return BATTLE_SPRITES[heroId] ?? null;
}
