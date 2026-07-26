---
name: Hero XP & Training Economy
description: How hero leveling, Experience Scrolls, and the player-level gate work together.
---

## The rule

Hero level = capped by the LOWER of two values:
1. `levelCapForStar(star)` — the Certification Star cap (★1=10, ★2=20 … ★5=50)
2. `playerLevel` — the player's account level (prevents whales buying scrolls to skip progression)

Use `heroEffectiveLevelCap(star, playerLevel)` (university.ts) everywhere a cap is needed.

**Why:** Scrolls can be purchased with Crowns. Without the player-level gate, bulk-buying scrolls bypasses the time-gate that chapter/battle XP creates.

**How to apply:**
- `trainHero` in store.tsx: check effective cap, not just star cap.
- `applyRewards` (milestone block, ~line 596): use `Math.min(levelCapForStar, playerLvl)` as cap.
- `applyRewards` callback (~line 875): same gate via `battlePlayerLvl`.
- New hero-level code: always call `heroEffectiveLevelCap`, never `levelCapForStar` alone.

## Experience Scroll economy

- `EXP_SCROLL_XP = 100` XP per scroll (university.ts).
- `EXP_SCROLL_CROWN_COST = 180` Crowns (buy from Training Hall directly via `purchaseItem`).
- **Battle drops:** `getBattleScrollDrop(stars, isBoss)` in battleXp.ts.
  - 0 for 1★ or loss.
  - 1 for 2★–3★ normal win.
  - 2 for any boss win.
  - Training and prologue battles: always 0 (not farmable).
- XP curve: `heroXpCostForLevel(L) = 40 + (L-1)*8`.
  - 1 scroll ≈ 2 levels at Level 1; ≈ 0.8 levels at Level 10; need 2 scrolls/level at Level 15+.

## XP bar display

- `prog.xp` = banked XP remainder after last level-up (never resets to 0 on cap — banked).
- XP within current level: `prog.xp / heroXpCostForLevel(prog.level)`.
- Level bar across cap: `prog.level / heroEffectiveLevelCap(prog.star, playerLevel)`.

## Key files

- `university.ts` — `EXP_SCROLL_XP`, `EXP_SCROLL_CROWN_COST`, `heroEffectiveLevelCap`, `canUseScroll`
- `battleXp.ts` — `getBattleScrollDrop`
- `store.tsx` — `trainHero` callback (scroll cost + player gate), both `addHeroXp` call sites
- `app/university/training.tsx` — Training Hall UI (scroll buy, XP bars, dual-cap display)
- `app/hero/[id].tsx` — EvolveTab Hero Level section (same logic, inline)
