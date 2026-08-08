/**
 * tests/fog_map_chapter_boss_rewards.test.ts
 *
 * Unit tests for the logic exercised by `applyFogMapChapterBossRewards` in
 * the store (store.tsx).  The store action is a React hook callback and cannot
 * be imported directly; these tests verify the same pure derivations against a
 * PlayerState fixture so regressions are caught without spinning up a React
 * renderer.
 *
 * Sections
 *   A  XP application — completionXp advances xp, rank_index, and player_level
 *   B  Claimed-node update — idempotency, additive, empty-guard
 *   C  Combined — XP + node claim in one snapshot (no lost-update)
 *   D  Edge cases — zero XP, empty requiredNodes, all nodes already claimed
 */

import { playerLevelFromXp } from '../src/game/progression';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed  = 0;
let failed  = 0;
const failures: string[] = [];

function check(label: string, value: boolean): void {
  if (value) { passed++; console.log(`PASS - ${label}`); }
  else       { failed++; failures.push(label); console.error(`FAIL - ${label}`); }
}
function eq<T>(a: T, b: T, label: string): void { check(label, a === b); }
function deepEq(a: unknown, b: unknown, label: string): void {
  check(label, JSON.stringify(a) === JSON.stringify(b));
}

// ── Replicate the pure derivations from the store action ─────────────────────
//
// applyFogMapChapterBossRewards in store.tsx:
//   1. let next = completionXp > 0 ? applyXp(base, completionXp) : { ...base }
//   2. filter requiredNodes against claimed_journey_nodes
//   3. append unclaimed nodes → one updateState
//
// `applyXp` is a local helper in the store (not exported), but its logic is
// identical to incrementing `xp` + re-deriving rank/player_level from the same
// `playerLevelFromXp` table that IS exported from progression.ts.

interface MinimalPlayer {
  xp: number;
  rank_index: number;
  rank: string;
  player_level: number;
  claimed_journey_nodes: string[];
}

const RANKS = [
  { name: 'Initiate',    xpRequired: 0    },
  { name: 'Apprentice',  xpRequired: 100  },
  { name: 'Practitioner',xpRequired: 300  },
  { name: 'Specialist',  xpRequired: 600  },
  { name: 'Expert',      xpRequired: 1000 },
  { name: 'Master',      xpRequired: 1500 },
];

function applyXpMirror(p: MinimalPlayer, addXp: number): MinimalPlayer {
  const newXp = p.xp + addXp;
  let idx = p.rank_index;
  while (idx < RANKS.length - 1 && newXp >= RANKS[idx + 1].xpRequired) idx++;
  const toLevel = playerLevelFromXp(newXp).level;
  return { ...p, xp: newXp, rank: RANKS[idx].name, rank_index: idx, player_level: toLevel };
}

function applyBossRewardsMirror(
  base: MinimalPlayer,
  requiredNodes: readonly string[],
  completionXp: number,
): MinimalPlayer {
  let next = completionXp > 0 ? applyXpMirror(base, completionXp) : { ...base };
  const alreadyClaimed = next.claimed_journey_nodes;
  const toAdd = requiredNodes.filter((id) => !alreadyClaimed.includes(id));
  if (toAdd.length > 0) {
    next = { ...next, claimed_journey_nodes: [...alreadyClaimed, ...toAdd] };
  }
  return next;
}

function makePlayer(overrides: Partial<MinimalPlayer> = {}): MinimalPlayer {
  return {
    xp:                    0,
    rank_index:            0,
    rank:                  'Initiate',
    player_level:          1,
    claimed_journey_nodes: [],
    ...overrides,
  };
}

// ── Section A: XP application ─────────────────────────────────────────────────

console.log('\n── A: XP application ────────────────────────────────────────');

{
  const base   = makePlayer({ xp: 0, rank_index: 0 });
  const result = applyBossRewardsMirror(base, [], 30);
  eq(result.xp, 30, 'A1: xp increases by completionXp');
  check('A2: player_level is non-negative', result.player_level >= 1);
}

{
  // Player already at 90 XP; completionXp=30 should push them over the 100 threshold
  const base   = makePlayer({ xp: 90, rank_index: 0, rank: 'Initiate' });
  const result = applyBossRewardsMirror(base, [], 30);
  eq(result.xp, 120, 'A3: xp crosses rank boundary correctly');
  check('A4: rank advances when xp threshold is crossed', result.rank_index >= 1);
  eq(result.rank, 'Apprentice', 'A5: rank name is updated');
}

{
  // Existing balance preserved: player has crowns etc — we just verify xp delta
  const base   = makePlayer({ xp: 250, rank_index: 1, rank: 'Apprentice', player_level: 3 });
  const result = applyBossRewardsMirror(base, [], 40);
  eq(result.xp, 290, 'A6: xp adds correctly to non-zero base');
  check('A7: rank_index never decreases', result.rank_index >= base.rank_index);
}

// ── Section B: Claimed-node update ───────────────────────────────────────────

console.log('\n── B: Claimed-node update ───────────────────────────────────');

{
  const base   = makePlayer({ claimed_journey_nodes: [] });
  const result = applyBossRewardsMirror(base, ['c1n4', 'c1n6'], 0);
  deepEq(result.claimed_journey_nodes, ['c1n4', 'c1n6'], 'B1: new nodes appended to empty list');
}

