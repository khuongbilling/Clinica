class_name IFixtureValidator
extends RefCounted
## Read-only validator contract for fixtures/clinica-golden/v1/. Must never
## mutate gameplay, saves, or the fixture pack itself.

func validate() -> Dictionary:
	push_error("IFixtureValidator.validate is abstract")
	return {"overall": "fail", "checks": []}
