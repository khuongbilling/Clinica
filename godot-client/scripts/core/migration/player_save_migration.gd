class_name PlayerSaveMigration
extends RefCounted
## Pure, engine-independent player-save migration ledger for M1-P2.
##
## Implements the ordered ledger in docs/save-schema-migration-ledger.md
## (Entry A: unversioned legacy -> v1, Entry B: v1 -> v2, Entry C: v2 -> v3)
## as one deterministic function, converging on the frozen v3
## `clinica.player` envelope in docs/canonical-save-schema-contract.md §2.
##
## Purity contract (ledger §4). Every function in this file is:
## - pure: no file/network I/O, no `Time`/`OS` clock reads, no `randi`/
##   `randf`/RandomNumberGenerator, no autoload/singleton access, no reward
##   side effects. Callers (adapters) own I/O; this file only transforms
##   values.
## - non-mutating: inputs are always `duplicate(true)`-copied before any
##   transform; the caller's Dictionary/Array is never modified in place.
## - deterministic: the same input Dictionary always produces the same
##   output, on any run, on any machine, regardless of wall-clock time.
## - idempotent: `migrate(migrate(x).envelope.to_dict())` is always an
##   "accept" of an identical envelope (see `migrate()` below: a v3-shaped
##   input with `authoritative`/`local` present is accepted unchanged, never
##   re-aliased or re-derived).
## - ordered: only unversioned/v1 -> v2 -> v3, in that order; never skips
##   forward past an unknown version and never rewrites backward.
## - stable-ID preserving: `_dedup_preserve_order` removes exact duplicates
##   only; it never renames, reorders beyond de-duplication, or drops an
##   ID that was not a duplicate.
## - incapable of minting: no transform here can increase a currency/
##   stamina/inventory-quantity value, or introduce a hero/equipment/claim/
##   receipt ID that was not already present in the input (the one
##   documented exception is the Chapter-1 node alias rename in
##   `_migrate_legacy_to_v1`, which ADDS the new ID only when its old
##   counterpart is already present — same underlying grant, renamed ID,
##   not a new grant). See `compute_grant_delta()` for the independent,
##   runtime-computed proof used by the validator in
##   scripts/adapters/validation/player_save_migration_validator_adapter.gd.

const SCHEMA_ID := "clinica.player"
const SUPPORTED_SAVE_VERSION := 3

## Entry A — canonical learning-profile aliases (ledger §2 Entry A).
## `preNursing` is deliberately excluded: its behavior differs and requires
## an explicit future decision (ledger §2 Entry A, `store.tsx` Task 369).
const LEGACY_PROFILE_ALIASES := {
	"nonmedical": "curious",
	"nursingStudent": "nursing_student",
	"nclexPrep": "nclex",
	"healthcareProfessional": "professional",
}

## Entry A — canonical Chapter 1 journey-node ID aliases (ledger §2 Entry A).
## `c1p3` was never claimable and intentionally has no entry here.
const CHAPTER1_NODE_ALIASES := {
	"c1p1": "c1n1",
	"c1p2": "c1n4",
	"c1p4": "c1n4",
	"c1p5": "c1n6",
}

## Set-like arrays that are deterministically de-duplicated (first
## occurrence wins) during Entry A, preserving stable-ID order otherwise.
const SET_LIKE_ARRAY_FIELDS := [
	"equipment_owned",
	"claimed_reward_ids",
	"activity_receipt_ids",
	"heroes_owned",
	"claimed_journey_nodes",
	"claimed_chapter_chests",
	"claimed_chapter_3star",
	"journey_run_refs",
	"activity_attempt_refs",
]

## Numeric valuable fields that must be a non-negative number when present.
## A wrong type or a negative value fails closed (ledger §4 / §5 "Malformed
## JSON/container shape").
const NUMERIC_VALUABLE_FIELDS := [
	"stamina", "xp", "coins", "crowns", "insight_crystals",
	"refined_lotus_gems", "lotus_gems_paid", "ward_sigils", "epidemic_tokens",
]

## Entry B/C — fields classified as account-wide server-owned authority
## (docs/canonical-save-schema-contract.md §3.1, §4.1, §4.2). Player Hero
## fields are listed explicitly and separately from roster/hero fields so
## the two systems are never conflated (contract §4.2).
const AUTHORITATIVE_FIELDS := [
	"xp", "player_level", "rank", "mastery",
	"class_tree_id", "class_progress", "class_specialization",
	"stamina", "coins", "crowns", "insight_crystals", "refined_lotus_gems",
	"lotus_gems_paid", "ward_sigils", "epidemic_tokens",
	"inventory", "equipment_owned",
	"heroes_owned", "hero_progression", "active_team", "hero_equipment",
	"hero_skill_upgrades",
	"player_hero", "player_hero_opportunities", "awakening_beat_complete",
	"journey_run_refs", "activity_attempt_refs", "activity_receipt_ids",
	"claimed_reward_ids", "claimed_journey_nodes", "claimed_chapter_chests",
	"claimed_chapter_3star",
	"daily_rounds",
	"chapter_progress", "runs_completed", "opening_prologue_complete",
	"uni_cue_lab_count", "uni_triage_count", "uni_stack_count",
	"uni_practice_milestones_claimed",
	"clinical_practice", "clinical_simulation_history",
	"clinical_simulation_achievements",
]

