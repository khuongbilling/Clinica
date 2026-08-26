# Clinica — Kingdom of Healing

A mobile/web game where you play a summoned healer running a fantasy medical ward.
Battle "disease-monster" enemies with nurse/healer heroes, learn real clinical
reasoning through adaptive Clinical Cues, and grow your Sanctuary realm.

## Architecture
- **Frontend**: Expo (SDK 54) app in `frontend/`, served on web via port 5000
  (`CI=1 npx expo start --port 5000`). Expo Router file-based routing under `frontend/app/`.
- **Backend**: FastAPI in `backend/`, served on port 8000 (`uvicorn server:app`).
- **Database**: MongoDB on port 27017 (needs `MONGO_URL`; store falls back to local
  AsyncStorage when unavailable).

## Canonical product principles
- Clinica is an educational fantasy RPG that teaches biology, anatomy, physiology,
  microbiology, nursing foundations, clinical judgment, and NCLEX reasoning through
  play.
- Players collect healer heroes, rebuild a healing sanctuary, and address disease
  corruption through clue-based encounters tied to body systems.
- The learning loop connects clinical reasoning, clues, Codex knowledge, hero/team
  building, progression, and sanctuary growth.
- Onboarding, learning profiles, mentor guidance, and daily engagement support a
  welcoming path from first lesson through continued practice.

These are high-level product principles, not gameplay specifications. Current
gameplay rules, exact implementation values, progression, gating, economy,
persistence and saves, backend authority, and runtime behavior are governed by the
 active canonical modules, typed contracts, manifests, validators, and tests. The
 archived PRD at `archive/historical-product/PRD.md` is historical and
 non-authoritative and must not override those sources. The canonical gameplay
 authority freeze is `docs/canonical-gameplay-contract.md`; the canonical
 backend/API authority contract is
 `docs/canonical-backend-api-authority-contract.md`; the engine-independent
 save schema and migration ledger are
 `docs/canonical-save-schema-contract.md` and
 `docs/save-schema-migration-ledger.md`. These documents record current
 authority boundaries and migration requirements without replacing executable
 sources.

## Key locations
- Game logic/state: `frontend/src/game/`
- Loading/preloader screen: `frontend/src/components/realm/RealmLoadingScreen.tsx`
- Rotating loading art registry: `frontend/src/game/loadingArt.ts`
- Art assets: `frontend/assets/` (heroes, enemies, loading, images, realm, …)

## User preferences
- **Art style (all art content): donghua / manhwa / anime.** Use a clean, modern
  donghua / Chinese-manhua / anime illustration style (Genshin-Impact-like cel
  shading, soft clean linework, luminous colors) for ALL current and future art —
  loading screens, main/home page, banners, heroes, enemies, splash, etc. Do NOT
  use American comic-book style (heavy black ink outlines, halftone dots) or
  western cartoon look.
- **Loading art should be comedic** and rotate between several different scenes.
  Each scene can feature any one hero (or several heroes together) with any one
  enemy (or several), leaning into a light comedic gag while staying on-brand with
  the established recurring cast and cute teal disease-blob monsters.
