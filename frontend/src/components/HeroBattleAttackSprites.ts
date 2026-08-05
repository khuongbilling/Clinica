/**
 * Hero attack-pose sprites.
 *
 * Per-hero overrides take priority; the ClassFamily sprite is the fallback for
 * any hero without a bespoke attack frame.  New rare/epic hero art goes in
 * HERO_ATTACK_SPRITE_OVERRIDES keyed by hero ID.
 */

import type { ClassFamily } from '@/src/game/types';

// ── Per-hero bespoke attack sprites ───────────────────────────────────────────

// ── WARDBORN ──────────────────────────────────────────────────────────────────
const HERO_ATTACK_SPRITE_OVERRIDES: Record<string, any> = {
  // Epics
  lotus_care_captain:    require('../../assets/heroes/battle/attack/lotus_care_captain_atk.png'),
  code_guardian:         require('../../assets/heroes/battle/attack/code_guardian_atk.png'),
  mind_lotus_healer:     require('../../assets/heroes/battle/attack/mind_lotus_healer_atk.png'),
  patient_safety_arbiter: require('../../assets/heroes/battle/attack/patient_safety_arbiter_atk.png'),
  // Rares
  airway_warden:         require('../../assets/heroes/battle/attack/airway_warden_atk.png'),
  night_ward_sentinel:   require('../../assets/heroes/battle/attack/night_ward_sentinel_atk.png'),
  crisis_calm_keeper:    require('../../assets/heroes/battle/attack/crisis_calm_keeper_atk.png'),
  clean_hands_sentinel:  require('../../assets/heroes/battle/attack/clean_hands_sentinel_atk.png'),
  safety_auditor:        require('../../assets/heroes/battle/attack/safety_auditor_atk.png'),
  wardround_doctor:      require('../../assets/heroes/battle/attack/wardround_doctor_atk.png'),

  // ── LIFEBREATH ──────────────────────────────────────────────────────────────
  // Epics
  ventilation_strategist: require('../../assets/heroes/battle/attack/ventilation_strategist_atk.png'),
  aerosol_guardian:       require('../../assets/heroes/battle/attack/aerosol_guardian_atk.png'),
  // Rares
  night_breath_warden:    require('../../assets/heroes/battle/attack/night_breath_warden_atk.png'),
  breathstride_therapist: require('../../assets/heroes/battle/attack/breathstride_therapist_atk.png'),

  // ── TRUTHSEER ───────────────────────────────────────────────────────────────
  // Epics
  hearthline_attending:  require('../../assets/heroes/battle/attack/hearthline_attending_atk.png'),
  trauma_image_oracle:   require('../../assets/heroes/battle/attack/trauma_image_oracle_atk.png'),
  // Rares
  microbe_seer:          require('../../assets/heroes/battle/attack/microbe_seer_atk.png'),
  spiral_ct_seer:        require('../../assets/heroes/battle/attack/spiral_ct_seer_atk.png'),
  code_sage:             require('../../assets/heroes/battle/attack/code_sage_atk.png'),
  pathology_oracle:      require('../../assets/heroes/battle/attack/pathology_oracle_atk.png'),
  chartweave_analyst:    require('../../assets/heroes/battle/attack/chartweave_analyst_atk.png'),
  pattern_seer:          require('../../assets/heroes/battle/attack/pattern_seer_atk.png'),

  // ── REMEDYBOUND ─────────────────────────────────────────────────────────────
  // Epics
  formula_strategist:       require('../../assets/heroes/battle/attack/formula_strategist_atk.png'),
  vital_garden_sage:        require('../../assets/heroes/battle/attack/vital_garden_sage_atk.png'),
  // Rares
  ward_pharmacist:          require('../../assets/heroes/battle/attack/ward_pharmacist_atk.png'),
  antidote_alchemist:       require('../../assets/heroes/battle/attack/antidote_alchemist_atk.png'),
  medication_safety_arbiter: require('../../assets/heroes/battle/attack/medication_safety_arbiter_atk.png'),
  metabolic_garden_sage:    require('../../assets/heroes/battle/attack/metabolic_garden_sage_atk.png'),

  // ── RESTOREBOUND ────────────────────────────────────────────────────────────
  // Epics
  mobility_commander:       require('../../assets/heroes/battle/attack/mobility_commander_atk.png'),
  // Rares
  iron_tendon_adept:        require('../../assets/heroes/battle/attack/iron_tendon_adept_atk.png'),
  lifeweaver:               require('../../assets/heroes/battle/attack/lifeweaver_atk.png'),
  acute_step_warden:        require('../../assets/heroes/battle/attack/acute_step_warden_atk.png'),
  cognitive_rehab_specialist: require('../../assets/heroes/battle/attack/cognitive_rehab_specialist_atk.png'),

  // ── REALMBOUND ──────────────────────────────────────────────────────────────
  // Epics
  outbreak_commander:       require('../../assets/heroes/battle/attack/outbreak_commander_atk.png'),
  informatics_architect:    require('../../assets/heroes/battle/attack/informatics_architect_atk.png'),
  clean_realm_commander:    require('../../assets/heroes/battle/attack/clean_realm_commander_atk.png'),
  // Rares
  environmental_seal_warden: require('../../assets/heroes/battle/attack/environmental_seal_warden_atk.png'),
};

// ── Per-family fallback sprites (commons & uncommons) ─────────────────────────
const FAMILY_ATTACK_SPRITES: Partial<Record<ClassFamily, any>> = {
  Wardborn:     require('../../assets/heroes/battle/attack/role_wardborn_atk.png'),
  Lifebreath:   require('../../assets/heroes/battle/attack/role_lifebreath_atk.png'),
  Truthseer:    require('../../assets/heroes/battle/attack/role_truthseer_atk.png'),
  Remedybound:  require('../../assets/heroes/battle/attack/role_remedybound_atk.png'),
  Restorebound: require('../../assets/heroes/battle/attack/role_restorebound_atk.png'),
  Realmbound:   require('../../assets/heroes/battle/attack/role_realmbound_atk.png'),
};

// All attack-sprite modules, for cache preloading alongside HERO_BATTLE_SPRITE_MODULES.
export const HERO_ATTACK_SPRITE_MODULES = [
  ...Object.values(HERO_ATTACK_SPRITE_OVERRIDES),
  ...Object.values(FAMILY_ATTACK_SPRITES),
].filter(Boolean);

/**
 * Return the attack-pose asset for a hero.
 *
 * Checks hero-ID-specific overrides first, then falls back to the family
 * sprite, then null (prologue heroes, legacy originals, unknown families).
 */
export function getHeroAttackSprite(
  family: ClassFamily | null | undefined,
  heroId?: string | null,
): any | null {
  if (heroId && HERO_ATTACK_SPRITE_OVERRIDES[heroId]) {
    return HERO_ATTACK_SPRITE_OVERRIDES[heroId];
  }
  if (!family) return null;
  return FAMILY_ATTACK_SPRITES[family] ?? null;
}
