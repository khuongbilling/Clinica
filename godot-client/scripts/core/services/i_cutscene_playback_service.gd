class_name ICutscenePlaybackService
extends RefCounted
## Portable pre-rendered cutscene playback contract.
##
## This interface intentionally uses no engine-specific types in its method
## signatures (String ids/reasons only) so it stays a fair, portable
## contract for a future non-Godot adapter (see docs/MIGRATION.md §7). All
## concrete Godot behavior -- which node renders a video, how a resource is
## loaded, threaded vs. synchronous loading -- lives entirely in the
## adapter under scripts/adapters/cutscene/, never here.
##
## Hard rule (per docs/canonical-gameplay-contract.md): this service must
## never be a gameplay-authority source. play/skip/replay/trigger_fallback
## and the signals below are UX conveniences only. They must never grant a
## reward, unlock a gate, or write save/progression state. A caller wiring
## this service (e.g. an opening/cutscene presentation scene) is
## responsible for keeping it that way -- this contract cannot enforce it
## by itself, only document it.

## Emitted the moment playback of `cutscene_id` is requested, before the
## outcome (real playback vs. fallback) is known. Callers use this to show
## a loading indicator.
signal loading(cutscene_id: String)

## Emitted when `cutscene_id` finished playing to completion on its own.
signal finished(cutscene_id: String)

## Emitted when the user skipped `cutscene_id` before it finished.
signal skipped(cutscene_id: String)

## Emitted when `cutscene_id` could not be played (missing asset,
## unsupported/corrupt asset, or no display surface available) and the
## caller must gracefully proceed without having shown real video.
signal fallback_triggered(cutscene_id: String, reason: String)

## Starts (or restarts) playback of `cutscene_id`. Must emit `loading`
## first; the call then either results in real playback (later emitting
## `finished` or `skipped`) or in `fallback_triggered` if the configured
## asset is missing, unsupported, or cannot currently be displayed.
func play(_cutscene_id: String) -> void:
	push_error("ICutscenePlaybackService.play is abstract")

## Ends the current cutscene early as a user-driven skip. Emits `skipped`
## for the current cutscene id if one is in progress; a no-op otherwise.
func skip() -> void:
	push_error("ICutscenePlaybackService.skip is abstract")

## Restarts the current (or most recently played) cutscene id from the
## beginning. Presentation-only: replay must never itself be treated as a
## second/alternate completion path, and must never grant a reward, alter
## gating, or write save/progression state.
func replay() -> void:
	push_error("ICutscenePlaybackService.replay is abstract")

## Explicitly raises the missing/unsupported-asset fallback path for the
## current cutscene id. Promoted onto this interface (it was previously
## adapter-only behavior) so every adapter implementation is required to
## support the same graceful-degradation seam, and so presentation code and
## tests can trigger it directly without depending on adapter internals.
func trigger_fallback(_reason: String) -> void:
	push_error("ICutscenePlaybackService.trigger_fallback is abstract")

## Returns a caller-facing state string: one of "idle", "loading",
## "playing", "finished", "skipped", "fallback". Presentation-only
## bookkeeping -- never treat this as authority or as a save/progression
## flag.
func current_state() -> String:
	push_error("ICutscenePlaybackService.current_state is abstract")
	return "idle"
