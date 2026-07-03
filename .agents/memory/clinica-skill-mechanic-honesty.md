---
name: Clinica skill/mechanic honesty
description: Keeping hero skill text truthful to real battle mechanics, and where player-facing explanations must live
---
Every HeroSkill's player-facing text (description/shortEffect/beginnerExplanation — all surfaced in battle.tsx skill cards + detail) must map to an effect field that battle.ts actually consumes. Only these are read in applySkill: reveal, stabilize, strike, shield, blockSpread, risk. There is NO status-effect system, so `cleanse` is a dead no-op — never advertise "cleanse status effects".

**Why:** several skills shipped with flavor-only claims (Threadwatch "warn next threat", Isolation Seal "stop spread", Mind Anchor "cleanse"). Prefer wiring flavor to an EXISTING mechanic (e.g. brace = shield%, spread-block = set blockNextSpread) or rewording honestly, over building new systems.

**How to apply:** shield N = next enemy hit takes N% less damage (100 = full block). blockNextSpread stops one 'spread' enemy attack's corruption regrow (was only set by Infection Control consult; now also by skills with `blockSpread: true`).

**Codex is NOT the place for mechanic text:** every CODEX entry is LOCKED until an enemy `teaches` its id (codex.tsx). Adding mechanics to the CODEX array = permanently sealed. Player-facing mechanics live in the always-visible `BATTLE_MECHANICS` array (content.ts) rendered as its own section in codex.tsx.
