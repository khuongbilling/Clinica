/**
 * journeyMap/chapterPathwayGraph.ts — Push 4: Pathway Graph from Chapter Map DNA
 *
 * Converts a ChapterMapDNA into an abstract PATHWAY GRAPH (nodes + edges)
 * before any hex coordinates or art assets are generated.
 *
 * PIPELINE ORDER
 * ─────────────
 *   DNA  →  PathwayGraph  →  hex embedding  →  art / encounters
 *
 * The graph exists BEFORE spatial layout.  Background art and encounter
 * placement MUST read from the validated graph; they must never drive it.
 *
 * VALIDATION RULES  (reject and retry if any fail)
 * ─────────────────────────────────────────────────
 *   1. Gate reachable from start
 *   2. Graph is fully connected (no disconnected regions)
 *   3. ≥ 2 distinct simple paths from start to gate (not single-line)
 *   4. ≥ 1 cycle / loop (cycle rank ≥ 1)
 *   5. Dead-end nodes (degree-1, excluding START/GATE) are CLEARING,
 *      LANDMARK, or TRANSITION (reward destinations only)
 *   6. start→gate BFS distance ≥ ceil(0.35 × graph diameter)
 *   7. Dead-end count ≤ 4
 *
 * LANE WIDTHS
 * ───────────
 *   primary   — 2–3 physical hex widths (laneLength 3–8 tiles)
 *   secondary — 1–2 physical hex widths (laneLength 2–5 tiles)
 *
 * COMMIT TAG:  feat(journey): generate route graph from chapter map DNA
 */

import { fnv1a32, mulberry32 } from './prng';
import { getChapterMapDNA } from './chapterMapDNA';
import type {
  ChapterMapDNA,
  MapTopologyFamily,
  PathNodeType,
  PathNode,
  PathEdge,
  PathwayGraph,
  PathwayGraphValidation,
} from './chapterMapTemplate.types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_GRAPH_RETRIES = 16;

/** Node types that satisfy the "dead end must reward exploration" rule. */
const REWARD_NODE_TYPES = new Set<PathNodeType>([
  'CLEARING', 'LANDMARK', 'TRANSITION',
]);

// ── Internal construction types ───────────────────────────────────────────────

interface RawEdge { from: string; to: string; isPrimary: boolean; }
interface RawGraph { nodes: PathNode[]; rawEdges: RawEdge[]; }

// ── Node / edge helpers ───────────────────────────────────────────────────────

function mkNode(id: string, type: PathNodeType, label?: string): PathNode {
  return label ? { id, type, label } : { id, type };
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/** Adds an undirected edge only if it does not already exist. */
function addEdge(
  edges: RawEdge[],
  from: string,
  to: string,
  isPrimary: boolean,
): void {
  const dup = edges.some(
    e => (e.from === from && e.to === to) || (e.from === to && e.to === from),
  );
  if (!dup) edges.push({ from, to, isPrimary });
}

// ── Graph algorithms ──────────────────────────────────────────────────────────

function buildAdjacency(
  nodes: PathNode[],
  edges: PathEdge[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    adj.get(e.fromId)!.push(e.toId);
    adj.get(e.toId)!.push(e.fromId);
  }
  return adj;
}

/** BFS from `start`; returns edge-hop distances to all reachable nodes. */
function bfsDistances(
  adj: Map<string, string[]>,
  start: string,
): Map<string, number> {
  const dist = new Map<string, number>();
  dist.set(start, 0);
  const queue: string[] = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    for (const nb of (adj.get(cur) ?? [])) {
      if (!dist.has(nb)) {
        dist.set(nb, dist.get(cur)! + 1);
        queue.push(nb);
      }
    }
  }
  return dist;
}

/**
 * Counts distinct simple paths from `from` to `to`, up to `limit`.
 * Uses DFS with a visited set; stops early once `limit` paths are found.
 */
function countSimplePaths(
  adj: Map<string, string[]>,
  from: string,
  to: string,
  limit = 3,
): number {
  let count = 0;
  const visited = new Set<string>();
  function dfs(cur: string): void {
    if (cur === to) { count++; return; }
    if (count >= limit) return;
    visited.add(cur);
    for (const nb of (adj.get(cur) ?? [])) {
      if (!visited.has(nb)) dfs(nb);
    }
    visited.delete(cur);
  }
  dfs(from);
  return count;
}

// ── RawGraph → PathwayGraph ───────────────────────────────────────────────────

