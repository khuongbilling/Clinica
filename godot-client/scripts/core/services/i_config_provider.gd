class_name IConfigProvider
extends RefCounted
## Portable configuration/environment contract. No secrets belong in
## checked-in Godot resources; production values must be injected via
## environment/build configuration, never hardcoded, per
## docs/canonical-backend-api-authority-contract.md §10.

func get_backend_base_url() -> String:
	push_error("IConfigProvider.get_backend_base_url is abstract")
	return ""

func is_debug() -> bool:
	push_error("IConfigProvider.is_debug is abstract")
	return false
