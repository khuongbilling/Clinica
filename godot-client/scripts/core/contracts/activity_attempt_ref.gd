class_name ActivityAttemptRef
extends RefCounted
## Portable reference to a separately persisted activity attempt/receipt.
## Per docs/canonical-save-schema-contract.md §3.3, the player envelope may
## only reference attempt/receipt identity; it must never recreate the
## attempt or its reward from a cached summary.

var attempt_id: String = ""
var activity_id: String = ""
var receipt_id: String = ""

static func from_dict(data: Dictionary) -> ActivityAttemptRef:
	var ref := ActivityAttemptRef.new()
	ref.attempt_id = str(data.get("attempt_id", ""))
	ref.activity_id = str(data.get("activity_id", ""))
	ref.receipt_id = str(data.get("receipt_id", ""))
	return ref
