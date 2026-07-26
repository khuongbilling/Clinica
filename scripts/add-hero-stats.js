/**
 * Combat Scaling Push 3 — Add HeroCombatStats to all heroes.
 *
 * Inserts a `stats: { insight, carePower, intervention, guard, coordination }`
 * field after the `element:` line of every hero in:
 *   - frontend/src/game/heroRoster.ts  (RosterHero, rarityTier-based)
 *   - frontend/src/game/content.ts     (Hero, numeric rarity-based)
 *
 * Values are deterministic (seeded by heroId + statKey) and role-appropriate:
 *   primary stat  → upper 35 % of the rarity range
 *   secondary stat → upper 40 % of the rarity range
 *   other stats    → lower 65 % of the rarity range
 *
 * Safe to re-run — skips any `element:` line already followed by `stats:`.
 */

const fs   = require('fs');
const path = require('path');

// ── Seeded deterministic int ─────────────────────────────────────────────────
function seededInt(seed, min, max) {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  const abs = Math.abs(h);
  return (abs % (max - min + 1)) + min;
}

// ── Rarity → stat range ──────────────────────────────────────────────────────
const RANGES = {
  common:    { min: 5,  max: 12 },
  uncommon:  { min: 8,  max: 16 },
  rare:      { min: 12, max: 22 },
  epic:      { min: 18, max: 30 },
  legendary: { min: 30, max: 45 }, // prologue loaners (rarity 5)
  mythic:    { min: 38, max: 55 }, // The Prodigy (rarity 6)
};

function numericRarityKey(n) {
  if (n >= 6) return 'mythic';
  if (n >= 5) return 'legendary';
  if (n >= 4) return 'epic';
  if (n >= 3) return 'rare';
  if (n >= 2) return 'uncommon';
  return 'common';
}

// ── Role → which stats are primary / secondary ───────────────────────────────
const ROLE_EMPHASIS = {
  Stabilizer:    { primary: 'carePower',    secondary: 'guard' },
  Restorer:      { primary: 'carePower',    secondary: 'coordination' },
  Striker:       { primary: 'intervention', secondary: 'insight' },
  Scout:         { primary: 'insight',      secondary: 'coordination' },
  Assessor:      { primary: 'insight',      secondary: 'intervention' },
  Analyst:       { primary: 'insight',      secondary: 'coordination' },
  Preventer:     { primary: 'guard',        secondary: 'coordination' },
  Coordinator:   { primary: 'coordination', secondary: 'guard' },
  SystemsLeader: { primary: 'coordination', secondary: 'insight' },
  Educator:      { primary: 'coordination', secondary: 'insight' },
  Specialist:    { primary: 'intervention', secondary: 'guard' },
};

const STAT_KEYS = ['insight', 'carePower', 'intervention', 'guard', 'coordination'];

function generateStats(id, rarityKey, role) {
  const { min, max } = RANGES[rarityKey] || RANGES.common;
  const spread = max - min;
  const em = ROLE_EMPHASIS[role] || { primary: 'carePower', secondary: 'coordination' };
  const stats = {};
  for (const key of STAT_KEYS) {
    let lo, hi;
    if (key === em.primary) {
      lo = Math.round(min + spread * 0.65);
      hi = max;
    } else if (key === em.secondary) {
      lo = Math.round(min + spread * 0.40);
      hi = max;
    } else {
      lo = min;
      hi = Math.round(min + spread * 0.65);
    }
    stats[key] = Math.max(min, Math.min(max, seededInt(id + ':' + key, lo, hi)));
  }
  return stats;
}

function statsLine(indent, stats) {
  const inner = STAT_KEYS.map(k => `${k}: ${stats[k]}`).join(', ');
  return `${indent}stats: { ${inner} },`;
}

// ── Main transform ───────────────────────────────────────────────────────────
function transformFile(filePath) {
  const raw   = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  const out   = [];

  let currentId        = null;
  let currentRole      = null;
  let currentRarityTier = null;
  let currentRarityNum  = null;
  let statsInserted    = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── Track hero context ─────────────────────────────────────────────────
    const mId   = line.match(/^\s+id:\s+'([^']+)'/);
    if (mId) {
      currentId         = mId[1];
      currentRole       = null;
      currentRarityTier = null;
      currentRarityNum  = null;
      statsInserted     = false;
    }

    const mRt = line.match(/^\s+rarityTier:\s+'([^']+)'/);
    if (mRt) currentRarityTier = mRt[1];

    const mRn = line.match(/^\s+rarity:\s+(\d+),/);
    if (mRn) currentRarityNum = parseInt(mRn[1], 10);

    const mRole = line.match(/^\s+role:\s+'([^']+)'/);
    if (mRole) currentRole = mRole[1];

    out.push(line);

    // ── Insert stats after `element: '...',` ───────────────────────────────
    const mElem = line.match(/^(\s+)element:\s+'[^']+',\s*$/);
    if (mElem && currentId && !statsInserted) {
      // Determine rarity key
      let rarityKey;
      if (currentRarityTier) {
        rarityKey = currentRarityTier; // heroRoster.ts path
      } else if (currentRarityNum != null) {
        rarityKey = numericRarityKey(currentRarityNum); // content.ts path
      } else {
        rarityKey = 'common'; // fallback
      }

      // Check that the NEXT non-blank line is NOT already `stats:`
      let nextLine = (lines[i + 1] || '').trim();
      if (nextLine.startsWith('stats:')) {
        statsInserted = true;
        continue; // already done — skip insert
      }

      const indent = mElem[1];
      const role   = currentRole || 'Stabilizer';
      const stats  = generateStats(currentId, rarityKey, role);
      out.push(statsLine(indent, stats));
      statsInserted = true;
    }
  }

  const result = out.join('\n');
  fs.writeFileSync(filePath, result, 'utf8');
  console.log(`✓ ${path.basename(filePath)}  (${lines.length} → ${out.length} lines, +${out.length - lines.length} inserted)`);
}

// ── Run ──────────────────────────────────────────────────────────────────────
const root     = path.join(__dirname, '..');
const rosterTs = path.join(root, 'frontend/src/game/heroRoster.ts');
const contentTs = path.join(root, 'frontend/src/game/content.ts');

console.log('Combat Scaling Push 3 — adding HeroCombatStats to all heroes...\n');
transformFile(rosterTs);
transformFile(contentTs);
console.log('\nDone. Run typecheck to confirm zero errors.');
