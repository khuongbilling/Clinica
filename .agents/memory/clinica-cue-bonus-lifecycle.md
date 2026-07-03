---
name: Clinica Clinical Cue bonus lifecycle
description: How the Clinical Cue stabilize bonus (cueBonusStabilize) is applied and cleared in battle
---

Correct Clinical Cue answer grants `cueBonusStabilize += 8` (plus +1 AP this turn, +ultimate charge). The bonus is **turn-scoped**: it empowers EVERY stabilizing action taken for the rest of the current turn, then is cleared.

**The rule:**
- Add `+ next.cueBonusStabilize` at every stabilize site: skill (`skill.stabilize`), item (`item.target==='stability'`), card (`card.stabilize`), AND temp action (`a.stabilize`). There are FOUR sites — the temp-action one is easy to miss.
- Do NOT reset it per action. Clear it in exactly one place: `endPlayerTurn` (set `cueBonusStabilize: 0` in the `next` state object).

**Why:** User explicitly chose "empower ALL stabilizing actions for the rest of the current turn, then clear" over the old single-use-next-action consumable (which felt like it "didn't last"). Prior design reset it to 0 after the first stabilizing action.

**How to apply:** If you add a new action type that has a `stabilize` effect, remember to fold in `cueBonusStabilize`. Only `stabilize`-field effects are empowered — direct heals like Rapid Response / Stabilizer ultimate are intentionally excluded.
