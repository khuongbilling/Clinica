"""Authority regression coverage for the Grand Rounds receipt boundary."""
import asyncio
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import GRAND_ROUNDS_CASES, app, db


def test_twelve_reviewed_age_one_cases_have_private_branch_contracts() -> None:
    assert len(GRAND_ROUNDS_CASES) == 12
    assert "gr-grand-convergence" in GRAND_ROUNDS_CASES
    for manifest in GRAND_ROUNDS_CASES.values():
        assert manifest["version"] == 1
        assert manifest["estimatedMinutes"] in {15, 20, 25, 30}
        assert {"observe", "priority", "intervene", "complication", "reassess"} == set(manifest["stations"])
        assert any(item.get("unsafe") for station in manifest["stations"].values() for item in station["responses"].values())


async def _exercise_authority_boundary() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://rounds-test") as client:
        created = await client.post("/api/player", json={"name": "Rounds authority", "aptitude": "sage"})
        assert created.status_code == 200, created.text
        player = created.json()
        player_id, headers = player["id"], {"X-Clinica-Session": player["economy_token"]}
        try:
            await db.players.update_one({"id": player_id}, {"$set": {
                "player_level": 20, "lessons_completed": ["intro-1"],
                "uni_cue_lab_count": 4, "uni_triage_count": 4, "uni_stack_count": 4,
            }})
            board = await client.get(f"/api/player/{player_id}/grand-rounds", headers=headers)
            assert board.status_code == 200
            assert len(board.json()["cases"]) == 12
            first = next(item for item in board.json()["cases"] if item["id"] == "gr-airway-quiet-decline")
            start_payload = {"case_id": first["id"], "case_version": first["version"], "retry_mode": "fresh_case"}
            guided_first = await client.post(f"/api/player/{player_id}/grand-rounds/attempts", headers=headers, json={
                **start_payload, "retry_mode": "guided",
            })
            assert guided_first.status_code == 422
            # A process that died after reserving its pointer must not strand
            # the player; an expired reservation is fenced and replaced safely.
            await db.players.update_one({"id": player_id}, {"$set": {
                "grand_rounds_active_attempt_id": "interrupted-reservation",
                "grand_rounds_reservation_at": "2000-01-01T00:00:00+00:00",
            }})
            recovered_start = await client.post(f"/api/player/{player_id}/grand-rounds/attempts", headers=headers, json=start_payload)
            assert recovered_start.status_code == 200, recovered_start.text
            recovered_id = recovered_start.json()["attempt"]["attemptId"]
            await client.post(f"/api/player/{player_id}/grand-rounds/attempts/{recovered_id}/abandon", headers=headers)
            starts = await asyncio.gather(*[
                client.post(f"/api/player/{player_id}/grand-rounds/attempts", headers=headers, json=start_payload)
                for _ in range(2)
            ])
            assert sorted(response.status_code for response in starts) == [200, 409]
            attempt = next(response.json()["attempt"] for response in starts if response.status_code == 200)
            # Public state contains only player-known data and current legal IDs,
            # never server answer annotations, effects, or hidden findings.
            assert "hidden" not in str(attempt).lower()
            assert "points" not in str(attempt).lower()
            assert attempt["known"] == []
            other = await client.post(f"/api/player/{player_id}/grand-rounds/attempts", headers=headers, json=start_payload)
            assert other.status_code == 409

            paused = await client.post(f"/api/player/{player_id}/grand-rounds/attempts/{attempt['attemptId']}/pause", headers=headers)
            assert paused.json()["attempt"]["status"] == "paused"
            blocked = await client.post(f"/api/player/{player_id}/grand-rounds/attempts/{attempt['attemptId']}/responses", headers=headers, json={"response_id": "focused-assessment"})
            assert blocked.status_code == 409
            resumed = await client.post(f"/api/player/{player_id}/grand-rounds/attempts/{attempt['attemptId']}/resume", headers=headers)
            assert resumed.json()["attempt"]["status"] == "active"

            for response_id in ("focused-assessment", "escalate-priority", "support-and-escalate", "closed-loop-reassessment"):
                result = await client.post(f"/api/player/{player_id}/grand-rounds/attempts/{attempt['attemptId']}/responses", headers=headers, json={"response_id": response_id})
                assert result.status_code == 200, result.text
            completions = await asyncio.gather(*[
                client.post(f"/api/player/{player_id}/grand-rounds/attempts/{attempt['attemptId']}/complete", headers=headers)
                for _ in range(2)
            ])
            assert all(response.status_code == 200 for response in completions)
            assert completions[0].json()["debrief"] == completions[1].json()["debrief"]
            receipt = completions[0].json()
            assert receipt["debrief"]["outcome"] in {"competent", "excellent"}
            assert receipt["debrief"]["score"] >= 60
            assert receipt["debrief"]["reward"]["xp"] == 25
            retry = await client.post(f"/api/player/{player_id}/grand-rounds/attempts/{attempt['attemptId']}/complete", headers=headers)
            assert retry.status_code == 200
            assert retry.json()["already_completed"] is True
            stored = await db.players.find_one({"id": player_id}, {"_id": 0})
            assert len(stored["grand_rounds_history"]) == 1
            assert stored["xp"] == receipt["player"]["xp"]
            assert len(stored["grand_rounds_daily_event_ids"]) == 1
            # Guided review requires an existing case record and cannot become
            # an alternate reward/progression claim.
            review_started = await client.post(f"/api/player/{player_id}/grand-rounds/attempts", headers=headers, json={
                **start_payload, "retry_mode": "guided",
            })
            assert review_started.status_code == 200, review_started.text
            review_id = review_started.json()["attempt"]["attemptId"]
            for response_id in ("focused-assessment", "escalate-priority", "support-and-escalate", "closed-loop-reassessment"):
                assert (await client.post(f"/api/player/{player_id}/grand-rounds/attempts/{review_id}/responses", headers=headers, json={"response_id": response_id})).status_code == 200
            reviewed = await client.post(f"/api/player/{player_id}/grand-rounds/attempts/{review_id}/complete", headers=headers)
            assert reviewed.status_code == 200
            assert reviewed.json()["debrief"]["reward"] == {"xp": 0, "universityCredits": 0, "mastery": 0, "message": "Review mode pays no reward or progression."}
            after_review = await db.players.find_one({"id": player_id}, {"_id": 0})
            assert len(after_review["grand_rounds_history"]) == 1
            assert len(after_review["grand_rounds_daily_event_ids"]) == 1
            assert after_review["grand_rounds_first_clear_claims"][first["id"]] == attempt["attemptId"]
        finally:
            await db.grand_rounds_attempts.delete_many({"player_id": player_id})
            await db.players.delete_one({"id": player_id})


def test_round_state_is_filtered_paused_and_exactly_once() -> None:
    asyncio.run(_exercise_authority_boundary())