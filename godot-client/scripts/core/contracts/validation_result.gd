class_name ValidationResult
extends RefCounted
## Structured pass/fail record used by IFixtureValidator implementations.
## overall is one of "pass" | "fail" | "limited" (limited = every check that
## ran passed, but at least one check could not be run/verified here).

var checks: Array = []
var overall: String = "pass"

func add(check_name: String, passed: bool, message: String = "") -> void:
	checks.append({"name": check_name, "passed": passed, "message": message})
	if not passed:
		overall = "fail"

func add_limitation(check_name: String, message: String) -> void:
	checks.append({"name": check_name, "passed": null, "message": message, "limited": true})
	if overall == "pass":
		overall = "limited"

func to_dict() -> Dictionary:
	return {"overall": overall, "checks": checks}
