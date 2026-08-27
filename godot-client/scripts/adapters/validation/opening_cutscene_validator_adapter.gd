class_name OpeningCutsceneValidatorAdapter
extends IFixtureValidator
## Read-only validator for the M2-P1 opening-shell / cutscene-playback push.
##
## Every check here is native (GDScript-only) -- there is no golden fixture
## pack entry for cutscene playback. Checks are grouped and labeled
## `native:*`. This adapter never mutates gameplay, saves, or the fixture
## pack, and it never attempts to actually decode/render a real video (no
## such asset exists yet by design -- see assets/cutscenes/README.md); it
## exercises the real service logic (state machine, fallback detection,
## source-level convergence/authority guarantees) using only assets that
## are genuinely present in this repository, plus one explicit, clearly
## labeled test double (`StubVideoStream`) that contains no video content
## at all.

const CutscenePlaybackServiceScript = preload("res://scripts/adapters/cutscene/cutscene_playback_service.gd")
const ICutscenePlaybackServiceScript = preload("res://scripts/core/services/i_cutscene_playback_service.gd")

# A real, existing, non-video script resource -- used only to prove the
# "resource loaded but is not a VideoStream" fallback branch with genuine
# repository content, never a fabricated/corrupt file.
const UNSUPPORTED_ASSET_PATH := "res://scripts/core/composition_root.gd"

# StubVideoStream: a real `is VideoStream` Resource with no video data and
# no playback capability, used only to prove the "resource resolved but no
# display node is bound" fallback branch without requiring (or faking) an
# actual pre-rendered video. See its own doc comment for the honesty
# boundary this represents.
const STUB_VIDEO_STREAM_PATH := "res://scripts/adapters/validation/test_doubles/stub_video_stream.tres"

const OPENING_SERVICE_SOURCE := "res://scripts/adapters/cutscene/cutscene_playback_service.gd"
const OPENING_SCENE_SOURCE := "res://scenes/opening/opening.gd"
const BOOT_SOURCE := "res://scenes/boot/boot.gd"

class _SilentLogger:
	func info(_tag: String, _message: String) -> void:
		pass
	func warn(_tag: String, _message: String) -> void:
		pass
	func error(_tag: String, _message: String) -> void:
		pass

class _SignalCapture:
	var fallback_events: Array = []
	var finished_events: Array = []
	var skipped_events: Array = []
	var loading_events: Array = []

	func on_fallback(id: String, reason: String) -> void:
		fallback_events.append({"id": id, "reason": reason})

	func on_finished(id: String) -> void:
		finished_events.append(id)

	func on_skipped(id: String) -> void:
		skipped_events.append(id)

	func on_loading(id: String) -> void:
		loading_events.append(id)

func _read_text(path: String) -> String:
	if not FileAccess.file_exists(path):
		return ""
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return ""
	var text := file.get_as_text()
	file.close()
	return text

func _new_service(extra_asset_paths: Dictionary = {}) -> CutscenePlaybackService:
	return CutscenePlaybackServiceScript.new(_SilentLogger.new(), extra_asset_paths)

func _wire_capture(svc: CutscenePlaybackService) -> _SignalCapture:
	var capture := _SignalCapture.new()
	svc.fallback_triggered.connect(capture.on_fallback)
	svc.finished.connect(capture.on_finished)
	svc.skipped.connect(capture.on_skipped)
	svc.loading.connect(capture.on_loading)
	return capture

func validate() -> Dictionary:
	var result := ValidationResult.new()
	_validate_interface_shape(result)
	_validate_initial_state(result)
	_validate_missing_asset_fallback(result)
	_validate_unsupported_asset_fallback(result)
	_validate_no_display_node_fallback(result)
	_validate_skip_noop_when_not_active(result)
	_validate_replay_reinvokes_play(result)
	_validate_manual_finish_transition(result)
	_validate_manual_skip_transition(result)
	_validate_trigger_fallback_promoted_and_reason_passthrough(result)
	_validate_no_forbidden_authority_references(result)
	_validate_boot_targets_opening(result)
	_validate_opening_targets_app_shell(result)
	_validate_convergence_and_replay_not_a_completion_path(result)
	return result.to_dict()

func _validate_interface_shape(result: ValidationResult) -> void:
	var svc := _new_service()
	result.add(
		"native:adapter_extends_interface",
		svc is ICutscenePlaybackServiceScript
	)
	result.add(
		"native:interface_declares_trigger_fallback",
		ICutscenePlaybackServiceScript.new().has_method("trigger_fallback")
	)
	result.add(
		"native:interface_declares_current_state",
		ICutscenePlaybackServiceScript.new().has_method("current_state")
	)

func _validate_initial_state(result: ValidationResult) -> void:
	var svc := _new_service()
	result.add("native:initial_state_is_idle", svc.current_state() == "idle")

