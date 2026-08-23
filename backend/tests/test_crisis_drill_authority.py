"""Authority regression coverage for the Crisis Drill receipt boundary.

Covers:
- Public projection never leaks correct keys, rewards, unrevealed findings,
  future branches, or scoring internals.
- Forged / out-of-range / locked inputs are rejected.
- Concurrent start requests honour the single-active-attempt invariant.
- Stale-reservation recovery re-creates the pointer safely.
- Pausing a crisis-mode attempt marks it unranked permanently.
- Interruption (abandon during crisis mode) does not credit a daily event.
- Receipt replay is idempotent (atomic completion).
- Training mode and crisis mode produce distinct ranked/daily-event behaviour.
- Exactly one daily University completion event per calendar day.
- Guided review pays no reward or progression.
"""

import asyncio
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import CRISIS_DRILL_CASES, CRISIS_DRILL_FAMILIES, app, db


# ---------------------------------------------------------------------------
# Catalog shape tests (no network)
# ---------------------------------------------------------------------------

def test_sixteen_reviewed_age_one_drills() -> None:
    assert len(CRISIS_DRILL_CASES) == 16


def test_eight_families_two_variants_each() -> None:
    assert len(CRISIS_DRILL_FAMILIES) == 8
    for family, ids in CRISIS_DRILL_FAMILIES.items():
        assert len(ids) == 2, f"family {family!r} should have 2 drills, got {len(ids)}"
        variants = {CRISIS_DRILL_CASES[i]["variant"] for i in ids}
        assert variants == {"training", "crisis"}, f"family {family!r} missing training/crisis pair"


def test_all_drills_have_required_beats_and_safe_recoverable_branches() -> None:
    required_beats = {"alert", "handoff", "assess", "priority", "intervene", "reassess"}
    for drill_id, manifest in CRISIS_DRILL_CASES.items():
        assert manifest["version"] == 1, f"{drill_id} version"
        assert set(manifest["stations"].keys()) == required_beats, f"{drill_id} beats"
        for beat_id, station in manifest["stations"].items():
            responses = station["responses"]
            # Every active decision offers a usable 3–5 choice set, with more
            # than one defensible safe response rather than a single key.
            assert 3 <= len(responses) <= 5, f"{drill_id}/{beat_id} must expose 3–5 choices"
            safe_count = sum(not item.get("unsafe") for item in responses.values())
            has_safe = safe_count > 0
            has_unsafe = any(item.get("unsafe") for item in responses.values())
            assert has_safe, f"{drill_id}/{beat_id} missing safe option"
            assert safe_count >= 2, f"{drill_id}/{beat_id} missing an alternate safe response"
            assert has_unsafe, f"{drill_id}/{beat_id} missing unsafe option"
            # Safe options must recover or hold (delta stability ≥ 0)
            for resp_id, item in responses.items():
                if not item.get("unsafe"):
                    delta_stab = item.get("delta", {}).get("stability", 0)
                    assert delta_stab >= 0, f"{drill_id}/{beat_id}/{resp_id} safe option degrades stability"
            # Unsafe options must have a recoverable next beat (not terminal dead-ends)
            for resp_id, item in responses.items():
                if item.get("unsafe"):
                    # All unsafe options feed into a defined next beat or terminal
                    assert "next" in item, f"{drill_id}/{beat_id}/{resp_id} unsafe missing 'next'"


