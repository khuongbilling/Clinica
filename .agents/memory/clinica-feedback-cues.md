---
name: Clinica feedback cues (sound + haptics)
description: How the game's audio/haptic "reward" cues and their mute settings are wired.
---

# Feedback cues (sound + haptics)

`src/game/cues.ts` is the single, dependency-free feedback helper. One public
entry point: `playRewardCue(celebrate = false)`.
- Sound = synthesized chime via **Web Audio API** (web only; no bundled asset,
  no audio package). `celebrate` → richer ascending arpeggio; otherwise a soft
  two-note lift.
- Haptic = `expo-haptics` (native only). Both channels wrapped in try/catch and
  degrade silently (haptics no-op on web; audio no-op on native / autoplay-blocked).
- Two module-level toggles: `setSoundEnabled` / `setHapticsEnabled`.

**Why no audio package / asset:** the app is web-first (Expo web on port 5000)
and had zero audio infra; Web Audio synth covers the testable platform with no
new native deps (which the repo mishandles — see realm-iso memory). Native gets
the haptic buzz but no sound by design.

## Mute settings live outside PlayerState
`src/game/settingsStore.tsx` (mirrors `tutorialStore.tsx`) persists
`{soundEnabled, hapticsEnabled}` to AsyncStorage key `clinica.settings.v1` and
pushes values into cues.ts on load + on change. Provider mounted in
`app/_layout.tsx` (inside PlayerProvider). Toggles surfaced in Profile Settings.
**Why AsyncStorage not PlayerState:** sound/haptics is a per-device preference,
not account data — avoids the backend Player/PlayerUpdate model churn that any
new PlayerState field otherwise requires. `clinica.` prefix means Reset Account
clears it (defaults back to on, which is the desired post-reset state).

## How to apply
Call `playRewardCue(true)` for celebratory moments (battle victory, ten-pull,
reward/ability claim, all-daily-duties-complete) and `playRewardCue(false)` for
ordinary progress (daily-duty advance, single pull). Never hand-roll audio in a
screen — route through this helper so the mute settings are respected everywhere.
