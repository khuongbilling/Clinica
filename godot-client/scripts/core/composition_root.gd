extends Node
## Composition root ("Services" autoload).
##
## This is the ONLY place in the project that wires concrete adapters
## (engine-specific) to the portable interfaces declared under
## scripts/core/services/. Scenes and future gameplay/presentation code must
## depend only on the interface-typed properties exposed here, never
## construct adapters directly, so the engine-specific edge stays small and
## swappable (and portable toward a future Unity port if ever needed).
##
## Scope note (M1-P1): this is a foundation skeleton. It does not implement
## real authentication, reward settlement, or gameplay. See
## godot-client/docs/MIGRATION.md for authority boundaries.

const GodotLoggerScript = preload("res://scripts/adapters/logging/godot_logger.gd")
const ErrorReporterScript = preload("res://scripts/adapters/errors/error_reporter.gd")
const EnvConfigProviderScript = preload("res://scripts/adapters/config/env_config_provider.gd")
const GodotNavigationServiceScript = preload("res://scripts/adapters/navigation/godot_navigation_service.gd")
const AppStateServiceScript = preload("res://scripts/adapters/state/app_state_service.gd")
const LocalSaveCacheAdapterScript = preload("res://scripts/adapters/storage/local_save_cache_adapter.gd")
const HttpApiTransportScript = preload("res://scripts/adapters/api/http_api_transport.gd")
const FixtureValidatorAdapterScript = preload("res://scripts/adapters/validation/fixture_validator_adapter.gd")
const CutscenePlaybackServiceScript = preload("res://scripts/adapters/cutscene/cutscene_playback_service.gd")

var logger
var error_reporter
var config
var navigation
var app_state
var save_cache
var api_transport
var fixture_validator
var cutscene

func _ready() -> void:
	logger = GodotLoggerScript.new()
	error_reporter = ErrorReporterScript.new(logger)
	config = EnvConfigProviderScript.new()
	navigation = GodotNavigationServiceScript.new(self)
	app_state = AppStateServiceScript.new()
	save_cache = LocalSaveCacheAdapterScript.new(logger)

	var http_request := HTTPRequest.new()
	add_child(http_request)
	api_transport = HttpApiTransportScript.new(http_request, config, logger)

	fixture_validator = FixtureValidatorAdapterScript.new()
	cutscene = CutscenePlaybackServiceScript.new(logger)

	logger.info("composition_root", "Services composed for M1-P1 skeleton.")
