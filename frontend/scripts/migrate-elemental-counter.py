#!/usr/bin/env python3
"""
Migration script: Elemental Counter Overhaul — Push 1
- Rename weakSystem → weakElement (keeping same value for non-scripted)
- Rename secondaryAffinity → secondaryAffinities (wrap in array)
- Add corruptionAspect, resistantElement, visualTags to every enemy
- Apply migration table overrides for scripted enemies
- Add phases array to Verdantha
"""

import re
import sys

# ── Migration table for scripted enemies ──────────────────────────────────────
SCRIPTED = {
    'dehydration_wisp':    dict(corruptionAspect='Depletion',           weakElement='River',      primaryAffinity='Fluid / Hydration',           secondaryAffinities=[]),
    'fluid_phantom':       dict(corruptionAspect='Depletion',           weakElement='River',      primaryAffinity='Fluid / Hydration',           secondaryAffinities=[]),
    'dehydration_specter': dict(corruptionAspect='Desiccation',         weakElement='River',      primaryAffinity='Fluid / Hydration',           secondaryAffinities=[]),
    'fever_shade':         dict(corruptionAspect='Inferno',             weakElement='River',      primaryAffinity='Fire / Inflammation',         secondaryAffinities=['Fluid / Hydration']),
    'gale_spirit':         dict(corruptionAspect='Suffocation',         weakElement='Air',        primaryAffinity='Airway / Respiratory',        secondaryAffinities=[]),
    'ward_cascade':        dict(corruptionAspect='Ward Collapse',       weakElement='Protection', primaryAffinity='Community / Public Health',   secondaryAffinities=['Airway / Respiratory', 'Fluid / Hydration']),
    'verdantha':           dict(corruptionAspect='Rampant Overgrowth',  weakElement='Forge',      primaryAffinity='Growth / Endocrine',          secondaryAffinities=['Filter / Renal']),
    'lord_imbalance':      dict(corruptionAspect='Desiccating Delirium',weakElement='River',      primaryAffinity='Fluid / Hydration',           secondaryAffinities=['Mind / Neuro-Psych']),
    'silent_infarct':      dict(corruptionAspect='Silent Ischemia',     weakElement='Storm',      primaryAffinity='Storm / Cardiac',             secondaryAffinities=['Energy / Metabolic']),
}

# ── corruptionAspect for non-scripted enemies ─────────────────────────────────
CORRUPTION_ASPECTS = {
    'air_sprite':               'Bronchospasm',
    'river_sludge':             'Hypoperfusion',
    'energy_lock':              'Glucopenia',
    'fire_imp':                 'Localised Infection',
    'septara_seed':             'Septic Seeding',
    'cardion_echo':             'Cardiac Overload',
    'glycora_spark':            'Ketoacidosis',
    'pulmora_wisp':             'Airflow Obstruction',
    'electrox_flicker':         'Electrolyte Storm',
    'mind_fog':                 'Cognitive Disruption',
    'priority_surge':           'Triage Collapse',
    'overload_shade':           'System Overload',
    'recovery_lapse':           'Secondary Deterioration',
    'fatigue_veil':             'Physiological Debt',
    'imbalance_core':           'Metabolic Derangement',
    'contagion_wraith':         'Outbreak Spread',
    'crisis_convergence':       'Multi-System Crisis',
    'true_dehydration_wraith':  'Hypovolemic Progression',
    'breathless_gale_spirit':   'Respiratory Failure',
    'burning_fever_shade':      'Septic Cascade',
    'drought_river_shade':      'Hypovolemic-Electrolyte Crisis',
    'confusion_veil':           'Delirious Cascade',
    'glycemic_rupture':         'Metabolic Collapse',
    'hypoxia_wisp':             'Desaturation',
    'mucus_wisp':               'Secretion Accumulation',
    'panic_wraith':             'Anxiety Spiral',
    'wheeze_guard':             'Bronchospasm',
    'shock_spike':              'Haemodynamic Instability',
}

VERDANTHA_PHASES = """  phases: [
    { phaseId: 'phase1', weakElementOverride: 'Forge' },
    { phaseId: 'phase2', weakElementOverride: 'Filter' },
    { phaseId: 'phase3', weakElementOverride: null },
  ],"""


def build_secondary_affinities_ts(arr):
    if not arr:
        return "  secondaryAffinities: [],"
    items = ', '.join(f"'{v}'" for v in arr)
    return f"  secondaryAffinities: [{items}],"


