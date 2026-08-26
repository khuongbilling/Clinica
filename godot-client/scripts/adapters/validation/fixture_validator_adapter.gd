class_name FixtureValidatorAdapter
extends IFixtureValidator
## Read-only validator for fixtures/clinica-golden/v1/.
##
## Scope and honesty notes:
## - This validator NEVER writes to the fixture pack, gameplay state, or
##   saves. It only reads JSON already checked into the repository.
## - It performs structural/referential checks (envelope shape, authority
##   enum, stable schema/version fields, a handful of cross-references)
##   that mirror fixtures/clinica-golden/v1/validate.cjs's non-hash checks.
## - It also verifies SHA-256 payload-hash parity against hashes.json using
##   a GDScript port of validate.cjs's "clinica-jcs-v1" canonicalization
##   (`_canonicalize` below), now that a real Godot 4.4.1 executable is
##   available to exercise and test it against the actual fixture pack.
##   The port was verified byte-for-byte against `validate.cjs` for every
##   value currently present in fixtures/clinica-golden/v1/ (strings incl.
##   unicode/escapes, booleans, null, nested arrays/objects, and every
##   float literal in the pack: 0.25/0.3/0.325/0.5/1.18/1.6). One known,
##   documented gap versus a full ECMA-262 Number::toString port: whole
##   floats are re-emitted as integers (matching JS, where 5.0 and 5 are
##   the same Number) and ordinary decimals use Godot's own shortest
##   round-trip formatter (verified to match JS for the fractional values
##   above), but extreme-magnitude values that JS would render in
##   exponential notation (e.g. 1e+21) are not specially handled since none
##   occur in this fixture pack. `node fixtures/clinica-golden/v1/validate.cjs`
##   remains the authoritative check of record; this is a second,
##   independent implementation intended to catch cross-engine drift.

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

## GDScript port of validate.cjs's "clinica-jcs-v1" canonicalization. Produces
## the exact same canonical JSON text that validate.cjs hashes, for the value
## shapes present in fixtures/clinica-golden/v1/ (see class doc comment for
## verification notes and the one documented gap).
static func _canonicalize(value: Variant) -> String:
	var t := typeof(value)
	if t == TYPE_NIL:
		return "null"
	if t == TYPE_BOOL:
		return "true" if value else "false"
	if t == TYPE_STRING:
		return JSON.stringify(value)
	if t == TYPE_INT:
		return str(value)
	if t == TYPE_FLOAT:
		if is_nan(value) or is_inf(value):
			return "null"
		if value == floor(value) and absf(value) < 1e15:
			return str(int(value))
		return JSON.stringify(value)
	if t == TYPE_ARRAY:
		var parts: Array = []
		for item in value:
			parts.append(_canonicalize(item))
		return "[%s]" % ",".join(parts)
	if t == TYPE_DICTIONARY:
		var keys: Array = value.keys()
		keys.sort()
		var parts: Array = []
		for key in keys:
			parts.append("%s:%s" % [JSON.stringify(str(key)), _canonicalize(value[key])])
		return "{%s}" % ",".join(parts)
	return "null"

static func _payload_sha256(payload: Variant) -> String:
	return _canonicalize(payload).sha256_text()

