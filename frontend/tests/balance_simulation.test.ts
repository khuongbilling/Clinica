/**
 * tests/balance_simulation.test.ts — Push 15: large-sample canonical Journey
 * encounter balance report.
 *
 * Generates 10,000 simulated chapter maps (10 topologies × 1,000 encounter
 * seeds) for each representative chapter × shift combination, then prints a
 * structured balance report and exits 1 if any flagged thresholds are breached.
 *
 * FEATURE FLAGS
 * ─────────────────────────────────────────────────────────────────────────────
 * This script queries the canonical generator directly — it does NOT respect
 * WARD_EVENTS_V1 or MULTI_THREAT_COMBAT_V1.  Ward events are reported as the
 * generator produces them; the flags only suppress them in the live lifecycle.
 *
 * FLAG THRESHOLDS
 * ─────────────────────────────────────────────────────────────────────────────
 * ℹ️  Area Boss cap (3) frequency is reported for balancing visibility.
 *     It is not a failure by itself: late chapters intentionally reach the
 *     canonical hard cap often. The hard maximum remains an invariant.
 * ⚠️  Merchant common too early: P(≥1 merchant) > 25 % before chapter 5.
 * ⚠️  Day density cap hit on > 80 % of day maps.
 * ⚠️  Night avg battles > 85 % of day avg battles.
 * ⚠️  None% of eligible tiles < 25 %.
 * ⚠️  Any invalid encounter-rate percentage total (any chapter-shift row ≠ 100 %).
 * ⚠️  Impossible chapter gate: area boss always 0 % on a chapter that requires
 *     keys from area bosses (chapter ≥ 4 per bookOneUnlocks).
 *
 * Usage:
 *   npx sucrase-node tests/balance_simulation.test.ts
 *   npx sucrase-node tests/balance_simulation.test.ts --csv   (output CSV lines)
 */

import { generateHexTopology }        from '../src/game/journeyMap/topology';
import { assignCanonicalEncounters }   from '../src/game/journeyMap/canonicalEncounters';
import { availableShifts, isSystemUnlocked, getBookIMapTileCount }
                                       from '../src/game/journeyMap/bookOneUnlocks';
import {
  canonicalEnemyDensityCapBp,
  CANONICAL_TOTAL_BP,
  CANONICAL_AREA_BOSS_HARD_MAX,
  canonicalTileCount,
}                                      from '../src/game/journeyMap/canonicalConfig';
import { ALL_WARD_EVENT_SUBTYPES }     from '../src/game/journeyMap/wardEventSubtypes';
import type { TimeOfDay }              from '../src/game/journeyMap/types';
import type { WardEventSubtype }       from '../src/game/journeyMap/canonicalEncounters';

// ── Configuration ─────────────────────────────────────────────────────────────

const MAPS_PER_COMBO        = 10_000;
const TOPOLOGIES_PER_CHAPTER = 10;
const SEEDS_PER_TOPOLOGY    = MAPS_PER_COMBO / TOPOLOGIES_PER_CHAPTER; // 1 000

const REPRESENTATIVE_CHAPTERS = [4, 5, 10, 11, 20, 21, 30, 40, 50];

// Flag thresholds
const FLAG_MERCHANT_EARLY_PCT    = 0.25;  // > 25 % P(≥1 merchant) before ch5
const FLAG_DAY_CAP_EXCESSIVE_PCT = 0.80;  // > 80 %
const FLAG_NIGHT_CLOSE_TO_DAY    = 0.85;  // night avg > 85 % of day avg
const FLAG_NONE_MIN_PCT          = 0.25;  // none% < 25 %
const FLAG_RATE_TOLERANCE        = 0.005; // ±0.5 pp tolerance for % totals

const CSV_MODE = process.argv.includes('--csv');

// ── Threat count table (mirrors threatGroups.ts COUNT_ROWS, not imported) ─────

interface ThreatCountEntry { count: 1 | 2 | 3; weight: number; }
type ThreatCountRow = { match: (ch: number) => boolean; entries: ThreatCountEntry[] };

