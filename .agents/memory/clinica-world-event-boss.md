---
name: Clinica World Event boss (gated playable boss)
description: Decisions/gotchas for adding a world-event boss that is playable but gated
---

# World Event boss (Verdantha) — durable decisions

**A world-event boss must live in the main `ENEMIES` array, not a companion pool.**
`BOSS_VERDANTHA`, the `/battle` enemy lookup, and the `/result` drop logic all
resolve the boss by id from `ENEMIES` (`ENEMIES.find(...)`). Putting it in
`AFFLICTION_ENEMIES` (or any other sub-array) makes the `find` return undefined,
which crashes the boss screen and makes `/battle` silently fall back to a default
enemy. **Why:** there are several parallel enemy arrays in content.ts; only the
main one is wired into the encounter/result pipeline.

**Keep it out of every difficulty-based pool.** Tag it `worldBoss: true` and
`teaches: []`; any code iterating `ENEMIES` by difficulty (e.g. the Ward Shift
case builder) must exclude `worldBoss`, or a high-difficulty boss leaks into
random encounters and the codex.

**Gate design:** a hard `*_UNLOCKED` boolean placeholder + a `?bossId` param on
the boss screen lets the boss render a "Coming Soon" locked card (no enter
button) while unreachable. Result loot keys on `enemy.worldBoss`, so the drop is
wired ahead of the gate and activates automatically once unlocked — no reachable
unbalanced fight ships in the meantime.

**Open gotcha:** battle reward *tiers* may still be keyed on a single hardcoded
boss id rather than `enemy.worldBoss`, so a newly-unlocked world boss can grant a
non-boss reward tier until that lookup is generalized.
