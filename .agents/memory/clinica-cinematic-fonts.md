---
name: Cinematic prologue typography
description: How custom fonts are loaded/applied for the prologue cinematic and VN dialogue bar
---

# Cinematic prologue typography

The prologue uses two custom faces via a shared hook (`use-cinematic-fonts`):
- **Cinzel SemiBold** (`Cinzel-SemiBold`) — display serif for identity card, kicker/scene labels, speaker names, SKIP control.
- **Cormorant Garamond 500 + true italic** — narration lines and VN dialogue text.

Rules:
- Font .ttf files live in `frontend/assets/fonts/` (project assets), **never node_modules** — Metro under Expo Go resolves node_modules .ttf unreliably on Android (same reason use-icon-fonts uses a CDN).
- Apply families only through `cinematicFontStyles(loaded)` — it returns nulls while loading (graceful system-font fallback) and resets `fontWeight`/`fontStyle` to normal when a family IS applied, otherwise Android/web synthesize fake bold/oblique on top of the styled face.
- Fonts are warmed non-blockingly in the root layout; screens never gate render on them.
- Cormorant has a small x-height — sizes there are tuned ~2pt larger than system equivalents.

**Why:** first attempt at mixing `fontWeight:"800"` with a custom family double-bolded on web; and Expo Go's node_modules asset quirk is a known trap in this repo.

**How to apply:** any new prologue/story scene wanting the cinematic look should import the same hook + style helper, not hand-roll `fontFamily` strings.

# Opening cinematic choreography

`OpeningMemoryCinematic` conventions worth keeping:
- Ken Burns is per-beat data (`kb` on each Beat: scaleFrom/To + x/y drift) driving native-driver interpolations on a per-layer progress value; restart the incoming layer's progress inside the A/B crossfade.
- Completion must be single-fire: `finishedRef` guards both auto-finish and SKIP; both route through one `finishCinematic()` fade-to-black.
- The SKIP reveal timer must be its own effect/timeout — the shared `timers` array is cleared on every beat change.
- Letterbox bars are fixed-height views slid in via translateY (height is not native-driver animatable); UI paddings reserve `LETTERBOX_H`.
