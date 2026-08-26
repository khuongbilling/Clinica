class_name GodotLogger
extends ILogger
## Composition-edge logger. Wraps engine print/push_warning/push_error with
## a consistent tag/level prefix. No external telemetry is wired in M1-P1.

func debug(tag: String, message: String) -> void:
	print("[DEBUG][%s] %s" % [tag, message])

func info(tag: String, message: String) -> void:
	print("[INFO][%s] %s" % [tag, message])

func warn(tag: String, message: String) -> void:
	push_warning("[%s] %s" % [tag, message])

func error(tag: String, message: String) -> void:
	push_error("[%s] %s" % [tag, message])
