#!/usr/bin/env bash
# M1-P1/M2-P2 Godot smoke and validator check.
#
# Honesty contract: this script never claims a Godot-verified pass unless a
# `godot4`/`godot` executable is actually present and actually runs. When no
# such binary exists, it performs structural checks only (required files
# present, project.godot has the expected keys) and prints an explicit
# LIMITATION banner instead of a fabricated success.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GODOT_CLIENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

overall_status=0

echo "== M1-P1 Godot skeleton validation =="
echo "Project dir: $GODOT_CLIENT_DIR"

GODOT_BIN=""
for candidate in godot4 godot; do
  if command -v "$candidate" >/dev/null 2>&1; then
    GODOT_BIN="$candidate"
    break
  fi
done

if [ -n "$GODOT_BIN" ]; then
  echo "-- Godot binary found: $GODOT_BIN --"

  echo "[1/9] Headless fixture/hash validator"
  if "$GODOT_BIN" --headless --path "$GODOT_CLIENT_DIR" \
      --script res://scripts/tools/run_fixture_validation.gd; then
    echo "PASS: fixture validator ran headlessly."
  else
    echo "FAIL: fixture validator reported a failure or crashed."
    overall_status=1
  fi

  echo "[2/9] Headless boot-scene parse/run smoke test (boot -> opening -> app_shell)"
  if timeout 30 "$GODOT_BIN" --headless --path "$GODOT_CLIENT_DIR" \
      --quit-after 6 res://scenes/boot/boot.tscn; then
    echo "PASS: boot scene parsed and ran headlessly (full boot->opening->app_shell chain)."
  else
    echo "FAIL: boot scene did not parse/run headlessly."
    overall_status=1
  fi

  echo "[3/9] Headless opening-scene direct parse/run smoke test"
  if timeout 30 "$GODOT_BIN" --headless --path "$GODOT_CLIENT_DIR" \
      --quit-after 4 res://scenes/opening/opening.tscn; then
    echo "PASS: opening scene parsed and ran headlessly."
  else
    echo "FAIL: opening scene did not parse/run headlessly."
    overall_status=1
  fi

  echo "[4/9] Headless prologue loadout-scene parse/run smoke test"
  if timeout 30 "$GODOT_BIN" --headless --path "$GODOT_CLIENT_DIR" \
      --quit-after 4 res://scenes/prologue/prologue_loadout.tscn; then
    echo "PASS: prologue loadout scene parsed and ran headlessly."
  else
    echo "FAIL: prologue loadout scene did not parse/run headlessly."
    overall_status=1
  fi

  echo "[5/9] Headless prologue battle-scene parse/run smoke test"
  if timeout 30 "$GODOT_BIN" --headless --path "$GODOT_CLIENT_DIR" \
      --quit-after 4 res://scenes/prologue/prologue_battle.tscn; then
    echo "PASS: prologue battle scene parsed and ran headlessly."
  else
    echo "FAIL: prologue battle scene did not parse/run headlessly."
    overall_status=1
  fi

  echo "[6/9] Headless prologue handoff-scene parse/run smoke test"
  if timeout 30 "$GODOT_BIN" --headless --path "$GODOT_CLIENT_DIR" \
      --quit-after 4 res://scenes/prologue/prologue_handoff.tscn; then
    echo "PASS: prologue handoff scene parsed and ran headlessly."
  else
    echo "FAIL: prologue handoff scene did not parse/run headlessly."
    overall_status=1
  fi

  echo "[7/9] Headless M1-P2 player-save migration validator"
  if "$GODOT_BIN" --headless --path "$GODOT_CLIENT_DIR" \
      --script res://scripts/tools/run_migration_validation.gd; then
    echo "PASS: migration validator ran headlessly."
  else
    echo "FAIL: migration validator reported a failure or crashed."
    overall_status=1
  fi

  echo "[8/9] Headless M2-P1 opening/cutscene validator"
  if "$GODOT_BIN" --headless --path "$GODOT_CLIENT_DIR" \
      --script res://scripts/tools/run_opening_cutscene_validation.gd; then
    echo "PASS: opening/cutscene validator ran headlessly."
  else
    echo "FAIL: opening/cutscene validator reported a failure or crashed."
    overall_status=1
  fi

  echo "[9/9] Headless M2-P2 first-battle validator"
  if "$GODOT_BIN" --headless --path "$GODOT_CLIENT_DIR" \
      --script res://scripts/tools/run_first_battle_validation.gd; then
    echo "PASS: first-battle validator ran headlessly."
  else
    echo "FAIL: first-battle validator reported a failure or crashed."
    overall_status=1
  fi