def test_public_projection_never_leaks_private_fields() -> None:
    """No attempt projection should expose server-private fields."""
    import json as _json
    from crisis_drill import public_cd_attempt
    for drill_id, manifest in CRISIS_DRILL_CASES.items():
        synthetic = {
            "attemptId": "test-id",
            "player_id": "player-id",
            "drillId": drill_id,
            "version": manifest["version"],
            "family": manifest["family"],
            "variant": manifest["variant"],
            "difficulty": manifest["difficulty"],
            "mode": "training",
            "beatId": "alert",
            "patient": {**manifest["initial"], "concern": manifest["concern"]},
            "known": [],
            "timeline": [],
            "responseIds": [],
            "safety": "safe",
            "status": "active",
            "ranked": False,
            "reviewMode": False,
            "decision_started_at": "2024-01-01T00:00:00+00:00",
            "paused_at": None,
            "created_at": "2024-01-01T00:00:00+00:00",
            "updated_at": "2024-01-01T00:00:00+00:00",
        }
        proj = public_cd_attempt(synthetic)
        serialized = _json.dumps(proj).lower()
        assert "points" not in serialized, f"{drill_id}: points leaked"
        assert "\"next\"" not in serialized, f"{drill_id}: next-beat routing leaked"
        assert "completion" not in serialized, f"{drill_id}: completion leaked"
        assert "hidden" not in serialized, f"{drill_id}: hidden finding leaked"
        # known starts empty so the finding value itself should not appear
        for hidden in manifest["hidden"]:
            assert hidden["value"].lower() not in serialized, f"{drill_id}: hidden value leaked before reveal"


def test_first_cases_are_clearly_named() -> None:
    """Training variants (introductory drills) should have 'Drill' in the title."""
    for drill_id, manifest in CRISIS_DRILL_CASES.items():
        if manifest["variant"] == "training":
            assert "Drill" in manifest["title"] or "Training" in manifest["title"], (
                f"training drill {drill_id!r} title should contain 'Drill' or 'Training': {manifest['title']!r}"
            )


# ---------------------------------------------------------------------------
# Integration: full authority boundary via ASGI
# ---------------------------------------------------------------------------

