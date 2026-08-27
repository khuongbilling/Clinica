# M2-P1 Verification Report — Opening Shell + Real Cutscene Playback

This records exactly what was checked for the M2-P1 push, in the same
environment used for M1-P1/M1-P2 (Godot 4.4.1.stable via this workspace's
Nix environment), and what remains an explicit, documented scope boundary
rather than a silently-skipped check.

## 1. What M2-P1 adds

A real, video-backed implementation of `ICutscenePlaybackService`
(`scripts/adapters/cutscene/cutscene_playback_service.gd`), and a new
`Opening` scene (`scenes/opening/`) inserted between `Boot` and
`AppShell` that hosts it: loading state, mobile-friendly Skip and Replay
controls, and a genuine missing/unsupported-asset fallback. See
`docs/MIGRATION.md` §11 for the full design write-up.

## 2. Environment

- Godot 4.4.1.stable, invoked headlessly, same binary/setup as
  M1-P1/M1-P2 (see `docs/M1-P1-VERIFICATION.md` §2 for provisioning).
- No changes were made to `replit.nix`, application dependencies, or
  lockfiles for this push.

## 3. Checks run and results

### 3.1 Real-engine import/parse

```sh
godot --headless --path godot-client --import
```

Result: **PASS** — all new files (`opening.gd`, `opening.tscn`,
`stub_video_stream.gd`, `stub_video_stream.tres`,
`opening_cutscene_validator_adapter.gd`,
`run_opening_cutscene_validation.gd`) plus the two rewritten files
(`i_cutscene_playback_service.gd`, `cutscene_playback_service.gd`) and the
one edited file (`boot.gd`) parse and import without error, including
global class name registration (`CutscenePlaybackService`,
`StubVideoStream`, `OpeningCutsceneValidatorAdapter`,
`ICutscenePlaybackService`).

### 3.2 Headless boot smoke test — full chain (regression + new)

```sh
godot --headless --path godot-client --quit-after 6 res://scenes/boot/boot.tscn
```

Result: **PASS**. Log output confirms the entire real chain runs
headlessly, in order, with no error:

```
[INFO][composition_root] Services composed for M1-P1 skeleton.
[INFO][boot] Clinica Godot client skeleton booting (M1-P1/M2-P1).
[INFO][opening] Opening shell ready; starting cutscene playback.
[INFO][cutscene] play('opening'): no asset at 'res://assets/cutscenes/opening.ogv'; falling back.
[INFO][opening] Cutscene fallback triggered: missing_asset
[INFO][app_shell] AppShell ready.
```

This is the real, honest missing-asset fallback (§11.2 of
`docs/MIGRATION.md`) firing in a genuine headless engine run, not a
simulated/mocked path — `Boot` navigated to `Opening`, `Opening` bound a
real `VideoStreamPlayer`, `CutscenePlaybackService` genuinely found no
asset at the manifest path, emitted `fallback_triggered`, and the scene
converged on `AppShell` through the one shared transition function.

### 3.3 Headless opening-scene direct smoke test (new)

```sh
godot --headless --path godot-client --quit-after 4 res://scenes/opening/opening.tscn
```

Result: **PASS** — same convergent chain confirmed when `Opening` is the
entry scene directly (not only via `Boot`), i.e. the scene is
self-sufficient and does not implicitly depend on state `Boot` would have
set up.

### 3.4 Existing fixture/hash validator (regression, all 10 fixtures)

```sh
godot --headless --path godot-client --script res://scripts/tools/run_fixture_validation.gd
```

Result: **PASS** — 68 checks, 0 failures. Unchanged from M1-P2; this push
did not touch `fixture_validator_adapter.gd` or `fixtures/clinica-golden/v1/`.

### 3.5 Existing migration validator (regression)

```sh
godot --headless --path godot-client --script res://scripts/tools/run_migration_validation.gd
```

Result: **PASS** — 41 checks, 0 failures. Unchanged from M1-P2; this push
did not touch `scripts/core/migration/` or its validator/tool.