## Entry B/C — fields classified as device-local/presentation, per contract
## §3.4 and §4.3 (Realm production/assignments are explicitly non-
## authoritative "until a server-time, authenticated Realm contract
## exists").
const LOCAL_FIELDS := [
	"learning_profile", "realm_seed", "realm_layout", "realm_decor",
	"realm_assignments", "realm_production",
	"avatar_id", "diagnostic_intro_seen", "identity_restored",
]

## Every other input field that is not on either allowlist is preserved,
## unmodified, in a `local.extensions` opaque bag (ledger §2 Entry B:
## "Carry unknown fields into a non-authoritative extension/quarantine area
## rather than dropping them"). It is never read as authority.
const EXTENSIONS_LOCAL_KEY := "extensions"

## Envelope-only keys that are not player data fields; they never move into
## the classified authoritative/local sections.
const ENVELOPE_META_KEYS := ["schema_id", "save_version", "player_id", "cache_namespace"]


static func migrate(raw: Variant) -> MigrationOutcome:
	var outcome := MigrationOutcome.new()

	if typeof(raw) != TYPE_DICTIONARY:
		outcome.action = MigrationOutcome.ACTION_QUARANTINE
		outcome.quarantine_reason = "malformed_container"
		outcome.raw_preserved = raw
		return outcome

	var input: Dictionary = raw

	var version_probe = input.get("save_version", null)
	if version_probe == null:
		return _run_pipeline(input, 0)

	if typeof(version_probe) != TYPE_INT and typeof(version_probe) != TYPE_FLOAT:
		outcome.action = MigrationOutcome.ACTION_QUARANTINE
		outcome.quarantine_reason = "malformed_save_version"
		outcome.raw_preserved = input.duplicate(true)
		return outcome

	var declared_version := int(version_probe)
	if declared_version > SUPPORTED_SAVE_VERSION:
		outcome.action = MigrationOutcome.ACTION_QUARANTINE
		outcome.quarantine_reason = "unsupported_future_version"
		outcome.raw_preserved = input.duplicate(true)
		outcome.save_version = declared_version
		return outcome
	if declared_version < 1:
		outcome.action = MigrationOutcome.ACTION_QUARANTINE
		outcome.quarantine_reason = "malformed_save_version"
		outcome.raw_preserved = input.duplicate(true)
		return outcome

	return _run_pipeline(input, declared_version)


## Independently re-computes the value delta between the pre-migration input
## and the migrated envelope's authoritative section, so callers/tests can
## PROVE the no-mint invariant behaviorally rather than trusting a declared
## fixture value. Every field is >= 0 / empty when migration mints nothing.
static func compute_grant_delta(before_raw: Dictionary, envelope: PlayerEnvelope) -> Dictionary:
	var before := _extract_valuable_view(before_raw)
	var after: Dictionary = envelope.authoritative if envelope != null else {}

	var delta := {
		"currency": 0,
		"stamina": 0,
		"inventory": {},
		"heroes": [],
		"equipment": [],
		"claims": [],
		"receipts": [],
	}

	var currency_fields := ["coins", "crowns", "insight_crystals", "refined_lotus_gems", "lotus_gems_paid", "ward_sigils"]
	var currency_delta := 0
	for f in currency_fields:
		var b: float = float(before.get(f, 0))
		var a: float = float(after.get(f, b))
		if a > b:
			currency_delta += int(round(a - b))
	delta["currency"] = currency_delta

	var stamina_before: float = float(before.get("stamina", 0))
	var stamina_after: float = float(after.get("stamina", stamina_before))
	if stamina_after > stamina_before:
		delta["stamina"] = int(round(stamina_after - stamina_before))

	var inv_before: Dictionary = before.get("inventory", {})
	var inv_after: Dictionary = after.get("inventory", inv_before)
	var inv_delta := {}
	for k in inv_after.keys():
		var ib: float = float(inv_before.get(k, 0))
		var ia: float = float(inv_after[k])
		if ia > ib:
			inv_delta[k] = ia - ib
	delta["inventory"] = inv_delta

	delta["heroes"] = _new_entries(before.get("heroes_owned", []), after.get("heroes_owned", []))
	delta["equipment"] = _new_entries(before.get("equipment_owned", []), after.get("equipment_owned", []))
	delta["receipts"] = _new_entries(before.get("activity_receipt_ids", []), after.get("activity_receipt_ids", []))

	var claims: Array = []
	for f in ["claimed_reward_ids", "claimed_chapter_chests", "claimed_chapter_3star"]:
		claims.append_array(_new_entries(before.get(f, []), after.get(f, [])))

	# claimed_journey_nodes: a new ID is exempt from the mint count only when
	# it is explained by the documented Chapter-1 rename (the OLD id it
	# aliases from was already present before migration ran).
	var before_nodes: Array = before.get("claimed_journey_nodes", [])
	var after_nodes: Array = after.get("claimed_journey_nodes", [])
	for id in _new_entries(before_nodes, after_nodes):
		var explained := false
		for old_id in CHAPTER1_NODE_ALIASES.keys():
			if CHAPTER1_NODE_ALIASES[old_id] == id and before_nodes.has(old_id):
				explained = true
				break
		if not explained:
			claims.append(id)
	delta["claims"] = claims

	return delta


