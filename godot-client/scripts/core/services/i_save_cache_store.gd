class_name ISaveCacheStore
extends RefCounted
## Portable local save/cache contract.
##
## IMPORTANT (per docs/canonical-save-schema-contract.md and the
## "Godot/Unity rule" in docs/canonical-backend-api-authority-contract.md
## §1): a save/cache adapter is presentation/offline support only. It must
## NEVER be promoted to durable authority, never mint currency, stamina,
## inventory, hero ownership, claims, or receipts, and must never bind a
## tokenless local record to a backend account.

func read_local_envelope() -> Dictionary:
	push_error("ISaveCacheStore.read_local_envelope is abstract")
	return {}

func write_local_cache(_envelope: Dictionary) -> void:
	push_error("ISaveCacheStore.write_local_cache is abstract")

func clear_local_namespace() -> void:
	push_error("ISaveCacheStore.clear_local_namespace is abstract")