def process_enemy_block(block_text, enemy_id):
    """Apply all field transformations to a single enemy object text."""

    # ── Determine scripted override or defaults ──────────────────────────────
    scripted = SCRIPTED.get(enemy_id)

    # ── Remove secondaryAffinity line (we'll re-add as secondaryAffinities) ──
    sa_match = re.search(r"[ \t]+secondaryAffinity: '([^']+)',\n", block_text)
    old_secondary = None
    if sa_match:
        old_secondary = sa_match.group(1)
        block_text = block_text[:sa_match.start()] + block_text[sa_match.end():]

    # ── Handle weakSystem → weakElement ──────────────────────────────────────
    ws_match = re.search(r"([ \t]+)weakSystem: '([^']+)',\n", block_text)
    old_weak = None
    if ws_match:
        old_weak = ws_match.group(2)
        indent = ws_match.group(1)
        if scripted:
            new_weak_line = f"{indent}weakElement: '{scripted['weakElement']}',\n"
        else:
            new_weak_line = f"{indent}weakElement: '{old_weak}',\n"
        block_text = block_text[:ws_match.start()] + new_weak_line + block_text[ws_match.end():]

    # ── Determine corruptionAspect ────────────────────────────────────────────
    if scripted:
        ca = scripted['corruptionAspect']
    else:
        ca = CORRUPTION_ASPECTS.get(enemy_id, 'Unknown Corruption')

    # ── Determine secondaryAffinities ─────────────────────────────────────────
    if scripted:
        sec_aff_arr = scripted['secondaryAffinities']
    else:
        sec_aff_arr = [old_secondary] if old_secondary else []

    # ── Override primaryAffinity if scripted ──────────────────────────────────
    if scripted and scripted.get('primaryAffinity'):
        block_text = re.sub(
            r"([ \t]+primaryAffinity: ')[^']+(',)",
            lambda m: m.group(1) + scripted['primaryAffinity'] + m.group(2),
            block_text
        )

    # ── Add new fields after primaryAffinity line (or after difficulty if no pa) ──
    # We'll inject after the last of: primaryAffinity / weakElement / resistanceTags block
    # Strategy: inject corruptionAspect right after the id line so it's near the top data fields
    # Actually, let's inject after 'realWorld' line for cleanliness
    
    # Check if new fields already present (idempotent)
    if 'corruptionAspect:' in block_text:
        # Already has it; just ensure secondaryAffinities is present
        if 'secondaryAffinities:' not in block_text:
            # Add after primaryAffinity
            pa_match = re.search(r"([ \t]+primaryAffinity: '[^']+',\n)", block_text)
            if pa_match:
                sec_line = "  " + build_secondary_affinities_ts(sec_aff_arr) + "\n"
                ins = pa_match.end()
                block_text = block_text[:ins] + sec_line + block_text[ins:]
        return block_text

    # ── Inject new fields after 'realWorld' line ──────────────────────────────
    rw_match = re.search(r"([ \t]+realWorld: '[^']+',\n)", block_text)
    if not rw_match:
        # Fallback: after id line
        rw_match = re.search(r"([ \t]+id: '[^']+',\n)", block_text)

    if rw_match:
        ins = rw_match.end()
        insert = f"  corruptionAspect: '{ca}',\n"
        block_text = block_text[:ins] + insert + block_text[ins:]

    # ── Inject resistantElement and visualTags and secondaryAffinities ────────
    # after primaryAffinity line
    pa_match = re.search(r"([ \t]+primaryAffinity: '[^']+',\n)", block_text)
    if pa_match:
        ins = pa_match.end()
        lines_to_add = (
            "  " + build_secondary_affinities_ts(sec_aff_arr) + "\n"
            + "  resistantElement: null,\n"
            + "  visualTags: [],\n"
        )
        block_text = block_text[:ins] + lines_to_add + block_text[ins:]
    else:
        # No primaryAffinity — add after corruptionAspect
        ca_match = re.search(r"([ \t]+corruptionAspect: '[^']+',\n)", block_text)
        if ca_match:
            ins = ca_match.end()
            lines_to_add = (
                "  " + build_secondary_affinities_ts(sec_aff_arr) + "\n"
                + "  resistantElement: null,\n"
                + "  visualTags: [],\n"
            )
            block_text = block_text[:ins] + lines_to_add + block_text[ins:]

    # ── Add Verdantha phases after worldBoss ──────────────────────────────────
    if enemy_id == 'verdantha' and 'phases:' not in block_text:
        wb_match = re.search(r"([ \t]+worldBoss: true,\n)", block_text)
        if wb_match:
            ins = wb_match.end()
            block_text = block_text[:ins] + VERDANTHA_PHASES + "\n" + block_text[ins:]

    return block_text


