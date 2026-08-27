class_name CutscenePlaybackService
extends ICutscenePlaybackService
## Real pre-rendered-video-backed cutscene playback adapter.
##
## Scope (M2-P1): this adapter plays an actual pre-rendered video resource
## through a Godot `VideoStreamPlayer` supplied by presentation code (see
## `bind_display_node`), with a graceful fallback path when the configured
## asset is missing, unsupported, or there is nowhere to display it. It
## still implements no cinematic content itself -- it only plays whatever
## real asset a future push drops in at the paths declared below. See
## docs/MIGRATION.md §11 for the full design write-up and
## docs/M2-P1-VERIFICATION.md for what was verified.
##
## Authority: unchanged from M1-P1/M1-P2. This class never touches
## `AppStateService`, `ISaveCacheStore`, or any network call. play/skip/
## replay/trigger_fallback are presentation-only; see
## `ICutscenePlaybackService`'s doc comment for the rule this must honor.

## Canonical id -> pre-rendered video asset path. Godot 4's built-in
## `VideoStreamPlayer`/`VideoStreamTheora` supports Ogg Theora (`.ogv`)
## without extra plugins (WebM/MP4 need an external GDExtension in Godot 4
## core), so `.ogv` is the deliberate target format here. No file exists at
## this path yet in this repository -- see assets/cutscenes/README.md. That
## is expected and exercises the real, honest missing-asset fallback path
## rather than a fabricated stand-in.
const CUTSCENE_ASSET_PATHS := {
	"opening": "res://assets/cutscenes/opening.ogv",
}

enum State { IDLE, LOADING, PLAYING, FINISHED, SKIPPED, FALLBACK }

var _logger
var _extra_asset_paths: Dictionary
var _current_id: String = ""
var _state: int = State.IDLE
var _video_player: VideoStreamPlayer = null

## `extra_asset_paths` lets tests/tools resolve a cutscene id to a
## deliberately different (but always real, never fabricated) resource
## path -- e.g. pointing a validation-only id at an existing non-video file
## to exercise the "unsupported asset type" branch honestly, without
## permanently polluting `CUTSCENE_ASSET_PATHS`. Production composition
## (composition_root.gd) never passes this argument.
func _init(logger, extra_asset_paths: Dictionary = {}) -> void:
	_logger = logger
	_extra_asset_paths = extra_asset_paths

## Presentation code (e.g. the opening scene) calls this once it has a real
## `VideoStreamPlayer` node in the live scene tree, so this service has
## somewhere to actually render playback. The node is never constructed or
## owned by this service -- only referenced while bound.
func bind_display_node(video_player: VideoStreamPlayer) -> void:
	_disconnect_video_player()
	_video_player = video_player
	if _video_player != null and not _video_player.finished.is_connected(_on_video_player_finished):
		_video_player.finished.connect(_on_video_player_finished)

## Must be called by presentation code before its `VideoStreamPlayer` node
## is freed (e.g. on scene exit), so this service never holds a dangling
## node reference.
func unbind_display_node() -> void:
	_disconnect_video_player()
	_video_player = null

func _disconnect_video_player() -> void:
	if _video_player != null and _video_player.finished.is_connected(_on_video_player_finished):
		_video_player.finished.disconnect(_on_video_player_finished)

func _resolve_asset_path(cutscene_id: String) -> String:
	if _extra_asset_paths.has(cutscene_id):
		return str(_extra_asset_paths[cutscene_id])
	return str(CUTSCENE_ASSET_PATHS.get(cutscene_id, ""))

func play(cutscene_id: String) -> void:
	_current_id = cutscene_id
	_state = State.LOADING
	loading.emit(cutscene_id)

	var path := _resolve_asset_path(cutscene_id)
	if path == "" or not ResourceLoader.exists(path):
		_logger.info("cutscene", "play('%s'): no asset at '%s'; falling back." % [cutscene_id, path])
		_state = State.FALLBACK
		fallback_triggered.emit(cutscene_id, "missing_asset")
		return

	var stream = ResourceLoader.load(path)
	if stream == null or not (stream is VideoStream):
		_logger.info("cutscene", "play('%s'): resource at '%s' is not a supported VideoStream; falling back." % [cutscene_id, path])
		_state = State.FALLBACK
		fallback_triggered.emit(cutscene_id, "unsupported_asset")
		return

	if _video_player == null:
		# The asset itself loaded fine; there is simply no bound display
		# surface to render it in right now. Reported as a distinct,
		# honest reason from a missing/corrupt asset.
		_logger.info("cutscene", "play('%s'): no display node bound; falling back." % cutscene_id)
		_state = State.FALLBACK
		fallback_triggered.emit(cutscene_id, "no_display_node")
		return

	_video_player.stream = stream
	_state = State.PLAYING
	_video_player.play()

func skip() -> void:
	if _state != State.LOADING and _state != State.PLAYING:
		return
	if _video_player != null:
		_video_player.stop()
	_state = State.SKIPPED
	skipped.emit(_current_id)

func replay() -> void:
	if _current_id == "":
		return
	play(_current_id)

func trigger_fallback(reason: String) -> void:
	if _video_player != null:
		_video_player.stop()
	_state = State.FALLBACK
	fallback_triggered.emit(_current_id, reason)

func current_state() -> String:
	match _state:
		State.LOADING:
			return "loading"
		State.PLAYING:
			return "playing"
		State.FINISHED:
			return "finished"
		State.SKIPPED:
			return "skipped"
		State.FALLBACK:
			return "fallback"
		_:
			return "idle"

func _on_video_player_finished() -> void:
	if _state != State.PLAYING:
		return
	_state = State.FINISHED
	finished.emit(_current_id)