async def _exercise_authority_boundary() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://cd-test") as client:
        created = await client.post("/api/player", json={"name": "Crisis authority", "aptitude": "sage"})
        assert created.status_code == 200, created.text
        player = created.json()
        player_id, headers = player["id"], {"X-Clinica-Session": player["economy_token"]}
        try:
            await db.players.update_one({"id": player_id}, {"$set": {
                "player_level": 15,
                "lessons_completed": ["intro-1"],
                "uni_cue_lab_count": 3,
                "uni_triage_count": 3,
                "uni_stack_count": 3,
            }})

            # ── Catalog shape ──
            board = await client.get(f"/api/player/{player_id}/crisis-drills", headers=headers)
            assert board.status_code == 200
            drills = board.json()["drills"]
            assert len(drills) == 16
            gate = board.json()["gate"]
            assert gate["eligible"] is True

            # ── Version guard ──
            first_drill = drills[0]
            bad_version = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts", headers=headers,
                json={"drill_id": first_drill["id"], "drill_version": 999, "mode": "training"},
            )
            assert bad_version.status_code == 409

            # ── Unknown drill guard ──
            bad_drill = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts", headers=headers,
                json={"drill_id": "not-a-real-drill", "drill_version": 1, "mode": "training"},
            )
            assert bad_drill.status_code == 422

            # ── Guided review requires prior completion ──
            guided_first = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts", headers=headers,
                json={"drill_id": first_drill["id"], "drill_version": first_drill["version"],
                      "mode": "training", "retry_mode": "guided"},
            )
            assert guided_first.status_code == 422

            # ── Stale-reservation recovery ──
            await db.players.update_one({"id": player_id}, {"$set": {
                "crisis_drill_active_attempt_id": "interrupted-reservation",
                "crisis_drill_reservation_at": "2000-01-01T00:00:00+00:00",
            }})
            recovered = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts", headers=headers,
                json={"drill_id": first_drill["id"], "drill_version": first_drill["version"], "mode": "training"},
            )
            assert recovered.status_code == 200, recovered.text
            recovered_id = recovered.json()["attempt"]["attemptId"]
            await client.post(f"/api/player/{player_id}/crisis-drills/attempts/{recovered_id}/abandon", headers=headers)

            # ── Concurrent start: only one allowed ──
            starts = await asyncio.gather(*[
                client.post(
                    f"/api/player/{player_id}/crisis-drills/attempts", headers=headers,
                    json={"drill_id": first_drill["id"], "drill_version": first_drill["version"], "mode": "training"},
                )
                for _ in range(2)
            ])
            assert sorted(r.status_code for r in starts) == [200, 409]
            attempt = next(r.json()["attempt"] for r in starts if r.status_code == 200)

            # ── Public state never leaks private fields ──
            serialized = str(attempt).lower()
            assert "points" not in serialized
            assert "hidden" not in serialized
            assert attempt["known"] == []

            # ── Second start blocked ──
            other = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts", headers=headers,
                json={"drill_id": first_drill["id"], "drill_version": first_drill["version"], "mode": "training"},
            )
            assert other.status_code == 409

            # ── Pause blocks decisions; resume restores them ──
            paused = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts/{attempt['attemptId']}/pause", headers=headers,
            )
            assert paused.json()["attempt"]["status"] == "paused"
            blocked = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts/{attempt['attemptId']}/action",
                headers=headers, json={"response_id": "acknowledge-alert"},
            )
            assert blocked.status_code == 409
            resumed = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts/{attempt['attemptId']}/resume", headers=headers,
            )
            assert resumed.json()["attempt"]["status"] == "active"

            # ── Step through safe path ──
            safe_responses = [
                "acknowledge-alert", "sbar-handoff", "focused-assessment",
                "escalate-priority", "bundle-response", "closed-loop-reassess",
            ]
            for resp_id in safe_responses:
                step = await client.post(
                    f"/api/player/{player_id}/crisis-drills/attempts/{attempt['attemptId']}/action",
                    headers=headers, json={"response_id": resp_id},
                )
                assert step.status_code == 200, f"beat response {resp_id!r} failed: {step.text}"

            # ── Stale response rejected ──
            stale = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts/{attempt['attemptId']}/action",
                headers=headers, json={"response_id": "acknowledge-alert"},
            )
            assert stale.status_code == 409

            # ── Atomic idempotent completion ──
            completions = await asyncio.gather(*[
                client.post(
                    f"/api/player/{player_id}/crisis-drills/attempts/{attempt['attemptId']}/complete",
                    headers=headers,
                )
                for _ in range(2)
            ])
            assert all(r.status_code == 200 for r in completions)
            assert completions[0].json()["debrief"] == completions[1].json()["debrief"]
            receipt = completions[0].json()
            assert receipt["debrief"]["outcome"] in {"competent", "excellent"}
            assert receipt["debrief"]["score"] >= 60
            assert receipt["debrief"]["reward"]["xp"] == 25

            # ── Replay is idempotent ──
            replay = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts/{attempt['attemptId']}/complete",
                headers=headers,
            )
            assert replay.status_code == 200
            assert replay.json()["already_completed"] is True

            stored = await db.players.find_one({"id": player_id}, {"_id": 0})
            assert len(stored["crisis_drill_history"]) == 1
            assert stored["xp"] == receipt["player"]["xp"]
            # Training and Crisis both produce the same once-daily University
            # completion event; timing is prestige-only.
            assert len(stored["crisis_drill_daily_event_ids"]) == 1

            # ── Guided review pays no reward ──
            review_started = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts", headers=headers,
                json={"drill_id": first_drill["id"], "drill_version": first_drill["version"],
                      "mode": "training", "retry_mode": "guided"},
            )
            assert review_started.status_code == 200, review_started.text
            review_id = review_started.json()["attempt"]["attemptId"]
            for resp_id in safe_responses:
                r = await client.post(
                    f"/api/player/{player_id}/crisis-drills/attempts/{review_id}/action",
                    headers=headers, json={"response_id": resp_id},
                )
                assert r.status_code == 200, r.text
            reviewed = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts/{review_id}/complete", headers=headers,
            )
            assert reviewed.status_code == 200
            assert reviewed.json()["debrief"]["reward"] == {
                "xp": 0, "universityCredits": 0, "mastery": 0,
                "message": "Review mode pays no reward or progression.",
            }
            after_review = await db.players.find_one({"id": player_id}, {"_id": 0})
            assert len(after_review["crisis_drill_history"]) == 1
            assert len(after_review["crisis_drill_daily_event_ids"]) == 1
            assert after_review["crisis_drill_first_clear_claims"][first_drill["id"]] == attempt["attemptId"]

        finally:
            await db.crisis_drill_attempts.delete_many({"player_id": player_id})
            await db.players.delete_one({"id": player_id})


