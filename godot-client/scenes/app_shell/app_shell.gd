extends Control
## First presentation surface and the M2-P2 prologue entry bridge.
## Presentation-only: this screen has no durable gameplay, save, or reward
## authority.

@onready var status_label: Label = $StatusLabel
@onready var start_button: Button = $StartPrologueButton

func _ready() -> void:
	var debug_build: bool = Services.config.is_debug()
	var text := "Clinica Godot Client — M1-P1 Skeleton\n"
	text += "Engine-independent foundation. See godot-client/docs/MIGRATION.md.\n"
	text += "Debug build: %s\n" % str(debug_build)
	text += "M2-P2: temporary clinical teaching case"
	status_label.text = text
	start_button.pressed.connect(_on_start_prologue_pressed)
	Services.logger.info("app_shell", "AppShell ready.")

func _on_start_prologue_pressed() -> void:
	Services.navigation.navigate_to("prologue_loadout")
	get_tree().call_deferred("change_scene_to_file", "res://scenes/prologue/prologue_loadout.tscn")