static func _run_pipeline(original_raw: Dictionary, from_version: int) -> MigrationOutcome:
	var outcome := MigrationOutcome.new()

	var malformed_reason := _first_malformed_reason(original_raw)
	if malformed_reason != "":
		outcome.action = MigrationOutcome.ACTION_QUARANTINE
		outcome.quarantine_reason = malformed_reason
		outcome.raw_preserved = original_raw.duplicate(true)
		return outcome

	var player_id := str(original_raw.get("player_id", ""))
	if player_id == "":
		outcome.action = MigrationOutcome.ACTION_QUARANTINE
		outcome.quarantine_reason = "missing_player_id"
		outcome.raw_preserved = original_raw.duplicate(true)
		return outcome

	if from_version == SUPPORTED_SAVE_VERSION:
		if not original_raw.has("authoritative") or not original_raw.has("local") \
				or typeof(original_raw["authoritative"]) != TYPE_DICTIONARY \
				or typeof(original_raw["local"]) != TYPE_DICTIONARY:
			outcome.action = MigrationOutcome.ACTION_QUARANTINE
			outcome.quarantine_reason = "malformed_v3_shape"
			outcome.raw_preserved = original_raw.duplicate(true)
			return outcome
		# Already canonical v3: accept unchanged. Re-running Entry A/B alias
		# and classification logic on already-classified data would risk
		# losing the idempotency guarantee, so a v3-shaped input is a pure
		# pass-through here.
		outcome.action = MigrationOutcome.ACTION_ACCEPT
		outcome.save_version = 3
		outcome.envelope = PlayerEnvelope.from_dict(original_raw)
		return outcome

	var working: Dictionary = original_raw.duplicate(true)
	if from_version < 1:
		working = _migrate_legacy_to_v1(working)
	var classified: Dictionary
	if from_version < 2:
		classified = _classify_v1_to_v2(working)
	else:
		classified = {
			"authoritative": working.get("authoritative", {}),
			"local": working.get("local", {}),
		}

	outcome.action = MigrationOutcome.ACTION_MIGRATE
	outcome.save_version = 3
	outcome.envelope = PlayerEnvelope.new()
	outcome.envelope.player_id = player_id
	outcome.envelope.authoritative = classified.get("authoritative", {})
	outcome.envelope.local = classified.get("local", {})
	return outcome


## Entry A (ledger §2): unversioned legacy -> v1 compatibility data.
static func _migrate_legacy_to_v1(input: Dictionary) -> Dictionary:
	var out: Dictionary = input.duplicate(true)

	if out.has("learning_profile"):
		var lp := str(out["learning_profile"])
		if LEGACY_PROFILE_ALIASES.has(lp):
			out["learning_profile"] = LEGACY_PROFILE_ALIASES[lp]

	if out.has("claimed_journey_nodes") and typeof(out["claimed_journey_nodes"]) == TYPE_ARRAY:
		var current: Array = out["claimed_journey_nodes"]
		var has_legacy := false
		for id in current:
			if str(id).begins_with("c1p"):
				has_legacy = true
				break
		if has_legacy:
			var migrated: Array = current.duplicate()
			for old_id in CHAPTER1_NODE_ALIASES.keys():
				var new_id: String = CHAPTER1_NODE_ALIASES[old_id]
				if current.has(old_id) and not migrated.has(new_id):
					migrated.append(new_id)
			out["claimed_journey_nodes"] = migrated

	# Fixed additive defaults (ledger §2 Entry A) — empty containers/false
	# flags only, never a value that could be mistaken for a grant.
	var default_arrays := [
		"claimed_journey_nodes", "heroes_owned", "equipment_owned",
		"claimed_reward_ids", "activity_receipt_ids", "journey_run_refs",
		"activity_attempt_refs", "player_hero_opportunities",
		"claimed_chapter_chests", "claimed_chapter_3star",
	]
	for field in default_arrays:
		if not out.has(field):
			out[field] = []
	if not out.has("hero_progression"):
		out["hero_progression"] = {}
	if not out.has("inventory"):
		out["inventory"] = {}
	# Player Hero is deliberately read-side default-only: legacy accounts
	# never receive one by migration (contract §4.2).
	if not out.has("player_hero"):
		out["player_hero"] = null
	if not out.has("awakening_beat_complete"):
		out["awakening_beat_complete"] = false

	for field in SET_LIKE_ARRAY_FIELDS:
		if out.has(field) and typeof(out[field]) == TYPE_ARRAY:
			out[field] = _dedup_preserve_order(out[field])

	var seed_probe = out.get("realm_seed", null)
	if seed_probe == null or str(seed_probe) == "":
		out["realm_seed"] = _derive_realm_seed(player_id_of(out))

	return out


