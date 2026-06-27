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

## Skill logic (battle mechanics)
- A hero skill reduces Disease Corruption if and only if it has `strike: <number>` in `content.ts`.
- Clinical metadata lives in `clinical.ts` SKILL_CLINICAL — add `'Counter'` to `chainRoles` for any skill that gains a `strike` value.
- `mend` (Wound Sage) had no entry in SKILL_CLINICAL — was added during the skill fix.
