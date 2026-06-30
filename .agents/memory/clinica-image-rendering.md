---
name: Clinica image rendering
description: Image component rules for Expo web, and the full image-first architecture for the Ward Defense board.
---

# Scene background image rendering on Expo 54 web

## Rule
Use `expo-image`'s `Image` (with `contentFit="cover"`) for ALL illustrated scene backgrounds in this project, NOT React Native's `Image` component.

**Why:** RN Image fails silently (renders transparent/black) inside a `flex: 1, overflow: hidden` View on Expo web — the ward battle arena is exactly this.

## ExpoImage background — the ONLY working approach (ward-defense-v2.tsx)
The `BoardScene` component must use **explicit pixel dimensions** + **`cachePolicy="none"`** + a **`key` prop** that changes when dimensions change. All other approaches go black on repeated Metro restarts:

```tsx
function BoardScene({ aw, ah }: { aw: number; ah: number }) {
  const w     = aw > 10 ? aw : 360;
  const h     = ah > 10 ? ah : 540;
  const scale = Math.max(w / IMG_AR_W, h / IMG_AR_H);  // cover mode
  const iw    = IMG_AR_W * scale;
  const ih    = IMG_AR_H * scale;
  return (
    <ExpoImage
      key={`board-${Math.round(iw)}-${Math.round(ih)}`}
      source={IMG_BOARD}
      style={{ position: "absolute", left: (w-iw)/2, top: (h-ih)/2, width: iw, height: ih }}
      contentFit="fill"
      cachePolicy="none"
    />
  );
}
// In WardBoardV2:  <BoardScene aw={aw > 10 ? aw : 360} ah={ah > 10 ? ah : 540} />
```

**Why key+cachePolicy are both required:** Metro's asset module becomes stale on incremental rebuilds. `cachePolicy="none"` forces a fresh fetch; the `key` forces React to unmount+remount ExpoImage when board dims update after `onLayout` fires.

**What does NOT work (all go black after the first Metro restart):**
- `StyleSheet.absoluteFillObject` — silent fail
- `width: "100%", height: "100%"` — % height fails when containing block height is flex-determined
- `contentFit="cover"` without explicit pixel dims — same issue
- RN built-in `Image` — fails silently on RN-web in nested flex containers

## Overlay coordinate math must use cover mode to match
`getImgBounds(aw, ah)` uses `Math.max` (cover) — same formula as BoardScene — so `imgPx(fx, fy, bounds)` overlay positions align with the visible image crop.

## Cache recovery when image goes black despite the fix
```bash
rm -rf frontend/.expo frontend/node_modules/.cache/metro /tmp/metro-* /tmp/haste-*
```
Then restart the workflow. Metro rebuilds the full bundle from scratch.

---

# Ward Defense — Image-First Rendering Architecture (ward-defense-v2.tsx)

## Core principle
The Ward Defense board MUST use PNG image assets for the background scene, unit sprites, and enemy sprites. CSS View rectangles cannot produce illustrated or game-quality visuals regardless of complexity.

**Why:** The rendering primitive (`View + StyleSheet`) is a `<div>`. It can only produce rectangles. No texture, no painted strokes, no organic curves, no lighting. Only `<Image>` or HTML Canvas can break this ceiling.

**How to apply:** Any future visual change to the board must use `<Image source={require(...)} />` for the scene layer, sprites, and enemy art. CSS Views are only for interactive overlays (health bars, HUD badges, pressable touch zones, projectile orbs).

## Current asset files
- `frontend/assets/images/ward_board_scene.png` — 1.9 MB lotus healing sanctuary board (896×1280, 7:10 portrait; coded as IMG_AR_W=3,IMG_AR_H=4 for close-enough aspect ratio)
- `frontend/assets/heroes/battle/apprentice_seer.png` — ward_scout unit sprite
- `frontend/assets/heroes/battle/village_caretaker.png` — mist_caster unit sprite
- `frontend/assets/heroes/battle/novice_guardian.png` — o2_healer unit sprite
- Enemy sprites in `frontend/assets/images/`: mucus_slime, hypoxia_wraith, bronchospasm_drake, breathless_wisp, wheeze_sprite

## Board component structure (ward-defense-v2.tsx)
- `BoardScene({ aw, ah })`: full-board ExpoImage of `ward_board_scene.png`
- `DiseasePortal`: CSS badge label positioned via `imgPx` at PATH_WPS[0]
- `VitalLantern`: CSS badge + stability bar positioned via `imgPx` at PATH_WPS[3]
- `DeployPad`: transparent `Pressable` at each DEPLOY_TILES coordinate; renders hero sprite when occupied; tiny dot when empty+selectable
- `EnemyOnPath`: hero sprite at interpolated pathIndex+pathProgress position; includes HP bar
- `ProjectileDot`: small CSS glowing orb

## Enemy positioning (critical — do not regress)
Enemy positions come from `pathIndex + pathProgress`, NOT from `enemy.x / enemy.y`. Function `getEnemyFrac()` interpolates between PATH_WPS entries.

## Hot-reload testing caveat
State initializer `freshState()` does NOT re-run on hot reload. To test initial state, restart the workflow. To temporarily see the board, set `phase: "playing"` in freshState via beginWave — revert before commit.

## Asset generation prompts (image style)
Proven prompt elements for this project's art style:
- "chibi anime donghua-style character, full body, clean background"
- "Buddhist lotus healing sanctum, top-down isometric game board, fantasy anime painterly style"
- negativePrompt: "text, Chinese characters, Japanese characters, photorealistic, blurry"
- Use `removeBackground: true` for all sprite assets
