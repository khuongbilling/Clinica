"""Regression coverage for the Simulation Lab's server-owned reward boundary."""

import asyncio
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import CLINICAL_SIMULATION_MANIFESTS, app, db


EXPECTED_REVIEWED_CASES = {
    "sim-airway-quiet-change": ("airway-change", "airway", "introductory", "guided"),
    "sim-airway-breathless-walk": ("airway-change", "airway", "standard", "focused"),
    "sim-adaptive-airway": ("airway-change", "judgment", "advanced", "focused"),
    "sim-perfusion-cool-hand": ("perfusion-hidden", "assessment", "introductory", "guided"),
    "sim-perfusion-hidden": ("perfusion-hidden", "assessment", "standard", "transfer"),
    "sim-perfusion-reassuring-monitor": ("perfusion-hidden", "assessment", "advanced", "focused"),
    "sim-stabilization-first-response": ("stabilization-sequence", "stabilization", "introductory", "guided"),
    "sim-stabilization-repeat-check": ("stabilization-sequence", "stabilization", "standard", "focused"),
    "sim-stabilization-plan-slips": ("stabilization-sequence", "stabilization", "advanced", "transfer"),
    "sim-systems-handoff-detail": ("systems-handoff", "systems", "introductory", "guided"),
    "sim-systems-delayed-escalation": ("systems-handoff", "systems", "standard", "focused"),
    "sim-systems-across-teams": ("systems-handoff", "systems", "advanced", "transfer"),
}


def test_reviewed_simulation_catalog_has_three_authoritative_variations_per_family() -> None:
    assert set(CLINICAL_SIMULATION_MANIFESTS) == set(EXPECTED_REVIEWED_CASES)
    family_counts = {}
    for simulation_id, expected in EXPECTED_REVIEWED_CASES.items():
        family, domain, difficulty, style = expected
        manifest = CLINICAL_SIMULATION_MANIFESTS[simulation_id]
        assert (manifest["family"], manifest["domain"], manifest["difficulty"], manifest["style"]) == expected
        assert manifest["version"] == 1
        assert any(action["group"] == "assess" for action in manifest["actions"].values())
        assert any(action["group"] == "reassess" for action in manifest["actions"].values())
        assert any(action.get("unsafe") for action in manifest["actions"].values())
        family_counts[family] = family_counts.get(family, 0) + 1
    assert family_counts == {
        "airway-change": 3,
        "perfusion-hidden": 3,
        "stabilization-sequence": 3,
        "systems-handoff": 3,
    }


async def _complete_safe_path_for_every_reviewed_case() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://simulation-test") as client:
        created = await client.post("/api/player", json={"name": "Simulation catalog test", "aptitude": "sage"})
        assert created.status_code == 200, created.text
        player = created.json()
        player_id = player["id"]
        headers = {"X-Clinica-Session": player["economy_token"]}
        try:
            await db.players.update_one(
                {"id": player_id},
                {"$set": {
                    "player_level": 25,
                    "lessons_completed": ["intro-1"],
                    "uni_cue_lab_count": 1,
                    "uni_triage_count": 1,
                    "uni_stack_count": 1,
                }},
            )
            for simulation_id, manifest in CLINICAL_SIMULATION_MANIFESTS.items():
                # Completion recomputes level from earned XP. Restore the
                # configured Advanced test gate before each independent case.
                await db.players.update_one({"id": player_id}, {"$set": {"player_level": 25}})
                started = await client.post(
                    f"/api/player/{player_id}/clinical-simulations/attempts",
                    json={
                        "simulation_id": simulation_id,
                        "config": {
                            "difficulty": manifest["difficulty"],
                            "style": manifest["style"],
                            "assistance": "coach",
                        },
                        "retry_mode": "new_variation",
                    },
                    headers=headers,
                )
                assert started.status_code == 200, started.text
                attempt = started.json()["attempt"]
                while attempt["status"] == "active":
                    legal = [
                        (action_id, action)
                        for action_id, action in manifest["actions"].items()
                        if attempt["beat"] in action["beats"]
                        and action_id not in attempt["actionIds"]
                        and not action.get("unsafe")
                    ]
                    action_id, _ = next(
                        ((candidate_id, action) for candidate_id, action in legal if action["group"] == "support"),
                        legal[0],
                    )
                    advanced = await client.post(
                        f"/api/player/{player_id}/clinical-simulations/attempts/{attempt['attemptId']}/actions",
                        json={"action_id": action_id},
                        headers=headers,
                    )
                    assert advanced.status_code == 200, advanced.text
                    attempt = advanced.json()["attempt"]

                completed = await client.post(
                    f"/api/player/{player_id}/clinical-simulations/attempts/{attempt['attemptId']}/complete",
                    headers=headers,
                )
                assert completed.status_code == 200, completed.text
                assert completed.json()["debrief"]["outcome"] == "stabilized"
        finally:
            await db.clinical_simulation_attempts.delete_many({"player_id": player_id})
            await db.players.delete_one({"id": player_id})


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


async def _run_simulation_authority_regressions() -> None:
    # Motor binds its client to the event loop used for the first request.
    # Keep all ASGI authority coverage in one loop so the suite remains
    # reliable under plain pytest without an asyncio plugin.
    await _complete_safe_path_for_every_reviewed_case()
    await _complete_parallel_attempt()


def test_reviewed_cases_and_parallel_completion_are_server_authoritative() -> None:
    asyncio.run(_run_simulation_authority_regressions())