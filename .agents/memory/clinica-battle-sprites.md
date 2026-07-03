---
name: Clinica battle sprite orientation & attack FX
description: Which way battle sprites natively face, and how per-action attack visuals are wired.
---

# Battle sprite orientation

- Arena layout: heroes on the LEFT, enemies on the RIGHT; both should face toward the center (heroes face right, enemies face left).
- Source assets in `frontend/assets/heroes/battle/*.png` natively face **LEFT**. So `heroSprite` needs `transform:[{scaleX:-1}]` to face right toward enemies.
- Enemy sprites native orientation differs from heroes — do NOT assume both need the same flip. Always eyeball the PNG before adding/removing a `scaleX:-1`.

**Why:** Sprite facing is not derivable from code; it's a property of the art. This has caused rework twice (enemy flip, then hero flip). Check the actual image, not the code.

# Per-action attack FX (BattlefieldScene.tsx)

- Two independent per-`ActionType` maps already drive combat motion: `HERO_MOVE` (hero lunge/lift/scale/spin/aura) and `ENEMY_REACT` (enemy shake/flash/ring/scan).
- Illustrated attack projectiles live in `ATTACK_FX: Record<ActionType, AttackVisual>` — a themed MaterialCommunityIcons glyph launched from hero toward enemy, driven by a `proj` Animated.Value inside the existing cast `useEffect`.
- FX overlay is rendered OUTSIDE the flipped/transformed sprite container (sibling of `heroUnitInner`) so the sprite flip and cast spin don't distort the projectile. `heroSide` has `zIndex:7` (> enemySide 6) and arena overflow is visible so projectiles travel across the board.

**How to apply:** To add/adjust an attack's look, edit its entry in `ATTACK_FX` (icon/color/particles/flyX/flyY/rot/scaleTo/size/duration). Keep the three maps (`HERO_MOVE`, `ENEMY_REACT`, `ATTACK_FX`) in sync across all 8 ActionTypes.
