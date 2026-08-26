class_name PlayerEnvelope
extends RefCounted
## Portable data contract mirroring the frozen v3 envelope in
## docs/canonical-save-schema-contract.md §2. This is a plain data holder:
## it performs no I/O, grants no value, and is not itself a save adapter.

const SCHEMA_ID := "clinica.player"
const SAVE_VERSION := 3

var player_id: String = ""
var authoritative: Dictionary = {}
var local: Dictionary = {}

static func from_dict(data: Dictionary) -> PlayerEnvelope:
	var envelope := PlayerEnvelope.new()
	envelope.player_id = str(data.get("player_id", ""))
	envelope.authoritative = data.get("authoritative", {})
	envelope.local = data.get("local", {})
	return envelope

func to_dict() -> Dictionary:
	return {
		"schema_id": SCHEMA_ID,
		"save_version": SAVE_VERSION,
		"player_id": player_id,
		"authoritative": authoritative,
		"local": local,
	}

func is_structurally_valid() -> bool:
	return player_id != ""
