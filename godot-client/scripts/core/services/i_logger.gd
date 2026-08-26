class_name ILogger
extends RefCounted
## Portable structured logging contract.

func debug(_tag: String, _message: String) -> void:
	pass

func info(_tag: String, _message: String) -> void:
	pass

func warn(_tag: String, _message: String) -> void:
	pass

func error(_tag: String, _message: String) -> void:
	pass
