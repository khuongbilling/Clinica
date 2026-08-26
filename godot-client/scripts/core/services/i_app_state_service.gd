class_name IAppStateService
extends RefCounted
## Portable app-state contract for presentation/session state (not save
## authority). The backing store may change without affecting callers. Per
## docs/canonical-gameplay-contract.md §2.4, values held here are local/UI
## state, never durable progression.

signal state_changed(key: String, value: Variant)

func get_value(_key: String, _default: Variant = null) -> Variant:
	push_error("IAppStateService.get_value is abstract")
	return null

func set_value(_key: String, _value: Variant) -> void:
	push_error("IAppStateService.set_value is abstract")
