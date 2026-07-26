/**
 * Combat Scaling Push 5 — Enemy affinity data injection.
 *
 * Inserts primaryAffinity, secondaryAffinity (when applicable),
 * resistanceTags, and weaknessTags after every `difficulty: N,` line
 * in content.ts. Covers all 27 ENEMIES array entries plus the three
 * standalone boss exports (BOSS_LORD_IMBALANCE, BOSS_SILENT_INFARCT;
 * BOSS_VERDANTHA is a pointer so its entry in ENEMIES is already covered).
 *
 * Safe to re-run — skips blocks that already have primaryAffinity.
 */

const fs   = require('fs');
const path = require('path');

// ── Lookup tables ────────────────────────────────────────────────────────────

const SYSTEM_TO_AFFINITY = {
  Air:        'Airway / Respiratory',
  River:      'Fluid / Hydration',
  Fire:       'Fire / Inflammation',
  Energy:     'Energy / Metabolic',
  Storm:      'Storm / Cardiac',
  Mind:       'Mind / Neuro-Psych',
  Filter:     'Filter / Renal',
  Forge:      'Wound / Tissue',
  Protection: 'Protection / Immune',
  Growth:     'Growth / Endocrine',
};

// Approaches that are LESS effective against this primary system
const SYSTEM_RESISTANCE = {
  Air:        ['aggressive sedation', 'excessive fluid loading'],
  River:      ['fluid restriction', 'diuresis without monitoring'],
  Fire:       ['immunosuppression', 'cooling without source control'],
  Energy:     ['withholding glucose', 'dietary restriction alone'],
  Storm:      ['aggressive fluid bolus', 'stimulants'],
  Mind:       ['physical restraint', 'invasive procedures'],
  Filter:     ['nephrotoxic agents', 'contrast media'],
  Forge:      ['delayed wound care', 'contamination exposure'],
  Protection: ['standard precautions only', 'unprotected contact'],
  Growth:     ['symptom management only', 'hormonal suppression'],
};

// Approaches that work BEST against this primary system
const SYSTEM_WEAKNESS = {
  Air:        ['bronchodilators', 'supplemental oxygen', 'airway positioning'],
  River:      ['fluid resuscitation', 'hemodynamic monitoring', 'vasopressor support'],
  Fire:       ['antimicrobial therapy', 'source control', 'antipyretics'],
  Energy:     ['glucose correction', 'insulin therapy', 'nutritional support'],
  Storm:      ['cardiac monitoring', 'rate control', 'antiarrhythmics'],
  Mind:       ['therapeutic communication', 'de-escalation', 'psychiatric consultation'],
  Filter:     ['diuretics', 'electrolyte correction', 'renal replacement therapy'],
  Forge:      ['wound debridement', 'antibiotic therapy', 'surgical intervention'],
  Protection: ['isolation precautions', 'antimicrobial therapy', 'immunoglobulin'],
  Growth:     ['endocrine replacement', 'metabolic correction', 'hormonal therapy'],
};

// ── File processor ───────────────────────────────────────────────────────────

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines   = content.split('\n');
  const result  = [];
  let currentPrimary   = '';
  let currentSecondary = '';
  let insertedCount    = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track primarySystem — only on enemy objects (heroes use `element:`)
    const primaryMatch = line.match(/^\s+primarySystem:\s+'([A-Za-z]+)'/);
    if (primaryMatch) {
      currentPrimary   = primaryMatch[1];
      currentSecondary = ''; // reset secondary when primary changes
    }

    // Track secondarySystem
    const secondaryMatch = line.match(/^\s+secondarySystem:\s+'([A-Za-z]+)'/);
    if (secondaryMatch) currentSecondary = secondaryMatch[1];

    result.push(line);

    // After a difficulty: N, line, inject affinity block
    if (/^\s+difficulty:\s+\d+,/.test(line) && currentPrimary) {
      // Idempotency: skip if next line already has affinity data
      const nextLine = lines[i + 1] || '';
      if (nextLine.includes('primaryAffinity')) continue;

      const indent      = (line.match(/^(\s+)/) || ['', '    '])[1];
      const primaryAff  = SYSTEM_TO_AFFINITY[currentPrimary];
      const secondaryAff = currentSecondary ? SYSTEM_TO_AFFINITY[currentSecondary] : null;
      const resistance  = SYSTEM_RESISTANCE[currentPrimary] || [];
      const weakness    = SYSTEM_WEAKNESS[currentPrimary]   || [];

      // Format arrays as single-line with single-quoted strings
      const fmtArr = (arr) => `[${arr.map(s => `'${s}'`).join(', ')}]`;

      result.push(`${indent}primaryAffinity: '${primaryAff}',`);
      if (secondaryAff) {
        result.push(`${indent}secondaryAffinity: '${secondaryAff}',`);
      }
      result.push(`${indent}resistanceTags: ${fmtArr(resistance)},`);
      result.push(`${indent}weaknessTags: ${fmtArr(weakness)},`);
      insertedCount++;

      // Reset for next enemy
      currentPrimary   = '';
      currentSecondary = '';
    }
  }

  fs.writeFileSync(filePath, result.join('\n'), 'utf8');
  console.log(`${path.basename(filePath)}: inserted ${insertedCount} enemy affinity blocks`);
}

// ── Run ──────────────────────────────────────────────────────────────────────

processFile(path.join(__dirname, '../src/game/content.ts'));
