---
name: Prologue VN dialogue layout
description: Right-side character portrait pattern for prologue VN dialogue scenes and how speaker configs are structured
---

## The pattern

All prologue VN dialogue scenes use a **right-aligned large portrait** above the dialogue bar:

- `charWrap`: `position:absolute, top:0, left:0, right:0, bottom: barTotal (inline), alignItems:"flex-end", justifyContent:"flex-end", overflow:"hidden"`
- `charArt`: `width: W*0.74, height:"100%"` (fills the wrapper height, right-anchored)
- Left-edge `LinearGradient` overlay inside charWrap for background blend
- Avatar ring in the bar: **92px** (was 80px)

## Speaker config

Each scene's `SPEAKERS` lookup includes `artFit` and `artPos` per character:
```typescript
artFit: "contain" | "cover"; artPos: "bottom" | "top"
```
- Portrait images (Prodigy 896×1280, Fleming 896×1280, Master Bai 896×1040): `artFit:"contain", artPos:"bottom"`
- Square images (Nightingale 2048×2048): `artFit:"cover", artPos:"bottom"` ← workaround for square aspect ratio

## Files following this pattern
- `FormerSelfIntroScene.tsx` ✓
- `WarningDialogueScene.tsx` ✓
- `FormerSelfVictoryCutscene.tsx` ✓
- `TacticalWarningScene.tsx` ✓ (portrait fills upper 56%; dialogue panel below)

## NOT yet converted
- `LotusRecallCinematic.tsx` — covered by existing task "Bring TacticalWarningScene and LotusRecallCinematic..."

## Image assets
- `the_prodigy_portrait.png` (896×1280) — largePortrait for Prodigy
- `the_prodigy_vn_bust.png` — avatar48 for Prodigy (generated Jul 31 2026)
- `master_bai_vn.png` (896×1040) — largePortrait for Master Bai
- `master_bai_vn_bust.png` — avatar48 for Master Bai (updated Jul 31 2026)
- Nightingale large is 2048×2048 square → needs portrait-format art for clean contain display

**Why:** The barTotal-as-bottom pattern is essential — the portrait container must stop at the bar top or the character will bleed through and waste render under the dialog.
