---
name: Mealcraft Lotus Plate
description: Design constraints and patterns for the Mealcraft off-shift nutrition mini-game.
---

## Core pattern
- Route: `/mealcraft` — entry from lotus-journal.tsx actionCard
- Tutorial ID: `mealcraftIntro` in FORCED_TUTORIAL_IDS
- requiredTargetId for step 2: `"food_grilled_chicken"` — must match food item `id` exactly

## FoodCard sub-component rule
`useHighlightTarget(food.id)` MUST be called inside a per-food sub-component (FoodCard), not
in a loop in the parent. Hooks cannot be called in loops in React.

## Layout order matters for tutorial targeting
Food grid placed BEFORE tray/meters in scroll order so grilled chicken (first item in FOODS array)
is visible above the fold when the tutorial scrim fires. If food grid is moved below tray/meters,
the scrim will block scrolling and the user cannot reach the highlighted target.

## Reward pattern
Visual-only completion badge ("Lotus Plate Complete" + "Nutrition Sense +1"). No applyRewards()
call — this stays display-only per spec ("If rewards are not safely supported, show visual badge").

## Nutrition evaluation thresholds (Diabetic Lunch Tray)
Good plate: protein≥3 AND fiber≥2 AND sugar≤4 AND sodium≤4 AND hydration≥2 AND count≥2
Checks are ordered: sugar → sodium → protein → hydration → fiber (first fail wins).

**Why:** Sugar/sodium are the highest-risk items for a diabetic patient and should give feedback
priority over protein/hydration misses.
