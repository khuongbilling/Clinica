extends Control
## Clean, explicitly non-rewarding post-battle handoff placeholder.

@onready var return_button: Button = $Scroll/Margin/Content/ReturnButton

func _ready() -> void:
	return_button.pressed.connect(_on_return_pressed)
	return_button.grab_focus()

func _on_return_pressed() -> void:
	Services.navigation.navigate_to("app_shell")
	get_tree().call_deferred("change_scene_to_file", "res://scenes/app_shell/app_shell.tscn")