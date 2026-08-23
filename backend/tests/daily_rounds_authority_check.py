"""Package 5B Daily Rounds migration and stale-snapshot authority checks."""

import asyncio
import json
import os
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import (
    _legacy_daily_entitlement_ids,
    _legacy_daily_state_hash,
    _legacy_daily_settlement_increments,
    _merge_daily_rounds_state,
    app,
    db,
)


def test_only_completed_unclaimed_legacy_rows_are_settled() -> None:
    legacy = {
        "objectives": [
            {"id": "obj_uni_practice", "target": 1, "progress": 1, "claimed": False},
            {"id": "obj_ward_battle", "target": 1, "progress": 0, "claimed": False},
            {"id": "obj_material", "target": 1, "progress": 1, "claimed": True},
        ],
        "weekly_tasks": [
            {"id": "w_battles", "target": 5, "progress": 5, "claimed": False},
            {"id": "w_university", "target": 5, "progress": 4, "claimed": False},
        ],
    }
    ids = _legacy_daily_entitlement_ids(legacy)
    assert ids == ["obj_uni_practice", "w_battles"]
    assert _legacy_daily_settlement_increments(ids) == {
        "university_credits": 15, "xp": 85, "crowns": 200, "hero_xp": 75,
    }
    aggregate_only = {
        "objectives": [{"id": "obj_uni_practice", "target": 1, "progress": 1, "claimed": True}],
        "all_complete_claimed": False,
        "weekly_tasks": [{"id": "w_university", "target": 1, "progress": 1, "claimed": True}],
        "weekly_all_complete_claimed": False,
    }
    assert _legacy_daily_entitlement_ids(aggregate_only) == ["daily_all_complete", "weekly_all_complete"]
    aggregate_already_claimed = {**aggregate_only, "weekly_claimed": True}
    assert _legacy_daily_entitlement_ids(aggregate_already_claimed) == ["daily_all_complete"]


def test_stale_v2_snapshot_cannot_replace_same_day_board_or_progress() -> None:
    server = {
        "version": 2, "daily_date": "2026-08-23", "weekly_key": "2026-W34",
        "objectives": [{"id": "activity:university-practice", "target": 1, "progress": 1, "claimed": False}],
        "weekly_credited_dates": ["2026-08-22"], "weekly_days_completed": 1,
        "weekly_claimed": False, "weekly_momentum_claimed": [],
    }
    stale = {
        "version": 2, "daily_date": "2026-08-23", "weekly_key": "2026-W34",
        "objectives": [{"id": "activity:university-practice", "target": 1, "progress": 0, "claimed": False},
                       {"id": "forged-board-card", "target": 1, "progress": 1, "claimed": True}],
        "weekly_credited_dates": ["2026-08-23"], "weekly_days_completed": 1,
        "weekly_claimed": False, "weekly_momentum_claimed": ["5"],
    }
    merged = _merge_daily_rounds_state(server, stale)
    assert merged["objectives"] == [{"id": "activity:university-practice", "target": 1, "progress": 1, "claimed": False}]
    assert merged["weekly_credited_dates"] == ["2026-08-22", "2026-08-23"]
    assert merged["weekly_days_completed"] == 2
    assert merged["weekly_momentum_claimed"] == ["5"]


def test_v1_snapshot_cannot_roll_back_a_v2_account() -> None:
    current = {"version": 2, "daily_date": "2026-08-23", "objectives": []}
    assert _merge_daily_rounds_state(current, {"objectives": [{"id": "obj_ward_battle"}]}) == current


