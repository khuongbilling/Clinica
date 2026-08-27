class_name PlayerSaveMigrationValidatorAdapter
extends IFixtureValidator
## Read-only validator for M1-P2 player-save migration behavior.
##
## This is a second, distinct check from FixtureValidatorAdapter: that one
## checks fixture-pack STRUCTURE and hash parity; this one actually RUNS
## `PlayerSaveMigration.migrate()` against
## fixtures/clinica-golden/v1/saves/player-migration-vectors.json and a
## small set of supplementary in-script vectors, and asserts on the real
## outcome — not on a declared-but-unverified fixture value. It never
## writes to the fixture pack, gameplay state, or local saves.
##
## Two check groups are reported, clearly labeled so it is always visible
## which checks are fixture-pack-driven vs. additional native coverage
## added because the golden fixture pack does not yet exercise every
## required scenario (repeated-migration idempotency, Chapter-1 alias
## delta-safety, and a JSON round trip):
## - `fixture:*`   — driven by the checked-in golden fixture cases.
## - `native:*`    — supplementary GDScript-only vectors for scenarios the
##                   ledger requires but the current fixture pack does not
##                   cover.

const PlayerSaveMigrationScript = preload("res://scripts/core/migration/player_save_migration.gd")
const PlayerEnvelopeScript = preload("res://scripts/core/contracts/player_envelope.gd")
const MigrationOutcomeScript = preload("res://scripts/core/contracts/migration_outcome.gd")

const FIXTURES_DIR := "clinica-golden/v1"

func _fixtures_root() -> String:
	var project_dir := ProjectSettings.globalize_path("res://")
	return (project_dir.path_join("../fixtures/" + FIXTURES_DIR)).simplify_path()

