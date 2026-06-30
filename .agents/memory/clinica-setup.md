---
name: Clinica project setup
description: Key environment and startup quirks for the Clinica: Kingdom of Healing project
---

**Why:** These were non-obvious failures during initial import that took multiple attempts to resolve.

## Startup command
- Frontend workflow command: `cd frontend && CI=1 npx expo start --web --port 5000`
- `CI=1` is required — without it, Expo tries `xdg-open` to launch a browser, which crashes in the Replit sandbox.
- `--no-open` flag does NOT exist in Expo 54; use `CI=1` instead.

## Package installation
- `yarn install` silently exits with code -1 in this environment (no output, no error).
- Use `npm install --legacy-peer-deps` or the `installLanguagePackages` code_execution tool instead.
- Packages end up installed correctly despite the peer conflict warning.

## Backend
- `emergentintegrations==0.2.0` is in the original `requirements.txt` but is an Emergent-platform-only package — blocked by Replit's package firewall. Remove it before running `pip install`.
- Backend requires two env vars: `MONGO_URL` (secret) and `DB_NAME` (set to "clinica").
- The entire battle system is frontend-only — MongoDB is only needed for player profile persistence.

## Ward Defense V2 board system (current state after full visual replacement)

### Map composition
- `ward_board_scene.png` — 3:4 portrait lotus healing ward isometric art
  - Disease Gate visible top-LEFT in the art
  - Vital Lantern shrine visible top-RIGHT in the art
  - Stone courtyard/platform in center for deploy grid
  - U-shaped path visible around center in art
- `s.ward` style: `aspectRatio: 3/4, alignSelf: "center"` — constrains board to portrait; image fills edge-to-edge with no black margins
- `IMG_AR_W = 3, IMG_AR_H = 4` in ward-defense-v2.tsx — matches image AR for perfect contain alignment

### PATH_WPS (both ward-defense.tsx AND ward-defense-v2.tsx must match)
```
[0.14, 0.10],  // Disease Gate (top-left)
[0.14, 0.82],  // bottom-left
[0.86, 0.82],  // bottom-right
[0.86, 0.10],  // Vital Lantern (top-right)
```
N_SEGS = 3 (4 waypoints - 1)

### DEPLOY_TILES (both files must match)
```
[0.33, 0.32], [0.50, 0.32], [0.67, 0.32],  // top row
[0.33, 0.58], [0.50, 0.58], [0.67, 0.58],  // bottom row
```

### Sprite assets (all in assets/images/)
- `sprite_ward_scout.png`, `sprite_mist_caster.png`, `sprite_o2_healer.png` — chibi 2.5D unit sprites
  - Used for BOTH CARD_PORTRAITS (bottom dock) AND IMG_UNITS (deployed on board) — must stay in sync
- `enemy_mucus_slime.png`, `enemy_hypoxia_wraith.png`, `enemy_bronchospasm_drake.png`, `enemy_breathless_wisp.png` — disease-spirit enemies
- `enemy_wheeze_sprite.png` — still used, references old asset/images path

### Clinical question panel
- `CLINICAL_QUESTIONS[]` array of 6 NCLEX airway questions, defined at module level
- `ClinicalQuestionPanel` component shows during `gs.phase === "wave_pause"` inside `s.ward` View
- `cqAnswered` state in WardDefense tracks `{ wave, correct }` for current wave's answer
- Correct answer → +2 AP via `set({ ...s, ap: min(ap+2, MAX_AP), feedbacks: [...] })`

### VitalLantern positioning
- Must use `Math.max(4, Math.min(ah - 130, py - 10))` for top — prevents going offscreen when lantern is at top-right (py = small value)

## Care Synthesis (merge) mechanic
- `findMergePair` returns first pair with same `typeId` + same `level` (< 3); MVP max is Lv.3.
- `getScaledStats(def, level)` scales: Lv1=1×, Lv2=1.65×dmg -1 speed +0.045 range, Lv3=2.8×dmg -2 speed +0.09 range.
- `handleSynthesize` removes both units from `deployedUnits`, inserts a new one at `a.tileIndex` with `level+1` and `mergeFlash:5`.
- `DeploymentTileView` shows a golden ring border when `isMergeCandidate`, gold fill when `mergeFlash>0`, purple Lv.2/gold Lv.3 badge top-left.
- HandPanel shows a gold CARE SYNTHESIS card (FREE cost) at the front of the deploy list when `hasMerge`.
