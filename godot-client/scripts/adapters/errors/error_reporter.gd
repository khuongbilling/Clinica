class_name ErrorReporter
extends IErrorReporter
## Composition-edge error reporter. M1-P1 scope: structured local records
## only; no external crash/telemetry backend is wired.

const MAX_RECENT := 50

var _logger
var _recent: Array = []

func _init(logger) -> void:
	_logger = logger

func report(code: String, context: Dictionary = {}) -> void:
	var record := {"code": code, "context": context}
	_recent.append(record)
	if _recent.size() > MAX_RECENT:
		_recent.pop_front()
	_logger.error("error_reporter", "%s %s" % [code, JSON.stringify(context)])

func recent() -> Array:
	return _recent.duplicate()
