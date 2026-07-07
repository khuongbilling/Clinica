---
name: Tutorial onRequiredAction discipline
description: Where and when to fire onRequiredAction() — actual user action handler only, never navigation/banner tap.
---

# Tutorial onRequiredAction Discipline

## The rule
`onRequiredAction("actionType")` MUST fire from the actual user-action handler that performs the real game action — not from a navigation call, banner tap, or route push that merely takes the player *toward* that action.

**Why:** Code review rejected a `firstLesson` tutorial step where `onRequiredAction("openLesson")` fired on the Lessons banner tap in `university/index.tsx`. The tap only navigates to the lessons screen; it doesn't start a lesson. The correct fire site was the Lotus path node press and department card press in `lessons.tsx`, which actually route into a lesson.

Similarly, `onRequiredAction("placeBuilding")` in `kingdom.tsx` must only fire inside the `if (placement.kind === "building")` branch of `confirmPlacement()`, not after the else-branch that handles decoration placement.

**How to apply:**
1. Ask: "Has the player actually *done* the thing at this callsite?" If not, don't fire here.
2. Navigation / banner taps → no fire.
3. Actual game action completed (lesson opened, building placed, battle started) → fire.
4. Keep the guard `if (!isCompleted("id"))` to avoid double-fires, and place it at the action site, not at the navigation site.
