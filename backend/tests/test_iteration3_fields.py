"""Iteration 3: backend tests for inventory, codex_shards, active_team, summon_history."""
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


# Starter inventory + shards + active_team + summon_history on create
def test_create_player_starter_inventory_and_shards(api, created_ids):
    r = api.post(f"{BASE_URL}/api/player",
                 json={"name": "TEST_iter3_inv", "aptitude": "sage"},
                 timeout=15)
    assert r.status_code == 200, r.text
    p = r.json()
    created_ids.append(p["id"])

    # Inventory: 5 items
    inv = p.get("inventory")
    assert isinstance(inv, dict), f"inventory not dict: {inv}"
    assert inv.get("Albuterol Mist") == 1
    assert inv.get("Glucose Gel") == 1
    assert inv.get("Fluid Bolus") == 1
    assert inv.get("Isolation Kit") == 1
    assert inv.get("Lab Token") == 2

    # Shards
    assert p.get("codex_shards") == 50

    # Active team: 2 starter heroes
    at = p.get("active_team")
    assert isinstance(at, list)
    assert len(at) == 2
    assert "apprentice_seer" in at  # sage starter
    assert "village_caretaker" in at

    # Summon history starts empty
    assert p.get("summon_history") == []


def test_starter_inventory_for_all_aptitudes(api, created_ids):
    for apt in ["guardian", "sage", "warden", "weaver"]:
        r = api.post(f"{BASE_URL}/api/player",
                     json={"name": f"TEST_iter3_{apt}", "aptitude": apt},
                     timeout=15)
        assert r.status_code == 200
        p = r.json()
        created_ids.append(p["id"])
        assert p["codex_shards"] == 50
        assert sum(p["inventory"].values()) == 6  # 1+1+1+1+2
        assert len(p["active_team"]) == 2


def test_update_inventory_and_persistence(api, created_ids):
    r = api.post(f"{BASE_URL}/api/player",
                 json={"name": "TEST_iter3_upd_inv", "aptitude": "guardian"},
                 timeout=15)
    pid = r.json()["id"]
    created_ids.append(pid)

    new_inv = {"Albuterol Mist": 0, "Glucose Gel": 1, "Fluid Bolus": 1,
               "Isolation Kit": 1, "Lab Token": 1}
    upd = api.put(f"{BASE_URL}/api/player/{pid}",
                  json={"inventory": new_inv}, timeout=15)
    assert upd.status_code == 200, upd.text
    assert upd.json()["inventory"] == new_inv

    g = api.get(f"{BASE_URL}/api/player/{pid}", timeout=15)
    assert g.json()["inventory"] == new_inv


def test_update_codex_shards(api, created_ids):
    r = api.post(f"{BASE_URL}/api/player",
                 json={"name": "TEST_iter3_shards", "aptitude": "warden"},
                 timeout=15)
    pid = r.json()["id"]
    created_ids.append(pid)

    upd = api.put(f"{BASE_URL}/api/player/{pid}",
                  json={"codex_shards": 250}, timeout=15)
    assert upd.status_code == 200
    assert upd.json()["codex_shards"] == 250

    g = api.get(f"{BASE_URL}/api/player/{pid}", timeout=15)
    assert g.json()["codex_shards"] == 250


def test_update_active_team_max3(api, created_ids):
    r = api.post(f"{BASE_URL}/api/player",
                 json={"name": "TEST_iter3_team", "aptitude": "sage"},
                 timeout=15)
    pid = r.json()["id"]
    created_ids.append(pid)

    team = ["apprentice_seer", "village_caretaker", "wound_sage"]
    upd = api.put(f"{BASE_URL}/api/player/{pid}",
                  json={"heroes_owned": team, "active_team": team},
                  timeout=15)
    assert upd.status_code == 200
    assert upd.json()["active_team"] == team

    g = api.get(f"{BASE_URL}/api/player/{pid}", timeout=15)
    assert g.json()["active_team"] == team


def test_update_summon_history(api, created_ids):
    r = api.post(f"{BASE_URL}/api/player",
                 json={"name": "TEST_iter3_summon", "aptitude": "weaver"},
                 timeout=15)
    pid = r.json()["id"]
    created_ids.append(pid)

    history = [
        {"heroId": "wound_sage", "name": "Wound Sage", "rarity": 4,
         "duplicate": False, "ts": "2026-01-01T00:00:00Z"},
        {"heroId": "wound_sage", "name": "Wound Sage", "rarity": 4,
         "duplicate": True, "ts": "2026-01-01T00:01:00Z"},
    ]
    upd = api.put(f"{BASE_URL}/api/player/{pid}",
                  json={"summon_history": history}, timeout=15)
    assert upd.status_code == 200
    assert upd.json()["summon_history"] == history

    g = api.get(f"{BASE_URL}/api/player/{pid}", timeout=15)
    assert g.json()["summon_history"] == history