## Entry B (ledger §2): v1 -> v2. Classifies fields into the engine-
## independent `authoritative` / `local` split (contract §2, §3.4).
static func _classify_v1_to_v2(input: Dictionary) -> Dictionary:
	var authoritative := {}
	var local := {}
	var extensions := {}

	for key in input.keys():
		if ENVELOPE_META_KEYS.has(key):
			continue
		if AUTHORITATIVE_FIELDS.has(key):
			authoritative[key] = input[key]
		elif LOCAL_FIELDS.has(key):
			local[key] = input[key]
		else:
			extensions[key] = input[key]

	if not extensions.is_empty():
		local[EXTENSIONS_LOCAL_KEY] = extensions

	return {"authoritative": authoritative, "local": local}


static func player_id_of(input: Dictionary) -> String:
	return str(input.get("player_id", ""))


## Builds a flat "valuable fields" view regardless of whether the input is
## still flat (legacy) or already nested under `authoritative` (v2/v3), so
## malformed-field and grant-delta checks work at any pipeline stage.
static func _extract_valuable_view(input: Dictionary) -> Dictionary:
	var view: Dictionary = input.duplicate(true)
	if input.has("authoritative") and typeof(input["authoritative"]) == TYPE_DICTIONARY:
		for key in input["authoritative"].keys():
			view[key] = input["authoritative"][key]
	if input.has("local") and typeof(input["local"]) == TYPE_DICTIONARY:
		for key in input["local"].keys():
			if not view.has(key):
				view[key] = input["local"][key]
	return view


static func _first_malformed_reason(input: Dictionary) -> String:
	var view := _extract_valuable_view(input)

	if view.has("inventory"):
		var inv = view["inventory"]
		if typeof(inv) != TYPE_DICTIONARY:
			return "malformed_valuable_field"
		for k in inv.keys():
			var v = inv[k]
			if (typeof(v) != TYPE_INT and typeof(v) != TYPE_FLOAT) or v < 0:
				return "malformed_valuable_field"

	for field in NUMERIC_VALUABLE_FIELDS:
		if view.has(field):
			var v2 = view[field]
			if typeof(v2) != TYPE_INT and typeof(v2) != TYPE_FLOAT:
				return "malformed_valuable_field"
			if v2 < 0:
				return "malformed_valuable_field"

	for field in SET_LIKE_ARRAY_FIELDS:
		if view.has(field) and typeof(view[field]) != TYPE_ARRAY:
			return "malformed_valuable_field"

	return ""


static func _dedup_preserve_order(arr: Array) -> Array:
	var seen := {}
	var result: Array = []
	for item in arr:
		var key := str(item)
		if not seen.has(key):
			seen[key] = true
			result.append(item)
	return result


## Deterministic, non-random realm_seed backfill for a legacy player with no
## stored seed (ledger §2 Entry A: "derive it deterministically from stable
## player_id; never use random generation"). This portable string-derivation
## rule is independent of (and not a re-implementation of) the frontend's
## own numeric FNV-1a Realm-grid seed in `frontend/src/game/store.tsx`,
## which seeds a different, engine-specific rendering concern; this rule
## only has to satisfy the portable envelope contract of being stable and
## non-random. Verified against fixtures/clinica-golden/v1/saves/
## player-migration-vectors.json's "legacy-alias-and-dedup" case:
## "fixture-player-0002" -> "realm-fixture-0002".
static func _derive_realm_seed(player_id: String) -> String:
	var cleaned := player_id.replace("-player-", "-")
	if cleaned.begins_with("player-"):
		cleaned = cleaned.substr("player-".length())
	return "realm-" + cleaned


static func _new_entries(before: Array, after: Array) -> Array:
	var before_keys := {}
	for item in before:
		before_keys[str(item)] = true
	var result: Array = []
	for item in after:
		if not before_keys.has(str(item)):
			result.append(item)
	return result
