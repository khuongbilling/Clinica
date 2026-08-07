---
name: Clinica notification badge cascade
description: How "new content" red badges bubble up from content to tab icons, and where seen-state lives
---
Red "new content" badges cascade upward: content item → hub banner → tab icon dot. Rule: viewing the content is the ONLY thing that clears the badge (never navigation alone).

**Sources of truth:**
- Memories: `player.story_scenes_seen` (server-persisted) via `unseenMemoriesCount()` in `storyScenes.ts`; story-scene viewer marks seen on exit.
- Bag new items: `bagSeenStore.ts` — AsyncStorage `clinica.seen_bag_items` (local-only by design), `useNewBagCount()` hook + module subscribers; item-bag screen marks seen on mount.

**Why:** two-tier storage — cross-device-meaningful progress goes in PlayerState/backend; pure attention state (item "NEW" dots) stays in prefixed AsyncStorage so it's wiped by account reset without backend model churn.

**How to apply:** new badge sources follow the same split; local trackers MUST use the `clinica.` prefix AND export a cache-clear function called from `resetPlayer` (module caches survive the AsyncStorage wipe). Tab bar badge dots: `mkTabIcon(..., badge)` in `(tabs)/_layout.tsx`.

Nav layout since this change: tab bar = Journey · Heroes · Home · Bag · Shop; Study & Realm are hub shortcut cards (side columns of `(tabs)/index.tsx`); their tab routes stay alive hidden via `href:null`. Journey tab is a banner hub (University / Chapters / Memories) — the old chapter map lives at `/journey`.