const THREAT_COUNT_ROWS: ThreatCountRow[] = [
  { match: ch => ch <= 1,              entries: [{ count: 1, weight: 10_000 }] },
  { match: ch => ch === 2,             entries: [{ count: 1, weight: 7_000 }, { count: 2, weight: 3_000 }] },
  { match: ch => ch === 3,             entries: [{ count: 2, weight: 10_000 }] },
  { match: ch => ch >= 4 && ch <= 6,   entries: [{ count: 2, weight: 8_000 }, { count: 3, weight: 2_000 }] },
  { match: ch => ch >= 7 && ch <= 10,  entries: [{ count: 2, weight: 4_000 }, { count: 3, weight: 6_000 }] },
  { match: () => true,                 entries: [{ count: 2, weight: 2_500 }, { count: 3, weight: 7_500 }] },
];

function threatCountProbs(chapter: number): Record<1 | 2 | 3, number> {
  const row = THREAT_COUNT_ROWS.find(r => r.match(chapter))!;
  const result: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
  for (const e of row.entries) result[e.count] = e.weight / 10_000;
  return result;
}

// ── Per-combo statistics ──────────────────────────────────────────────────────

interface ComboStats {
  chapter:         number;
  shift:           TimeOfDay;
  maps:            number;
  eligibleTiles:   number;
  // Encounter counts (totals across all maps)
  totalBattle:     number;
  totalAreaBoss:   number;
  totalTreasure:   number;
  totalMerchant:   number;
  totalWardEvent:  number;
  totalNone:       number;
  // Min / max battles
  minBattle:       number;
  maxBattle:       number;
  // Density cap
  capBp:           number;
  capHits:         number;
  // Area boss distribution (0–3)
  areaBossDist:    [number, number, number, number]; // [0,1,2,3] counts
  // Ward event subtype totals
  wardSubtypes:    Record<WardEventSubtype, number>;
  // Merchant presence
  merchantMaps:    number;
}

function emptyStats(chapter: number, shift: TimeOfDay, eligibleTiles: number): ComboStats {
  const wardSubtypes = {} as Record<WardEventSubtype, number>;
  for (const s of ALL_WARD_EVENT_SUBTYPES) wardSubtypes[s] = 0;
  return {
    chapter, shift, maps: 0, eligibleTiles,
    totalBattle: 0, totalAreaBoss: 0, totalTreasure: 0,
    totalMerchant: 0, totalWardEvent: 0, totalNone: 0,
    minBattle: Infinity, maxBattle: -Infinity,
    capBp: canonicalEnemyDensityCapBp(shift),
    capHits: 0,
    areaBossDist: [0, 0, 0, 0],
    wardSubtypes,
    merchantMaps: 0,
  };
}

// ── Report formatting ─────────────────────────────────────────────────────────

