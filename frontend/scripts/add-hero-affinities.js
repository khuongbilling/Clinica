/**
 * Combat Scaling Push 5 — Hero affinity data injection.
 *
 * Inserts strongAffinities, weakAffinities, and roleTags after every
 * `stats: { ... }` line in content.ts (Hero objects) and heroRoster.ts
 * (RosterHero objects). Safe to re-run — skips lines that already have
 * strongAffinities immediately following the stats line.
 *
 * Mapping logic:
 *   strongAffinities = [element affinity] + role secondary (if distinct)
 *   weakAffinities   = role weakness (or element-opposite for Specialists)
 *   roleTags         = fixed list per HeroRole
 */

const fs   = require('fs');
const path = require('path');

// ── Lookup tables ────────────────────────────────────────────────────────────

const ELEMENT_TO_AFFINITY = {
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

// Secondary strong affinity added for a role (null = element only)
const ROLE_SECONDARY = {
  Stabilizer:    'Fluid / Hydration',
  Restorer:      'Mind / Neuro-Psych',
  Striker:       null,
  Scout:         'Community / Public Health',
  Assessor:      null,
  Analyst:       'Community / Public Health',
  Preventer:     'Protection / Immune',
  Coordinator:   'Community / Public Health',
  SystemsLeader: 'Community / Public Health',
  Educator:      'Community / Public Health',
  Specialist:    null,
};

// Primary weakness affinity per role (null = use element-opposite for Specialists)
const ROLE_WEAKNESS = {
  Stabilizer:    'Wound / Tissue',
  Restorer:      'Fire / Inflammation',
  Striker:       'Mind / Neuro-Psych',
  Scout:         'Storm / Cardiac',
  Assessor:      'Growth / Endocrine',
  Analyst:       'Fire / Inflammation',
  Preventer:     'Energy / Metabolic',
  Coordinator:   'Wound / Tissue',
  SystemsLeader: 'Wound / Tissue',
  Educator:      'Storm / Cardiac',
  Specialist:    null,
};

// Clinical opposite per element — used as Specialist weakness
const ELEMENT_OPPOSITE = {
  Air:        'Filter / Renal',
  River:      'Fire / Inflammation',
  Fire:       'Fluid / Hydration',
  Energy:     'Mind / Neuro-Psych',
  Storm:      'Growth / Endocrine',
  Mind:       'Energy / Metabolic',
  Filter:     'Airway / Respiratory',
  Forge:      'Protection / Immune',
  Protection: 'Wound / Tissue',
  Growth:     'Storm / Cardiac',
};

const ROLE_TAGS = {
  Stabilizer:    ['healer', 'frontline', 'support'],
  Restorer:      ['healer', 'recovery', 'comfort'],
  Striker:       ['damage', 'counter-specialist', 'treatment'],
  Scout:         ['scout', 'utility', 'assessment'],
  Assessor:      ['scout', 'assessor', 'diagnostic'],
  Analyst:       ['analyst', 'diagnostic', 'research'],
  Preventer:     ['protector', 'shield', 'prevention'],
  Coordinator:   ['coordinator', 'support', 'multidisciplinary'],
  SystemsLeader: ['leader', 'multi-role', 'systemic'],
  Educator:      ['educator', 'support', 'community'],
  Specialist:    ['specialist', 'advanced', 'focused'],
};

// ── Computation ──────────────────────────────────────────────────────────────

function computeHeroAffinity(element, role) {
  const primaryAff  = ELEMENT_TO_AFFINITY[element] || 'Fluid / Hydration';
  const secondaryAff = ROLE_SECONDARY[role] || null;

  const strong = [primaryAff];
  if (secondaryAff && secondaryAff !== primaryAff) {
    strong.push(secondaryAff);
  }

  let weakness = ROLE_WEAKNESS[role];
  if (weakness === null || weakness === undefined) {
    // Specialist: use the clinical opposite of their element
    weakness = ELEMENT_OPPOSITE[element] || 'Community / Public Health';
  }
  // Ensure weakness is not already a strength (edge case: e.g. River Stabilizer
  // has strong=['Fluid / Hydration', 'Fluid / Hydration'] deduplicated above,
  // and weakness='Wound / Tissue' which is fine)
  if (strong.includes(weakness)) {
    weakness = 'Community / Public Health';
  }

  const roleTags = ROLE_TAGS[role] || ['support', 'utility'];
  return { strong, weak: [weakness], roleTags };
}

// ── File processor ───────────────────────────────────────────────────────────

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines   = content.split('\n');
  const result  = [];
  let currentElement = '';
  let currentRole    = '';
  let insertedCount  = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track hero element (hero-level field — heroes use `element:`; enemies formerly used
    // `primarySystem:` which was removed in task #388, see add-enemy-affinities.js)
    const elMatch = line.match(/^\s+element:\s+'([A-Za-z]+)'/);
    if (elMatch) currentElement = elMatch[1];

    // Track hero role
    const roleMatch = line.match(/^\s+role:\s+'([A-Za-z]+)'/);
    if (roleMatch) currentRole = roleMatch[1];

    result.push(line);

    // After a stats: { ... } line, inject affinity block
    if (/^\s+stats:\s*\{[^}]+\},?\s*$/.test(line) && currentElement && currentRole) {
      // Idempotency: skip if next line already has affinity data
      const nextLine = lines[i + 1] || '';
      if (nextLine.includes('strongAffinities')) continue;

      const indent   = (line.match(/^(\s+)/) || ['', '    '])[1];
      const affinity = computeHeroAffinity(currentElement, currentRole);

      // Format as single-line arrays to match existing code style
      const fmtArr = (arr) => `[${arr.map(s => `'${s}'`).join(', ')}]`;

      result.push(`${indent}strongAffinities: ${fmtArr(affinity.strong)},`);
      result.push(`${indent}weakAffinities: ${fmtArr(affinity.weak)},`);
      result.push(`${indent}roleTags: ${fmtArr(affinity.roleTags)},`);
      insertedCount++;

      // Reset so a subsequent hero gets a fresh context read
      currentElement = '';
      currentRole    = '';
    }
  }

  fs.writeFileSync(filePath, result.join('\n'), 'utf8');
  console.log(`${path.basename(filePath)}: inserted ${insertedCount} affinity blocks`);
}

// ── Run ──────────────────────────────────────────────────────────────────────

const ROOT = path.join(__dirname, '..');
[
  path.join(ROOT, 'src/game/content.ts'),
  path.join(ROOT, 'src/game/heroRoster.ts'),
].forEach(processFile);
