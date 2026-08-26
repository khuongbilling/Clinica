class_name EnvConfigProvider
extends IConfigProvider
## Composition-edge configuration adapter. No secrets are embedded here; a
## real backend base URL must be supplied via environment/build
## configuration at a later migration stage, never hardcoded, per
## docs/canonical-backend-api-authority-contract.md §10.

func get_backend_base_url() -> String:
	return OS.get_environment("CLINICA_BACKEND_URL")

func is_debug() -> bool:
	return OS.is_debug_build()
