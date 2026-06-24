"""Backend API tests for Clinica: Kingdom of Healing - /api/player endpoints."""
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
assert BASE_URL, "Missing EXPO_PUBLIC_BACKEND_URL in /app/frontend/.env"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_ids():
    ids = []
    yield ids
    # cleanup
    s = requests.Session()
    for pid in ids:
        try:
            s.delete(f"{BASE_URL}/api/player/{pid}", timeout=10)
        except Exception:
            pass


# Health
def test_root_ok(api):
    r = api.get(f"{BASE_URL}/api/", timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("status") == "ok"


# Create player - all aptitudes
@pytest.mark.parametrize(
    "aptitude,starter_hero",
    [
        ("guardian", "novice_guardian"),
        ("sage", "apprentice_seer"),
        ("warden", "junior_warden"),
        ("weaver", "data_acolyte"),
    ],
)
def test_create_player_valid_aptitudes(api, created_ids, aptitude, starter_hero):
    r = api.post(
        f"{BASE_URL}/api/player",
        json={"name": f"TEST_{aptitude}", "aptitude": aptitude},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    p = r.json()
    created_ids.append(p["id"])
    assert p["name"] == f"TEST_{aptitude}"
    assert p["aptitude"] == aptitude
    assert starter_hero in p["heroes_owned"]
    assert "village_caretaker" in p["heroes_owned"]
    # Kingdom levels initialized
    for b in ["academy_of_healing", "library_of_knowledge", "hall_of_heroes", "apothecary"]:
        assert p["kingdom_levels"].get(b) == 1
    assert p["rank"] == "Sprout Healer"
    assert p["xp"] == 0


# Invalid aptitude
def test_create_player_invalid_aptitude(api):
    r = api.post(
        f"{BASE_URL}/api/player",
        json={"name": "TEST_bad", "aptitude": "wizard"},
        timeout=15,
    )
    assert r.status_code == 400


# Name truncation / blank fallback
def test_create_player_name_handling(api, created_ids):
    r = api.post(
        f"{BASE_URL}/api/player",
        json={"name": "   ", "aptitude": "sage"},
        timeout=15,
    )
    assert r.status_code == 200
    p = r.json()
    created_ids.append(p["id"])
    assert p["name"] == "Healer"


# GET player
def test_get_player_persisted(api, created_ids):
    r = api.post(
        f"{BASE_URL}/api/player",
        json={"name": "TEST_get", "aptitude": "guardian"},
        timeout=15,
    )
    assert r.status_code == 200
    pid = r.json()["id"]
    created_ids.append(pid)

    g = api.get(f"{BASE_URL}/api/player/{pid}", timeout=15)
    assert g.status_code == 200
    assert g.json()["id"] == pid
    assert "_id" not in g.json()


def test_get_player_404(api):
    r = api.get(f"{BASE_URL}/api/player/does-not-exist-xyz", timeout=15)
    assert r.status_code == 404


# Update player (partial)
def test_update_player_partial(api, created_ids):
    r = api.post(
        f"{BASE_URL}/api/player",
        json={"name": "TEST_upd", "aptitude": "weaver"},
        timeout=15,
    )
    pid = r.json()["id"]
    created_ids.append(pid)

    upd = api.put(
        f"{BASE_URL}/api/player/{pid}",
        json={
            "xp": 50,
            "codex_unlocked": ["asthma_basics"],
            "mastery": {"assessment": 2, "stabilization": 1, "pharmacology": 0,
                        "judgment": 0, "command": 0, "systems": 0},
            "heroes_owned": ["novice_guardian", "village_caretaker", "apprentice_seer"],
            "runs_completed": 1,
            "bosses_defeated": [],
        },
        timeout=15,
    )
    assert upd.status_code == 200, upd.text
    body = upd.json()
    assert body["xp"] == 50
    assert "asthma_basics" in body["codex_unlocked"]
    assert body["mastery"]["assessment"] == 2
    assert body["runs_completed"] == 1
    assert "apprentice_seer" in body["heroes_owned"]

    # Re-fetch to verify persistence
    g = api.get(f"{BASE_URL}/api/player/{pid}", timeout=15)
    assert g.json()["xp"] == 50


def test_update_player_404(api):
    r = api.put(
        f"{BASE_URL}/api/player/nonexistent-id-xyz",
        json={"xp": 10},
        timeout=15,
    )
    assert r.status_code == 404
