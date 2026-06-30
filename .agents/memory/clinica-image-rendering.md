---
name: Clinica image rendering
description: Image component rules for Expo web, and the full image-first architecture for the Ward Defense board.
---

# Scene background image rendering on Expo 54 web

## Rule
Use `expo-image`'s `Image` (with `contentFit="cover"`) for ALL illustrated scene backgrounds in this project, NOT React Native's `Image` component.

**Why:** RN Image fails silently (renders transparent/black) inside a `flex: 1, overflow: hidden` View on Expo web — the ward battle arena is exactly this. The lobby (SafeAreaView direct child) happened to work with RN Image, but the battle arena (nested flex child) did not. expo-image works reliably in both contexts.

**Exception:** The ward-defense-v2.tsx board currently uses RN Image — if it starts showing black boards on some devices, switch to ExpoImage with contentFit.

## How to apply (expo-image)
- Import with alias to avoid name clash: `import { Image as ExpoImage } from "expo-image";`
- Use `contentFit="cover"` instead of `resizeMode="cover"`
- `style={StyleSheet.absoluteFillObject}` works correctly with ExpoImage on web

---

# Ward Defense — Image-First Rendering Architecture (ward-defense-v2.tsx)

## Core principle
The Ward Defense board MUST use PNG image assets for the background scene, unit sprites, and enemy sprites. CSS View rectangles cannot produce illustrated or game-quality visuals regardless of complexity — every "restyle" pass produces the same flat sticker look.

**Why:** The rendering primitive (`View + StyleSheet`) is a `<div>`. It can only produce rectangles and rounded rectangles. No texture, no painted strokes, no organic curves, no lighting. Prompts asking for "illustrated" or "donghua" quality on this primitive produce polished CSS UI, not game art. Only `<Image>` or HTML Canvas can break this ceiling.

**How to apply:** Any future visual change to the board must use `<Image source={require(...)} />` for the scene layer, sprites, and enemy art. CSS Views are only for interactive overlays (health bars, HUD badges, pressable touch zones, projectile orbs).

## Current asset files (frontend/assets/images/)
- `ward_board_scene.png` — 1.9 MB illustrated lotus healing sanctum board background (4:3)
- `sprite_ward_scout.png` — Ward Scout chibi sprite, transparent background
- `sprite_mist_caster.png` — Mist Caster chibi sprite, transparent background
- `sprite_o2_healer.png` — O2 Healer chibi sprite, transparent background
- `enemy_breathless_wisp.png` — Breathless Wisp enemy sprite, transparent background
- `enemy_wheeze_sprite.png` — Wheeze Sprite enemy sprite, transparent background
- `enemy_mucus_slime.png` — Mucus Slime enemy sprite, transparent background
- `enemy_hypoxia_wraith.png` — Hypoxia Wraith enemy sprite, transparent background
- `enemy_bronchospasm_drake.png` — Bronchospasm Drake boss sprite, transparent background

## Board component structure (ward-defense-v2.tsx)
- `BoardScene`: full-board `<Image>` of `ward_board_scene.png` + subtle direction arrow overlays
- `DiseasePortal`: CSS overlay positioned at PATH_WPS[0] (top-right)
- `VitalLantern`: CSS overlay positioned at PATH_WPS[last] (bottom-left), shows stability bar
- `DeployPad`: transparent `Pressable` at each DEPLOY_TILES coordinate; renders `<Image>` unit sprite when occupied
- `EnemyOnPath`: `<Image>` sprite at interpolated pathIndex+pathProgress position; includes HP bar and cue badge
- `ProjectileDot`: small CSS glowing orb (fast-moving, image not needed)

## Enemy positioning (critical — do not regress)
Enemy positions come from `pathIndex + pathProgress`, NOT from `enemy.x / enemy.y` (which don't exist on `ActiveEnemy`). Function `getEnemyFrac()` interpolates between PATH_WPS entries. This was the root cause of invisible enemies in all prior board versions.

## Hot-reload testing caveat
State initializer `freshState()` does NOT re-run on hot reload. To test initial state, restart the workflow. To temporarily see the board, set `phase: "playing"` in freshState — revert before commit.

## Asset generation prompts (image style)
Proven prompt elements for this project's art style:
- "chibi anime donghua-style character, full body, clean background"
- "Buddhist lotus healing sanctum, top-down isometric game board, fantasy anime painterly style"
- negativePrompt: "text, Chinese characters, Japanese characters, photorealistic, blurry"
- Use `removeBackground: true` for all sprite assets
