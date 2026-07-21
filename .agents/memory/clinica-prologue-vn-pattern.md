---
name: Prologue VN cutscene pattern
description: How FormerSelfIntroScene, FormerSelfVictoryCutscene, and WarningDialogueScene are structured; which art files are canonical for each character.
---

# Prologue VN Cutscene Pattern

## Rule
All prologue VN cutscenes (FormerSelfIntroScene, FormerSelfVictoryCutscene, WarningDialogueScene) use the same layout:
- Full background fills screen (Ken Burns slow pan)
- Current speaker's half-body art on the RIGHT side above the dialogue bar
- Bottom bar: `[64px portrait circle] | Speaker Name | typewriter dialogue text`
- Tap: skip typewriter → tap again → next beat
- Last beat uses `autoEnd: true` → auto-advances after 1–1.5 s

## Canonical character art files (prologue cutscenes)
| Character | Asset |
|-----------|-------|
| Master Bai | `master_bai_nobg.png` |
| Florence Nightingale | `nightingale_legend_vn.png` (fantasy healer; **not** the 1900s nurse `nightingale_vn.png`) |
| Alexander Fleming | `fleming_legend_vn.png` (legendary alchemist-scholar; **not** `fleming_vn.png` or `fleming_portrait.png`) |
| The Prodigy / Former Self | `the_prodigy_vn.png` |
| Background | `ward_corridor_battle.png` |

## Why
The original `nightingale_vn.png` and `fleming_portrait.png` looked like historical figures, not fantasy legends.
The `*_legend_vn.png` variants are donghua/anime cel-shaded full-body art with transparent backgrounds, matching the game's established art style.

## How to apply
When adding a new prologue cutscene beat or character, always pull from the canonical table above.
If you generate new art for a character, save with the `_legend_vn` suffix and update this table.
Never reference `florence_nightingale.png` (heroes folder), `fleming_portrait.png`, or `former_self_portrait.png` in new VN scenes.

## Battle tutorial (PrologueBattleTutorial) is different
The battle tutorial is NOT a VN scene — it uses compact entry cards with no large portrait or circle avatar.
Entry cards have: speaker name + role text + italic dialogue + "SEE SKILL →" button. No absolute-positioned portrait.
The Corrupted Water Spectre (`corrupted_water_spectre.png`) shows as a mini enemy indicator in the top bar.
