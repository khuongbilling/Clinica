---
name: Clinica Player Level vs Hero Level separation
description: How account-wide Player Level differs from per-hero Hero Level, and where each is derived/persisted.
---

Clinica has two independent leveling systems that must never be conflated:

- **Player Level** (account-wide): derived purely from `player.xp` via `playerLevelFromXp` in
  `progression.ts`. It gates stamina cap (`staminaMaxForLevel`), feature unlocks
  (`FEATURE_UNLOCKS`/`isFeatureUnlocked`/`nextLockedFeature`), and Player Class abilities
  (`PLAYER_CLASS_ABILITIES`, unlocked at 10/20/30, class derived from `aptitude` via
  `playerClassForAptitude`).
- **Hero Level** (per-hero): stored in `player.hero_progression[heroId].level`/`.xp`, capped by
  Certification Star (`levelCapForStar`), earned via battle contribution % (`splitContributionToHeroXp`)
  or directly bumped by Training Hall's `trainProgress` (which sets `.level` without touching `.xp` —
  this is fine, `addHeroXp` recomputes cost curve from current level each time, so the two paths don't
  conflict).
- The legacy `xp`/`rank`/`rank_index`/`RANKS` fields are kept as a separate cosmetic "rank" flavor layer
  on top of the same `xp` pool — do not remove them, Player Level is an additional derived view, not a
  replacement.

**Why:** `player_level` is a pure function of `xp`, so it doesn't strictly need backend persistence —
`normalizeProgression` recomputes it on load whenever missing/null. It was still added to backend
`Player`/`PlayerUpdate` models for explicitness, but the derivation-first design means missing backend
support for a new derived field is not a correctness bug, only a completeness gap.

**How to apply:** When adding a new gated feature or reward tied to progression, decide explicitly
whether it's Player-scoped (use `player.xp`/`playerLevelFromXp`) or Hero-scoped (use
`hero_progression[id]`/`addHeroXp`) — never derive one from the other.