function pct(n: number, total: number): string {
  return total > 0 ? `${(n / total * 100).toFixed(1)}%` : '  -  ';
}
function avg(n: number, total: number): string {
  return total > 0 ? (n / total).toFixed(2) : '-';
}
function bar(v: number, width = 20): string {
  const filled = Math.round(v * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}
function hdr(title: string): void {
  if (CSV_MODE) return;
  console.log('\n' + '─'.repeat(72));
  console.log(title);
  console.log('─'.repeat(72));
}

// ── Flag collector ────────────────────────────────────────────────────────────

const FLAGS: string[] = [];

function flag(msg: string): void {
  FLAGS.push(msg);
  if (!CSV_MODE) console.log(`  ⚠️  ${msg}`);
}

// ── Main simulation ───────────────────────────────────────────────────────────

function runSimulation(): void {
  if (!CSV_MODE) {
    console.log('\n' + '═'.repeat(72));
    console.log('CLINICA — CANONICAL ENCOUNTER BALANCE REPORT');
    console.log(`${MAPS_PER_COMBO.toLocaleString()} maps per chapter-shift combination`);
    console.log(`${TOPOLOGIES_PER_CHAPTER} topologies × ${SEEDS_PER_TOPOLOGY} encounter seeds`);
    console.log('═'.repeat(72));
  }

  if (CSV_MODE) {
    console.log(
      'chapter,shift,eligible_tiles,' +
      'none_pct,battle_pct,area_boss_pct,treasure_pct,merchant_pct,ward_event_pct,' +
      'avg_battle,avg_area_boss,avg_treasure,avg_merchant,avg_ward_event,' +
      'min_battle,max_battle,cap_hit_pct,boss0_pct,boss1_pct,boss2_pct,boss3_pct,' +
      'merchant_presence_pct,' +
      'avg_support_ally,avg_protocol_card,avg_ward_blessing,avg_ward_hazard,' +
      'threat_1_pct,threat_2_pct,threat_3_pct'
    );
  }

  // Collect all stats for cross-chapter comparisons
  const allStats: ComboStats[] = [];

  for (const chapter of REPRESENTATIVE_CHAPTERS) {
    const shifts = availableShifts(chapter);

    // Pre-generate topologies for this chapter
    const topos = Array.from({ length: TOPOLOGIES_PER_CHAPTER }, (_, i) =>
      generateHexTopology({ chapter, seed: `sim:ch${chapter}:topo${i}` }),
    );

    const eligibleTiles = topos[0].tiles.length - 2; // subtract start + gate

    for (const shift of shifts) {
      const stats = emptyStats(chapter, shift, eligibleTiles);

      for (let ti = 0; ti < TOPOLOGIES_PER_CHAPTER; ti++) {
        const topology = topos[ti];
        for (let si = 0; si < SEEDS_PER_TOPOLOGY; si++) {
          const seed = `sim:ch${chapter}:topo${ti}:seed${si}`;
          const enc  = assignCanonicalEncounters({ chapter, seed, timeOfDay: shift, topology });

          stats.maps++;
          if (enc.areaBossCount > CANONICAL_AREA_BOSS_HARD_MAX) {
            throw new Error(
              `[${seed}] area boss count ${enc.areaBossCount} exceeds ` +
              `hard maximum ${CANONICAL_AREA_BOSS_HARD_MAX}`,
            );
          }
          stats.totalBattle    += enc.battleCount;
          stats.totalAreaBoss  += enc.areaBossCount;
          stats.totalTreasure  += enc.treasureCount;
          stats.totalMerchant  += enc.merchantCount;
          stats.totalWardEvent += enc.wardEventCount;

          const noneEligible = eligibleTiles
            - enc.battleCount - enc.areaBossCount
            - enc.treasureCount - enc.merchantCount
            - enc.wardEventCount;
          stats.totalNone += noneEligible;

          if (enc.battleCount < stats.minBattle) stats.minBattle = enc.battleCount;
          if (enc.battleCount > stats.maxBattle) stats.maxBattle = enc.battleCount;

          // Density cap (bp-based, floor)
          const cap = Math.floor(eligibleTiles * stats.capBp / CANONICAL_TOTAL_BP);
          if (enc.battleCount >= cap) stats.capHits++;

          // Area boss distribution
          const bossBucket = Math.min(enc.areaBossCount, 3) as 0 | 1 | 2 | 3;
          stats.areaBossDist[bossBucket]++;

          // Merchant presence
          if (enc.merchantCount > 0) stats.merchantMaps++;

          // Ward event subtypes
          if (enc.wardEventCount > 0) {
            for (const tile of enc.tiles) {
              if (tile.encounter === 'wardEvent' && tile.wardEventSubtype) {
                stats.wardSubtypes[tile.wardEventSubtype]++;
              }
            }
          }
        }
      }

      allStats.push(stats);
      printComboReport(stats);
    }
  }

  // ── Cross-chapter checks ──────────────────────────────────────────────────

  checkFlags(allStats);

  // ── Threat group distribution summary (analytical) ────────────────────────

  if (!CSV_MODE) {
    hdr('THREAT GROUP SIZE DISTRIBUTION (analytical, from COUNT_ROWS)');
    for (const chapter of REPRESENTATIVE_CHAPTERS) {
      const probs = threatCountProbs(chapter);
      console.log(
        `  Ch ${String(chapter).padStart(2)}  ` +
        `1-threat: ${(probs[1] * 100).toFixed(0).padStart(3)}%  ` +
        `2-threat: ${(probs[2] * 100).toFixed(0).padStart(3)}%  ` +
        `3-threat: ${(probs[3] * 100).toFixed(0).padStart(3)}%  ` +
        `│ ${bar(probs[1])} 1  ${bar(probs[2])} 2  ${bar(probs[3])} 3`,
      );
    }

    // ── Flag summary ────────────────────────────────────────────────────────

    console.log('\n' + '═'.repeat(72));
    if (FLAGS.length === 0) {
      console.log('✅  No balance flags raised across all simulated chapters and shifts.');
    } else {
      console.log(`🚩  ${FLAGS.length} BALANCE FLAG${FLAGS.length > 1 ? 'S' : ''} RAISED:`);
      FLAGS.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    }
    console.log('═'.repeat(72));
  }

  if (FLAGS.length > 0) process.exit(1);
}

// ── Per-combo report printer ──────────────────────────────────────────────────

function printComboReport(s: ComboStats): void {
  const { chapter, shift, maps, eligibleTiles } = s;
  const avgBattle    = s.totalBattle    / maps;
  const avgAreaBoss  = s.totalAreaBoss  / maps;
  const avgTreasure  = s.totalTreasure  / maps;
  const avgMerchant  = s.totalMerchant  / maps;
  const avgWardEvent = s.totalWardEvent / maps;
  const avgNone      = s.totalNone      / maps;

  const cap      = Math.floor(eligibleTiles * s.capBp / CANONICAL_TOTAL_BP);
  const capHitPct = s.capHits / maps;

  hdr(`CHAPTER ${chapter} — ${shift.toUpperCase()} SHIFT  (${eligibleTiles} eligible tiles, cap=${cap})`);

  // ── Encounter rates ───────────────────────────────────────────────────────
  const total = avgNone + avgBattle + avgAreaBoss + avgTreasure + avgMerchant + avgWardEvent;
  console.log('  Encounter rates (avg per map, of eligible tiles):');
  const row = (label: string, val: number) => {
    const p = val / eligibleTiles;
    return `    ${label.padEnd(14)} ${(p * 100).toFixed(1).padStart(5)}%  avg ${val.toFixed(2).padStart(5)} tiles  ${bar(p)}`;
  };
  console.log(row('None',       avgNone));
  console.log(row('Battle',     avgBattle)    + `  (cap ${cap}; hit ${(capHitPct * 100).toFixed(1)}%)`);
  console.log(row('Area Boss',  avgAreaBoss)  + `  (max=${CANONICAL_AREA_BOSS_HARD_MAX})`);
  console.log(row('Treasure',   avgTreasure));
  console.log(row('Merchant',   avgMerchant)  + `  (≥1 on ${(s.merchantMaps / maps * 100).toFixed(1)}% of maps)`);
  console.log(row('Ward Event', avgWardEvent) + `  (WARD_EVENTS_V1 currently false)`);

  const rateTotal = (avgBattle + avgAreaBoss + avgTreasure + avgMerchant + avgWardEvent + avgNone) / eligibleTiles;
  console.log(`    Rate total:    ${(rateTotal * 100).toFixed(2)}% ${Math.abs(rateTotal - 1) < FLAG_RATE_TOLERANCE ? '✅' : '⚠️  INVALID'}`);

  // ── Area Boss distribution ────────────────────────────────────────────────
  console.log('\n  Area Boss distribution across maps:');
  for (let i = 0; i <= 3; i++) {
    const p = s.areaBossDist[i] / maps;
    console.log(`    ${i} bosses: ${(p * 100).toFixed(1).padStart(5)}%  ${bar(p)}`);
  }

  // ── Ward Event subtypes ───────────────────────────────────────────────────
  console.log('\n  Ward Event subtypes (per avg ward event tile):');
  if (s.totalWardEvent === 0) {
    console.log('    (none on this shift+chapter combination)');
  } else {
    for (const sub of ALL_WARD_EVENT_SUBTYPES) {
      const count = s.wardSubtypes[sub];
      const p     = count / s.totalWardEvent;
      const perMap = count / maps;
      console.log(
        `    ${sub.padEnd(22)} ${(p * 100).toFixed(1).padStart(5)}%  avg/map ${perMap.toFixed(3).padStart(6)}  ${bar(p)}`,
      );
    }
    // Opportunity averages from ward event subtypes
    const opp = (sub: WardEventSubtype) => (s.wardSubtypes[sub] / maps).toFixed(3);
    console.log('\n  Avg per-map opportunities (from Ward Events):');
    console.log(`    Support Ally      ${opp('support_ally')}`);
    console.log(`    Protocol Card     ${opp('protocol_card')}`);
    console.log(`    Ward Blessing     ${opp('ward_blessing')}`);
    console.log(`    Ward Hazard       ${opp('ward_hazard')}`);
  }

  // ── Min / max ─────────────────────────────────────────────────────────────
  console.log(`\n  Battle range: min=${s.minBattle}  max=${s.maxBattle}  avg=${avgBattle.toFixed(2)}`);

  // ── Threat group sizes ────────────────────────────────────────────────────
  const tp = threatCountProbs(chapter);
  console.log(`  Threat group (${avgBattle.toFixed(1)} avg battles/map):`);
  console.log(`    1-threat: ${(tp[1] * 100).toFixed(0)}%  2-threat: ${(tp[2] * 100).toFixed(0)}%  3-threat: ${(tp[3] * 100).toFixed(0)}%`);
  const avgThreats = avgBattle * (tp[1] * 1 + tp[2] * 2 + tp[3] * 3);
  console.log(`    Avg total threats per map: ${avgThreats.toFixed(2)}`);

  // ── CSV output ────────────────────────────────────────────────────────────
  if (CSV_MODE) {
    const nonePct       = avgNone      / eligibleTiles;
    const battlePct     = avgBattle    / eligibleTiles;
    const areaBossPct   = avgAreaBoss  / eligibleTiles;
    const treasurePct   = avgTreasure  / eligibleTiles;
    const merchantPct   = avgMerchant  / eligibleTiles;
    const wardEventPct  = avgWardEvent / eligibleTiles;
    const merchantPresencePct = s.merchantMaps / maps;
    const capPct        = s.capHits    / maps;
    const [b0, b1, b2, b3] = s.areaBossDist.map(c => c / maps);
    const opp = (sub: WardEventSubtype) => (s.wardSubtypes[sub] / maps).toFixed(4);
    console.log([
      chapter, shift, eligibleTiles,
      nonePct.toFixed(4), battlePct.toFixed(4), areaBossPct.toFixed(4),
      treasurePct.toFixed(4), merchantPct.toFixed(4), wardEventPct.toFixed(4),
      avgBattle.toFixed(3), avgAreaBoss.toFixed(3), avgTreasure.toFixed(3),
      avgMerchant.toFixed(3), avgWardEvent.toFixed(3),
      s.minBattle, s.maxBattle, capPct.toFixed(4),
      b0.toFixed(4), b1.toFixed(4), b2.toFixed(4), b3.toFixed(4),
      merchantPresencePct.toFixed(4),
      opp('support_ally'), opp('protocol_card'), opp('ward_blessing'), opp('ward_hazard'),
      tp[1].toFixed(4), tp[2].toFixed(4), tp[3].toFixed(4),
    ].join(','));
  }
}

// ── Flag checks ───────────────────────────────────────────────────────────────

function checkFlags(allStats: ComboStats[]): void {
  if (!CSV_MODE) {
    console.log('\n' + '═'.repeat(72));
    console.log('BALANCE FLAGS');
    console.log('═'.repeat(72));
  }

  // Track day-shift stats per chapter for cross-shift comparison
  const dayStatsByChapter = new Map<number, ComboStats>();
  const nightStatsByChapter = new Map<number, ComboStats>();
  for (const s of allStats) {
    if (s.shift === 'day')   dayStatsByChapter.set(s.chapter, s);
    if (s.shift === 'night') nightStatsByChapter.set(s.chapter, s);
  }

  for (const s of allStats) {
    const { chapter, shift, maps, eligibleTiles } = s;
    const tag = `Ch${chapter} ${shift}`;
    const avgBattle   = s.totalBattle   / maps;
    const avgAreaBoss = s.totalAreaBoss / maps;
    const avgNone     = s.totalNone     / maps;
    const cap         = Math.floor(eligibleTiles * s.capBp / CANONICAL_TOTAL_BP);
    const capHitPct   = s.capHits / maps;
    const merchantPresencePct = s.merchantMaps / maps;

    // 1. Area-boss cap-hit frequency is intentionally informational.
    // The report above preserves the boss[3] distribution; late chapters are
    // expected to reach the canonical hard cap frequently at their 4–5% tile
    // rates. The per-map hard maximum is asserted during generation above.

    // 2. Merchant common too early (before ch5)
    if (chapter < 5 && merchantPresencePct > FLAG_MERCHANT_EARLY_PCT) {
      flag(`[${tag}] Merchant present on ${(merchantPresencePct * 100).toFixed(1)}% of maps before ch5 (threshold: ${FLAG_MERCHANT_EARLY_PCT * 100}%)`);
    }

    // 3. Day density cap hit excessively
    if (shift === 'day' && capHitPct > FLAG_DAY_CAP_EXCESSIVE_PCT) {
      flag(`[${tag}] Day density cap hit on ${(capHitPct * 100).toFixed(1)}% of maps (threshold: ${FLAG_DAY_CAP_EXCESSIVE_PCT * 100}%)`);
    }

    // 4. None% falls below 25 % of eligible tiles
    const nonePct = avgNone / eligibleTiles;
    if (nonePct < FLAG_NONE_MIN_PCT) {
      flag(`[${tag}] None% = ${(nonePct * 100).toFixed(1)}% of eligible tiles (floor: ${FLAG_NONE_MIN_PCT * 100}%)`);
    }

    // 5. Rate total invalid
    const totalPct = (s.totalBattle + s.totalAreaBoss + s.totalTreasure +
                      s.totalMerchant + s.totalWardEvent + s.totalNone) /
                     (maps * eligibleTiles);
    if (Math.abs(totalPct - 1) > FLAG_RATE_TOLERANCE) {
      flag(`[${tag}] Rate total = ${(totalPct * 100).toFixed(2)}% (expected 100 ±${FLAG_RATE_TOLERANCE * 100}pp)`);
    }

    // 6. Impossible chapter gate: area boss system unlocked but avg area boss ≈ 0
    if (isSystemUnlocked('area_boss', chapter) && avgAreaBoss < 0.01) {
      flag(`[${tag}] area_boss system is unlocked (ch≥4) but avg area boss count is ${avgAreaBoss.toFixed(3)} — gate impossible`);
    }
  }

  // 7. Night avg battles > 85 % of day avg battles (per chapter)
  for (const [chapter, nightS] of nightStatsByChapter) {
    const dayS = dayStatsByChapter.get(chapter);
    if (!dayS) continue;
    const nightAvg = nightS.totalBattle / nightS.maps;
    const dayAvg   = dayS.totalBattle   / dayS.maps;
    if (dayAvg > 0 && nightAvg / dayAvg > FLAG_NIGHT_CLOSE_TO_DAY) {
      flag(
        `[Ch${chapter}] Night avg battles (${nightAvg.toFixed(2)}) is ${(nightAvg / dayAvg * 100).toFixed(1)}% of Day avg (${dayAvg.toFixed(2)}) — night not sufficiently scarcer (threshold: ${FLAG_NIGHT_CLOSE_TO_DAY * 100}%)`,
      );
    }
  }

  if (!CSV_MODE && FLAGS.length === 0) {
    console.log('  (none — all thresholds within acceptable range)');
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

runSimulation();
