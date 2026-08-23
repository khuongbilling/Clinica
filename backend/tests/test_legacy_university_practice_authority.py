"""Regression coverage for Fading Apprentice practice reward authority."""

import asyncio
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import PRACTICE_CHALLENGE_MANIFEST, app, db


LEGACY_CHALLENGES = {
    "legacy-fading-apprentice-cue-hunt": "cue_lab",
    "legacy-fading-apprentice-rapid-triage": "triage",
    "legacy-fading-apprentice-stabilize-stack": "stack",
}


def test_legacy_lessons_have_fixed_server_approved_challenges() -> None:
    for challenge_id, activity in LEGACY_CHALLENGES.items():
        manifest = PRACTICE_CHALLENGE_MANIFEST[challenge_id]
        assert manifest["activity"] == activity
        assert manifest["difficulty"] == "introductory"
        assert manifest["version"] == 1


async def _exercise_legacy_receipt_lifecycle() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://legacy-practice-test") as client:
        created = await client.post("/api/player", json={"name": "Legacy lesson authority", "aptitude": "sage"})
        assert created.status_code == 200, created.text
        player = created.json()
        player_id = player["id"]
        headers = {"X-Clinica-Session": player["economy_token"]}
        start_payload = {
            "activity": "cue_lab",
            "difficulty": "introductory",
            "challenge_id": "legacy-fading-apprentice-cue-hunt",
            "challenge_version": 1,
        }

        try:
            await db.activity_completion_receipts.create_index(
                [("player_id", 1), ("activity_id", 1), ("completion_key", 1)],
                unique=True,
            )
            # A completion key cannot be invented without a server-issued,
            # player-bound receipt.
            forged = await client.post(
                f"/api/player/{player_id}/university-practice/complete",
                headers=headers,
                json={**start_payload, "attempt_id": "invented-legacy-completion", "score": 100, "safety_result": "safe"},
            )
            assert forged.status_code == 409, forged.text

            started = await client.post(
                f"/api/player/{player_id}/university-practice/attempts",
                headers=headers,
                json=start_payload,
            )
            assert started.status_code == 200, started.text
            first_attempt_id = started.json()["attempt_id"]

            first = await client.post(
                f"/api/player/{player_id}/university-practice/complete",
                headers=headers,
                json={**start_payload, "attempt_id": first_attempt_id, "score": 100, "safety_result": "safe"},
            )
            assert first.status_code == 200, first.text
            assert first.json()["already_claimed"] is False
            assert first.json()["first_completion"] is True
            assert first.json()["granted"]["university_credits"] > 0

            # Replaying the same completion ID is idempotent: no second reward
            # and no second practice counter increment are possible.
            replay = await client.post(
                f"/api/player/{player_id}/university-practice/complete",
                headers=headers,
                json={**start_payload, "attempt_id": first_attempt_id, "score": 100, "safety_result": "safe"},
            )
            assert replay.status_code == 200, replay.text
            assert replay.json()["already_claimed"] is True
            assert replay.json()["granted"] == {}

            # Package 5A and Daily Rounds continue to consume only the claimed
            # attempt receipt, and recording that receipt remains idempotent.
            await db.players.update_one(
                {"id": player_id},
                {"$set": {"seen_university_intro": True, "lessons_completed": ["lesson-1"]}},
            )
            recorded = await client.post(
                f"/api/player/{player_id}/activity-completions",
                headers=headers,
                json={"activity_id": "university-practice", "completion_key": first_attempt_id},
            )
            assert recorded.status_code == 200, recorded.text
            assert recorded.json()["accepted"] is True
            assert recorded.json()["receipt"]["dailyEligible"] is True
            duplicate_record = await client.post(
                f"/api/player/{player_id}/activity-completions",
                headers=headers,
                json={"activity_id": "university-practice", "completion_key": first_attempt_id},
            )
            assert duplicate_record.status_code == 200, duplicate_record.text
            assert duplicate_record.json()["duplicate"] is True

            # A new server-issued receipt earns the configured repeat reward.
            second_started = await client.post(
                f"/api/player/{player_id}/university-practice/attempts",
                headers=headers,
                json=start_payload,
            )
            assert second_started.status_code == 200, second_started.text
            second = await client.post(
                f"/api/player/{player_id}/university-practice/complete",
                headers=headers,
                json={**start_payload, "attempt_id": second_started.json()["attempt_id"], "score": 67, "safety_result": "needs_review"},
            )
            assert second.status_code == 200, second.text
            assert second.json()["first_completion"] is False
            assert second.json()["granted"]["university_credits"] > 0

            stored = await db.players.find_one({"id": player_id}, {"_id": 0})
            assert stored["uni_cue_lab_count"] == 2
        finally:
            await db.activity_attempts.delete_many({"player_id": player_id})
            await db.activity_completion_receipts.delete_many({"player_id": player_id})
            await db.players.delete_one({"id": player_id})


def test_legacy_lessons_use_bound_receipts_for_first_and_repeat_rewards() -> None:
    asyncio.run(_exercise_legacy_receipt_lifecycle())