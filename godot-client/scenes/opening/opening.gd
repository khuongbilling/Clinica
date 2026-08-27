extends Control
## Opening presentation shell.
##
## Hosts real pre-rendered cutscene playback via the canonical
## `Services.cutscene` seam (`ICutscenePlaybackService`/
## `CutscenePlaybackService`). This scene owns the actual `VideoStreamPlayer`
## node and binds/unbinds it to the shared cutscene service for its own
## lifetime only.
##
## Convergence rule (per M2-P1 scope): finished playback, a user skip, and a
## missing/unsupported-asset fallback all call the exact same
## `_advance_to_app_shell()` function below -- there is deliberately no
## second transition path. Replay never calls it: replay is a
## presentation-only restart, not a completion path, and must never grant a
## reward, alter gating, or write save/progression state (this scene talks
## to no save/state service at all, by design).

const OPENING_CUTSCENE_ID := "opening"
const APP_SHELL_SCENE_PATH := "res://scenes/app_shell/app_shell.tscn"

@onready var _video_player: VideoStreamPlayer = $VideoPlayer
@onready var _loading_label: Label = $LoadingLabel
@onready var _fallback_label: Label = $FallbackLabel
@onready var _skip_button: Button = $SkipButton
@onready var _replay_button: Button = $ReplayButton

var _transitioned: bool = false

func _ready() -> void:
	Services.cutscene.loading.connect(_on_cutscene_loading)
	Services.cutscene.finished.connect(_on_cutscene_finished)
	Services.cutscene.skipped.connect(_on_cutscene_skipped)
	Services.cutscene.fallback_triggered.connect(_on_cutscene_fallback)

	Services.cutscene.bind_display_node(_video_player)

	_skip_button.pressed.connect(_on_skip_pressed)
	_replay_button.pressed.connect(_on_replay_pressed)

	_loading_label.visible = false
	_fallback_label.visible = false

	Services.logger.info("opening", "Opening shell ready; starting cutscene playback.")
	Services.cutscene.play(OPENING_CUTSCENE_ID)

func _exit_tree() -> void:
	# _video_player belongs to this scene and is about to be freed with it;
	# unbind first so the shared, longer-lived cutscene service never keeps
	# a dangling node reference after this scene is gone.
	if Services.cutscene != null:
		Services.cutscene.unbind_display_node()

func _on_cutscene_loading(_id: String) -> void:
	_loading_label.visible = true
	_fallback_label.visible = false

func _on_cutscene_finished(_id: String) -> void:
	_loading_label.visible = false
	_advance_to_app_shell()

func _on_cutscene_skipped(_id: String) -> void:
	_loading_label.visible = false
	_advance_to_app_shell()

func _on_cutscene_fallback(_id: String, reason: String) -> void:
	Services.logger.info("opening", "Cutscene fallback triggered: %s" % reason)
	_loading_label.visible = false
	_fallback_label.visible = true
	_advance_to_app_shell()

func _on_skip_pressed() -> void:
	Services.cutscene.skip()

func _on_replay_pressed() -> void:
	# Presentation-only restart. Deliberately never reachable after this
	# scene has already started transitioning away, so a replay can never
	# race an in-flight scene change.
	if _transitioned:
		return
	_loading_label.visible = false
	_fallback_label.visible = false
	Services.cutscene.replay()

func _advance_to_app_shell() -> void:
	if _transitioned:
		return
	_transitioned = true
	Services.navigation.navigate_to("app_shell")
	# Deferred for the same reason boot.gd defers its own scene change: a
	# scene change triggered synchronously from within a signal handler can
	# race the SceneTree's own bookkeeping.
	get_tree().call_deferred("change_scene_to_file", APP_SHELL_SCENE_PATH)
