---
name: Clinica guided progression ladder
description: The intended mode-unlock order and the multi-site gate-sync gotcha
---

# Guided progression ladder

Content is re-gated into a guided spine so a recalled player isn't overwhelmed:
University (school/foundation) → Ward Shift (framed as University *simulations* of
weaker imitated disease) → Ward Defense → Realm building → Boss (the ward exam) →
living-world endgame (World Events / Factions).

**Why:** the old ladder dumped Ward Shift + Realm + Hall together at one level and
unlocked the Realm *before* Ward Defense/Boss, which felt chaotic. The user
explicitly chose to keep the Realm *before* the boss (not after).

**How to apply:**
- Level thresholds live in `FEATURE_UNLOCKS` (progression.ts). Realm must stay
  ABOVE ward_defense and BELOW boss so the ordering holds via levels alone.
- Ward Shift is NOT purely level-gated — it has a *narrative* gate in
  `checkFeatureGate('ward_shift')` requiring `lessonsStarted` (first University
  lesson), so School always precedes the simulated ward. Screens must call
  `checkFeatureGate`, not level-only `isFeatureUnlocked`, for ward_shift.
- Ward Shift is lore-framed as University simulations (weaker imitated disease at a
  foundation level) that sharpen into real ward returns in later chapters; keep
  modeHub.ts copy consistent with that framing.

## Boss gate is duplicated in THREE places — keep them in sync
The Lord Imbalance boss unlock is independently derived in:
1. `app/shift.tsx` (hub banner) — via `isFeatureUnlocked('boss', level)`
2. `app/mode/[id].tsx` (mode intro) — via `playerLevel >= 7`
3. `app/boss.tsx` (deep-link target screen) — the real gate

If you change the boss threshold, update ALL THREE plus their lock copy, or the
deep-link screen will disagree with the hub. `app/boss.tsx` also keeps the boss
open once `bosses_defeated > 0`. Verdantha (world boss) is a separate token-based
gate, untouched by the level ladder.