def main():
    path = 'frontend/src/game/content.ts'
    with open(path, 'r') as f:
        src = f.read()

    # Split into enemy blocks by finding each { ... } object in the arrays.
    # Strategy: process by enemy id occurrences.
    # We find each `id: 'xxx'` and process the surrounding block.

    # We'll process the whole file as a string, finding enemy id declarations
    # and determining which { ... } block they belong to, then transforming.

    # Simpler approach: replace each enemy block by finding them via regex.
    # An enemy block starts at an opening { and contains `id: 'xxx'`.
    # We'll iterate through all id declarations and process each block.

    # Find all enemy id positions
    id_pattern = re.compile(r"  \{\n    id: '([^']+)',")
    
    result = src
    offset = 0
    
    for m in id_pattern.finditer(src):
        enemy_id = m.group(1)
        
        # Find the start of this block (the '{' before 'id:')
        block_start = m.start()
        
        # Find the matching closing '},' or '}' by counting braces
        pos = block_start + 1  # after opening {
        depth = 1
        while pos < len(src) and depth > 0:
            if src[pos] == '{':
                depth += 1
            elif src[pos] == '}':
                depth -= 1
            pos += 1
        
        block_end = pos  # includes the closing } and possibly , or ;
        
        block_text = src[block_start:block_end]
        
        # Transform
        new_block = process_enemy_block(block_text, enemy_id)
        
        if new_block != block_text:
            # We need to record all replacements and apply them
            # Since offsets shift, we'll do a final pass
            pass
    
    # Do replacements with offset tracking
    id_matches = list(id_pattern.finditer(src))
    
    # Build list of (start, end, new_text) replacements
    replacements = []
    
    for m in id_matches:
        enemy_id = m.group(1)
        block_start = m.start()
        
        pos = block_start + 1
        depth = 1
        while pos < len(src) and depth > 0:
            if src[pos] == '{':
                depth += 1
            elif src[pos] == '}':
                depth -= 1
            pos += 1
        block_end = pos
        
        block_text = src[block_start:block_end]
        new_block = process_enemy_block(block_text, enemy_id)
        
        if new_block != block_text:
            replacements.append((block_start, block_end, new_block))
    
    # Apply replacements in reverse order to preserve offsets
    replacements.sort(key=lambda x: x[0], reverse=True)
    
    result = src
    for start, end, new_text in replacements:
        result = result[:start] + new_text + result[end:]
    
    # Also handle BOSS_ constants that are declared as plain objects (not inside {})
    # They follow pattern: export const BOSS_XXX: Enemy = {\n  id: 'xxx',
    boss_pattern = re.compile(r"(export const BOSS_\w+: Enemy = \{)\n(  id: '([^']+)',)")
    
    # For BOSS_ objects, find them separately
    boss_id_pattern = re.compile(r"export const BOSS_\w+: Enemy = \{\n  id: '([^']+)',")
    
    for m in boss_id_pattern.finditer(result):
        enemy_id = m.group(1)
        # Find the block: starts at 'export const'
        block_start = m.start()
        # Find 'export const' -> '{'
        brace_start = result.index('{', block_start)
        pos = brace_start + 1
        depth = 1
        while pos < len(result) and depth > 0:
            if result[pos] == '{':
                depth += 1
            elif result[pos] == '}':
                depth -= 1
            pos += 1
        block_end = pos
        
        # The block text for process_enemy_block should be just the { } part
        # but we need to handle the indentation difference (BOSS_ uses 2-space at top level)
        block_text = result[brace_start:block_end]
        
        # For BOSS_ objects, the id line is `  id: '...',` (2-space indent, top-level)
        # Our process_enemy_block regex uses `  id:` which matches this
        new_block = process_enemy_block(block_text, enemy_id)
        
        if new_block != block_text:
            result = result[:brace_start] + new_block + result[block_end:]
    
    with open(path, 'w') as f:
        f.write(result)
    
    print(f"Done. Processed {len(replacements)} enemy blocks.")


if __name__ == '__main__':
    main()