func validate() -> Dictionary:
	var result := ValidationResult.new()
	var root := _fixtures_root()
	var index_path := root.path_join("fixture-index.json")
	var index = _read_json(index_path)
	if typeof(index) != TYPE_DICTIONARY:
		result.add("fixture_index_readable", false, "Could not read/parse %s" % index_path)
		return result.to_dict()
	result.add("fixture_index_readable", true, index_path)

	var fixtures_list = index.get("fixtures", [])
	if typeof(fixtures_list) != TYPE_ARRAY or fixtures_list.is_empty():
		result.add("fixture_index_has_entries", false)
		return result.to_dict()
	result.add("fixture_index_has_entries", true, "%d fixtures declared" % fixtures_list.size())

	var by_id := {}
	for entry in fixtures_list:
		var fixture_id = str(entry.get("fixture_id", ""))
		var rel_path = str(entry.get("path", ""))
		var expected_authority = str(entry.get("authority", ""))
		var full_path = root.path_join(rel_path)
		var fixture = _read_json(full_path)
		if typeof(fixture) != TYPE_DICTIONARY:
			result.add("fixture_readable:%s" % fixture_id, false, "Could not read/parse %s" % full_path)
			continue
		result.add("fixture_readable:%s" % fixture_id, true)
		by_id[fixture_id] = fixture

		var required_keys := [
			"fixture_id", "fixture_revision", "schema_id", "schema_version",
			"authority", "normalization_version", "content_manifest_id",
			"content_manifest_version", "source_revision", "payload",
		]
		var missing: Array = []
		for key in required_keys:
			if not fixture.has(key):
				missing.append(key)
		var envelope_message := ""
		if not missing.is_empty():
			envelope_message = "missing keys: %s" % ", ".join(missing)
		result.add("envelope_complete:%s" % fixture_id, missing.is_empty(), envelope_message)

		result.add("fixture_id_matches:%s" % fixture_id, str(fixture.get("fixture_id", "")) == fixture_id)
		result.add("authority_matches:%s" % fixture_id, str(fixture.get("authority", "")) == expected_authority)

		var schema_id := str(fixture.get("schema_id", ""))
		result.add(
			"schema_id_prefix:%s" % fixture_id,
			schema_id.begins_with("clinica.golden."),
			"schema_id was '%s'" % schema_id
		)

	var hashes_path := root.path_join("hashes.json")
	var hash_manifest = _read_json(hashes_path)
	if typeof(hash_manifest) != TYPE_DICTIONARY:
		result.add("hash_manifest_readable", false, "Could not read/parse %s" % hashes_path)
	else:
		result.add("hash_manifest_readable", true, hashes_path)
		var hash_entries: Dictionary = {}
		for entry in hash_manifest.get("entries", []):
			hash_entries[str(entry.get("fixture_id", ""))] = entry
		result.add(
			"hash_manifest_covers_all_fixtures",
			hash_entries.size() == fixtures_list.size(),
			"%d hash entries for %d fixtures" % [hash_entries.size(), fixtures_list.size()]
		)
		for fixture_id in by_id.keys():
			if not hash_entries.has(fixture_id):
				result.add("payload_sha256_parity:%s" % fixture_id, false, "No hash manifest entry")
				continue
			var expected_hash := str(hash_entries[fixture_id].get("payload_sha256", ""))
			var payload = by_id[fixture_id].get("payload", {})
			var actual_hash := _payload_sha256(payload)
			result.add(
				"payload_sha256_parity:%s" % fixture_id,
				actual_hash == expected_hash,
				"expected %s, got %s" % [expected_hash, actual_hash] if actual_hash != expected_hash else ""
			)

	if by_id.has("journey-canonical-run-vectors"):
		var run = by_id["journey-canonical-run-vectors"].get("payload", {}).get("run", {})
		result.add(
			"journey_schema_version_is_2",
			int(run.get("schema_version", -1)) == 2,
			"was %s" % str(run.get("schema_version"))
		)

	if by_id.has("daily-rounds-v2-vectors"):
		var daily = by_id["daily-rounds-v2-vectors"].get("payload", {})
		result.add(
			"daily_rounds_version_is_2",
			int(daily.get("daily_rounds_version", -1)) == 2,
			"was %s" % str(daily.get("daily_rounds_version"))
		)

	if by_id.has("replit-godot-unity-roundtrip"):
		var roundtrip = by_id["replit-godot-unity-roundtrip"].get("payload", {})
		var player = roundtrip.get("canonical_player", {})
		result.add(
			"roundtrip_player_is_v3_envelope",
			str(player.get("schema_id", "")) == "clinica.player" and int(player.get("save_version", -1)) == 3
		)
		var roster_ids := {}
		for hero in player.get("authoritative", {}).get("roster_heroes", []):
			roster_ids[str(hero.get("hero_id", ""))] = true
		var player_hero_id := str(player.get("authoritative", {}).get("player_hero", {}).get("player_hero_id", ""))
		result.add(
			"player_hero_separate_from_roster",
			not roster_ids.has(player_hero_id),
			"Player Hero id '%s' must not be a roster hero id" % player_hero_id
		)

	return result.to_dict()
