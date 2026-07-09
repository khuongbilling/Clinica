---
name: Clinica entry flow & asset preloader
description: How the app boots into title → preloader → game, and why the preloader warms every image module.
---

# Entry flow
`app/index.tsx` is only a boot gate: while the player store is `loading` it shows text hints, then `Redirect` to `/title` (always — returning players see the landing every launch, by design).

`/title` = landing/"login" screen (there is NO real auth in this app; "log in" is interpreted as a title screen). "Start Game" → `router.replace("/preloader")`.

`/preloader` renders the full-page `RealmLoadingScreen` and runs `preloadAllGameAssets()`, then `router.replace(resolveEntryRoute(player))`. Destination logic (prologue / post-recall / reminiscence / (tabs)) lives ONLY in `src/game/route.ts` — keep it in sync if game gating changes; it used to be inline in index.tsx.

# Why the preloader exists (the white-bg bug)
On NATIVE devices a large (~1.2MB) battle-background PNG can paint as a white frame the instant a battle mounts before it decodes — reported specifically on the scripted-loss prologue boss (`silent_infarct`). Not reproducible on web. The fix is to pre-decode every battle background + enemy sprite up front, so `preloadAllGameAssets` (src/game/preloadAll.ts) unions hero/realm/**battle-bg (battleAssets.ts)**/enemy/loading-art modules + `preloadTabAssets()`.

**Why:** the bug is a decode/first-render race, not a missing/corrupt asset (all battle_bg PNGs are valid). Warming the expo-image cache before gameplay is the mitigation.

# prefetch ceilings — important
`prefetchModules` (realmAssets.ts): web path decodes through real `HTMLImageElement` with a **12s ceiling**; native path is `ExpoImage.prefetch` with **NO ceiling**. So the preloader screen MUST keep its own fail-open cap (MAX_WAIT_MS) that flips the assets-ready gate regardless, or a stalled native prefetch hangs the loader forever. Preloader gate = `minElapsed (2.4s) && assetsReady && !loading`, guarded by a `navigated` ref against double-replace.

# Post-reminiscence destination
`reminiscence.tsx` `finish()` routes a FIRST-TIME (non-replay) player straight to `/university`, NOT the hub `/(tabs)` — the cutscene's final scene is "Clinica University", so landing there is the narrative payoff. Replay mode (from Profile) returns to `/(tabs)/profile`. Safe because University is gated only by account level 1 (always met) and its screen self-greets (The System "you were recalled…" + arrival SceneTransition).
**Consequence:** the hub's welcome modal (`clinica.intro.seen`) + `systemHubIntro` narrator now DEFER until first hub visit; downstream System beats (`systemWardHub`→`systemShops`) chain off `systemHubIntro`, so their order is non-deterministic if the player explores before opening the hub. This is an accepted tradeoff, not a bug.

# Misc
- Sprite maps (`HERO_SPRITE_MODULES`, `ENEMY_SPRITE_MODULES`, etc.) are typed `ImageSourcePropType[]`; `prefetchModules` wants `number[]` → cast `as unknown as number[]` (require() returns a module number at runtime).
- expo-router typed routes: after adding a new `app/*.tsx` route file, restart the workflow so `.expo/types/router.d.ts` regenerates or tsc flags the new href as invalid.
- Loading art (`src/game/loadingArt.ts`) is now MULTI-hero party scenes (assets/loading/party_*.png), not the single healer heroine; title splash is assets/images/title_splash.png.
