---
name: Lotus Plate Journal (off-shift wellness feature)
description: Design/architecture decisions for Clinica's off-shift meal/wellness logging system — currencies, caps, isolation boundary.
---

Off-shift wellness features (meal/wellness logging, currencies, gamified progression) must be fully isolated from the core game loop: they mutate only their own slice of PlayerState (e.g. `wellness`) and never touch stamina, shift time, AP, Clinical Cue, battle/Care Chain, or chapter progression fields.

**Why:** these systems are meant to be played anytime without gating or competing with the main clinical-training loop; any shared mutation risks silent regressions in grading/progression that are hard to trace back to an "unrelated" feature.

**How to apply:** give the off-shift feature its own top-level PlayerState field, its own pure-logic resolver module (no side effects on other fields), and reuse the existing atomic store-action pattern (mutate `playerRef.current` synchronously, then `await updateState(next)`) rather than writing a new state-update path.

Reward-currency design for non-punitive wellness/education features: use two currencies — one uncapped "soft" currency for participation (petals) and one capped "hard" currency (gems) with daily+weekly caps, gated further by a same-day signature dedup (e.g. hashing category composition) so repeating the identical log doesn't farm capped currency, while still awarding the soft currency for any honest log.

**Why:** prevents low-effort repetition from being profitable while never punishing or blocking the user from logging (no shame mechanics), keeping the loop encouraging rather than gated.

Capped/gamified currencies tied to real-world wellness activities must be restricted to cosmetic-only spending — never redeemable for gameplay power, extra attempts, stamina, or any pay-to-win-adjacent mechanic, even inside "coming soon" placeholder copy. An architect review caught "Extra practice attempts" in boutique placeholder copy as a violation of this even though it wasn't implemented yet.

**Why:** blurring wellness-currency into gameplay-advantage territory undermines the non-judgmental/no-pay-to-win intent and can resurface as a real feature later if the placeholder isn't strict from day one.

**How to apply:** when writing "coming soon" / placeholder item lists for a wellness currency store, sanity-check every item against "is this purely cosmetic (skins, themes, decorations) with zero gameplay effect?" before listing it.
