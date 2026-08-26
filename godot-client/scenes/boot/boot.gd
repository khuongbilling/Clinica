extends Node
## Boot scene: composition-root wiring entry point.
##
## This scene is intentionally minimal. It contains no gameplay, cinematic,
## or authority logic. It confirms the composition root (the `Services`
## autoload) is available, then hands off to the AppShell scene, which is
## the first presentation surface.
##
## Per docs/canonical-gameplay-contract.md and
## docs/canonical-backend-api-authority-contract.md, this client must never
## promote local state, scene outcomes, or client reducers into durable
## account/reward authority. Everything in this file is
## presentation/composition only.

func _ready() -> void:
	Services.logger.info("boot", "Clinica Godot client skeleton booting (M1-P1).")
	if Services.fixture_validator == null:
		Services.error_reporter.report("boot.services_missing", {"detail": "Composition root services unavailable"})
	Services.navigation.navigate_to("app_shell")
	# Deferred: changing scenes synchronously from within this scene's own
	# _ready() can race the SceneTree's own add/remove bookkeeping for the
	# node that is still entering the tree (observed as a real headless-boot
	# error under Godot 4.4.1). Deferring to the next idle frame is the
	# engine's documented pattern for scene changes triggered from _ready().
	get_tree().call_deferred("change_scene_to_file", "res://scenes/app_shell/app_shell.tscn")
