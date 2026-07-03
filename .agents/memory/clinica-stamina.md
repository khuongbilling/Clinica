---
name: Clinica shift stamina
description: How the shift-energy (stamina) limiter works and the atomicity constraint on spending it
---

# Shift Stamina

Limits how many ward encounters a player can run; recovers over real time.

- Constants live in `frontend/src/game/stamina.ts` (MAX_STAMINA, ENCOUNTER_COST, REGEN_MINUTES). Tune there.
- **Lazy regen, no background writes**: player stores `stamina` + `stamina_updated_at` (ISO). Current value is computed on the fly from stored value + elapsed time (`regen()`), only persisted when spent. UI ticks via `useLiveStamina` (1s interval while not full).
- Spend point is **on encounter entry** in `shift.tsx` (`spendStamina()` → block + banner if insufficient), not on battle completion. No refund on loss/quit.

**Why the ref-based critical section in `store.tsx spendStamina`:** all store actions use the captured `player` state + async persistence, so two rapid taps could both read the same pre-spend value and overspend. Fix: read+decrement synchronously against `playerRef.current` BEFORE any `await`, and mirror `playerRef` in `updateState` + a `useEffect`. Also a `launchingRef` in-flight guard in shift.tsx.
**How to apply:** any future resource that must not be double-spent under rapid taps needs the same synchronous-ref pattern, not the plain captured-state pattern.

**Backend round-trip:** `backend/server.py` Player + PlayerUpdate must carry these fields, else `get_player` (response_model=Player) strips them and refresh overwrites local. Any new persisted player field needs adding to BOTH models.
