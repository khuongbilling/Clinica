---
name: Fog-map legacy run normalization
description: Persisted journey runs can outlive TileVisibility renames; normalize on read in the repository
---

**Rule:** Any rename of persisted enum values (e.g. TileVisibility hidden/frontier/revealed → unexplored/visibleNow/exploredButOutOfVision) must ship a read-side normalizer in `journeyRunRepository.fromWire` — the backend stores tiles as opaque JSON, so old runs come back with old strings forever.

**Why:** After the Push 15 rename, a pre-rename active run rendered with no terrain, no fog, no current tile, and rejected all movement (validateMove requires 'visibleNow'/'exploredButOutOfVision'). Legacy runs also never persisted a frontier at all (old renderer derived it at display time), so after name-mapping the fog ring must be recomputed via `computeFogAfterMove(tiles, current_tile_id, REVEAL_RADIUS)`.

**How to apply:** Gate reconstruction on actual legacy evidence (an old string present in the wire tiles), never on "no visibleNow tiles" alone — canonical runs can legitimately have an empty frontier (fully explored map, expanded vision radius) and `computeFogAfterMove` force-mutates visited/current flags. Saving writes canonical names back, so runs self-migrate on first move.

**Debugging gotchas from the same session:**
- Metro in CI mode can serve a stale bundle for edits to existing files too — DOM symptoms (old zIndex strata, legacy a11y labels) prove staleness; restart `Start application`.
- The Screenshot tool sometimes returns a solid white page for a route that renders fine in a real browser (testing subagent confirmed both routes OK) — don't trust one white capture; cross-check with the testing agent.
- Expo `--tunnel` mode can flap with "ngrok tunnel already exists" (server-side stale sessions); web-only `CI=1 npx expo start --web --port 5000` is the reliable dev command.
- Fresh browser sessions with no `clinica.player.v2` in localStorage show the static fixture map (ids t00…) where taps are intentional no-ops — seed localStorage from `/api/player/<id>` before e2e-testing run flows.
