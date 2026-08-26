class_name IErrorReporter
extends RefCounted
## Portable error-reporting contract. M1-P1 scope keeps this local/structured
## only; wiring a real crash/telemetry backend is later migration work.

func report(_code: String, _context: Dictionary = {}) -> void:
	push_error("IErrorReporter.report is abstract")
