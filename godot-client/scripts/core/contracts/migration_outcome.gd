class_name MigrationOutcome
extends RefCounted
## Pure result of PlayerSaveMigration.migrate() (see
## scripts/core/migration/player_save_migration.gd).
##
## Exactly one of the two result shapes is meaningful for a given `action`:
## - "accept" / "migrate": `envelope` holds the canonical v3 PlayerEnvelope.
## - "quarantine": `quarantine_reason` explains why, and `raw_preserved` is
##   the original input, preserved byte-for-byte (never rewritten,
##   downgraded, or partially patched). See
##   docs/canonical-save-schema-contract.md §7 and
##   docs/save-schema-migration-ledger.md §5.

const ACTION_ACCEPT := "accept"
const ACTION_MIGRATE := "migrate"
const ACTION_QUARANTINE := "quarantine"

var action: String = ""
var save_version: int = -1
var envelope: PlayerEnvelope = null
var quarantine_reason: String = ""
var raw_preserved: Variant = null

func is_usable() -> bool:
	return action == ACTION_ACCEPT or action == ACTION_MIGRATE

func to_dict() -> Dictionary:
	var result := {"action": action}
	if save_version >= 0:
		result["save_version"] = save_version
	if envelope != null:
		result["envelope"] = envelope.to_dict()
	if action == ACTION_QUARANTINE:
		result["quarantine_reason"] = quarantine_reason
		result["raw_preserved"] = raw_preserved
	return result
