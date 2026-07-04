---
name: Equipment & Clinical Supplies foundation
description: How hero equipment and clinical supplies were added as a foundation-only system (data + display, no combat wiring)
---

Hero equipment (5 slots: Focus Tool, Ward Garment, Charm/Talisman, Medical Kit, Relic) and the
Clinical Supplies material category were added as a **catalog + UI foundation**, not a live system:

- Equipment lives in its own file (`src/game/equipment.ts`), separate from `materials.ts`, following
  the same DATA + DOCUMENTATION convention (`status: "active"|"future"`, no combat math wired in).
  All sample equipment items are `status: "future"` — descriptive stats only (e.g. "+8% Reveal
  duration"), never consumed by battle calculations.
- Equipment is keyed by a broader `EquipmentRoleFamily` (seer/o2healer/mistcaster/caretaker/
  herbalchemist/guardian) that maps onto the existing `HeroRole` enum, since the spec's class-fantasy
  names don't 1:1 match the code's role names.
- No new `PlayerState` field was introduced for equipment — it's a static catalog surfaced in the
  hero detail Equipment tab and the Material Guide's Equipment category, not player-owned inventory.
  If a future push adds player-owned/equipped items, that PlayerState field must be added to both
  backend `Player` and `PlayerUpdate` models or it gets wiped on refresh normalize (see hero-evolution memory).

**Why:** the project brief explicitly required "foundation not full systems" — no crafting timers,
no gacha, no paid best-in-slot gear — so the safest structural choice was to keep equipment entirely
descriptive/catalog-based until a dedicated push wires it into player state and combat.

**How to apply:** when extending equipment into a real system (equipping, crafting, upgrading),
change `status` values to `"active"` deliberately per item, add the player-owned equipment slice to
PlayerState (+ backend models), and only then wire stats into battle math — don't retrofit combat
effects onto the existing descriptive fields without an explicit balance pass.
