"""Iteration 6: backend tests for new clinical layer fields:
   learning_profile, enemy_mastery, chapter_progress, and backward-compatibility.
"""
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path("/app/frontend/.env"))

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or ""
).rstrip("/")
assert BASE_URL, "Missing EXPO_PUBLIC_BACKEND_URL"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_ids():
    ids = []
    yield ids
    s = requests.Session()
    for pid in ids:
        try:
            s.delete(f"{BASE_URL}/api/player/{pid}", timeout=10)
        except Exception:
            pass


# ----- Create with new optional fields -----
@pytest.mark.parametrize("profile", [
    "nonmedical", "preNursing", "nursingStudent", "nclexPrep", "healthcareProfessional"
])
def test_create_player_with_learning_profile(api, created_ids, profile):
    r = api.post(
        f"{BASE_URL}/api/player",
        json={
            "name": f"TEST_iter6_{profile}",
            "aptitude": "sage",
            "learning_profile": profile,
            "learning_goal": "I want to learn",
            "codex_depth": "clinical",
        },
        timeout=15,
    )
    assert r.status_code == 200, r.text
    p = r.json()
    created_ids.append(p["id"])
    assert p["learning_profile"] == profile
    # Defaults for new fields
    assert p["enemy_mastery"] == {}
    assert p["chapter_progress"] == 1

    # GET round-trip
    g = api.get(f"{BASE_URL}/api/player/{p['id']}", timeout=15)
    body = g.json()
    assert body["learning_profile"] == profile
    assert body["enemy_mastery"] == {}
    assert body["chapter_progress"] == 1


def test_create_player_without_new_fields_defaults(api, created_ids):
    """Player created without enemy_mastery/chapter_progress gets defaults."""
    r = api.post(
        f"{BASE_URL}/api/player",
        json={"name": "TEST_iter6_defaults", "aptitude": "guardian"},
        timeout=15,
    )
    assert r.status_code == 200
    p = r.json()
    created_ids.append(p["id"])
    assert p["learning_profile"] is None
    assert p["enemy_mastery"] == {}
    assert p["chapter_progress"] == 1


# ----- Update new fields -----
def test_update_enemy_mastery(api, created_ids):
    r = api.post(
        f"{BASE_URL}/api/player",
        json={"name": "TEST_iter6_mastery", "aptitude": "weaver"},
        timeout=15,
    )
    pid = r.json()["id"]
    created_ids.append(pid)

    mastery = {"air_sprite": 3, "fire_imp": 1, "river_sludge": 2}
    upd = api.put(
        f"{BASE_URL}/api/player/{pid}",
        json={"enemy_mastery": mastery},
        timeout=15,
    )
    assert upd.status_code == 200, upd.text
    assert upd.json()["enemy_mastery"] == mastery

    # Persistence
    g = api.get(f"{BASE_URL}/api/player/{pid}", timeout=15)
    assert g.json()["enemy_mastery"] == mastery


def test_update_chapter_progress(api, created_ids):
    r = api.post(
        f"{BASE_URL}/api/player",
        json={"name": "TEST_iter6_chapter", "aptitude": "warden"},
        timeout=15,
    )
    pid = r.json()["id"]
    created_ids.append(pid)

    upd = api.put(
        f"{BASE_URL}/api/player/{pid}",
        json={"chapter_progress": 5},
        timeout=15,
    )
    assert upd.status_code == 200, upd.text
    assert upd.json()["chapter_progress"] == 5

    g = api.get(f"{BASE_URL}/api/player/{pid}", timeout=15)
    assert g.json()["chapter_progress"] == 5


def test_update_learning_profile(api, created_ids):
    r = api.post(
        f"{BASE_URL}/api/player",
        json={"name": "TEST_iter6_lp", "aptitude": "sage"},
        timeout=15,
    )
    pid = r.json()["id"]
    created_ids.append(pid)

    upd = api.put(
        f"{BASE_URL}/api/player/{pid}",
        json={"learning_profile": "nclexPrep"},
        timeout=15,
    )
    assert upd.status_code == 200
    assert upd.json()["learning_profile"] == "nclexPrep"


# ----- Backward compatibility: old doc without new fields loads via GET -----
def test_get_legacy_player_without_new_fields(api, created_ids):
    """Simulates an older DB doc missing enemy_mastery/chapter_progress/learning_profile."""
    from pymongo import MongoClient
    mongo_url = "mongodb://localhost:27017"
    db_name = os.environ.get("DB_NAME", "test_database")
    mc = MongoClient(mongo_url)
    db = mc[db_name]

    import uuid
    from datetime import datetime, timezone
    legacy_id = str(uuid.uuid4())
    legacy_doc = {
        "id": legacy_id,
        "name": "TEST_iter6_legacy",
        "aptitude": "guardian",
        "codex_depth": "simple",
        "onboarding_complete": True,
        "rank": "Sprout Healer",
        "rank_index": 0,
        "xp": 0,
        "mastery": {
            "assessment": 0, "stabilization": 0, "pharmacology": 0,
            "judgment": 0, "command": 0, "systems": 0,
        },
        "codex_unlocked": [],
        "heroes_owned": ["novice_guardian", "village_caretaker"],
        "active_team": ["novice_guardian", "village_caretaker"],
        "kingdom_levels": {
            "academy_of_healing": 1, "library_of_knowledge": 1,
            "hall_of_heroes": 1, "apothecary": 1,
        },
        "runs_completed": 0,
        "bosses_defeated": [],
        "failure_counts": {},
        "inventory": {"Albuterol Mist": 1, "Glucose Gel": 1},
        "codex_shards": 50,
        "summon_history": [],
        # intentionally NO enemy_mastery, chapter_progress, learning_profile
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    db.players.insert_one(legacy_doc)
    created_ids.append(legacy_id)

    # GET should succeed and apply defaults
    g = api.get(f"{BASE_URL}/api/player/{legacy_id}", timeout=15)
    assert g.status_code == 200, g.text
    body = g.json()
    assert body["id"] == legacy_id
    assert body["enemy_mastery"] == {}
    assert body["chapter_progress"] == 1
    assert body.get("learning_profile") is None
    mc.close()
