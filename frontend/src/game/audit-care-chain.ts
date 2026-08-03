/**
 * Care-chain silent-failure audit (Task: care-chain coverage).
 *
 * Iterates every action map × ENEMY_CLINICAL and reports any case
 * where the action is clinically appropriate (evaluateClinicalAppropriateness
 * returns a non-blocking status: strong / appropriate / weak — i.e. NOT
 * locked / unsafe / inappropriate) AND the action carries a pathway role that
 * appears in the enemy's treatmentChain, yet canAdvancePathway returns null
 * for that chain position because the action's clinicalTags overlap neither
 * preferredChainTags nor allowedActionTags nor chainAdvanceTags.
 *
 * Such pairs are "silent chain failures": the player uses a fitting action at
 * the right chain step and the chain simply doesn't move, with no feedback.
 *
 * Action maps covered:
 *   • SKILL_CLINICAL  (hero skills, keyed by skill id)
 *   • ITEM_CLINICAL   (items, keyed by item name)
 *   • TEMP_CLINICAL   (temp/call actions, keyed by action id)
 *   • CALL_CLINICAL   (call options, keyed by call id)
 *   • CARD_CLINICAL   (cards, keyed by card id)
 *
 * Run:  cd frontend && node_modules/.bin/sucrase-node src/game/audit-care-chain.ts
 * Exits non-zero when gaps are found, so it can be used as a CI check.
 */

import {
  SKILL_CLINICAL,
  ITEM_CLINICAL,
  TEMP_CLINICAL,
  CALL_CLINICAL,
  ENEMY_CLINICAL,
  evaluateClinicalAppropriateness,
  canAdvancePathway,
  emptyChain,
  type ChainState,
  type PathwayRole,
} from './clinical';
import { CARD_CLINICAL } from './cards';

interface Gap {
  source: string;
  actionId: string;
  enemyId: string;
  role: PathwayRole;
  status: string;
  actionTags: string[];
}

const gaps: Gap[] = [];
let pairsChecked = 0;

type ActionMap = { source: string; map: typeof SKILL_CLINICAL };

const ACTION_MAPS: ActionMap[] = [
  { source: 'SKILL_CLINICAL',  map: SKILL_CLINICAL  },
  { source: 'ITEM_CLINICAL',   map: ITEM_CLINICAL   },
  { source: 'TEMP_CLINICAL',   map: TEMP_CLINICAL   },
  { source: 'CALL_CLINICAL',   map: CALL_CLINICAL   },
  { source: 'CARD_CLINICAL',   map: CARD_CLINICAL as typeof SKILL_CLINICAL },
];

for (const { source, map } of ACTION_MAPS) {
  for (const [actionId, action] of Object.entries(map)) {
    for (const [enemyId, enemy] of Object.entries(ENEMY_CLINICAL)) {
      pairsChecked++;

      // Neutral battle state: required clues revealed (so nothing is 'locked'),
      // stability low enough that conditional escalation actions are active.
      const battleState = {
        revealedLabels: action.requiredClues ?? [],
        stability: 40,
      };
      const evalRes = evaluateClinicalAppropriateness(action, enemy, battleState);
      if (
        evalRes.status === 'inappropriate' ||
        evalRes.status === 'unsafe' ||
        evalRes.status === 'locked'
      ) {
        continue; // legitimately blocked — chain SHOULD not advance
      }

      const roles = action.pathwayRoles ?? [];
      // Support cards have empty pathwayRoles — skip them.
      if (roles.length === 0) continue;

      // For every chain position whose required role this action provides,
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
            source,
            actionId,
            enemyId,
            role: step,
            status: evalRes.status,
            actionTags: action.clinicalTags,
          });
        }
      });
    }
  }
}

console.log(`[audit-care-chain] checked ${pairsChecked} action×enemy pairs across all maps`);
if (gaps.length === 0) {
  console.log('[audit-care-chain] OK — no silent chain failures found.');
  process.exit(0);
}

console.error(`[audit-care-chain] FOUND ${gaps.length} silent chain failure(s):`);
for (const g of gaps) {
  console.error(
    `  - [${g.source}] "${g.actionId}" vs enemy "${g.enemyId}" (role: ${g.role}, status: ${g.status})` +
    ` — tags [${g.actionTags.join(', ')}] match neither preferredChainTags nor allowedActionTags nor chainAdvanceTags`,
  );
}
process.exit(1);
