---
name: Clinica skill balance budget
description: Per-AP value budget for hero skills and where combat multipliers amplify base values
---

# Skill balance (hero skills in content.ts HEROES)

Per-AP "value" budget used to rebalance hero skill `stabilize`/`strike`/`shield` fields:
- 1 AP pure effect ≈ 14
- 2 AP pure heal/strike ≈ 26–28 (emergency premium; e.g. Rapid Response 26, Critical Response 28, Purity Mark 26)
- 1 AP dual ≈ 20–24 total (split, e.g. Guardian's Touch 10/10, Mend 12/12)
- 2 AP dual ≈ 28–32 total (e.g. Rally Bell 20/10, River Surge 20/12)
- utility counts against the numeric budget: reveal 1 ≈ 5, reveal all ≈ 10, shield 50 ≈ 12, shield 100 ≈ 20, cleanse ≈ 6

**Why:** base values are amplified in combat — `combineFinalEffect` (clinical.ts) applies a clinical modifier (up to ~1.6x) AND a system-match modifier (up to 2x), so a raw 40 could balloon to ~3x. Keep base values moderate. Stabilize gains additionally decay at high stability via `getStabilityGainModifier`.

**How to apply:** when a skill feels too strong, check its per-AP raw sum against these bands first. When editing a skill's number, ALSO update the same line's `description` and `shortEffect` text strings (they embed the number, e.g. "+40 Stability") or the UI will lie to the player.

**Left intentionally unchanged (already fine):**
- `cards.ts` CARD_POOL — modest 6–12.
- `items.ts` ITEMS — high but clue-gated (require a revealed clue) so conditional power is justified.
- `items.ts` TEMP_ACTIONS (Open Airflow, Containment Order) — gated behind a 2-AP "Call" (≈3 AP total), so per-AP is actually below budget.
