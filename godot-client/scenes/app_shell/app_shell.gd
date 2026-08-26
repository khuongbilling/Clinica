extends Control
## First presentation surface. Displays composition-root status only.
## Presentation-only: this screen has no gameplay, save, or reward authority.

@onready var status_label: Label = $StatusLabel

func _ready() -> void:
	var debug_build: bool = Services.config.is_debug()
	var text := "Clinica Godot Client — M1-P1 Skeleton\n"
	text += "Engine-independent foundation. See godot-client/docs/MIGRATION.md.\n"
	text += "Debug build: %s" % str(debug_build)
	status_label.text = text
	Services.logger.info("app_shell", "AppShell ready.")
