---
name: Clinica battle scene FX & backgrounds
description: Gotchas for BattlefieldScene animated overlays and per-enemy-type backgrounds
---

# Animated overlay rest-state gotcha
Animated ring/aura overlays in `BattlefieldScene.tsx` (enemyBurst, auras) MUST be
invisible at their Animated.Value REST value (0), not just at the animation END.

**Why:** An `interpolate` whose outputRange maps the rest input (0) to a visible
opacity creates a *persistent* artifact — the "translucent circle around the enemy"
bug came from `burst=0 → opacity 0.75`. Hit animations run `burst` 0→1→0, so rest = 0.

**How to apply:** Add a rest sentinel: inputRange `[0, 0.001, 1]`, opacity
`[0, 0.85, 0]`, scale `[0.6, 0.6, 1.6]`. Rest (0) = invisible; pulse still fires.

# Per-enemy-type backgrounds
Battle stage bg is chosen by `enemy.primarySystem` via `SYSTEM_BG` (a static
`require()` map keyed by ElementSystem) with `?? BATTLE_BG` fallback, plus an accent
LinearGradient tint + groundLine color from `ELEMENT_COLORS[primarySystem]`.
Assets live in `frontend/assets/images/battle_bg/{system}.png` (lowercase system).
AI-generated backgrounds occasionally bake in stock-watermark text — inspect and
regenerate with an explicit "no text/watermark/chinese characters" negative prompt.

# Stability balance
Stabilize gains pass through `getStabilityGainModifier(stability)` in clinical.ts
(diminishing returns: <50 full, 50-69 0.7, 70-84 0.45, >=85 0.25), applied in
battle.ts to skill/item/temp/card/full-chain stabilize before clamp.
**Why:** stability used to pin at 100 trivially. Any new stabilize source should
route through this modifier for consistency; it's diminishing-returns only (no drain).
