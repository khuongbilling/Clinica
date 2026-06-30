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

## Ward Defense sprite system
- All sprites are pure React Native View-based (no image assets for characters).
- Chibi proportions: head ~45% of total height, large oval eyes with catchlight dots, blush circles, expressive mouth.
- Each unit sprite has arm stubs via `position:absolute` Views offset left/right from the body.
- Enemy sprites: each has a distinctive silhouette + outlined eyes (ring border = hollow look for wisp/wraith).
- BronchospasmDrake has `position:absolute` wing stubs that overflow the Animated.View — wrap the sprite in `<View style={{overflow:"visible"}}>` if clipping is ever needed.
- `UnitSprite` accepts optional `level` prop (default 1); shows a 3-prong gold crown at Lv.3.

## Care Synthesis (merge) mechanic
- `findMergePair` returns first pair with same `typeId` + same `level` (< 3); MVP max is Lv.3.
- `getScaledStats(def, level)` scales: Lv1=1×, Lv2=1.65×dmg -1 speed +0.045 range, Lv3=2.8×dmg -2 speed +0.09 range.
- `handleSynthesize` removes both units from `deployedUnits`, inserts a new one at `a.tileIndex` with `level+1` and `mergeFlash:5`.
- `DeploymentTileView` shows a golden ring border when `isMergeCandidate`, gold fill when `mergeFlash>0`, purple Lv.2/gold Lv.3 badge top-left.
- HandPanel shows a gold CARE SYNTHESIS card (FREE cost) at the front of the deploy list when `hasMerge`.

## Skill logic (battle mechanics)
- A hero skill reduces Disease Corruption if and only if it has `strike: <number>` in `content.ts`.
- Clinical metadata lives in `clinical.ts` SKILL_CLINICAL — add `'Counter'` to `chainRoles` for any skill that gains a `strike` value.
- `mend` (Wound Sage) had no entry in SKILL_CLINICAL — was added during the skill fix.
