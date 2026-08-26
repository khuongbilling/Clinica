class_name INavigationService
extends RefCounted
## Portable navigation contract. Concrete adapters (e.g. GodotNavigationService)
## translate route IDs into engine scene changes. Domain/service code must
## depend on this interface, never on SceneTree directly. Per
## docs/canonical-gameplay-contract.md §2.3, route visibility here is never
## authorization by itself.

func navigate_to(_route_id: String, _params: Dictionary = {}) -> void:
	push_error("INavigationService.navigate_to is abstract")

func go_back() -> void:
	push_error("INavigationService.go_back is abstract")

func current_route() -> String:
	push_error("INavigationService.current_route is abstract")
	return ""