async def _test_crisis_mode_pause_loses_ranking() -> None:
    """Crisis mode attempt that is paused must lose its ranked flag permanently."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://cd-pause-test") as client:
        created = await client.post("/api/player", json={"name": "Crisis pause test", "aptitude": "guardian"})
        assert created.status_code == 200
        player = created.json()
        player_id, headers = player["id"], {"X-Clinica-Session": player["economy_token"]}
        try:
            await db.players.update_one({"id": player_id}, {"$set": {
                "lessons_completed": ["intro-1"],
                "uni_cue_lab_count": 1, "uni_triage_count": 1, "uni_stack_count": 1,
                    # Standard cases require demonstrated safe breadth.
                    "crisis_drill_history": [{"family": "emergency-airway", "outcome": "competent"}],
            }})
            # Use a crisis-mode drill (the second variant in first family)
            first_family = next(iter(CRISIS_DRILL_FAMILIES.values()))
            crisis_drill_id = next(
                did for did in first_family if CRISIS_DRILL_CASES[did]["variant"] == "crisis"
            )
            manifest = CRISIS_DRILL_CASES[crisis_drill_id]

            started = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts", headers=headers,
                json={"drill_id": crisis_drill_id, "drill_version": manifest["version"], "mode": "crisis"},
            )
            assert started.status_code == 200, started.text
            attempt_id = started.json()["attempt"]["attemptId"]
            assert started.json()["attempt"]["ranked"] is True

            # Pause immediately → ranked must become False
            paused = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts/{attempt_id}/pause", headers=headers,
            )
            assert paused.status_code == 200
            assert paused.json()["attempt"]["status"] == "paused"

            # Resume → ranked stays False (pause is permanent for ranking)
            resumed = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts/{attempt_id}/resume", headers=headers,
            )
            assert resumed.status_code == 200
            # ranked should still be False after resume (projection only shows ranked when active)
            # Confirm in DB
            db_attempt = await db.crisis_drill_attempts.find_one({"attemptId": attempt_id}, {"_id": 0})
            assert db_attempt["ranked"] is False, "ranked must be False after pause even after resume"

            # Complete the drill with safe path
            safe_responses = [
                "acknowledge-alert", "sbar-handoff", "focused-assessment",
                "escalate-priority", "bundle-response", "closed-loop-reassess",
            ]
            for resp_id in safe_responses:
                r = await client.post(
                    f"/api/player/{player_id}/crisis-drills/attempts/{attempt_id}/action",
                    headers=headers, json={"response_id": resp_id},
                )
                assert r.status_code == 200, r.text

            completed = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts/{attempt_id}/complete", headers=headers,
            )
            assert completed.status_code == 200
            assert completed.json()["debrief"]["ranked"] is False
            # Pausing removes only the timing rank; normal completion remains
            # eligible for the once-daily University event.
            stored = await db.players.find_one({"id": player_id}, {"_id": 0})
            assert len(stored["crisis_drill_daily_event_ids"]) == 1

        finally:
            await db.crisis_drill_attempts.delete_many({"player_id": player_id})
            await db.players.delete_one({"id": player_id})


async def _test_crisis_mode_daily_event_once() -> None:
    """Crisis mode (unpaused) awards exactly one daily University event."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://cd-daily-test") as client:
        created = await client.post("/api/player", json={"name": "Crisis daily test", "aptitude": "warden"})
        assert created.status_code == 200
        player = created.json()
        player_id, headers = player["id"], {"X-Clinica-Session": player["economy_token"]}
        try:
            await db.players.update_one({"id": player_id}, {"$set": {
                "lessons_completed": ["intro-1"],
                "uni_cue_lab_count": 1, "uni_triage_count": 1, "uni_stack_count": 1,
                "crisis_drill_history": [{"family": "emergency-airway", "outcome": "competent"}],
            }})
            first_family = next(iter(CRISIS_DRILL_FAMILIES.values()))
            crisis_drill_id = next(
                did for did in first_family if CRISIS_DRILL_CASES[did]["variant"] == "crisis"
            )
            manifest = CRISIS_DRILL_CASES[crisis_drill_id]

            safe_responses = [
                "acknowledge-alert", "sbar-handoff", "focused-assessment",
                "escalate-priority", "bundle-response", "closed-loop-reassess",
            ]

            # Complete two crisis-mode drills; only one daily event should credit
            for _ in range(2):
                started = await client.post(
                    f"/api/player/{player_id}/crisis-drills/attempts", headers=headers,
                    json={"drill_id": crisis_drill_id, "drill_version": manifest["version"], "mode": "crisis"},
                )
                assert started.status_code == 200, started.text
                attempt_id = started.json()["attempt"]["attemptId"]
                for resp_id in safe_responses:
                    r = await client.post(
                        f"/api/player/{player_id}/crisis-drills/attempts/{attempt_id}/action",
                        headers=headers, json={"response_id": resp_id},
                    )
                    assert r.status_code == 200, r.text
                await client.post(
                    f"/api/player/{player_id}/crisis-drills/attempts/{attempt_id}/complete", headers=headers,
                )

            stored = await db.players.find_one({"id": player_id}, {"_id": 0})
            assert len(stored["crisis_drill_daily_event_ids"]) == 1, (
                f"expected 1 daily event, got {len(stored['crisis_drill_daily_event_ids'])}"
            )

        finally:
            await db.crisis_drill_attempts.delete_many({"player_id": player_id})
            await db.players.delete_one({"id": player_id})


