extends SceneTree
## Headless entry point for the M1-P2 player-save migration validator.
##
##   godot --headless --path godot-client \
##     --script res://scripts/tools/run_migration_validation.gd
##
## Prints a JSON validation report and exits non-zero if any check failed.
## This actually RUNS PlayerSaveMigration.migrate() against real inputs
## (the golden fixture cases plus supplementary native vectors) — it is not
## a structural-only smoke check. See PlayerSaveMigrationValidatorAdapter
## for what is verified.

const PlayerSaveMigrationValidatorAdapterScript = preload("res://scripts/adapters/validation/player_save_migration_validator_adapter.gd")

func _initialize() -> void:
	var validator = PlayerSaveMigrationValidatorAdapterScript.new()
	var result: Dictionary = validator.validate()
	print(JSON.stringify(result, "  "))
	if result.get("overall", "fail") == "fail":
		quit(1)
	else:
		quit(0)