### 3.6 New opening/cutscene validator

```sh
godot --headless --path godot-client --script res://scripts/tools/run_opening_cutscene_validation.gd
```

Result: **PASS** — 40 checks, 0 failures. All checks are native
(GDScript-only; there is no golden-fixture entry for cutscene playback).

| Area | Native checks | What it proves |
| --- | --- | --- |
| Interface shape | `adapter_extends_interface`, `interface_declares_trigger_fallback`, `interface_declares_current_state` | The real adapter satisfies the (now-expanded) interface; the interface itself declares the new abstract members. |
| Initial state | `initial_state_is_idle` | `current_state()` starts at `"idle"` before any `play()` call. |
| Missing-asset fallback | `missing_asset_emits_loading_then_fallback`, `missing_asset_fallback_reason`, `missing_asset_state_is_fallback`, `missing_asset_no_finished_or_skipped` | The **real** missing-asset path (no fabricated file): `loading` fires, then `fallback_triggered("opening", "missing_asset")`, and neither `finished` nor `skipped` also fires. |
| Unsupported-asset fallback | `unsupported_asset_fixture_exists`, `unsupported_asset_triggers_fallback` | Using a real, already-existing non-video repository file (`composition_root.gd`, injected via the test-only `extra_asset_paths` constructor param) proves the wrong-resource-type branch without a fabricated/corrupt file. |
| No-display-node fallback | `stub_video_stream_is_real_video_stream_type`, `no_display_node_triggers_fallback` | `StubVideoStream` — an explicitly labeled, contentless test double that is genuinely `is VideoStream` — proves the "resolved but unbound" branch without ever calling `.play()` on a real player or claiming any video played. |
| Skip semantics | `skip_is_noop_after_fallback`, `manual_skip_emits_skipped_and_sets_state` | `skip()` is a no-op once already in a terminal state, and (via a safe, real but stream-less `VideoStreamPlayer.stop()` call) correctly transitions `PLAYING -> SKIPPED` and emits `skipped`. |
| Finish semantics | `manual_finish_emits_finished_and_sets_state`, `finish_does_not_double_emit` | The exact handler `VideoStreamPlayer.finished` invokes in production (`_on_video_player_finished`) correctly transitions `PLAYING -> FINISHED`, emits once, and does not double-fire on a spurious repeat call. See §4 for why this is white-box rather than a full real-decode test. |
| Replay | `replay_reinvokes_play_for_same_id` | `replay()` re-invokes `play()` with the same id (observed via `loading`/`fallback_triggered` firing twice). |
| `trigger_fallback` | `trigger_fallback_emits_with_reason`, `trigger_fallback_sets_state` | The now-promoted interface method emits with the caller-supplied reason and sets state to `fallback`. |
| Authority isolation | `cutscene_service_no_reference_to:*`, `opening_scene_no_reference_to:*` (5 forbidden substrings each) | Source-text regression guard: neither `cutscene_playback_service.gd` nor `opening.gd` reference `Services.save_cache`, `Services.app_state`, `Services.api_transport`, `PlayerEnvelope`, or `player_save_migration`. |
| Wiring regression | `boot_navigates_to_opening_route`, `boot_changes_scene_to_opening_tscn`, `opening_navigates_to_app_shell_route`, `opening_changes_scene_to_app_shell_tscn` | `boot.gd` targets `opening`; `opening.gd` targets `app_shell` — guards the intended scene chain against silent drift. |
| Convergence | `advance_to_app_shell_called_from_exactly_three_sites`, `advance_to_app_shell_has_exactly_one_definition`, `replay_handler_found`, `replay_never_calls_advance_to_app_shell`, `replay_never_navigates_directly` | Source-level proof that exactly one transition function exists, is called from exactly three places (finished/skipped/fallback), and that the replay handler is not a fourth call site and never navigates on its own. |

