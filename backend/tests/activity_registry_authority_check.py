"""Explicit Package 5A integration check for the lifecycle receipt boundary.

This is deliberately not named ``test_*.py``. The backend's shared Motor client
binds to the first asyncio event loop, while the established authority suites
each use ``asyncio.run()``. Running this check explicitly keeps it from binding
that global client before a neighboring suite. Run:
  python -m pytest -q tests/activity_registry_authority_check.py
"""

import asyncio
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import ACTIVITY_COMPLETION_SOURCES, ACTIVITY_REGISTRY, activity_analytics_key, app, db


def test_registry_has_no_wellness_completion_source() -> None:
    assert "lotus-journal" in ACTIVITY_REGISTRY
    assert "lotus-journal" not in ACTIVITY_COMPLETION_SOURCES


async def _exercise_activity_receipts() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://activity-test") as client:
        created = await client.post("/api/player", json={"name": "Receipt authority", "aptitude": "sage"})
        assert created.status_code == 200, created.text
        player = created.json()
        player_id = player["id"]
        headers = {"X-Clinica-Session": player["economy_token"]}
        attempt_id = "activity-receipt-authority-test"
        try:
            await db.activity_completion_receipts.create_index(
                [("player_id", 1), ("activity_id", 1), ("completion_key", 1)], unique=True,
            )
            await db.activity_analytics.create_index([("receipt_key", 1)], unique=True)
            await db.players.update_one({"id": player_id}, {"$set": {
                "seen_university_intro": True,
                "lessons_completed": ["lesson-1"],
            }})
            await db.activity_attempts.insert_one({
                "id": attempt_id, "player_id": player_id, "activity": "cue_lab",
                "status": "claimed", "claimed_at": "2026-08-22T00:00:00+00:00",
                # This must never be copied into a lifecycle receipt or analytics.
                "patient_note": "private case content",
            })

            forged = await client.post(
                f"/api/player/{player_id}/activity-completions", headers=headers,
                json={"activity_id": "university-practice", "completion_key": "not-a-claim"},
            )
            assert forged.status_code == 409

            extra_payload = await client.post(
                f"/api/player/{player_id}/activity-completions", headers=headers,
                json={
                    "activity_id": "university-practice", "completion_key": attempt_id,
                    "wellness": {"free_text": "must not be accepted or stored"},
                    "reward": {"crowns": 999999},
                },
            )
            assert extra_payload.status_code == 422

            first = await client.post(
                f"/api/player/{player_id}/activity-completions", headers=headers,
                json={"activity_id": "university-practice", "completion_key": attempt_id},
            )
            assert first.status_code == 200, first.text
            assert first.json()["accepted"] is True
            assert first.json()["receipt"]["dailyEligible"] is True

            replay = await client.post(
                f"/api/player/{player_id}/activity-completions", headers=headers,
                json={"activity_id": "university-practice", "completion_key": attempt_id},
            )
            assert replay.status_code == 200, replay.text
            assert replay.json()["duplicate"] is True

            receipt = await db.activity_completion_receipts.find_one(
                {"player_id": player_id, "completion_key": attempt_id}, {"_id": 0},
            )
            analytics = await db.activity_analytics.find_one(
                {"receipt_key": activity_analytics_key(player_id, "university-practice", attempt_id)}, {"_id": 0},
            )
            assert receipt and analytics
            assert not {"patient_note", "wellness", "reward", "crowns"} & set(receipt)
            serialized_analytics = str(analytics).lower()
            for forbidden in ("patient_note", "private case", "wellness", "reward", "crowns", player_id.lower()):
                assert forbidden not in serialized_analytics

            lotus = await client.post(
                f"/api/player/{player_id}/activity-completions", headers=headers,
                json={"activity_id": "lotus-journal", "completion_key": "any"},
            )
            assert lotus.status_code == 422

            # Client-created generic attempts and claim keys cannot be used to
            # mint repeat or first-clear rewards. Purpose-built completion
            # routes remain the sole authority for their respective activities.
            before = await db.players.find_one({"id": player_id}, {"_id": 0, "crowns": 1, "xp": 1})
            generic_attempt = await client.post(
                f"/api/player/{player_id}/activity-attempts/ward_defense",
                headers=headers, json={"tier": "regular"},
            )
            assert generic_attempt.status_code == 410
            generic_reward = await client.post(
                f"/api/player/{player_id}/rewards/world_event",
                headers=headers,
                json={"activity": "world_event", "claim_key": "invented-first-clear", "repeatable": False},
            )
            assert generic_reward.status_code == 410
            after = await db.players.find_one({"id": player_id}, {"_id": 0, "crowns": 1, "xp": 1})
            assert after == before
        finally:
            await db.activity_attempts.delete_many({"player_id": player_id})
            await db.activity_completion_receipts.delete_many({"player_id": player_id})
            await db.players.delete_one({"id": player_id})
            await db.activity_analytics.delete_many({"receipt_key": activity_analytics_key(player_id, "university-practice", attempt_id)})


def test_activity_receipts_are_authoritative_idempotent_and_private() -> None:
    asyncio.run(_exercise_activity_receipts())