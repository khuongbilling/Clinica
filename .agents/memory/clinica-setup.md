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

## Ward Defense V2 board system (current state — full visual polish applied)

### Key design decisions (this session)
- `ward-defense-v2.tsx` fully rewritten: NO CSS road strips; circular stone pads 64px diameter; `DeployPad` uses `LinearGradient` circle with lotus cross engraving when empty
- `HealingZoneFrame` component draws a subtle teal border + "HEALING ZONE" label around the 2×3 grid
- `DiseasePortal` = floating badge label only — no layered circles; art shows the gate
- `VitalLantern` = badge + stability bar + glow orb — no shrine disc; art shows the lantern
- `WavePauseOverlay` removed — `ClinicalQuestionPanel` (rendered in parent) takes its place; board just dims with `#00000040` overlay
- HUD redesigned: `LinearGradient` wrapper on HUD bar, numeric AP display "3/15" (not tiny gem dots), stability bar uses `LinearGradient` fill
- `ward_board_scene.png` regenerated — detailed isometric lotus sanctuary with U-path, disease gate arch (top-left), vital lantern shrine (top-right), 6 octagonal stone platforms in center, red lanterns + lotus water pools
- `s.ward` style: added `maxWidth: "100%"` to prevent overflow on narrow mobile screens
- Dev bypass pattern: change `freshState() { return { phase: "lobby"... } }` → `return beginWave({ ... }, 0)` and add pre-deployed units as needed; revert before final commit

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
[0.33, 0.38], [0.50, 0.38], [0.67, 0.38],  // top row
[0.33, 0.58], [0.50, 0.58], [0.67, 0.58],  // bottom row
```
- Top row was moved from y=0.32 → y=0.38 to align hero sprites with the stone platform area in the art
- Hero sprites float ~110px above the platform center point (due to SPRITE_H=60, PLATFORM_D=64 offset formula)
- On mobile (450×600 board): hero top appears at ~118px from board top — keeps heroes well within map bounds

### Hero identity — Hall of Heroes as source of truth
- Ward Defense unit slots map to actual Hall of Heroes characters (sprites from `assets/heroes/battle/`):
  - `ward_scout` → **Apprentice Seer** (Mind/purple `#A78BFA`) — `battle/apprentice_seer.png`
  - `mist_caster` → **Village Caretaker** (Growth/pink `#F472B6`) — `battle/village_caretaker.png`
  - `o2_healer` → **Novice Guardian** (River/cyan `#06B6D4`) — `battle/novice_guardian.png`
- CARD_PORTRAITS and IMG_UNITS both point to `../assets/heroes/battle/*.png` (same path, must stay in sync)
- Old `sprite_ward_scout/mist_caster/o2_healer.png` in assets/images/ are superseded — do NOT revert
- **Why:** User requires sprite consistency with Hall of Heroes character identity across all minigames
- Enemy sprites still in assets/images/ (mucus_slime, hypoxia_wraith, bronchospasm_drake, breathless_wisp, wheeze_sprite)

### AP economy (current values)
- `INIT_AP = 3`, `MAX_AP = 15`, `AP_REGEN_TICKS = 20` (1 AP per 10 s — passive is secondary)
- `WAVE_PAUSE_TICKS = 40` (20 s question phase), `KILL_AP_BONUS = 2`, `PREWAVE_AP_BONUS = 8`
- **Pre-wave NCLEX question is the PRIMARY AP source** — correct answer gives +8 AP
- Wrong answer gives 0 AP bonus and shows an encouraging error feedback strip
- **Why:** Educational mechanic must gate deployment; passive AP would let players ignore questions

### Clinical question panel
- `CLINICAL_QUESTIONS[]` array of 6 NCLEX airway questions, defined at module level
- `ClinicalQuestionPanel` component shows during `gs.phase === "wave_pause"` inside `s.ward` View
- `cqAnswered` state in WardDefense tracks `{ wave, correct }` for current wave's answer
- Correct answer → +`PREWAVE_AP_BONUS` AP via answerClinQ(); wrong answer → feedback only, no AP

### VitalLantern positioning
- Must use `Math.max(4, Math.min(ah - 130, py - 10))` for top — prevents going offscreen when lantern is at top-right (py = small value)

## Care Synthesis (merge) mechanic
- `findMergePair` returns first pair with same `typeId` + same `level` (< 3); MVP max is Lv.3.
- `getScaledStats(def, level)` scales: Lv1=1×, Lv2=1.65×dmg -1 speed +0.045 range, Lv3=2.8×dmg -2 speed +0.09 range.
- `handleSynthesize` removes both units from `deployedUnits`, inserts a new one at `a.tileIndex` with `level+1` and `mergeFlash:5`.
- `DeploymentTileView` shows a golden ring border when `isMergeCandidate`, gold fill when `mergeFlash>0`, purple Lv.2/gold Lv.3 badge top-left.
- HandPanel shows a gold CARE SYNTHESIS card (FREE cost) at the front of the deploy list when `hasMerge`.
