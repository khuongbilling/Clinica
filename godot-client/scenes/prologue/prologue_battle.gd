extends Control
## Presentation/controller for the five-beat M2-P2 teaching loop.
##
## All action resolution belongs to Services.prologue_battle. This scene
## only renders the session snapshot and routes the completed case onward.

const HANDOFF_SCENE_PATH := "res://scenes/prologue/prologue_handoff.tscn"

@onready var phase_label: Label = $Scroll/Margin/Content/Phase
@onready var status_label: Label = $Scroll/Margin/Content/Status
@onready var ap_label: Label = $Scroll/Margin/Content/Resources
@onready var assess_button: Button = $Scroll/Margin/Content/Actions/Assess
@onready var prioritize_button: Button = $Scroll/Margin/Content/Actions/Prioritize
@onready var intervene_button: Button = $Scroll/Margin/Content/Actions/Intervene
@onready var reassess_button: Button = $Scroll/Margin/Content/Actions/Reassess
@onready var final_action_button: Button = $Scroll/Margin/Content/Actions/FinalAction
@onready var handoff_button: Button = $Scroll/Margin/Content/Handoff

var _last_snapshot: Dictionary = {}

func _ready() -> void:
	Services.prologue_battle.state_changed.connect(_on_state_changed)
	Services.prologue_battle.battle_completed.connect(_on_battle_completed)
	handoff_button.pressed.connect(_on_handoff_pressed)
	_wire_action(assess_button, "assess")
	_wire_action(prioritize_button, "prioritize")
	_wire_action(intervene_button, "intervene")
	_wire_action(reassess_button, "reassess")
	_wire_action(final_action_button, "final_action")
	_last_snapshot = Services.prologue_battle.begin()
	_render(_last_snapshot)
	assess_button.grab_focus()

func _wire_action(button: Button, action_id: String) -> void:
	button.pressed.connect(func() -> void:
		_on_action_pressed(action_id)
	)

func _on_action_pressed(action_id: String) -> void:
	var result: Dictionary = Services.prologue_battle.perform_action(action_id)
	if not result.get("ok", false):
		status_label.text = str(result.get("reason", "Action unavailable"))

func _on_state_changed(snapshot: Dictionary) -> void:
	_last_snapshot = snapshot
	_render(snapshot)

func _on_battle_completed(_snapshot: Dictionary) -> void:
	handoff_button.visible = true
	handoff_button.grab_focus()

func _render(snapshot: Dictionary) -> void:
	var phase := str(snapshot.get("phase", "unknown"))
	phase_label.text = "CARE PATHWAY  •  %s" % phase.to_upper()
	status_label.text = str(snapshot.get("last_message", ""))
	ap_label.text = "Battle AP: %d / %d     Persistent stamina: %d (unchanged)" % [
		int(snapshot.get("battle_ap", 0)),
		int(snapshot.get("max_battle_ap", 0)),
		int(snapshot.get("persistent_stamina", 0)),
	]
	assess_button.disabled = phase != "assess"
	prioritize_button.disabled = phase != "prioritize"
	intervene_button.disabled = phase != "intervene"
	reassess_button.disabled = phase != "reassess"
	final_action_button.disabled = phase != PrologueBattleRules.FINAL_ACTION_ID
	handoff_button.visible = bool(snapshot.get("battle_completed", false))

func _on_handoff_pressed() -> void:
	Services.navigation.navigate_to("prologue_handoff")
	get_tree().call_deferred("change_scene_to_file", HANDOFF_SCENE_PATH)