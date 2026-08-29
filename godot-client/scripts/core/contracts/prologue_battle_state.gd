class_name PrologueBattleState
extends RefCounted
## Session-only state for the first playable prologue battle.
##
## This is deliberately not a PlayerEnvelope, save record, or backend
## authority object. Battle AP and the displayed stamina baseline live here
## only for the duration of this presentation slice.

var phase: String = "loadout"
var battle_ap: int = 0
var max_battle_ap: int = 0
var persistent_stamina: int = 0
var enemy_stability: int = 0
var battle_completed: bool = false
var handoff_route: String = ""
var history: Array = []
var last_message: String = ""

func reset(max_ap: int, stamina_baseline: int, starting_stability: int) -> void:
	phase = "assess"
	battle_ap = max_ap
	max_battle_ap = max_ap
	persistent_stamina = stamina_baseline
	enemy_stability = starting_stability
	battle_completed = false
	handoff_route = ""
	history = []
	last_message = "Observe the patient before choosing an intervention."

func snapshot() -> Dictionary:
	return {
		"phase": phase,
		"battle_ap": battle_ap,
		"max_battle_ap": max_battle_ap,
		"persistent_stamina": persistent_stamina,
		"enemy_stability": enemy_stability,
		"battle_completed": battle_completed,
		"handoff_route": handoff_route,
		"history": history.duplicate(),
		"last_message": last_message,
	}