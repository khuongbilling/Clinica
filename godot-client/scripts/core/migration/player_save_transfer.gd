class_name PlayerSaveTransfer
extends RefCounted
## Safe, engine-neutral import/export boundary for the `clinica.player`
## envelope, for future Replit -> Godot and Godot -> Unity transfer.
##
## This is deliberately a thin wrapper around `PlayerSaveMigration` (the one
## migration/validation code path — see that file's header) plus a
## defensive credential redaction step. It intentionally produces and
## consumes only the plain, portable Dictionary/JSON shape described in
## docs/canonical-save-schema-contract.md — never a Godot-specific
## serialized `Resource` (`.tres`/`.res`/`ResourceSaver`/`ResourceLoader`).
## A Godot binary resource must never become the canonical save; any
## engine (Replit/TS, Godot, a future Unity client) must be able to read
## and write this same JSON-compatible shape.

## Import: identical code path to a local-cache read. There is exactly one
## migration/validation implementation; import does not get a parallel one.
static func import_from_transfer(raw: Variant) -> MigrationOutcome:
	return PlayerSaveMigration.migrate(raw)

## Export: canonical v3 dict, with any transport/session-credential-shaped
## keys redacted per docs/canonical-save-schema-contract.md §3.5 ("Opaque
## session credentials... must not be treated as player value or migration
## authority. Exports should omit or redact them."). The current envelope
## model carries no such fields, so this is a defensive guard against a
## future caller accidentally stuffing one into `authoritative`/`local`.
const REDACTED_KEYS := [
	"economy_token", "session_token", "auth_token", "access_token",
	"refresh_token", "credential", "credentials", "password", "api_key",
]

static func export_for_transfer(envelope: PlayerEnvelope) -> Dictionary:
	var out := envelope.to_dict()
	out["authoritative"] = _redact(out.get("authoritative", {}))
	out["local"] = _redact(out.get("local", {}))
	return out

static func _redact(section: Dictionary) -> Dictionary:
	var copy: Dictionary = section.duplicate(true)
	for key in REDACTED_KEYS:
		if copy.has(key):
			copy.erase(key)
	return copy
