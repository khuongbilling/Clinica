# Push 0 — Journey & Combat Freeze Snapshot

**Date:** 2026-08-08  
**Purpose:** Establish a stable rollback point before the canonical V1 expansion (new encounter types, multi-threat combat, ward events). All gameplay described here is frozen and must not be altered by canonical V1 pushes unless a confirmed bug is found.

---

## Feature flags at freeze

| Flag | Value | Guards |
|---|---|---|
| `FEATURE_FLAG_JOURNEY_FOG_MAP_V1` | `true` | Hub Chapters banner → fog-map (Push 15) |
| `JOURNEY_CANONICAL_V1` | `false` | New encounter types: wardEvent, blessing, hazard, supportNpc, protocolCard |
| `MULTI_THREAT_COMBAT_V1` | `false` | Multi-threat battle system, threat-portrait asset slots |
| `WARD_EVENTS_V1` | `false` | wardEvent EncounterType, WardEventModal, resolveWardEventVisit |

All three new flags are `false`. **Existing gameplay is unchanged.**

---

## System ownership map

### 1. Chapter run generation

| File | Owns |
|---|---|
| `frontend/src/game/journeyMap/journeyRunLifecycle.ts` | `buildInitialJourneyRun`, `generateRunData`, lifecycle state machine (`loadOrCreateJourneyRun`, `challengeChapter`) |
| `frontend/src/game/journeyMap/journeyRunRepository.ts` | Cryptographic seed generation, HTTP CRUD calls, wire serialisation, `_buildNewRun` |
| `frontend/src/game/journeyMap/topology.ts` | Hex topology BFS generator — deterministic from seed |
| `frontend/src/game/journeyMap/secureSeed.ts` | One-time cryptographic seed creation (`crypto.getRandomValues`) |

**Invariant:** a new randomised run is created only on first entry into an unstarted chapter, or after explicit Challenge Chapter confirmation. Never on refresh, navigation, battle transition, or remount.

---

### 2. Journey map rendering

| File | Owns |
|---|---|
| `frontend/src/components/journey/HexMapLayer.tsx` | Draggable flat-top axial hex grid, fog overlays, encounter icons, player token, camera pan/recenter, accessibility |
| `frontend/src/game/journeyMap/fogCalculator.ts` | Visibility calculation (hidden → frontier → revealed) |
| `frontend/src/game/journeyMap/movement.ts` | Move validation (`validateMove`), move application (`applyMoveToRun`), stamina deduction |
| `frontend/app/journey/chapter/[chapterId]/fog-map.tsx` | Screen orchestration: run loading, encounter dispatch, battle routing, modals, chapter summary card |

---

### 3. Tile encounter assignment

| File | Owns |
|---|---|
| `frontend/src/game/journeyMap/encounters.ts` | Seeded weighted assignment, per-encounter caps, area-boss placement, chest tier assignment |
| `frontend/src/game/journeyMap/config.ts` | All balance numbers in basis points: encounter rates, chest quality rates, tile counts, caps |
| `frontend/src/game/journeyMap/prng.ts` | Mulberry32 PRNG + FNV-1a seed hashing — **no `Math.random()` in any persisted generation** |

**Invariant:** all tile assignment is deterministic from `run.seed`. Namespaced streams prevent cross-system interference.

---

### 4. Stamina

| File | Owns |
|---|---|
| `frontend/src/game/stamina.ts` | `MOVE_STAMINA_COST`, `ENCOUNTER_COST`, lazy timestamp regen, `spendStamina`, `useLiveStamina` hook |
| `frontend/src/game/progression.ts` | Level-based stamina cap |
| `frontend/src/game/journeyMap/movement.ts` | Stamina validation inside `validateMove` |
| `backend/server.py` | `stamina` + `stamina_updated_at` fields on player document |

---

### 5. Battles

| File | Owns |
|---|---|
| `frontend/src/game/battle.ts` | Battle state machine, turn loop, skill/item/card dispatch, AP, wave logic, victory/defeat |
| `frontend/src/components/BattlefieldScene.tsx` | Battle screen UI |
| `frontend/src/game/battleXp.ts` | Battle XP calculation |
| `frontend/src/game/skillCalc.ts` | Centralized `calcStrikeEffect`, `calcStabilizeEffect`, `calcShieldEffect` with modifier bag |
| `frontend/app/battle.tsx` | Route entry, param threading, journey return params |
| `frontend/app/result.tsx` | Result screen, journey return routing via `dynRoute.chapterFogMap` |

---

### 6. Corruption

| File | Owns |
|---|---|
| `frontend/src/game/battle.ts` | Corruption state, per-action corruption effects, chapter forgiveness override, defeat condition |
| `frontend/src/game/skillCalc.ts` | `getCorruptionOutcome(status)` — bypasses chapter forgiveness |
| `frontend/src/game/clinical.ts` | Clinical action definitions that feed into corruption resolution |

