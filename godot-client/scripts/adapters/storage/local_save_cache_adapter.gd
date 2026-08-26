class_name LocalSaveCacheAdapter
extends ISaveCacheStore
## Composition-edge local cache adapter.
##
## Uses a Godot `user://` namespace entirely separate from the existing
## Expo client's `clinica.player.v2` AsyncStorage key — no shared storage,
## no collision. Per the Godot/Unity rule in
## docs/canonical-backend-api-authority-contract.md §1, this cache must
## never be promoted to durable authority: it must not mint currency,
## stamina, inventory, hero ownership, claims, or receipts, and must never
## bind a tokenless local record to a backend account.

const CACHE_PATH := "user://godot_client_local_cache.json"

var _logger

func _init(logger) -> void:
	_logger = logger

func read_local_envelope() -> Dictionary:
	if not FileAccess.file_exists(CACHE_PATH):
		return {}
	var file := FileAccess.open(CACHE_PATH, FileAccess.READ)
	if file == null:
		_logger.warn("local_save_cache_adapter", "Failed to open local cache for read.")
		return {}
	var text := file.get_as_text()
	file.close()
	var parsed = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		return {}
	return parsed

func write_local_cache(envelope: Dictionary) -> void:
	var file := FileAccess.open(CACHE_PATH, FileAccess.WRITE)
	if file == null:
		_logger.warn("local_save_cache_adapter", "Failed to open local cache for write.")
		return
	file.store_string(JSON.stringify(envelope))
	file.close()

func clear_local_namespace() -> void:
	if FileAccess.file_exists(CACHE_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(CACHE_PATH))
