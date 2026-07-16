---
name: Clinica objective grant sites
description: Where the 15-step objective chain fires XP; catch-up coverage in University.
---

## Objective step chain (15 steps)

Steps 1–8 fire at action sites (battle complete, lotus recall, post-recall, reminiscence) — NOT in destination screens.  
Steps 9–12 are covered by University catch-up on visit.  
Steps 13–15 fire at later milestones.

University `catchupIds` array must cover **steps 1–12** (12 IDs total). As of Push 1, it does.

**Why:** Early players often skip screens; catch-up on University visit ensures no XP is permanently lost for steps they already completed before the system existed.

**How to apply:** When adding new early-game objective steps (≤12), add them to `catchupIds` in `university/index.tsx` AND ensure `reconcileEarlyObjectives` in `objectiveProgress.ts` can detect completion via existing PlayerState fields.
