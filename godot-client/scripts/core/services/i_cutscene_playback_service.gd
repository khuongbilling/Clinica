class_name ICutscenePlaybackService
extends RefCounted
## Placeholder pre-rendered cutscene playback contract.
##
## Scope (M1-P1): this is a seam only. It does not implement real video
## decoding/rendering, does not recreate any cinematic content, and must
## never be treated as a gameplay-authority source — skip/replay/fallback
## are UX conveniences, not reward or progression events.

signal finished(cutscene_id: String)
signal skipped(cutscene_id: String)
signal fallback_triggered(cutscene_id: String, reason: String)

func play(_cutscene_id: String) -> void:
	push_error("ICutscenePlaybackService.play is abstract")

func skip() -> void:
	push_error("ICutscenePlaybackService.skip is abstract")

func replay() -> void:
	push_error("ICutscenePlaybackService.replay is abstract")
