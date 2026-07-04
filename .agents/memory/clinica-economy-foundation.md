---
name: Clinica economy foundation
description: How the docs-only economy system (currencies, pricing, marketplace, guardrails) is structured and surfaced in the app
---

The full economy design (currencies, exchange anchors, Sanctuary Bank, cosmetic price
tiers, Codex Shard/gacha rules, Sanctuary Bazaar, marketplace tax/fees, material
sourcing, progression rules, event economy, guardrails) lives as pure data/doc exports
in one central file (`frontend/src/game/economy.ts`), not scattered across screens.

**Why:** this system is intentionally display-only — no real payments, no live trading,
no subscriptions are wired up yet. Keeping every rule as typed data in one place lets a
guide screen (`app/economy.tsx`) and shop UI (`app/shop.tsx` Premium tab) both render
from the same source of truth without duplicating numbers, and makes it trivial to
later wire real logic against the same constants without redesigning the data shape.

**How to apply:** when adding new economy rules, add them as typed exports in
`economy.ts` first, then reference them from UI — never hardcode currency
amounts/percentages directly in a screen. Any new PlayerState currency field must be
added to both frontend (`types.ts` PlayerState + `store.tsx` normalizeProgression/
defaultPlayer) and backend (`server.py` Player + PlayerUpdate models), per the existing
hero-evolution memory lesson, or refresh normalization silently wipes it. Keep all
purchase/exchange UI as "Coming Soon"/"Foundation"/read-only until real payment logic
is explicitly requested.
