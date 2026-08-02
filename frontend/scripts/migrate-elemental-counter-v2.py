#!/usr/bin/env python3
"""
Migration v2 — line-by-line approach for reliability.
"""

# ── Scripted enemy overrides ──────────────────────────────────────────────────
SCRIPTED = {
    'dehydration_wisp':    dict(corruptionAspect='Depletion',            weakElement='River',      primaryAffinity='Fluid / Hydration',         secondaryAffinities=[]),
    'fluid_phantom':       dict(corruptionAspect='Depletion',            weakElement='River',      primaryAffinity='Fluid / Hydration',         secondaryAffinities=[]),
    'dehydration_specter': dict(corruptionAspect='Desiccation',          weakElement='River',      primaryAffinity='Fluid / Hydration',         secondaryAffinities=[]),
    'fever_shade':         dict(corruptionAspect='Inferno',              weakElement='River',      primaryAffinity='Fire / Inflammation',       secondaryAffinities=['Fluid / Hydration']),
    'gale_spirit':         dict(corruptionAspect='Suffocation',          weakElement='Air',        primaryAffinity='Airway / Respiratory',      secondaryAffinities=[]),
    'ward_cascade':        dict(corruptionAspect='Ward Collapse',        weakElement='Protection', primaryAffinity='Community / Public Health', secondaryAffinities=['Airway / Respiratory', 'Fluid / Hydration']),
    'verdantha':           dict(corruptionAspect='Rampant Overgrowth',   weakElement='Forge',      primaryAffinity='Growth / Endocrine',        secondaryAffinities=['Filter / Renal']),
    'lord_imbalance':      dict(corruptionAspect='Desiccating Delirium', weakElement='River',      primaryAffinity='Fluid / Hydration',         secondaryAffinities=['Mind / Neuro-Psych']),
    'silent_infarct':      dict(corruptionAspect='Silent Ischemia',      weakElement='Storm',      primaryAffinity='Storm / Cardiac',           secondaryAffinities=['Energy / Metabolic']),
}

CORRUPTION_ASPECTS = {
    'air_sprite':              'Bronchospasm',
    'river_sludge':            'Hypoperfusion',
    'energy_lock':             'Glucopenia',
    'fire_imp':                'Localised Infection',
    'septara_seed':            'Septic Seeding',
    'cardion_echo':            'Cardiac Overload',
    'glycora_spark':           'Ketoacidosis',
    'pulmora_wisp':            'Airflow Obstruction',
    'electrox_flicker':        'Electrolyte Storm',
    'mind_fog':                'Cognitive Disruption',
    'priority_surge':          'Triage Collapse',
    'overload_shade':          'System Overload',
    'recovery_lapse':          'Secondary Deterioration',
    'fatigue_veil':            'Physiological Debt',
    'imbalance_core':          'Metabolic Derangement',
    'contagion_wraith':        'Outbreak Spread',
    'crisis_convergence':      'Multi-System Crisis',
    'true_dehydration_wraith': 'Hypovolemic Progression',
    'breathless_gale_spirit':  'Respiratory Failure',
    'burning_fever_shade':     'Septic Cascade',
    'drought_river_shade':     'Hypovolemic-Electrolyte Crisis',
    'confusion_veil':          'Delirious Cascade',
    'glycemic_rupture':        'Metabolic Collapse',
    'hypoxia_wisp':            'Desaturation',
    'mucus_wisp':              'Secretion Accumulation',
    'panic_wraith':            'Anxiety Spiral',
    'wheeze_guard':            'Bronchospasm',
    'shock_spike':             'Haemodynamic Instability',
}

VERDANTHA_PHASES = """\
  phases: [
    { phaseId: 'phase1', weakElementOverride: 'Forge' },
    { phaseId: 'phase2', weakElementOverride: 'Filter' },
    { phaseId: 'phase3', weakElementOverride: null },
  ],"""

import re

def fmt_secondary_affinities(arr, indent='  '):
    if not arr:
        return f"{indent}secondaryAffinities: [],"
    items = ', '.join(f"'{v}'" for v in arr)
    return f"{indent}secondaryAffinities: [{items}],"


