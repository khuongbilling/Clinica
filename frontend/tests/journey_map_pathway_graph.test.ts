/**
 * tests/journey_map_pathway_graph.test.ts — Push 4: Pathway Graph
 *
 * Verifies that every chapter's PathwayGraph satisfies the directive's
 * structural constraints before any hex coordinates are generated.
 *
 * Test sections
 * ─────────────
 *  1. Valid graph structure for Book I (Ch1–10)
 *  2. Gate reachable for every chapter
 *  3. Graph is fully connected for every chapter
 *  4. Multiple routes exist (not single-line)
 *  5. At least one loop (cycle rank ≥ 1)
 *  6. Dead ends are reward destinations (CLEARING / LANDMARK / TRANSITION)
 *  7. Start→gate distance is sufficient (≥ 35% of diameter)
 *  8. validatePathwayGraph returns valid=true for Book I
 *  9. Lane width and length constraints
 * 10. Graph is deterministic (cached / same object)
 * 11. Procedural chapters (Ch11–15) also pass validation
 * 12. No duplicate edges in any graph
 * 13. START and GATE nodes exist exactly once in every graph
 * 14. FINAL_APPROACH node exists and is adjacent to GATE
 */

import {
  getChapterPathwayGraph,
  getChapterPathwayGraphRange,
  validatePathwayGraph,
  generatePathwayGraphForDNA,
} from '../src/game/journeyMap/chapterPathwayGraph';
import { getChapterMapDNA } from '../src/game/journeyMap/chapterMapDNA';
import type { PathwayGraph, PathNodeType } from '../src/game/journeyMap/chapterMapTemplate.types';

let passed = 0, failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`PASS - ${name}`); }
  else    { failed++; console.log(`FAIL - ${name}${detail ? ': ' + detail : ''}`); }
}

// ── Graph helpers (mirror of internal logic) ─────────────────────────────────

function adjacency(g: PathwayGraph): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const n of g.nodes) adj.set(n.id, []);
  for (const e of g.edges) {
    adj.get(e.fromId)!.push(e.toId);
    adj.get(e.toId)!.push(e.fromId);
  }
  return adj;
}

function bfs(g: PathwayGraph, startId: string): Map<string, number> {
  const adj  = adjacency(g);
  const dist = new Map<string, number>();
  dist.set(startId, 0);
  const q: string[] = [startId];
  let head = 0;
  while (head < q.length) {
    const cur = q[head++]!;
    for (const nb of (adj.get(cur) ?? [])) {
      if (!dist.has(nb)) { dist.set(nb, dist.get(cur)! + 1); q.push(nb); }
    }
  }
  return dist;
}

function countPaths(g: PathwayGraph, from: string, to: string, limit = 3): number {
  const adj = adjacency(g);
  let count = 0;
  const vis = new Set<string>();
  function dfs(cur: string) {
    if (cur === to) { count++; return; }
    if (count >= limit) return;
    vis.add(cur);
    for (const nb of (adj.get(cur) ?? [])) if (!vis.has(nb)) dfs(nb);
    vis.delete(cur);
  }
  dfs(from);
  return count;
}

const VALID_NODE_TYPES = new Set<PathNodeType>([
  'START', 'JUNCTION', 'CLEARING', 'LANDMARK', 'TRANSITION', 'FINAL_APPROACH', 'GATE',
]);
const VALID_WIDTHS = new Set(['primary', 'secondary']);
const REWARD_TYPES = new Set<PathNodeType>(['CLEARING', 'LANDMARK', 'TRANSITION']);

// ════════════════════════════════════════════════════════════════════════
// 1. Valid graph structure for Book I (Ch 1–10)
// ════════════════════════════════════════════════════════════════════════

