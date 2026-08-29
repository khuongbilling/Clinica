class_name FirstBattleValidatorAdapter
extends IFixtureValidator
## Dedicated M2-P2 validator for the temporary first-battle slice.
##
## This validator drives the real portable rules through the real Godot
## adapter. It does not write fixtures, saves, caches, backend data, or
## durable player state.

const FixtureValidatorAdapterScript = preload("res://scripts/adapters/validation/fixture_validator_adapter.gd")
const PrologueBattleServiceScript = preload("res://scripts/adapters/battle/godot_prologue_battle_service.gd")
const PrologueBattleRulesScript = preload("res://scripts/core/prologue_battle_rules.gd")

const BATTLE_FIXTURE_PATH := "res://../fixtures/clinica-golden/v1/gameplay/battle-clinical-vectors.json"
const SERVICE_SOURCE_PATH := "res://scripts/adapters/battle/godot_prologue_battle_service.gd"
const RULES_SOURCE_PATH := "res://scripts/core/prologue_battle_rules.gd"
const LOADOUT_SOURCE_PATH := "res://scenes/prologue/prologue_loadout.gd"
const BATTLE_SCENE_SOURCE_PATH := "res://scenes/prologue/prologue_battle.gd"
const HANDOFF_SOURCE_PATH := "res://scenes/prologue/prologue_handoff.gd"
const BATTLE_SCENE_PATH := "res://scenes/prologue/prologue_battle.tscn"
const LOADOUT_SCENE_PATH := "res://scenes/prologue/prologue_loadout.tscn"
const HANDOFF_SCENE_PATH := "res://scenes/prologue/prologue_handoff.tscn"

