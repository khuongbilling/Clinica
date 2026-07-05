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
