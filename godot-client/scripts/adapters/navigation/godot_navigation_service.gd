class_name GodotNavigationService
extends INavigationService
## Composition-edge navigation adapter. Presentation-only: it tracks the
## logical route stack; it does not gate features, grant access, or imply
## server authorization. Route visibility is not authorization (per
## docs/canonical-gameplay-contract.md §2.3).

var _host: Node
var _stack: Array = []

func _init(host: Node) -> void:
	_host = host

func navigate_to(route_id: String, params: Dictionary = {}) -> void:
	_stack.append({"route": route_id, "params": params})

func go_back() -> void:
	if _stack.size() > 1:
		_stack.pop_back()

func current_route() -> String:
	if _stack.is_empty():
		return ""
	return str(_stack.back().get("route", ""))