---

### 7. Stability

| File | Owns |
|---|---|
| `frontend/src/game/battle.ts` | Stability state, damage/restore, loss conditions, AP depletion |
| `frontend/src/game/skillCalc.ts` | `calcStabilizeEffect`, `getStabilityGainModifier`, `stabilityResistance` dampening |
| `frontend/src/game/equipment.ts` | Equipment modifiers to stability (display-only at freeze; not combat-wired) |

---

### 8. Speed

No distinct Speed system exists at this snapshot. Turn/AP pacing is handled entirely by `battle.ts`. This section is reserved for the multi-threat combat push.

---

### 9. Area Bosses

| File | Owns |
|---|---|
| `frontend/src/game/journeyMap/encounters.ts` | `areaBoss` tile assignment, hard cap (`AREA_BOSS_MAX_COUNT = 3`) |
| `frontend/src/game/journeyMap/encounterResolution.ts` | `getAreaBossEnemyId` (deterministic per chapter), `resolveAreaBossWin` (awards one key fragment, sets `areaBossKeyClaimed`) |
| `frontend/src/game/journeyMap/types.ts` | `areaBossKeyClaimed`, `areaBossKeysCollected`, `areaBossCount` fields |

---

### 10. Chapter Boss gate

| File | Owns |
|---|---|
| `frontend/src/game/journeyMap/encounterResolution.ts` | `getChapterBossEnemyId`, `resolveChapterBossWin` (sets `status: 'cleared'`) |
| `frontend/src/game/journeyMap/validate.ts` | `validateMove` gate unlock condition (all area-boss keys collected) |
| `frontend/src/game/journeyMap/types.ts` | `gateAnchorTileId`, `areaBossKeysCollected`, `chapterBossDefeated`, `status` |
| `frontend/src/game/journeyMap/journeyRunRepository.ts` | `markRunCleared` HTTP call |
| `backend/server.py` | `mark_run_cleared` endpoint, `journey_runs` MongoDB collection |

---

### 11. Rewards

| File | Owns |
|---|---|
| `frontend/src/game/journeyMap/encounterResolution.ts` | `TREASURE_REWARDS` table (XP/crowns/shards per chest tier), `resolveTreasureClaim` claim guard |
| `frontend/src/game/journeyRewards.ts` | Chapter/node first-clear XP, replay XP, coins, shards |
| `frontend/src/game/battleXp.ts` | Battle XP formula |
| `frontend/app/journey/chapter/[chapterId]/fog-map.tsx` | `applyRewards` calls for treasure, chapter completion XP bonus |

---

### 12. Persistence

| File | Owns |
|---|---|
| `frontend/src/game/journeyMap/journeyRunRepository.ts` | `IJourneyRunRepository` interface + HTTP implementation; wire serialisation between `JourneyRun` ↔ backend JSON |
| `backend/server.py` (lines 483–611) | `journey_runs` MongoDB collection; endpoints: `GET /players/{id}/journey-runs/active`, `GET /players/{id}/journey-runs/latest`, `POST /players/{id}/journey-runs`, `PUT /players/{id}/journey-runs/{runId}`, `PATCH /players/{id}/journey-runs/{runId}/cleared`; startup unique index |
| `frontend/src/game/journeyMap/types.ts` | `JourneyRun`, `JourneyTile`, `JourneyRunStatus` — canonical TypeScript types |

---

## Rollback procedure

### Roll back a canonical V1 feature

1. Set the relevant flag to `false` in `frontend/src/game/featureFlags.ts`.
2. Redeploy. No data migration required — run seeds and tile assignments already in MongoDB are seeded and safe; unrecognised encounter types fall through to the `none` resolver.

### Roll back the fog-map entirely (to pre-Push 15 visual maps)

1. Set `FEATURE_FLAG_JOURNEY_FOG_MAP_V1 = false`.
2. Redeploy. Existing `journey_runs` records are preserved; they are simply not navigated to.
3. See `docs/rollback-journey-fog-map.md` for the full checklist.

---

## What must never change without a confirmed bug

- The `loadOrCreateJourneyRun` never-reroll guarantee.
- The Mulberry32 + FNV-1a seeding pipeline (`prng.ts`, `secureSeed.ts`).
- The `TOTAL_BP = 10 000` basis-point contract in `config.ts`.
- The `areaBossKeyClaimed` one-key-per-boss guard in `resolveAreaBossWin`.
- The `status: 'cleared'` gate on `challengeChapter`.
- The `battleResultApplied` ref guard in `fog-map.tsx` (prevents double-resolution).