func _validate_missing_asset_fallback(result: ValidationResult) -> void:
	# "opening" resolves to assets/cutscenes/opening.ogv, which does not
	# exist in this repository by design (see assets/cutscenes/README.md).
	# This is the real, honest missing-asset path -- not simulated.
	var svc := _new_service()
	var capture := _wire_capture(svc)
	svc.play("opening")
	result.add(
		"native:missing_asset_emits_loading_then_fallback",
		capture.loading_events == ["opening"] and capture.fallback_events.size() == 1
	)
	if capture.fallback_events.size() == 1:
		result.add(
			"native:missing_asset_fallback_reason",
			capture.fallback_events[0]["reason"] == "missing_asset",
			"got reason '%s'" % str(capture.fallback_events[0]["reason"])
		)
	result.add("native:missing_asset_state_is_fallback", svc.current_state() == "fallback")
	result.add(
		"native:missing_asset_no_finished_or_skipped",
		capture.finished_events.is_empty() and capture.skipped_events.is_empty()
	)

func _validate_unsupported_asset_fallback(result: ValidationResult) -> void:
	result.add(
		"native:unsupported_asset_fixture_exists",
		ResourceLoader.exists(UNSUPPORTED_ASSET_PATH),
		"expected a real, existing non-video resource at %s" % UNSUPPORTED_ASSET_PATH
	)
	var svc := _new_service({"validation_unsupported": UNSUPPORTED_ASSET_PATH})
	var capture := _wire_capture(svc)
	svc.play("validation_unsupported")
	result.add(
		"native:unsupported_asset_triggers_fallback",
		capture.fallback_events.size() == 1 and capture.fallback_events[0]["reason"] == "unsupported_asset",
		"events: %s" % str(capture.fallback_events)
	)

func _validate_no_display_node_fallback(result: ValidationResult) -> void:
	result.add(
		"native:stub_video_stream_is_real_video_stream_type",
		ResourceLoader.exists(STUB_VIDEO_STREAM_PATH) and ResourceLoader.load(STUB_VIDEO_STREAM_PATH) is VideoStream,
		"StubVideoStream fixture must genuinely satisfy 'is VideoStream' to exercise this branch honestly"
	)
	var svc := _new_service({"validation_stub": STUB_VIDEO_STREAM_PATH})
	# Deliberately never call bind_display_node(): this proves the
	# no-display-surface branch without ever touching a real
	# VideoStreamPlayer node or attempting real playback.
	var capture := _wire_capture(svc)
	svc.play("validation_stub")
	result.add(
		"native:no_display_node_triggers_fallback",
		capture.fallback_events.size() == 1 and capture.fallback_events[0]["reason"] == "no_display_node",
		"events: %s" % str(capture.fallback_events)
	)

func _validate_skip_noop_when_not_active(result: ValidationResult) -> void:
	var svc := _new_service()
	var capture := _wire_capture(svc)
	svc.play("opening")  # -> fallback (missing asset), state is terminal
	svc.skip()
	result.add(
		"native:skip_is_noop_after_fallback",
		capture.skipped_events.is_empty(),
		"skip() must not emit skipped once already in a terminal fallback state"
	)

func _validate_replay_reinvokes_play(result: ValidationResult) -> void:
	var svc := _new_service()
	var capture := _wire_capture(svc)
	svc.play("opening")
	svc.replay()
	result.add(
		"native:replay_reinvokes_play_for_same_id",
		capture.loading_events == ["opening", "opening"] and capture.fallback_events.size() == 2,
		"loading_events=%s fallback_events=%s" % [str(capture.loading_events), str(capture.fallback_events)]
	)

func _validate_manual_finish_transition(result: ValidationResult) -> void:
	# White-box unit test of the finish transition: a real end-to-end video
	# decode cannot be exercised headlessly without a real pre-rendered
	# asset (explicitly out of scope for this push), so this drives the
	# exact same private handler VideoStreamPlayer's "finished" signal
	# would invoke in production, after manually placing the service in the
	# PLAYING state it would have reached via a real bound player.
	var svc := _new_service()
	var capture := _wire_capture(svc)
	svc._current_id = "manual_finish_test"
	svc._state = CutscenePlaybackServiceScript.State.PLAYING
	svc._on_video_player_finished()
	result.add(
		"native:manual_finish_emits_finished_and_sets_state",
		capture.finished_events == ["manual_finish_test"] and svc.current_state() == "finished"
	)
	# A second, spurious finished callback (state no longer PLAYING) must
	# not double-emit.
	svc._on_video_player_finished()
	result.add(
		"native:finish_does_not_double_emit",
		capture.finished_events == ["manual_finish_test"]
	)