### 3.7 `validate_skeleton.sh` (regression + new steps)

```sh
bash godot-client/tools/validate_skeleton.sh
```

Result: **PASS** — now runs 5 headless steps (fixture validator, boot
smoke test through the full boot→opening→app_shell chain, opening-scene
direct smoke test, migration validator, opening/cutscene validator), plus
the updated structural file-presence list (includes all new M2-P1 files
and the previously-unlisted M1-P2 migration files).

## 4. Self-audit findings

- **Duplicate authorities / parallel effect paths:** none introduced. The
  interface remains the single seam (`Services.cutscene`); no second
  cutscene-playback code path exists anywhere in `scenes/` or
  `scripts/adapters/`.
- **Convergence:** verified both by real headless engine runs (§3.2, §3.3)
  and by an automated source-level check (§3.6, "Convergence" row) that
  there is exactly one shared transition function and exactly three call
  sites for it, with replay excluded by construction.
- **Replay as a second completion path:** explicitly checked and rejected
  — `replay_never_calls_advance_to_app_shell` and
  `replay_never_navigates_directly` both pass; `_on_replay_pressed` is also
  guarded by the same one-shot `_transitioned` flag as every other action
  in the scene, so it cannot fire after the transition has already begun.
- **Save/reward/progression coupling:** none. `opening.gd` and
  `cutscene_playback_service.gd` reference no save cache, app state,
  network transport, or player envelope symbol at all — this is verified
  automatically (§3.6, "Authority isolation" row), not asserted only by
  code review.
- **Honesty of the fallback tests:** the missing-asset case uses the
  actual current absence of `assets/cutscenes/opening.ogv` (§3.2's log
  output is the real, non-simulated proof). The unsupported-asset case
  uses a real, already-existing non-video repository file rather than a
  fabricated one. The no-display-node case uses `StubVideoStream`, an
  explicitly labeled, contentless test double (no frames, no audio, never
  played back) — chosen deliberately over fabricating or embedding any
  actual cinematic content, which was explicitly out of scope.
- **Known, documented white-box scope boundary (not a silently-skipped
  check):** a full real-video decode-to-`finished` integration test cannot
  be run headlessly in this environment without an actual pre-rendered
  asset, and creating one was explicitly out of scope for this push. The
  `manual_finish_emits_finished_and_sets_state` check instead drives the
  exact same private handler (`_on_video_player_finished`) that
  `VideoStreamPlayer.finished` would invoke in production, after placing
  the service in the `PLAYING` state it would have reached via a real
  bound player. This proves the state-machine transition and signal
  contract are correct; it does not prove GPU/audio video decode works on
  this machine. That remains true only once a real asset is dropped in per
  `assets/cutscenes/README.md`, at which point §3.2's exact same headless
  boot command will exercise the real decode path with no code change.
- **Frontend/backend/runtime behavior:** untouched. No files under
  `frontend/`, `backend/`, or the repository root package manifests were
  modified by this push; only `godot-client/` and its docs changed.
- **ENGINE LOCK-IN:** stays **LOW** for `scripts/core/` — the interface
  (`i_cutscene_playback_service.gd`) remains `RefCounted`-only with
  `String`-only signatures, referencing no Godot node type. The
  engine-specific edge that would need a rewrite for a different engine
  (or a different Godot video approach) is exactly
  `scripts/adapters/cutscene/cutscene_playback_service.gd` and
  `scenes/opening/` — consistent with the pattern already established in
  `docs/MIGRATION.md` §7.

No BLOCKER or HIGH issues were found during this audit.

## 5. Explicitly out of scope (see `docs/MIGRATION.md` §11.4)

The actual pre-rendered cinematic video file, a post-transition "watch
again" screen, threaded/async resource loading, and any change to
`PlayerEnvelope`, save migrations, Journey/combat/Realm/economy/inventory/
recruitment/Player-Hero creation, backend authority, the Expo frontend, or
any lockfile — unchanged and not silently patched by this push.
