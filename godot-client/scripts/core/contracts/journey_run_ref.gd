class_name JourneyRunRef
extends RefCounted
## Portable reference to a separately persisted Journey run record.
## Per docs/canonical-save-schema-contract.md §3.2, the player envelope may
## only reference Journey runs; it must never duplicate run authority.

const SCHEMA_VERSION := 2

var id: String = ""
var chapter_id: String = ""
var attempt_number: int = 0

static func from_dict(data: Dictionary) -> JourneyRunRef:
	var ref := JourneyRunRef.new()
	ref.id = str(data.get("id", ""))
	ref.chapter_id = str(data.get("chapter_id", ""))
	ref.attempt_number = int(data.get("attempt_number", 0))
	return ref