for (let ch = 1; ch <= 10; ch++) {
  const g = getChapterPathwayGraph(ch);

  check(`[ch${ch}] chapterId equals ${ch}`, g.chapterId === ch);
  check(`[ch${ch}] seed is non-empty`, typeof g.seed === 'string' && g.seed.length > 0);
  check(`[ch${ch}] nodes array non-empty`, g.nodes.length > 0);
  check(`[ch${ch}] edges array non-empty`, g.edges.length > 0);
  check(`[ch${ch}] startNodeId set`, typeof g.startNodeId === 'string' && g.startNodeId.length > 0);
  check(`[ch${ch}] gateNodeId set`, typeof g.gateNodeId === 'string' && g.gateNodeId.length > 0);
  check(`[ch${ch}] node count > 4`, g.nodes.length > 4, `got ${g.nodes.length}`);
  check(`[ch${ch}] edge count > node count − 1`,
    g.edges.length > g.nodes.length - 1,
    `edges ${g.edges.length} vs nodes ${g.nodes.length}`);

  // All node types valid
  const badType = g.nodes.find(n => !VALID_NODE_TYPES.has(n.type));
  check(`[ch${ch}] all node types valid`, !badType, badType ? `id=${badType.id} type=${badType.type}` : '');

  // All edge widths valid
  const badWidth = g.edges.find(e => !VALID_WIDTHS.has(e.width));
  check(`[ch${ch}] all edge widths valid`, !badWidth, badWidth ? `id=${badWidth.id}` : '');

  // loopCount, deadEndNodeIds, shortestRouteLength, hasMultipleRoutes, graphDiameter
  check(`[ch${ch}] loopCount ≥ 0`, g.loopCount >= 0);
  check(`[ch${ch}] deadEndNodeIds is array`, Array.isArray(g.deadEndNodeIds));
  check(`[ch${ch}] shortestRouteLength ≥ 1`, g.shortestRouteLength >= 1);
  check(`[ch${ch}] graphDiameter ≥ shortestRoute`,
    g.graphDiameter >= g.shortestRouteLength,
    `diameter=${g.graphDiameter} route=${g.shortestRouteLength}`);
}

// ════════════════════════════════════════════════════════════════════════
// 2. Gate reachable from start
// ════════════════════════════════════════════════════════════════════════

for (let ch = 1; ch <= 10; ch++) {
  const g    = getChapterPathwayGraph(ch);
  const dist = bfs(g, g.startNodeId);
  const d    = dist.get(g.gateNodeId);
  check(`[ch${ch}] gate reachable`, d !== undefined && d < Infinity,
    `dist=${d}`);
}

// ════════════════════════════════════════════════════════════════════════
// 3. Graph is fully connected
// ════════════════════════════════════════════════════════════════════════

for (let ch = 1; ch <= 10; ch++) {
  const g    = getChapterPathwayGraph(ch);
  const dist = bfs(g, g.startNodeId);
  const unreachable = g.nodes.filter(n => !dist.has(n.id));
  check(`[ch${ch}] graph fully connected`, unreachable.length === 0,
    unreachable.length > 0 ? `unreachable: ${unreachable.map(n => n.id).join(',')}` : '');
}

// ════════════════════════════════════════════════════════════════════════
// 4. Multiple routes from start to gate
// ════════════════════════════════════════════════════════════════════════

for (let ch = 1; ch <= 10; ch++) {
  const g = getChapterPathwayGraph(ch);
  const paths = countPaths(g, g.startNodeId, g.gateNodeId, 2);
  check(`[ch${ch}] ≥ 2 routes start→gate`, paths >= 2,
    `found only ${paths} path(s)`);
  check(`[ch${ch}] hasMultipleRoutes flag matches`, g.hasMultipleRoutes === (paths >= 2));
}

// ════════════════════════════════════════════════════════════════════════
// 5. At least one loop (cycle rank ≥ 1)
// ════════════════════════════════════════════════════════════════════════

for (let ch = 1; ch <= 10; ch++) {
  const g = getChapterPathwayGraph(ch);
  check(`[ch${ch}] loopCount ≥ 1`, g.loopCount >= 1, `got ${g.loopCount}`);

  // Verify cycle rank formula: |E| − |V| + 1
  const computedRank = g.edges.length - g.nodes.length + 1;
  check(`[ch${ch}] loopCount = |E|−|V|+1`, g.loopCount === computedRank,
    `stored=${g.loopCount} computed=${computedRank}`);
}

