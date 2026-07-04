---
name: Clinica Clinical Cue tiers/topics
description: How the 4-tier x 9-topic Clinical Cue overhaul was layered onto the existing cue pipeline without breaking other systems.
---

The Clinical Cue system has two orthogonal dimensions on top of the base question bank: a chapter-weighted difficulty tier (Everyday Health / Body Basics / Symptom Cue / Clinical Judgment) and a topic category (one of 9). Both are attributes on each question, not separate subsystems.

**Why:** the battle engine already had a working cue trigger/reward pipeline (cadence, universal reward, cueBonusStabilize lifecycle). Rebuilding that pipeline for the new tiers/topics would have risked breaking Care Chain grading and other systems documented in `clinica-battle-timed-mechanics.md`.

**How to apply:**
- Tier selection is chapter-weighted inside `getRandomClinicalCue`, with an optional topic hint (derived from the enemy's primary system via `SYSTEM_TO_CUE_TOPIC`) used as a soft fallback, not a hard filter — never let topic hinting starve the pool.
- Topic-based bonuses on correct answers are small and reuse existing mechanics fields (extra cueBonusStabilize, reveal, corruption/stability delta, shieldNext) — never invent a new effect type or a parallel resolution path.
- Correct-topic tracking (`cuesTopicsCorrect` in BattleState, `cue_topic_progress` in PlayerState) is additive-only bookkeeping; it must not gate or alter existing reward math beyond feeding the pre-existing `clinicalCuesCorrect * 5` XP term in progression.ts.
- Any new PlayerState field for this kind of tracking still needs the backend Player+PlayerUpdate models updated, per `clinica-hero-evolution.md`, or refresh normalization silently wipes it.
- Safety/disclaimer copy for clinical content lives in a single reusable constant, surfaced once in a persistent UI location (tutorial screen), not duplicated per-question.
