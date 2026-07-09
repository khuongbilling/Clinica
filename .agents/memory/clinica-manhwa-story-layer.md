---
name: Manhwa story layer (hybrid art direction)
description: Narrative screens use mature manhwa ink style; gameplay stays donghua. Story scene infra and image-gen pitfalls.
---

**Rule:** Hybrid art direction — narrative surfaces (reminiscence, title splash, story scenes in `assets/story/`) use mature Korean manhwa ink style (muted ink-wash + selective luminous gold); ALL gameplay assets (heroes/enemies/banners/battle_bg/loading/realm) stay donghua. Do not cross-contaminate.

**Why:** User-approved audit decision (July 2026) to give story beats a distinct, mature visual register while keeping gameplay bright and readable.

**How to apply:**
- Story scenes are data-driven: add entries to `storyScenes.ts`; the `/story-scene` screen auto-lists them (gallery without `sceneId`, viewer with). Viewing writes NO progression state.
- `NarrativePanel tone="ink"` is the manhwa text band; default tone stays for donghua screens.
- Manhwa image gen pitfall: models frequently bake in caption text, white title boxes, letterbox bars, or empty dialogue boxes. Always visually inspect every generated image and regenerate with "full-bleed artwork extending to every edge" + negative "text, caption, dialogue box, letterbox, bars, border" — about half of a first batch needed regen.
