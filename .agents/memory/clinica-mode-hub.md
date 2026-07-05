---
name: Clinica Ward Operations mode hub
description: Shared data-driven pattern for organizing Shift/University/Faction future-mode placeholders
---

The Shift tab was reorganized into a "Ward Operations" hub built from a single shared
data layer (`frontend/src/game/modeHub.ts`) and a reusable `ModeCard` component
(`frontend/src/components/ModeCard.tsx`, 3 size variants: large/medium/small).
University's "Future Learning" section and Faction's preview list both should pull from
(or mirror the style of) this same data/component pair rather than inventing new card UI.

**Why:** future coming-soon modes (Grand Rounds, Code Blue, Scholar's Arena, Knowledge
Bowl, Expedition, Epidemic Response, University future-learning cards) needed one
consistent, low-risk way to exist in the UI without wiring real gameplay, stamina spend,
or rewards — so tapping any `coming_soon`/`locked` mode always resolves to an `Alert`,
never a route, never a stamina/reward side effect.

**How to apply:** every `ModeCardDef` carries an `artBrief` string documenting the future
illustrated-banner commission (anime/donghua style, matches hero portrait art direction) —
banners today are just an accent-tinted gradient + centered icon placeholder, swappable
later without touching card logic. Boss Ward's unlock gate is intentionally NOT baked into
the static data (it depends on live player state — `bosses_defeated`/`runs_completed`), so
shift.tsx computes it dynamically and overrides `unlockRequirement` at render time instead.

Decision: Shop's own "Recruit" tab (`WARD_UNIT_IDS`/`GACHA_COST` gacha) is a distinct,
pre-existing system for Ward Defense combat units — not the same as University's healer
Recruitment. It was intentionally left untouched during the mode-hub reorg (preserving
existing systems outweighed reshuffling Shop's tab list for an organization-only push).

## Mode → Intro → Gameplay pattern (REQUIRED for all game modes)
Every active mode follows a 3-step flow. Use it for any future mode:
1. **Hub** (`app/shift.tsx`): the hero page (`app/(tabs)/index.tsx`) must NOT list games —
   it only has a "START SHIFT" button → `/shift`. The hub renders RECTANGULAR illustrated
   donghua banners (`BannerCard` in `frontend/src/components/ModeBanners.tsx`), one per
   active mode, grouped into sections. `coming_soon`/`locked` → `Alert` (never a route).
2. **Intro** (`app/mode/[id].tsx`, reusable): banner art + `lore` (BRIEFING) + `howItWorks`
   (simple bullets — deliberately NO in-depth units/enemies) + reward preview + one CTA
   labelled `entryLabel` that pushes `mode.route`. Resolve the mode with `findMode(id)`.
3. **Gameplay**: `mode.route` points at the real screen. Ward Shift → `/shift-cases`
   (Today's Shift: a cycling "Daily Quests" carousel using `quest_icon.png`, each case
   spends 1 challenge → `/battle`, optional boss quest costs 5 → `/boss`). Others route to
   existing screens (`/ward-defense`, `/boss`, `/lotus-journal`).

**Banner art:** 4 real PNGs in `frontend/assets/images/banner_<key>.png` (16:9) + `quest_icon.png`
(1:1). `BANNER_IMAGES`/`getBannerImage(imageKey)` map lives in `ModeBanners.tsx` — require()
paths MUST be static literals. `ModeCardDef` gained `imageKey/lore/howItWorks/entryLabel`.

**Economy:** challenges regen 1 per 10 min (6/hr) via `stamina.ts`; cap starts 20; regular
encounter = `ENCOUNTER_COST` (1), boss = `BOSS_ENCOUNTER_COST` (5).

**Gotcha:** direct URL / deep-link to any of these routes reboots the app and loads the
player async — screens must render a loading spinner while `player == null`, NOT `return null`
(returns blank black screen that reads as a crash). In-app SPA nav has player already loaded.