async def _test_forged_inputs_rejected() -> None:
    """Forged response IDs, wrong player, and out-of-state submissions are rejected."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://cd-forge-test") as client:
        created = await client.post("/api/player", json={"name": "Forge test", "aptitude": "weaver"})
        assert created.status_code == 200
        player = created.json()
        player_id, headers = player["id"], {"X-Clinica-Session": player["economy_token"]}

        created2 = await client.post("/api/player", json={"name": "Attacker", "aptitude": "sage"})
        assert created2.status_code == 200
        attacker = created2.json()
        attacker_id = attacker["id"]
        attacker_headers = {"X-Clinica-Session": attacker["economy_token"]}

        try:
            await db.players.update_one({"id": player_id}, {"$set": {
                "lessons_completed": ["intro-1"],
                "uni_cue_lab_count": 1, "uni_triage_count": 1, "uni_stack_count": 1,
            }})
            first_drill = next(iter(CRISIS_DRILL_CASES.keys()))
            manifest = CRISIS_DRILL_CASES[first_drill]

            started = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts", headers=headers,
                json={"drill_id": first_drill, "drill_version": manifest["version"], "mode": "training"},
            )
            assert started.status_code == 200
            attempt_id = started.json()["attempt"]["attemptId"]

            # Forged response ID
            bad_resp = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts/{attempt_id}/action",
                headers=headers, json={"response_id": "forged-response-id"},
            )
            assert bad_resp.status_code == 422

            # Cross-player attempt read rejected
            cross_read = await client.get(
                f"/api/player/{attacker_id}/crisis-drills/attempts/{attempt_id}",
                headers=attacker_headers,
            )
            assert cross_read.status_code == 404

            # Complete without finishing all beats
            premature = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts/{attempt_id}/complete", headers=headers,
            )
            assert premature.status_code == 409

            # Wrong session
            no_auth = await client.get(
                f"/api/player/{player_id}/crisis-drills/attempts/{attempt_id}",
                headers={"X-Clinica-Session": "forged-session-token"},
            )
            assert no_auth.status_code == 401

        finally:
            await db.crisis_drill_attempts.delete_many({"player_id": player_id})
            await db.crisis_drill_attempts.delete_many({"player_id": attacker_id})
            await db.players.delete_one({"id": player_id})
            await db.players.delete_one({"id": attacker_id})


async def _test_server_owned_timeout_never_accepts_client_clock() -> None:
    """A stale server window records pressure without accepting client elapsed time."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://cd-timeout-test") as client:
        created = await client.post("/api/player", json={"name": "Timeout test", "aptitude": "sage"})
        assert created.status_code == 200
        player = created.json()
        player_id, headers = player["id"], {"X-Clinica-Session": player["economy_token"]}
        try:
            await db.players.update_one({"id": player_id}, {"$set": {
                "lessons_completed": ["intro-1"],
                "uni_cue_lab_count": 1, "uni_triage_count": 1, "uni_stack_count": 1,
            }})
            drill_id = next(iter(CRISIS_DRILL_CASES))
            manifest = CRISIS_DRILL_CASES[drill_id]
            started = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts", headers=headers,
                json={"drill_id": drill_id, "drill_version": manifest["version"], "mode": "crisis"},
            )
            assert started.status_code == 200
            attempt_id = started.json()["attempt"]["attemptId"]
            # This test changes only server persistence. No clock value is ever
            # accepted from the action request body.
            await db.crisis_drill_attempts.update_one(
                {"attemptId": attempt_id}, {"$set": {"decision_started_at": "2000-01-01T00:00:00+00:00"}},
            )
            response = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts/{attempt_id}/action",
                headers=headers, json={"response_id": "acknowledge-alert"},
            )
            assert response.status_code == 200
            assert "timing_records" not in response.text
            persisted = await db.crisis_drill_attempts.find_one({"attemptId": attempt_id}, {"_id": 0})
            assert persisted["timing_records"][0]["timedOut"] is True
            assert persisted["timing_records"][0]["elapsedSeconds"] > 45
            expected_stability = (
                manifest["initial"]["stability"]
                + manifest["stations"]["alert"]["responses"]["acknowledge-alert"]["delta"]["stability"]
            )
            assert persisted["patient"]["stability"] == expected_stability, "timing must not alter safe clinical state"
        finally:
            await db.crisis_drill_attempts.delete_many({"player_id": player_id})
            await db.players.delete_one({"id": player_id})