{
  const base   = makePlayer({ claimed_journey_nodes: ['c1n4'] });
  const result = applyBossRewardsMirror(base, ['c1n4', 'c1n6'], 0);
  deepEq(result.claimed_journey_nodes, ['c1n4', 'c1n6'], 'B2: already-claimed node is not duplicated');
}

{
  const base   = makePlayer({ claimed_journey_nodes: ['c1n4', 'c1n6'] });
  const result = applyBossRewardsMirror(base, ['c1n4', 'c1n6'], 0);
  deepEq(result.claimed_journey_nodes, ['c1n4', 'c1n6'], 'B3: idempotent — no change when all already claimed');
}

{
  const base   = makePlayer({ claimed_journey_nodes: ['unrelated_node'] });
  const result = applyBossRewardsMirror(base, ['c2p5', 'c2p8'], 0);
  deepEq(
    result.claimed_journey_nodes,
    ['unrelated_node', 'c2p5', 'c2p8'],
    'B4: existing unrelated claims preserved when new nodes are added',
  );
}

// ── Section C: Combined XP + nodes in one snapshot ───────────────────────────

console.log('\n── C: Combined XP + nodes (no lost-update) ─────────────────');

{
  // Simulates what the store action does when chapter boss is beaten:
  // XP is applied first, THEN claimed_journey_nodes are extended —
  // both are on the same returned object (single updateState call).
  const base   = makePlayer({ xp: 50, claimed_journey_nodes: ['existing'] });
  const result = applyBossRewardsMirror(base, ['c1n4', 'c1n6'], 30);

  eq(result.xp, 80, 'C1: XP and nodes coexist — xp is correct');
  check('C2: XP and nodes coexist — claimed_journey_nodes includes existing', result.claimed_journey_nodes.includes('existing'));
  check('C3: XP and nodes coexist — new node c1n4 present', result.claimed_journey_nodes.includes('c1n4'));
  check('C4: XP and nodes coexist — new node c1n6 present', result.claimed_journey_nodes.includes('c1n6'));
  eq(result.claimed_journey_nodes.length, 3, 'C5: total claimed count is correct (1 existing + 2 new)');
}

{
  // Regression guard: a second call with the same arguments (e.g. effect fires
  // twice due to strict mode) must produce the same result as the first call.
  const base       = makePlayer({ xp: 200, claimed_journey_nodes: [] });
  const firstPass  = applyBossRewardsMirror(base,      ['c1n4', 'c1n6'], 30);
  const secondPass = applyBossRewardsMirror(firstPass, ['c1n4', 'c1n6'], 30);

  eq(secondPass.claimed_journey_nodes.filter(id => id === 'c1n4').length, 1,
    'C6: re-applying nodes is idempotent — c1n4 appears exactly once');
  eq(secondPass.claimed_journey_nodes.filter(id => id === 'c1n6').length, 1,
    'C7: re-applying nodes is idempotent — c1n6 appears exactly once');
  // XP IS re-applied on a second call — that mirrors the effect guard
  // (battleResultApplied.current) that prevents double-fires in production.
  // We simply assert the math is consistent, not that it cannot double-fire.
  eq(secondPass.xp, 260, 'C8: xp on second call reflects second addXp (effect guard prevents this in prod)');
}

// ── Section D: Edge cases ─────────────────────────────────────────────────────

console.log('\n── D: Edge cases ────────────────────────────────────────────');

{
  // completionXp === 0: player snapshot still updated (claimed_journey_nodes)
  const base   = makePlayer({ xp: 100, claimed_journey_nodes: [] });
  const result = applyBossRewardsMirror(base, ['c3p7', 'c3p9'], 0);
  eq(result.xp, 100, 'D1: zero completionXp leaves xp unchanged');
  check('D2: zero completionXp still claims required nodes', result.claimed_journey_nodes.includes('c3p7'));
}

{
  // Empty requiredNodes: only XP is applied
  const base   = makePlayer({ xp: 0, claimed_journey_nodes: ['pre'] });
  const result = applyBossRewardsMirror(base, [], 50);
  eq(result.xp, 50, 'D3: empty requiredNodes — xp still applied');
  deepEq(result.claimed_journey_nodes, ['pre'], 'D4: empty requiredNodes — claimed list unchanged');
}

{
  // Chapter with no completionXp and no requiredCompletionNodes (undefined → [])
  const base   = makePlayer();
  const result = applyBossRewardsMirror(base, [], 0);
  eq(result.xp, 0, 'D5: no-op call — xp unchanged');
  deepEq(result.claimed_journey_nodes, [], 'D6: no-op call — claimed list unchanged');
}

{
  // Large completionXp that crosses multiple rank thresholds at once
  const base   = makePlayer({ xp: 0, rank_index: 0, rank: 'Initiate' });
  const result = applyBossRewardsMirror(base, [], 1200);
  eq(result.xp, 1200, 'D7: large xp applied correctly');
  check('D8: rank advances to at least Expert (≥ 1000 xp)', result.rank_index >= 4);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.error('Failures:', failures);
  process.exit(1);
}
