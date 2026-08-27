extends SceneTree
## Headless entry point for the M2-P1 opening/cutscene-playback validator.
##
##   godot --headless --path godot-client \
##     --script res://scripts/tools/run_opening_cutscene_validation.gd
##
## Prints a JSON validation report and exits non-zero if any check failed.
## This actually RUNS CutscenePlaybackService against real inputs (its
## public API plus targeted white-box state-machine checks) -- see
## OpeningCutsceneValidatorAdapter for what is verified and why.

const OpeningCutsceneValidatorAdapterScript = preload("res://scripts/adapters/validation/opening_cutscene_validator_adapter.gd")

func _initialize() -> void:
	var validator = OpeningCutsceneValidatorAdapterScript.new()
	var result: Dictionary = validator.validate()
	print(JSON.stringify(result, "  "))
	if result.get("overall", "fail") == "fail":
		quit(1)
	else:
		quit(0)