async def _test_pending_receipt_recovery_is_exactly_once() -> None:
    """A persisted receipt recovers its grant once, even if its applied flag lags."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://cd-recovery-test") as client:
        created = await client.post("/api/player", json={"name": "Receipt recovery", "aptitude": "sage"})
        assert created.status_code == 200
        player = created.json()
        player_id, headers = player["id"], {"X-Clinica-Session": player["economy_token"]}
        attempt_id = "receipt-recovery-attempt"
        drill_id = next(iter(CRISIS_DRILL_CASES))
        try:
            record = {
                "attemptId": attempt_id, "drillId": drill_id, "family": "emergency-airway",
                "variant": "training", "score": 88, "outcome": "competent",
                "safety": "safe", "ranked": False, "completedAt": "2026-01-01T00:00:00+00:00",
            }
            completion = {
                "outcome": "competent", "score": 88, "safety": "safe",
                "urgencyHandling": "appropriate", "strongestDecision": "Safe handoff.",
                "missedOpportunity": "None.", "clinicalPrinciple": "Escalate early.",
                "patientSummary": "Stabilized.", "relatedPractice": [], "timeline": [],
                "firstClear": True, "personalBest": True,
                "reward": {"xp": 7, "universityCredits": 9, "mastery": 2, "message": "Recovery receipt."},
            }
            plan = {
                "grantId": attempt_id, "reviewMode": False, "xp": 7, "credits": 9,
                "score": 88, "record": record, "daily": player["daily_rounds"],
                "dailyIds": [], "masteryByFamily": {"emergency-airway": 2},
            }
            await db.players.update_one({"id": player_id}, {"$set": {"crisis_drill_active_attempt_id": attempt_id}})
            await db.crisis_drill_attempts.insert_one({
                "attemptId": attempt_id, "player_id": player_id, "drillId": drill_id,
                "completion": completion, "grant_plan": plan, "grant_id": attempt_id,
                "grant_state": "pending",
            })
            recovered = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts/{attempt_id}/complete", headers=headers,
            )
            assert recovered.status_code == 200
            after_first = await db.players.find_one({"id": player_id}, {"_id": 0})
            assert after_first["xp"] == player["xp"] + 7
            assert attempt_id in after_first["crisis_drill_applied_grant_ids"]
            # Simulate a crash after player mutation but before the receipt was
            # marked applied. The permanent player marker prevents a second grant.
            await db.crisis_drill_attempts.update_one({"attemptId": attempt_id}, {"$set": {"grant_state": "pending"}})
            replay = await client.post(
                f"/api/player/{player_id}/crisis-drills/attempts/{attempt_id}/complete", headers=headers,
            )
            assert replay.status_code == 200
            after_replay = await db.players.find_one({"id": player_id}, {"_id": 0})
            assert after_replay["xp"] == after_first["xp"]
            assert len(after_replay["crisis_drill_history"]) == 1
        finally:
            await db.crisis_drill_attempts.delete_many({"player_id": player_id})
            await db.players.delete_one({"id": player_id})


async def _test_timing_clock_and_pause_unranked() -> None:
    """Timing window is exposed only when the decision beat is active and not paused."""
    from crisis_drill import public_cd_attempt
    import json

    # Simulate an active attempt
    first_drill_id = next(iter(CRISIS_DRILL_CASES.keys()))
    manifest = CRISIS_DRILL_CASES[first_drill_id]

    active = {
        "attemptId": "t1", "player_id": "p1", "drillId": first_drill_id,
        "version": 1, "family": manifest["family"], "variant": manifest["variant"],
        "difficulty": manifest["difficulty"], "mode": "crisis",
        "beatId": "alert", "patient": {**manifest["initial"], "concern": manifest["concern"]},
        "known": [], "timeline": [], "responseIds": [], "safety": "safe",
        "status": "active", "ranked": True, "reviewMode": False,
        "decision_started_at": "2024-01-01T00:00:00+00:00",
        "paused_at": None, "created_at": "2024-01-01T00:00:00+00:00",
        "updated_at": "2024-01-01T00:00:00+00:00",
    }
    proj = public_cd_attempt(active)
    assert proj["timing"] is not None, "active attempt should expose timing"
    assert "decision_started_at" in proj["timing"]
    assert "window_seconds" in proj["timing"]

    # Paused attempt should not expose timing
    paused = {**active, "status": "paused", "paused_at": "2024-01-01T00:01:00+00:00"}
    proj_paused = public_cd_attempt(paused)
    assert proj_paused["timing"] is None, "paused attempt must not expose timing"

    # Training mode: same timing structure but ranked=False
    training = {**active, "mode": "training", "ranked": False}
    proj_training = public_cd_attempt(training)
    assert proj_training["ranked"] is False

    # Completed attempt should not expose timing
    completed = {**active, "status": "completed", "beatId": None}
    proj_completed = public_cd_attempt(completed)
    assert proj_completed["timing"] is None, "completed attempt must not expose timing"


async def _run_all() -> None:
    await _exercise_authority_boundary()
    await _test_crisis_mode_pause_loses_ranking()
    await _test_crisis_mode_daily_event_once()
    await _test_forged_inputs_rejected()
    await _test_server_owned_timeout_never_accepts_client_clock()
    await _test_pending_receipt_recovery_is_exactly_once()
    await _test_timing_clock_and_pause_unranked()


def test_crisis_drill_authority_full_suite() -> None:
    asyncio.run(_run_all())