func _validate_manual_skip_transition(result: ValidationResult) -> void:
	# skip() is safe to exercise against a real (but stream-less)
	# VideoStreamPlayer node: .stop() with nothing loaded is a harmless,
	# real engine call, unlike .play() with a fabricated/stub stream.
	var svc := _new_service()
	var capture := _wire_capture(svc)
	var real_player := VideoStreamPlayer.new()
	svc.bind_display_node(real_player)
	svc._current_id = "manual_skip_test"
	svc._state = CutscenePlaybackServiceScript.State.PLAYING
	svc.skip()
	result.add(
		"native:manual_skip_emits_skipped_and_sets_state",
		capture.skipped_events == ["manual_skip_test"] and svc.current_state() == "skipped"
	)
	svc.unbind_display_node()
	real_player.free()

func _validate_trigger_fallback_promoted_and_reason_passthrough(result: ValidationResult) -> void:
	var svc := _new_service()
	var capture := _wire_capture(svc)
	svc._current_id = "manual_trigger_test"
	svc.trigger_fallback("qa_forced_reason")
	result.add(
		"native:trigger_fallback_emits_with_reason",
		capture.fallback_events.size() == 1
			and capture.fallback_events[0]["id"] == "manual_trigger_test"
			and capture.fallback_events[0]["reason"] == "qa_forced_reason"
	)
	result.add("native:trigger_fallback_sets_state", svc.current_state() == "fallback")

func _validate_no_forbidden_authority_references(result: ValidationResult) -> void:
	var service_text := _read_text(OPENING_SERVICE_SOURCE)
	var scene_text := _read_text(OPENING_SCENE_SOURCE)
	result.add("native:service_source_readable", service_text != "")
	result.add("native:scene_source_readable", scene_text != "")

	var forbidden := ["Services.save_cache", "Services.app_state", "Services.api_transport", "PlayerEnvelope", "player_save_migration"]
	for needle in forbidden:
		result.add(
			"native:cutscene_service_no_reference_to:%s" % needle,
			not service_text.contains(needle),
			"cutscene_playback_service.gd must never reference '%s'" % needle
		)
		result.add(
			"native:opening_scene_no_reference_to:%s" % needle,
			not scene_text.contains(needle),
			"opening.gd must never reference '%s'" % needle
		)

func _validate_boot_targets_opening(result: ValidationResult) -> void:
	var boot_text := _read_text(BOOT_SOURCE)
	result.add(
		"native:boot_navigates_to_opening_route",
		boot_text.contains("navigate_to(\"opening\")")
	)
	result.add(
		"native:boot_changes_scene_to_opening_tscn",
		boot_text.contains("res://scenes/opening/opening.tscn")
	)

func _validate_opening_targets_app_shell(result: ValidationResult) -> void:
	var scene_text := _read_text(OPENING_SCENE_SOURCE)
	result.add(
		"native:opening_navigates_to_app_shell_route",
		scene_text.contains("navigate_to(\"app_shell\")")
	)
	result.add(
		"native:opening_changes_scene_to_app_shell_tscn",
		scene_text.contains("res://scenes/app_shell/app_shell.tscn")
	)

func _validate_convergence_and_replay_not_a_completion_path(result: ValidationResult) -> void:
	var scene_text := _read_text(OPENING_SCENE_SOURCE)
	if scene_text == "":
		result.add("native:convergence_source_readable", false)
		return

	# Exactly one shared transition function, called from exactly the three
	# terminal handlers (finished/skipped/fallback) -- one function
	# definition occurrence plus three call-site occurrences.
	# Match only standalone statement call-sites (tab-indented, nothing
	# trailing on the line) -- this deliberately excludes both the doc
	# comment's backticked mention and the `func _advance_to_app_shell()
	# -> void:` definition line itself.
	var call_site_occurrences := scene_text.count("\t_advance_to_app_shell()\n")
	result.add(
		"native:advance_to_app_shell_called_from_exactly_three_sites",
		call_site_occurrences == 3,
		"expected 3 call sites (finished/skipped/fallback), found %d" % call_site_occurrences
	)
	result.add(
		"native:advance_to_app_shell_has_exactly_one_definition",
		scene_text.count("func _advance_to_app_shell() -> void:") == 1
	)

	var replay_start := scene_text.find("func _on_replay_pressed")
	var replay_next_func := scene_text.find("\nfunc ", replay_start + 1)
	if replay_next_func == -1:
		replay_next_func = scene_text.length()
	var replay_body := scene_text.substr(replay_start, replay_next_func - replay_start)
	result.add(
		"native:replay_handler_found",
		replay_start != -1
	)
	result.add(
		"native:replay_never_calls_advance_to_app_shell",
		not replay_body.contains("_advance_to_app_shell()")
	)
	result.add(
		"native:replay_never_navigates_directly",
		not replay_body.contains("navigate_to(") and not replay_body.contains("change_scene_to_file")
	)
