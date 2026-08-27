# Cutscene assets

This directory intentionally contains no video files yet. M2-P1 wires the
real playback path (`CutscenePlaybackService` + the `opening` scene) so a
pre-rendered video can be dropped in later without any code change; it does
not fabricate, generate, or recreate cinematic content itself.

## Expected file for the opening cutscene

| Cutscene id | Expected path | Format |
| --- | --- | --- |
| `opening` | `res://assets/cutscenes/opening.ogv` | Ogg Theora (`.ogv`) |

`.ogv` (Theora) is used because it is the video codec Godot 4's built-in
`VideoStreamPlayer`/`VideoStreamTheora` supports without an extra
GDExtension plugin (WebM/MP4 require one in Godot 4 core).

## What happens with no file present (current state)

`CutscenePlaybackService.play("opening")` checks `ResourceLoader.exists()`
against the path above. While this file is absent, that check correctly
fails and the service emits `fallback_triggered("opening", "missing_asset")`
instead of attempting playback -- this is the real, honest fallback path,
not a simulated one. See `docs/M2-P1-VERIFICATION.md` for how this is
verified headlessly.

## Adding the real asset later

Once a real pre-rendered `opening.ogv` exists, drop it in at the exact path
above. No code change is required: `CutscenePlaybackService` will resolve
the same id to the same path, `ResourceLoader.exists()` will succeed, and
playback will proceed through the same `VideoStreamPlayer`-backed path that
is already implemented and tested.
