class_name CutscenePlaybackService
extends ICutscenePlaybackService
## Placeholder pre-rendered cutscene playback adapter (seam only).
## See ICutscenePlaybackService for scope limits: no real video
## decoding/rendering is implemented, no cinematic content is recreated,
## and this service is never a gameplay-authority source.

var _logger
var _current_id: String = ""

func _init(logger) -> void:
	_logger = logger

func play(cutscene_id: String) -> void:
	_current_id = cutscene_id
	_logger.info("cutscene", "play() placeholder for '%s' (no video wired yet)." % cutscene_id)
	# No decoding/rendering is implemented; treat as immediately finished so
	# calling UI can exercise the transition hook without a real asset.
	finished.emit(cutscene_id)

func skip() -> void:
	if _current_id != "":
		skipped.emit(_current_id)

func replay() -> void:
	if _current_id != "":
		play(_current_id)

func trigger_fallback(reason: String) -> void:
	fallback_triggered.emit(_current_id, reason)
