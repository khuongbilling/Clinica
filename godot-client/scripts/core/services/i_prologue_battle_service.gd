class_name IPrologueBattleService
extends RefCounted
## Portable boundary for the temporary first-battle session.
##
## Implementations may render or translate this session, but must not turn it
## into durable progression, reward, stamina, inventory, or account state.

signal state_changed(snapshot: Dictionary)
signal battle_completed(snapshot: Dictionary)

func begin() -> Dictionary:
	push_error("IPrologueBattleService.begin is abstract")
	return {}

func perform_action(_action_id: String) -> Dictionary:
	push_error("IPrologueBattleService.perform_action is abstract")
	return {"ok": false, "reason": "not_implemented", "state": {}}

func snapshot() -> Dictionary:
	push_error("IPrologueBattleService.snapshot is abstract")
	return {}

func get_durable_write_count() -> int:
	push_error("IPrologueBattleService.get_durable_write_count is abstract")
	return -1

func get_durable_grant_count() -> int:
	push_error("IPrologueBattleService.get_durable_grant_count is abstract")
	return -1