// ════════════════════════════════════════════════════════════════════════
// 6. Dead ends are reward destinations
// ════════════════════════════════════════════════════════════════════════

for (let ch = 1; ch <= 10; ch++) {
  const g   = getChapterPathwayGraph(ch);
  const adj = adjacency(g);
  const actualDeadEnds = g.nodes.filter(
    n => n.type !== 'START' && n.type !== 'GATE' && (adj.get(n.id)?.length ?? 0) === 1,
  );

  // The stored list matches the computed list
  const stored = new Set(g.deadEndNodeIds);
  const actual = new Set(actualDeadEnds.map(n => n.id));
  check(`[ch${ch}] deadEndNodeIds matches computed`,
    [...stored].every(id => actual.has(id)) && [...actual].every(id => stored.has(id)),
    `stored=${[...stored].join(',')} actual=${[...actual].join(',')}`);

  // Each dead end is a reward type
  for (const n of actualDeadEnds) {
    check(`[ch${ch}] dead-end '${n.id}' is reward type (${n.type})`,
      REWARD_TYPES.has(n.type), `type=${n.type}`);
  }

  // Not excessive
  check(`[ch${ch}] dead-end count ≤ 4`, actualDeadEnds.length <= 4,
    `got ${actualDeadEnds.length}`);
}

// ════════════════════════════════════════════════════════════════════════
// 7. Start→gate distance sufficient (≥ 35% of diameter)
// ════════════════════════════════════════════════════════════════════════

for (let ch = 1; ch <= 10; ch++) {
  const g      = getChapterPathwayGraph(ch);
  const minLen = Math.max(2, Math.ceil(g.graphDiameter * 0.35));
  check(`[ch${ch}] start→gate dist ${g.shortestRouteLength} ≥ min ${minLen}`,
    g.shortestRouteLength >= minLen,
    `dist=${g.shortestRouteLength} diameter=${g.graphDiameter} min=${minLen}`);
}

// ════════════════════════════════════════════════════════════════════════
// 8. validatePathwayGraph returns valid=true for Book I
// ════════════════════════════════════════════════════════════════════════

for (let ch = 1; ch <= 10; ch++) {
  const g   = getChapterPathwayGraph(ch);
  const val = validatePathwayGraph(g);
  check(`[ch${ch}] validation: valid=true`, val.valid,
    val.errors.length > 0 ? val.errors.join('; ') : '');
  check(`[ch${ch}] validation: gateReachable`, val.gateReachable);
  check(`[ch${ch}] validation: isConnected`, val.isConnected);
  check(`[ch${ch}] validation: hasMultipleRoutes`, val.hasMultipleRoutes);
  check(`[ch${ch}] validation: hasMinLoops`, val.hasMinLoops);
  check(`[ch${ch}] validation: deadEndsHaveReward`, val.deadEndsHaveReward);
  check(`[ch${ch}] validation: startGateDistanceSufficient`, val.startGateDistanceSufficient);
  check(`[ch${ch}] validation: errors empty`, val.errors.length === 0,
    val.errors.join('; '));
}

// ════════════════════════════════════════════════════════════════════════
// 9. Lane width and length constraints
// ════════════════════════════════════════════════════════════════════════

for (let ch = 1; ch <= 10; ch++) {
  const g = getChapterPathwayGraph(ch);

  for (const e of g.edges) {
    if (e.width === 'primary') {
      check(`[ch${ch}] primary edge '${e.id}' laneLength 3–8`,
        e.laneLength >= 3 && e.laneLength <= 8,
        `got ${e.laneLength}`);
    } else {
      check(`[ch${ch}] secondary edge '${e.id}' laneLength 2–5`,
        e.laneLength >= 2 && e.laneLength <= 5,
        `got ${e.laneLength}`);
    }
  }

  const primaryEdges   = g.edges.filter(e => e.width === 'primary');
  const secondaryEdges = g.edges.filter(e => e.width === 'secondary');
  check(`[ch${ch}] has primary edges`, primaryEdges.length > 0);
  check(`[ch${ch}] has secondary edges`, secondaryEdges.length > 0);
}

