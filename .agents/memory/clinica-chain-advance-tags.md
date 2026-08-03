---
name: Care-chain advance tags
description: How silent care-chain failures are prevented and audited in clinical.ts
---

Rule: `canAdvancePathway` matches action clinicalTags against preferredChainTags ∪ allowedActionTags ∪ `chainAdvanceTags` (new optional EnemyClinical field). `chainAdvanceTags` is chain-only — it never changes `evaluateClinicalAppropriateness` status or modifiers, so weak (limited-relevance) actions keep their weak modifier but still advance the chain when their pathway role matches.

**Why:** Battle only blocks locked/unsafe/inappropriate before chain advancement, so any non-blocked, role-matching action that couldn't tag-match failed *silently* (chain didn't move, no feedback). Patching via allowedActionTags instead would flip weak→appropriate and change combat balance.

**How to apply:** After editing SKILL_CLINICAL or ENEMY_CLINICAL, run `cd frontend && node_modules/.bin/sucrase-node src/game/audit-care-chain.ts` — it iterates all skill×enemy pairs and exits non-zero on any silent chain failure; fix gaps by extending the enemy's `chainAdvanceTags`.
