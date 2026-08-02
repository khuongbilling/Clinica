#!/usr/bin/env python3
"""
Migration v3 — tracks brace depth to only process inside Enemy object blocks.
Handles ENEMIES[], AFFLICTION_ENEMIES[], and BOSS_ constants.
"""
import re, sys

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

VERDANTHA_PHASES = [
    "  phases: [",
    "    { phaseId: 'phase1', weakElementOverride: 'Forge' },",
    "    { phaseId: 'phase2', weakElementOverride: 'Filter' },",
    "    { phaseId: 'phase3', weakElementOverride: null },",
    "  ],",
]

def sec_affinities_line(arr, indent):
    if not arr:
        return f"{indent}secondaryAffinities: [],"
    items = ', '.join(f"'{v}'" for v in arr)
    return f"{indent}secondaryAffinities: [{items}],"


def process(src):
    lines = src.split('\n')
    out = []

    # State machine
    in_enemy_section = False   # True when inside ENEMIES[], AFFLICTION_ENEMIES[], or a BOSS_ const
    enemy_brace_depth = 0      # brace depth relative to start of current enemy object
    in_enemy_obj = False       # True when inside a single Enemy { ... } block
    
    # Per-enemy state
    enemy_id = None
    scripted = None
    
    # Track which new fields have been injected into current enemy
    injected_ca = False
    injected_sa = False
    injected_re = False
    injected_vt = False
    injected_ph = False
    injected_we = False  # weakElement (only for scripted enemies missing weakSystem)
    
    # Indent to use (detected from id: line)
    obj_indent = '  '

    i = 0
    while i < len(lines):
        raw = lines[i]

        # ── Detect entering enemy-bearing sections ────────────────────────────
        if re.match(r'export const ENEMIES: Enemy\[\] = \[', raw):
            in_enemy_section = True
            out.append(raw); i += 1; continue

        if re.match(r'export const AFFLICTION_ENEMIES: Enemy\[\] = \[', raw):
            in_enemy_section = True
            out.append(raw); i += 1; continue

        if re.match(r'export const BOSS_(LORD_IMBALANCE|SILENT_INFARCT): Enemy = \{', raw):
            in_enemy_section = True
            # This IS the opening brace of an enemy object at depth 0
            in_enemy_obj = True
            enemy_brace_depth = 1
            obj_indent = '  '
            # IMPORTANT: reset per-enemy state so the next id: line is picked up
            enemy_id = None
            scripted = None
            injected_ca = injected_sa = injected_re = injected_vt = injected_ph = injected_we = False
            out.append(raw); i += 1; continue

        # ── Detect end of array sections ──────────────────────────────────────
        # We track this by section-level brace depth — simplified: if we see '];' at top level
        # The arrays end with '];'. We exit section tracking there.
        # For simplicity: any line '};' or '];' at column 0 ends the section.
        if in_enemy_section and re.match(r'^(\]\;|export )', raw):
            in_enemy_section = False
            in_enemy_obj = False
            out.append(raw); i += 1; continue

        # ── Inside enemy section: detect start of individual enemy object ─────
        if in_enemy_section and not in_enemy_obj:
            # Inside ENEMIES[] / AFFLICTION_ENEMIES[], enemy objects start with '  {'
            if re.match(r'^  \{$', raw.rstrip()):
                in_enemy_obj = True
                enemy_brace_depth = 1
                enemy_id = None
                scripted = None
                injected_ca = injected_sa = injected_re = injected_vt = injected_ph = injected_we = False
                obj_indent = '    '  # fields inside array objects use 4-space
                out.append(raw); i += 1; continue
            # Also handle single-line objects like in CODEX (we skip those since they don't have enemy fields)
            out.append(raw); i += 1; continue

        # ── Inside an enemy object: process fields ────────────────────────────
        if in_enemy_obj:
            # Count braces to detect end of object
            for ch in raw:
                if ch == '{': enemy_brace_depth += 1
                elif ch == '}': enemy_brace_depth -= 1
            
            if enemy_brace_depth <= 0:
                # End of this enemy object
                in_enemy_obj = False
                # For BOSS_ consts, also end the section
                if re.match(r'^(\}\;)', raw):
                    in_enemy_section = False
                out.append(raw); i += 1; continue

            # ── Detect enemy id ───────────────────────────────────────────────
            id_m = re.match(r'^(\s+)id: \'([^\']+)\',', raw)
            if id_m and enemy_id is None:
                enemy_id = id_m.group(2)
                scripted = SCRIPTED.get(enemy_id)
                out.append(raw); i += 1; continue

            # Only process remaining fields if we have an enemy id
            if enemy_id is None:
                out.append(raw); i += 1; continue

            # ── Inject corruptionAspect after realWorld ───────────────────────
            rw_m = re.match(r'^(\s+)realWorld: \'[^\']+\',', raw)
            if rw_m and not injected_ca:
                indent = rw_m.group(1)
                out.append(raw)
                ca = scripted['corruptionAspect'] if scripted else CORRUPTION_ASPECTS.get(enemy_id, 'Systemic Pathology')
                out.append(f"{indent}corruptionAspect: '{ca}',")
                injected_ca = True
                i += 1; continue

            # ── Convert secondaryAffinity → secondaryAffinities ───────────────
            sa_m = re.match(r'^(\s+)secondaryAffinity: \'([^\']+)\',', raw)
            if sa_m and not injected_sa:
                indent = sa_m.group(1)
                old_val = sa_m.group(2)
                arr = scripted['secondaryAffinities'] if scripted else [old_val]
                out.append(sec_affinities_line(arr, indent))
                injected_sa = True
                # Skip old line
                i += 1; continue

            # ── Inject after primaryAffinity ──────────────────────────────────
            pa_m = re.match(r'^(\s+)primaryAffinity: \'([^\']+)\',', raw)
            if pa_m:
                indent = pa_m.group(1)
                # Override primaryAffinity if scripted
                if scripted and scripted.get('primaryAffinity'):
                    raw = f"{indent}primaryAffinity: '{scripted['primaryAffinity']}',"
                out.append(raw)
                # Check if next line is secondaryAffinity (will be handled above)
                next_raw = lines[i+1] if i+1 < len(lines) else ''
                has_sa_next = bool(re.match(r'^\s+secondaryAffinity:', next_raw))
                has_sas_next = bool(re.match(r'^\s+secondaryAffinities:', next_raw))
                if not has_sa_next and not has_sas_next and not injected_sa:
                    arr = scripted['secondaryAffinities'] if scripted else []
                    out.append(sec_affinities_line(arr, indent))
                    injected_sa = True
                if not injected_re:
                    out.append(f"{indent}resistantElement: null,")
                    injected_re = True
                if not injected_vt:
                    out.append(f"{indent}visualTags: [],")
                    injected_vt = True
                # Scripted enemies that have NO weakSystem in the original file
                # (verdantha, lord_imbalance, silent_infarct) still need weakElement.
                # Inject it here unless a weakSystem line is coming up.
                if scripted and not injected_we:
                    has_ws_ahead = any(
                        re.match(r'^\s+weakSystem:', lines[j])
                        for j in range(i+1, min(i+25, len(lines)))
                    )
                    if not has_ws_ahead:
                        out.append(f"{indent}weakElement: '{scripted['weakElement']}',")
                        injected_we = True
                i += 1; continue

            # ── Convert weakSystem → weakElement ─────────────────────────────
            ws_m = re.match(r'^(\s+)weakSystem: \'([^\']+)\',', raw)
            if ws_m:
                indent = ws_m.group(1)
                old_val = ws_m.group(2)
                new_val = scripted['weakElement'] if scripted else old_val
                out.append(f"{indent}weakElement: '{new_val}',")
                injected_we = True
                i += 1; continue

            # ── Inject phases after worldBoss (Verdantha) ─────────────────────
            if enemy_id == 'verdantha' and not injected_ph:
                wb_m = re.match(r'^(\s+)worldBoss: true,', raw)
                if wb_m:
                    out.append(raw)
                    out.extend(VERDANTHA_PHASES)
                    injected_ph = True
                    i += 1; continue

            out.append(raw); i += 1; continue

        # Outside all sections — pass through unchanged
        out.append(raw)
        i += 1

    return '\n'.join(out)


def main():
    path = 'frontend/src/game/content.ts'
    with open(path, 'r') as f:
        src = f.read()

    result = process(src)

    with open(path, 'w') as f:
        f.write(result)

    we = result.count('weakElement:')
    ws = result.count('weakSystem:')
    ca = result.count('corruptionAspect:')
    sa = result.count('secondaryAffinities:')
    re_ = result.count('resistantElement:')
    vt = result.count('visualTags:')
    ph = result.count('phases:')
    print(f"weakElement:         {we}")
    print(f"weakSystem:          {ws}  <- should be 0")
    print(f"corruptionAspect:    {ca}")
    print(f"secondaryAffinities: {sa}")
    print(f"resistantElement:    {re_}")
    print(f"visualTags:          {vt}")
    print(f"phases:              {ph}")
    print(f"Lines: {len(result.splitlines())} (was 2356)")


if __name__ == '__main__':
    main()
