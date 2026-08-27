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

## M1-P2: reads the raw local cache (if any) and runs it through
## PlayerSaveMigration.migrate(). Never writes as a side effect — callers
## decide whether/how to persist the result (see
## `write_migrated_cache`/`write_quarantine` below).
func read_and_migrate() -> MigrationOutcome:
	push_error("ISaveCacheStore.read_and_migrate is abstract")
	return null

## M1-P2: persists an already-migrated/accepted canonical v3 envelope. This
## is a cache rewrite, not a reward/authority mutation (ledger §4).
func write_migrated_cache(_envelope: PlayerEnvelope) -> void:
	push_error("ISaveCacheStore.write_migrated_cache is abstract")

## M1-P2: preserves a quarantined (unknown-future-version or malformed)
## record in a namespace fully separate from the normal cache, so it is
## never confused with, mixed into, or silently overwritten by valid
## envelope data (contract §7 / ledger §5).
func write_quarantine(_outcome: MigrationOutcome) -> void:
	push_error("ISaveCacheStore.write_quarantine is abstract")

## M1-P2: reads back the quarantine namespace (empty Dictionary if none).
func read_quarantine() -> Dictionary:
	push_error("ISaveCacheStore.read_quarantine is abstract")
	return {}
