---
name: Reset Account full wipe
description: Why "Reset Account" wipes all clinica.* AsyncStorage keys, not just the player record
---

Reset Account (`resetPlayer` in `src/game/store.tsx`, invoked from Profile's reset
button together with `resetTutorials`) must clear EVERY app-owned persisted key,
then let Boot (`router.replace("/")`) redirect to the title screen for a fresh run.

**Why:** One-time onboarding/UI flags live in their own AsyncStorage keys separate
from the player record — e.g. hub intro (`clinica.intro.seen`), battle tips
(`clinica.tips.seen.v2`), dismissed world-event banner
(`clinica.worldEventBanner.dismissed.*`), cached test session
(`clinica.testSession.v1`), tutorials (`clinica.tutorials.v1`). Clearing only
`clinica.player.v2` left these behind, so a "reset" account never re-showed the
intro/tips and didn't truly start from the beginning.

**How to apply:** All Clinica keys share the `clinica.` prefix. `resetPlayer`
enumerates `getAllKeys()` and `multiRemove`s everything with that prefix (falling
back to removing just the player key on failure), and also nulls `playerRef.current`.
Any new persisted flag added anywhere in the app is auto-covered as long as its key
starts with `clinica.` — keep that prefix convention or reset will silently miss it.
