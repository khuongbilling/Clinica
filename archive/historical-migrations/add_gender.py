#!/usr/bin/env python3
"""
Adds gender field to RosterHero interface and all 104 hero entries in LAUNCH_ROSTER.
"""
import re

GENDER_MAP = {
    # WARDBORN (19)
    'wardlight_apprentice': 'female',
    'gentle_hands_aide': 'female',
    'safety_watch_initiate': 'male',
    'care_chain_initiate': 'nonbinary',
    'comfort_scribe': 'female',
    'record_keeper_initiate': 'male',
    'bedside_guardian': 'female',
    'triage_lantern': 'male',
    'mindward_listener': 'female',
    'infection_watcher': 'male',
    'quality_sealbearer': 'nonbinary',
    'night_ward_sentinel': 'female',
    'crisis_calm_keeper': 'male',
    'safety_auditor': 'female',
    'clean_hands_sentinel': 'female',
    'lotus_care_captain': 'female',
    'code_guardian': 'male',
    'mind_lotus_healer': 'female',
    'patient_safety_arbiter': 'nonbinary',
    # LIFEBREATH (16)
    'breath_aide': 'female',
    'airway_apprentice': 'male',
    'pulsewind_initiate': 'female',
    'nebula_trainee': 'nonbinary',
    'vapor_aide': 'male',
    'cascade_aide': 'female',
    'breath_lantern': 'female',
    'emergency_airway_warden': 'male',
    'pulmonary_guide': 'female',
    'sleepwind_keeper': 'nonbinary',
    'icu_breathkeeper': 'male',
    'breathstride_therapist': 'female',
    'airway_warden': 'male',
    'night_breath_warden': 'female',
    'ventilation_strategist': 'nonbinary',
    'aerosol_guardian': 'male',
    # TRUTHSEER (19)
    'anatomy_scribe': 'female',
    'whitecoat_initiate': 'male',
    'image_apprentice': 'female',
    'sample_runner': 'male',
    'vial_keeper': 'female',
    'pathlight_initiate': 'nonbinary',
    'resident_of_dawn': 'female',
    'codefire_physician': 'male',
    'radiant_lens': 'female',
    'lablight_technologist': 'male',
    'hematology_threader': 'nonbinary',
    'cellular_seer': 'female',
    'wardround_doctor': 'female',
    'spiral_ct_seer': 'male',
    'microbe_seer': 'female',
    'code_sage': 'male',
    'pathology_oracle': 'male',
    'hearthline_attending': 'nonbinary',
    'trauma_image_oracle': 'female',
    # REMEDYBOUND (17)
    'shelfmark_apprentice': 'female',
    'dose_scribe': 'male',
    'mortar_initiate': 'female',
    'garden_apprentice': 'male',
    'plate_initiate': 'female',
    'hydration_scribe': 'nonbinary',
    'lotus_apothecary': 'female',
    'clinic_dosekeeper': 'male',
    'compound_hand': 'female',
    'lotus_dietitian': 'female',
    'glucose_lantern': 'male',
    'medication_safety_arbiter': 'female',
    'ward_pharmacist': 'female',
    'antidote_alchemist': 'male',
    'metabolic_garden_sage': 'female',
    'formula_strategist': 'female',
    'vital_garden_sage': 'female',
    # RESTOREBOUND (16)
    'stepwise_aide': 'male',
    'gait_apprentice': 'female',
    'stretch_hand': 'male',
    'function_aide': 'female',
    'routine_keeper': 'male',
    'grip_apprentice': 'nonbinary',
    'gait_lantern': 'female',
    'neurostep_seer': 'male',
    'bonepath_guide': 'female',
    'lifeweave_therapist': 'nonbinary',
    'mindroutine_keeper': 'male',
    'acute_step_warden': 'female',
    'iron_tendon_adept': 'male',
    'cognitive_rehab_specialist': 'female',
    'lifeweaver': 'female',
    'mobility_commander': 'female',
    # REALMBOUND (17)
    'village_health_aide': 'female',
    'banner_scribe': 'male',
    'clean_water_runner': 'female',
    'care_guide': 'male',
    'return_path_scribe': 'female',
    'data_threader_initiate': 'nonbinary',
    'community_lantern': 'female',
    'health_banner_guide': 'male',
    'clean_water_sentinel': 'female',
    'resource_lantern': 'male',
    'discharge_planner': 'female',
    'pattern_seer': 'female',
    'environmental_seal_warden': 'male',
    'chartweave_analyst': 'female',
    'outbreak_commander': 'female',
    'informatics_architect': 'female',
    'clean_realm_commander': 'female',
}

with open('frontend/src/game/heroRoster.ts', 'r') as f:
    lines = f.readlines()

new_lines = []
i = 0

# Step 1: Add gender field to RosterHero interface (after 'id: string;' line)
interface_done = False

while i < len(lines):
    line = lines[i]
    
    # Add gender to interface — insert after 'id: string;'
    if not interface_done and '  id: string;' in line and 'export interface' not in line:
        new_lines.append(line)
        new_lines.append("  gender: 'female' | 'male' | 'nonbinary';\n")
        interface_done = True
        i += 1
        continue
    
    # For hero entries in LAUNCH_ROSTER: match `    id: 'hero_id',`
    id_match = re.match(r"^    id: '([^']+)',\s*$", line)
    if id_match:
        hero_id = id_match.group(1)
        if hero_id in GENDER_MAP:
            gender = GENDER_MAP[hero_id]
            new_lines.append(line)
            new_lines.append(f"    gender: '{gender}',\n")
            i += 1
            continue
    
    new_lines.append(line)
    i += 1

with open('frontend/src/game/heroRoster.ts', 'w') as f:
    f.writelines(new_lines)

print(f"Interface updated: {interface_done}")
gender_marker = "    gender: '"
print(f"Heroes processed: {sum(1 for l in new_lines if gender_marker in l)}")

# Verify
added = [GENDER_MAP[k] for k in GENDER_MAP]
print(f"Female: {added.count('female')}, Male: {added.count('male')}, Nonbinary: {added.count('nonbinary')}")
print(f"Total: {len(GENDER_MAP)}")
