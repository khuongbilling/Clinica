---
name: Clinica material economy (Push 4)
description: Organizing principle for the material/reward catalog and guide screen added in the "Material Economy" push.
---

`frontend/src/game/materials.ts` is the single source of truth for every currency/material in the game — separate from (but cross-referencing) `frontend/src/game/economy.ts`'s core currency definitions. Each entry declares its primary source mode and what it's used for, so the Material Guide (`app/materials.tsx`) and per-mode `RewardPreview` chips both read from the same catalog instead of duplicating text.

**Why:** Player-facing screens (Shop, Realm, Ward Defense, University, Lotus Journal, Faction) all reference overlapping currencies/materials; without one catalog, descriptions drift out of sync across screens.

**How to apply:** When adding a new currency/material/reward type, add it once to `MATERIALS` in `materials.ts` (with category, source, usedFor, relatedMode), not inline in individual screens. If it needs a distinct id from a similarly-named item in another category (e.g. a "sterile kit" that exists both as a Realm building material and a Clinical Supplies consumable), disambiguate the id (e.g. `_realm` vs `_supply` suffix) rather than reusing one id across categories.

Also: new route string literals (e.g. `/materials`) fail `expo-router` typed-routes checks until the dev server restarts and regenerates `.expo/types/router.d.ts` — a workflow restart resolves it, no manual route registration needed.

Screens that gate on `if (!player) return null` (profile, codex, most tab screens) will render blank in a screenshot taken before a player/save exists — this is expected pre-existing behavior, not a regression, whenever testing a fresh app-preview session.
