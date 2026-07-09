---
name: Clinica ambient audio engine
description: Dependency-free Web Audio ambient loops for story/narrative scenes and how they respect the mute setting.
---

# Clinica ambient audio

- `ambient.ts` synthesizes ambient loops (rain / chimes / ward hum) with Web Audio — no bundled audio assets or audio packages, silent no-op on native, matching the cues.ts philosophy. Keep new sounds synthesized unless a task explicitly asks for real audio files.
- **Mute wiring:** settingsStore pushes toggles into cues.ts; ambient reads `isSoundEnabled()` from cues.ts. Screens must ALSO react to the live toggle (useSettings → start/stop effect) because the engine only checks mute at start time, not continuously.
- **Autoplay:** browsers can suspend the AudioContext; call `pokeAmbience()` inside real user-tap handlers so a suspended context resumes.
- Scene moods derive from visual FX via `sceneAmbience()` (rain→rain, petals→chimes, else ward) with an optional explicit `ambience` override — new story scenes get fitting sound for free.
- **Why:** avoids asset weight/licensing and keeps mute behavior consistent across cue + ambient channels.
