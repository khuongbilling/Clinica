class_name IApiTransport
extends RefCounted
## Portable API transport contract. Adapters must send only the existing
## session/privileged headers documented in
## docs/canonical-backend-api-authority-contract.md §2 to their respective
## routes, and must never embed faculty/curriculum-admin secrets in a player
## build. A successful local response is not durable authority by itself —
## only the server's dedicated route/receipt is (the "Godot/Unity rule").

func request(_method: String, _path: String, _headers: Dictionary = {}, _body: Variant = null) -> Dictionary:
	push_error("IApiTransport.request is abstract")
	return {"status": -1, "error": "not_implemented"}