func _read_json(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		return null
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return null
	var value = JSON.parse_string(file.get_as_text())
	file.close()
	return value

func _read_text(path: String) -> String:
	if not FileAccess.file_exists(path):
		return ""
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return ""
	var value := file.get_as_text()
	file.close()
	return value

func validate() -> Dictionary:
	var result := ValidationResult.new()
	_validate_fixture_parity(result)
	_validate_deterministic_sequence(result)
	_validate_ap_and_stamina(result)
	_validate_authority_boundaries(result)
	_validate_presentation_contract(result)
	return result.to_dict()

func _validate_fixture_parity(result: ValidationResult) -> void:
	var fixture_validator := FixtureValidatorAdapterScript.new()
	var fixture_result: Dictionary = fixture_validator.validate()
	result.add(
		"fixture_pack_hash_validator_passes",
		str(fixture_result.get("overall", "fail")) == "pass",
		"existing fixture validator returned %s" % str(fixture_result.get("overall", "missing"))
	)

	var fixture = _read_json(BATTLE_FIXTURE_PATH)
	result.add("battle_fixture_readable", typeof(fixture) == TYPE_DICTIONARY)
	if typeof(fixture) != TYPE_DICTIONARY:
		return
	var cases: Array = fixture.get("payload", {}).get("cases", [])
	result.add("battle_fixture_has_six_cases", cases.size() == 6)
	for case in cases:
		var case_id := str(case.get("case_id", "unknown"))
		var input: Dictionary = case.get("input", {})
		var expected: Dictionary = case.get("expected", {})
		var actual: Dictionary = _calculate_fixture_case(str(case.get("kind", "")), input)
		if expected.has("effect"):
			result.add(
				"canonical:%s:effect" % case_id,
				int(actual.get("effect", -1)) == int(expected.get("effect", -2)),
				"expected %s, got %s" % [str(expected.get("effect")), str(actual.get("effect"))]
			)
		else:
			result.add(
				"canonical:%s:resolution" % case_id,
				int(actual.get("blocked_damage", -1)) == int(expected.get("blocked_damage", -2))
				and int(actual.get("stability_after", -1)) == int(expected.get("stability_after", -2)),
				"expected %s, got %s" % [str(expected), str(actual)]
			)
		if expected.has("ordering"):
			result.add(
				"canonical:%s:ordering" % case_id,
				str(actual.get("ordering", "")) == str(expected.get("ordering")),
				"expected ordering %s" % str(expected.get("ordering"))
			)

func _calculate_fixture_case(kind: String, input: Dictionary) -> Dictionary:
	if kind == "strike":
		return {
			"effect": PrologueBattleRulesScript.calculate_strike(
				float(input.get("base", 0)),
				float(input.get("element_bonus", 0)),
				float(input.get("clinical_mod", 1)),
				float(input.get("affinity_family_mod", 1))
			)
		}
	if kind == "stabilize":
		return {
			"effect": PrologueBattleRulesScript.calculate_stabilize(
				float(input.get("base", 0)),
				float(input.get("clinical_mod", 1)),
				float(input.get("cue_bonus_flat", 0)),
				float(input.get("stability_gain_mod", 1)),
				float(input.get("enemy_resistance_mod", 1))
			),
			"ordering": "multiply_then_flat_cue_then_patient_modifiers",
		}
	return PrologueBattleRulesScript.resolve_shield(
		float(input.get("incoming_stability_damage", 0)),
		float(input.get("shield_percent", 0)),
		float(input.get("stability_before", 0))
	).merged({"ordering": "shield_before_hp"})

func _validate_deterministic_sequence(result: ValidationResult) -> void:
	var first := PrologueBattleServiceScript.new()
	var second := PrologueBattleServiceScript.new()
	var first_initial: Dictionary = first.begin()
	var second_initial: Dictionary = second.begin()
	result.add("deterministic_initial_snapshot", first_initial == second_initial)
	result.add(
		"temporary_loadout_has_three_fixed_ids",
		PrologueBattleRulesScript.loadout().size() == 3
		and PrologueBattleRulesScript.loadout()[0]["id"] == "prologue_nightingale"
		and PrologueBattleRulesScript.loadout()[1]["id"] == "prologue_fleming"
		and PrologueBattleRulesScript.loadout()[2]["id"] == "prologue_former_self"
	)
	result.add(
		"deterministic_encounter_identity",
		PrologueBattleRulesScript.encounter()["id"] == PrologueBattleRulesScript.FIRST_BATTLE_ID
		and PrologueBattleRulesScript.encounter()["name"] == "Silent Infarction"
		and PrologueBattleRulesScript.encounter()["final_action_id"] == PrologueBattleRulesScript.FINAL_ACTION_ID
	)

	var invalid_service := PrologueBattleServiceScript.new()
	var before_invalid: Dictionary = invalid_service.begin()
	var invalid_final: Dictionary = invalid_service.perform_action("final_action")
	result.add(
		"out_of_order_final_action_does_not_mutate_state",
		not bool(invalid_final.get("ok", true))
		and invalid_service.snapshot() == before_invalid
	)

	var actions := ["assess", "prioritize", "intervene", "reassess"]
	for action_id in actions:
		var first_result: Dictionary = first.perform_action(action_id)
		var second_result: Dictionary = second.perform_action(action_id)
		result.add(
			"deterministic:%s" % action_id,
			first_result == second_result and bool(first_result.get("ok", false))
		)
	result.add(
		"reassessment_requires_final_action",
		first.snapshot().get("phase", "") == PrologueBattleRulesScript.FINAL_ACTION_ID
		and not bool(first.snapshot().get("battle_completed", false))
	)
	var first_final: Dictionary = first.perform_action("final_action")
	var second_final: Dictionary = second.perform_action("final_action")
	result.add(
		"deterministic:final_action",
		first_final == second_final and bool(first_final.get("ok", false))
	)
	result.add(
		"exact_five_beat_history",
		first.snapshot().get("history", []) == ["assess", "prioritize", "intervene", "reassess", "final_action"]
	)
	result.add("deterministic_final_snapshot", first.snapshot() == second.snapshot())
	result.add("battle_ends_after_final_action", bool(first.snapshot().get("battle_completed", false)))
	result.add("battle_handoff_route_is_fixed", first.snapshot().get("handoff_route", "") == "prologue_handoff")

func _validate_ap_and_stamina(result: ValidationResult) -> void:
	var service := PrologueBattleServiceScript.new()
	var initial: Dictionary = service.begin()
	result.add(
		"battle_ap_starts_separately",
		int(initial.get("battle_ap", -1)) == PrologueBattleRulesScript.MAX_BATTLE_AP
		and int(initial.get("persistent_stamina", -1)) == PrologueBattleRulesScript.PERSISTENT_STAMINA_BASELINE
	)
	service.perform_action("assess")
	service.perform_action("prioritize")
	var before_intervention: Dictionary = service.snapshot()
	service.perform_action("intervene")
	var after_intervention: Dictionary = service.snapshot()
	result.add("non_resource_actions_do_not_spend_ap", int(before_intervention["battle_ap"]) == 4)
	result.add("intervention_spends_one_battle_ap", int(after_intervention["battle_ap"]) == 3)
	result.add(
		"intervention_does_not_change_persistent_stamina",
		int(after_intervention["persistent_stamina"]) == int(initial["persistent_stamina"])
	)
	service.perform_action("reassess")
	result.add(
		"stamina_unchanged_before_final_action",
		int(service.snapshot()["persistent_stamina"]) == int(initial["persistent_stamina"])
	)
	service.perform_action("final_action")
	result.add("final_action_does_not_spend_ap", int(service.snapshot()["battle_ap"]) == 3)
	result.add(
		"stamina_unchanged_through_completion",
		int(service.snapshot()["persistent_stamina"]) == int(initial["persistent_stamina"])
	)

func _validate_authority_boundaries(result: ValidationResult) -> void:
	var service := PrologueBattleServiceScript.new()
	service.begin()
	for action_id in ["assess", "prioritize", "intervene", "reassess", "final_action"]:
		service.perform_action(action_id)
	result.add("no_durable_writes", service.get_durable_write_count() == 0)
	result.add("no_durable_grants", service.get_durable_grant_count() == 0)

	var service_source := _read_text(SERVICE_SOURCE_PATH)
	var rules_source := _read_text(RULES_SOURCE_PATH)
	result.add("battle_service_source_readable", service_source != "")
	result.add("battle_rules_source_readable", rules_source != "")
	for forbidden in [
		"Services.save_cache",
		"Services.api_transport",
		"PlayerEnvelope",
		"HTTPRequest",
		"write_local_cache",
		"write_migrated_cache",
		"write_quarantine",
		"heroes_owned",
		"currency",
		"\"xp\"",
	]:
		result.add(
			"no_authority_reference:%s" % forbidden,
			not service_source.contains(forbidden) and not rules_source.contains(forbidden)
		)
	var battle_adapter_dir := ProjectSettings.globalize_path("res://scripts/adapters/battle")
	var adapter_files := DirAccess.get_files_at(battle_adapter_dir)
	var concrete_count := 0
	for file_name in adapter_files:
		if file_name.ends_with(".gd") and file_name != "i_prologue_battle_service.gd":
			concrete_count += 1
	result.add("one_concrete_prologue_battle_adapter", concrete_count == 1)
	result.add("no_m2p3_scope_marker", not service_source.contains("M2-P3") and not rules_source.contains("M2-P3"))

func _validate_presentation_contract(result: ValidationResult) -> void:
	var loadout_source := _read_text(LOADOUT_SOURCE_PATH)
	var battle_source := _read_text(BATTLE_SCENE_SOURCE_PATH)
	var handoff_source := _read_text(HANDOFF_SOURCE_PATH)
	result.add("loadout_scene_source_readable", loadout_source != "")
	result.add("battle_scene_source_readable", battle_source != "")
	result.add("handoff_source_readable", handoff_source != "")
	result.add(
		"teaching_sequence_is_ordered",
		battle_source.find("\"assess\"") < battle_source.find("\"prioritize\"")
		and battle_source.find("\"prioritize\"") < battle_source.find("\"intervene\"")
		and battle_source.find("\"intervene\"") < battle_source.find("\"reassess\"")
		and battle_source.find("\"reassess\"") < battle_source.find("\"final_action\"")
	)
	result.add(
		"post_battle_handoff_is_explicit",
		battle_source.contains("prologue_handoff")
		and handoff_source.contains("app_shell.tscn")
	)
	result.add(
		"controller_does_not_reimplement_math",
		not battle_source.contains("calculate_strike")
		and not battle_source.contains("calculate_stabilize")
		and battle_source.contains("Services.prologue_battle.perform_action")
	)
	_validate_instantiated_scenes(result)

func _validate_instantiated_scenes(result: ValidationResult) -> void:
	var loadout_resource = ResourceLoader.load(LOADOUT_SCENE_PATH)
	var battle_resource = ResourceLoader.load(BATTLE_SCENE_PATH)
	var handoff_resource = ResourceLoader.load(HANDOFF_SCENE_PATH)
	result.add("loadout_scene_loads_as_packed_scene", loadout_resource is PackedScene)
	result.add("battle_scene_loads_as_packed_scene", battle_resource is PackedScene)
	result.add("handoff_scene_loads_as_packed_scene", handoff_resource is PackedScene)
	if not (loadout_resource is PackedScene and battle_resource is PackedScene and handoff_resource is PackedScene):
		return

	var loadout: Node = loadout_resource.instantiate()
	var battle: Node = battle_resource.instantiate()
	var handoff: Node = handoff_resource.instantiate()

	var loadout_scroll := loadout.get_node_or_null("Scroll")
	var battle_scroll := battle.get_node_or_null("Scroll")
	var handoff_scroll := handoff.get_node_or_null("Scroll")
	result.add(
		"all_prologue_scenes_scroll_and_follow_focus",
		loadout_scroll is ScrollContainer and loadout_scroll.follow_focus
		and battle_scroll is ScrollContainer and battle_scroll.follow_focus
		and handoff_scroll is ScrollContainer and handoff_scroll.follow_focus
	)

	var loadout_button := loadout.get_node_or_null("Scroll/Margin/Content/StartButton")
	var action_paths := [
		"Scroll/Margin/Content/Actions/Assess",
		"Scroll/Margin/Content/Actions/Prioritize",
		"Scroll/Margin/Content/Actions/Intervene",
		"Scroll/Margin/Content/Actions/Reassess",
		"Scroll/Margin/Content/Actions/FinalAction",
		"Scroll/Margin/Content/Handoff",
	]
	var all_action_buttons_accessible := true
	for path in action_paths:
		var button := battle.get_node_or_null(path)
		all_action_buttons_accessible = (
			all_action_buttons_accessible
			and button is Button
			and button.custom_minimum_size.y >= 48.0
			and button.focus_mode == Control.FOCUS_ALL
		)
	var handoff_button := handoff.get_node_or_null("Scroll/Margin/Content/ReturnButton")
	result.add(
		"all_touch_targets_meet_minimum_and_take_focus",
		loadout_button is Button
		and loadout_button.custom_minimum_size.y >= 48.0
		and loadout_button.focus_mode == Control.FOCUS_ALL
		and all_action_buttons_accessible
		and handoff_button is Button
		and handoff_button.custom_minimum_size.y >= 48.0
		and handoff_button.focus_mode == Control.FOCUS_ALL
	)

	var status_label := battle.get_node_or_null("Scroll/Margin/Content/Status")
	var loadout_instruction := loadout.get_node_or_null("Scroll/Margin/Content/Instruction")
	result.add(
		"mobile_copy_wraps_and_is_readable",
		status_label is Label
		and status_label.autowrap_mode != TextServer.AUTOWRAP_OFF
		and status_label.get_theme_font_size("font_size") >= 20
		and loadout_instruction is Label
		and loadout_instruction.autowrap_mode != TextServer.AUTOWRAP_OFF
		and loadout_instruction.get_theme_font_size("font_size") >= 20
	)
	result.add(
		"handoff_continue_action_exists",
		battle.get_node_or_null("Scroll/Margin/Content/Handoff") is Button
		and handoff_button is Button
	)

	loadout.free()
	battle.free()
	handoff.free()