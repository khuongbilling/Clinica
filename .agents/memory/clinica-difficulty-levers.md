---
name: Clinica stability/corruption difficulty levers
description: How the two progression difficulty knobs work (uncapped corruption HP + hidden stability resistance) and the invariants they must preserve
---

# Stability / corruption difficulty levers

## Corruption is enemy HP with NO upper limit
Corruption = enemy HP. It has a floor of 0 but no ceiling — bosses can start >100 (boss starts 180) and can be worsened/regrown above 100. Every corruption-INCREASE site must use `Math.max(0, corruption + delta)`, never `clamp(..., 0, 100)` or `Math.min(100, ...)`.

**Why:** worsen paths (`applyResolutionToState`) AND enemy-turn regrowth (rebound +10, spread/assault regrow) each independently capped corruption at 100. For a >100-HP boss that cap silently *reduced* HP to 100 — the opposite of "worsen." There were FOUR such caps in `battle.ts` (2 worsen + 2 regrow); miss any one and high-HP enemies behave inconsistently.

**How to apply:** when adding any code that raises corruption, floor at 0 only. The corruption threshold functions (`getStabilizationModifier`, `getEnemyDamage`, `getTurnAP`, `getDangerLevel`) are monotonic `>=` buckets that saturate at the top bucket, so they're safe for values >100 — no changes needed there. UI: the corruption bar WIDTH must be `Math.min(100, pct)` (display only) since state can exceed the starting value; the numeric label shows the true value.

## Hidden stability resistance (per-enemy)
`Enemy.stabilityResistance?: number` (0..0.8, default 0, optional/backward-compatible, never shown in UI). `stabilityResistanceMultiplier(enemy) = 1 - clamp(r,0,0.8)` in clinical.ts. It multiplies EVERY dynamic stability-GAIN site in battle.ts (skill/item/temp/card stabilize + Care Chain bonus — all the ones that already run through `getStabilityGainModifier`). The patient recovers less than the skill's listed number; the listed number still displays.

**Why:** the design goal is "bosses shrug off healing." Cap at 0.8 so stabilizing is never worthless (≥20% always lands). Boss Lord Imbalance = 0.3.

**How to apply:** any NEW stabilize source must also multiply by `stabilityResistanceMultiplier(next.enemy)` or it becomes an accidental resistance-bypass. INTENTIONAL bypasses left unresisted (design choice, documented): the scripted Stabilizer role +30 and Rapid Response call +15 emergency heals — reliable fail-safe levers vs resistant bosses.