async def _exercise_settlement_idempotence() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://daily-rounds-test") as client:
        created = await client.post("/api/player", json={"name": "Daily settlement", "aptitude": "sage"})
        assert created.status_code == 200, created.text
        player = created.json()
        player_id = player["id"]
        headers = {"X-Clinica-Session": player["economy_token"]}
        legacy = {
            "daily_date": "2026-08-23",
            "objectives": [
                {"id": "obj_uni_practice", "target": 1, "progress": 1, "claimed": False},
                {"id": "obj_ward_battle", "target": 1, "progress": 0, "claimed": False},
            ],
            "weekly_tasks": [],
        }
        try:
            await db.daily_rounds_legacy_settlements.create_index(
                [("settlement_id", 1)], unique=True, name="one_legacy_daily_settlement_per_player",
            )
            await db.players.update_one({"id": player_id}, {"$set": {"daily_rounds": legacy}})
            forged_snapshot = await client.put(
                f"/api/player/{player_id}", headers=headers, json={"daily_rounds": {"version": 2}},
            )
            assert forged_snapshot.status_code == 200, forged_snapshot.text
            unchanged_legacy = await db.players.find_one({"id": player_id}, {"_id": 0, "daily_rounds": 1})
            assert unchanged_legacy["daily_rounds"] == legacy
            forged_wellness = await client.put(
                f"/api/player/{player_id}", headers=headers,
                json={"wellness": {"lotus_gems": 999999, "nourishment_petals": 999999}},
            )
            assert forged_wellness.status_code == 200, forged_wellness.text
            unchanged_wallet = await db.players.find_one({"id": player_id}, {"_id": 0, "wellness": 1})
            assert unchanged_wallet["wellness"].get("lotus_gems", 0) != 999999
            assert unchanged_wallet["wellness"].get("nourishment_petals", 0) != 999999
            forged_skills = await client.put(
                f"/api/player/{player_id}", headers=headers,
                json={"hero_skill_upgrades": {"any_upgrade": 2}},
            )
            assert forged_skills.status_code == 200, forged_skills.text
            unchanged_skills = await db.players.find_one({"id": player_id}, {"_id": 0, "hero_skill_upgrades": 1})
            assert unchanged_skills.get("hero_skill_upgrades", {}) == {}
            unapproved = await client.post(
                f"/api/player/{player_id}/daily-rounds/legacy-settlement",
                headers=headers, json={"legacy_snapshot": legacy},
            )
            assert unapproved.status_code == 200, unapproved.text
            assert unapproved.json()["authorization_required"] is True
            before_approval = await db.players.find_one({"id": player_id}, {"_id": 0, "xp": 1, "university_credits": 1})
            assert before_approval == {"xp": 0, "university_credits": 0}
            no_admin = await client.post(
                "/api/faculty/admin/daily-rounds/legacy-authorizations",
                json={"player_id": player_id, "reviewed_state_hash": _legacy_daily_state_hash(legacy)},
            )
            assert no_admin.status_code == 401, no_admin.text
            admin_headers = {"X-Clinica-Curriculum-Admin-Key": "daily-rounds-review-admin"}
            wrong_hash = await client.post(
                "/api/faculty/admin/daily-rounds/legacy-authorizations", headers=admin_headers,
                json={"player_id": player_id, "reviewed_state_hash": "0" * 64},
            )
            assert wrong_hash.status_code == 409, wrong_hash.text
            approved = await client.post(
                "/api/faculty/admin/daily-rounds/legacy-authorizations", headers=admin_headers,
                json={"player_id": player_id, "reviewed_state_hash": _legacy_daily_state_hash(legacy)},
            )
            assert approved.status_code == 200, approved.text
            changed_after_approval = {
                **legacy,
                "daily_date": "2026-08-24",
            }
            await db.players.update_one({"id": player_id}, {"$set": {"daily_rounds": changed_after_approval}})
            state_changed = await client.post(
                f"/api/player/{player_id}/daily-rounds/legacy-settlement",
                headers=headers, json={"legacy_snapshot": legacy},
            )
            assert state_changed.status_code == 200, state_changed.text
            assert state_changed.json()["authorization_required"] is True
            no_race_payout = await db.players.find_one({"id": player_id}, {"_id": 0, "xp": 1, "university_credits": 1})
            assert no_race_payout == {"xp": 0, "university_credits": 0}
            await db.players.update_one({"id": player_id}, {"$set": {"daily_rounds": legacy}})
            first = await client.post(
                f"/api/player/{player_id}/daily-rounds/legacy-settlement",
                headers=headers, json={"legacy_snapshot": {"forged": {"crowns": 999999}}},
            )
            assert first.status_code == 200, first.text
            assert first.json()["settled"] is True
            assert first.json()["entitlement_ids"] == ["obj_uni_practice"]
            awarded = await db.players.find_one({"id": player_id}, {"_id": 0, "xp": 1, "university_credits": 1, "daily_rounds": 1})
            assert awarded["xp"] == 10
            assert awarded["university_credits"] == 15
            assert awarded["daily_rounds"]["version"] == 2
            assert awarded["daily_rounds"]["legacy_claims_settled"] is True

            replay = await client.post(
                f"/api/player/{player_id}/daily-rounds/legacy-settlement",
                headers=headers, json={"legacy_snapshot": legacy},
            )
            assert replay.status_code == 200, replay.text
            assert replay.json()["settled"] is False
            after_replay = await db.players.find_one({"id": player_id}, {"_id": 0, "xp": 1, "university_credits": 1})
            assert after_replay == {"xp": 10, "university_credits": 15}

            v2_base = {
                "version": 2, "daily_date": "2026-08-23", "weekly_key": "2026-W34",
                "objectives": [{"id": "activity:practice", "target": 2, "progress": 0, "claimed": False}],
                "weekly_credited_dates": [], "weekly_days_completed": 0,
                "weekly_claimed": False, "weekly_momentum_claimed": [],
            }
            await db.players.update_one({"id": player_id}, {"$set": {"daily_rounds": v2_base}})
            device_a = {**v2_base, "objectives": [{"id": "activity:practice", "target": 2, "progress": 1, "claimed": False}], "weekly_credited_dates": ["2026-08-22"]}
            device_b = {**v2_base, "objectives": [{"id": "activity:practice", "target": 2, "progress": 2, "claimed": True}], "weekly_credited_dates": ["2026-08-23"], "weekly_momentum_claimed": ["5"]}
            first_write, second_write = await asyncio.gather(
                client.put(f"/api/player/{player_id}", headers=headers, json={"daily_rounds": device_a}),
                client.put(f"/api/player/{player_id}", headers=headers, json={"daily_rounds": device_b}),
            )
            assert first_write.status_code == 200 and second_write.status_code == 200
            merged_after_race = await db.players.find_one({"id": player_id}, {"_id": 0, "daily_rounds": 1})
            merged_daily = merged_after_race["daily_rounds"]
            assert merged_daily["objectives"][0]["progress"] == 2
            assert merged_daily["objectives"][0]["claimed"] is True
            assert set(merged_daily["weekly_credited_dates"]) == {"2026-08-22", "2026-08-23"}
            assert merged_daily["weekly_momentum_claimed"] == ["5"]
        finally:
            await db.daily_rounds_legacy_settlements.delete_many({"player_id": player_id})
            await db.daily_rounds_legacy_authorizations.delete_many({"player_id": player_id})
            await db.players.delete_one({"id": player_id})


