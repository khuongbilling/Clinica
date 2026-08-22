"""Regression coverage for the Simulation Lab's server-owned reward boundary."""

import asyncio
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import app, db


async def _complete_parallel_attempt() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://simulation-test") as client:
        created = await client.post("/api/player", json={"name": "Simulation authority test", "aptitude": "sage"})
        assert created.status_code == 200, created.text
        player = created.json()
        player_id = player["id"]
        headers = {"X-Clinica-Session": player["economy_token"]}
        try:
            await db.players.update_one(
                {"id": player_id},
                {"$set": {
                    "lessons_completed": ["intro-1"],
                    "uni_cue_lab_count": 1,
                    "uni_triage_count": 1,
                    "uni_stack_count": 1,
                }},
            )
            started = await client.post(
                f"/api/player/{player_id}/clinical-simulations/attempts",
                json={
                    "simulation_id": "sim-airway-quiet-change",
                    "config": {"difficulty": "introductory", "style": "guided", "assistance": "coach"},
                    "retry_mode": "new_variation",
                },
                headers=headers,
            )
            assert started.status_code == 200, started.text
            attempt_id = started.json()["attempt"]["attemptId"]
            for action_id in ("assess-respiratory", "support-oxygen", "reassess-luo"):
                action = await client.post(
                    f"/api/player/{player_id}/clinical-simulations/attempts/{attempt_id}/actions",
                    json={"action_id": action_id},
                    headers=headers,
                )
                assert action.status_code == 200, action.text

            endpoint = f"/api/player/{player_id}/clinical-simulations/attempts/{attempt_id}/complete"
            first, second = await asyncio.gather(
                client.post(endpoint, headers=headers),
                client.post(endpoint, headers=headers),
            )
            assert first.status_code == second.status_code == 200
            assert first.json()["debrief"] == second.json()["debrief"]

            replay = await client.post(endpoint, headers=headers)
            assert replay.status_code == 200
            assert replay.json()["already_completed"] is True
            assert replay.json()["debrief"] == first.json()["debrief"]

            stored = await db.players.find_one({"id": player_id}, {"_id": 0})
            assert len([row for row in stored["clinical_simulation_history"] if row["attemptId"] == attempt_id]) == 1
            assert stored["xp"] == 15
            assert stored["university_credits"] == 20
        finally:
            await db.clinical_simulation_attempts.delete_many({"player_id": player_id})
            await db.players.delete_one({"id": player_id})


def test_parallel_simulation_completion_keeps_one_canonical_receipt() -> None:
    asyncio.run(_complete_parallel_attempt())