/**
 * Care-chain silent-failure audit (Task: care-chain coverage).
 *
 * Iterates every SKILL_CLINICAL × ENEMY_CLINICAL pair and reports any case
 * where the action is clinically appropriate (evaluateClinicalAppropriateness
 * returns a non-blocking status: strong / appropriate / weak — i.e. NOT
 * locked / unsafe / inappropriate) AND the skill carries a pathway role that
 * appears in the enemy's treatmentChain, yet canAdvancePathway returns null
 * for that chain position because the skill's clinicalTags overlap neither
 * preferredChainTags nor allowedActionTags.
 *
 * Such pairs are "silent chain failures": the player uses a fitting action at
 * the right chain step and the chain simply doesn't move, with no feedback.
 *
 * Run:  cd frontend && node_modules/.bin/sucrase-node src/game/audit-care-chain.ts
 * Exits non-zero when gaps are found, so it can be used as a CI check.
 */

import {
  SKILL_CLINICAL,
  ENEMY_CLINICAL,
  evaluateClinicalAppropriateness,
  canAdvancePathway,
  emptyChain,
  type ChainState,
  type PathwayRole,
} from './clinical';

interface Gap {
  skillId: string;
  enemyId: string;
  role: PathwayRole;
  status: string;
  skillTags: string[];
}

const gaps: Gap[] = [];
let pairsChecked = 0;

for (const [skillId, action] of Object.entries(SKILL_CLINICAL)) {
  for (const [enemyId, enemy] of Object.entries(ENEMY_CLINICAL)) {
    pairsChecked++;

    // Neutral battle state: required clues revealed (so nothing is 'locked'),
    // stability low enough that conditional escalation skills are active.
    const battleState = {
      revealedLabels: action.requiredClues ?? [],
      stability: 40,
    };
    const evalRes = evaluateClinicalAppropriateness(action, enemy, battleState);
    if (evalRes.status === 'inappropriate' || evalRes.status === 'unsafe' || evalRes.status === 'locked') {
      continue; // legitimately blocked — chain SHOULD not advance
    }

    const roles = action.pathwayRoles ?? [];
    // For every chain position whose required role this skill provides,
    // the chain must be advanceable (tag overlap must exist).
    enemy.treatmentChain.forEach((step, idx) => {
      if (!roles.includes(step)) return;
      const chain: ChainState = {
        progress: enemy.treatmentChain.slice(0, idx) as PathwayRole[],
        completed: false,
      };
      const advance = canAdvancePathway(action, enemy, chain);
      if (advance === null) {
        gaps.push({
          skillId,
          enemyId,
          role: step,
          status: evalRes.status,
          skillTags: action.clinicalTags,
        });
      }
    });
  }
}

console.log(`[audit-care-chain] checked ${pairsChecked} skill×enemy pairs`);
if (gaps.length === 0) {
  console.log('[audit-care-chain] OK — no silent chain failures found.');
  process.exit(0);
}

console.error(`[audit-care-chain] FOUND ${gaps.length} silent chain failure(s):`);
for (const g of gaps) {
  console.error(
    `  - skill "${g.skillId}" vs enemy "${g.enemyId}" (role: ${g.role}, status: ${g.status})` +
    ` — tags [${g.skillTags.join(', ')}] match neither preferredChainTags nor allowedActionTags`,
  );
}
process.exit(1);
