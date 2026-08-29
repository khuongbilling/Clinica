class_name PrologueBattleRules
extends RefCounted
## Deterministic, engine-independent rules for the bounded M2-P2 slice.
##
## The arithmetic below is intentionally the same ordering represented by
## fixtures/clinica-golden/v1/gameplay/battle-clinical-vectors.json. This is
## not a second progression or reward system: it contains only the portable
## first-battle session and the frozen clinical calculators needed to prove
## parity with the existing contract.

const FIRST_BATTLE_ID := "silent_infarction_intro"
const FINAL_ACTION_ID := "final_action"
const MAX_BATTLE_AP := 4
const PERSISTENT_STAMINA_BASELINE := 100
const STARTING_ENEMY_STABILITY := 70

const LOADOUT: Array = [
	{"id": "prologue_nightingale", "name": "Florence Nightingale", "role": "Assessor", "skill_id": "lantern_of_clues"},
	{"id": "prologue_fleming", "name": "Alexander Fleming", "role": "Stabilizer", "skill_id": "guardians_touch"},
	{"id": "prologue_former_self", "name": "The Prodigy", "role": "Reassessor", "skill_id": "reassess"},
]

const ENCOUNTER: Dictionary = {
	"id": FIRST_BATTLE_ID,
	"name": "Silent Infarction",
	"kind": "introductory_clinical_case",
	"starting_stability": STARTING_ENEMY_STABILITY,
	"final_action_id": FINAL_ACTION_ID,
}

static func loadout() -> Array:
	return LOADOUT.duplicate(true)

static func encounter() -> Dictionary:
	return ENCOUNTER.duplicate(true)

static func round_positive(value: float) -> int:
	return int(floor(value + 0.5))

static func calculate_strike(base: float, element_bonus: float, clinical_mod: float, affinity_family_mod: float) -> int:
	return round_positive(base * (1.0 + element_bonus) * clinical_mod * affinity_family_mod)

static func calculate_stabilize(base: float, clinical_mod: float, cue_bonus_flat: float, stability_gain_mod: float, enemy_resistance_mod: float) -> int:
	# Canonical ordering: base clinical effect, then the flat cue, then
	# patient modifiers (diminishing gain and enemy resistance).
	return round_positive((base * clinical_mod + cue_bonus_flat) * stability_gain_mod * enemy_resistance_mod)

static func resolve_shield(incoming_stability_damage: float, shield_percent: float, stability_before: float) -> Dictionary:
	var blocked_damage := round_positive(incoming_stability_damage * shield_percent / 100.0)
	var stability_after := round_positive(stability_before - (incoming_stability_damage - blocked_damage))
	return {"blocked_damage": blocked_damage, "stability_after": stability_after}

static func resolve_action(state: PrologueBattleState, action_id: String) -> Dictionary:
	if state.battle_completed:
		return {"ok": false, "reason": "battle_already_complete", "state": state.snapshot()}

	match action_id:
		"assess":
			if state.phase != "assess":
				return _invalid_action(state, "Assessment must come first.")
			state.phase = "prioritize"
			state.history.append("assess")
			state.last_message = "Assessment complete. Identify the priority before intervening."
		"prioritize":
			if state.phase != "prioritize":
				return _invalid_action(state, "Prioritize the observed risk before intervening.")
			state.phase = "intervene"
			state.history.append("prioritize")
			state.last_message = "Priority set: stabilize first, then verify the response."
		"intervene":
			if state.phase != "intervene":
				return _invalid_action(state, "Complete assessment and prioritization first.")
			if state.battle_ap < 1:
				return _invalid_action(state, "Not enough battle AP.")
			state.battle_ap -= 1
			var stabilization := calculate_stabilize(20.0, 1.0, 8.0, 0.5, 1.0)
			state.enemy_stability = min(100, state.enemy_stability + stabilization)
			state.phase = "reassess"
			state.history.append("intervene")
			state.last_message = "Intervention applied for %d stability. Reassess before finishing." % stabilization
		"reassess":
			if state.phase != "reassess":
				return _invalid_action(state, "Intervene before reassessing the response.")
			state.history.append("reassess")
			state.phase = FINAL_ACTION_ID
			state.last_message = "Reassessment confirms a safe response. Take the final action to close the case."
		"final_action":
			if state.phase != FINAL_ACTION_ID:
				return _invalid_action(state, "Reassess the response before taking the final action.")
			state.battle_completed = true
			state.phase = "complete"
			state.handoff_route = "prologue_handoff"
			state.history.append(FINAL_ACTION_ID)
			state.last_message = "Final action recorded. The teaching case is ready for handoff."
			return {"ok": true, "action": action_id, "effect": 0, "state": state.snapshot()}
		_:
			return _invalid_action(state, "That action is not part of this introductory case.")

	return {"ok": true, "action": action_id, "state": state.snapshot()}

static func _invalid_action(state: PrologueBattleState, reason: String) -> Dictionary:
	return {"ok": false, "reason": reason, "state": state.snapshot()}