function finalizeGraph(
  chapterId: number,
  seed: string,
  raw: RawGraph,
  rng: () => number,
): PathwayGraph {
  // Deduplicate raw edges (undirected)
  const seen = new Set<string>();
  const uniqueRaw = raw.rawEdges.filter(e => {
    const key = [e.from, e.to].sort().join('~~');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Build PathEdge objects with sampled lane lengths
  const edges: PathEdge[] = uniqueRaw.map((e, i) => {
    const laneLength = e.isPrimary
      ? 3 + Math.floor(rng() * 6)  // primary: 3–8 tiles
      : 2 + Math.floor(rng() * 4); // secondary: 2–5 tiles
    return {
      id: `e${i}_${e.from}--${e.to}`,
      fromId: e.from,
      toId: e.to,
      width: (e.isPrimary ? 'primary' : 'secondary') as PathEdge['width'],
      laneLength,
    };
  });

  const nodes = raw.nodes;
  const adj = buildAdjacency(nodes, edges);

  const startNodeId = nodes.find(n => n.type === 'START')?.id ?? 'start';
  const gateNodeId  = nodes.find(n => n.type === 'GATE')?.id  ?? 'gate';

  const distFromStart = bfsDistances(adj, startNodeId);

  const shortestRouteLength = distFromStart.get(gateNodeId) ?? Infinity;

  let graphDiameter = 0;
  for (const d of distFromStart.values()) {
    if (d > graphDiameter) graphDiameter = d;
  }

  // Cycle rank: |E| − |V| + 1  (for a connected graph, ≥ 1 means ≥ 1 cycle)
  const loopCount = Math.max(0, edges.length - nodes.length + 1);

  // Dead ends: degree-1 nodes that are not START or GATE
  const deadEndNodeIds: string[] = [];
  for (const n of nodes) {
    if (n.type === 'START' || n.type === 'GATE') continue;
    if ((adj.get(n.id)?.length ?? 0) === 1) deadEndNodeIds.push(n.id);
  }

  const hasMultipleRoutes =
    countSimplePaths(adj, startNodeId, gateNodeId, 2) >= 2;

  return {
    chapterId,
    seed,
    nodes,
    edges,
    startNodeId,
    gateNodeId,
    loopCount,
    deadEndNodeIds,
    shortestRouteLength,
    hasMultipleRoutes,
    graphDiameter,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validatePathwayGraph(
  graph: PathwayGraph,
): PathwayGraphValidation {
  const adj = buildAdjacency(graph.nodes, graph.edges);
  const dist = bfsDistances(adj, graph.startNodeId);

  const gateReachable =
    dist.has(graph.gateNodeId) &&
    (dist.get(graph.gateNodeId) ?? Infinity) < Infinity;

  const isConnected = dist.size === graph.nodes.length;

  const hasMultipleRoutes = graph.hasMultipleRoutes;
  const hasMinLoops       = graph.loopCount >= 1;
  const deadEndCount      = graph.deadEndNodeIds.length;

  const deadEndsHaveReward = graph.deadEndNodeIds.every(id => {
    const node = graph.nodes.find(n => n.id === id);
    return node !== undefined && REWARD_NODE_TYPES.has(node.type);
  });

  const minRouteLen = Math.max(2, Math.ceil(graph.graphDiameter * 0.35));
  const startGateDistanceSufficient =
    gateReachable && graph.shortestRouteLength >= minRouteLen;

  const errors: string[] = [];
  if (!gateReachable)               errors.push('gate unreachable from start');
  if (!isConnected)                 errors.push('disconnected region exists');
  if (!hasMultipleRoutes)           errors.push('only one route from start to gate (too linear)');
  if (!hasMinLoops)                 errors.push('no meaningful loop (cycle rank = 0)');
  if (!deadEndsHaveReward)          errors.push('dead-end node lacks reward purpose (must be CLEARING/LANDMARK/TRANSITION)');
  if (!startGateDistanceSufficient) {
    errors.push(
      `start–gate distance ${graph.shortestRouteLength} < required min ${minRouteLen} (35% of diameter ${graph.graphDiameter})`,
    );
  }
  if (deadEndCount > 4) errors.push(`excessive dead ends: ${deadEndCount}`);

  const valid =
    gateReachable &&
    isConnected &&
    hasMultipleRoutes &&
    hasMinLoops &&
    deadEndsHaveReward &&
    startGateDistanceSufficient &&
    deadEndCount <= 4;

  return {
    valid,
    gateReachable,
    isConnected,
    hasMultipleRoutes,
    hasMinLoops,
    deadEndCount,
    deadEndsHaveReward,
    startGateDistanceSufficient,
    errors,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Per-family graph builders
// ══════════════════════════════════════════════════════════════════════════════
//
// Each builder receives the ChapterMapDNA and a seeded RNG, and returns a
// RawGraph (nodes + raw edges).  All builders guarantee:
//
//   • One START node, one GATE node
//   • FINAL_APPROACH immediately precedes GATE on the primary spine
//   • At least one "bypass" loop edge so multiple routes exist
//   • All dead-end (degree-1) non-START/GATE nodes are CLEARING or LANDMARK
//
// The `finalizeGraph` function then assigns lane lengths and computes stats.
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. open_plaza ─────────────────────────────────────────────────────────────
//
// Broad open field with a central hub cluster and scattered clearings.
// Loops are formed by clearings connecting back to the spine.
//
//   START → J1 [→ J2] → FA → GATE
//            └── C1 .. Cn (branches)
//            C1 → FA      (bypass loop)

function buildOpenPlaza(dna: ChapterMapDNA, _rng: () => number): RawGraph {
  const { hubCount, branchCount, loopCount } = dna;
  const hubs     = range(hubCount).map(i => mkNode(`j${i + 1}`, 'JUNCTION'));
  const clearings = range(branchCount).map(i => mkNode(`c${i + 1}`, 'CLEARING'));
  const fa   = mkNode('fa', 'FINAL_APPROACH');
  const nodes: PathNode[] = [
    mkNode('start', 'START'), ...hubs, ...clearings, fa, mkNode('gate', 'GATE'),
  ];
  const edges: RawEdge[] = [];

  // Spine
  addEdge(edges, 'start', 'j1', true);
  for (let i = 1; i < hubCount; i++) addEdge(edges, `j${i}`, `j${i + 1}`, true);
  addEdge(edges, `j${hubCount}`, 'fa', true);
  addEdge(edges, 'fa', 'gate', true);

  // Clearings branch off junctions, cycling across available hubs
  for (let i = 0; i < branchCount; i++) {
    addEdge(edges, `j${1 + (i % hubCount)}`, `c${i + 1}`, false);
  }

  // Loop: C1 reconnects to FA (START→J1→C1→FA→GATE is the bypass path)
  addEdge(edges, 'c1', 'fa', false);
  // Additional loops via later clearings reconnecting to the last junction
  for (let i = 1; i < Math.min(loopCount, branchCount); i++) {
    addEdge(edges, `c${i + 1}`, `j${hubCount}`, false);
  }

  return { nodes, rawEdges: edges };
}

// ── 2. academic_quad ──────────────────────────────────────────────────────────
//
// Ring of junctions surrounding a quad, clearings off each junction.
// The ring itself creates multiple loops.
//
//   START → T1 → J1 → J2 → FA → GATE
//                └── J3 ── J4 ─┘  (ring completes loop)
//                C1 .. Cn off junctions

function buildAcademicQuad(dna: ChapterMapDNA, _rng: () => number): RawGraph {
  const { hubCount, branchCount, loopCount } = dna;
  const jCount = Math.max(3, hubCount + 1);
  const junctions = range(jCount).map(i => mkNode(`j${i + 1}`, 'JUNCTION'));
  const t1 = mkNode('t1', 'TRANSITION');
  const clearings = range(branchCount).map(i => mkNode(`c${i + 1}`, 'CLEARING'));
  const fa = mkNode('fa', 'FINAL_APPROACH');
  const nodes: PathNode[] = [
    mkNode('start', 'START'), t1, ...junctions, ...clearings, fa, mkNode('gate', 'GATE'),
  ];
  const edges: RawEdge[] = [];

  // Primary spine
  addEdge(edges, 'start', 't1', true);
  addEdge(edges, 't1', 'j1', true);
  addEdge(edges, 'j1', 'j2', true);
  addEdge(edges, 'j2', 'fa', true);
  addEdge(edges, 'fa', 'gate', true);

  // Ring through extra junctions: j1 → j3 → j4 → ... → jN → j2
  for (let i = 2; i < jCount; i++) {
    addEdge(edges, i === 2 ? 'j1' : `j${i}`, `j${i + 1}`, false);
  }
  addEdge(edges, `j${jCount}`, 'j2', false);

  // Clearings off junctions
  for (let i = 0; i < branchCount; i++) {
    addEdge(edges, `j${1 + (i % jCount)}`, `c${i + 1}`, false);
  }

  // Bypass loop: C1 → J2 creates path START→T1→J1→C1→J2→FA→GATE
  addEdge(edges, 'c1', 'j2', false);
  for (let i = 1; i < Math.min(loopCount - 1, branchCount); i++) {
    addEdge(edges, `c${i + 1}`, 'fa', false);
  }

  return { nodes, rawEdges: edges };
}

// ── 3. simulation_complex ─────────────────────────────────────────────────────
//
// Single primary spine with 3–6 branches off a central junction.
// 1–3 branch nodes reconnect to the spine, creating loops.
//
//   START → T1 → T2 → J1 → T3 → FA → GATE
//                       └── C1..Cn (branches)
//                       C1 → T3  (bypass loop)

function buildSimulationComplex(dna: ChapterMapDNA, _rng: () => number): RawGraph {
  const { branchCount, loopCount } = dna;
  const t1 = mkNode('t1', 'TRANSITION');
  const t2 = mkNode('t2', 'TRANSITION');
  const t3 = mkNode('t3', 'TRANSITION');
  const j1 = mkNode('j1', 'JUNCTION');
  const clearings = range(branchCount).map(i => mkNode(`c${i + 1}`, 'CLEARING'));
  const fa = mkNode('fa', 'FINAL_APPROACH');
  const nodes: PathNode[] = [
    mkNode('start', 'START'), t1, t2, j1, t3, ...clearings, fa, mkNode('gate', 'GATE'),
  ];
  const edges: RawEdge[] = [];

  // Spine
  addEdge(edges, 'start', 't1', true);
  addEdge(edges, 't1', 't2', true);
  addEdge(edges, 't2', 'j1', true);
  addEdge(edges, 'j1', 't3', true);
  addEdge(edges, 't3', 'fa', true);
  addEdge(edges, 'fa', 'gate', true);

  // Branches alternate between J1 and T2
  for (let i = 0; i < branchCount; i++) {
    addEdge(edges, i % 2 === 0 ? 'j1' : 't2', `c${i + 1}`, false);
  }

  // Bypass loop: C1 → T3 (START→T1→T2→J1→C1→T3→FA→GATE)
  addEdge(edges, 'c1', 't3', false);
  for (let i = 1; i < Math.min(loopCount, branchCount - 1); i++) {
    addEdge(edges, `c${i + 1}`, 'fa', false);
  }

  return { nodes, rawEdges: edges };
}

// ── 4. hub_and_spoke ──────────────────────────────────────────────────────────
//
// Central hub with 4–6 spokes; 1–3 spokes reconnect to the out-lane,
// creating multiple routes from start to gate.
//
//   START → HUB → T1 → FA → GATE
//            └── C1..Cn (spokes)
//            C1 → T1  (reconnect loop)

function buildHubAndSpoke(dna: ChapterMapDNA, _rng: () => number): RawGraph {
  const { branchCount, loopCount } = dna;
  const hub = mkNode('j1', 'JUNCTION', 'Main Hub');
  const t1  = mkNode('t1', 'TRANSITION');
  const clearings = range(branchCount).map(i => mkNode(`c${i + 1}`, 'CLEARING'));
  const fa = mkNode('fa', 'FINAL_APPROACH');
  const nodes: PathNode[] = [
    mkNode('start', 'START'), hub, t1, ...clearings, fa, mkNode('gate', 'GATE'),
  ];
  const edges: RawEdge[] = [];

  // Spine
  addEdge(edges, 'start', 'j1', true);
  addEdge(edges, 'j1', 't1', true);
  addEdge(edges, 't1', 'fa', true);
  addEdge(edges, 'fa', 'gate', true);

  // Spokes from hub
  for (let i = 0; i < branchCount; i++) addEdge(edges, 'j1', `c${i + 1}`, false);

  // Bypass loop: C1 → T1 (START→HUB→C1→T1→FA→GATE)
  addEdge(edges, 'c1', 't1', false);
  for (let i = 1; i < Math.min(loopCount, branchCount - 1); i++) {
    addEdge(edges, `c${i + 1}`, 'fa', false);
  }

  return { nodes, rawEdges: edges };
}

// ── 5. twin_hub ───────────────────────────────────────────────────────────────
//
// Two major hubs with 2–4 cross-connectors between them.
// The direct J1→J2 edge and the J1→T1→J2 spine create the twin-loop.
//
//   START → J1 → T1 → J2 → FA → GATE
//             ╲_________╱  (direct cross-connector)
//            C1,C2 off J1; C3+ off J2

function buildTwinHub(dna: ChapterMapDNA, _rng: () => number): RawGraph {
  const { branchCount, loopCount } = dna;
  const j1 = mkNode('j1', 'JUNCTION', 'Hub A');
  const j2 = mkNode('j2', 'JUNCTION', 'Hub B');
  const t1 = mkNode('t1', 'TRANSITION');
  const clearings = range(branchCount).map(i => mkNode(`c${i + 1}`, 'CLEARING'));
  const fa = mkNode('fa', 'FINAL_APPROACH');
  const nodes: PathNode[] = [
    mkNode('start', 'START'), j1, t1, j2, ...clearings, fa, mkNode('gate', 'GATE'),
  ];
  const edges: RawEdge[] = [];

  // Spine
  addEdge(edges, 'start', 'j1', true);
  addEdge(edges, 'j1', 't1', true);
  addEdge(edges, 't1', 'j2', true);
  addEdge(edges, 'j2', 'fa', true);
  addEdge(edges, 'fa', 'gate', true);

  // Direct cross-connector creating the twin-hub bypass
  addEdge(edges, 'j1', 'j2', true);

  // Clearings split across hubs
  const half = Math.ceil(branchCount / 2);
  for (let i = 0; i < half; i++) addEdge(edges, 'j1', `c${i + 1}`, false);
  for (let i = half; i < branchCount; i++) addEdge(edges, 'j2', `c${i + 1}`, false);

  // Additional loops: clearings reconnect to the other hub
  for (let i = 0; i < Math.min(loopCount - 1, branchCount); i++) {
    addEdge(edges, `c${i + 1}`, i < half ? 'j2' : 'fa', false);
  }

  return { nodes, rawEdges: edges };
}

// ── 6. braided_pathways ───────────────────────────────────────────────────────
//
// 2–3 parallel strands flowing through two join nodes.
// Each strand is a distinct path through the chapter; weave edges add loops.
//
//   START → JOIN1 → Sa1 → Sa2 → JOIN2 → FA → GATE
//             └──── Sb1 → Sb2 ─────┘
//             └──── Sc1 → Sc2 ─────┘  (if 3 strands)
//          Sa1 ─ Sb2  (weave cross-edge)

function buildBraidedPathways(dna: ChapterMapDNA, _rng: () => number): RawGraph {
  const { branchCount, loopCount } = dna;
  const strandCount = Math.min(3, Math.max(2, Math.ceil(branchCount / 2)));
  const join1 = mkNode('join1', 'JUNCTION', 'Braid Join A');
  const join2 = mkNode('join2', 'JUNCTION', 'Braid Join B');
  const fa = mkNode('fa', 'FINAL_APPROACH');

  const strandNodes: PathNode[] = [];
  for (let s = 0; s < strandCount; s++) {
    const L = String.fromCharCode(97 + s); // a, b, c
    strandNodes.push(mkNode(`s${L}1`, 'TRANSITION'));
    strandNodes.push(mkNode(`s${L}2`, 'TRANSITION'));
  }

  const nodes: PathNode[] = [
    mkNode('start', 'START'), join1, ...strandNodes, join2, fa, mkNode('gate', 'GATE'),
  ];
  const edges: RawEdge[] = [];

  // Primary spine through strand A
  addEdge(edges, 'start', 'join1', true);
  addEdge(edges, 'join1', 'sa1', true);
  addEdge(edges, 'sa1', 'sa2', true);
  addEdge(edges, 'sa2', 'join2', true);
  addEdge(edges, 'join2', 'fa', true);
  addEdge(edges, 'fa', 'gate', true);

  // Parallel strands
  for (let s = 1; s < strandCount; s++) {
    const L = String.fromCharCode(97 + s);
    addEdge(edges, 'join1', `s${L}1`, false);
    addEdge(edges, `s${L}1`, `s${L}2`, false);
    addEdge(edges, `s${L}2`, 'join2', false);
  }

  // Weave connections across strands (loops beyond the parallel paths)
  for (let i = 0; i < Math.min(loopCount - strandCount + 1, 3); i++) {
    const L1 = String.fromCharCode(97 + (i % strandCount));
    const L2 = String.fromCharCode(97 + ((i + 1) % strandCount));
    addEdge(edges, `s${L1}1`, `s${L2}2`, false);
  }

  return { nodes, rawEdges: edges };
}

// ── 7. campus_promenade ───────────────────────────────────────────────────────
//
// Sequential plazas (clearings) connected by transition corridors.
// Side branches off each plaza; side1 reconnects to the next plaza,
// creating a bypass loop.
//
//   START → CP1 → CT1 → CP2 → CT2 → CP3 → FA → GATE
//              └── SIDE1          └── SIDE2
//              SIDE1 → CP2  (bypass)

function buildCampusPromenade(dna: ChapterMapDNA, _rng: () => number): RawGraph {
  const { hubCount, branchCount, loopCount } = dna;
  const plazaCount = Math.max(2, hubCount);
  const plazas     = range(plazaCount).map(i => mkNode(`cp${i + 1}`, 'CLEARING', `Plaza ${i + 1}`));
  const connectors = range(plazaCount - 1).map(i => mkNode(`ct${i + 1}`, 'TRANSITION'));
  const sides      = range(branchCount).map(i => mkNode(`side${i + 1}`, 'CLEARING'));
  const fa = mkNode('fa', 'FINAL_APPROACH');
  const nodes: PathNode[] = [
    mkNode('start', 'START'), ...plazas, ...connectors, ...sides, fa, mkNode('gate', 'GATE'),
  ];
  const edges: RawEdge[] = [];

  // Sequential spine
  addEdge(edges, 'start', 'cp1', true);
  for (let i = 0; i < plazaCount - 1; i++) {
    addEdge(edges, `cp${i + 1}`, `ct${i + 1}`, true);
    addEdge(edges, `ct${i + 1}`, `cp${i + 2}`, true);
  }
  addEdge(edges, `cp${plazaCount}`, 'fa', true);
  addEdge(edges, 'fa', 'gate', true);

  // Side branches off each plaza (cycling)
  for (let i = 0; i < branchCount; i++) {
    addEdge(edges, `cp${1 + (i % plazaCount)}`, `side${i + 1}`, false);
  }

  // Bypass loop: side1 → cp2 (START→CP1→SIDE1→CP2→...→GATE)
  if (plazaCount >= 2) addEdge(edges, 'side1', 'cp2', false);
  for (let i = 1; i < Math.min(loopCount - 1, branchCount); i++) {
    const targetIdx = Math.min(i + 1, plazaCount);
    addEdge(edges, `side${i + 1}`, `cp${targetIdx}`, false);
  }

  return { nodes, rawEdges: edges };
}

// ── 8. radial_training_center ─────────────────────────────────────────────────
//
// Asymmetric: START enters hub from one side; GATE exits from the other.
// Spokes radiate from hub; C1 reconnects to the out-transition.
//
//   START → T_IN → HUB → T_OUT → FA → GATE
//                   └── C1..Cn (spokes)
//                   C1 → T_OUT  (bypass loop)

function buildRadialTrainingCenter(dna: ChapterMapDNA, _rng: () => number): RawGraph {
  const { branchCount, loopCount } = dna;
  const tIn  = mkNode('t_in', 'TRANSITION');
  const hub  = mkNode('j1', 'JUNCTION', 'Training Hub');
  const tOut = mkNode('t_out', 'TRANSITION');
  const clearings = range(branchCount).map(i => mkNode(`c${i + 1}`, 'CLEARING'));
  const fa = mkNode('fa', 'FINAL_APPROACH');
  const nodes: PathNode[] = [
    mkNode('start', 'START'), tIn, hub, tOut, ...clearings, fa, mkNode('gate', 'GATE'),
  ];
  const edges: RawEdge[] = [];

  // Spine
  addEdge(edges, 'start', 't_in', true);
  addEdge(edges, 't_in', 'j1', true);
  addEdge(edges, 'j1', 't_out', true);
  addEdge(edges, 't_out', 'fa', true);
  addEdge(edges, 'fa', 'gate', true);

  // Radial spokes
  for (let i = 0; i < branchCount; i++) addEdge(edges, 'j1', `c${i + 1}`, false);

  // Bypass loop: C1 → T_OUT (HUB→C1→T_OUT bypass)
  addEdge(edges, 'c1', 't_out', false);
  for (let i = 1; i < Math.min(loopCount, branchCount - 1); i++) {
    addEdge(edges, `c${i + 1}`, 'fa', false);
  }

  return { nodes, rawEdges: edges };
}

// ── 9. staggered_academic_blocks ─────────────────────────────────────────────
//
// 2×N grid of junctions with landmark dead-ends at corners.
// Top row forms the primary spine; bottom row creates a parallel detour.
//
//   START → J1 → J2 → FA → GATE   (top row)
//            |    |
//           J3 — J4               (bottom row)
//           └L1  └L2              (landmark dead ends)

function buildStaggeredAcademicBlocks(dna: ChapterMapDNA, _rng: () => number): RawGraph {
  const { hubCount, branchCount } = dna;
  const cols = Math.max(2, Math.ceil(hubCount / 2));
  // Top row: j1..jCols; bottom row: j(cols+1)..j(2*cols)
  const junctions: PathNode[] = [];
  for (let i = 0; i < cols * 2; i++) junctions.push(mkNode(`j${i + 1}`, 'JUNCTION'));
  const landmarks = range(2).map(i => mkNode(`l${i + 1}`, 'LANDMARK'));
  const clearings  = range(Math.max(1, branchCount - 2)).map(i => mkNode(`c${i + 1}`, 'CLEARING'));
  const fa = mkNode('fa', 'FINAL_APPROACH');
  const nodes: PathNode[] = [
    mkNode('start', 'START'), ...junctions, ...landmarks, ...clearings, fa, mkNode('gate', 'GATE'),
  ];
  const edges: RawEdge[] = [];

  // Top row spine
  addEdge(edges, 'start', 'j1', true);
  for (let c = 1; c < cols; c++) addEdge(edges, `j${c}`, `j${c + 1}`, true);
  addEdge(edges, `j${cols}`, 'fa', true);
  addEdge(edges, 'fa', 'gate', true);

  // Vertical connections (top ↔ bottom)
  for (let c = 0; c < cols; c++) {
    addEdge(edges, `j${c + 1}`, `j${cols + c + 1}`, false);
  }
  // Bottom row connections (create detour loop)
  for (let c = 1; c < cols; c++) {
    addEdge(edges, `j${cols + c}`, `j${cols + c + 1}`, false);
  }
  // Bottom-right corner reconnects to FA (bottom row bypass)
  addEdge(edges, `j${cols * 2}`, 'fa', false);

  // Landmark dead ends at bottom corners
  addEdge(edges, `j${cols + 1}`, 'l1', false);
  addEdge(edges, `j${cols * 2}`, 'l2', false);

  // Clearings off top row junctions
  for (let i = 0; i < clearings.length; i++) {
    addEdge(edges, `j${1 + (i % cols)}`, `c${i + 1}`, false);
  }

  return { nodes, rawEdges: edges };
}

// ── 10. clustered_training_bays ───────────────────────────────────────────────
//
// Halls (junctions) connected by a central corridor (transition).
// Rooms (clearings) cluster off each hall.
// Room R1 reconnects to the corridor (bypass loop).
//
//   START → HALL1 → [HALL2 →] CORRIDOR → FA → GATE
//              └── R1..Rn (rooms)
//              R1 → CORRIDOR  (bypass)

function buildClusteredTrainingBays(dna: ChapterMapDNA, _rng: () => number): RawGraph {
  const { hubCount, branchCount, loopCount } = dna;
  const hallCount = Math.max(1, hubCount - 1);
  const halls    = range(hallCount).map(i => mkNode(`hall${i + 1}`, 'JUNCTION'));
  const corridor = mkNode('corridor', 'TRANSITION');
  const rooms    = range(branchCount).map(i => mkNode(`r${i + 1}`, 'CLEARING'));
  const fa = mkNode('fa', 'FINAL_APPROACH');
  const nodes: PathNode[] = [
    mkNode('start', 'START'), ...halls, corridor, ...rooms, fa, mkNode('gate', 'GATE'),
  ];
  const edges: RawEdge[] = [];

  // Spine
  addEdge(edges, 'start', 'hall1', true);
  for (let i = 1; i < hallCount; i++) addEdge(edges, `hall${i}`, `hall${i + 1}`, true);
  addEdge(edges, `hall${hallCount}`, 'corridor', true);
  addEdge(edges, 'corridor', 'fa', true);
  addEdge(edges, 'fa', 'gate', true);

  // Rooms distributed across halls
  const roomsPerHall = Math.max(1, Math.ceil(branchCount / hallCount));
  for (let i = 0; i < branchCount; i++) {
    const hall = `hall${1 + Math.min(Math.floor(i / roomsPerHall), hallCount - 1)}`;
    addEdge(edges, hall, `r${i + 1}`, false);
  }

  // Bypass loop: R1 → CORRIDOR (HALL→R1→CORRIDOR bypass)
  addEdge(edges, 'r1', 'corridor', false);
  for (let i = 1; i < Math.min(loopCount, branchCount - 1); i++) {
    addEdge(edges, `r${i + 1}`, 'fa', false);
  }

  return { nodes, rawEdges: edges };
}

// ── 11. serpentine_campus_walk ────────────────────────────────────────────────
//
// Winding path through 3–4 bends; side branches at each bend.
// SIDE1 shortcuts forward to B2 (bypass B1→B2), forming the first loop.
//
//   START → B1 → B2 → B3 → FA → GATE
//             └── S1  └── S2  └── S3
//             S1 → B2  (bypass shortcut)

function buildSerpentineCampusWalk(dna: ChapterMapDNA, _rng: () => number): RawGraph {
  const { hubCount, branchCount, loopCount } = dna;
  const bendCount = Math.max(3, hubCount + 1);
  const bends = range(bendCount).map(i => mkNode(`b${i + 1}`, 'JUNCTION'));
  const sides = range(branchCount).map(i => mkNode(`side${i + 1}`, 'CLEARING'));
  const fa = mkNode('fa', 'FINAL_APPROACH');
  const nodes: PathNode[] = [
    mkNode('start', 'START'), ...bends, ...sides, fa, mkNode('gate', 'GATE'),
  ];
  const edges: RawEdge[] = [];

  // Spine
  addEdge(edges, 'start', 'b1', true);
  for (let i = 1; i < bendCount; i++) addEdge(edges, `b${i}`, `b${i + 1}`, true);
  addEdge(edges, `b${bendCount}`, 'fa', true);
  addEdge(edges, 'fa', 'gate', true);

  // Side branches at each bend (cycling)
  for (let i = 0; i < branchCount; i++) {
    addEdge(edges, `b${1 + (i % bendCount)}`, `side${i + 1}`, false);
  }

  // Bypass loop: SIDE1 → B2 (START→B1→SIDE1→B2→...→GATE)
  addEdge(edges, 'side1', 'b2', false);
  // Additional shortcuts further along the serpentine
  for (let i = 1; i < Math.min(loopCount - 1, branchCount); i++) {
    const target = `b${Math.min(i + 2, bendCount)}`;
    addEdge(edges, `side${i + 1}`, target, false);
  }

  return { nodes, rawEdges: edges };
}

// ── 12. multi_court_campus ────────────────────────────────────────────────────
//
// Courts (clearings) connected in sequence by transitions.
// Direct cross-links between consecutive courts create loop alternatives.
//
//   START → CT1 → CN1 → CT2 → CN2 → CT3 → FA → GATE
//             └── S1         └── S2
//             CT1 → CT2  (cross-link loop)

function buildMultiCourtCampus(dna: ChapterMapDNA, _rng: () => number): RawGraph {
  const { hubCount, branchCount, loopCount } = dna;
  const courtCount = Math.max(3, Math.min(hubCount + 1, 5));
  const courts    = range(courtCount).map(i => mkNode(`ct${i + 1}`, 'CLEARING', `Court ${i + 1}`));
  const connectors = range(courtCount - 1).map(i => mkNode(`cn${i + 1}`, 'TRANSITION'));
  const sides      = range(branchCount).map(i => mkNode(`side${i + 1}`, 'CLEARING'));
  const fa = mkNode('fa', 'FINAL_APPROACH');
  const nodes: PathNode[] = [
    mkNode('start', 'START'), ...courts, ...connectors, ...sides, fa, mkNode('gate', 'GATE'),
  ];
  const edges: RawEdge[] = [];

  // Sequential spine through courts
  addEdge(edges, 'start', 'ct1', true);
  for (let i = 0; i < courtCount - 1; i++) {
    addEdge(edges, `ct${i + 1}`, `cn${i + 1}`, true);
    addEdge(edges, `cn${i + 1}`, `ct${i + 2}`, true);
  }
  addEdge(edges, `ct${courtCount}`, 'fa', true);
  addEdge(edges, 'fa', 'gate', true);

  // Side branches off courts
  for (let i = 0; i < branchCount; i++) {
    addEdge(edges, `ct${1 + (i % courtCount)}`, `side${i + 1}`, false);
  }

  // Cross-court direct links (loop: bypass CN connectors)
  addEdge(edges, 'ct1', 'ct2', false); // first cross-link
  for (let i = 1; i < Math.min(loopCount, courtCount - 1); i++) {
    addEdge(edges, `ct${i + 1}`, `ct${Math.min(i + 2, courtCount)}`, false);
  }

  // Side1 reconnects to ct2 (adds another alternative through side area)
  if (branchCount > 0 && courtCount >= 2) addEdge(edges, 'side1', 'ct2', false);

  return { nodes, rawEdges: edges };
}

// ── Family builder dispatch ───────────────────────────────────────────────────

const FAMILY_BUILDERS: Record<
  MapTopologyFamily,
  (dna: ChapterMapDNA, rng: () => number) => RawGraph
> = {
  open_plaza:                buildOpenPlaza,
  academic_quad:             buildAcademicQuad,
  simulation_complex:        buildSimulationComplex,
  hub_and_spoke:             buildHubAndSpoke,
  twin_hub:                  buildTwinHub,
  braided_pathways:          buildBraidedPathways,
  campus_promenade:          buildCampusPromenade,
  radial_training_center:    buildRadialTrainingCenter,
  staggered_academic_blocks: buildStaggeredAcademicBlocks,
  clustered_training_bays:   buildClusteredTrainingBays,
  serpentine_campus_walk:    buildSerpentineCampusWalk,
  multi_court_campus:        buildMultiCourtCampus,
};

// ── Core generator ────────────────────────────────────────────────────────────

/**
 * Generates a PathwayGraph from a ChapterMapDNA.
 * Tries up to MAX_GRAPH_RETRIES RNG seeds until the graph passes validation.
 * Falls back to the last-generated graph if all attempts fail.
 */
export function generatePathwayGraphForDNA(dna: ChapterMapDNA): PathwayGraph {
  const seedBase = `${dna.seed}:pathway-graph`;
  const builder = FAMILY_BUILDERS[dna.topologyFamily];

  let lastGraph: PathwayGraph | null = null;

  for (let attempt = 0; attempt < MAX_GRAPH_RETRIES; attempt++) {
    const rng = mulberry32(fnv1a32(`${seedBase}:attempt-${attempt}`));
    const raw   = builder(dna, rng);
    const rng2  = mulberry32(fnv1a32(`${seedBase}:lanes-${attempt}`));
    const graph = finalizeGraph(dna.chapterId, dna.seed, raw, rng2);
    const validation = validatePathwayGraph(graph);

    if (validation.valid) return graph;
    lastGraph = graph;

    if (
      typeof process !== 'undefined' &&
      process.env['NODE_ENV'] !== 'production' &&
      attempt === MAX_GRAPH_RETRIES - 1
    ) {
      console.warn(
        `[journeyMap] ch${dna.chapterId} pathway graph: all ${MAX_GRAPH_RETRIES} ` +
          `attempts failed, using fallback`,
        validation.errors,
      );
    }
  }

  return lastGraph!;
}

// ── Cache + public API ────────────────────────────────────────────────────────

const graphCache = new Map<number, PathwayGraph>();

/**
 * Returns the PathwayGraph for the given chapter number.
 * Results are cached — the same chapter always returns the same object.
 */
export function getChapterPathwayGraph(chapter: number): PathwayGraph {
  const cached = graphCache.get(chapter);
  if (cached) return cached;
  const dna   = getChapterMapDNA(chapter);
  const graph = generatePathwayGraphForDNA(dna);
  graphCache.set(chapter, graph);
  return graph;
}

/**
 * Returns pathway graphs for a range of chapters [from, to] inclusive.
 * Useful for batch validation and testing.
 */
export function getChapterPathwayGraphRange(
  from: number,
  to: number,
): PathwayGraph[] {
  const result: PathwayGraph[] = [];
  for (let c = from; c <= to; c++) result.push(getChapterPathwayGraph(c));
  return result;
}
