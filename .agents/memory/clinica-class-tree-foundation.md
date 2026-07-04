---
name: Clinica Class Tree foundation
description: Why the Push 6 Player Class Tree system is a separate additive module from the legacy battle-wired progression.ts, and what to check before ever merging them.
---

Clinica has two independent "player class" systems living side by side on purpose:

1. **Legacy (`progression.ts`)** — a 4-value `PlayerClass` type derived from `player.aptitude`, with `PLAYER_CLASS_ABILITIES` and `getClassBattleBonuses(aptitude, level)` wired directly into `battle.tsx` combat math. This is REAL and battle-affecting.
2. **New (`classTree.ts`)** — a 6-class (Guardian/Seer/Caretaker/Scholar/Alchemist/Medic) identity + ability-tree system, gated by Player Level and existing materials (Knowledge Points, Class Manuals, Ascension Seals). Stored on `player.class_tree_id` / `player.class_progress`. Free/safe class switching (no paid unlocks). Ability text is currently flavor/identity only — it does not feed any battle calculation.

**Why:** the spec explicitly scoped Push 6 to avoid battle regression risk. Touching `progression.ts` or `battle.tsx`'s `classBonuses` call would have coupled a brand-new, unbalanced 6-class ability set directly into combat math. Keeping the module additive let the full 15-step spec (per-class Lv1/10/20/30 cards) ship without any risk to the existing, already-tuned battle system.

**How to apply:** if a future push asks to make Class Tree abilities "actually do something in battle," that is a deliberate, separate integration task — expect to thread new modifiers into the existing `apply*` battle pipeline (see `clinica-battle-timed-mechanics.md` for that pattern), not to replace `getClassBattleBonuses`. Do not casually merge the two systems' naming (`player_class` string field from onboarding's 5-option healerStyle question is yet a THIRD, unrelated legacy field — don't conflate any of the three).
