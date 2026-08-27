class_name StubVideoStream
extends VideoStream
## Test double for M2-P1 validation ONLY -- never referenced by any
## production code path or scene.
##
## This is not a cinematic asset: it contains no video data, no frames, no
## audio, and is never played back (no `play()`/`instantiate_playback()` is
## ever invoked against it by the validator). It exists solely so
## `OpeningCutsceneValidatorAdapter` can exercise
## `CutscenePlaybackService`'s "resource resolved but no display node is
## currently bound" fallback branch using a real object that is genuinely
## `is VideoStream`, instead of fabricating or embedding an actual
## pre-rendered video file.
