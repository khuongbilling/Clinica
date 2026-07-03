---
name: Clinica hero evolution / star system
description: How duplicate→copy evolution works and the persistence rule that keeps it from being wiped
---

# Hero evolution (star) system

Per-player progression lives in `PlayerState.hero_progression: Record<heroId,{star,copies}>`, every owned hero starts at ★1. Duplicate summons grant +1 copy (fuel) + small shard bonus instead of a flat refund. Evolve cost = 2^(star-1) copies, capped at MAX_STAR=6. Stars scale skill numeric effects (stabilize/strike/shield) by +12%/star via `applyStarToHero` at battle team-build time; `reveal` (a clue COUNT) is never scaled. Class(role)×star table unlocks bonus skills at ★3/★5. Star-skill ids are namespaced `${hero.id}_${key}` and are intentionally absent from SKILL_CLINICAL — `evaluateClinicalAppropriateness(undefined)` returns appropriate/1.0, so they resolve safely.

## CRITICAL persistence rule
Any new PlayerState field that syncs to backend MUST be added to BOTH `Player` and `PlayerUpdate` Pydantic models in `backend/server.py`, or FastAPI silently drops it (Pydantic ignores unknown fields).

**Why:** `store.tsx` `refresh()` loads the remote player and runs `normalizeProgression(remote)`, which backfills any missing hero to `{star:1,copies:0}`. If the field isn't in the backend model, the remote roundtrip strips it and the next refresh WIPES all evolution progress. This bit us when hero_progression was added frontend-only.

**How to apply:** Whenever you add a field to `PlayerState` (types.ts) that flows through `updateState`/`api.updatePlayer`, mirror it in server.py `Player` (with default) + `PlayerUpdate` (Optional). `normalizeProgression` also clamps star to [1,MAX_STAR] and copies>=0 to survive malformed remote/local data.
