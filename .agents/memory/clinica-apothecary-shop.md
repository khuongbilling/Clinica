---
name: Clinica Apothecary Market shop
description: How the crown-sink shop is wired across screens, store actions, and gameplay systems
---

# Apothecary Market shop

Crown-currency shop with 5 categories, all in `src/game/shop.ts` (catalog) + `app/shop.tsx` (screen, 5 tabs). Entry points route to `/shop`: the Kingdom `apothecary` building card and the result-screen crowns card.

## The two-lever reality of Ward Defense boosts
**Rule:** Ward Defense runs ALWAYS start at `MAX_STABILITY` (100) with `INIT_AP` action points. There is NO headroom for a "+starting Stability" boost — `MAX_STABILITY + bonus` clamps straight back to 100, so any stability-start boost is silently dead.
**Why:** A paid "Lantern Ward +20 Stability" boost shipped with zero effect until caught in review; the clamp ate it.
**How to apply:** The only genuinely useful WD run-start levers the engine supports are `startAP` (capped at MAX_AP) and `startShield` (opening `shieldTicks` that halve incoming damage; ~2 ticks/sec, TICK_MS=500). Do not add stability/corruption start boosts — corruption also starts at 0, so a reduction is equally dead. Keep `WardBoost.effect` limited to `{startAP, startShield}`.

## Boost consumption flow
Ward boosts are bought into `inventory` keyed by `boost.name` (via `purchaseItem`). In the WD lobby, owned boosts render a toggle list; `startGame` sums the activated effects, decrements inventory once each, removes at 0, persists via `syncInventory`, then applies to `freshState(boostEffect)`. `freshState` takes an optional boost arg — it is the single place run-start numbers are set.

## Permanent upgrades → battle
`owned_upgrades` (string[]) → `aggregateUpgradeEffects()` folds into `initBattle` opts at the battle.tsx call site. Effects map 1:1 onto real engine opts: `apBonus` (added to turnAp + apMax), `startingStabilityBonus`, `enemyDamageReduction`, `revealOneExtraClue` — mechanic-honest because described benefit == applied opt.

## Skins are cosmetic-only
`equipped_skin` renders an aura glow + accent border on owned Hero cards (heroes.tsx). Never touches stats. They are color/aura themes, NOT new sprite art.

## Ward skins reuse the single skin slot
A "ward skin" (e.g. Bloom Ward Skin) is just a normal `ShopSkin` with an extra `wardBackdrop` (require'd PNG) that BattlefieldScene uses to OVERRIDE the per-system arena background. It still lives in `owned_skins` + the single `equipped_skin` slot, so equipping a ward skin and a hero-aura skin is mutually exclusive (one cosmetic slot for both). `exchangeOnly:true` marks skins that aren't crown-purchasable (earned via Miasma Bloom Token Exchange instead) — the shop skins tab shows a "Token Exchange" badge instead of a BuyButton for those.
**Why:** avoids a new PlayerState field (backend Player/PlayerUpdate normalize-wipe gotcha) and reuses the whole purchase/equip UI.
**How to apply:** Token Exchange cosmetic rewards use `ExchangeGrant {kind:"cosmetic", skinId}` in worldEvent.ts; `redeemExchangeItem` mirrors purchaseSkin (adds to owned_skins + auto-equips, guards against re-buying an owned skin).

## Persistence
`crowns`, `owned_skins`, `equipped_skin`, `owned_upgrades` must all exist on backend Player + PlayerUpdate models or refresh's normalize wipes them (see clinica-hero-evolution rule). `equipped_skin` default "" persists unequip because update_player filters only `None`.
