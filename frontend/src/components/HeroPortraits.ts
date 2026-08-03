/**
 * Hero portrait sprite map — bust / half-body portraits for collection cards,
 * gacha reveal modals, and hero detail screens.
 *
 * One portrait per hero in frontend/assets/heroes/portraits/.
 * Art style: donghua / manhwa anime (Genshin-Impact cel shading, soft linework,
 * luminous colors) — consistent with the overall game visual direction.
 *
 * Wire ALL portrait display through getHeroPortrait() below, not at individual
 * call sites, so swapping art is a single-file change.
 */

import type { ImageSourcePropType } from 'react-native';

// ── Portrait asset map (static require — RN cannot resolve dynamic paths) ────

const PORTRAITS: Record<string, ImageSourcePropType> = {

  // ── Original content heroes ──────────────────────────────────────────────
  novice_guardian:         require('../../assets/heroes/portraits/novice_guardian.png'),
  night_watcher:           require('../../assets/heroes/portraits/night_watcher.png'),
  apprentice_seer:         require('../../assets/heroes/portraits/apprentice_seer.png'),
  junior_warden:           require('../../assets/heroes/portraits/junior_warden.png'),
  data_acolyte:            require('../../assets/heroes/portraits/data_acolyte.png'),
  village_caretaker:       require('../../assets/heroes/portraits/village_caretaker.png'),
  storm_runner:            require('../../assets/heroes/portraits/storm_runner.png'),
  infection_warden:        require('../../assets/heroes/portraits/infection_warden.png'),
  wound_sage:              require('../../assets/heroes/portraits/wound_sage.png'),
  mindkeeper:              require('../../assets/heroes/portraits/mindkeeper.png'),

  // ── Prologue / legendary heroes ─────────────────────────────────────────
  florence_nightingale:    require('../../assets/images/nightingale_vn_extended.png'),
  prologue_nightingale:    require('../../assets/images/nightingale_vn_extended.png'),
  the_prodigy:             require('../../assets/images/prodigy_vn_extended.png'),
  prologue_the_prodigy:    require('../../assets/images/prodigy_vn_extended.png'),
  prologue_former_self:    require('../../assets/images/prodigy_vn_extended.png'),
  former_self:             require('../../assets/images/prodigy_vn_extended.png'),

  // ── WARDBORN commons ─────────────────────────────────────────────────────
  wardlight_apprentice:    require('../../assets/heroes/portraits/wardlight_apprentice.png'),
  gentle_hands_aide:       require('../../assets/heroes/portraits/gentle_hands_aide.png'),
  safety_watch_initiate:   require('../../assets/heroes/portraits/safety_watch_initiate.png'),
  care_chain_initiate:     require('../../assets/heroes/portraits/care_chain_initiate.png'),
  comfort_scribe:          require('../../assets/heroes/portraits/comfort_scribe.png'),
  record_keeper_initiate:  require('../../assets/heroes/portraits/record_keeper_initiate.png'),

  // ── WARDBORN uncommons ───────────────────────────────────────────────────
  bedside_guardian:        require('../../assets/heroes/portraits/bedside_guardian.png'),
  triage_lantern:          require('../../assets/heroes/portraits/triage_lantern.png'),
  mindward_listener:       require('../../assets/heroes/portraits/mindward_listener.png'),
  infection_watcher:       require('../../assets/heroes/portraits/infection_watcher.png'),
  quality_sealbearer:      require('../../assets/heroes/portraits/quality_sealbearer.png'),

  // ── WARDBORN rares ───────────────────────────────────────────────────────
  night_ward_sentinel:     require('../../assets/heroes/portraits/night_ward_sentinel.png'),
  crisis_calm_keeper:      require('../../assets/heroes/portraits/crisis_calm_keeper.png'),
  safety_auditor:          require('../../assets/heroes/portraits/safety_auditor.png'),
  clean_hands_sentinel:    require('../../assets/heroes/portraits/clean_hands_sentinel.png'),

  // ── WARDBORN epics ───────────────────────────────────────────────────────
  lotus_care_captain:      require('../../assets/heroes/portraits/lotus_care_captain.png'),
  code_guardian:           require('../../assets/heroes/portraits/code_guardian.png'),
  mind_lotus_healer:       require('../../assets/heroes/portraits/mind_lotus_healer.png'),
  patient_safety_arbiter:  require('../../assets/heroes/portraits/patient_safety_arbiter.png'),

  // ── LIFEBREATH commons ───────────────────────────────────────────────────
  breath_aide:             require('../../assets/heroes/portraits/breath_aide.png'),
  airway_apprentice:       require('../../assets/heroes/portraits/airway_apprentice.png'),
  pulsewind_initiate:      require('../../assets/heroes/portraits/pulsewind_initiate.png'),
  nebula_trainee:          require('../../assets/heroes/portraits/nebula_trainee.png'),
  vapor_aide:              require('../../assets/heroes/portraits/vapor_aide.png'),
  cascade_aide:            require('../../assets/heroes/portraits/cascade_aide.png'),

  // ── LIFEBREATH uncommons ─────────────────────────────────────────────────
  breath_lantern:              require('../../assets/heroes/portraits/breath_lantern.png'),
  emergency_airway_warden:     require('../../assets/heroes/portraits/emergency_airway_warden.png'),
  pulmonary_guide:             require('../../assets/heroes/portraits/pulmonary_guide.png'),
  sleepwind_keeper:            require('../../assets/heroes/portraits/sleepwind_keeper.png'),
  icu_breathkeeper:            require('../../assets/heroes/portraits/icu_breathkeeper.png'),

  // ── LIFEBREATH rares ─────────────────────────────────────────────────────
  breathstride_therapist:  require('../../assets/heroes/portraits/breathstride_therapist.png'),
  airway_warden:           require('../../assets/heroes/portraits/airway_warden.png'),
  night_breath_warden:     require('../../assets/heroes/portraits/night_breath_warden.png'),

  // ── LIFEBREATH epics ─────────────────────────────────────────────────────
  ventilation_strategist:  require('../../assets/heroes/portraits/ventilation_strategist.png'),
  aerosol_guardian:        require('../../assets/heroes/portraits/aerosol_guardian.png'),

  // ── TRUTHSEER commons ────────────────────────────────────────────────────
  anatomy_scribe:          require('../../assets/heroes/portraits/anatomy_scribe.png'),
  whitecoat_initiate:      require('../../assets/heroes/portraits/whitecoat_initiate.png'),
  image_apprentice:        require('../../assets/heroes/portraits/image_apprentice.png'),
  sample_runner:           require('../../assets/heroes/portraits/sample_runner.png'),
  vial_keeper:             require('../../assets/heroes/portraits/vial_keeper.png'),
  pathlight_initiate:      require('../../assets/heroes/portraits/pathlight_initiate.png'),

  // ── TRUTHSEER uncommons ──────────────────────────────────────────────────
  resident_of_dawn:        require('../../assets/heroes/portraits/resident_of_dawn.png'),
  codefire_physician:      require('../../assets/heroes/portraits/codefire_physician.png'),
  radiant_lens:            require('../../assets/heroes/portraits/radiant_lens.png'),
  lablight_technologist:   require('../../assets/heroes/portraits/lablight_technologist.png'),
  hematology_threader:     require('../../assets/heroes/portraits/hematology_threader.png'),

  // ── TRUTHSEER rares ──────────────────────────────────────────────────────
  cellular_seer:           require('../../assets/heroes/portraits/cellular_seer.png'),
  wardround_doctor:        require('../../assets/heroes/portraits/wardround_doctor.png'),
  spiral_ct_seer:          require('../../assets/heroes/portraits/spiral_ct_seer.png'),
  microbe_seer:            require('../../assets/heroes/portraits/microbe_seer.png'),

  // ── TRUTHSEER epics ──────────────────────────────────────────────────────
  code_sage:               require('../../assets/heroes/portraits/code_sage.png'),
  pathology_oracle:        require('../../assets/heroes/portraits/pathology_oracle.png'),
  hearthline_attending:    require('../../assets/heroes/portraits/hearthline_attending.png'),
  trauma_image_oracle:     require('../../assets/heroes/portraits/trauma_image_oracle.png'),

  // ── REMEDYBOUND commons ──────────────────────────────────────────────────
  shelfmark_apprentice:    require('../../assets/heroes/portraits/shelfmark_apprentice.png'),
  dose_scribe:             require('../../assets/heroes/portraits/dose_scribe.png'),
  mortar_initiate:         require('../../assets/heroes/portraits/mortar_initiate.png'),
  garden_apprentice:       require('../../assets/heroes/portraits/garden_apprentice.png'),
  plate_initiate:          require('../../assets/heroes/portraits/plate_initiate.png'),
  hydration_scribe:        require('../../assets/heroes/portraits/hydration_scribe.png'),

  // ── REMEDYBOUND uncommons ────────────────────────────────────────────────
  lotus_apothecary:        require('../../assets/heroes/portraits/lotus_apothecary.png'),
  clinic_dosekeeper:       require('../../assets/heroes/portraits/clinic_dosekeeper.png'),
  compound_hand:           require('../../assets/heroes/portraits/compound_hand.png'),
  lotus_dietitian:         require('../../assets/heroes/portraits/lotus_dietitian.png'),
  glucose_lantern:         require('../../assets/heroes/portraits/glucose_lantern.png'),

  // ── REMEDYBOUND rares ────────────────────────────────────────────────────
  ward_pharmacist:         require('../../assets/heroes/portraits/ward_pharmacist.png'),
  antidote_alchemist:      require('../../assets/heroes/portraits/antidote_alchemist.png'),
  metabolic_garden_sage:   require('../../assets/heroes/portraits/metabolic_garden_sage.png'),

  // ── REMEDYBOUND epics ────────────────────────────────────────────────────
  medication_safety_arbiter: require('../../assets/heroes/portraits/medication_safety_arbiter.png'),
  formula_strategist:        require('../../assets/heroes/portraits/formula_strategist.png'),
  vital_garden_sage:         require('../../assets/heroes/portraits/vital_garden_sage.png'),

  // ── RESTOREBOUND commons ─────────────────────────────────────────────────
  stepwise_aide:           require('../../assets/heroes/portraits/stepwise_aide.png'),
  gait_apprentice:         require('../../assets/heroes/portraits/gait_apprentice.png'),
  stretch_hand:            require('../../assets/heroes/portraits/stretch_hand.png'),
  function_aide:           require('../../assets/heroes/portraits/function_aide.png'),
  routine_keeper:          require('../../assets/heroes/portraits/routine_keeper.png'),
  grip_apprentice:         require('../../assets/heroes/portraits/grip_apprentice.png'),

  // ── RESTOREBOUND uncommons ───────────────────────────────────────────────
  gait_lantern:            require('../../assets/heroes/portraits/gait_lantern.png'),
  neurostep_seer:          require('../../assets/heroes/portraits/neurostep_seer.png'),
  bonepath_guide:          require('../../assets/heroes/portraits/bonepath_guide.png'),
  lifeweave_therapist:     require('../../assets/heroes/portraits/lifeweave_therapist.png'),
  mindroutine_keeper:      require('../../assets/heroes/portraits/mindroutine_keeper.png'),

  // ── RESTOREBOUND rares ───────────────────────────────────────────────────
  acute_step_warden:       require('../../assets/heroes/portraits/acute_step_warden.png'),
  iron_tendon_adept:       require('../../assets/heroes/portraits/iron_tendon_adept.png'),
  cognitive_rehab_specialist: require('../../assets/heroes/portraits/cognitive_rehab_specialist.png'),

  // ── RESTOREBOUND epics ───────────────────────────────────────────────────
  lifeweaver:              require('../../assets/heroes/portraits/lifeweaver.png'),
  mobility_commander:      require('../../assets/heroes/portraits/mobility_commander.png'),

  // ── REALMBOUND commons ───────────────────────────────────────────────────
  village_health_aide:     require('../../assets/heroes/portraits/village_health_aide.png'),
  banner_scribe:           require('../../assets/heroes/portraits/banner_scribe.png'),
  clean_water_runner:      require('../../assets/heroes/portraits/clean_water_runner.png'),
  care_guide:              require('../../assets/heroes/portraits/care_guide.png'),
  return_path_scribe:      require('../../assets/heroes/portraits/return_path_scribe.png'),
  data_threader_initiate:  require('../../assets/heroes/portraits/data_threader_initiate.png'),

  // ── REALMBOUND uncommons ─────────────────────────────────────────────────
  community_lantern:       require('../../assets/heroes/portraits/community_lantern.png'),
  health_banner_guide:     require('../../assets/heroes/portraits/health_banner_guide.png'),
  clean_water_sentinel:    require('../../assets/heroes/portraits/clean_water_sentinel.png'),
  resource_lantern:        require('../../assets/heroes/portraits/resource_lantern.png'),
  discharge_planner:       require('../../assets/heroes/portraits/discharge_planner.png'),

  // ── REALMBOUND rares ─────────────────────────────────────────────────────
  pattern_seer:            require('../../assets/heroes/portraits/pattern_seer.png'),
  environmental_seal_warden: require('../../assets/heroes/portraits/environmental_seal_warden.png'),
  chartweave_analyst:      require('../../assets/heroes/portraits/chartweave_analyst.png'),

  // ── REALMBOUND epics ─────────────────────────────────────────────────────
  outbreak_commander:      require('../../assets/heroes/portraits/outbreak_commander.png'),
  informatics_architect:   require('../../assets/heroes/portraits/informatics_architect.png'),
  clean_realm_commander:   require('../../assets/heroes/portraits/clean_realm_commander.png'),
};

// All portrait modules — expose for cache preloading at game start.
export const HERO_PORTRAIT_MODULES = Object.values(PORTRAITS);

/**
 * Resolve a hero's portrait asset by ID.
 * Returns undefined when no portrait exists (callers should render a fallback).
 */
export function getHeroPortrait(heroId: string): ImageSourcePropType | undefined {
  return PORTRAITS[heroId];
}

/** Returns true when a dedicated portrait exists for this hero. */
export function hasHeroPortrait(heroId: string): boolean {
  return heroId in PORTRAITS;
}
