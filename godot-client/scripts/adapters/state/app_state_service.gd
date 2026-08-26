class_name AppStateService
extends IAppStateService
## In-memory presentation/session state. Not a save authority; nothing here
## should be read as durable progression (per
## docs/canonical-gameplay-contract.md §2.4).

var _values: Dictionary = {}

func get_value(key: String, default: Variant = null) -> Variant:
	return _values.get(key, default)

func set_value(key: String, value: Variant) -> void:
	_values[key] = value
	state_changed.emit(key, value)
