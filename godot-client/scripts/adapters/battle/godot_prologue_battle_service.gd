class_name GodotPrologueBattleService
extends IPrologueBattleService
## Godot composition-edge adapter for the session-only prologue battle.
##
## It owns no save/cache/API reference and intentionally exposes no mutation
## method other than the five local teaching actions.

var _state := PrologueBattleState.new()
var _durable_write_count: int = 0
var _durable_grant_count: int = 0

func begin() -> Dictionary:
	_state.reset(
		PrologueBattleRules.MAX_BATTLE_AP,
		PrologueBattleRules.PERSISTENT_STAMINA_BASELINE,
		PrologueBattleRules.STARTING_ENEMY_STABILITY
	)
	var snapshot := _state.snapshot()
	state_changed.emit(snapshot)
	return snapshot

func perform_action(action_id: String) -> Dictionary:
	var result := PrologueBattleRules.resolve_action(_state, action_id)
	if result.get("ok", false):
		state_changed.emit(result["state"])
		if _state.battle_completed:
			battle_completed.emit(result["state"])
	return result

func snapshot() -> Dictionary:
	return _state.snapshot()

func get_durable_write_count() -> int:
	return _durable_write_count

func get_durable_grant_count() -> int:
	return _durable_grant_count