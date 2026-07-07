---
name: Clinica global PlayerHeader
description: Shared top-of-screen player header used across hub screens — scope rules, integration pattern, and non-linear Player EXP curve.
---

`frontend/src/components/PlayerHeader.tsx` is the single source of truth for the persistent global header shown on non-battle hub screens (Shop, Heroes, Shift, Realm, Faction, University hub, Ward Defense lobby/menu, Lotus Journal). Profile intentionally does NOT show it — Profile is the header's own tap destination and already renders detailed player info, so adding it there would double up.

**Scope rule:** only the four "main wallet" items belong in this header — stamina, Ward Coins (`crowns`), Refined Lotus Gems, Lotus Gems (`lotus_gems_paid`) — plus identity (avatar/name/level/class) and a slim non-linear Player EXP bar. Every other currency (Codex Shards, Ward Sigils, Nourishment Petals, Faction Marks, building materials, Insight Crystals) must stay inside its own system's screen; do not add them here even if a screen already displayed them elsewhere.

**Integration pattern:** `<PlayerHeader player={player} />` as the first child inside each screen's outer `SafeAreaView`, guarded by `player &&` where the screen doesn't already `if (!player) return null` early. For component-scoped screens without a `player` prop threaded in (e.g. Ward Defense's `LobbyScreen`), call `usePlayer()` locally inside that component — don't thread player through prop drilling if the component already sits inside the store's provider tree. Use `compact` prop (hides rank subtitle line) for tighter contexts like the Ward Defense pre-battle lobby; never on the primary hub screens.

Player EXP curve (`playerXpCostForLevel` in `progression.ts`) was changed from linear to `Math.round(100 * Math.pow(level, 1.35) + 50 * level)` for early-fast/late-slow pacing (cap level 60). There's only one Player-XP award site (`applyXpDetailed` from battle.tsx), so no other farm-rate balancing was needed.

When removing an old ad-hoc header/level-panel block to make room for `PlayerHeader`, watch for now-unused local vars (e.g. `staminaNow/staminaMax` from `useLiveStamina`, `playerLevelProgress`, `nextUnlock`) and the `useLiveStamina` import — `PlayerHeader` computes all of this internally, so the screen no longer needs it unless used elsewhere on the page.

**Layout (single-line identity+wallet):** header top row now puts identity (avatar+name/title, left) and the 4 wallet chips (right) on ONE line that wraps chips to a second line on narrow widths. The wrap only stays deterministic if the outer `topRow` has `flexWrap:"wrap"` AND identity has a `flexBasis`/`flexGrow` while the chip cluster has `flexGrow:1 + justifyContent:"flex-end"`. Do NOT push chips right with `marginLeft:"auto"` on a wrapping row — it breaks the second-line drop.

**Hand-drawn art (not Ionicons):** avatar and wallet/stamina chip icons use hand-drawn donghua PNGs via `expo-image` (`Image as ExpoImage`), NOT Ionicons — RN `Image` is unreliable on web here. Registries: `src/game/avatars.ts` (portrait options + `getAvatarSource`/`isValidAvatarId`) and `src/game/uiIcons.ts` (`getUiIcon('stamina'|'crowns'|'refined_gem'|'lotus_gem')`). Assets in `assets/avatars/` and `assets/ui-icons/`.

**Choosable portrait avatar:** `PlayerState.avatar_id` ('' = fall back to aptitude Ionicon) is a full PlayerState field — wired in backend `Player`+`PlayerUpdate`, store `defaultPlayer`+`normalize` backfill+`setAvatar` action+context memo, per the anti-wipe rule. Picker modal lives on the Profile screen (tap the big avatar); header just renders whatever `avatar_id` resolves to.