else
  echo "-- No godot/godot4 binary found on PATH --"
  echo "LIMITATION: this environment cannot parse or execute GDScript/.tscn"
  echo "files. The checks below are structural (file presence / key"
  echo "presence) only. They do NOT prove the project opens in the Godot"
  echo "editor or boots correctly. Run this script again on a machine with"
  echo "Godot 4.3+ installed for a real headless verification."
  echo

  required_files=(
    "project.godot"
    "scenes/boot/boot.tscn"
    "scenes/boot/boot.gd"
    "scenes/app_shell/app_shell.tscn"
    "scenes/app_shell/app_shell.gd"
    "scripts/core/composition_root.gd"
    "scripts/core/contracts/player_envelope.gd"
    "scripts/core/contracts/journey_run_ref.gd"
    "scripts/core/contracts/activity_attempt_ref.gd"
    "scripts/core/contracts/validation_result.gd"
    "scripts/core/contracts/migration_outcome.gd"
    "scripts/core/migration/player_save_migration.gd"
    "scripts/core/migration/player_save_transfer.gd"
    "scripts/core/services/i_navigation_service.gd"
    "scripts/core/services/i_app_state_service.gd"
    "scripts/core/services/i_api_transport.gd"
    "scripts/core/services/i_save_cache_store.gd"
    "scripts/core/services/i_config_provider.gd"
    "scripts/core/services/i_logger.gd"
    "scripts/core/services/i_error_reporter.gd"
    "scripts/core/services/i_fixture_validator.gd"
    "scripts/core/services/i_cutscene_playback_service.gd"
    "scripts/adapters/navigation/godot_navigation_service.gd"
    "scripts/adapters/state/app_state_service.gd"
    "scripts/adapters/api/http_api_transport.gd"
    "scripts/adapters/storage/local_save_cache_adapter.gd"
    "scripts/adapters/config/env_config_provider.gd"
    "scripts/adapters/logging/godot_logger.gd"
    "scripts/adapters/errors/error_reporter.gd"
    "scripts/adapters/validation/fixture_validator_adapter.gd"
    "scripts/adapters/cutscene/cutscene_playback_service.gd"
    "scripts/tools/run_fixture_validation.gd"
    "scripts/core/migration/player_save_migration.gd"
    "scripts/core/migration/player_save_transfer.gd"
    "scripts/core/contracts/migration_outcome.gd"
    "scripts/adapters/validation/player_save_migration_validator_adapter.gd"
    "scripts/tools/run_migration_validation.gd"
    "scenes/opening/opening.tscn"
    "scenes/opening/opening.gd"
    "scripts/adapters/validation/opening_cutscene_validator_adapter.gd"
    "scripts/adapters/validation/test_doubles/stub_video_stream.gd"
    "scripts/adapters/validation/test_doubles/stub_video_stream.tres"
    "scripts/tools/run_opening_cutscene_validation.gd"
    "scripts/core/contracts/prologue_battle_state.gd"
    "scripts/core/services/i_prologue_battle_service.gd"
    "scripts/core/prologue_battle_rules.gd"
    "scripts/adapters/battle/godot_prologue_battle_service.gd"
    "scripts/adapters/validation/first_battle_validator_adapter.gd"
    "scripts/tools/run_first_battle_validation.gd"
    "scenes/prologue/prologue_loadout.tscn"
    "scenes/prologue/prologue_loadout.gd"
    "scenes/prologue/prologue_battle.tscn"
    "scenes/prologue/prologue_battle.gd"
    "scenes/prologue/prologue_handoff.tscn"
    "scenes/prologue/prologue_handoff.gd"
    "assets/cutscenes/README.md"
    "export_presets.cfg"
  )

  missing=0
  for rel in "${required_files[@]}"; do
    if [ -f "$GODOT_CLIENT_DIR/$rel" ]; then
      echo "  OK   $rel"
    else
      echo "  MISS $rel"
      missing=1
    fi
  done

  echo
  if grep -q '^run/main_scene=' "$GODOT_CLIENT_DIR/project.godot" 2>/dev/null; then
    echo "  OK   project.godot declares run/main_scene"
  else
    echo "  MISS project.godot missing run/main_scene"
    missing=1
  fi

  if [ "$missing" -ne 0 ]; then
    echo "FAIL: one or more required skeleton files/keys are missing."
    overall_status=1
  else
    echo "PASS (structural only, see LIMITATION above): all required skeleton files are present."
  fi

  echo
  echo "-- Read-only fixture pack presence check (no Godot involved) --"
  FIXTURES_ROOT="$GODOT_CLIENT_DIR/../fixtures/clinica-golden/v1"
  if [ -f "$FIXTURES_ROOT/fixture-index.json" ]; then
    echo "  OK   fixtures/clinica-golden/v1/fixture-index.json exists (read-only reference, untouched)"
  else
    echo "  MISS fixtures/clinica-golden/v1/fixture-index.json not found at $FIXTURES_ROOT"
    overall_status=1
  fi
fi

echo
if [ "$overall_status" -eq 0 ]; then
  echo "== RESULT: PASS =="
else
  echo "== RESULT: FAIL =="
fi
exit "$overall_status"