async def _exercise_empty_legacy_migration() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://daily-rounds-test") as client:
        created = await client.post("/api/player", json={"name": "Empty legacy", "aptitude": "sage"})
        assert created.status_code == 200, created.text
        player = created.json()
        player_id = player["id"]
        try:
            await db.players.update_one({"id": player_id}, {"$set": {"daily_rounds": {"objectives": [], "weekly_tasks": []}}})
            response = await client.post(
                f"/api/player/{player_id}/daily-rounds/legacy-settlement",
                headers={"X-Clinica-Session": player["economy_token"]}, json={"legacy_snapshot": {}},
            )
            assert response.status_code == 200, response.text
            migrated = await db.players.find_one({"id": player_id}, {"_id": 0, "daily_rounds": 1, "xp": 1, "university_credits": 1})
            assert migrated["daily_rounds"]["version"] == 2
            assert migrated["xp"] == 0 and migrated["university_credits"] == 0
        finally:
            await db.players.delete_one({"id": player_id})


def test_legacy_settlement_is_server_derived_and_idempotent(monkeypatch) -> None:
    monkeypatch.setenv(
        "CLINICA_CURRICULUM_ADMIN_TOKENS",
        json.dumps({"daily-rounds-review-admin": {"id": "daily_rounds_review", "role": "curriculum_admin"}}),
    )
    async def exercise_all() -> None:
        await _exercise_settlement_idempotence()
        await _exercise_empty_legacy_migration()
    asyncio.run(exercise_all())