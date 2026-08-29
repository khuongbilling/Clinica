extends Control
## Deterministic, temporary loadout screen for the first playable slice.

const BATTLE_SCENE_PATH := "res://scenes/prologue/prologue_battle.tscn"

@onready var roster_label: Label = $Scroll/Margin/Content/Roster
@onready var encounter_label: Label = $Scroll/Margin/Content/Encounter
@onready var start_button: Button = $Scroll/Margin/Content/StartButton

func _ready() -> void:
	var lines: Array = []
	for hero in PrologueBattleRules.loadout():
		lines.append("%s  •  %s  •  %s" % [hero["name"], hero["role"], hero["skill_id"]])
	roster_label.text = "\n".join(lines)
	var encounter := PrologueBattleRules.encounter()
	encounter_label.text = "%s\n%s\nStarting stability: %d" % [
		encounter["name"],
		"Deterministic introductory clinical case",
		encounter["starting_stability"],
	]
	start_button.pressed.connect(_on_start_pressed)
	start_button.grab_focus()

func _on_start_pressed() -> void:
	Services.navigation.navigate_to("prologue_battle", {"encounter_id": PrologueBattleRules.FIRST_BATTLE_ID})
	get_tree().call_deferred("change_scene_to_file", BATTLE_SCENE_PATH)