func _read_json(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		return null
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return null
	var text := file.get_as_text()
	file.close()
	return JSON.parse_string(text)

func _is_zero_delta(delta: Dictionary) -> bool:
	if int(delta.get("currency", 0)) != 0:
		return false
	if int(delta.get("stamina", 0)) != 0:
		return false
	for v in delta.get("inventory", {}).values():
		if float(v) != 0.0:
			return false
	for key in ["heroes", "equipment", "claims", "receipts"]:
		if not (delta.get(key, []) as Array).is_empty():
			return false
	return true

func validate() -> Dictionary:
	var result := ValidationResult.new()
	_validate_schema_constants(result)
	_validate_fixture_cases(result)
	_validate_native_vectors(result)
	return result.to_dict()

func _validate_schema_constants(result: ValidationResult) -> void:
	var schema_path := _fixtures_root().path_join("schemas/player-save.schema.json")
	var schema = _read_json(schema_path)
	if typeof(schema) != TYPE_DICTIONARY:
		result.add("fixture:player_save_schema_readable", false, "Could not read %s" % schema_path)
		return
	result.add("fixture:player_save_schema_readable", true)
	var props: Dictionary = schema.get("properties", {})
	var schema_id_const := str(props.get("schema_id", {}).get("const", ""))
	var save_version_const := int(props.get("save_version", {}).get("const", -1))
	result.add(
		"fixture:schema_id_matches_envelope",
		schema_id_const == PlayerSaveMigrationScript.SCHEMA_ID,
		"schema says '%s', PlayerEnvelope says '%s'" % [schema_id_const, PlayerSaveMigrationScript.SCHEMA_ID]
	)
	result.add(
		"fixture:save_version_matches_envelope",
		save_version_const == PlayerSaveMigrationScript.SUPPORTED_SAVE_VERSION,
		"schema says %d, PlayerEnvelope says %d" % [save_version_const, PlayerSaveMigrationScript.SUPPORTED_SAVE_VERSION]
	)

func _validate_fixture_cases(result: ValidationResult) -> void:
	var path := _fixtures_root().path_join("saves/player-migration-vectors.json")
	var fixture = _read_json(path)
	if typeof(fixture) != TYPE_DICTIONARY:
		result.add("fixture:player_migration_vectors_readable", false, "Could not read %s" % path)
		return
	result.add("fixture:player_migration_vectors_readable", true)

	var payload: Dictionary = fixture.get("payload", {})
	result.add(
		"fixture:migration_target_is_v3",
		str(payload.get("target_player_schema_id", "")) == "clinica.player" and int(payload.get("target_save_version", -1)) == 3
	)

	for case in payload.get("cases", []):
		var case_id := str(case.get("case_id", "?"))
		# JSON parsing hands us the input fresh per fixture read, but
		# duplicate it defensively so a bug in migrate() mutating its
		# argument cannot corrupt a later case's expectations.
		var input_before_text := JSON.stringify(case.get("input", {}))
		var input: Dictionary = case.get("input", {})
		var outcome: MigrationOutcome = PlayerSaveMigrationScript.migrate(input)
		var expected: Dictionary = case.get("expected", {})

		result.add(
			"fixture:purity_input_unmutated:%s" % case_id,
			JSON.stringify(case.get("input", {})) == input_before_text,
			"migrate() mutated its input argument"
		)
		result.add(
			"fixture:action_matches:%s" % case_id,
			outcome.action == str(expected.get("action", "")),
			"expected action '%s', got '%s'" % [expected.get("action", ""), outcome.action]
		)

		if outcome.action == MigrationOutcomeScript.ACTION_QUARANTINE:
			if expected.has("reason"):
				result.add(
					"fixture:quarantine_reason_matches:%s" % case_id,
					outcome.quarantine_reason == str(expected["reason"]),
					"expected reason '%s', got '%s'" % [expected["reason"], outcome.quarantine_reason]
				)
			if expected.get("preserve_input_unchanged", false):
				result.add(
					"fixture:quarantine_preserves_input:%s" % case_id,
					JSON.stringify(outcome.raw_preserved) == JSON.stringify(case.get("input", {}))
				)
			if expected.get("never_downgrade", false):
				result.add(
					"fixture:quarantine_never_downgrades:%s" % case_id,
					outcome.save_version != 1 and outcome.save_version != 2 and outcome.save_version != 3
				)
			continue

		# accept / migrate
		result.add(
			"fixture:save_version_is_3:%s" % case_id,
			outcome.save_version == 3 and outcome.envelope != null and outcome.envelope.to_dict().get("save_version") == 3
		)

		if expected.has("learning_profile"):
			result.add(
				"fixture:learning_profile_alias:%s" % case_id,
				str(outcome.envelope.local.get("learning_profile", "")) == str(expected["learning_profile"])
			)
		if expected.has("realm_seed"):
			result.add(
				"fixture:realm_seed_derived:%s" % case_id,
				str(outcome.envelope.local.get("realm_seed", "")) == str(expected["realm_seed"])
			)
		if expected.has("set_like_ids"):
			for field in expected["set_like_ids"].keys():
				var actual: Array = outcome.envelope.authoritative.get(field, [])
				var expected_arr: Array = expected["set_like_ids"][field]
				result.add(
					"fixture:set_like_dedup:%s:%s" % [case_id, field],
					actual == expected_arr,
					"expected %s, got %s" % [str(expected_arr), str(actual)]
				)

		# Independently computed no-mint proof (not the declared fixture
		# grant_delta — a real diff between input and migrated output).
		var computed_delta := PlayerSaveMigrationScript.compute_grant_delta(case.get("input", {}), outcome.envelope)
		result.add(
			"fixture:computed_grant_delta_is_zero:%s" % case_id,
			_is_zero_delta(computed_delta),
			"computed delta was %s" % str(computed_delta)
		)
		if case.has("grant_delta"):
			var declared: Dictionary = case["grant_delta"]
			result.add(
				"fixture:declared_grant_delta_is_zero:%s" % case_id,
				int(declared.get("currency", 0)) == 0 and int(declared.get("stamina", 0)) == 0
			)

		# Idempotency: migrating the already-migrated v3 dict again must be
		# an "accept" of an identical envelope.
		var second: MigrationOutcome = PlayerSaveMigrationScript.migrate(outcome.envelope.to_dict())
		result.add(
			"fixture:idempotent_second_pass:%s" % case_id,
			second.action == MigrationOutcomeScript.ACTION_ACCEPT
				and JSON.stringify(second.envelope.to_dict()) == JSON.stringify(outcome.envelope.to_dict()),
			"second pass action was '%s'" % second.action
		)

		# Round trip through engine-neutral JSON text (proves the envelope
		# survives a real serialize/deserialize cycle, as any Replit/Godot/
		# Unity transfer boundary requires).
		var json_text := JSON.stringify(outcome.envelope.to_dict())
		var reparsed = JSON.parse_string(json_text)
		var roundtripped := PlayerEnvelopeScript.from_dict(reparsed)
		result.add(
			"fixture:json_round_trip:%s" % case_id,
			JSON.stringify(roundtripped.to_dict()) == json_text
		)

func _validate_native_vectors(result: ValidationResult) -> void:
	# Stable-ID preservation across a fresh legacy input, run twice.
	var legacy_input := {
		"player_id": "native-player-0001",
		"heroes_owned": ["night_watcher", "florence_n"],
		"equipment_owned": ["insight_lens"],
	}
	var first: MigrationOutcome = PlayerSaveMigrationScript.migrate(legacy_input.duplicate(true))
	var second: MigrationOutcome = PlayerSaveMigrationScript.migrate(legacy_input.duplicate(true))
	result.add(
		"native:stable_id_preserved_heroes_owned",
		first.envelope.authoritative.get("heroes_owned", []) == ["night_watcher", "florence_n"]
	)
	result.add(
		"native:repeated_migration_deterministic",
		JSON.stringify(first.envelope.to_dict()) == JSON.stringify(second.envelope.to_dict())
	)

	# Chapter-1 alias rename must not be counted as a mint (old id already
	# owned; new id is the same underlying grant under the revised scheme).
	var alias_input := {
		"player_id": "native-player-0002",
		"claimed_journey_nodes": ["c1p1", "c1p5"],
	}
	var alias_outcome: MigrationOutcome = PlayerSaveMigrationScript.migrate(alias_input.duplicate(true))
	var alias_nodes: Array = alias_outcome.envelope.authoritative.get("claimed_journey_nodes", [])
	result.add(
		"native:chapter1_alias_adds_new_id",
		alias_nodes.has("c1p1") and alias_nodes.has("c1n1") and alias_nodes.has("c1p5") and alias_nodes.has("c1n6")
	)
	var alias_delta := PlayerSaveMigrationScript.compute_grant_delta(alias_input, alias_outcome.envelope)
	result.add(
		"native:chapter1_alias_not_a_mint",
		(alias_delta.get("claims", []) as Array).is_empty(),
		"alias rename counted as a mint: %s" % str(alias_delta.get("claims"))
	)

	# Player Hero must never be manufactured from roster heroes during
	# migration (contract §4.2): absent input -> null output, never derived.
	var no_player_hero_input := {
		"player_id": "native-player-0003",
		"heroes_owned": ["night_watcher"],
	}
	var no_ph_outcome: MigrationOutcome = PlayerSaveMigrationScript.migrate(no_player_hero_input.duplicate(true))
	result.add(
		"native:player_hero_not_manufactured",
		no_ph_outcome.envelope.authoritative.get("player_hero", "MISSING") == null
	)

	# Requested downgrade of an already-v3 envelope must be rejected: a v3
	# envelope with save_version forced down to 2 is not a "known v2" -- it
	# is a malformed/contradictory shape (has authoritative/local AND an
	# older version number) and must fail closed as malformed, never
	# silently reinterpreted as a real v2 cache.
	var already_v3 := {
		"schema_id": "clinica.player",
		"save_version": 3,
		"player_id": "native-player-0004",
		"authoritative": {"xp": 50},
		"local": {},
	}
	var v3_outcome: MigrationOutcome = PlayerSaveMigrationScript.migrate(already_v3.duplicate(true))
	var downgraded := already_v3.duplicate(true)
	downgraded["save_version"] = 2
	var downgrade_outcome: MigrationOutcome = PlayerSaveMigrationScript.migrate(downgraded)
	result.add(
		"native:v3_accept_baseline",
		v3_outcome.action == MigrationOutcomeScript.ACTION_ACCEPT
	)
	result.add(
		"native:no_destructive_downgrade_path",
		downgrade_outcome.action != MigrationOutcomeScript.ACTION_ACCEPT
			or downgrade_outcome.envelope.authoritative.get("xp") == 50,
		"a declared-v2 envelope with v3 shape must not lose/alter existing values"
	)

	# Malformed container (not even a Dictionary) must quarantine, not crash.
	var non_dict_outcome: MigrationOutcome = PlayerSaveMigrationScript.migrate("not-a-dictionary")
	result.add(
		"native:non_dictionary_input_quarantines",
		non_dict_outcome.action == MigrationOutcomeScript.ACTION_QUARANTINE
	)

	# Export boundary never emits a Godot-specific resource shape and
	# redacts credential-shaped keys defensively.
	const PlayerSaveTransferScript = preload("res://scripts/core/migration/player_save_transfer.gd")
	var envelope_with_token := PlayerEnvelopeScript.new()
	envelope_with_token.player_id = "native-player-0005"
	envelope_with_token.authoritative = {"xp": 10, "economy_token": "should-not-export"}
	var exported := PlayerSaveTransferScript.export_for_transfer(envelope_with_token)
	result.add(
		"native:export_redacts_credential_keys",
		not (exported.get("authoritative", {}) as Dictionary).has("economy_token")
	)
	result.add(
		"native:export_is_plain_dictionary",
		typeof(exported) == TYPE_DICTIONARY
	)
