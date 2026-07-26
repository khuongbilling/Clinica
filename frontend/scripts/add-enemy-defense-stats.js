/**
 * Combat Scaling Push 7 — Enemy defense stats injection.
 *
 * Inserts enemyLevel, corruptionResistance, stabilityPressure,
 * hiddenDefense, affinityResistance (and bossGuard for bosses)
 * after the weaknessTags line in each enemy object in content.ts.
 *
 * Data is keyed by enemy id for precise control. Unmapped enemies
 * receive defaults derived from their difficulty tier.
 *
 * Safe to re-run — skips objects that already have enemyLevel.
 */

const fs   = require('fs');
const path = require('path');

// ── Per-enemy defense data ───────────────────────────────────────────────────

const ENEMY_DEFENSE = {
  // ── Tutorial / Chapter 1 (difficulty 1) — extremely forgiving ──────────────
  dehydration_wisp:        { corruptionResistance: 0.00, stabilityPressure: 0.00, hiddenDefense: 0.05, affinityResistance: 0.00 },
  air_sprite:              { corruptionResistance: 0.00, stabilityPressure: 0.00, hiddenDefense: 0.05, affinityResistance: 0.00 },
  river_sludge:            { corruptionResistance: 0.02, stabilityPressure: 0.00, hiddenDefense: 0.05, affinityResistance: 0.00 },
  energy_lock:             { corruptionResistance: 0.02, stabilityPressure: 0.00, hiddenDefense: 0.05, affinityResistance: 0.00 },
  fluid_phantom:           { corruptionResistance: 0.04, stabilityPressure: 0.00, hiddenDefense: 0.08, affinityResistance: 0.00 },

  // ── Chapter 2 (difficulty 2) ────────────────────────────────────────────────
  fire_imp:                { corruptionResistance: 0.05, stabilityPressure: 0.00, hiddenDefense: 0.08, affinityResistance: 0.00 },
  pulmora_wisp:            { corruptionResistance: 0.05, stabilityPressure: 0.00, hiddenDefense: 0.08, affinityResistance: 0.00 },
  mind_fog:                { corruptionResistance: 0.06, stabilityPressure: 0.02, hiddenDefense: 0.10, affinityResistance: 0.05 },

  // ── Chapter 3 (difficulty 3) ────────────────────────────────────────────────
  septara_seed:            { corruptionResistance: 0.10, stabilityPressure: 0.03, hiddenDefense: 0.12, affinityResistance: 0.05 },
  cardion_echo:            { corruptionResistance: 0.10, stabilityPressure: 0.03, hiddenDefense: 0.12, affinityResistance: 0.05 },
  glycora_spark:           { corruptionResistance: 0.10, stabilityPressure: 0.03, hiddenDefense: 0.12, affinityResistance: 0.05 },
  electrox_flicker:        { corruptionResistance: 0.10, stabilityPressure: 0.03, hiddenDefense: 0.12, affinityResistance: 0.05 },
  fever_shade:             { corruptionResistance: 0.12, stabilityPressure: 0.04, hiddenDefense: 0.14, affinityResistance: 0.05 },

  // ── Chapter 4 (difficulty 4) ────────────────────────────────────────────────
  priority_surge:          { corruptionResistance: 0.14, stabilityPressure: 0.06, hiddenDefense: 0.16, affinityResistance: 0.08 },
  overload_shade:          { corruptionResistance: 0.14, stabilityPressure: 0.06, hiddenDefense: 0.16, affinityResistance: 0.08 },
  gale_spirit:             { corruptionResistance: 0.14, stabilityPressure: 0.06, hiddenDefense: 0.16, affinityResistance: 0.08 },

  // ── Chapter 5 (difficulty 5) — regular encounters ──────────────────────────
  recovery_lapse:          { corruptionResistance: 0.16, stabilityPressure: 0.08, hiddenDefense: 0.18, affinityResistance: 0.10 },
  fatigue_veil:            { corruptionResistance: 0.16, stabilityPressure: 0.08, hiddenDefense: 0.18, affinityResistance: 0.10 },

  // ── World Event Boss (difficulty 5, worldBoss) ──────────────────────────────
  verdantha:               { corruptionResistance: 0.25, stabilityPressure: 0.12, hiddenDefense: 0.28, affinityResistance: 0.15, bossGuard: true },

  // ── Chapter 6 (difficulty 6) ────────────────────────────────────────────────
  ward_cascade:            { corruptionResistance: 0.18, stabilityPressure: 0.10, hiddenDefense: 0.20, affinityResistance: 0.10 },

  // ── Chapter 9 / Real-world encounters (difficulty 9) ────────────────────────
  dehydration_specter:     { corruptionResistance: 0.22, stabilityPressure: 0.14, hiddenDefense: 0.24, affinityResistance: 0.12 },
  true_dehydration_wraith: { corruptionResistance: 0.22, stabilityPressure: 0.14, hiddenDefense: 0.24, affinityResistance: 0.12 },
  breathless_gale_spirit:  { corruptionResistance: 0.22, stabilityPressure: 0.14, hiddenDefense: 0.24, affinityResistance: 0.12 },
  burning_fever_shade:     { corruptionResistance: 0.22, stabilityPressure: 0.14, hiddenDefense: 0.24, affinityResistance: 0.12 },
  drought_river_shade:     { corruptionResistance: 0.22, stabilityPressure: 0.14, hiddenDefense: 0.24, affinityResistance: 0.12 },
  confusion_veil:          { corruptionResistance: 0.22, stabilityPressure: 0.14, hiddenDefense: 0.24, affinityResistance: 0.12 },
  glycemic_rupture:        { corruptionResistance: 0.22, stabilityPressure: 0.14, hiddenDefense: 0.24, affinityResistance: 0.12 },

  // ── Affliction enemies (companion wisps/wraiths, no hidden clues) ────────────
  hypoxia_wisp:            { corruptionResistance: 0.04, stabilityPressure: 0.00, hiddenDefense: 0.00, affinityResistance: 0.00 },
  mucus_wisp:              { corruptionResistance: 0.04, stabilityPressure: 0.00, hiddenDefense: 0.00, affinityResistance: 0.00 },
  panic_wraith:            { corruptionResistance: 0.04, stabilityPressure: 0.00, hiddenDefense: 0.00, affinityResistance: 0.00 },
  wheeze_guard:            { corruptionResistance: 0.04, stabilityPressure: 0.00, hiddenDefense: 0.00, affinityResistance: 0.00 },
  shock_spike:             { corruptionResistance: 0.06, stabilityPressure: 0.00, hiddenDefense: 0.00, affinityResistance: 0.00 },

  // ── Standalone Boss exports ─────────────────────────────────────────────────
  lord_imbalance:          { corruptionResistance: 0.28, stabilityPressure: 0.15, hiddenDefense: 0.30, affinityResistance: 0.15, bossGuard: true },
  silent_infarct:          { corruptionResistance: 0.35, stabilityPressure: 0.20, hiddenDefense: 0.40, affinityResistance: 0.20, bossGuard: true },
};

