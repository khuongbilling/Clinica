---
name: Clinica C4 milestone rewards
description: Three one-time reward categories (level milestones, chapter chests, chapter 3-star bonuses); data layer, store callbacks, and UI surfaces.
---

## Rule
Any new "claim-once" reward category needs:
1. A data constant array in `milestones.ts` with stable `id` strings.
2. A `claimed_<category>?: string[]` field in `types.ts` + backfill in `normalizeProgression` + default in `createPlayer` + both Player and PlayerUpdate in `server.py`.
3. A `claim<Category>` useCallback in `store.tsx` wired into the Ctx type and useMemo.

**Why:** The three existing categories (level, chapter chest, chapter 3-star) each follow this pattern exactly. Future categories must use separate fields — never reuse `claimed_milestones` (that belongs to the world event / Miasma Bloom system).

## Surfaces
- `/milestones` screen (`app/milestones.tsx`): level milestones + chapter 3-star bonuses.
- Journey Map (`/journey` → `ChapterJourneyMap.tsx`): chapter completion chest button (gift icon) per-chapter card, gold when claimable.
- Hub (`(tabs)/index.tsx`): gold "Milestones" FeatureButton in sideCol.

## Reward totals (Phase 1)
- Chapter 3-star bonuses total: 220 Refined Lotus Gems (10+10+15+15+20+20+25+25+30+50).
- Chapter chests top award (Ch.10): 500 Shards + 75 Refined Gems + "recall_survivor" title.

## Key constraint
`lotus_gems_paid` must NEVER be required for any progression reward. All C4 rewards are free-track only.