// ════════════════════════════════════════════════════════════════════════
// 10. Deterministic / cached
// ════════════════════════════════════════════════════════════════════════

for (const ch of [1, 5, 10]) {
  const a = getChapterPathwayGraph(ch);
  const b = getChapterPathwayGraph(ch);
  check(`[cache ch${ch}] same object reference`, a === b);
}

// Procedural determinism
const p1 = getChapterPathwayGraph(13);
const p2 = getChapterPathwayGraph(13);
check('[cache ch13] procedural graph is cached', p1 === p2);

// ════════════════════════════════════════════════════════════════════════
// 11. Procedural chapters (Ch11–15) also pass validation
// ════════════════════════════════════════════════════════════════════════

for (let ch = 11; ch <= 15; ch++) {
  const g   = getChapterPathwayGraph(ch);
  const val = validatePathwayGraph(g);
  check(`[proc ch${ch}] valid=true`, val.valid,
    val.errors.length > 0 ? val.errors.join('; ') : '');
  check(`[proc ch${ch}] gateReachable`, val.gateReachable);
  check(`[proc ch${ch}] isConnected`, val.isConnected);
  check(`[proc ch${ch}] hasMultipleRoutes`, val.hasMultipleRoutes);
  check(`[proc ch${ch}] hasMinLoops`, val.hasMinLoops);
  check(`[proc ch${ch}] chapterId equals ${ch}`, g.chapterId === ch);
}

// ════════════════════════════════════════════════════════════════════════
// 12. No duplicate edges
// ════════════════════════════════════════════════════════════════════════

for (let ch = 1; ch <= 10; ch++) {
  const g    = getChapterPathwayGraph(ch);
  const seen = new Set<string>();
  let dupFound = false;
  for (const e of g.edges) {
    const key = [e.fromId, e.toId].sort().join('~~');
    if (seen.has(key)) { dupFound = true; break; }
    seen.add(key);
  }
  check(`[ch${ch}] no duplicate edges`, !dupFound);
}

// ════════════════════════════════════════════════════════════════════════
// 13. START and GATE exist exactly once
// ════════════════════════════════════════════════════════════════════════

for (let ch = 1; ch <= 10; ch++) {
  const g        = getChapterPathwayGraph(ch);
  const starts   = g.nodes.filter(n => n.type === 'START');
  const gates    = g.nodes.filter(n => n.type === 'GATE');
  check(`[ch${ch}] exactly 1 START node`, starts.length === 1, `got ${starts.length}`);
  check(`[ch${ch}] exactly 1 GATE node`,  gates.length === 1,  `got ${gates.length}`);
  check(`[ch${ch}] startNodeId refs START`, g.nodes.find(n => n.id === g.startNodeId)?.type === 'START');
  check(`[ch${ch}] gateNodeId refs GATE`,  g.nodes.find(n => n.id === g.gateNodeId)?.type  === 'GATE');
}

// ════════════════════════════════════════════════════════════════════════
// 14. FINAL_APPROACH exists and is adjacent to GATE
// ════════════════════════════════════════════════════════════════════════

for (let ch = 1; ch <= 10; ch++) {
  const g   = getChapterPathwayGraph(ch);
  const fas = g.nodes.filter(n => n.type === 'FINAL_APPROACH');
  check(`[ch${ch}] ≥ 1 FINAL_APPROACH node`, fas.length >= 1, `got ${fas.length}`);

  // At least one FA node must be adjacent to GATE
  const adj     = adjacency(g);
  const gateNbs = adj.get(g.gateNodeId) ?? [];
  const faAdj   = fas.some(fa => gateNbs.includes(fa.id));
  check(`[ch${ch}] a FINAL_APPROACH is adjacent to GATE`, faAdj);
}

// ════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