// ── Fallback by difficulty tier ──────────────────────────────────────────────

function defaultDefense(difficulty) {
  if (difficulty <= 1) return { corruptionResistance: 0.02, stabilityPressure: 0.00, hiddenDefense: 0.06, affinityResistance: 0.00 };
  if (difficulty <= 2) return { corruptionResistance: 0.06, stabilityPressure: 0.01, hiddenDefense: 0.09, affinityResistance: 0.02 };
  if (difficulty <= 3) return { corruptionResistance: 0.11, stabilityPressure: 0.04, hiddenDefense: 0.13, affinityResistance: 0.05 };
  if (difficulty <= 5) return { corruptionResistance: 0.16, stabilityPressure: 0.08, hiddenDefense: 0.18, affinityResistance: 0.08 };
  if (difficulty <= 7) return { corruptionResistance: 0.18, stabilityPressure: 0.10, hiddenDefense: 0.20, affinityResistance: 0.10 };
  return { corruptionResistance: 0.22, stabilityPressure: 0.14, hiddenDefense: 0.25, affinityResistance: 0.12 };
}

// ── File processor ───────────────────────────────────────────────────────────

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines   = content.split('\n');
  const result  = [];
  let currentId         = '';
  let currentDifficulty = 1;
  let insertedCount     = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track enemy id
    const idMatch = line.match(/^\s+id:\s+'([^']+)'/);
    if (idMatch) currentId = idMatch[1];

    // Track difficulty for fallback
    const diffMatch = line.match(/^\s+difficulty:\s+(\d+)/);
    if (diffMatch) currentDifficulty = parseInt(diffMatch[1], 10);

    result.push(line);

    // Insert after weaknessTags line
    if (/^\s+weaknessTags:/.test(line) && currentId) {
      // Idempotency: skip if next line already has enemyLevel
      const nextLine = lines[i + 1] || '';
      if (nextLine.includes('enemyLevel')) continue;

      const indent  = (line.match(/^(\s+)/) || ['', '    '])[1];
      const data    = ENEMY_DEFENSE[currentId] || defaultDefense(currentDifficulty);
      const boss    = data.bossGuard === true;

      result.push(`${indent}enemyLevel: ${currentDifficulty},`);
      result.push(`${indent}corruptionResistance: ${data.corruptionResistance},`);
      result.push(`${indent}stabilityPressure: ${data.stabilityPressure},`);
      result.push(`${indent}hiddenDefense: ${data.hiddenDefense},`);
      result.push(`${indent}affinityResistance: ${data.affinityResistance},`);
      if (boss) {
        result.push(`${indent}bossGuard: true,`);
      }
      insertedCount++;

      // Reset for next enemy
      currentId = '';
    }
  }

  fs.writeFileSync(filePath, result.join('\n'), 'utf8');
  console.log(`${path.basename(filePath)}: inserted ${insertedCount} enemy defense blocks`);
}

processFile(path.join(__dirname, '../src/game/content.ts'));
