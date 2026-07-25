const BATTLE_SPRITES: Record<string, any> = {
  // ── Existing epic/prologue heroes ──
  novice_guardian:   require('../../assets/heroes/battle/novice_guardian.png'),   // Novice Guardian
  night_watcher:     require('../../assets/heroes/battle/night_watcher.png'),     // Night Watcher
  apprentice_seer:   require('../../assets/heroes/battle/apprentice_seer.png'),   // Apprentice Seer
  junior_warden:     require('../../assets/heroes/battle/junior_warden.png'),     // Junior Warden
  data_acolyte:      require('../../assets/heroes/battle/data_acolyte.png'),      // Data Acolyte
  village_caretaker: require('../../assets/heroes/battle/village_caretaker.png'), // Village Caretaker
  storm_runner:      require('../../assets/heroes/battle/storm_runner.png'),      // Storm Runner
  infection_warden:  require('../../assets/heroes/battle/infection_warden.png'),  // Infection Warden
  wound_sage:        require('../../assets/heroes/battle/wound_sage.png'),        // Wound Sage
  mindkeeper:        require('../../assets/heroes/battle/mindkeeper.png'),        // Mindkeeper

  // ── WARDBORN commons ──
  wardlight_apprentice:    require('../../assets/heroes/battle/wardlight_apprentice.png'),    // Wardlight Apprentice
  gentle_hands_aide:       require('../../assets/heroes/battle/gentle_hands_aide.png'),       // Gentle Hands Aide
  safety_watch_initiate:   require('../../assets/heroes/battle/safety_watch_initiate.png'),   // Safety Watch Initiate
  care_chain_initiate:     require('../../assets/heroes/battle/care_chain_initiate.png'),     // Care Chain Initiate
  comfort_scribe:          require('../../assets/heroes/battle/comfort_scribe.png'),          // Comfort Scribe
  record_keeper_initiate:  require('../../assets/heroes/battle/record_keeper_initiate.png'),  // Record Keeper Initiate

  // ── WARDBORN uncommons ──
  bedside_guardian:   require('../../assets/heroes/battle/bedside_guardian.png'),   // Bedside Guardian
  triage_lantern:     require('../../assets/heroes/battle/triage_lantern.png'),     // Triage Lantern
  mindward_listener:  require('../../assets/heroes/battle/mindward_listener.png'),  // Mindward Listener
  infection_watcher:  require('../../assets/heroes/battle/infection_watcher.png'),  // Infection Watcher
  quality_sealbearer: require('../../assets/heroes/battle/quality_sealbearer.png'), // Quality Sealbearer

  // ── WARDBORN rares ──
  night_ward_sentinel: require('../../assets/heroes/battle/night_ward_sentinel.png'), // Night Ward Sentinel
  crisis_calm_keeper:  require('../../assets/heroes/battle/crisis_calm_keeper.png'),  // Crisis Calm Keeper
  safety_auditor:      require('../../assets/heroes/battle/safety_auditor.png'),      // Safety Auditor

  // ── LIFEBREATH commons ──
  breath_aide:         require('../../assets/heroes/battle/breath_aide.png'),         // Breath Aide
  airway_apprentice:   require('../../assets/heroes/battle/airway_apprentice.png'),   // Airway Apprentice
  pulsewind_initiate:  require('../../assets/heroes/battle/pulsewind_initiate.png'),  // Pulsewind Initiate
  nebula_trainee:      require('../../assets/heroes/battle/nebula_trainee.png'),      // Nebula Trainee
  vapor_aide:          require('../../assets/heroes/battle/vapor_aide.png'),          // Vapor Aide
  cascade_aide:        require('../../assets/heroes/battle/cascade_aide.png'),        // Cascade Aide

  // ── LIFEBREATH uncommons ──
  breath_lantern:            require('../../assets/heroes/battle/breath_lantern.png'),            // Breath Lantern
  emergency_airway_warden:   require('../../assets/heroes/battle/emergency_airway_warden.png'),   // Emergency Airway Warden
  pulmonary_guide:           require('../../assets/heroes/battle/pulmonary_guide.png'),           // Pulmonary Guide
  sleepwind_keeper:          require('../../assets/heroes/battle/sleepwind_keeper.png'),          // Sleepwind Keeper
  icu_breathkeeper:          require('../../assets/heroes/battle/icu_breathkeeper.png'),          // ICU Breathkeeper

  // ── LIFEBREATH rares ──
  breathstride_therapist: require('../../assets/heroes/battle/breathstride_therapist.png'), // Breathstride Therapist
  airway_warden:          require('../../assets/heroes/battle/airway_warden.png'),          // Airway Warden
  night_breath_warden:    require('../../assets/heroes/battle/night_breath_warden.png'),    // Night Breath Warden

  // ── TRUTHSEER commons ──
  anatomy_scribe:      require('../../assets/heroes/battle/anatomy_scribe.png'),      // Anatomy Scribe
  whitecoat_initiate:  require('../../assets/heroes/battle/whitecoat_initiate.png'),  // Whitecoat Initiate
  image_apprentice:    require('../../assets/heroes/battle/image_apprentice.png'),    // Image Apprentice
  sample_runner:       require('../../assets/heroes/battle/sample_runner.png'),       // Sample Runner
  vial_keeper:         require('../../assets/heroes/battle/vial_keeper.png'),         // Vial Keeper
  pathlight_initiate:  require('../../assets/heroes/battle/pathlight_initiate.png'),  // Pathlight Initiate

  // ── TRUTHSEER uncommons ──
  resident_of_dawn:       require('../../assets/heroes/battle/resident_of_dawn.png'),       // Resident of Dawn
  codefire_physician:     require('../../assets/heroes/battle/codefire_physician.png'),     // Codefire Physician
  radiant_lens:           require('../../assets/heroes/battle/radiant_lens.png'),           // Radiant Lens
  lablight_technologist:  require('../../assets/heroes/battle/lablight_technologist.png'),  // Lablight Technologist
  hematology_threader:    require('../../assets/heroes/battle/hematology_threader.png'),    // Hematology Threader

  // ── TRUTHSEER rares ──
  wardround_doctor: require('../../assets/heroes/battle/wardround_doctor.png'), // Wardround Doctor
  spiral_ct_seer:   require('../../assets/heroes/battle/spiral_ct_seer.png'),   // Spiral CT Seer
  microbe_seer:     require('../../assets/heroes/battle/microbe_seer.png'),     // Microbe Seer

  // ── REMEDYBOUND commons ──
  shelfmark_apprentice: require('../../assets/heroes/battle/shelfmark_apprentice.png'), // Shelfmark Apprentice
  dose_scribe:          require('../../assets/heroes/battle/dose_scribe.png'),          // Dose Scribe
  mortar_initiate:      require('../../assets/heroes/battle/mortar_initiate.png'),      // Mortar Initiate
  garden_apprentice:    require('../../assets/heroes/battle/garden_apprentice.png'),    // Garden Apprentice
  plate_initiate:       require('../../assets/heroes/battle/plate_initiate.png'),       // Plate Initiate
  hydration_scribe:     require('../../assets/heroes/battle/hydration_scribe.png'),     // Hydration Scribe

  // ── REMEDYBOUND uncommons ──
  lotus_apothecary:  require('../../assets/heroes/battle/lotus_apothecary.png'),  // Lotus Apothecary
  clinic_dosekeeper: require('../../assets/heroes/battle/clinic_dosekeeper.png'), // Clinic Dosekeeper
  compound_hand:     require('../../assets/heroes/battle/compound_hand.png'),     // Compound Hand
  lotus_dietitian:   require('../../assets/heroes/battle/lotus_dietitian.png'),   // Lotus Dietitian
  glucose_lantern:   require('../../assets/heroes/battle/glucose_lantern.png'),   // Glucose Lantern

  // ── REMEDYBOUND rares ──
  ward_pharmacist:       require('../../assets/heroes/battle/ward_pharmacist.png'),       // Ward Pharmacist
  antidote_alchemist:    require('../../assets/heroes/battle/antidote_alchemist.png'),    // Antidote Alchemist
  metabolic_garden_sage: require('../../assets/heroes/battle/metabolic_garden_sage.png'), // Metabolic Garden Sage

  // ── RESTOREBOUND commons ──
  stepwise_aide:    require('../../assets/heroes/battle/stepwise_aide.png'),    // Stepwise Aide
  gait_apprentice:  require('../../assets/heroes/battle/gait_apprentice.png'),  // Gait Apprentice
  stretch_hand:     require('../../assets/heroes/battle/stretch_hand.png'),     // Stretch Hand
  function_aide:    require('../../assets/heroes/battle/function_aide.png'),    // Function Aide
  routine_keeper:   require('../../assets/heroes/battle/routine_keeper.png'),   // Routine Keeper
  grip_apprentice:  require('../../assets/heroes/battle/grip_apprentice.png'),  // Grip Apprentice

  // ── RESTOREBOUND uncommons ──
  gait_lantern:         require('../../assets/heroes/battle/gait_lantern.png'),         // Gait Lantern
  neurostep_seer:       require('../../assets/heroes/battle/neurostep_seer.png'),       // Neurostep Seer
  bonepath_guide:       require('../../assets/heroes/battle/bonepath_guide.png'),       // Bonepath Guide
  lifeweave_therapist:  require('../../assets/heroes/battle/lifeweave_therapist.png'),  // Lifeweave Therapist
  mindroutine_keeper:   require('../../assets/heroes/battle/mindroutine_keeper.png'),   // Mindroutine Keeper

  // ── RESTOREBOUND rares ──
  acute_step_warden:          require('../../assets/heroes/battle/acute_step_warden.png'),          // Acute Step Warden
  iron_tendon_adept:          require('../../assets/heroes/battle/iron_tendon_adept.png'),          // Iron Tendon Adept
  cognitive_rehab_specialist: require('../../assets/heroes/battle/cognitive_rehab_specialist.png'), // Cognitive Rehab Specialist

  // ── REALMBOUND commons ──
  village_health_aide:     require('../../assets/heroes/battle/village_health_aide.png'),     // Village Health Aide
  banner_scribe:           require('../../assets/heroes/battle/banner_scribe.png'),           // Banner Scribe
  clean_water_runner:      require('../../assets/heroes/battle/clean_water_runner.png'),      // Clean Water Runner
  care_guide:              require('../../assets/heroes/battle/care_guide.png'),              // Care Guide
  return_path_scribe:      require('../../assets/heroes/battle/return_path_scribe.png'),      // Return Path Scribe
  data_threader_initiate:  require('../../assets/heroes/battle/data_threader_initiate.png'),  // Data Threader Initiate

  // ── REALMBOUND uncommons ──
  community_lantern:     require('../../assets/heroes/battle/community_lantern.png'),     // Community Lantern
  health_banner_guide:   require('../../assets/heroes/battle/health_banner_guide.png'),   // Health Banner Guide
  clean_water_sentinel:  require('../../assets/heroes/battle/clean_water_sentinel.png'),  // Clean Water Sentinel
  resource_lantern:      require('../../assets/heroes/battle/resource_lantern.png'),      // Resource Lantern
  discharge_planner:     require('../../assets/heroes/battle/discharge_planner.png'),     // Discharge Planner

  // ── REALMBOUND rares ──
  pattern_seer:                require('../../assets/heroes/battle/pattern_seer.png'),                // Pattern Seer
  environmental_seal_warden:   require('../../assets/heroes/battle/environmental_seal_warden.png'),   // Environmental Seal Warden
  chartweave_analyst:          require('../../assets/heroes/battle/chartweave_analyst.png'),          // Chartweave Analyst
  florence_nightingale:        require('../../assets/images/nightingale_battle_sprite.png'),        // Florence Nightingale

  // ── Prologue loaner heroes (tutorial + scripted-loss boss) ──
  prologue_nightingale:  require('../../assets/images/nightingale_battle_sprite.png'),  // Nightingale (prologue loaner)
  prologue_fleming:      require('../../assets/images/fleming_battle_sprite.png'),      // Fleming (prologue loaner)
  prologue_the_prodigy:  require('../../assets/images/prodigy_battle_sprite.png'),      // The Prodigy (prologue boss / peak-power self)

  // ── The Prodigy aliases (former_self consolidated → the_prodigy) ──
  the_prodigy:           require('../../assets/images/prodigy_battle_sprite.png'),      // The Prodigy
  former_self:           require('../../assets/images/prodigy_battle_sprite.png'),      // The Prodigy (legacy alias)
  prologue_former_self:  require('../../assets/images/prodigy_battle_sprite.png'),      // The Prodigy (legacy prologue alias)
};

// All battle-sprite modules, for cache preloading at game start.
export const HERO_BATTLE_SPRITE_MODULES = Object.values(BATTLE_SPRITES);

export function getHeroBattleSprite(heroId: string): any | null {
  return BATTLE_SPRITES[heroId] ?? null;
}
