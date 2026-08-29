extends SceneTree
## Headless entry point for the M2-P2 first-battle validator.
##
##   godot4 --headless --path godot-client \
##     --script res://scripts/tools/run_first_battle_validation.gd

const FirstBattleValidatorAdapterScript = preload("res://scripts/adapters/validation/first_battle_validator_adapter.gd")

func _initialize() -> void:
	var validator = FirstBattleValidatorAdapterScript.new()
	var result: Dictionary = validator.validate()
	print(JSON.stringify(result, "  "))
	if result.get("overall", "fail") == "fail":
		quit(1)
	else:
		quit(0)