def process(src):
    lines = src.split('\n')
    out = []
    
    current_enemy_id = None
    scripted = None
    need_phases = False
    has_corruption_aspect = False
    has_secondary_affinities = False
    has_resistant_element = False
    has_visual_tags = False
    has_phases = False
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Detect start of a new enemy block — id field
        id_match = re.match(r"^(\s+)id: '([^']+)',", line)
        if id_match:
            current_enemy_id = id_match.group(2)
            scripted = SCRIPTED.get(current_enemy_id)
            has_corruption_aspect = False
            has_secondary_affinities = False
            has_resistant_element = False
            has_visual_tags = False
            has_phases = False
            need_phases = (current_enemy_id == 'verdantha')
            out.append(line)
            i += 1
            continue
        
        # Track which new fields are already present (idempotency)
        if re.match(r'\s+corruptionAspect:', line):
            has_corruption_aspect = True
        if re.match(r'\s+secondaryAffinities:', line):
            has_secondary_affinities = True
        if re.match(r'\s+resistantElement:', line):
            has_resistant_element = True
        if re.match(r'\s+visualTags:', line):
            has_visual_tags = True
        if re.match(r'\s+phases:', line):
            has_phases = True
        
        # Inject corruptionAspect after realWorld line
        rw_match = re.match(r"^(\s+)realWorld: '([^']+)',", line)
        if rw_match and current_enemy_id and not has_corruption_aspect:
            indent = rw_match.group(1)
            out.append(line)
            if scripted:
                ca = scripted['corruptionAspect']
            else:
                ca = CORRUPTION_ASPECTS.get(current_enemy_id, 'Systemic Pathology')
            out.append(f"{indent}corruptionAspect: '{ca}',")
            has_corruption_aspect = True
            i += 1
            continue
        
        # Handle secondaryAffinity: → secondaryAffinities: [...]
        sa_match = re.match(r"^(\s+)secondaryAffinity: '([^']+)',", line)
        if sa_match and current_enemy_id and not has_secondary_affinities:
            indent = sa_match.group(1)
            old_val = sa_match.group(2)
            if scripted:
                arr = scripted['secondaryAffinities']
            else:
                arr = [old_val]
            out.append(fmt_secondary_affinities(arr, indent))
            has_secondary_affinities = True
            i += 1
            continue
        
        # Handle primaryAffinity: override if scripted, then inject missing fields after
        pa_match = re.match(r"^(\s+)primaryAffinity: '([^']+)',", line)
        if pa_match and current_enemy_id:
            indent = pa_match.group(1)
            if scripted and scripted.get('primaryAffinity'):
                line = f"{indent}primaryAffinity: '{scripted['primaryAffinity']}',"
            out.append(line)
            
            # Check if next non-empty line is secondaryAffinity
            next_line = lines[i+1] if i+1 < len(lines) else ''
            has_sa_next = bool(re.match(r'\s+secondaryAffinity:', next_line))
            # Also check if secondaryAffinities already coming
            has_sas_next = bool(re.match(r'\s+secondaryAffinities:', next_line))
            
            if not has_sa_next and not has_sas_next and not has_secondary_affinities:
                arr = scripted['secondaryAffinities'] if scripted else []
                out.append(fmt_secondary_affinities(arr, indent))
                has_secondary_affinities = True
            
            if not has_resistant_element:
                out.append(f"{indent}resistantElement: null,")
                has_resistant_element = True
            
            if not has_visual_tags:
                out.append(f"{indent}visualTags: [],")
                has_visual_tags = True
            
            i += 1
            continue
        
        # Handle weakSystem: → weakElement:
        ws_match = re.match(r"^(\s+)weakSystem: '([^']+)',", line)
        if ws_match and current_enemy_id:
            indent = ws_match.group(1)
            old_val = ws_match.group(2)
            new_val = scripted['weakElement'] if scripted else old_val
            out.append(f"{indent}weakElement: '{new_val}',")
            i += 1
            continue
        
        # Inject phases after worldBoss: true (Verdantha only)
        if need_phases and not has_phases and re.match(r'\s+worldBoss: true,', line):
            out.append(line)
            out.append(VERDANTHA_PHASES)
            has_phases = True
            i += 1
            continue
        
        out.append(line)
        i += 1
    
    return '\n'.join(out)


def main():
    path = 'frontend/src/game/content.ts'
    with open(path, 'r') as f:
        src = f.read()
    
    result = process(src)
    
    with open(path, 'w') as f:
        f.write(result)
    
    we_count = result.count('weakElement:')
    ws_count = result.count('weakSystem:')
    ca_count = result.count('corruptionAspect:')
    sa_count = result.count('secondaryAffinities:')
    re_count = result.count('resistantElement:')
    vt_count = result.count('visualTags:')
    ph_count = result.count('phases:')
    print(f"weakElement:         {we_count}")
    print(f"weakSystem:          {ws_count}  <- should be 0")
    print(f"corruptionAspect:    {ca_count}")
    print(f"secondaryAffinities: {sa_count}")
    print(f"resistantElement:    {re_count}")
    print(f"visualTags:          {vt_count}")
    print(f"phases:              {ph_count}")


if __name__ == '__main__':
    main()
