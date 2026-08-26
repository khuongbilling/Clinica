extends SceneTree
## Headless entry point for the fixture validator.
##
## Usage (requires a local Godot 4.3+ executable, not available in the
## environment this skeleton was authored in):
##
##   godot4 --headless --path godot-client \
##     --script res://scripts/tools/run_fixture_validation.gd
##
## Prints a JSON validation report for fixtures/clinica-golden/v1/ and exits
## non-zero only when a genuine structural/referential check failed. The
## SHA-256 hash-parity check is informational only — see
## FixtureValidatorAdapter for why, and run
## `node fixtures/clinica-golden/v1/validate.cjs` for the authoritative
## hash-verified result.

const FixtureValidatorAdapterScript = preload("res://scripts/adapters/validation/fixture_validator_adapter.gd")

func _initialize() -> void:
	var validator = FixtureValidatorAdapterScript.new()
	var result: Dictionary = validator.validate()
	print(JSON.stringify(result, "  "))
	if result.get("overall", "fail") == "fail":
		quit(1)
	else:
		quit(0)
