---
name: Ward Defense sprite choreography
description: Durable architectural rules for the sprite-driven Ward Defense board — the two-file split, per-unit attack FX, and how sprites decide which way to face.
---

# Ward Defense sprite system

**Two-file split (the load-bearing gotcha):** Ward Defense is split across a
data/game-loop file and a separate LIVE board file (WardBoardV2). The board file
is the ONLY renderer that ships; the data file's own enemy/projectile/tile render
components are dead code. Edit the board file for anything visual.
- **Why:** it is easy to "fix" rendering in the data file and see no effect.

**Path waypoints + deploy-tile fractions are duplicated in both files and MUST
stay identical**, or overlays drift off the illustrated map.

## Attack choreography (presentational only)
- The game loop records, per deployed unit, a normalized vector to its last target
  plus a cast flash when it fires. The board uses these to drive a lunge pulse and a
  per-unit aura/projectile style.
- **Never gate damage on any of this.** Damage stays in the existing projectile/hit
  pipeline; FX is cosmetic. Breaking that coupling silently changes balance.

## Facing rule (both heroes and enemies)
- All hero AND enemy PNGs are drawn facing LEFT. To face right, flip with scaleX:-1.
- Heroes face their current target (sign of the target vector's x).
- Enemies face the horizontal direction of their CURRENT path segment's movement
  vector (segment end.x − start.x), NOT a hardcoded lane index. A fixed pathIndex
  threshold gets the bottom traverse wrong.
- **Why:** enemies loop a perimeter; only a per-segment movement vector faces them
  correctly on every leg (left descent, bottom traverse, right ascent).

## Lightweight enemy behaviors
- Special spirits are driven by optional enemy-def flags read each tick: self-heal
  over time, random speed burst, and stun-on-pass (disables the nearest healer for a
  few ticks). Keep these as data flags, not per-enemy special-case branches.
