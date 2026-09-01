from fastapi import FastAPI, APIRouter, HTTPException, Header
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError
import os
import asyncio
import hashlib
import hmac
import random
import secrets
import logging
import base64
import hashlib
import hmac
import json
import re
from pathlib import Path
from pydantic import BaseModel, ConfigDict, Field
from typing import Any, Dict, List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
from grand_rounds import GRAND_ROUNDS_CASES, public_attempt as grand_round_public_attempt
from crisis_drill import CRISIS_DRILL_CASES, CRISIS_DRILL_FAMILIES, public_cd_attempt
from runtime_config import get_runtime_config

CRISIS_DRILL_ADVANCED_LEVEL_GATE = 12
CRISIS_DRILL_GRANT_LOCKS: Dict[str, asyncio.Lock] = {}

GRAND_ROUNDS_ADVANCED_LEVEL_GATE = 12


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

runtime_config = get_runtime_config()
mongo_url = runtime_config.mongo_url
client = AsyncIOMotorClient(mongo_url)
db = client[runtime_config.db_name]

app = FastAPI(title="Clinica: Kingdom of Healing API")
api_router = APIRouter(prefix="/api")
FACULTY_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
FACULTY_ROLES = {"author", "reviewer", "approver"}

ACTIVITY_REGISTRY_PATH = ROOT_DIR.parent / "frontend" / "src" / "game" / "activityRegistry.manifest.json"
with ACTIVITY_REGISTRY_PATH.open(encoding="utf-8") as activity_registry_file:
    _activity_registry_document = json.load(activity_registry_file)
ACTIVITY_REGISTRY_VERSION = int(_activity_registry_document["version"])
ACTIVITY_REGISTRY = {row["id"]: row for row in _activity_registry_document["activities"]}
# 5A records lifecycle evidence only for sources whose meaningful completion is
# already verified by an existing authoritative attempt. It deliberately does
# not make rewards, Daily claims, wellness, Realm production, or client input
# part of this endpoint.
ACTIVITY_COMPLETION_SOURCES = {
    "university-practice": "activity_attempts",
    "clinical-simulation": "clinical_simulation_attempts",
    "grand-rounds": "grand_rounds_attempts",
    "crisis-drill": "crisis_drill_attempts",
}

# Retired Daily Rounds V1 claims can be settled exactly once, but their values
# must be derived from this server-owned ledger rather than a client reward
# payload.  Keep this small, explicit table until every V1 save has migrated.
LEGACY_DAILY_REWARD_LEDGER: Dict[str, Dict[str, int]] = {
    "obj_uni_practice": {"university_credits": 15, "xp": 10},
    "obj_ward_battle": {"crowns": 50, "xp": 15, "hero_xp": 10},
    "obj_material": {"university_credits": 10, "xp": 10},
    "obj_ward_defense": {"crowns": 50, "xp": 15, "hero_xp": 10},
    "obj_hero": {"university_credits": 10, "xp": 10},
    "obj_journey_node": {"crowns": 60, "xp": 20, "hero_xp": 10},
    "daily_all_complete": {"codex_shards": 25, "crowns": 25, "xp": 10},
    "w_university": {"university_credits": 100, "xp": 50},
    "w_battles": {"crowns": 200, "xp": 75, "hero_xp": 75},
    "w_daily_sets": {"codex_shards": 75, "xp": 50},
    "w_hero": {"university_credits": 50, "crowns": 50, "xp": 25},
    "weekly_all_complete": {"codex_shards": 150, "refined_lotus_gems": 5, "crowns": 100},
}


def activity_analytics_key(player_id: str, activity_id: str, completion_key: str) -> str:
    """Create an analytics-only, non-joinable receipt identifier."""
    secret = os.environ.get("SESSION_SECRET", "clinica-development-analytics-key").encode()
    message = f"{player_id}:{activity_id}:{completion_key}".encode()
    return hmac.new(secret, message, hashlib.sha256).hexdigest()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def issue_guest_session(player_id: str) -> str:
    """Create a stateless, signed guest session bound to one player ID."""
    body = base64.urlsafe_b64encode(
        json.dumps({"player_id": player_id, "issued_at": now_iso()}, separators=(",", ":")).encode()
    ).decode().rstrip("=")
    secret_value = os.environ.get("SESSION_SECRET")
    if not secret_value:
        raise RuntimeError("SESSION_SECRET must be configured")
    secret = secret_value.encode()
    signature = hmac.new(secret, body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{signature}"


def valid_guest_session(token: Optional[str], player_id: str) -> bool:
    if not token or "." not in token:
        return False
    body, signature = token.rsplit(".", 1)
    secret_value = os.environ.get("SESSION_SECRET")
    if not secret_value:
        return False
    secret = secret_value.encode()
    expected = hmac.new(secret, body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return False
    try:
        padded = body + "=" * (-len(body) % 4)
        return json.loads(base64.urlsafe_b64decode(padded).decode()).get("player_id") == player_id
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
        return False


def player_access_ok(doc: Dict[str, Any], player_id: str, session: Optional[str], legacy: Optional[str]) -> bool:
    # Signed sessions are the normal path. The legacy credential is accepted
    # only during the explicit one-time migration endpoint below.
    return valid_guest_session(session, player_id)

def _credential_hash(raw_credential: str) -> str:
    """Return a keyed one-way digest for a generated faculty credential."""
    secret = os.environ.get("SESSION_SECRET")
    if not secret:
        raise HTTPException(status_code=503, detail="credential authority is not configured")
    return hmac.new(
        secret.encode(), f"clinica-faculty-credential-v1:{raw_credential}".encode(), hashlib.sha256,
    ).hexdigest()
async def faculty_principal(x_clinica_faculty_key: Optional[str]) -> Dict[str, str]:
    """Authenticate a faculty operator from a static or revocable server-side registry.

    Legacy CLINICA_FACULTY_TOKENS remains a server-only bootstrap registry.
    Operational credentials are generated by curriculum administrators, stored
    only as keyed digests, and can be revoked without a deployment change.
    """
    credential = x_clinica_faculty_key or ""
    if not credential or len(credential) > 512 or credential != credential.strip():
        raise HTTPException(status_code=401, detail="invalid faculty credential")
    static_principal = _server_registry_principal(
        "CLINICA_FACULTY_TOKENS", credential, FACULTY_ROLES, "faculty authoring token registry is invalid",
    )
    if static_principal:
        return static_principal
    credential_doc = await db.faculty_credentials.find_one(
        {"tokenHash": _credential_hash(credential), "status": "active"},
        {"_id": 0, "facultyId": 1, "role": 1},
    )
    if (
        not credential_doc
        or not isinstance(credential_doc.get("facultyId"), str)
        or credential_doc["role"] not in FACULTY_ROLES
    ):
        raise HTTPException(status_code=401, detail="invalid faculty credential")
    return {"id": credential_doc["facultyId"], "role": credential_doc["role"]}

def curriculum_admin_principal(x_clinica_curriculum_admin_key: Optional[str]) -> Dict[str, str]:
    """Authenticate a curriculum administrator from its independent bootstrap registry."""
    credential = x_clinica_curriculum_admin_key or ""
    if not credential or len(credential) > 512 or credential != credential.strip():
        raise HTTPException(status_code=401, detail="invalid curriculum administrator credential")
    principal = _server_registry_principal(
        "CLINICA_CURRICULUM_ADMIN_TOKENS", credential, {"curriculum_admin"},
        "curriculum administration token registry is invalid",
    )
    if not principal:
        if not os.environ.get("CLINICA_CURRICULUM_ADMIN_TOKENS"):
            raise HTTPException(status_code=503, detail="curriculum administration is not configured")
        raise HTTPException(status_code=401, detail="invalid curriculum administrator credential")
    return principal
def age1_day_key(now: Optional[datetime] = None) -> str:
    return (now or datetime.now(timezone.utc)).date().isoformat()


def age1_week_key(now: Optional[datetime] = None) -> str:
    point = now or datetime.now(timezone.utc)
    year, week, _ = point.isocalendar()
    return f"{year}-W{week:02d}"


def age1_stamina_cap(level: int) -> int:
    if level <= 4: return 20
    if level <= 6: return 22
    if level <= 8: return 24
    if level <= 10: return 26
    if level <= 13: return 27
    if level <= 16: return 28
    if level <= 19: return 29
    return 30


def player_level_from_xp(xp: int) -> int:
    """Mirror the frontend account-level XP curve for authoritative grants."""
    level, remaining = 1, max(0, int(xp))
    while level < 60:
        step = level - 1
        cost = round(150 + 35 * step + 25 * pow(step, 1.2))
        if remaining < cost:
            break
        remaining -= cost
        level += 1
    return level


def age1_reward_multiplier(used: int, units: int) -> float:
    if units <= 0:
        return 1.0
    values = []
    for offset in range(units):
        index = used + offset
        values.append(1.0 if index < 12 else 0.45 if index < 20 else 0.1 if index < 24 else 0.0)
    return sum(values) / units


# ---------- Models ----------

class PlayerCreate(BaseModel):
    name: str
    aptitude: str  # guardian | sage | warden | weaver
    recommended_aptitude: Optional[str] = None
    learning_goal: Optional[str] = None
    learning_profile: Optional[str] = None
    codex_depth: Optional[str] = None
    prologue_complete: Optional[bool] = None
    identity_restored: Optional[bool] = None
    diagnostic_intro_seen: Optional[bool] = None
    opening_prologue_complete: Optional[bool] = None
    opening_prologue_phase: Optional[str] = None
    prologue_rewards_claimed: Optional[bool] = None


class MasteryStats(BaseModel):
    assessment: int = 0
    stabilization: int = 0
    pharmacology: int = 0
    judgment: int = 0
    command: int = 0
    systems: int = 0


class WellnessGarden(BaseModel):
    hydration: int = 0
    fiber: int = 0
    protein: int = 0
    heart: int = 0


class WellnessDaily(BaseModel):
    date: str = Field(default_factory=lambda: now_iso()[:10])
    gems_earned: int = 0
    signatures: List[str] = Field(default_factory=list)


class WellnessWeekly(BaseModel):
    week_key: str = ""
    gems_earned: int = 0


class WellnessState(BaseModel):
    nourishment_petals: int = 0
    lotus_gems: int = 0
    garden: WellnessGarden = Field(default_factory=WellnessGarden)
    lessons_completed: List[str] = Field(default_factory=list)
    logs_completed: int = 0
    daily: WellnessDaily = Field(default_factory=WellnessDaily)
    weekly: WellnessWeekly = Field(default_factory=WellnessWeekly)


class DailyObjectiveState(BaseModel):
    id: str = ""
    mode: str = ""
    event: str = ""
    target: int = 0
    progress: int = 0
    claimed: bool = False
    label: str = ""
    description: str = ""
    icon: str = ""
    reward: Dict[str, int] = Field(default_factory=dict)
    activity_id: Optional[str] = None
    category: Optional[str] = None
    route: Optional[str] = None


class DailyRoundsState(BaseModel):
    version: Optional[int] = None
    streak_count: int = 0
    last_checkin_date: str = ""
    daily_date: str = ""
    objectives: List[DailyObjectiveState] = Field(default_factory=list)
    all_complete_claimed: bool = False
    weekly_key: str = ""
    weekly_days_completed: int = 0
    weekly_claimed: bool = False
    weekly_credited_dates: List[str] = Field(default_factory=list)
    # Fix 9 weekly task fields are retained in the server snapshot so an
    # authoritative Simulation completion cannot strip client progress.
    weekly_tasks: List[Dict[str, Any]] = Field(default_factory=list)
    weekly_all_complete_claimed: bool = False
    weekly_material_earned: int = 0
    required_count: Optional[int] = None
    weekly_momentum_claimed: List[str] = Field(default_factory=list)
    # Permanent audit marker for the one-time V1 entitlement settlement.
    legacy_claims_settled: bool = False
    legacy_settlement_id: Optional[str] = None


class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # Opaque bearer used by the device-bound guest session bridge. It must
    # survive authoritative mutation responses so the client can make its next
    # protected request without a forced rebootstrap.
    economy_token: Optional[str] = None
    name: str
    aptitude: str
    recommended_aptitude: Optional[str] = None
    learning_goal: Optional[str] = None
    learning_profile: Optional[str] = None
    codex_depth: str = "simple"
    onboarding_complete: bool = True
    prologue_complete: bool = True
    identity_restored: bool = True
    diagnostic_intro_seen: bool = True
    opening_prologue_complete: bool = True
    opening_prologue_phase: Optional[str] = None
    prologue_rewards_claimed: bool = True
    avatar_id: str = ""
    # Push 8 — Lotus Recall character-creation choices
    pronouns: Optional[str] = None
    char_skin_tone: Optional[int] = None
    char_hair_style: Optional[int] = None
    rank: str = "Sprout Healer"
    rank_index: int = 0
    xp: int = 0
    player_level: int = 1
    # Player Hero is an isolated, one-time character record. It is not a roster
    # hero and is never included in heroes_owned/hero_progression.
    player_hero: Optional[Dict[str, Any]] = None
    player_hero_opportunities: List[Dict[str, Any]] = Field(default_factory=list)
    # New accounts begin after the already-completed modern opening. The
    # separate flag makes that completed awakening explicit for eligibility;
    # legacy documents without it remain safely locked until reconciled.
    awakening_beat_complete: bool = True
    class_tree_id: Optional[str] = None
    class_diagnostic_resonance: Optional[str] = None
    class_diagnostic_secondary: Optional[str] = None
    class_progress: Dict[str, List[int]] = Field(default_factory=dict)
    class_specialization: Dict[str, str] = Field(default_factory=dict)
    mastery: MasteryStats = Field(default_factory=MasteryStats)
    codex_unlocked: List[str] = Field(default_factory=list)
    heroes_owned: List[str] = Field(default_factory=list)
    hero_progression: Dict[str, Dict[str, int]] = Field(default_factory=dict)
    active_team: List[str] = Field(default_factory=list)
    kingdom_levels: Dict[str, int] = Field(default_factory=dict)
    runs_completed: int = 0
    ward_defense_waves: int = 0
    ward_defense_records: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    ward_defense_rotation: Dict[str, Any] = Field(default_factory=dict)
    ward_defense_claimed_run_ids: List[str] = Field(default_factory=list)
    ward_defense_recent_families: List[str] = Field(default_factory=list)
    ward_defense_missed_families: List[str] = Field(default_factory=list)
    ward_exchange_purchases: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    ward_aegis_pity: int = 0
    ward_aegis_lifetime_fragments: int = 0
    ward_aegis_week_key: str = ""
    ward_aegis_weekly_random_drops: int = 0
    ward_aegis_milestone_granted: bool = False
    bosses_defeated: List[str] = Field(default_factory=list)
    failure_counts: Dict[str, int] = Field(default_factory=dict)
    inventory: Dict[str, int] = Field(default_factory=dict)
    # Future-content access state. The catalog intentionally remains unavailable.
    night_market_unlocked: bool = False
    codex_shards: int = 0
    crowns: int = 0
    insight_crystals: int = 0
    refined_lotus_gems: int = 0
    lotus_gems_paid: int = 0
    ward_sigils: int = 0
    epidemic_tokens: int = 0
    owned_skins: List[str] = Field(default_factory=list)
    equipped_skin: str = ""
    equipped_ward_skin: str = ""
    owned_upgrades: List[str] = Field(default_factory=list)
    owned_units: Dict[str, int] = Field(default_factory=dict)
    unit_shards: Dict[str, int] = Field(default_factory=dict)
    ward_loadout: List[str] = Field(default_factory=list)
    summon_history: List[Dict[str, Any]] = Field(default_factory=list)
    enemy_mastery: Dict[str, int] = Field(default_factory=dict)
    battle_stars: Dict[str, int] = Field(default_factory=dict)
    chapter_progress: int = 1
    class_trainees: Dict[str, int] = Field(default_factory=dict)
    university_credits: int = 0
    uni_cue_lab_count: int = 0
    uni_triage_count: int = 0
    uni_stack_count: int = 0
    uni_practice_milestones_claimed: List[str] = Field(default_factory=list)
    # Compact, server-owned practice evidence. It is not a currency and never
    # decays; its bounded history is used for recommendations and breadth gates.
    clinical_practice: Dict[str, Any] = Field(default_factory=dict)
    hero_skill_upgrades: Dict[str, int] = Field(default_factory=dict)
    practice_modules_completed: List[str] = Field(default_factory=list)
    seen_practice_curriculum: bool = False
    seen_lv2_unlock: bool = False
    seen_reminiscence: bool = False
    seen_university_intro: bool = False
    tutorial_summon_1_done: bool = False
    tutorial_summon_2_done: bool = False
    story_scenes_seen: List[str] = Field(default_factory=list)
    lessons_completed: List[str] = Field(default_factory=list)
    simulations_completed: List[str] = Field(default_factory=list)
    badge_progress: Dict[str, int] = Field(default_factory=dict)
    claimed_milestones: List[str] = Field(default_factory=list)
    claimed_daily_milestones: List[str] = Field(default_factory=list)
    # C4 — one-time claim tracking for level milestones, chapter chests, 3-star bonuses.
    claimed_level_rewards: List[str] = Field(default_factory=list)
    claimed_chapter_chests: List[str] = Field(default_factory=list)
    claimed_chapter_3star: List[str] = Field(default_factory=list)
    claimed_journey_nodes: List[str] = Field(default_factory=list)
    owned_titles: List[str] = Field(default_factory=list)
    active_title: str = ""
    stamina: int = 20
    stamina_updated_at: str = Field(default_factory=now_iso)
    # Age 1 pacing bookkeeping; these fields are not displayed as currencies.
    age1_reward_day: Optional[str] = None
    age1_reward_units: int = 0
    age1_claimed_reward_keys: List[str] = Field(default_factory=list)
    age1_stamina_commitments: List[Dict[str, Any]] = Field(default_factory=list)
    age1_stamina_bonus_day: Optional[str] = None
    age1_stamina_bonus_sources: List[str] = Field(default_factory=list)
    age1_stamina_bonus_week: Optional[str] = None
    age1_refill_day: Optional[str] = None
    age1_refill_amount: int = 0
    wellness: WellnessState = Field(default_factory=WellnessState)
    daily_rounds: DailyRoundsState = Field(default_factory=DailyRoundsState)
    # Clinical Simulation Lab receipts are server-owned. A compact summary is
    # exposed to clients for discovery/debrief, while action logs live in the
    # separate clinical_simulation_attempts collection.
    clinical_simulation_history: List[Dict[str, Any]] = Field(default_factory=list)
    clinical_simulation_achievements: List[str] = Field(default_factory=list)
    clinical_simulation_active_attempt_id: Optional[str] = None
    clinical_simulation_first_clear_claims: Dict[str, str] = Field(default_factory=dict)
    clinical_simulation_family_bests: Dict[str, int] = Field(default_factory=dict)
    clinical_simulation_daily_event_ids: List[str] = Field(default_factory=list)
    # Grand Rounds stores its full case state in a separate collection. These
    # compact receipts are only for board discovery, resumable entry, and
    # bounded progression; no hidden finding or answer key is copied here.
    grand_rounds_history: List[Dict[str, Any]] = Field(default_factory=list)
    grand_rounds_active_attempt_id: Optional[str] = None
    grand_rounds_reservation_at: Optional[str] = None
    grand_rounds_first_clear_claims: Dict[str, str] = Field(default_factory=dict)
    grand_rounds_case_bests: Dict[str, int] = Field(default_factory=dict)
    grand_rounds_daily_event_ids: List[str] = Field(default_factory=list)
    # Crisis Drill stores its full attempt state in a separate collection.
    # Compact receipts here serve board discovery, resumable entry, and bounded
    # breadth-mastery progression; no answer key or hidden finding is copied.
    crisis_drill_history: List[Dict[str, Any]] = Field(default_factory=list)
    crisis_drill_active_attempt_id: Optional[str] = None
    crisis_drill_reservation_at: Optional[str] = None
    crisis_drill_first_clear_claims: Dict[str, str] = Field(default_factory=dict)
    crisis_drill_drill_bests: Dict[str, int] = Field(default_factory=dict)
    crisis_drill_mastery_by_family: Dict[str, int] = Field(default_factory=dict)
    crisis_drill_daily_event_ids: List[str] = Field(default_factory=list)
    # Durable outbox/idempotency marker for a completed Crisis Drill receipt.
    # This is bounded and prevents a recovered completion from paying twice.
    crisis_drill_applied_grant_ids: List[str] = Field(default_factory=list)
    realm_layout: Dict[str, str] = Field(default_factory=dict)
    realm_decor: Dict[str, str] = Field(default_factory=dict)
    realm_assignments: Dict[str, List[str]] = Field(default_factory=dict)
    realm_production: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    realm_seed: int = 0
    # P8 — battle card deck (up to 3 card IDs loaded in mission loadout)
    equipped_cards: List[str] = Field(default_factory=list)
    # Push 10 — hero equipment loadouts: heroId → slotId → itemId
    hero_equipment: Dict[str, Dict[str, str]] = Field(default_factory=dict)
    seen_card_tutorial: bool = False
    seen_call_tutorial: bool = False
    # Task 570 — Chapter-level Area Boss key progression.
    # Maps str(chapter_id) → {"keys_collected": int, "claimed_tile_ids": [str, ...]}.
    # Persists across Rechallenge Map (new runs) so keys are never lost on re-roll.
    chapter_boss_keys: Dict[str, Any] = Field(default_factory=dict)
    # Canonical shift per Book I choice chapter (str chapter_id → "day"|"evening"|"night").
    # Written once at first clear; inherit chapters (5-6, 8) read it.
    canonical_shifts: Dict[str, str] = Field(default_factory=dict)
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class EconomyMutation(BaseModel):
    kind: Literal["spend_stamina", "refill_stamina", "consume_repeat_budget", "grant_stamina_bonus"]
    cost: int = 0
    amount: int = 0
    units: int = 0
    source: Optional[str] = None
    period: Literal["day", "week"] = "day"


class ActivityRewardGrant(BaseModel):
    activity: Literal["clinical_battle", "journey_treasure", "auto_sweep", "ward_defense", "university_practice", "world_event"]
    tier: Literal["regular", "elite", "area_boss", "major_boss"] = "regular"
    repeatable: bool = False
    claim_key: Optional[str] = None
    attempt_id: Optional[str] = None
    xp: int = 0
    crowns: int = 0
    codex_shards: int = 0
    epidemic_tokens: int = 0
    university_credits: int = 0
    hero_xp: Dict[str, int] = Field(default_factory=dict)
    inventory: Dict[str, int] = Field(default_factory=dict)
    mastery: Dict[str, int] = Field(default_factory=dict)


REPEAT_REWARD_UNITS = {"regular": 1, "elite": 2, "area_boss": 3, "major_boss": 5}
REPEAT_ATTEMPT_REWARDS = {
    "regular": {"xp": 20, "crowns": 10},
    "elite": {"xp": 40, "crowns": 20},
    "area_boss": {"xp": 60, "crowns": 30, "codex_shards": 5},
    "major_boss": {"xp": 100, "crowns": 50, "codex_shards": 10},
}
FIRST_CLEAR_REWARDS = {
    "clinical_battle": {"xp": 100, "crowns": 25, "codex_shards": 25},
    "journey_treasure": {"xp": 40, "crowns": 30, "codex_shards": 10},
    "university_practice": {"xp": 50, "crowns": 10},
    "auto_sweep": {"xp": 20, "crowns": 10},
    "ward_defense": {"xp": 20, "crowns": 10},
    "world_event": {"xp": 100, "crowns": 50, "epidemic_tokens": 25},
}
UNIVERSITY_PRACTICE_REWARDS = {
    "cue_lab": {
        "beginner": (10, 15, "cue_scroll", 1), "standard": (15, 25, "cue_scroll", 2),
        "advanced": (20, 35, "cue_scroll", 2), "introductory": (10, 15, "cue_scroll", 1),
        "expert": (20, 35, "cue_scroll", 2),
    },
    "triage": {
        "beginner": (10, 15, "triage_scroll", 1), "standard": (15, 25, "triage_scroll", 2),
        "advanced": (20, 35, "triage_scroll", 2), "introductory": (10, 15, "triage_scroll", 1),
        "expert": (20, 35, "triage_scroll", 2),
    },
    "stack": {
        "beginner": (10, 15, "stab_scroll", 1), "standard": (15, 25, "stab_scroll", 2),
        "advanced": (20, 35, "stab_scroll", 2), "introductory": (10, 15, "stab_scroll", 1),
        "expert": (20, 35, "stab_scroll", 2),
    },
}
UNIVERSITY_PRACTICE_REPEAT_REWARDS = {
    "cue_lab": {
        "beginner": (5, 8, "cue_scroll", 1), "standard": (8, 12, "cue_scroll", 1),
        "advanced": (10, 15, "cue_scroll", 2), "introductory": (5, 8, "cue_scroll", 1),
        "expert": (10, 15, "cue_scroll", 2),
    },
    "triage": {
        "beginner": (5, 8, "triage_scroll", 1), "standard": (8, 12, "triage_scroll", 1),
        "advanced": (10, 15, "triage_scroll", 2), "introductory": (5, 8, "triage_scroll", 1),
        "expert": (10, 15, "triage_scroll", 2),
    },
    "stack": {
        "beginner": (5, 8, "stab_scroll", 1), "standard": (8, 12, "stab_scroll", 1),
        "advanced": (10, 15, "stab_scroll", 2), "introductory": (5, 8, "stab_scroll", 1),
        "expert": (10, 15, "stab_scroll", 2),
    },
}
REWARD_CAPS = {
    "clinical_battle":  {"xp": 250, "crowns": 250, "codex_shards": 100, "epidemic_tokens": 25, "university_credits": 100},
    "journey_treasure": {"xp": 100, "crowns": 100, "codex_shards": 50, "epidemic_tokens": 0, "university_credits": 50},
    "auto_sweep":       {"xp": 100, "crowns": 100, "codex_shards": 0, "epidemic_tokens": 0, "university_credits": 0},
    "ward_defense":     {"xp": 150, "crowns": 0, "codex_shards": 50, "epidemic_tokens": 0, "university_credits": 0},
    "university_practice": {"xp": 100, "crowns": 0, "codex_shards": 50, "epidemic_tokens": 0, "university_credits": 100},
    "world_event":      {"xp": 150, "crowns": 150, "codex_shards": 50, "epidemic_tokens": 25, "university_credits": 0},
}


AGE1_STAMINA_BONUSES: dict[str, tuple[str, int]] = {
    "practice:cue_lab": ("day", 1),
    "practice:triage": ("day", 1),
    "practice:stack": ("day", 1),
    "daily_rounds_v2_complete": ("day", 1),
    "weekly_momentum_complete": ("week", 5),
}
AGE1_REFILL_PACKS: dict[int, int] = {2: 60, 99: 150}


class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    aptitude: Optional[str] = None
    recommended_aptitude: Optional[str] = None
    learning_goal: Optional[str] = None
    learning_profile: Optional[str] = None
    codex_depth: Optional[str] = None
    onboarding_complete: Optional[bool] = None
    prologue_complete: Optional[bool] = None
    identity_restored: Optional[bool] = None
    diagnostic_intro_seen: Optional[bool] = None
    opening_prologue_complete: Optional[bool] = None
    opening_prologue_phase: Optional[str] = None
    prologue_rewards_claimed: Optional[bool] = None
    avatar_id: Optional[str] = None
    # Push 8 — Lotus Recall character-creation choices
    pronouns: Optional[str] = None
    char_skin_tone: Optional[int] = None
    char_hair_style: Optional[int] = None
    rank: Optional[str] = None
    rank_index: Optional[int] = None
    xp: Optional[int] = None
    player_level: Optional[int] = None
    # Accepted only so the generic snapshot can explicitly discard these
    # valuable fields. Player Hero writes belong to its protected endpoints.
    player_hero: Optional[Dict[str, Any]] = None
    player_hero_opportunities: Optional[List[Dict[str, Any]]] = None
    awakening_beat_complete: Optional[bool] = None
    class_tree_id: Optional[str] = None
    class_diagnostic_resonance: Optional[str] = None
    class_diagnostic_secondary: Optional[str] = None
    class_progress: Optional[Dict[str, List[int]]] = None
    # class_specialization is intentionally excluded — it is immutable once set
    # and can only be written through POST /player/{id}/claim-specialization.
    mastery: Optional[MasteryStats] = None
    codex_unlocked: Optional[List[str]] = None
    heroes_owned: Optional[List[str]] = None
    hero_progression: Optional[Dict[str, Dict[str, int]]] = None
    active_team: Optional[List[str]] = None
    kingdom_levels: Optional[Dict[str, int]] = None
    runs_completed: Optional[int] = None
    ward_defense_waves: Optional[int] = None
    bosses_defeated: Optional[List[str]] = None
    failure_counts: Optional[Dict[str, int]] = None
    inventory: Optional[Dict[str, int]] = None
    night_market_unlocked: Optional[bool] = None
    codex_shards: Optional[int] = None
    crowns: Optional[int] = None
    insight_crystals: Optional[int] = None
    refined_lotus_gems: Optional[int] = None
    lotus_gems_paid: Optional[int] = None
    epidemic_tokens: Optional[int] = None
    owned_skins: Optional[List[str]] = None
    equipped_skin: Optional[str] = None
    equipped_ward_skin: Optional[str] = None
    owned_upgrades: Optional[List[str]] = None
    owned_units: Optional[Dict[str, int]] = None
    unit_shards: Optional[Dict[str, int]] = None
    ward_loadout: Optional[List[str]] = None
    summon_history: Optional[List[Dict[str, Any]]] = None
    enemy_mastery: Optional[Dict[str, int]] = None
    battle_stars: Optional[Dict[str, int]] = None
    chapter_progress: Optional[int] = None
    class_trainees: Optional[Dict[str, int]] = None
    university_credits: Optional[int] = None
    uni_practice_milestones_claimed: Optional[List[str]] = None
    # Legacy Academy ranks remain writable through their established material
    # purchase flow; the Ward Aegis sidegrade is stripped in update_player and
    # only granted by its dedicated imprint-consuming endpoint.
    hero_skill_upgrades: Optional[Dict[str, int]] = None
    practice_modules_completed: Optional[List[str]] = None
    seen_practice_curriculum: Optional[bool] = None
    seen_lv2_unlock: Optional[bool] = None
    seen_reminiscence: Optional[bool] = None
    seen_university_intro: Optional[bool] = None
    tutorial_summon_1_done: Optional[bool] = None
    tutorial_summon_2_done: Optional[bool] = None
    story_scenes_seen: Optional[List[str]] = None
    lessons_completed: Optional[List[str]] = None
    simulations_completed: Optional[List[str]] = None
    badge_progress: Optional[Dict[str, int]] = None
    claimed_milestones: Optional[List[str]] = None
    claimed_daily_milestones: Optional[List[str]] = None
    claimed_level_rewards: Optional[List[str]] = None
    claimed_chapter_chests: Optional[List[str]] = None
    claimed_chapter_3star: Optional[List[str]] = None
    claimed_journey_nodes: Optional[List[str]] = None
    owned_titles: Optional[List[str]] = None
    active_title: Optional[str] = None
    stamina: Optional[int] = None
    stamina_updated_at: Optional[str] = None
    age1_reward_day: Optional[str] = None
    age1_reward_units: Optional[int] = None
    age1_stamina_bonus_day: Optional[str] = None
    age1_stamina_bonus_sources: Optional[List[str]] = None
    age1_stamina_bonus_week: Optional[str] = None
    age1_refill_day: Optional[str] = None
    age1_refill_amount: Optional[int] = None
    wellness: Optional[WellnessState] = None
    daily_rounds: Optional[DailyRoundsState] = None
    realm_layout: Optional[Dict[str, str]] = None
    realm_decor: Optional[Dict[str, str]] = None
    realm_assignments: Optional[Dict[str, List[str]]] = None
    realm_production: Optional[Dict[str, Dict[str, Any]]] = None
    realm_seed: Optional[int] = None
    equipped_cards: Optional[List[str]] = None
    # Push 10 — hero equipment loadouts: heroId → slotId → itemId
    hero_equipment: Optional[Dict[str, Dict[str, str]]] = None
    seen_card_tutorial: Optional[bool] = None
    seen_call_tutorial: Optional[bool] = None
    # Task 570 — Chapter-level Area Boss key progression (str chapter_id → key state).
    chapter_boss_keys: Optional[Dict[str, Any]] = None
    # Canonical shift per choice chapter (str chapter_id → "day"|"evening"|"night").
    canonical_shifts: Optional[Dict[str, str]] = None


class ActivityCompletionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    activity_id: str
    completion_key: str = Field(min_length=1, max_length=160)


class LegacyDailyRoundsSettlementRequest(BaseModel):
    """The client may supply a legacy snapshot for audit matching only.

    Currency amounts and entitlement identifiers are derived exclusively from
    the persisted server snapshot and ``LEGACY_DAILY_REWARD_LEDGER``.
    """
    model_config = ConfigDict(extra="forbid")
    legacy_snapshot: Dict[str, Any] = Field(default_factory=dict)


class LegacyDailyRoundsAuthorizationRequest(BaseModel):
    """Administrative approval of an externally audited, historical V1 state."""
    model_config = ConfigDict(extra="forbid")
    player_id: str = Field(min_length=1, max_length=120)
    reviewed_state_hash: str = Field(min_length=64, max_length=64, pattern=r"^[a-f0-9]{64}$")


# ---------- Player Hero foundation ----------
# These definitions intentionally live beside the API models rather than in the
# roster/equipment models. Only the baseline and Level 35 sidegrade are
# currently playable; higher namespaces are contracts for future gated work.
PLAYER_HERO_STAT_KEYS = ("insight", "carePower", "intervention", "guard", "coordination")
PLAYER_HERO_STAT_TOTAL = 25
PLAYER_HERO_STAT_MAX = 10
PLAYER_HERO_RATES_BP = {"standard": 9400, "prodigy": 500, "convergence": 100}
PLAYER_HERO_FOCUS_IDS = {"lantern", "lotus", "compass", "bell"}
PLAYER_HERO_CORE_TRAITS = {"steady_hands", "clinical_eye", "quiet_resolve"}
PLAYER_HERO_NATURAL_TALENTS = {"pattern_reader", "rapid_learner", "protective_instinct"}
PLAYER_HERO_CREEDS = {"care_before_glory", "truth_in_practice", "leave_no_one_behind"}
PLAYER_HERO_STAGE_GATES = {
    "baseline": (30, True), "doctrine": (35, True), "resonance": (40, False),
    "echo": (40, False), "aegis": (45, False), "covenant": (45, False),
    "ascendant": (50, False), "exalted": (50, False), "genesis": (50, False),
    "sovereign": (50, False), "convergence": (50, False),
}


class PlayerHeroCreateRequest(BaseModel):
    # Identity is bounded at the API boundary. Valuable outcomes below are
    # still always derived server-side; clients cannot submit potential,
    # signature lineage, IDs, timestamps, or rewards.
    display_name: str = Field(min_length=1, max_length=24)
    pronouns: str = Field(min_length=1, max_length=32)
    appearance: Dict[str, int]
    focus: str
    stats: Dict[str, int]
    core_trait_id: str
    natural_talent_id: str
    creed_id: str


class PlayerHeroProficiencyRequest(BaseModel):
    source: Literal["university_practice", "qualifying_journey"]
    run_id: Optional[str] = None


def player_hero_requirements(doc: Dict[str, Any]) -> Dict[str, Any]:
    level = int(doc.get("player_level") or player_level_from_xp(int(doc.get("xp") or 0)))
    class_id = doc.get("class_tree_id")
    progress = (doc.get("class_progress") or {}).get(class_id, []) if class_id else []
    specialization = (doc.get("class_specialization") or {}).get(class_id) if class_id else None
    requirements = [
        {"id": "player_level_30", "label": "Player Level 30", "met": level >= 30,
         "detail": f"Level {level}/30"},
        {"id": "modern_opening", "label": "Opening identity and prologue completed",
         "met": bool(doc.get("opening_prologue_complete") and doc.get("identity_restored") and doc.get("prologue_complete")),
         "detail": "Modern opening complete" if doc.get("opening_prologue_complete") and doc.get("identity_restored") and doc.get("prologue_complete") else "Complete the modern opening and identity reconstruction"},
        {"id": "root_calling", "label": "Root Calling finalized", "met": bool(class_id),
         "detail": str(class_id) if class_id else "Choose a class"},
        {"id": "class_tier_30", "label": "Level-30 Class Tier claimed", "met": 30 in progress,
         "detail": "Claimed" if 30 in progress else "Claim the Level-30 class tier"},
        {"id": "specialization", "label": "Specialization selected", "met": bool(specialization),
         "detail": str(specialization) if specialization else "Choose a specialization"},
        {"id": "awakening_beat", "label": "Awakening beat completed", "met": bool(doc.get("awakening_beat_complete")),
         "detail": "Awakened" if doc.get("awakening_beat_complete") else "Complete the awakening story beat"},
    ]
    created = bool(doc.get("player_hero"))
    if created:
        state = "created"
    elif level < 20:
        state = "hidden"
    elif level < 30:
        state = "foreshadowed"
    elif all(item["met"] for item in requirements):
        state = "unlocked"
    else:
        state = "locked"
    return {"state": state, "canCreate": state == "unlocked", "requirements": requirements}


def _player_hero_public(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in Player(**doc).model_dump().items() if k != "economy_token"}


async def resolve_player_hero_journey_opportunity(player: Dict[str, Any], run: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Resolve one immutable development opportunity for one cleared Journey.

    The completed run owns the roll identity. Exploration only changes the
    threshold before the HMAC roll is evaluated; neither tile reloads nor retry
    requests can make another roll because the result (including no award) is
    persisted under the immutable run id.
    """
    hero = player.get("player_hero")
    if not hero:
        return None
    run_id = str(run.get("id") or "")
    if not run_id:
        return None
    resolved_run_ids = list(player.get("player_hero_opportunity_run_ids") or [])
    existing = next((row for row in (player.get("player_hero_opportunities") or []) if row.get("runId") == run_id), None)
    if existing:
        return existing
    # Never accept the mutable client-side aggregate for a valuable outcome.
    # This count is rebuilt from the server-frozen tiles and visit state.
    explored = max(1, sum(
        1 for tile in (run.get("tiles") or [])
        if isinstance(tile, dict) and tile.get("visited")
    ))
    # Base 20%, then +1pp per optional visited tile after five, capped +8pp.
    exploration_bonus_bp = min(800, max(0, explored - 5) * 100)
    threshold_bp = 2000 + exploration_bonus_bp
    secret = (os.environ.get("SESSION_SECRET") or "player-hero-opportunity").encode()
    digest = hmac.new(secret, f"{player['id']}:{run_id}:player-hero-opportunity".encode(), hashlib.sha256).digest()
    roll_bp = int.from_bytes(digest[:4], "big") % 10_000
    level = int(player.get("player_level") or player_level_from_xp(int(player.get("xp") or 0)))
    awarded = roll_bp < threshold_bp
    opportunity = {
        "id": f"player_hero_opportunity_{run_id}",
        "runId": run_id,
        "source": "journey",
        "resolvedAt": now_iso(),
        "exploredTileCount": explored,
        "thresholdBp": threshold_bp,
        "awarded": awarded,
        "kind": ("principle" if level >= 35 else "focus_blueprint") if awarded else None,
        "persistedResolution": "server_roll_once",
    }
    write = await db.players.update_one(
        {"id": player["id"], "player_hero_opportunity_run_ids": {"$ne": run_id}},
        {"$set": {"updated_at": now_iso()},
         "$addToSet": {"player_hero_opportunity_run_ids": run_id, "player_hero_opportunities": opportunity}},
    )
    if write.modified_count != 1:
        current = await db.players.find_one({"id": player["id"]}, {"_id": 0, "player_hero_opportunities": 1})
        return next((row for row in (current or {}).get("player_hero_opportunities") or [] if row.get("runId") == run_id), opportunity)
    return opportunity


# ---------- Routes ----------

@app.get("/healthz", include_in_schema=False)
async def healthz():
    """Process/import liveness probe; deliberately does not touch MongoDB."""
    return {"status": "ok"}


@app.get("/readyz", include_in_schema=False)
async def readyz():
    """Readiness probe that validates config and performs a non-mutating ping."""
    try:
        get_runtime_config()
        await client.admin.command("ping")
    except Exception:
        return JSONResponse(status_code=503, content={"status": "not_ready"})
    return {"status": "ok"}


@api_router.get("/")
async def root():
    return {"status": "ok", "service": "clinica-kingdom-of-healing"}


@api_router.post("/player")
async def create_player(payload: PlayerCreate):
    if payload.aptitude not in {"guardian", "sage", "warden", "weaver"}:
        raise HTTPException(status_code=400, detail="invalid aptitude")
    player = Player(
        name=payload.name.strip()[:24] or "Healer",
        aptitude=payload.aptitude,
        recommended_aptitude=payload.recommended_aptitude,
        learning_goal=payload.learning_goal,
        learning_profile=payload.learning_profile,
        codex_depth=payload.codex_depth or "simple",
        prologue_complete=payload.prologue_complete if payload.prologue_complete is not None else True,
        identity_restored=payload.identity_restored if payload.identity_restored is not None else True,
        diagnostic_intro_seen=payload.diagnostic_intro_seen if payload.diagnostic_intro_seen is not None else True,
        opening_prologue_complete=payload.opening_prologue_complete if payload.opening_prologue_complete is not None else True,
        opening_prologue_phase=payload.opening_prologue_phase,
        prologue_rewards_claimed=payload.prologue_rewards_claimed if payload.prologue_rewards_claimed is not None else True,
        # Heroes are earned exclusively through University Recruitment.
        heroes_owned=[],
        active_team=[],
        inventory={
            "Albuterol Mist": 1,
            "Glucose Gel": 1,
            "Fluid Bolus": 1,
            "Isolation Kit": 1,
            "Lab Token": 2,
        },
        codex_shards=100,
        kingdom_levels={
            "grand_ward_atrium": 3,
            "academy_of_healing": 1,
            "library_of_knowledge": 1,
            "hall_of_heroes": 1,
            "apothecary": 1,
        },
        realm_seed=random.randint(1, 2_000_000_000),
        realm_layout={
            "grand_ward_atrium": "atrium_plot",
            "clinica_university": "university_plot",
            "research_library": "library_plot",
            "hospital_ward": "hospital_plot",
            "hall_of_heroes": "training_hall_plot",
            "apothecary": "apothecary_plot",
            "sanctuary_bank": "bank_plot",
            "sanctuary_bazaar": "bazaar_plot",
            "nutrition_garden": "garden_plot",
            "ward_defense_tower": "defense_plot",
            "faction_embassy": "embassy_plot",
        },
    )
    doc = player.model_dump()
    # Only returned at account creation and never exposed by GET/PUT snapshots.
    # The client stores this opaque per-player credential for economy mutations.
    economy_token = issue_guest_session(player.id)
    doc["economy_token"] = economy_token
    await db.players.insert_one(doc)
    return {**player.model_dump(), "economy_token": economy_token}


@api_router.post("/player/{player_id}/session/migrate")
async def migrate_guest_session(player_id: str, x_clinica_economy_token: Optional[str] = Header(default=None)):
    """One-time bridge for local saves created before signed guest sessions."""
    doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="player not found")
    current = doc.get("economy_token")
    if not current or not x_clinica_economy_token or not hmac.compare_digest(x_clinica_economy_token, current):
        raise HTTPException(status_code=401, detail="legacy migration credential required")
    if valid_guest_session(current, player_id):
        raise HTTPException(status_code=409, detail="guest session already migrated")
    session = issue_guest_session(player_id)
    await db.players.update_one(
        {"id": player_id, "economy_token": current},
        {"$set": {"economy_token": session, "updated_at": now_iso()}},
    )
    return {"session_token": session}


@api_router.get("/player/{player_id}")
async def get_player(
    player_id: str,
    x_clinica_session: Optional[str] = Header(default=None),
    x_clinica_economy_token: Optional[str] = Header(default=None),
):
    doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(doc, player_id, x_clinica_session, x_clinica_economy_token):
        raise HTTPException(status_code=401, detail="invalid player credential")
    # Creation is the normal credential-delivery path. Do not echo a reusable
    # credential from ordinary account reads.
    return {k: v for k, v in Player(**doc).model_dump().items() if k != "economy_token"}


@api_router.get("/player/{player_id}/player-hero/eligibility")
async def get_player_hero_eligibility(
    player_id: str,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Return the persisted gate state without exposing any creation inputs."""
    doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(doc, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    return player_hero_requirements(doc)


def _roll_player_hero_potential() -> str:
    # SystemRandom is server-side and never seeded from client input. The
    # persisted receipt makes this roll a one-time operation even across
    # retries, reloads, and concurrent requests.
    roll = secrets.randbelow(10_000)
    if roll < PLAYER_HERO_RATES_BP["convergence"]:
        return "convergence"
    if roll < PLAYER_HERO_RATES_BP["convergence"] + PLAYER_HERO_RATES_BP["prodigy"]:
        return "prodigy"
    return "standard"


def _validate_player_hero_create(payload: PlayerHeroCreateRequest) -> None:
    appearance_limits = {
        "skinTone": (0, 5), "hairStyle": (0, 4), "hairColor": (0, 7),
        "faceStyle": (0, 5), "accentColor": (0, 7),
    }
    if set(payload.appearance) != set(appearance_limits):
        raise HTTPException(status_code=422, detail="appearance must contain exactly the five bounded appearance fields")
    for key, (low, high) in appearance_limits.items():
        value = payload.appearance[key]
        if not isinstance(value, int) or value < low or value > high:
            raise HTTPException(status_code=422, detail=f"{key} must be an integer from {low} to {high}")
    if payload.focus not in PLAYER_HERO_FOCUS_IDS:
        raise HTTPException(status_code=422, detail="unknown Player Hero Focus")
    if payload.core_trait_id not in PLAYER_HERO_CORE_TRAITS:
        raise HTTPException(status_code=422, detail="unknown Core Trait")
    if payload.natural_talent_id not in PLAYER_HERO_NATURAL_TALENTS:
        raise HTTPException(status_code=422, detail="unknown Natural Talent")
    if payload.creed_id not in PLAYER_HERO_CREEDS:
        raise HTTPException(status_code=422, detail="unknown Creed")
    if set(payload.stats) != set(PLAYER_HERO_STAT_KEYS):
        raise HTTPException(status_code=422, detail="stats must contain exactly five Player Hero combat stats")
    if any(not isinstance(payload.stats[key], int) or payload.stats[key] < 0 or payload.stats[key] > PLAYER_HERO_STAT_MAX for key in PLAYER_HERO_STAT_KEYS):
        raise HTTPException(status_code=422, detail=f"each combat stat must be an integer from 0 to {PLAYER_HERO_STAT_MAX}")
    if sum(payload.stats.values()) != PLAYER_HERO_STAT_TOTAL:
        raise HTTPException(status_code=422, detail=f"combat stat allocations must total {PLAYER_HERO_STAT_TOTAL}")


@api_router.post("/player/{player_id}/player-hero/create")
async def create_player_hero(
    player_id: str,
    payload: PlayerHeroCreateRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Create the one Player Hero, atomically and exactly once.

    The client may choose bounded identity and baseline options. The server
    snapshots Root Calling, derives the typed Signature, rolls Potential, and
    owns all timestamps/IDs. Replay returns the original record unchanged.
    """
    doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(doc, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    if doc.get("player_hero"):
        return {"player": _player_hero_public(doc), "player_hero": doc["player_hero"], "already_created": True}
    eligibility = player_hero_requirements(doc)
    if not eligibility["canCreate"]:
        raise HTTPException(status_code=409, detail={"message": "Player Hero is not unlocked", "eligibility": eligibility})
    _validate_player_hero_create(payload)

    class_id = str(doc["class_tree_id"])
    specialization_id = str((doc.get("class_specialization") or {}).get(class_id))
    element_by_class = {
        "medic": "River", "scholar": "Mind", "alchemist": "Fire",
        "village_caretaker": "Growth", "ward_commander": "Protection",
    }
    now = now_iso()
    receipt_id = str(uuid.uuid4())
    potential = _roll_player_hero_potential()
    signature_id = f"signature_{class_id}_{specialization_id}"
    hero_id = f"player_hero_{uuid.uuid4()}"
    hero = {
        "id": hero_id,
        "state": "created",
        "identity": {
            "displayName": payload.display_name.strip()[:24],
            "pronouns": payload.pronouns.strip()[:32],
            "appearance": dict(payload.appearance),
            "focus": payload.focus,
            "rootCalling": {"classId": class_id, "specializationId": specialization_id, "capturedAt": now},
        },
        "skillDNA": {
            "element": element_by_class.get(class_id, "Mind"),
            "actionType": "support",
            "signatureId": signature_id,
            "signatureTier": "standard",
            "equilibriumCost": 1,
        },
        "stats": dict(payload.stats),
        "potential": {"tier": potential, "rolledAt": now, "receiptId": receipt_id, "ratesBp": PLAYER_HERO_RATES_BP},
        "progression": {
            "coreTraitId": payload.core_trait_id, "acquiredTraitId": None,
            "naturalTalentId": payload.natural_talent_id, "acquiredTalentId": None,
            "activeFeatIds": [], "creedId": payload.creed_id,
            "signatureLineageId": signature_id, "covenantId": None, "primaryAegisId": None,
            "proficiency": 0, "proficiencyEvidence": [],
        },
        "equilibrium": {
            "activeStrongEffects": 0, "counterTags": ["standard_signature"],
            "amplificationCap": 0.25, "mitigationCap": 0.25, "freeActionCap": 0,
        },
        "createdAt": now,
    }
    # The predicate is the exactly-once lock. A concurrent request cannot
    # replace this record or generate a second Potential Profile.
    write = await db.players.update_one(
        {"id": player_id, "$or": [
            {"player_hero": {"$exists": False}},
            {"player_hero": None},
        ]},
        {"$set": {
            "player_hero": hero,
            "player_hero_creation_receipt": {
                "receipt_id": receipt_id, "created_at": now, "hero_id": hero_id,
            },
            "updated_at": now,
        }},
    )
    if write.modified_count != 1:
        current = await db.players.find_one({"id": player_id}, {"_id": 0})
        if not current:
            raise HTTPException(status_code=404, detail="player not found")
        if current.get("player_hero"):
            return {"player": _player_hero_public(current), "player_hero": current["player_hero"], "already_created": True}
        raise HTTPException(status_code=409, detail="Player Hero state changed; retry")
    updated = await db.players.find_one({"id": player_id}, {"_id": 0})
    return {"player": _player_hero_public(updated), "player_hero": hero, "already_created": False}


@api_router.post("/player/{player_id}/player-hero/proficiency")
async def award_player_hero_proficiency(
    player_id: str,
    payload: PlayerHeroProficiencyRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Grant one proficiency only after server-verifiable meaningful practice.

    There is deliberately no shop, fragment, currency, or paid pathway here.
    The evidence receipt is idempotent so offline retries cannot duplicate it.
    """
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    if not player.get("player_hero"):
        raise HTTPException(status_code=409, detail="create a Player Hero before earning proficiency")
    if payload.source == "university_practice":
        # University completion receipts are not server-issued yet. Refuse
        # rather than treating client-owned aggregate counters as evidence.
        raise HTTPException(status_code=409, detail="University proficiency is unavailable until verified activity receipts ship")
    if not payload.run_id:
        raise HTTPException(status_code=422, detail="a completed Journey run is required")
    run = await db.journey_runs.find_one(
        {"id": payload.run_id, "player_id": player_id, "status": "cleared"}, {"_id": 0, "id": 1},
    )
    if not run:
        raise HTTPException(status_code=409, detail="Journey practice must come from a cleared server run")
    # The client never chooses a receipt key. A cleared run can produce exactly
    # one canonical practice receipt regardless of retry count or payload.
    evidence_id = f"journey-practice:{run['id']}"
    evidence = {
        "id": evidence_id,
        "practiceType": "validated_meaningful_practice",
        "source": "qualifying_journey",
        "verifiedAt": now_iso(),
        "proficiencyAward": 1,
    }
    write = await db.players.update_one(
        {"id": player_id, "player_hero.progression.proficiencyEvidence.id": {"$ne": evidence_id}},
        {
            "$inc": {"player_hero.progression.proficiency": 1},
            "$push": {"player_hero.progression.proficiencyEvidence": evidence},
            "$set": {"updated_at": now_iso()},
        },
    )
    current = await db.players.find_one({"id": player_id}, {"_id": 0})
    return {
        "player": _player_hero_public(current),
        "already_awarded": write.modified_count != 1,
        "proficiency": int((current.get("player_hero") or {}).get("progression", {}).get("proficiency", 0)),
    }


def _daily_version(state: Dict[str, Any]) -> int:
    try:
        return int(state.get("version") or 0)
    except (TypeError, ValueError):
        return 0


def _merge_daily_rounds_state(current: Dict[str, Any], candidate: Dict[str, Any]) -> Dict[str, Any]:
    """Merge only monotonic V2 state so an old device cannot erase progress.

    This is intentionally an account-state merge, not a reward authority:
    the economy endpoint still derives Daily/Weekly Stamina from server-issued
    activity receipts. Objective progress is merged for presentation and
    continuity across devices, while every protected economy field remains
    outside the generic player snapshot.
    """
    current = dict(current or {})
    candidate = dict(candidate or {})
    if _daily_version(current) != 2:
        return candidate
    if _daily_version(candidate) != 2:
        return current

    merged = dict(current)
    current_day, candidate_day = str(current.get("daily_date") or ""), str(candidate.get("daily_date") or "")
    if candidate_day > current_day:
        merged.update(candidate)
    elif candidate_day == current_day:
        current_objectives = {str(row.get("id")): dict(row) for row in current.get("objectives") or [] if row.get("id")}
        candidate_objectives = {str(row.get("id")): dict(row) for row in candidate.get("objectives") or [] if row.get("id")}
        if not current_objectives:
            merged["objectives"] = list(candidate_objectives.values())
        else:
            objective_rows: List[Dict[str, Any]] = []
            for objective_id, existing_objective in current_objectives.items():
                incoming = candidate_objectives.get(objective_id, {})
                target = max(0, int(existing_objective.get("target") or 0))
                progress = min(target, max(
                    int(existing_objective.get("progress") or 0),
                    int(incoming.get("progress") or 0),
                ))
                row = dict(existing_objective)
                row["progress"] = progress
                row["claimed"] = bool(existing_objective.get("claimed")) or (
                    bool(incoming.get("claimed")) and progress >= target
                )
                objective_rows.append(row)
            merged["objectives"] = objective_rows
        merged["all_complete_claimed"] = bool(current.get("all_complete_claimed")) or bool(candidate.get("all_complete_claimed"))

    current_week, candidate_week = str(current.get("weekly_key") or ""), str(candidate.get("weekly_key") or "")
    if candidate_week > current_week:
        for key in ("weekly_key", "weekly_days_completed", "weekly_credited_dates", "weekly_claimed", "weekly_momentum_claimed"):
            if key in candidate:
                merged[key] = candidate[key]
    elif candidate_week == current_week:
        dates = sorted({str(date) for date in (current.get("weekly_credited_dates") or []) + (candidate.get("weekly_credited_dates") or []) if date})
        merged["weekly_credited_dates"] = dates
        merged["weekly_days_completed"] = max(int(current.get("weekly_days_completed") or 0), int(candidate.get("weekly_days_completed") or 0), len(dates))
        merged["weekly_claimed"] = bool(current.get("weekly_claimed")) or bool(candidate.get("weekly_claimed"))
        merged["weekly_momentum_claimed"] = sorted({
            str(marker) for marker in (current.get("weekly_momentum_claimed") or []) + (candidate.get("weekly_momentum_claimed") or [])
        })

    merged["version"] = 2
    merged["legacy_claims_settled"] = bool(current.get("legacy_claims_settled")) or bool(candidate.get("legacy_claims_settled"))
    merged["legacy_settlement_id"] = current.get("legacy_settlement_id") or candidate.get("legacy_settlement_id")
    return merged


def _legacy_daily_entitlement_ids(state: Dict[str, Any]) -> List[str]:
    """Return only fully-earned, unclaimed V1 entries from a persisted snapshot."""
    result: List[str] = []
    objectives = state.get("objectives") or []
    for objective in objectives:
        objective_id = str(objective.get("id") or "")
        if objective_id in LEGACY_DAILY_REWARD_LEDGER and not objective.get("claimed") and int(objective.get("progress") or 0) >= int(objective.get("target") or 0):
            result.append(objective_id)
    if objectives and not state.get("all_complete_claimed") and all(int(row.get("progress") or 0) >= int(row.get("target") or 0) for row in objectives):
        result.append("daily_all_complete")

    weekly_tasks = state.get("weekly_tasks") or []
    for task in weekly_tasks:
        task_id = str(task.get("id") or "")
        if task_id in LEGACY_DAILY_REWARD_LEDGER and not task.get("claimed") and int(task.get("progress") or 0) >= int(task.get("target") or 0):
            result.append(task_id)
    if (
        weekly_tasks
        and not state.get("weekly_all_complete_claimed")
        and not state.get("weekly_claimed")
        and all(int(row.get("progress") or 0) >= int(row.get("target") or 0) for row in weekly_tasks)
    ):
        result.append("weekly_all_complete")
    return sorted(set(result))


def _legacy_daily_settlement_increments(entitlement_ids: List[str]) -> Dict[str, int]:
    increments: Dict[str, int] = {}
    for entitlement_id in entitlement_ids:
        for field, amount in LEGACY_DAILY_REWARD_LEDGER[entitlement_id].items():
            increments[field] = increments.get(field, 0) + int(amount)
    return increments


def _legacy_daily_state_hash(state: Dict[str, Any]) -> str:
    """Hash the exact persisted V1 record an administrator has reviewed."""
    return hashlib.sha256(
        json.dumps(state, sort_keys=True, separators=(",", ":"), default=str).encode()
    ).hexdigest()


def _apply_legacy_hero_xp(player: Dict[str, Any], total_xp: int) -> Dict[str, Dict[str, int]]:
    """Persist the historical reward's total hero XP without trusting hero levels."""
    progression = {hero_id: dict(progress) for hero_id, progress in (player.get("hero_progression") or {}).items()}
    team = [hero_id for hero_id in (player.get("active_team") or []) if hero_id]
    pool = team or list(player.get("heroes_owned") or [])[:3]
    if total_xp <= 0 or not pool:
        return progression
    per_hero = max(1, round(total_xp / len(pool)))
    for hero_id in pool:
        progress = dict(progression.get(hero_id) or {"star": 1, "copies": 0, "level": 1, "xp": 0})
        progress["xp"] = max(0, int(progress.get("xp") or 0)) + per_hero
        progression[hero_id] = progress
    return progression


def _canonical_daily_rounds_after_legacy_settlement(settlement_id: str) -> Dict[str, Any]:
    return {
        "version": 2,
        "legacy_claims_settled": True,
        "legacy_settlement_id": settlement_id,
        "daily_date": "",
        "weekly_key": "",
        "objectives": [],
        "weekly_tasks": [],
        "weekly_credited_dates": [],
        "weekly_days_completed": 0,
        "all_complete_claimed": False,
        "weekly_claimed": False,
        "weekly_all_complete_claimed": False,
        "weekly_momentum_claimed": [],
        "weekly_material_earned": 0,
    }


@api_router.put("/player/{player_id}", response_model=Player)
async def update_player(
    player_id: str,
    payload: PlayerUpdate,
    x_clinica_session: Optional[str] = Header(default=None),
    x_clinica_economy_token: Optional[str] = Header(default=None),
):
    existing = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(existing, player_id, x_clinica_session or x_clinica_economy_token, None):
        raise HTTPException(status_code=401, detail="invalid player credential")
    updates: Dict[str, Any] = {k: v for k, v in payload.model_dump().items() if v is not None}
    # Economy pacing is intentionally never snapshot-writable. Dedicated,
    # conditional mutations below own these fields so stale devices cannot reset
    # refills, bonus claims, repeat budget, or stamina.
    for field in (
        "stamina", "stamina_updated_at", "age1_reward_day", "age1_reward_units",
        "age1_stamina_bonus_day", "age1_stamina_bonus_sources",
        "age1_stamina_bonus_week", "age1_refill_day", "age1_refill_amount",
        "xp", "player_level", "mastery", "hero_progression", "inventory",
        "codex_shards", "crowns", "epidemic_tokens", "university_credits",
        "insight_crystals", "refined_lotus_gems", "lotus_gems_paid",
        "heroes_owned", "codex_unlocked", "kingdom_levels", "owned_equipment",
        "owned_skins", "owned_upgrades", "owned_units", "unit_shards",
        "summon_history", "equipped_cards", "hero_equipment", "wellness",
        # Skill Academy ranks are combat-affecting progression. The former
        # client-only material check is not authority; a dedicated conditional
        # upgrade endpoint must own future rank changes.
        "hero_skill_upgrades",
        # The University completion endpoint owns these counters. Never accept
        # them from a snapshot or a stale client could turn repeat rewards back
        # into first-clear rewards.
        "uni_cue_lab_count", "uni_triage_count", "uni_stack_count",
         "clinical_practice", "uni_practice_milestones_claimed",
        "bosses_defeated", "claimed_milestones", "owned_titles", "owned_skins",
        # Chapter readiness and Journey key/node claims are server-authoritative
        # so a client snapshot cannot unlock a chapter by fabricating progress.
        "chapter_progress", "chapter_boss_keys", "claimed_journey_nodes",
        "claimed_level_rewards", "claimed_chapter_chests", "claimed_chapter_3star",
        # Ward rewards, rotations, records and Aegis protections are mutated
        # only by dedicated conditional endpoints. Snapshot writes must never
        # reset pity, caps or run claims.
        "ward_sigils", "ward_defense_records", "ward_defense_rotation",
        "ward_defense_claimed_run_ids", "ward_defense_recent_families",
        "ward_defense_missed_families", "ward_exchange_purchases",
        "ward_aegis_pity", "ward_aegis_lifetime_fragments", "ward_aegis_week_key",
        "ward_aegis_weekly_random_drops", "ward_aegis_milestone_granted", "ward_aegis_qualifying_day",
        "ward_defense_reward_day", "ward_defense_reward_claims",
        # Player Hero state is valuable and exactly-once. It is never accepted
        # through a generic snapshot, including stale local saves.
        "player_hero", "player_hero_creation_receipt", "awakening_beat_complete",
        "player_hero_opportunities", "player_hero_opportunity_run_ids",
        # These are Player Hero creation gates. Allowing a generic snapshot to
        # change any one of them would turn the protected create endpoint into
        # a client-forged progression shortcut.
        "opening_prologue_complete", "opening_prologue_phase", "prologue_complete",
        "identity_restored", "class_tree_id", "class_progress", "class_specialization",
    ):
        updates.pop(field, None)
    daily_candidate: Optional[Dict[str, Any]] = None
    if "daily_rounds" in updates:
        # A V1 snapshot is historical evidence, not an import format. Let only
        # the settlement endpoint retire it, otherwise a forged/stale generic
        # PUT could manufacture a legacy payout or race it out of existence.
        if _daily_version(dict(existing.get("daily_rounds") or {})) != 2:
            updates.pop("daily_rounds", None)
        else:
            daily_candidate = dict(updates.pop("daily_rounds") or {})
    # class_specialization is immutable once set; refuse any attempt to overwrite
    # it through the generic update path — use POST /claim-specialization instead.
    updates.pop("class_specialization", None)
    if "mastery" in updates and isinstance(updates["mastery"], dict) is False:
        updates["mastery"] = updates["mastery"].model_dump()
    updates["updated_at"] = now_iso()
    if daily_candidate is not None:
        # Compare-and-set is required here: two stale devices may both merge
        # against the same snapshot, and an unconditional write would let the
        # second response erase monotonic progress from the first.
        latest = existing
        for _ in range(4):
            current_daily = dict(latest.get("daily_rounds") or {})
            if _daily_version(current_daily) != 2:
                raise HTTPException(status_code=409, detail="Daily Rounds state changed; retry")
            merged_daily = _merge_daily_rounds_state(current_daily, daily_candidate)
            committed = await db.players.update_one(
                {"id": player_id, "daily_rounds": current_daily},
                {"$set": {**updates, "daily_rounds": merged_daily, "updated_at": now_iso()}},
            )
            if committed.matched_count == 1:
                refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
                return Player(**refreshed)
            latest = await db.players.find_one({"id": player_id}, {"_id": 0})
            if not latest:
                raise HTTPException(status_code=404, detail="player not found")
        raise HTTPException(status_code=409, detail="Daily Rounds changed concurrently; retry")
    await db.players.update_one({"id": player_id}, {"$set": updates})
    refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
    return Player(**refreshed)


@api_router.post("/player/{player_id}/daily-rounds/legacy-settlement", response_model=Dict[str, Any])
async def settle_legacy_daily_rounds(
    player_id: str,
    payload: LegacyDailyRoundsSettlementRequest,
    x_clinica_session: Optional[str] = Header(default=None),
    x_clinica_economy_token: Optional[str] = Header(default=None),
):
    """Settle V1 earned-but-unclaimed rewards exactly once from server state.

    The payload is retained only as an audit hash. The server uses its persisted
    legacy Daily snapshot and fixed reward ledger, so a caller cannot nominate
    currencies, reward values, or a fabricated completion.
    """
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session or x_clinica_economy_token, None):
        raise HTTPException(status_code=401, detail="invalid player credential")

    legacy = dict(player.get("daily_rounds") or {})
    if _daily_version(legacy) == 2:
        return {"player": Player(**player).model_dump(), "settled": False, "entitlement_ids": []}

    entitlement_ids = _legacy_daily_entitlement_ids(legacy)
    legacy_state_hash = _legacy_daily_state_hash(legacy)
    settlement_id = f"daily-rounds-v1:{player_id}:{legacy_state_hash}"
    if not entitlement_ids:
        # A V1 record with no earned claim has no economic ambiguity. Retire it
        # directly so normal accounts do not retry an unnecessary review path.
        await db.players.update_one(
            {"id": player_id, "daily_rounds": legacy},
            {"$set": {
                "daily_rounds": _canonical_daily_rounds_after_legacy_settlement(f"{settlement_id}:empty"),
                "updated_at": now_iso(),
            }},
        )
        refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
        return {"player": Player(**refreshed).model_dump(), "settled": False, "entitlement_ids": []}
    authorization = await db.daily_rounds_legacy_authorizations.find_one({
        "player_id": player_id,
        "state_hash": legacy_state_hash,
        "status": "approved",
    }, {"_id": 0})
    if not authorization:
        # V1 was historically client-writable. Preserve the record in place
        # until an administrator approves a hash matched against a trusted
        # export/backup; never convert ambiguous data into currency.
        return {
            "player": Player(**player).model_dump(),
            "settled": False,
            "entitlement_ids": [],
            "authorization_required": True,
        }
    snapshot_hash = hashlib.sha256(json.dumps(payload.legacy_snapshot, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
    receipt = {
        "settlement_id": settlement_id,
        "player_id": player_id,
        "legacy_state_hash": legacy_state_hash,
        "entitlement_ids": entitlement_ids,
        "increments": _legacy_daily_settlement_increments(entitlement_ids),
        "legacy_snapshot_hash": snapshot_hash,
        "status": "pending",
        "created_at": now_iso(),
    }
    try:
        await db.daily_rounds_legacy_settlements.insert_one(receipt)
    except DuplicateKeyError:
        receipt = await db.daily_rounds_legacy_settlements.find_one({"settlement_id": settlement_id}, {"_id": 0})
        if not receipt or receipt.get("legacy_state_hash") != legacy_state_hash:
            raise HTTPException(status_code=409, detail="legacy settlement is being prepared; retry")

    increments = dict(receipt["increments"])
    hero_xp = increments.pop("hero_xp", 0)
    canonical_daily = _canonical_daily_rounds_after_legacy_settlement(settlement_id)
    update: Dict[str, Any] = {
        "$set": {
            "daily_rounds": canonical_daily,
            "hero_progression": _apply_legacy_hero_xp(player, hero_xp),
            "updated_at": now_iso(),
        },
    }
    if increments:
        update["$inc"] = increments
    committed = await db.players.update_one(
        {"id": player_id, "daily_rounds": legacy},
        update,
    )
    refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
    if (refreshed.get("daily_rounds") or {}).get("legacy_settlement_id") != settlement_id:
        # A V2 record without this receipt predates the migration path. Do not
        # invent a reward from a client payload; retain the pending audit record
        # so an operator can reconcile the historical server snapshot.
        return {"player": Player(**refreshed).model_dump(), "settled": False, "entitlement_ids": []}
    await db.daily_rounds_legacy_settlements.update_one(
        {"settlement_id": settlement_id},
        {"$set": {"status": "settled", "settled_at": now_iso()}},
    )
    return {
        "player": Player(**refreshed).model_dump(),
        "settled": committed.modified_count == 1,
        "entitlement_ids": entitlement_ids if committed.modified_count == 1 else [],
    }


@api_router.post("/faculty/admin/daily-rounds/legacy-authorizations", response_model=Dict[str, Any])
async def authorize_legacy_daily_rounds_settlement(
    payload: LegacyDailyRoundsAuthorizationRequest,
    x_clinica_curriculum_admin_key: Optional[str] = Header(default=None),
):
    """Seal a V1 payout only after an administrator reviews a trusted export.

    The request cannot select rewards. It must name the exact hash of the
    current persisted state; the server re-derives every entitlement/value.
    """
    administrator = curriculum_admin_principal(x_clinica_curriculum_admin_key)
    player = await db.players.find_one({"id": payload.player_id}, {"_id": 0, "daily_rounds": 1})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    legacy = dict(player.get("daily_rounds") or {})
    if _daily_version(legacy) == 2:
        raise HTTPException(status_code=409, detail="player no longer has a V1 Daily record")
    state_hash = _legacy_daily_state_hash(legacy)
    if not hmac.compare_digest(payload.reviewed_state_hash, state_hash):
        raise HTTPException(status_code=409, detail="reviewed state does not match the current server record")
    entitlement_ids = _legacy_daily_entitlement_ids(legacy)
    await db.daily_rounds_legacy_authorizations.update_one(
        {"player_id": payload.player_id},
        {"$set": {
            "player_id": payload.player_id,
            "state_hash": state_hash,
            "entitlement_ids": entitlement_ids,
            "status": "approved",
            "approved_by": administrator["id"],
            "approved_at": now_iso(),
        }},
        upsert=True,
    )
    return {"player_id": payload.player_id, "state_hash": state_hash, "entitlement_ids": entitlement_ids}


@api_router.post("/player/{player_id}/economy", response_model=Dict[str, Any])
async def mutate_age1_economy(
    player_id: str,
    payload: EconomyMutation,
    x_clinica_session: Optional[str] = Header(default=None),
    x_clinica_economy_token: Optional[str] = Header(default=None),
):
    """Atomically apply one Age 1 pacing mutation against persisted state.

    This endpoint deliberately derives every limit from Mongo's current player
    document. Generic snapshots cannot write the relevant fields.
    """
    existing = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(existing, player_id, x_clinica_session or x_clinica_economy_token, None):
        raise HTTPException(status_code=401, detail="invalid player economy credential")
    now = datetime.now(timezone.utc)
    day, week = age1_day_key(now), age1_week_key(now)
    level = int(existing.get("player_level") or 1)
    cap = age1_stamina_cap(level)
    stamina = min(cap, max(0, int(existing.get("stamina", 20))))
    try:
        updated_at = datetime.fromisoformat(str(existing.get("stamina_updated_at", now_iso())).replace("Z", "+00:00"))
        gained = max(0, int((now - updated_at).total_seconds() // (15 * 60)))
    except (TypeError, ValueError):
        gained = 0
    stamina = min(cap, stamina + gained)
    next_doc: Dict[str, Any] = {"stamina": stamina, "stamina_updated_at": now_iso(), "updated_at": now_iso()}
    result: Dict[str, Any] = {"ok": True, "multiplier": 1.0, "stamina_bonus": 0}
    reward_increments: Dict[str, int] = {}

    if payload.kind == "spend_stamina":
        cost = max(0, int(payload.cost))
        if cost <= 0 or stamina < cost:
            raise HTTPException(status_code=409, detail="insufficient stamina")
        next_doc["stamina"] = stamina - cost
        commitment = {"id": str(uuid.uuid4()), "cost": cost, "created_at": now_iso(), "consumed": False}
        next_doc["age1_stamina_commitments"] = [
            c for c in (existing.get("age1_stamina_commitments") or []) if not c.get("consumed")
        ][-7:] + [commitment]
        result["stamina_commitment_id"] = commitment["id"]
    elif payload.kind == "refill_stamina":
        amount = max(0, int(payload.amount))
        price = AGE1_REFILL_PACKS.get(amount)
        if price is None:
            raise HTTPException(status_code=422, detail="unknown stamina refill pack")
        crowns = max(0, int(existing.get("crowns", 0)))
        if crowns < price:
            raise HTTPException(status_code=409, detail="not enough Crowns")
        used = int(existing.get("age1_refill_amount", 0)) if existing.get("age1_refill_day") == day else 0
        allowed = max(0, cap - used)
        granted = min(amount, allowed, cap - stamina)
        if granted <= 0:
            raise HTTPException(status_code=409, detail="daily refill limit reached")
        next_doc.update({"stamina": stamina + granted, "age1_refill_day": day, "age1_refill_amount": used + granted, "crowns": crowns - price})
        result["granted"] = granted
        result["cost"] = price
    elif payload.kind == "consume_repeat_budget":
        units = max(0, int(payload.units))
        used = int(existing.get("age1_reward_units", 0)) if existing.get("age1_reward_day") == day else 0
        result["multiplier"] = age1_reward_multiplier(used, units)
        next_doc.update({"age1_reward_day": day, "age1_reward_units": used + units})
    else:
        source = (payload.source or "").strip()
        rule = AGE1_STAMINA_BONUSES.get(source)
        if not rule:
            raise HTTPException(status_code=422, detail="unknown stamina bonus source")
        expected_period, amount = rule
        if payload.period != expected_period:
            raise HTTPException(status_code=422, detail="invalid stamina bonus period")
        # Daily Rounds recoveries are only available after server-verified
        # lifecycle receipts, never from the client-persisted board snapshot.
        if source in {"daily_rounds_v2_complete", "weekly_momentum_complete"}:
            target = 3 if level >= 5 else 2
            receipts = await db.activity_completion_receipts.find(
                {"player_id": player_id, "daily_eligible": True},
                {"_id": 0, "activity_id": 1, "completed_at": 1},
            ).to_list(length=500)
            by_day: Dict[str, set] = {}
            for receipt in receipts:
                try:
                    receipt_day = age1_day_key(datetime.fromisoformat(str(receipt.get("completed_at") or "").replace("Z", "+00:00")))
                except (TypeError, ValueError):
                    continue
                by_day.setdefault(receipt_day, set()).add(str(receipt.get("activity_id") or ""))
            if source == "daily_rounds_v2_complete":
                if len(by_day.get(day, set())) < target:
                    raise HTTPException(status_code=409, detail="verified Daily Rounds target not complete")
            else:
                completed_days = sum(
                    1 for receipt_day, activities in by_day.items()
                    if age1_week_key(datetime.fromisoformat(f"{receipt_day}T00:00:00+00:00")) == week and len(activities) >= target
                )
                if completed_days < 5:
                    raise HTTPException(status_code=409, detail="verified Weekly Momentum target not complete")
        if expected_period == "week":
            if existing.get("age1_stamina_bonus_week") == week:
                raise HTTPException(status_code=409, detail="weekly stamina bonus already claimed")
            next_doc["age1_stamina_bonus_week"] = week
        else:
            sources = existing.get("age1_stamina_bonus_sources", []) if existing.get("age1_stamina_bonus_day") == day else []
            if source in sources:
                raise HTTPException(status_code=409, detail="daily stamina bonus already claimed")
            next_doc.update({"age1_stamina_bonus_day": day, "age1_stamina_bonus_sources": [*sources, source]})
        granted = min(amount, cap - stamina)
        next_doc["stamina"] = stamina + granted
        result["stamina_bonus"] = granted
        # Completion rewards are derived here rather than accepted from the
        # Daily Rounds client payload. The same period marker makes both the
        # educational stamina and the power reward idempotent.
        # Daily Rounds V2 is intentionally stamina-only. It replaces the old
        # objective/weekly currency ladder rather than stacking on top of it.
        if reward_increments:
            result["round_reward"] = reward_increments

    # Match the document read above: a concurrent mutation retries from fresh
    # state instead of overwriting its result.
    write = await db.players.update_one(
        {"id": player_id, "updated_at": existing.get("updated_at")},
        {"$set": next_doc, **({"$inc": reward_increments} if reward_increments else {})},
    )
    if write.modified_count != 1:
        raise HTTPException(status_code=409, detail="economy state changed; retry")
    refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
    result["player"] = Player(**refreshed).model_dump()
    return result


class ActivityAttemptRequest(BaseModel):
    tier: Literal["regular", "elite", "area_boss", "major_boss"] = "regular"


class UniversityPracticeCompletionRequest(BaseModel):
    activity: Literal["cue_lab", "triage", "stack"]
    difficulty: Literal["introductory", "standard", "advanced", "expert", "beginner"]
    challenge_id: str
    challenge_version: int = 1
    attempt_id: str
    score: int = Field(ge=0, le=100)
    safety_result: Literal["safe", "needs_review", "unsafe"]


class UniversityPracticeAttemptRequest(BaseModel):
    activity: Literal["cue_lab", "triage", "stack"]
    difficulty: Literal["introductory", "standard", "advanced", "expert", "beginner"]
    challenge_id: str
    challenge_version: int = 1


class ClinicalSimulationConfig(BaseModel):
    difficulty: Literal["introductory", "standard", "advanced", "expert"]
    style: Literal["guided", "focused", "transfer"]
    complicationId: Optional[str] = None
    assistance: Literal["none", "coach", "guided"] = "coach"


class ClinicalSimulationStartRequest(BaseModel):
    simulation_id: str
    config: ClinicalSimulationConfig
    retry_mode: Literal["same_branch", "new_variation", "similar_case", "guided"] = "new_variation"
    prior_attempt_id: Optional[str] = None


class ClinicalSimulationActionRequest(BaseModel):
    action_id: str


class GrandRoundsStartRequest(BaseModel):
    case_id: str
    case_version: int = Field(ge=1)
    retry_mode: Literal["same_case", "fresh_case", "guided"] = "fresh_case"
    prior_attempt_id: Optional[str] = None


class GrandRoundsResponseRequest(BaseModel):
    response_id: str


class GrandRoundsNotesRequest(BaseModel):
    notes: str = Field(max_length=2000)

class FacultyGrandRoundsDraftCreateRequest(BaseModel):
    case_id: Optional[str] = Field(default=None, min_length=3, max_length=80, pattern=r"^[a-z0-9][a-z0-9-]*$")
    manifest: Dict[str, Any]

class FacultyCredentialIssueRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    faculty_id: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
    role: Literal["author", "reviewer", "approver"]

class FacultyCredentialRotateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["author", "reviewer", "approver"]
    reason: str = Field(min_length=3, max_length=500)

class FacultyCredentialRevokeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(min_length=3, max_length=500)

class FacultyGrandRoundsRetireRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


class FacultyGrandRoundsApproveRequest(BaseModel):
    expected_revision: int = Field(ge=1)


class CrisisDrillStartRequest(BaseModel):
    drill_id: str
    drill_version: int = Field(ge=1)
    # training mode: full coaching, no timing rank impact.
    # crisis mode: timed, ranked completion for daily University event credit.
    mode: Literal["training", "crisis"] = "training"
    retry_mode: Literal["fresh_drill", "fresh_case", "same_case", "guided"] = "fresh_drill"


class CrisisDrillDecisionRequest(BaseModel):
    response_id: str


# This is deliberately small, explicit, and server-owned. The frontend may
# shuffle presentations, but it cannot invent a valid id/version/activity pair
# or attach unrelated mastery tags to a rewardable receipt.
PRACTICE_CHALLENGE_MANIFEST: Dict[str, Dict[str, Any]] = {}
for _activity, _ids, _domains, _topic in (
    ("cue_lab", ("cue_b1", "cue_b2", "cue_b3", "cue_b4", "cue_s1", "cue_s2", "cue_s3", "cue_s4", "cue_a1", "cue_a2", "cue_a3", "cue_e1"), ("assessment", "systems"), "clinical-assessment"),
    ("triage", ("tri_b1", "tri_b2", "tri_b3", "tri_b4", "tri_s1", "tri_s2", "tri_s3", "tri_s4", "tri_a1", "tri_a2", "tri_a3", "tri_e1"), ("judgment", "command"), "priority-care"),
    ("stack", ("stack_b1", "stack_b2", "stack_b3", "stack_b4", "stack_s1", "stack_s2", "stack_s3", "stack_s4", "stack_a1", "stack_a2", "stack_a3", "stack_e1"), ("stabilization", "systems"), "care-sequencing"),
):
    for _id in _ids:
        _difficulty = "introductory" if "_b" in _id else "standard" if "_s" in _id else "advanced" if "_a" in _id else "expert"
        PRACTICE_CHALLENGE_MANIFEST[_id] = {
            "activity": _activity, "difficulty": _difficulty, "version": 1,
            "family": _id.rsplit("_", 1)[0], "domains": list(_domains), "topics": [_topic],
        }

# The legacy Fading Apprentice lessons are fixed story exercises, rather than
# entries in the rotating client catalog. They still receive an explicit
# server-owned practice identity so only these reviewed lesson completions can
# obtain an issued receipt and the normal first/repeat University rewards.
PRACTICE_CHALLENGE_MANIFEST.update({
    "legacy-fading-apprentice-cue-hunt": {
        "activity": "cue_lab", "difficulty": "introductory", "version": 1,
        "family": "fading-apprentice", "domains": ["assessment", "systems"],
        "topics": ["clinical-assessment"],
    },
    "legacy-fading-apprentice-rapid-triage": {
        "activity": "triage", "difficulty": "introductory", "version": 1,
        "family": "fading-apprentice", "domains": ["judgment", "command"],
        "topics": ["priority-care"],
    },
    "legacy-fading-apprentice-stabilize-stack": {
        "activity": "stack", "difficulty": "introductory", "version": 1,
        "family": "fading-apprentice", "domains": ["stabilization", "systems"],
        "topics": ["care-sequencing"],
    },
})

# Clinical Simulation Lab content is declarative and server-owned. The client
# may render it, but it never supplies a legal action, effect, score, branch,
# or reward. Keep this concise server mirror in step with the reviewed client
# catalog in clinicalSimulation.ts.
CLINICAL_SIMULATION_MANIFESTS: Dict[str, Dict[str, Any]] = {
    "sim-airway-quiet-change": {
        "version": 1, "family": "airway-change", "domain": "airway", "difficulty": "introductory", "style": "guided", "title": "The Quiet Change",
        "actions": {
            "assess-respiratory": {"group": "assess", "beats": ["assess"], "reveal": ["spo2-trend"], "objectives": ["assess-breathing"], "announcement": "You pause to assess the new breathing change."},
            "support-oxygen": {"group": "support", "beats": ["prioritize", "intervene"], "delta": {"stability": 18, "oxygenation": 28}, "objectives": ["support-airway"], "announcement": "Airway support improves oxygenation."},
            "wait-and-see": {"group": "treat", "beats": ["prioritize", "intervene"], "delta": {"stability": -20}, "unsafe": True, "announcement": "The delay allows the respiratory concern to worsen."},
            "reassess-luo": {"group": "reassess", "beats": ["reassess"], "objectives": ["reassess-response"], "announcement": "A repeat check confirms the response to support."},
            "escalate-respiratory": {"group": "escalate", "beats": ["reassess", "adaptation"], "objectives": ["escalate-concern"], "announcement": "You communicate the worsening trend for further review."},
        },
        "initial": {"stability": 68, "oxygenation": 48, "perfusion": 72, "concern": "New breathing change", "acuity": "high", "hiddenFindings": ["spo2-trend"], "complications": [], "interventionCount": 0},
        "known": [{"id": "spo2-trend", "label": "Oxygen trend", "value": "SpO₂ has fallen from 96% to 89%.", "discoveredAt": "reveal"}],
        "objectives": {"assess-breathing": 25, "support-airway": 35, "reassess-response": 30, "escalate-concern": 10},
        "principle": "A new breathing change deserves assessment, support, and reassessment.",
    },
    "sim-perfusion-hidden": {
        "version": 1, "family": "perfusion-hidden", "domain": "assessment", "difficulty": "standard", "style": "transfer", "title": "The Hidden Perfusion Signal",
        "actions": {
            "assess-perfusion": {"group": "assess", "beats": ["assess"], "reveal": ["urine-output"], "objectives": ["assess-perfusion"], "announcement": "You look beyond the blood pressure and check perfusion clues."},
            "prioritize-perfusion": {"group": "escalate", "beats": ["prioritize"], "objectives": ["prioritize-perfusion"], "announcement": "The converging clues make perfusion the priority."},
            "support-circulation": {"group": "support", "beats": ["prioritize", "intervene"], "delta": {"perfusion": 25, "stability": 12}, "objectives": ["prioritize-perfusion", "support-perfusion"], "announcement": "Support is started while the concern is communicated."},
            "dismiss-bp": {"group": "treat", "beats": ["prioritize", "intervene"], "delta": {"perfusion": -18, "stability": -15}, "unsafe": True, "announcement": "The early perfusion signals are missed."},
            "reassess-circulation": {"group": "reassess", "beats": ["reassess"], "objectives": ["reassess-perfusion"], "announcement": "Repeat observations show whether circulation is improving."},
        },
        "initial": {"stability": 60, "oxygenation": 76, "perfusion": 42, "concern": "Possible poor perfusion", "acuity": "high", "hiddenFindings": ["urine-output"], "complications": [], "interventionCount": 0},
        "known": [{"id": "urine-output", "label": "Urine output", "value": "Only 15 mL per hour after blood loss.", "discoveredAt": "reveal"}],
        "objectives": {"assess-perfusion": 25, "prioritize-perfusion": 25, "support-perfusion": 30, "reassess-perfusion": 20},
        "principle": "Read converging cues and trends rather than anchoring on one number.",
    },
    "sim-adaptive-airway": {
        "version": 1, "family": "airway-change", "domain": "judgment", "difficulty": "advanced", "style": "focused", "title": "The Returning Wheeze",
        "actions": {
            "assess-recurrence": {"group": "assess", "beats": ["assess"], "reveal": ["work-of-breathing"], "objectives": ["assess-recurrence"], "announcement": "The interrupted speech confirms increased work of breathing."},
            "support-airway-focused": {"group": "support", "beats": ["prioritize", "intervene"], "delta": {"oxygenation": 25, "stability": 15}, "objectives": ["support-airway"], "announcement": "Focused airway support gives the patient room to recover."},
            "prioritize-airway-response": {"group": "treat", "beats": ["prioritize"], "announcement": "You recognize the recurring respiratory concern needs urgent follow-through."},
            "reassess-airway": {"group": "reassess", "beats": ["reassess"], "objectives": ["reassess-response"], "announcement": "You check whether speech and breathing have improved."},
            "adapt-airway-plan": {"group": "escalate", "beats": ["adaptation"], "delta": {"stability": 10}, "objectives": ["adapt-plan"], "announcement": "The recurrence is communicated and the plan is adapted."},
            "ignore-recurrence": {"group": "treat", "beats": ["reassess", "adaptation"], "delta": {"stability": -25}, "unsafe": True, "announcement": "The recurrence is ignored and the patient worsens."},
        },
        "initial": {"stability": 58, "oxygenation": 44, "perfusion": 70, "concern": "Recurrent airway distress", "acuity": "high", "hiddenFindings": ["work-of-breathing"], "complications": [], "interventionCount": 0},
        "known": [{"id": "work-of-breathing", "label": "Work of breathing", "value": "She cannot finish a sentence without pausing.", "discoveredAt": "reveal"}],
        "objectives": {"assess-recurrence": 25, "support-airway": 45, "reassess-response": 20, "adapt-plan": 10},
        "complication": {"id": "recurrent-wheeze", "trigger": "reassess-airway", "prevent": "support-airway-focused", "resolve": "adapt-airway-plan", "announcement": "The wheeze returns — reassess and adapt."},
        "principle": "Safe care is a loop: assess, support, reassess, and adapt.",
    },
}

# Reviewed catalog expansion. These records intentionally mirror the public
# presentation manifests in frontend/src/game/clinicalSimulation.ts, while
# retaining the official action/effect contract on the server.
CLINICAL_SIMULATION_MANIFESTS.update({
    "sim-airway-breathless-walk": {
        "version": 1, "family": "airway-change", "domain": "airway", "difficulty": "standard", "style": "focused", "title": "The Breathless Walk",
        "actions": {
            "assess-exertional-breathing": {"group": "assess", "beats": ["assess"], "reveal": ["walking-spo2"], "objectives": ["assess-exertion"], "announcement": "Activity exposes a clinically important oxygenation trend."},
            "support-exertional-breathing": {"group": "support", "beats": ["prioritize", "intervene"], "delta": {"stability": 16, "oxygenation": 24}, "objectives": ["support-exertion"], "announcement": "Breathing support and rest improve the exertional response."},
            "continue-walk": {"group": "treat", "beats": ["prioritize", "intervene"], "delta": {"stability": -20, "oxygenation": -18}, "unsafe": True, "announcement": "Continuing activity worsens the breathing change."},
            "reassess-exertional-breathing": {"group": "reassess", "beats": ["reassess"], "objectives": ["reassess-exertion"], "announcement": "A repeat check confirms whether the patient has recovered safely."},
            "escalate-exertional-trend": {"group": "escalate", "beats": ["prioritize"], "objectives": ["support-exertion"], "announcement": "The exertional decline is communicated for further review."},
        },
        "initial": {"stability": 64, "oxygenation": 55, "perfusion": 72, "concern": "Exertional breathing change", "acuity": "high", "hiddenFindings": ["walking-spo2"], "complications": [], "interventionCount": 0},
        "known": [{"id": "walking-spo2", "label": "Exertional oxygen trend", "value": "Her SpO₂ falls to 87% while walking and recovers slowly at rest.", "discoveredAt": "reveal"}],
        "objectives": {"assess-exertion": 25, "support-exertion": 45, "reassess-exertion": 30},
        "principle": "Compare activity tolerance with the resting picture and respond to the trend.",
    },
    "sim-perfusion-cool-hand": {
        "version": 1, "family": "perfusion-hidden", "domain": "assessment", "difficulty": "introductory", "style": "guided", "title": "The Cool Hand",
        "actions": {
            "assess-cool-hand": {"group": "assess", "beats": ["assess"], "reveal": ["capillary-refill"], "objectives": ["assess-cool-hand"], "announcement": "The bedside assessment confirms a meaningful perfusion clue."},
            "support-cool-hand": {"group": "support", "beats": ["prioritize", "intervene"], "delta": {"stability": 14, "perfusion": 26}, "objectives": ["support-cool-hand"], "announcement": "Circulatory support begins while the concern is communicated."},
            "ignore-cool-hand": {"group": "treat", "beats": ["prioritize", "intervene"], "delta": {"stability": -18, "perfusion": -18}, "unsafe": True, "announcement": "The perfusion clue is missed while the patient worsens."},
            "reassess-cool-hand": {"group": "reassess", "beats": ["reassess"], "objectives": ["reassess-cool-hand"], "announcement": "A repeat assessment checks whether circulation is improving."},
            "escalate-cool-hand": {"group": "escalate", "beats": ["prioritize"], "objectives": ["support-cool-hand"], "announcement": "The circulation concern is handed off clearly."},
        },
        "initial": {"stability": 66, "oxygenation": 78, "perfusion": 48, "concern": "Possible reduced perfusion", "acuity": "moderate", "hiddenFindings": ["capillary-refill"], "complications": [], "interventionCount": 0},
        "known": [{"id": "capillary-refill", "label": "Capillary refill", "value": "Capillary refill is delayed and the cool hand remains pale.", "discoveredAt": "reveal"}],
        "objectives": {"assess-cool-hand": 25, "support-cool-hand": 45, "reassess-cool-hand": 30},
        "principle": "Simple bedside findings can reveal a circulation problem before a monitor changes.",
    },
    "sim-perfusion-reassuring-monitor": {
        "version": 1, "family": "perfusion-hidden", "domain": "assessment", "difficulty": "advanced", "style": "focused", "title": "The Reassuring Monitor",
        "actions": {
            "assess-monitor-context": {"group": "assess", "beats": ["assess"], "reveal": ["mental-status-trend"], "objectives": ["assess-monitor-context"], "announcement": "The bedside trend confirms that the monitor is not the whole picture."},
            "support-monitor-context": {"group": "support", "beats": ["prioritize", "intervene"], "delta": {"stability": 24, "perfusion": 28}, "objectives": ["support-monitor-context"], "announcement": "Support begins while the deterioration is escalated."},
            "anchor-on-monitor": {"group": "treat", "beats": ["prioritize", "intervene"], "delta": {"stability": -24, "perfusion": -20}, "unsafe": True, "announcement": "Anchoring on one value delays a response to deterioration."},
            "reassess-monitor-context": {"group": "reassess", "beats": ["reassess"], "objectives": ["reassess-monitor-context"], "announcement": "A repeat check tests whether the patient is responding to support."},
            "adapt-monitor-context": {"group": "escalate", "beats": ["adaptation"], "delta": {"stability": 10}, "objectives": ["adapt-monitor-context"], "announcement": "The changed response is communicated and the plan is adapted."},
        },
        "initial": {"stability": 54, "oxygenation": 74, "perfusion": 44, "concern": "Deterioration despite a reassuring monitor", "acuity": "high", "hiddenFindings": ["mental-status-trend"], "complications": [], "interventionCount": 0},
        "known": [{"id": "mental-status-trend", "label": "Mental status trend", "value": "Her responses have slowed over the last 20 minutes.", "discoveredAt": "reveal"}],
        "objectives": {"assess-monitor-context": 30, "support-monitor-context": 40, "reassess-monitor-context": 20, "adapt-monitor-context": 10},
        "complication": {"id": "slower-responses", "trigger": "reassess-monitor-context", "prevent": "support-monitor-context", "resolve": "adapt-monitor-context", "announcement": "Her responses slow further — reassess and adapt."},
        "principle": "Reassess the whole patient when the bedside picture and a monitor value conflict.",
    },
    "sim-stabilization-first-response": {
        "version": 1, "family": "stabilization-sequence", "domain": "stabilization", "difficulty": "introductory", "style": "guided", "title": "The First Response",
        "actions": {
            "assess-first-response": {"group": "assess", "beats": ["assess"], "reveal": ["orthostatic-symptoms"], "objectives": ["assess-first-response"], "announcement": "The position change helps explain the immediate instability."},
            "stabilize-first-response": {"group": "support", "beats": ["prioritize", "intervene"], "delta": {"stability": 26, "perfusion": 18}, "objectives": ["stabilize-first-response"], "announcement": "Safety measures and support help the patient recover."},
            "rush-first-response": {"group": "treat", "beats": ["prioritize", "intervene"], "delta": {"stability": -24, "perfusion": -14}, "unsafe": True, "announcement": "The unsafe activity worsens his instability."},
            "reassess-first-response": {"group": "reassess", "beats": ["reassess"], "objectives": ["reassess-first-response"], "announcement": "A repeat check confirms whether it is safe to continue care."},
        },
        "initial": {"stability": 62, "oxygenation": 80, "perfusion": 54, "concern": "Acute faintness and instability", "acuity": "moderate", "hiddenFindings": ["orthostatic-symptoms"], "complications": [], "interventionCount": 0},
        "known": [{"id": "orthostatic-symptoms", "label": "Position change", "value": "Symptoms began immediately after standing and improve when he lies back.", "discoveredAt": "reveal"}],
        "objectives": {"assess-first-response": 25, "stabilize-first-response": 45, "reassess-first-response": 30},
        "principle": "Start with safety, support the immediate concern, then verify the response.",
    },
    "sim-stabilization-repeat-check": {
        "version": 1, "family": "stabilization-sequence", "domain": "stabilization", "difficulty": "standard", "style": "focused", "title": "The Repeat Check",
        "actions": {
            "assess-repeat-check": {"group": "assess", "beats": ["assess"], "reveal": ["persistent-dizziness"], "objectives": ["assess-repeat-check"], "announcement": "The symptom returns with position change, showing the response is incomplete."},
            "stabilize-repeat-check": {"group": "support", "beats": ["prioritize", "intervene"], "delta": {"stability": 24, "perfusion": 18}, "objectives": ["stabilize-repeat-check"], "announcement": "Continued support reduces the immediate safety risk."},
            "skip-repeat-check": {"group": "treat", "beats": ["prioritize", "intervene"], "delta": {"stability": -18, "perfusion": -14}, "unsafe": True, "announcement": "Moving on without reassessment misses the ongoing safety risk."},
            "reassess-repeat-check": {"group": "reassess", "beats": ["reassess"], "objectives": ["reassess-repeat-check"], "announcement": "A repeat check confirms whether the support plan is working."},
        },
        "initial": {"stability": 60, "oxygenation": 79, "perfusion": 56, "concern": "Incomplete response after support", "acuity": "moderate", "hiddenFindings": ["persistent-dizziness"], "complications": [], "interventionCount": 0},
        "known": [{"id": "persistent-dizziness", "label": "Ongoing symptom", "value": "Her dizziness returns as soon as she changes position.", "discoveredAt": "reveal"}],
        "objectives": {"assess-repeat-check": 25, "stabilize-repeat-check": 45, "reassess-repeat-check": 30},
        "principle": "Stabilization includes reassessment; a partial response is still information.",
    },
    "sim-stabilization-plan-slips": {
        "version": 1, "family": "stabilization-sequence", "domain": "stabilization", "difficulty": "advanced", "style": "transfer", "title": "When the Plan Slips",
        "actions": {
            "assess-plan-slips": {"group": "assess", "beats": ["assess"], "reveal": ["recurrent-unsteadiness"], "objectives": ["assess-plan-slips"], "announcement": "The recurrence shows the first improvement was not a complete resolution."},
            "stabilize-plan-slips": {"group": "support", "beats": ["prioritize", "intervene"], "delta": {"stability": 25, "perfusion": 22}, "objectives": ["stabilize-plan-slips"], "announcement": "Focused support addresses the immediate safety concern."},
            "minimize-plan-slips": {"group": "treat", "beats": ["prioritize", "intervene"], "delta": {"stability": -26, "perfusion": -16}, "unsafe": True, "announcement": "The recurring instability creates an avoidable safety event."},
            "reassess-plan-slips": {"group": "reassess", "beats": ["reassess"], "objectives": ["reassess-plan-slips"], "announcement": "The reassessment identifies whether the patient is truly ready to progress."},
            "adapt-plan-slips": {"group": "escalate", "beats": ["adaptation"], "delta": {"stability": 12}, "objectives": ["adapt-plan-slips"], "announcement": "The changing pattern is communicated and the support plan is adapted."},
        },
        "initial": {"stability": 56, "oxygenation": 77, "perfusion": 50, "concern": "Recurring instability", "acuity": "high", "hiddenFindings": ["recurrent-unsteadiness"], "complications": [], "interventionCount": 0},
        "known": [{"id": "recurrent-unsteadiness", "label": "Repeat change", "value": "The unsteadiness returns after the first apparent improvement.", "discoveredAt": "reveal"}],
        "objectives": {"assess-plan-slips": 30, "stabilize-plan-slips": 40, "reassess-plan-slips": 20, "adapt-plan-slips": 10},
        "complication": {"id": "repeat-instability", "trigger": "reassess-plan-slips", "prevent": "stabilize-plan-slips", "resolve": "adapt-plan-slips", "announcement": "The unsteadiness returns — adapt the safety plan."},
        "principle": "A recurring problem is a cue to reassess and adapt, not simply repeat the first plan.",
    },
    "sim-systems-handoff-detail": {
        "version": 1, "family": "systems-handoff", "domain": "systems", "difficulty": "introductory", "style": "guided", "title": "The Handoff Detail",
        "actions": {
            "assess-handoff-detail": {"group": "assess", "beats": ["assess"], "reveal": ["medication-timing"], "objectives": ["assess-handoff-detail"], "announcement": "The timing links the new symptom to information the next team needs."},
            "support-handoff-detail": {"group": "support", "beats": ["prioritize", "intervene"], "delta": {"stability": 18, "perfusion": 10}, "objectives": ["support-handoff-detail"], "announcement": "A clear handoff keeps the current concern visible during transfer."},
            "omit-handoff-detail": {"group": "treat", "beats": ["prioritize", "intervene"], "delta": {"stability": -18}, "unsafe": True, "announcement": "The missing detail leaves the receiving team without a relevant warning."},
            "reassess-handoff-detail": {"group": "reassess", "beats": ["reassess"], "objectives": ["reassess-handoff-detail"], "announcement": "A closed-loop check confirms the concern was understood."},
        },
        "initial": {"stability": 68, "oxygenation": 82, "perfusion": 62, "concern": "Transfer with a recent clinical change", "acuity": "moderate", "hiddenFindings": ["medication-timing"], "complications": [], "interventionCount": 0},
        "known": [{"id": "medication-timing", "label": "Medication timing", "value": "Symptoms began shortly after the new medication was given.", "discoveredAt": "reveal"}],
        "objectives": {"assess-handoff-detail": 25, "support-handoff-detail": 45, "reassess-handoff-detail": 30},
        "principle": "A safe handoff carries forward the change, current concern, and next check.",
    },
    "sim-systems-delayed-escalation": {
        "version": 1, "family": "systems-handoff", "domain": "systems", "difficulty": "standard", "style": "focused", "title": "The Delayed Escalation",
        "actions": {
            "assess-delayed-escalation": {"group": "assess", "beats": ["assess"], "reveal": ["baseline-comparison"], "objectives": ["assess-delayed-escalation"], "announcement": "The baseline comparison confirms a significant change in status."},
            "support-delayed-escalation": {"group": "support", "beats": ["prioritize", "intervene"], "delta": {"stability": 20, "perfusion": 12}, "objectives": ["support-delayed-escalation"], "announcement": "The change is documented and shared so the response can begin."},
            "delay-delayed-escalation": {"group": "treat", "beats": ["prioritize", "intervene"], "delta": {"stability": -22, "perfusion": -12}, "unsafe": True, "announcement": "Waiting delays attention to a significant change in status."},
            "reassess-delayed-escalation": {"group": "reassess", "beats": ["reassess"], "objectives": ["reassess-delayed-escalation"], "announcement": "A follow-up check confirms whether the coordinated response is helping."},
        },
        "initial": {"stability": 58, "oxygenation": 76, "perfusion": 57, "concern": "Uncommunicated change in mental status", "acuity": "high", "hiddenFindings": ["baseline-comparison"], "complications": [], "interventionCount": 0},
        "known": [{"id": "baseline-comparison", "label": "Baseline comparison", "value": "He was oriented at shift start and is now unsure where he is.", "discoveredAt": "reveal"}],
        "objectives": {"assess-delayed-escalation": 25, "support-delayed-escalation": 45, "reassess-delayed-escalation": 30},
        "principle": "Shared observations become safe care only when they are documented, escalated, and followed through.",
    },
    "sim-systems-across-teams": {
        "version": 1, "family": "systems-handoff", "domain": "systems", "difficulty": "advanced", "style": "transfer", "title": "Across the Teams",
        "actions": {
            "assess-across-teams": {"group": "assess", "beats": ["assess"], "reveal": ["unresolved-order"], "objectives": ["assess-across-teams"], "announcement": "The assessment identifies a time-sensitive task without a clear owner."},
            "support-across-teams": {"group": "support", "beats": ["prioritize", "intervene"], "delta": {"stability": 26, "perfusion": 20}, "objectives": ["support-across-teams"], "announcement": "The immediate plan is coordinated with a named next action."},
            "assume-across-teams": {"group": "treat", "beats": ["prioritize", "intervene"], "delta": {"stability": -25, "perfusion": -18}, "unsafe": True, "announcement": "The unowned task delays a response to deterioration."},
            "reassess-across-teams": {"group": "reassess", "beats": ["reassess"], "objectives": ["reassess-across-teams"], "announcement": "The follow-up confirms whether the time-sensitive plan is being carried forward."},
            "adapt-across-teams": {"group": "escalate", "beats": ["adaptation"], "delta": {"stability": 12}, "objectives": ["adapt-across-teams"], "announcement": "The changing situation is escalated through one coordinated pathway."},
        },
        "initial": {"stability": 52, "oxygenation": 75, "perfusion": 49, "concern": "Deterioration across a care transition", "acuity": "high", "hiddenFindings": ["unresolved-order"], "complications": [], "interventionCount": 0},
        "known": [{"id": "unresolved-order", "label": "Unresolved order", "value": "A time-sensitive reassessment order has not yet been acknowledged by the receiving team.", "discoveredAt": "reveal"}],
        "objectives": {"assess-across-teams": 30, "support-across-teams": 40, "reassess-across-teams": 20, "adapt-across-teams": 10},
        "complication": {"id": "handoff-gap", "trigger": "reassess-across-teams", "prevent": "support-across-teams", "resolve": "adapt-across-teams", "announcement": "The reassessment order was missed — unify the response."},
        "principle": "Across team boundaries, safe care requires a named owner, a shared next action, and a closed-loop check.",
    },
})


def reviewed_core_simulation(
    simulation_id: str, family: str, title: str, domain: str, difficulty: str, style: str,
    initial: Dict[str, Any], finding_label: str, finding_value: str, focus: str,
    support_label: str, safe_delta: Dict[str, int], principle: str,
) -> Dict[str, Any]:
    """Build the fixed reviewed assess → support → reassess variation contract."""
    finding_id = f"{simulation_id}-finding"
    return {
        "version": 1, "family": family, "domain": domain, "difficulty": difficulty, "style": style, "title": title,
        "actions": {
            f"{simulation_id}-assess": {"group": "assess", "beats": ["assess"], "reveal": [finding_id], "objectives": [f"{simulation_id}-assessed"], "announcement": f"Assessment reveals the key {focus} change."},
            f"{simulation_id}-support": {"group": "support", "beats": ["prioritize", "intervene"], "delta": safe_delta, "objectives": [f"{simulation_id}-supported"], "announcement": f"{support_label} improves the immediate concern."},
            f"{simulation_id}-unsafe": {"group": "treat", "beats": ["prioritize", "intervene"], "delta": {"stability": -20}, "unsafe": True, "announcement": "The concern is deferred and the patient deteriorates."},
            f"{simulation_id}-reassess": {"group": "reassess", "beats": ["reassess"], "objectives": [f"{simulation_id}-reassessed"], "announcement": "A repeat assessment confirms whether the response is working."},
        },
        "initial": {**initial, "hiddenFindings": [finding_id], "complications": [], "interventionCount": 0},
        "known": [{"id": finding_id, "label": finding_label, "value": finding_value, "discoveredAt": "reveal"}],
        "objectives": {f"{simulation_id}-assessed": 25, f"{simulation_id}-supported": 35, f"{simulation_id}-reassessed": 40},
        "principle": principle,
    }


# Completes the reviewed 24-case catalog without duplicating the incoming
# bespoke airway, perfusion, stabilization, and systems families above.
CORE_SIMULATION_VARIATIONS = (
    ("sim-assessment-new-confusion", "deterioration-recognition", "The Different Answer", "assessment", "introductory", "guided", {"stability": 63, "oxygenation": 70, "perfusion": 66, "concern": "New confusion", "acuity": "moderate"}, "Baseline comparison", "Family confirms this level of confusion is new today.", "mental-status change", "Protect safety and escalate the new change", {"stability": 18, "perfusion": 12}, "Compare behavior to baseline; a new mental-status change requires attention."),
    ("sim-assessment-fever-trend", "deterioration-recognition", "The Rising Line", "assessment", "standard", "transfer", {"stability": 61, "oxygenation": 74, "perfusion": 58, "concern": "Rising temperature trend", "acuity": "moderate"}, "Temperature trend", "Temperature has risen at three consecutive observations.", "temperature trend", "Support comfort and escalate the trend", {"stability": 19, "perfusion": 14}, "Trend recognition prevents a changing condition from being hidden by one familiar number."),
    ("sim-assessment-post-op-pain", "deterioration-recognition", "Pain That Changed", "judgment", "advanced", "focused", {"stability": 58, "oxygenation": 76, "perfusion": 57, "concern": "Changing postoperative pain", "acuity": "high"}, "Pain pattern", "The pain is new in location and does not match the earlier pattern.", "new pain pattern", "Support comfort and urgently communicate the change", {"stability": 20, "perfusion": 16}, "A changing symptom pattern calls for reassessment and escalation, not autopilot."),
    ("sim-medication-identity", "medication-safety", "The Name Mismatch", "pharmacology", "introductory", "guided", {"stability": 72, "oxygenation": 82, "perfusion": 76, "concern": "Medication identity mismatch", "acuity": "low"}, "Identity check", "The second identifier does not match the prepared record.", "medication identity", "Pause the medication and verify identity", {"stability": 12, "perfusion": 10}, "A mismatch is a stop signal: verify before proceeding."),
    ("sim-medication-renal-dose", "medication-safety", "The Changed Clearance", "pharmacology", "standard", "focused", {"stability": 66, "oxygenation": 80, "perfusion": 62, "concern": "Medication context changed", "acuity": "moderate"}, "New context", "A new result changes the safety context for the scheduled medication.", "medication safety context", "Hold and clarify the changed medication plan", {"stability": 16, "perfusion": 18}, "Medication safety depends on the current patient context, not only the routine schedule."),
    ("sim-medication-sedation-check", "medication-safety", "Before the Next Dose", "pharmacology", "advanced", "transfer", {"stability": 57, "oxygenation": 58, "perfusion": 68, "concern": "Increasing drowsiness", "acuity": "high"}, "Sedation trend", "He needs repeated prompting to stay awake during conversation.", "sedation change", "Pause, support breathing, and escalate review", {"stability": 22, "oxygenation": 25}, "A new sedation change is a reason to pause, assess, and communicate before another dose."),
    ("sim-judgment-prioritize-fall", "escalation-handoff", "The Unsteady Call", "judgment", "introductory", "guided", {"stability": 65, "oxygenation": 80, "perfusion": 57, "concern": "Immediate fall risk", "acuity": "moderate"}, "Mobility change", "He is more unsteady than during the earlier assisted walk.", "fall-risk change", "Protect safety and communicate the mobility change", {"stability": 18, "perfusion": 20}, "A changing mobility risk requires immediate protection and a shared plan."),
    ("sim-judgment-call-rapid-response", "escalation-handoff", "The Whole Picture", "judgment", "standard", "focused", {"stability": 50, "oxygenation": 51, "perfusion": 55, "concern": "Multiple worsening cues", "acuity": "critical"}, "Combined trend", "Breathing, responsiveness, and circulation cues are worsening together.", "combined deterioration", "Start support and call for urgent review", {"stability": 30, "oxygenation": 29, "perfusion": 17}, "Escalate when the whole pattern signals deterioration, even if each cue alone seems modest."),
    ("sim-judgment-change-plan", "escalation-handoff", "When the Plan Stops Working", "judgment", "advanced", "transfer", {"stability": 55, "oxygenation": 59, "perfusion": 60, "concern": "Incomplete response", "acuity": "high"}, "Response check", "The expected improvement has not appeared at reassessment.", "incomplete response", "Adapt support and communicate the failed response", {"stability": 27, "oxygenation": 25, "perfusion": 17}, "Reassessment changes the plan when the first response is incomplete."),
    ("sim-sepsis-subtle-trend", "sepsis-pattern", "The Subtle Shift", "assessment", "introductory", "guided", {"stability": 60, "oxygenation": 72, "perfusion": 56, "concern": "Possible infection trend", "acuity": "moderate"}, "Clustered changes", "Several small changes have appeared together since the earlier assessment.", "clustered infection cues", "Support the patient and communicate the trend", {"stability": 20, "perfusion": 25}, "Clustered changes deserve assessment and escalation before they become a crisis."),
    ("sim-sepsis-source-control", "sepsis-pattern", "The New Drainage", "assessment", "standard", "transfer", {"stability": 57, "oxygenation": 74, "perfusion": 53, "concern": "New local and systemic cues", "acuity": "high"}, "New local finding", "The drainage is new and accompanies a broader change in how she feels.", "new drainage finding", "Support the patient and escalate the new finding", {"stability": 24, "perfusion": 29}, "Link local changes with the patient’s overall trend instead of treating them in isolation."),
    ("sim-sepsis-escalation", "sepsis-pattern", "The Escalation Window", "judgment", "advanced", "focused", {"stability": 49, "oxygenation": 66, "perfusion": 42, "concern": "Escalating systemic concern", "acuity": "critical"}, "Escalation pattern", "Output, responsiveness, and overall appearance have worsened together.", "escalation pattern", "Begin support and escalate urgent review", {"stability": 32, "oxygenation": 20, "perfusion": 34}, "Escalate early when multiple worsening cues point to a changing systemic condition."),
)
for _core_variation in CORE_SIMULATION_VARIATIONS:
    CLINICAL_SIMULATION_MANIFESTS[_core_variation[0]] = reviewed_core_simulation(*_core_variation)

CLINICAL_SIMULATION_ADVANCED_LEVEL_GATE = 25


def simulation_eligible(player: Dict[str, Any]) -> bool:
    return bool(player.get("lessons_completed")) and all(
        int(player.get(key, 0)) >= 1 for key in ("uni_cue_lab_count", "uni_triage_count", "uni_stack_count")
    )


def simulation_branch(seed: int, family: str) -> str:
    value = int(seed) & 0xffffffff
    for char in family:
        value = ((value ^ ord(char)) * 16777619) & 0xffffffff
    return f"branch-{value:08x}"


def simulation_is_unlocked(manifest: Dict[str, Any], player_level: int) -> bool:
    """Keep reviewed-case rotation inside the same difficulty gate as start."""
    return manifest["difficulty"] not in {"advanced", "expert"} or player_level >= CLINICAL_SIMULATION_ADVANCED_LEVEL_GATE


def select_new_simulation_variation(
    requested_simulation_id: str,
    history: List[Dict[str, Any]],
    player_level: int,
) -> str:
    """Choose a deterministic eligible sibling without trusting a client case ID.

    The completed-history receipt is the source of truth for an uncompleted
    sibling. Once the whole family is complete, move forward from the just
    completed case in a stable ID ordering so a variation never immediately
    repeats.
    """
    requested = CLINICAL_SIMULATION_MANIFESTS[requested_simulation_id]
    siblings = sorted(
        simulation_id
        for simulation_id, manifest in CLINICAL_SIMULATION_MANIFESTS.items()
        if manifest["family"] == requested["family"] and simulation_is_unlocked(manifest, player_level)
    )
    if len(siblings) < 2:
        return requested_simulation_id

    completed_ids = {
        str(row.get("simulationId"))
        for row in history
        if row.get("variantFamilyId") == requested["family"]
    }
    uncompleted_siblings = [
        simulation_id
        for simulation_id in siblings
        if simulation_id != requested_simulation_id and simulation_id not in completed_ids
    ]
    if uncompleted_siblings:
        return uncompleted_siblings[0]

    current_index = siblings.index(requested_simulation_id)
    return siblings[(current_index + 1) % len(siblings)]


def simulation_next_beat(attempt: Dict[str, Any], manifest: Dict[str, Any]) -> str:
    ids = attempt.get("actionIds", [])
    groups = [manifest["actions"][action_id]["group"] for action_id in ids if action_id in manifest["actions"]]
    if "assess" not in groups:
        return "assess"
    if not any(group in {"support", "treat", "escalate"} for group in groups):
        return "prioritize"
    if "reassess" not in groups:
        return "reassess"
    complication = manifest.get("complication")
    if complication and attempt.get("complicationTriggered") and complication["resolve"] not in ids:
        return "adaptation"
    return "outcome"


def simulation_public_attempt(attempt: Dict[str, Any]) -> Dict[str, Any]:
    return {key: attempt[key] for key in (
        "attemptId", "simulationId", "version", "seed", "branchId", "config", "beat",
        "patient", "known", "completedObjectiveIds", "actionIds", "timeline", "safety",
        "status", "complicationTriggered",
    )}

UNIVERSITY_PRACTICE_MILESTONES = (
    ("cue_lab", 3, "cue_3", {"university_credits": 50, "inventory.cue_scroll": 1}),
    ("cue_lab", 5, "cue_5", {"xp": 25, "university_credits": 75, "inventory.cue_scroll": 2, "inventory.hero_training_page": 1}),
    ("cue_lab", 10, "cue_10", {"xp": 50, "university_credits": 125, "inventory.care_chain_manual": 1}),
    ("triage", 3, "triage_3", {"university_credits": 50, "inventory.triage_scroll": 1}),
    ("triage", 5, "triage_5", {"xp": 25, "university_credits": 75, "inventory.triage_scroll": 2, "inventory.hero_training_page": 1}),
    ("triage", 10, "triage_10", {"xp": 50, "university_credits": 125, "inventory.care_chain_manual": 1}),
    ("stack", 3, "stack_3", {"university_credits": 50, "inventory.stab_scroll": 1}),
    ("stack", 5, "stack_5", {"xp": 25, "university_credits": 75, "inventory.stab_scroll": 2, "inventory.hero_training_page": 1}),
    ("stack", 10, "stack_10", {"xp": 50, "university_credits": 125, "inventory.care_chain_manual": 1}),
)


WARD_SCENARIO_IDS = {
    "triage_corridor", "central_cross", "sanctuary_courtyard", "supply_hall",
    "isolation_wing", "critical_care_hub", "dual_ward", "grand_convergence",
}
WARD_SCENARIO_LEVELS = {
    "triage_corridor": 1, "central_cross": 2, "sanctuary_courtyard": 3,
    "supply_hall": 4, "isolation_wing": 5, "critical_care_hub": 6,
    "dual_ward": 8, "grand_convergence": 10,
}
WARD_AEGIS_FRAGMENT = "ward_defense_aegis_fragment"
WARD_AEGIS_IMPRINT = "ward_defense_aegis_imprint"
WARD_AEGIS_WEEKLY_RANDOM_CAP = 2
WARD_AEGIS_PITY_CLEAR_COUNT = 12
WARD_AEGIS_LIFETIME_GUARANTEE = 25


class WardDefenseCompleteRequest(BaseModel):
    run_id: str
    cleared: bool
    stability: float = 0
    score: int = 0
    clinical_correct: int = 0
    clinical_total: int = 3
    overtime_wave: int = 0
    question_family_ids: List[str] = Field(default_factory=list)
    missed_family_ids: List[str] = Field(default_factory=list)


class WardDefenseStartRequest(BaseModel):
    requested_scenario_id: Optional[str] = None


class WardAegisSidegradeRequest(BaseModel):
    upgrade_id: Literal["aegis_clinical_resonance"]


class WardExchangeRequest(BaseModel):
    item_id: str


WARD_EXCHANGE = {
    "ward_blueprint": {"cost": 18, "limit": 2, "period": "week", "inventory": {"Defense Blueprint": 1}},
    "ward_lantern_core": {"cost": 12, "limit": 3, "period": "week", "inventory": {"Vital Lantern Core": 1}},
    "ward_deployment_fx": {"cost": 42, "limit": 1, "period": "lifetime", "inventory": {"Lotus Deployment Effect": 1}},
    "ward_title": {"cost": 60, "limit": 1, "period": "lifetime", "title": "warden_of_the_lantern"},
}


def ward_stars(stability: float, clinical_correct: int, clinical_total: int, cleared: bool) -> int:
    if not cleared:
        return 0
    accuracy = clinical_correct / max(1, clinical_total)
    if stability >= 75 and accuracy >= 0.8:
        return 3
    if stability >= 45 and accuracy >= 0.5:
        return 2
    return 1


@api_router.post("/player/{player_id}/ward-defense/start", response_model=Dict[str, Any])
async def start_ward_defense(
    player_id: str,
    payload: WardDefenseStartRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Issue one opaque, server-owned Ward Defense run.

    A player may only have one active run. The run's scenario and identity are
    stored server-side; completion never accepts either from the client.
    """
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    level = int(player.get("player_level", 1))
    unlocked = [scenario for scenario, needed in WARD_SCENARIO_LEVELS.items() if level >= needed]
    if not unlocked:
        raise HTTPException(status_code=409, detail="no Ward Defense scenario is unlocked")
    requested = payload.requested_scenario_id
    if requested and requested not in unlocked:
        raise HTTPException(status_code=409, detail="scenario is not unlocked")
    active = await db.ward_defense_runs.find_one({"player_id": player_id, "status": "active"}, {"_id": 0})
    if active:
        return {"run_id": active["id"], "scenario_id": active["scenario_id"], "reused": True}
    # The real rotation bag is server-owned. Rebuild only after every currently
    # unlocked map was offered; the first map of a new bag cannot repeat the
    # most recently offered map, and cycle records reset together.
    rotation = dict(player.get("ward_defense_rotation") or {})
    bag = [item for item in rotation.get("bag") or [] if item in unlocked]
    recent = list(rotation.get("recentScenarioIds") or [])[-1:]
    if not bag:
        bag = list(unlocked)
        secrets.SystemRandom().shuffle(bag)
        if len(bag) > 1 and recent and bag[0] == recent[0]:
            bag[0], bag[1] = bag[1], bag[0]
        rotation["rotationCompletedIds"] = []
        rotation["cycle"] = int(rotation.get("cycle", 0)) + 1
    scenario_id = requested or bag[0]
    if requested:
        bag.remove(requested)
    else:
        bag = bag[1:]
    rotation["bag"] = bag
    rotation["recentScenarioIds"] = (recent + [scenario_id])[-1:]
    rotation["lastScenarioId"] = scenario_id
    rotation["updatedAt"] = now_iso()
    rotation_write = await db.players.update_one(
        {"id": player_id, "updated_at": player.get("updated_at")},
        {"$set": {"ward_defense_rotation": rotation, "updated_at": now_iso()}},
    )
    if rotation_write.modified_count != 1:
        raise HTTPException(status_code=409, detail="Ward Defense rotation changed; retry")
    run = {
        "id": f"wd_{secrets.token_urlsafe(24)}",
        "player_id": player_id,
        "scenario_id": scenario_id,
        "status": "active",
        "started_at": now_iso(),
        # A one-minute floor makes a direct start→claim call invalid. The client
        # still owns animation; server owns eligibility and one-time settlement.
        "not_before": (datetime.now(timezone.utc) + timedelta(seconds=60)).isoformat(),
    }
    await db.ward_defense_runs.insert_one(run)
    return {"run_id": run["id"], "scenario_id": scenario_id, "reused": False}


@api_router.post("/player/{player_id}/ward-defense/complete", response_model=Dict[str, Any])
async def complete_ward_defense(
    player_id: str,
    payload: WardDefenseCompleteRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Commit one Ward Defense run exactly once and derive grants server-side.

    The client may report run performance for records, but never currency amounts
    or Aegis outcomes. Overtime only improves records/score; it cannot add XP,
    materials, or additional Aegis rolls.
    """
    if not payload.run_id or len(payload.run_id) > 120:
        raise HTTPException(status_code=422, detail="invalid Ward Defense run id")
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    run = await db.ward_defense_runs.find_one({"id": payload.run_id, "player_id": player_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="unknown Ward Defense run")
    if run.get("status") == "claimed":
        return {"player": Player(**player).model_dump(), "already_claimed": True, "granted": {}}
    if run.get("status") != "active":
        raise HTTPException(status_code=409, detail="Ward Defense run is not active")
    if datetime.fromisoformat(str(run["not_before"]).replace("Z", "+00:00")) > datetime.now(timezone.utc):
        raise HTTPException(status_code=409, detail="Ward Defense run has not reached its minimum duration")
    scenario_id = run["scenario_id"]

    # Board simulation is client-authoritative, but grants are bounded by the
    # server-owned run, daily claim ceiling, and weekly Aegis protections.
    # Use one clear value consistently for every record and reward decision.
    cleared = bool(payload.cleared)
    stability = max(0, min(100, float(payload.stability)))
    total = max(1, min(3, int(payload.clinical_total)))
    correct = max(0, min(total, int(payload.clinical_correct)))
    accuracy = correct / total
    overtime_wave = max(0, min(20, int(payload.overtime_wave)))
    stars = ward_stars(stability, correct, total, cleared)
    records = dict(player.get("ward_defense_records") or {})
    previous = records.get(scenario_id) or {}
    first_clear = cleared and int(previous.get("clears", 0)) == 0
    record = {
        "bestStars": max(int(previous.get("bestStars", 0)), stars),
        "bestScore": max(int(previous.get("bestScore", 0)), max(0, min(1_000_000, int(payload.score)))),
        "bestStability": max(int(previous.get("bestStability", 0)), int(round(stability))),
        "highestOvertimeWave": max(int(previous.get("highestOvertimeWave", 0)), overtime_wave),
        "bestClinicalAccuracy": max(float(previous.get("bestClinicalAccuracy", 0)), accuracy),
        "clears": int(previous.get("clears", 0)) + (1 if cleared else 0),
    }
    records[scenario_id] = record

    granted: Dict[str, int] = {}
    sigils = 0
    xp = 0
    shards = 0
    reward_day = age1_day_key()
    reward_claims = int(player.get("ward_defense_reward_claims", 0)) if player.get("ward_defense_reward_day") == reward_day else 0
    # A Ward run remains replayable for score, records, learning and cosmetics,
    # but only a small server-counted set can grant standard resources each day.
    # This closes unique-run-id farming even if a browser is automated.
    reward_eligible = cleared and reward_claims < 1
    if reward_eligible:
        # Uses the existing Age 1 repeat taper. Sigils stay a Ward-only currency.
        day = age1_day_key()
        used = int(player.get("age1_reward_units", 0)) if player.get("age1_reward_day") == day else 0
        multiplier = age1_reward_multiplier(used, 1)
        xp = int(round((48 + stars * 12) * multiplier))
        shards = int(round((8 + round(accuracy * 6)) * multiplier))
        # Daily and rotation bonuses are server-derived. Completion cannot
        # fabricate either flag. Rotation is one bonus per map per cycle.
        rotation = dict(player.get("ward_defense_rotation") or {})
        completed = set(rotation.get("rotationCompletedIds") or [])
        rotation_bonus = scenario_id not in completed
        daily_key = age1_day_key()
        daily_bonus = rotation.get("dailyClaimed") is not True or rotation.get("dailyKey") != daily_key
        sigils = 6 + stars * 2 + (4 if first_clear else 0) + (2 if daily_bonus else 0) + (3 if rotation_bonus else 0)
        if overtime_wave > 0 and overtime_wave % 5 == 0:
            sigils += 1
        if xp: granted["xp"] = xp
        if shards: granted["codex_shards"] = shards
        granted["ward_sigils"] = sigils

    # Aegis has one protected roll per qualifying clear only. It is independent
    # of score/Overtime and a loss/practice run never advances pity.
    inventory = dict(player.get("inventory") or {})
    week = age1_week_key()
    weekly_drops = int(player.get("ward_aegis_weekly_random_drops", 0)) if player.get("ward_aegis_week_key") == week else 0
    pity = int(player.get("ward_aegis_pity", 0))
    lifetime = int(player.get("ward_aegis_lifetime_fragments", 0))
    milestone_granted = bool(player.get("ward_aegis_milestone_granted", False))
    aegis_fragment = False
    # One qualifying Aegis opportunity per server day. This prevents quick
    # replay attempts from advancing pity independently of normal Ward rewards.
    aegis_day = str(player.get("ward_aegis_qualifying_day") or "")
    qualifies = reward_eligible and stars >= 2 and aegis_day != age1_day_key()
    if qualifies:
        guaranteed = (not milestone_granted and lifetime >= WARD_AEGIS_LIFETIME_GUARANTEE - 1)
        random_allowed = weekly_drops < WARD_AEGIS_WEEKLY_RANDOM_CAP
        random_hit = random_allowed and (pity + 1 >= WARD_AEGIS_PITY_CLEAR_COUNT or random.random() < 0.08)
        if guaranteed or random_hit:
            aegis_fragment = True
            inventory[WARD_AEGIS_FRAGMENT] = int(inventory.get(WARD_AEGIS_FRAGMENT, 0)) + 1
            lifetime += 1
            pity = 0
            if guaranteed:
                milestone_granted = True
            elif random_allowed:
                weekly_drops += 1
        else:
            pity += 1

    recent_families = list(dict.fromkeys((player.get("ward_defense_recent_families") or []) + payload.question_family_ids))[-18:]
    missed_families = list(dict.fromkeys((player.get("ward_defense_missed_families") or []) + payload.missed_family_ids))[-36:]
    increments = dict(granted)
    update: Dict[str, Any] = {
        "$set": {
            "ward_defense_records": records,
            "ward_defense_claimed_run_ids": ((player.get("ward_defense_claimed_run_ids") or []) + [payload.run_id])[-500:],
            "ward_defense_recent_families": recent_families,
            "ward_defense_missed_families": missed_families,
            "inventory": inventory,
            "ward_aegis_pity": pity,
            "ward_aegis_lifetime_fragments": lifetime,
            "ward_aegis_week_key": week,
            "ward_aegis_weekly_random_drops": weekly_drops,
            "ward_aegis_milestone_granted": milestone_granted,
            "ward_aegis_qualifying_day": age1_day_key() if qualifies else aegis_day,
            "updated_at": now_iso(),
            "age1_reward_day": age1_day_key(),
            "age1_reward_units": (int(player.get("age1_reward_units", 0)) if player.get("age1_reward_day") == age1_day_key() else 0) + (1 if reward_eligible else 0),
            "ward_defense_reward_day": reward_day,
            "ward_defense_reward_claims": reward_claims + (1 if reward_eligible else 0),
            "player_level": player_level_from_xp(int(player.get("xp", 0)) + xp),
            "ward_defense_rotation": {
                **(player.get("ward_defense_rotation") or {}),
                "rotationCompletedIds": list(dict.fromkeys(((player.get("ward_defense_rotation") or {}).get("rotationCompletedIds") or []) + ([scenario_id] if cleared else []))),
                "dailyKey": age1_day_key(),
                "dailyClaimed": True,
            },
        },
    }
    if increments:
        update["$inc"] = increments
    write = await db.players.update_one(
        {"id": player_id, "updated_at": player.get("updated_at")},
        update,
    )
    if write.modified_count != 1:
        raise HTTPException(status_code=409, detail="Ward Defense completion changed; retry")
    consumed = await db.ward_defense_runs.update_one(
        {"id": payload.run_id, "player_id": player_id, "status": "active"},
        {"$set": {"status": "claimed", "completed_at": now_iso()}},
    )
    if consumed.modified_count != 1:
        raise HTTPException(status_code=409, detail="Ward Defense run was already settled")
    refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
    return {
        "player": Player(**refreshed).model_dump(), "already_claimed": False,
        "granted": granted, "stars": stars, "aegis_fragment": aegis_fragment, "reward_eligible": reward_eligible,
    }


@api_router.post("/player/{player_id}/ward-defense/exchange", response_model=Dict[str, Any])
async def purchase_ward_exchange(
    player_id: str,
    payload: WardExchangeRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    row = WARD_EXCHANGE.get(payload.item_id)
    if not row:
        raise HTTPException(status_code=422, detail="unknown Ward Supply Exchange item")
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    period = age1_week_key() if row["period"] == "week" else "lifetime"
    purchases = dict(player.get("ward_exchange_purchases") or {})
    purchase = purchases.get(payload.item_id) or {"count": 0, "period": period}
    count = int(purchase.get("count", 0)) if purchase.get("period") == period else 0
    if count >= row["limit"]:
        raise HTTPException(status_code=409, detail="purchase limit reached")
    if int(player.get("ward_sigils", 0)) < row["cost"]:
        raise HTTPException(status_code=409, detail="not enough Ward Sigils")
    inventory = dict(player.get("inventory") or {})
    for item, quantity in row.get("inventory", {}).items():
        inventory[item] = int(inventory.get(item, 0)) + quantity
    update_set: Dict[str, Any] = {
        "inventory": inventory, "ward_exchange_purchases": {**purchases, payload.item_id: {"count": count + 1, "period": period}},
        "updated_at": now_iso(),
    }
    if row.get("title"):
        update_set["owned_titles"] = list(dict.fromkeys((player.get("owned_titles") or []) + [row["title"]]))
    write = await db.players.update_one({"id": player_id, "updated_at": player.get("updated_at")}, {"$inc": {"ward_sigils": -row["cost"]}, "$set": update_set})
    if write.modified_count != 1:
        raise HTTPException(status_code=409, detail="Ward Supply Exchange changed; retry")
    refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
    return {"player": Player(**refreshed).model_dump(), "granted": row.get("inventory", {}), "purchase_count": count + 1}


@api_router.post("/player/{player_id}/ward-defense/assemble-aegis", response_model=Dict[str, Any])
async def assemble_ward_aegis(
    player_id: str,
    x_clinica_session: Optional[str] = Header(default=None),
):
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    inventory = dict(player.get("inventory") or {})
    if int(inventory.get(WARD_AEGIS_FRAGMENT, 0)) < 5:
        raise HTTPException(status_code=409, detail="five Ward Aegis Fragments are required")
    inventory[WARD_AEGIS_FRAGMENT] -= 5
    inventory[WARD_AEGIS_IMPRINT] = int(inventory.get(WARD_AEGIS_IMPRINT, 0)) + 1
    write = await db.players.update_one(
        {"id": player_id, "updated_at": player.get("updated_at"), f"inventory.{WARD_AEGIS_FRAGMENT}": {"$gte": 5}},
        {"$set": {"inventory": inventory, "updated_at": now_iso()}},
    )
    if write.modified_count != 1:
        raise HTTPException(status_code=409, detail="Aegis assembly changed; retry")
    refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
    return {"player": Player(**refreshed).model_dump(), "assembled": True}


@api_router.post("/player/{player_id}/ward-defense/aegis-sidegrade", response_model=Dict[str, Any])
async def purchase_ward_aegis_sidegrade(
    player_id: str,
    payload: WardAegisSidegradeRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Atomically consume one Ward Aegis Imprint for an authored sidegrade."""
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    upgrades = dict(player.get("hero_skill_upgrades") or {})
    if upgrades.get(payload.upgrade_id, 0) >= 1:
        raise HTTPException(status_code=409, detail="Aegis sidegrade already unlocked")
    inventory = dict(player.get("inventory") or {})
    if int(inventory.get(WARD_AEGIS_IMPRINT, 0)) < 1:
        raise HTTPException(status_code=409, detail="one Ward Aegis Imprint is required")
    inventory[WARD_AEGIS_IMPRINT] -= 1
    result = await db.players.update_one(
        {"id": player_id, "updated_at": player.get("updated_at"), f"inventory.{WARD_AEGIS_IMPRINT}": {"$gte": 1}, f"hero_skill_upgrades.{payload.upgrade_id}": {"$exists": False}},
        {"$set": {"inventory": inventory, "hero_skill_upgrades": {**upgrades, payload.upgrade_id: 1}, "updated_at": now_iso()}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="Aegis sidegrade changed; retry")
    refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
    return {"player": Player(**refreshed).model_dump(), "unlocked": payload.upgrade_id}


@api_router.post("/player/{player_id}/university-practice/attempts")
async def begin_university_practice_attempt(
    player_id: str,
    payload: UniversityPracticeAttemptRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Issue one short-lived, challenge-bound receipt before a practice claim."""
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    difficulty = "introductory" if payload.difficulty == "beginner" else payload.difficulty
    manifest = PRACTICE_CHALLENGE_MANIFEST.get(payload.challenge_id)
    if not manifest or manifest["activity"] != payload.activity or manifest["difficulty"] != difficulty or manifest["version"] != payload.challenge_version:
        raise HTTPException(status_code=422, detail="challenge is not an approved practice challenge")
    attempt = {
        "id": str(uuid.uuid4()), "player_id": player_id, "activity": payload.activity,
        "challenge_id": payload.challenge_id, "challenge_version": payload.challenge_version,
        "difficulty": difficulty, "created_at": now_iso(), "status": "issued",
    }
    await db.activity_attempts.insert_one(attempt)
    return {"attempt_id": attempt["id"], "activity": payload.activity, "challenge_id": payload.challenge_id, "challenge_version": payload.challenge_version}


@api_router.post("/player/{player_id}/university-practice/complete")
async def complete_university_practice(
    player_id: str,
    payload: UniversityPracticeCompletionRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Consume one bound receipt and derive payout, milestones, and mastery server-side."""
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    difficulty = "introductory" if payload.difficulty == "beginner" else payload.difficulty
    manifest = PRACTICE_CHALLENGE_MANIFEST.get(payload.challenge_id)
    if not manifest or manifest["activity"] != payload.activity or manifest["difficulty"] != difficulty or manifest["version"] != payload.challenge_version:
        raise HTTPException(status_code=422, detail="challenge is not an approved practice challenge")
    issued = await db.activity_attempts.find_one_and_update(
        {
            "id": payload.attempt_id, "player_id": player_id, "activity": payload.activity,
            "challenge_id": payload.challenge_id, "challenge_version": payload.challenge_version,
            "difficulty": difficulty, "status": "issued",
        },
        {"$set": {"status": "processing", "submitted_at": now_iso()}},
        return_document=True,
    )
    if not issued:
        existing = await db.activity_attempts.find_one({"id": payload.attempt_id, "player_id": player_id}, {"_id": 0})
        if existing and existing.get("status") == "claimed":
            current = await db.players.find_one({"id": player_id}, {"_id": 0})
            return {"player": Player(**current).model_dump(), "multiplier": 0, "granted": {}, "first_completion": False, "already_claimed": True, "milestone_ids": []}
        raise HTTPException(status_code=409, detail="attempt already used, expired, or unavailable")
    count_key = {
        "cue_lab": "uni_cue_lab_count",
        "triage": "uni_triage_count",
        "stack": "uni_stack_count",
    }[payload.activity]
    current_count = int(player.get(count_key, 0))
    is_first_completion = current_count == 0
    rewards = UNIVERSITY_PRACTICE_REWARDS if is_first_completion else UNIVERSITY_PRACTICE_REPEAT_REWARDS
    xp, credits, item, quantity = rewards[payload.activity][difficulty]
    day = age1_day_key()
    used = int(player.get("age1_reward_units", 0)) if player.get("age1_reward_day") == day else 0
    multiplier = age1_reward_multiplier(used, 1)
    increments: Dict[str, int] = {
        "xp": int(round(xp * multiplier)),
        "university_credits": int(round(credits * multiplier)),
        f"inventory.{item}": int(round(quantity * multiplier)),
        count_key: 1,
    }
    claimed = set(player.get("uni_practice_milestones_claimed") or [])
    milestone_ids: List[str] = []
    for milestone_activity, threshold, milestone_id, reward in UNIVERSITY_PRACTICE_MILESTONES:
        if milestone_activity == payload.activity and current_count + 1 >= threshold and milestone_id not in claimed:
            milestone_ids.append(milestone_id)
            for field, value in reward.items():
                increments[field] = increments.get(field, 0) + int(value)
    practice = dict(player.get("clinical_practice") or {})
    history = list(practice.get("history") or [])
    exact_repeats = sum(1 for entry in history if entry.get("challengeId") == payload.challenge_id)
    mastery_gain = 0 if payload.safety_result == "unsafe" else max(1, int(payload.score // 20)) if exact_repeats == 0 else (1 if exact_repeats < 3 else 0)
    domains = dict((practice.get("mastery") or {}).get("domains") or {})
    topics = dict((practice.get("mastery") or {}).get("topics") or {})
    for domain in manifest["domains"]:
        domains[domain] = int(domains.get(domain, 0)) + mastery_gain
    for topic in manifest["topics"]:
        topics[topic] = int(topics.get(topic, 0)) + mastery_gain
    best = dict(practice.get("personalBest") or {})
    family = manifest["family"]
    best[family] = max(int(best.get(family, 0)), payload.score)
    prior_streak = int(practice.get("safetyStreak", 0))
    attempt_record = {
        "challengeId": payload.challenge_id, "challengeVersion": payload.challenge_version,
        "variantFamilyId": family, "activity": payload.activity, "difficulty": difficulty,
        "score": payload.score, "safety": payload.safety_result,
        "topicTags": manifest["topics"], "masteryTags": manifest["domains"], "completedAt": now_iso(),
    }
    next_practice = {
        "history": (history + [attempt_record])[-60:],
        "mastery": {"domains": domains, "topics": topics},
        "personalBest": best,
        "safetyStreak": prior_streak + 1 if payload.safety_result == "safe" else 0,
    }
    increments = {key: value for key, value in increments.items() if value}
    next_xp = int(player.get("xp", 0)) + increments.get("xp", 0)
    updated = await db.players.update_one(
        {"id": player_id, "updated_at": player.get("updated_at")},
        {"$inc": increments, "$set": {
            "updated_at": now_iso(), "age1_reward_day": day, "age1_reward_units": used + 1,
            "player_level": player_level_from_xp(next_xp),
            "clinical_practice": next_practice,
            "uni_practice_milestones_claimed": sorted(claimed.union(milestone_ids)),
        }},
    )
    if updated.modified_count != 1:
        await db.activity_attempts.update_one({"id": payload.attempt_id, "status": "processing"}, {"$set": {"status": "issued"}})
        raise HTTPException(status_code=409, detail="University reward state changed; retry")
    await db.activity_attempts.update_one({"id": payload.attempt_id}, {"$set": {"status": "claimed", "claimed_at": now_iso()}})
    current = await db.players.find_one({"id": player_id}, {"_id": 0})
    return {
        "player": Player(**current).model_dump(),
        "multiplier": multiplier,
        "granted": increments,
        "first_completion": is_first_completion,
        "milestone_ids": milestone_ids,
        "already_claimed": False,
    }


# ---------- Living Clinica Activity Registry (Package 5A) ----------

def activity_is_daily_eligible(activity_id: str, player: Dict[str, Any]) -> bool:
    """Mirror the registry's introduction rule without inspecting sensitive data."""
    if activity_id == "university-practice":
        return bool(player.get("seen_university_intro")) and len(player.get("lessons_completed") or []) > 0
    if activity_id in {"clinical-simulation", "grand-rounds", "crisis-drill"}:
        return (
            len(player.get("lessons_completed") or []) > 0
            and int(player.get("uni_cue_lab_count") or 0) > 0
            and int(player.get("uni_triage_count") or 0) > 0
            and int(player.get("uni_stack_count") or 0) > 0
        )
    return False


async def verified_activity_completion_source(
    player_id: str, activity_id: str, completion_key: str,
) -> Dict[str, Any]:
    """Return an existing authoritative completion or reject forged lifecycle events."""
    collection = ACTIVITY_COMPLETION_SOURCES.get(activity_id)
    if not collection:
        raise HTTPException(status_code=422, detail="activity does not have a registered authoritative completion source")
    if activity_id == "university-practice":
        attempt = await db.activity_attempts.find_one(
            {"id": completion_key, "player_id": player_id, "status": "claimed"}, {"_id": 0},
        )
    else:
        attempt = await getattr(db, collection).find_one(
            {"attemptId": completion_key, "player_id": player_id, "completion": {"$exists": True}}, {"_id": 0},
        )
    if not attempt:
        raise HTTPException(status_code=409, detail="meaningful activity completion has not been verified")
    return attempt


@api_router.post("/player/{player_id}/activity-completions")
async def record_activity_completion(
    player_id: str,
    payload: ActivityCompletionRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """
    Record a single, non-rewarding lifecycle receipt for an already settled
    activity. The client cannot choose a reward, event type, wellness value,
    answer, note, or patient content; it may only name an existing completion.
    """
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    activity = ACTIVITY_REGISTRY.get(payload.activity_id)
    if not activity or payload.activity_id not in ACTIVITY_COMPLETION_SOURCES:
        raise HTTPException(status_code=422, detail="activity is not registered for completion tracking")
    source = await verified_activity_completion_source(player_id, payload.activity_id, payload.completion_key)
    completed_at = source.get("completed_at") or source.get("claimed_at") or now_iso()
    receipt = {
        "player_id": player_id,
        "activity_id": payload.activity_id,
        "completion_key": payload.completion_key,
        "registry_version": ACTIVITY_REGISTRY_VERSION,
        "category": activity["category"],
        "home_area": activity["homeArea"],
        "daily_eligible": activity_is_daily_eligible(payload.activity_id, player),
        "completed_at": completed_at,
        "recorded_at": now_iso(),
    }
    try:
        await db.activity_completion_receipts.insert_one(receipt)
        accepted, duplicate = True, False
    except DuplicateKeyError:
        accepted, duplicate = False, True
        existing = await db.activity_completion_receipts.find_one(
            {"player_id": player_id, "activity_id": payload.activity_id, "completion_key": payload.completion_key},
            {"_id": 0},
        )
        if existing:
            receipt = existing

    # Aggregate-only analytics. No account ID, notes, patient state, clinical
    # responses, wellness/log content, or rewards leave the receipt boundary.
    if accepted:
        analytics = {
            "receipt_key": activity_analytics_key(player_id, payload.activity_id, payload.completion_key),
            "activity_id": payload.activity_id,
            "category": activity["category"],
            "home_area": activity["homeArea"],
            "registry_version": ACTIVITY_REGISTRY_VERSION,
            "day": str(completed_at)[:10],
            "recorded_at": now_iso(),
        }
        try:
            await db.activity_analytics.insert_one(analytics)
        except DuplicateKeyError:
            pass
    return {
        "accepted": accepted,
        "duplicate": duplicate,
        "receipt": {
            "activityId": receipt["activity_id"],
            "completionKey": receipt["completion_key"],
            "dailyEligible": bool(receipt["daily_eligible"]),
        },
    }


@api_router.get("/player/{player_id}/clinical-simulations")
async def list_clinical_simulations(
    player_id: str,
    x_clinica_session: Optional[str] = Header(default=None),
):
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    eligible = simulation_eligible(player)
    history = player.get("clinical_simulation_history") or []
    seen = {entry.get("simulationId") for entry in history}
    recommended = next((key for key in CLINICAL_SIMULATION_MANIFESTS if key not in seen), next(iter(CLINICAL_SIMULATION_MANIFESTS)))
    # Catalog records are informational only; action contracts stay private.
    catalog = [
        {
            "id": simulation_id, "version": manifest["version"], "variantFamilyId": manifest["family"],
            "title": manifest["title"], "domain": manifest["domain"], "difficulty": manifest["difficulty"],
            "style": manifest["style"], "reviewed": True,
        }
        for simulation_id, manifest in CLINICAL_SIMULATION_MANIFESTS.items()
    ]
    return {
        "simulations": catalog, "recommended_id": recommended, "eligible": eligible,
        "reason": None if eligible else "Complete an introductory lesson and one Cue, Triage, and Stack practice session.",
    }


@api_router.post("/player/{player_id}/clinical-simulations/attempts")
async def start_clinical_simulation(
    player_id: str,
    payload: ClinicalSimulationStartRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    if not simulation_eligible(player):
        raise HTTPException(status_code=409, detail="Complete the introductory labs before entering Simulation Lab")
    requested_manifest = CLINICAL_SIMULATION_MANIFESTS.get(payload.simulation_id)
    if not requested_manifest:
        raise HTTPException(status_code=422, detail="unknown reviewed simulation")
    level = int(player.get("player_level") or player_level_from_xp(int(player.get("xp", 0))))
    selected_simulation_id = payload.simulation_id
    manifest = requested_manifest
    if payload.retry_mode == "new_variation" and payload.prior_attempt_id:
        prior = await db.clinical_simulation_attempts.find_one(
            {"attemptId": payload.prior_attempt_id, "player_id": player_id},
            {"_id": 0, "simulationId": 1, "completion": 1},
        )
        if not prior or prior.get("simulationId") != payload.simulation_id:
            raise HTTPException(status_code=422, detail="new variation must reference your matching prior attempt")
        if not prior.get("completion"):
            raise HTTPException(status_code=409, detail="complete the current simulation before starting a new variation")
        selected_simulation_id = select_new_simulation_variation(
            payload.simulation_id,
            list(player.get("clinical_simulation_history") or []),
            level,
        )
        manifest = CLINICAL_SIMULATION_MANIFESTS[selected_simulation_id]

    # A new variation may have a different reviewed difficulty/style. Preserve
    # only the learner's assistance choice; the server derives all case-owned
    # configuration from the selected manifest.
    config = payload.config.model_dump()
    if selected_simulation_id != payload.simulation_id:
        config["difficulty"] = manifest["difficulty"]
        config["style"] = manifest["style"]
        complication = manifest.get("complication")
        if not complication or config.get("complicationId") != complication["id"]:
            config["complicationId"] = None

    if config["difficulty"] != manifest["difficulty"] or config["style"] != manifest["style"]:
        raise HTTPException(status_code=422, detail="difficulty and style must match the reviewed simulation")
    if not simulation_is_unlocked(manifest, level):
        raise HTTPException(status_code=409, detail=f"Player Level {CLINICAL_SIMULATION_ADVANCED_LEVEL_GATE} is required for Advanced and Expert simulations")
    complication = manifest.get("complication")
    if config.get("complicationId"):
        if not complication or config["complicationId"] != complication["id"]:
            raise HTTPException(status_code=422, detail="unknown or unavailable complication")
        if config["difficulty"] not in {"advanced", "expert"}:
            raise HTTPException(status_code=422, detail="complications require Advanced or Expert")
    if payload.retry_mode == "guided":
        config["assistance"] = "guided"
    seed = secrets.randbelow(2_000_000_000) + 1
    if payload.retry_mode == "same_branch":
        if not payload.prior_attempt_id:
            raise HTTPException(status_code=422, detail="same-branch retry requires a prior attempt")
        prior = await db.clinical_simulation_attempts.find_one({"attemptId": payload.prior_attempt_id, "player_id": player_id}, {"_id": 0})
        if not prior or prior.get("simulationId") != payload.simulation_id:
            raise HTTPException(status_code=422, detail="same-branch retry must reference your matching prior attempt")
        seed = int(prior["seed"])
    active_attempt_id = player.get("clinical_simulation_active_attempt_id")
    if active_attempt_id:
        active_attempt = await db.clinical_simulation_attempts.find_one(
            {"attemptId": active_attempt_id, "player_id": player_id, "status": "active"}, {"_id": 0, "attemptId": 1}
        )
        if active_attempt:
            raise HTTPException(status_code=409, detail="an active simulation is already in progress; resume it before starting another")
        await db.players.update_one(
            {"id": player_id, "clinical_simulation_active_attempt_id": active_attempt_id},
            {"$set": {"clinical_simulation_active_attempt_id": None, "updated_at": now_iso()}},
        )
    attempt = {
        "attemptId": str(uuid.uuid4()), "player_id": player_id, "simulationId": selected_simulation_id,
        "version": manifest["version"], "seed": seed, "branchId": simulation_branch(seed, manifest["family"]),
        "config": config, "beat": "assess", "patient": dict(manifest["initial"]),
        "known": [], "completedObjectiveIds": [], "actionIds": [], "timeline": [], "safety": "safe",
        "status": "active", "complicationTriggered": False, "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.clinical_simulation_attempts.insert_one(attempt)
    await db.players.update_one({"id": player_id}, {"$set": {"clinical_simulation_active_attempt_id": attempt["attemptId"], "updated_at": now_iso()}})
    return {"attempt": simulation_public_attempt(attempt)}


@api_router.get("/player/{player_id}/clinical-simulations/attempts/{attempt_id}")
async def get_clinical_simulation_attempt(
    player_id: str, attempt_id: str, x_clinica_session: Optional[str] = Header(default=None),
):
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player or not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    attempt = await db.clinical_simulation_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="simulation attempt not found")
    return {"attempt": simulation_public_attempt(attempt)}


@api_router.post("/player/{player_id}/clinical-simulations/attempts/{attempt_id}/actions")
async def submit_clinical_simulation_action(
    player_id: str, attempt_id: str, payload: ClinicalSimulationActionRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player or not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    attempt = await db.clinical_simulation_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="simulation attempt not found")
    if attempt.get("status") != "active":
        raise HTTPException(status_code=409, detail="simulation is no longer active")
    manifest = CLINICAL_SIMULATION_MANIFESTS.get(attempt["simulationId"])
    action = (manifest or {}).get("actions", {}).get(payload.action_id)
    if not action:
        raise HTTPException(status_code=422, detail="unknown simulation action")
    if payload.action_id in attempt.get("actionIds", []):
        raise HTTPException(status_code=409, detail="duplicate simulation action")
    if attempt.get("beat") not in action["beats"]:
        raise HTTPException(status_code=422, detail=f"action is not legal during {attempt.get('beat')}")
    before = dict(attempt["patient"])
    patient = dict(before)
    for key, value in action.get("delta", {}).items():
        patient[key] = max(0, min(100, int(patient.get(key, 0)) + int(value)))
    if action["group"] not in {"assess", "reassess"}:
        patient["interventionCount"] = int(patient.get("interventionCount", 0)) + 1
    revealed = [item for item in action.get("reveal", []) if item in patient.get("hiddenFindings", [])]
    patient["hiddenFindings"] = [item for item in patient.get("hiddenFindings", []) if item not in revealed]
    known_ids = {item.get("id") for item in attempt.get("known", [])}
    known = [*attempt.get("known", []), *[item for item in manifest.get("known", []) if item["id"] in revealed and item["id"] not in known_ids]]
    action_ids = [*attempt.get("actionIds", []), payload.action_id]
    objectives = list(dict.fromkeys([*attempt.get("completedObjectiveIds", []), *action.get("objectives", [])]))
    complication = manifest.get("complication")
    triggered = bool(
        complication
        and attempt.get("config", {}).get("complicationId") == complication["id"]
        and not attempt.get("complicationTriggered")
        and payload.action_id == complication["trigger"]
        and complication["prevent"] not in action_ids
    )
    if triggered:
        patient["complications"] = [*patient.get("complications", []), complication["id"]]
        patient["acuity"] = "high"
    safety = "unsafe" if action.get("unsafe") else attempt.get("safety", "safe")
    draft = {**attempt, "patient": patient, "known": known, "actionIds": action_ids, "completedObjectiveIds": objectives, "complicationTriggered": bool(attempt.get("complicationTriggered") or triggered)}
    beat = simulation_next_beat(draft, manifest)
    timeline = [*attempt.get("timeline", []), {
        "actionId": payload.action_id, "beat": attempt.get("beat"), "announcement": action["announcement"],
        "stateDelta": "state updated", "knownIds": revealed,
    }]
    next_attempt = {**draft, "beat": beat, "timeline": timeline, "safety": safety, "status": "completed" if beat == "outcome" else "active", "updated_at": now_iso()}
    write = await db.clinical_simulation_attempts.update_one(
        {"attemptId": attempt_id, "player_id": player_id, "status": "active", "actionIds": attempt.get("actionIds", [])},
        {"$set": next_attempt},
    )
    if write.modified_count != 1:
        raise HTTPException(status_code=409, detail="simulation action order changed; reload the attempt")
    return {"attempt": simulation_public_attempt(next_attempt)}


@api_router.post("/player/{player_id}/clinical-simulations/attempts/{attempt_id}/complete")
async def complete_clinical_simulation(
    player_id: str, attempt_id: str, x_clinica_session: Optional[str] = Header(default=None),
):
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player or not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    attempt = await db.clinical_simulation_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="simulation attempt not found")
    if attempt.get("completion"):
        return {"player": Player(**player).model_dump(), "debrief": attempt["completion"], "already_completed": True}
    if attempt.get("status") != "completed" or attempt.get("beat") != "outcome":
        raise HTTPException(status_code=409, detail="complete the authored clinical beats before debrief")
    # All requests for one attempt share a deterministic ownership marker.
    # It is deliberately the attempt ID (not a request nonce): if a process
    # dies mid-completion, a retry can reconstruct the same first-clear result
    # and receipt. Parallel callers therefore cannot diverge on firstClear.
    await db.clinical_simulation_attempts.update_one(
        {"attemptId": attempt_id, "completion": {"$exists": False}},
        {"$set": {"completion_owner": attempt_id}},
    )
    manifest = CLINICAL_SIMULATION_MANIFESTS[attempt["simulationId"]]
    objective_total = sum(manifest["objectives"].values())
    objective_score = sum(manifest["objectives"].get(key, 0) for key in attempt.get("completedObjectiveIds", [])) / max(1, objective_total)
    patient = attempt["patient"]
    vital_score = (int(patient["stability"]) + int(patient["oxygenation"]) + int(patient["perfusion"])) / 3
    unsafe = attempt.get("safety") == "unsafe" or int(patient["stability"]) < 35
    score = max(0, min(100, round(objective_score * 60 + vital_score * 0.4 - 15 * len(patient.get("complications", [])))))
    outcome = "unsafe" if unsafe else "stabilized" if score >= 82 else "partially_stabilized" if score >= 55 else "missed"
    rating = "unsafe" if unsafe else "excellent" if score >= 90 else "strong" if score >= 72 else "developing"
    history = list(player.get("clinical_simulation_history") or [])
    # Claim first-clear ownership before calculating its higher reward. The
    # claim stores its attempt ID, so a retry can finish an interrupted claim
    # without allowing a parallel attempt to claim the same simulation.
    first_clear = False
    if outcome == "stabilized":
        claim_path = f"clinical_simulation_first_clear_claims.{attempt['simulationId']}"
        claim = await db.players.update_one(
            {"id": player_id, claim_path: {"$exists": False}},
            {"$set": {claim_path: attempt_id}},
        )
        if claim.modified_count == 1:
            first_clear = True
        else:
            claimed_player = await db.players.find_one({"id": player_id}, {"_id": 0})
            first_clear = (claimed_player or {}).get("clinical_simulation_first_clear_claims", {}).get(attempt["simulationId"]) == attempt_id
    achievements = []
    if any("support" in action_id or "stabilize" in action_id for action_id in attempt.get("actionIds", [])): achievements.append("first_stabilization")
    if any("reassess" in action_id for action_id in attempt.get("actionIds", [])): achievements.append("reassessment_matters")
    if outcome == "stabilized" and not unsafe: achievements += ["safe_hands", "clinical_simulator"]
    if attempt.get("complicationTriggered") and outcome == "stabilized": achievements.append("adaptive_thinker")
    families = {row.get("variantFamilyId") for row in history}
    if manifest["family"] not in families and len(families) >= 2: achievements.append("broad_clinician")
    debrief = {
        "outcome": outcome, "rating": rating, "score": score, "safety": "unsafe" if unsafe else attempt.get("safety", "safe"),
        "domainBreakdown": {domain: max(0, score - (0 if domain == manifest["domain"] else 8)) for domain in ("airway", "assessment", "stabilization", "pharmacology", "judgment", "systems")},
        "strongDecisions": [entry["announcement"] for entry in attempt.get("timeline", []) if "updated" in entry["stateDelta"]],
        "missedOpportunities": [key.replace("-", " ") for key in manifest["objectives"] if key not in attempt.get("completedObjectiveIds", [])],
        "clinicalPrinciple": manifest["principle"], "relatedPractice": ["Clinical Cue Lab", "Rapid Triage Hall", "Stabilize Stack Lab"],
        "timeline": attempt.get("timeline", []), "firstClear": first_clear, "achievements": achievements,
    }
    # Bounded evidence: first family clear receives meaningful XP/credits;
    # exact replays receive only a small acknowledgement and never a new currency.
    exact_completions = sum(1 for row in history if row.get("simulationId") == attempt["simulationId"])
    xp = 15 if first_clear else 3 if exact_completions < 3 else 0
    credits = 20 if first_clear else 4 if exact_completions < 3 else 0
    record = {
        "attemptId": attempt_id, "simulationId": attempt["simulationId"], "variantFamilyId": manifest["family"],
        "score": score, "outcome": outcome, "safety": debrief["safety"], "completedAt": now_iso(),
    }
    # Mongo standalone does not offer a multi-document transaction here. Make
    # the player mutation itself the idempotency boundary: the attempt ID can
    # be pushed once only, alongside its XP/credit increments. If the process
    # dies before the receipt write below, a retry observes the attempt ID,
    # creates the receipt, and never pays a second time.
    daily = dict(player.get("daily_rounds") or {})
    daily_event_ids = list(player.get("clinical_simulation_daily_event_ids") or [])
    daily_event_new = attempt_id not in daily_event_ids
    if daily_event_new:
        for objective in daily.get("objectives", []):
            if objective.get("event") == "university_lesson":
                objective["progress"] = min(int(objective.get("target", 0)), int(objective.get("progress", 0)) + 1)
        for task in daily.get("weekly_tasks", []):
            if task.get("id") == "w_university":
                task["progress"] = min(int(task.get("target", 0)), int(task.get("progress", 0)) + 1)
        daily_event_ids = [*daily_event_ids, attempt_id][-365:]
    write = await db.players.update_one(
        {"id": player_id, "clinical_simulation_history.attemptId": {"$ne": attempt_id}},
        {"$set": {
            "daily_rounds": daily, "clinical_simulation_daily_event_ids": daily_event_ids, "updated_at": now_iso(),
        }, "$push": {"clinical_simulation_history": {"$each": [record], "$slice": -60}},
           "$addToSet": {
               "clinical_simulation_achievements": {"$each": achievements},
               "simulations_completed": attempt["simulationId"],
           },
           "$max": {f"clinical_simulation_family_bests.{manifest['family']}": score},
           "$inc": {"xp": xp, "university_credits": credits}},
    )
    already_paid = write.modified_count != 1
    await db.clinical_simulation_attempts.update_one(
        {"attemptId": attempt_id, "completion": {"$exists": False}},
        {"$set": {"completion": debrief, "completed_at": now_iso()}},
    )
    await db.players.update_one(
        {"id": player_id, "clinical_simulation_active_attempt_id": attempt_id},
        {"$set": {"clinical_simulation_active_attempt_id": None, "updated_at": now_iso()}},
    )
    receipt = await db.clinical_simulation_attempts.find_one(
        {"attemptId": attempt_id, "player_id": player_id}, {"_id": 0, "completion": 1}
    )
    current = await db.players.find_one({"id": player_id}, {"_id": 0})
    # Derive level from the authoritative post-increment XP. If another
    # completion lands first, the XP predicate prevents this write from
    # overwriting its later level calculation.
    await db.players.update_one(
        {"id": player_id, "xp": current.get("xp", 0)},
        {"$set": {"player_level": player_level_from_xp(int(current.get("xp", 0)))}},
    )
    current = await db.players.find_one({"id": player_id}, {"_id": 0})
    return {
        "player": Player(**current).model_dump(),
        "debrief": (receipt or {}).get("completion") or debrief,
        # Only a request that found a prior receipt at entry is a retry. Two
        # in-flight first submissions both receive the same canonical result.
        "already_completed": False,
    }


def grand_rounds_eligible(player: Dict[str, Any]) -> bool:
    return simulation_eligible(player)


def grand_round_progress(player: Dict[str, Any]) -> int:
    return sum(int(player.get(key, 0)) for key in ("uni_cue_lab_count", "uni_triage_count", "uni_stack_count"))

def _grand_round_manifest_errors(case_id: str, raw: Dict[str, Any]) -> List[str]:
    """Validate a private authored manifest before it can enter review."""
    errors: List[str] = []
    allowed_domains = {"airway", "assessment", "stabilization", "pharmacology", "judgment", "systems"}
    required_text = ("family", "title", "subtitle", "domain", "patientName", "handoff", "concern", "principle")
    for key in required_text:
        if not isinstance(raw.get(key), str) or not raw[key].strip():
            errors.append(f"{key} is required")
    if raw.get("difficulty") not in {"introductory", "standard", "advanced", "expert"}:
        errors.append("difficulty must be introductory, standard, advanced, or expert")
    if raw.get("domain") not in allowed_domains:
        errors.append("domain must be one of airway, assessment, stabilization, pharmacology, judgment, or systems")
    if not isinstance(raw.get("patientAge"), int) or not 0 < raw["patientAge"] < 130:
        errors.append("patientAge must be between 1 and 129")
    if not isinstance(raw.get("unlockChapter"), int) or not 1 <= raw["unlockChapter"] <= 10:
        errors.append("unlockChapter must be between 1 and 10")
    if not isinstance(raw.get("unlockPractice"), int) or not 0 <= raw["unlockPractice"] <= 100:
        errors.append("unlockPractice must be between 0 and 100")
    if not isinstance(raw.get("relatedPractice"), list) or not raw["relatedPractice"] or not all(isinstance(item, str) and item.strip() for item in raw["relatedPractice"]):
        errors.append("relatedPractice must contain at least one practice name")
    initial = raw.get("initial")
    if not isinstance(initial, dict) or any(not isinstance(initial.get(key), int) or not 0 <= initial[key] <= 100 for key in ("stability", "oxygenation", "perfusion")):
        errors.append("initial must include stability, oxygenation, and perfusion from 0 to 100")
    hidden = raw.get("hidden")
    hidden_ids = set()
    if not isinstance(hidden, list):
        errors.append("hidden must be a list")
    else:
        for item in hidden:
            if not isinstance(item, dict) or not all(isinstance(item.get(key), str) and item[key].strip() for key in ("id", "label", "value")):
                errors.append("each hidden finding needs id, label, and value")
                continue
            if item["id"] in hidden_ids:
                errors.append("hidden finding ids must be unique")
            hidden_ids.add(item["id"])
    stations = raw.get("stations")
    if not isinstance(stations, dict) or "observe" not in stations:
        return [*errors, "stations must include the observe entry station"]
    response_ids = set()
    for station_id, station in stations.items():
        if not isinstance(station_id, str) or not isinstance(station, dict):
            errors.append("stations must be keyed objects")
            continue
        if station.get("inputKind") not in {"single_choice", "priority", "sequence"}:
            errors.append(f"station {station_id} has an invalid inputKind")
        if not isinstance(station.get("label"), str) or not station["label"].strip() or not isinstance(station.get("prompt"), str) or not station["prompt"].strip():
            errors.append(f"station {station_id} needs a label and prompt")
        responses = station.get("responses")
        if not isinstance(responses, dict) or not responses:
            errors.append(f"station {station_id} needs at least one response")
            continue
        for response_id, response in responses.items():
            if not isinstance(response_id, str) or not isinstance(response, dict):
                errors.append(f"station {station_id} has an invalid response")
                continue
            if response_id in response_ids:
                errors.append("response ids must be unique across the full case")
            response_ids.add(response_id)
            if not all(isinstance(response.get(key), str) and response[key].strip() for key in ("label", "rationale", "announcement")):
                errors.append(f"response {response_id} needs label, rationale, and announcement")
            if not isinstance(response.get("points", 0), int) or not 0 <= response["points"] <= 100:
                errors.append(f"response {response_id} needs points from 0 to 100")
            next_station = response.get("next")
            if next_station is not None and next_station not in stations:
                errors.append(f"response {response_id} points to an unknown next station")
            if not isinstance(response.get("delta", {}), dict) or any(key not in {"stability", "oxygenation", "perfusion"} or not isinstance(value, int) or not -100 <= value <= 100 for key, value in response.get("delta", {}).items()):
                errors.append(f"response {response_id} has an invalid patient delta")
            if not isinstance(response.get("reveal", []), list) or any(item not in hidden_ids for item in response.get("reveal", [])):
                errors.append(f"response {response_id} reveals an unknown finding")
            if "unsafe" in response and not isinstance(response["unsafe"], bool):
                errors.append(f"response {response_id} unsafe must be true or false")
    # The player scoring contract normalizes a 90-100 point best route to 100.
    # Forbid cycles so an authored station cannot permit infinite score farming.
    def best_score(station_id: str, visiting: set[str]) -> int:
        if station_id in visiting:
            errors.append("station graph cannot contain cycles")
            return -1000
        responses = stations.get(station_id, {}).get("responses", {})
        scores = []
        for response in responses.values():
            next_station = response.get("next")
            follow = 0 if next_station is None else best_score(next_station, {*visiting, station_id})
            scores.append(int(response.get("points", 0)) + follow)
        return max(scores, default=-1000)
    maximum = best_score("observe", set())
    if not 90 <= maximum <= 100:
        errors.append("the highest complete safe route must total 90 to 100 points")
    return list(dict.fromkeys(errors))
async def grand_round_catalog(player: Dict[str, Any]) -> List[Dict[str, Any]]:
    history = player.get("grand_rounds_history") or []
    completed = {}
    for item in history:
        completed[item.get("caseId")] = completed.get(item.get("caseId"), 0) + 1
    level = int(player.get("player_level") or player_level_from_xp(int(player.get("xp", 0))))
    progress = grand_round_progress(player)
    catalog = []
    for case_id, manifest in (await active_grand_round_manifests()).items():
        level_ok = manifest["difficulty"] not in {"advanced", "expert"} or level >= GRAND_ROUNDS_ADVANCED_LEVEL_GATE
        practice_ok = progress >= int(manifest["unlockPractice"])
        available = bool(grand_rounds_eligible(player) and level_ok and practice_ok)
        reason = None
        if not grand_rounds_eligible(player):
            reason = "Complete one Lotus Lesson and one Cue, Triage, and Stack practice session to enter Grand Rounds."
        elif not practice_ok:
            reason = f"Complete {manifest['unlockPractice']} University practice sessions across Cue, Triage, and Stack Labs."
        elif not level_ok:
            reason = f"Player Level {GRAND_ROUNDS_ADVANCED_LEVEL_GATE} is required for this reviewed case."
        catalog.append({
            "id": case_id, "version": manifest["version"], "variantFamilyId": manifest["family"],
            "title": manifest["title"], "subtitle": manifest["subtitle"], "domain": manifest["domain"],
            "difficulty": manifest["difficulty"], "estimatedMinutes": manifest["estimatedMinutes"], "reviewed": True,
            "available": available, "lockedReason": reason,
            "personalBest": (player.get("grand_rounds_case_bests") or {}).get(case_id),
            "completedCount": completed.get(case_id, 0),
        })
    return catalog


async def get_grand_round_player(player_id: str, session: Optional[str]) -> Dict[str, Any]:
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    return player

def faculty_grand_round_view(draft: Dict[str, Any]) -> Dict[str, Any]:
    """Return a governed authoring document only after faculty authentication."""
    return {
        "draftId": draft["draftId"], "caseId": draft["caseId"], "version": draft["version"],
        "status": draft["status"], "revision": draft["revision"], "manifest": draft["manifest"],
        "authorId": draft["authorId"], "createdAt": draft["createdAt"], "updatedAt": draft["updatedAt"],
        "review": draft.get("review"), "approval": draft.get("approval"), "audit": draft.get("audit", []),
    }
@api_router.get("/player/{player_id}/grand-rounds")
async def list_grand_rounds(player_id: str, x_clinica_session: Optional[str] = Header(default=None)):
    player = await get_grand_round_player(player_id, x_clinica_session)
    catalog = await grand_round_catalog(player)
    recommendation = next((item["id"] for item in catalog if item["available"] and not item["completedCount"]), None)
    return {
        "cases": catalog, "recommended_id": recommendation,
        "gate": {
            "eligible": grand_rounds_eligible(player),
            "reason": None if grand_rounds_eligible(player) else "Complete one Lotus Lesson and one Cue, Triage, and Stack practice session to enter Grand Rounds.",
            "requiredPractice": {"lessons": 1, "cueLab": 1, "triage": 1, "stack": 1},
        },
    }


@api_router.post("/player/{player_id}/grand-rounds/attempts")
async def start_grand_rounds(
    player_id: str, payload: GrandRoundsStartRequest, x_clinica_session: Optional[str] = Header(default=None),
):
    player = await get_grand_round_player(player_id, x_clinica_session)
    if not grand_rounds_eligible(player):
        raise HTTPException(status_code=409, detail="Complete the University foundation practices before entering Grand Rounds")
    manifest = await grand_round_manifest(payload.case_id)
    if not manifest:
        raise HTTPException(status_code=422, detail="unknown reviewed Grand Rounds case")
    if int(payload.case_version) != int(manifest["version"]):
        raise HTTPException(status_code=409, detail="this reviewed case version has changed; refresh the case board")
    selected = next((row for row in await grand_round_catalog(player) if row["id"] == payload.case_id), None)
    if not selected or not selected["available"]:
        raise HTTPException(status_code=409, detail=(selected or {}).get("lockedReason") or "this case is not yet available")
    if payload.retry_mode == "guided" and not any(
        row.get("caseId") == payload.case_id for row in (player.get("grand_rounds_history") or [])
    ):
        raise HTTPException(status_code=422, detail="guided review is available after you complete this reviewed case once")
    active_id = player.get("grand_rounds_active_attempt_id")
    if active_id:
        active = await db.grand_rounds_attempts.find_one(
            {"attemptId": active_id, "player_id": player_id}, {"_id": 0}
        )
        if not active:
            # A reservation has a short fenced lease. A live competing insert
            # is never cleared; an interrupted process can be safely recovered
            # after its lease, and the original writer verifies its fence after
            # insertion before exposing any attempt.
            stale_before = (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat()
            released = await db.players.update_one(
                {"id": player_id, "grand_rounds_active_attempt_id": active_id, "$or": [
                    {"grand_rounds_reservation_at": {"$lt": stale_before}},
                    {"grand_rounds_reservation_at": {"$exists": False}},
                ]},
                {"$set": {"grand_rounds_active_attempt_id": None, "grand_rounds_reservation_at": None, "updated_at": now_iso()}},
            )
            if released.modified_count != 1:
                raise HTTPException(status_code=409, detail="a Grand Rounds case reservation is being created; retry shortly")
        else:
            if active.get("status") in {"active", "paused"}:
                raise HTTPException(status_code=409, detail=f"an active Grand Rounds case is in progress; resume {active_id} before starting another")
            await db.players.update_one(
                {"id": player_id, "grand_rounds_active_attempt_id": active_id},
                {"$set": {"grand_rounds_active_attempt_id": None, "grand_rounds_reservation_at": None}},
            )
    seed = secrets.randbelow(2_000_000_000) + 1
    if payload.retry_mode == "same_case":
        if not payload.prior_attempt_id:
            raise HTTPException(status_code=422, detail="same-case retry requires a prior case receipt")
        prior = await db.grand_rounds_attempts.find_one({"attemptId": payload.prior_attempt_id, "player_id": player_id}, {"_id": 0})
        if not prior or prior.get("caseId") != payload.case_id or not prior.get("completion"):
            raise HTTPException(status_code=422, detail="same-case retry must reference one of your completed matching cases")
        seed = int(prior["seed"])
    attempt = {
        "attemptId": str(uuid.uuid4()), "player_id": player_id, "caseId": payload.case_id, "version": manifest["version"],
        "seed": seed, "branchId": f"round-{(seed ^ sum(map(ord, manifest['family']))) & 0xffffffff:08x}",
        "difficulty": manifest["difficulty"], "stageId": "observe",
        "patient": {**manifest["initial"], "concern": manifest["concern"]}, "known": [], "timeline": [],
        "responseIds": [], "safety": "safe", "status": "active", "notes": "",
        # A guided review is deliberately educational-only. It reuses the
        # authoritative stations but never becomes a progression/reward claim.
        "reviewMode": payload.retry_mode == "guided", "created_at": now_iso(), "updated_at": now_iso(),
    }
    # Reserve the sole active-case slot before inserting the attempt. The
    # compare-and-set predicate is the authority boundary for concurrent start
    # requests: only one can hold the pointer, and a failed insert releases it.
    reserved = await db.players.update_one(
        {"id": player_id, "$or": [
            {"grand_rounds_active_attempt_id": None},
            {"grand_rounds_active_attempt_id": {"$exists": False}},
        ]},
        {"$set": {"grand_rounds_active_attempt_id": attempt["attemptId"], "grand_rounds_reservation_at": now_iso(), "updated_at": now_iso()}},
    )
    if reserved.modified_count != 1:
        current = await db.players.find_one({"id": player_id}, {"_id": 0, "grand_rounds_active_attempt_id": 1})
        raise HTTPException(status_code=409, detail=f"an active Grand Rounds case is in progress; resume {(current or {}).get('grand_rounds_active_attempt_id')} before starting another")
    try:
        await db.grand_rounds_attempts.insert_one(attempt)
    except Exception:
        await db.players.update_one(
            {"id": player_id, "grand_rounds_active_attempt_id": attempt["attemptId"]},
            {"$set": {"grand_rounds_active_attempt_id": None, "grand_rounds_reservation_at": None, "updated_at": now_iso()}},
        )
        raise
    # Fence the insert: if a crashed/slow writer lost an expired reservation
    # while inserting, remove its attempt instead of leaving an orphan active
    # case that could be completed outside the player pointer.
    fenced = await db.players.update_one(
        {"id": player_id, "grand_rounds_active_attempt_id": attempt["attemptId"]},
        {"$set": {"grand_rounds_reservation_at": None, "updated_at": now_iso()}},
    )
    if fenced.modified_count != 1:
        await db.grand_rounds_attempts.delete_one({"attemptId": attempt["attemptId"], "player_id": player_id})
        raise HTTPException(status_code=409, detail="the Grand Rounds reservation expired; retry the case")
    return {"attempt": grand_round_public_attempt(attempt, manifest)}


@api_router.get("/player/{player_id}/grand-rounds/attempts/{attempt_id}")
async def get_grand_round_attempt(player_id: str, attempt_id: str, x_clinica_session: Optional[str] = Header(default=None)):
    await get_grand_round_player(player_id, x_clinica_session)
    attempt = await db.grand_rounds_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Grand Rounds attempt not found")
    manifest = await grand_round_manifest(attempt["caseId"], attempt["version"])
    if not manifest:
        raise HTTPException(status_code=409, detail="the immutable case version for this attempt is unavailable")
    return {"attempt": grand_round_public_attempt(attempt, manifest)}


@api_router.post("/player/{player_id}/grand-rounds/attempts/{attempt_id}/responses")
async def submit_grand_round_response(
    player_id: str, attempt_id: str, payload: GrandRoundsResponseRequest, x_clinica_session: Optional[str] = Header(default=None),
):
    await get_grand_round_player(player_id, x_clinica_session)
    attempt = await db.grand_rounds_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Grand Rounds attempt not found")
    if attempt.get("status") != "active":
        raise HTTPException(status_code=409, detail="resume this case before making a clinical decision")
    manifest = await grand_round_manifest(attempt["caseId"], attempt["version"])
    station = (manifest or {}).get("stations", {}).get(attempt.get("stageId"))
    response = (station or {}).get("responses", {}).get(payload.response_id)
    if not response:
        raise HTTPException(status_code=422, detail="that response is not legal at this clinical station")
    if payload.response_id in attempt.get("responseIds", []):
        raise HTTPException(status_code=409, detail="this station response was already submitted")
    before, patient = dict(attempt["patient"]), dict(attempt["patient"])
    for key, value in response.get("delta", {}).items():
        patient[key] = max(0, min(100, int(patient.get(key, 0)) + int(value)))
    if patient["stability"] < 45:
        patient["acuity"] = "critical"
    elif patient["stability"] < 65:
        patient["acuity"] = "high"
    revealed_ids = response.get("reveal", [])
    existing = {item["id"] for item in attempt.get("known", [])}
    known = [*attempt.get("known", []), *[
        item for item in manifest["hidden"] if item["id"] in revealed_ids and item["id"] not in existing
    ]]
    delta = " · ".join(
        f"{key} {'+' if patient[key] > before[key] else ''}{patient[key] - before[key]}"
        for key in ("stability", "oxygenation", "perfusion") if patient[key] != before[key]
    ) or "no measurable patient-state change"
    timeline = [*attempt.get("timeline", []), {
        "responseId": payload.response_id, "stageId": attempt["stageId"], "announcement": response["announcement"],
        "stateDelta": delta, "knownIds": revealed_ids,
    }]
    next_stage = response.get("next")
    next_attempt = {**attempt, "patient": patient, "known": known, "timeline": timeline,
                    "responseIds": [*attempt.get("responseIds", []), payload.response_id],
                    "safety": "unsafe" if response.get("unsafe") else attempt.get("safety", "safe"),
                    "stageId": next_stage, "status": "completed" if next_stage is None else "active", "updated_at": now_iso()}
    write = await db.grand_rounds_attempts.update_one(
        {"attemptId": attempt_id, "player_id": player_id, "status": "active", "stageId": attempt["stageId"], "responseIds": attempt.get("responseIds", [])},
        {"$set": next_attempt},
    )
    if write.modified_count != 1:
        raise HTTPException(status_code=409, detail="the case state changed; reload before responding")
    return {"attempt": grand_round_public_attempt(next_attempt, manifest)}


@api_router.post("/player/{player_id}/grand-rounds/attempts/{attempt_id}/pause")
async def pause_grand_round(player_id: str, attempt_id: str, x_clinica_session: Optional[str] = Header(default=None)):
    await get_grand_round_player(player_id, x_clinica_session)
    await db.grand_rounds_attempts.update_one({"attemptId": attempt_id, "player_id": player_id, "status": "active"}, {"$set": {"status": "paused", "updated_at": now_iso()}})
    attempt = await db.grand_rounds_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Grand Rounds attempt not found")
    manifest = await grand_round_manifest(attempt["caseId"], attempt["version"])
    if not manifest:
        raise HTTPException(status_code=409, detail="the immutable case version for this attempt is unavailable")
    return {"attempt": grand_round_public_attempt(attempt, manifest)}


@api_router.post("/player/{player_id}/grand-rounds/attempts/{attempt_id}/resume")
async def resume_grand_round(player_id: str, attempt_id: str, x_clinica_session: Optional[str] = Header(default=None)):
    await get_grand_round_player(player_id, x_clinica_session)
    await db.grand_rounds_attempts.update_one({"attemptId": attempt_id, "player_id": player_id, "status": "paused"}, {"$set": {"status": "active", "updated_at": now_iso()}})
    attempt = await db.grand_rounds_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Grand Rounds attempt not found")
    manifest = await grand_round_manifest(attempt["caseId"], attempt["version"])
    if not manifest:
        raise HTTPException(status_code=409, detail="the immutable case version for this attempt is unavailable")
    return {"attempt": grand_round_public_attempt(attempt, manifest)}


@api_router.put("/player/{player_id}/grand-rounds/attempts/{attempt_id}/notes")
async def save_grand_round_notes(
    player_id: str, attempt_id: str, payload: GrandRoundsNotesRequest, x_clinica_session: Optional[str] = Header(default=None),
):
    await get_grand_round_player(player_id, x_clinica_session)
    await db.grand_rounds_attempts.update_one(
        {"attemptId": attempt_id, "player_id": player_id, "status": {"$in": ["active", "paused"]}},
        {"$set": {"notes": payload.notes.strip(), "updated_at": now_iso()}},
    )
    attempt = await db.grand_rounds_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Grand Rounds attempt not found")
    manifest = await grand_round_manifest(attempt["caseId"], attempt["version"])
    if not manifest:
        raise HTTPException(status_code=409, detail="the immutable case version for this attempt is unavailable")
    return {"attempt": grand_round_public_attempt(attempt, manifest)}


@api_router.post("/player/{player_id}/grand-rounds/attempts/{attempt_id}/abandon")
async def abandon_grand_round(player_id: str, attempt_id: str, x_clinica_session: Optional[str] = Header(default=None)):
    await get_grand_round_player(player_id, x_clinica_session)
    await db.grand_rounds_attempts.update_one(
        {"attemptId": attempt_id, "player_id": player_id, "status": {"$in": ["active", "paused"]}},
        {"$set": {"status": "abandoned", "stageId": None, "updated_at": now_iso()}},
    )
    await db.players.update_one({"id": player_id, "grand_rounds_active_attempt_id": attempt_id}, {"$set": {"grand_rounds_active_attempt_id": None, "updated_at": now_iso()}})
    current = await db.players.find_one({"id": player_id}, {"_id": 0})
    return {"player": Player(**current).model_dump()}


@api_router.post("/player/{player_id}/grand-rounds/attempts/{attempt_id}/complete")
async def complete_grand_round(player_id: str, attempt_id: str, x_clinica_session: Optional[str] = Header(default=None)):
    player = await get_grand_round_player(player_id, x_clinica_session)
    attempt = await db.grand_rounds_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Grand Rounds attempt not found")
    if attempt.get("completion"):
        return {"player": Player(**player).model_dump(), "debrief": attempt["completion"], "already_completed": True}
    if attempt.get("status") != "completed" or attempt.get("stageId") is not None:
        raise HTTPException(status_code=409, detail="complete every authored station before opening the debrief")
    # A single request claims receipt construction. Concurrent callers wait for
    # the canonical receipt instead of recalculating a competing reward. The
    # owner marker is recoverable: it contains only this attempt ID and the
    # player mutation is still guarded by the attempt history receipt.
    claim_token = str(uuid.uuid4())
    stale_claim_before = (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat()
    claimed = await db.grand_rounds_attempts.update_one(
        {"attemptId": attempt_id, "completion": {"$exists": False}, "$or": [
            {"completion_claim": {"$exists": False}},
            {"completion_claimed_at": {"$lt": stale_claim_before}},
        ]},
        {"$set": {"completion_claim": claim_token, "completion_claimed_at": now_iso()}},
    )
    if claimed.modified_count != 1:
        for _ in range(40):
            pending = await db.grand_rounds_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
            if pending and pending.get("completion"):
                current = await db.players.find_one({"id": player_id}, {"_id": 0})
                return {"player": Player(**current).model_dump(), "debrief": pending["completion"], "already_completed": True}
            await asyncio.sleep(0.05)
        raise HTTPException(status_code=409, detail="Grand Rounds receipt is being finalized; retry to receive the canonical debrief")
    manifest = await grand_round_manifest(attempt["caseId"], attempt["version"])
    if not manifest:
        raise HTTPException(status_code=409, detail="the immutable case version for this attempt is unavailable")
    patient = attempt["patient"]
    raw_score = round(sum(
        (manifest["stations"][entry["stageId"]]["responses"][entry["responseId"]].get("points", 0))
        for entry in attempt.get("timeline", [])
    ) / 0.9)  # complication recovery has 15 points; normalize to 100
    raw_score = max(0, min(100, raw_score))
    unsafe = attempt.get("safety") == "unsafe" or int(patient["stability"]) < 35
    score = min(raw_score, 55) if unsafe else raw_score
    outcome = "unsafe" if unsafe else "excellent" if score >= 90 else "competent" if score >= 60 else "needs_review"
    patient_outcome = "deteriorated" if int(patient["stability"]) < 45 else "stabilized" if int(patient["stability"]) >= 70 else "guarded"
    history = list(player.get("grand_rounds_history") or [])
    review_mode = bool(attempt.get("reviewMode"))
    first_clear = False
    if not review_mode and outcome in {"excellent", "competent"}:
        path = f"grand_rounds_first_clear_claims.{attempt['caseId']}"
        claim = await db.players.update_one({"id": player_id, path: {"$exists": False}}, {"$set": {path: attempt_id}})
        first_clear = claim.modified_count == 1
        if not first_clear:
            current_claim = await db.players.find_one({"id": player_id}, {"_id": 0, "grand_rounds_first_clear_claims": 1})
            first_clear = (current_claim or {}).get("grand_rounds_first_clear_claims", {}).get(attempt["caseId"]) == attempt_id
    completed_count = sum(1 for row in history if row.get("caseId") == attempt["caseId"])
    rewardable = outcome in {"excellent", "competent"} and not review_mode
    xp, credits, mastery = (25, 30, 4) if rewardable and first_clear else (3, 3, 1) if rewardable and completed_count < 2 else (0, 0, 0)
    domain_scores = {domain: max(0, min(100, score if domain == manifest["domain"] else score - 15)) for domain in ("airway", "assessment", "stabilization", "pharmacology", "judgment", "systems")}
    timeline = attempt.get("timeline", [])
    debrief = {
        "outcome": outcome, "patientOutcome": patient_outcome, "score": score, "rawScore": raw_score, "safety": "unsafe" if unsafe else "safe",
        "domainBreakdown": domain_scores, "strongestDecision": (timeline[0]["announcement"] if timeline else "No completed clinical decision."),
        "missedOpportunity": "Review the safety change and return through the related practice." if unsafe else "None — your reassessment closed the loop.",
        "patientEvolution": f"Final stability {patient['stability']}, oxygenation {patient['oxygenation']}, perfusion {patient['perfusion']}.",
        "clinicalPrinciple": manifest["principle"], "relatedPractice": manifest["relatedPractice"], "timeline": timeline,
        "firstClear": first_clear, "personalBest": not review_mode and score > int((player.get("grand_rounds_case_bests") or {}).get(attempt["caseId"], -1)),
        "reward": {"xp": xp, "universityCredits": credits, "mastery": mastery, "message": "Review mode pays no reward or progression." if review_mode else "A safety result needs review before rewards." if not rewardable else "First reviewed clear." if first_clear else "Repeat evidence is sharply tapered."},
    }
    daily = dict(player.get("daily_rounds") or {})
    daily_ids = list(player.get("grand_rounds_daily_event_ids") or [])
    if not review_mode and attempt_id not in daily_ids:
        for objective in daily.get("objectives", []):
            if objective.get("event") == "university_lesson":
                objective["progress"] = min(int(objective.get("target", 0)), int(objective.get("progress", 0)) + 1)
        for task in daily.get("weekly_tasks", []):
            if task.get("id") == "w_university":
                task["progress"] = min(int(task.get("target", 0)), int(task.get("progress", 0)) + 1)
        daily_ids = [*daily_ids, attempt_id][-365:]
    record = {"attemptId": attempt_id, "caseId": attempt["caseId"], "variantFamilyId": manifest["family"], "score": score, "outcome": outcome, "safety": debrief["safety"], "completedAt": now_iso()}
    if review_mode:
        # A guided review has a durable debrief receipt, but never alters
        # progression evidence: no first clear, history, best, mastery,
        # reward, or Daily/Weekly University event.
        await db.players.update_one(
            {"id": player_id, "grand_rounds_active_attempt_id": attempt_id},
            {"$set": {"grand_rounds_active_attempt_id": None, "updated_at": now_iso()}},
        )
    else:
        await db.players.update_one(
            {"id": player_id, "grand_rounds_history.attemptId": {"$ne": attempt_id}},
            {"$set": {"daily_rounds": daily, "grand_rounds_daily_event_ids": daily_ids, "grand_rounds_active_attempt_id": None, "updated_at": now_iso()},
             "$push": {"grand_rounds_history": {"$each": [record], "$slice": -60}},
             "$max": {f"grand_rounds_case_bests.{attempt['caseId']}": score},
             "$inc": {"xp": xp, "university_credits": credits, f"grand_rounds_mastery.{manifest['domain']}": mastery}},
        )
    await db.grand_rounds_attempts.update_one(
        {"attemptId": attempt_id, "completion_claim": claim_token, "completion": {"$exists": False}},
        {"$set": {"completion": debrief, "completed_at": now_iso()}},
    )
    current = await db.players.find_one({"id": player_id}, {"_id": 0})
    await db.players.update_one({"id": player_id, "xp": current.get("xp", 0)}, {"$set": {"player_level": player_level_from_xp(int(current.get("xp", 0)))}})
    current = await db.players.find_one({"id": player_id}, {"_id": 0})
    receipt = await db.grand_rounds_attempts.find_one({"attemptId": attempt_id}, {"_id": 0, "completion": 1})
    return {"player": Player(**current).model_dump(), "debrief": (receipt or {}).get("completion") or debrief, "already_completed": False}


# ---------------------------------------------------------------------------
# Crisis Drill endpoints  (/api/player/{id}/crisis-drills/…)
# ---------------------------------------------------------------------------
# Design mirrors Grand Rounds exactly.  Crisis Drill is isolated from Ward
# Defense — no shared state, collection, or reward source.

def crisis_drill_eligible(player: Dict[str, Any]) -> bool:
    """Same foundation gate as Grand Rounds — one lesson + one of each practice."""
    return simulation_eligible(player)


def crisis_drill_catalog(player: Dict[str, Any]) -> List[Dict[str, Any]]:
    history = player.get("crisis_drill_history") or []
    completed: Dict[str, int] = {}
    for item in history:
        completed[item.get("drillId")] = completed.get(item.get("drillId"), 0) + 1
    safe_families = {
        item.get("family") for item in history
        if item.get("outcome") in {"excellent", "competent"} and item.get("family")
    }
    safe_breadth = len(safe_families)
    eligible = crisis_drill_eligible(player)
    catalog = []
    for drill_id, manifest in CRISIS_DRILL_CASES.items():
        # Emergency pacing depends on University exposure and demonstrated safe
        # breadth, never account days or hero power. Introductory cases are
        # available once the foundation is complete; standard and advanced cases
        # expand after safe completion across distinct emergency families.
        breadth_needed = {"introductory": 0, "standard": 1, "advanced": 3}[manifest["difficulty"]]
        breadth_ok = safe_breadth >= breadth_needed
        available = eligible and breadth_ok
        reason = None
        if not eligible:
            reason = "Complete one Lotus Lesson and one Cue, Triage, and Stack practice session to enter Crisis Drills."
        elif not breadth_ok:
            noun = "family" if breadth_needed == 1 else "families"
            reason = f"Complete safe drills in {breadth_needed} emergency {noun} to unlock this case."
        catalog.append({
            "id": drill_id,
            "version": manifest["version"],
            "family": manifest["family"],
            "variantFamilyId": manifest["family"],
            "variant": manifest["variant"],
            "title": manifest["title"],
            "subtitle": manifest["subtitle"],
            "domain": manifest["domain"],
            "difficulty": manifest["difficulty"],
            "estimatedMinutes": manifest["estimatedMinutes"],
            "reviewed": True,
            "approved": True,
            "scenario": manifest["alert"],
            "availableModes": ["training", "crisis"],
            "available": available,
            "lockedReason": reason,
            "personalBest": (player.get("crisis_drill_drill_bests") or {}).get(drill_id),
            "completedCount": completed.get(drill_id, 0),
        })
    return catalog


async def _get_crisis_drill_player(player_id: str, session: Optional[str]) -> Dict[str, Any]:
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    return player


@api_router.get("/player/{player_id}/crisis-drills")
async def list_crisis_drills(player_id: str, x_clinica_session: Optional[str] = Header(default=None)):
    player = await _get_crisis_drill_player(player_id, x_clinica_session)
    catalog = crisis_drill_catalog(player)
    # Build family-grouped view for the board
    families: Dict[str, List[Dict[str, Any]]] = {}
    for item in catalog:
        families.setdefault(item["family"], []).append(item)
    recommendation = next(
        (item["id"] for item in catalog if item["available"] and not item["completedCount"]), None
    )
    return {
        "drills": catalog,
        "cases": catalog,
        "families": families,
        "recommended_id": recommendation,
        "gate": {
            "eligible": crisis_drill_eligible(player),
            "reason": None if crisis_drill_eligible(player) else "Complete one Lotus Lesson and one Cue, Triage, and Stack practice session to enter Crisis Drills.",
            "requiredPractice": {"lessons": 1, "cueLab": 1, "triage": 1, "stack": 1},
            "requiredLevel": 1,
        },
    }


@api_router.post("/player/{player_id}/crisis-drills/attempts")
async def start_crisis_drill(
    player_id: str,
    payload: CrisisDrillStartRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    player = await _get_crisis_drill_player(player_id, x_clinica_session)
    # Reconcile the durable completion outbox before opening another attempt.
    # This serializes per-player Crisis Drill grants, so a later completion
    # cannot be applied against an older receipt's stale daily/mastery snapshot.
    pending_grants = await db.crisis_drill_attempts.find(
        {
            "player_id": player_id,
            "completion": {"$exists": True},
            "grant_state": {"$ne": "applied"},
            "grant_plan": {"$exists": True},
        },
        {"_id": 0},
    ).sort("completed_at", ASCENDING).to_list(length=None)
    for pending_grant in pending_grants:
        await _apply_crisis_drill_grant(player_id, pending_grant, pending_grant["grant_plan"])
    if pending_grants:
        player = await _get_crisis_drill_player(player_id, x_clinica_session)
    if not crisis_drill_eligible(player):
        raise HTTPException(status_code=409, detail="Complete the University foundation practices before entering Crisis Drills")
    manifest = CRISIS_DRILL_CASES.get(payload.drill_id)
    if not manifest:
        raise HTTPException(status_code=422, detail="unknown reviewed Crisis Drill")
    if int(payload.drill_version) != int(manifest["version"]):
        raise HTTPException(status_code=409, detail="this crisis drill version has changed; refresh the drill board")
    selected = next((item for item in crisis_drill_catalog(player) if item["id"] == payload.drill_id), None)
    if not selected or not selected["available"]:
        raise HTTPException(status_code=409, detail=(selected or {}).get("lockedReason") or "this drill is not yet available")
    if payload.retry_mode == "guided" and not any(
        row.get("drillId") == payload.drill_id for row in (player.get("crisis_drill_history") or [])
    ):
        raise HTTPException(status_code=422, detail="guided review is available after you complete this drill once")

    # ── Stale-reservation cleanup (mirrors Grand Rounds exactly) ──
    active_id = player.get("crisis_drill_active_attempt_id")
    if active_id:
        active = await db.crisis_drill_attempts.find_one(
            {"attemptId": active_id, "player_id": player_id}, {"_id": 0}
        )
        if not active:
            stale_before = (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat()
            released = await db.players.update_one(
                {"id": player_id, "crisis_drill_active_attempt_id": active_id, "$or": [
                    {"crisis_drill_reservation_at": {"$lt": stale_before}},
                    {"crisis_drill_reservation_at": {"$exists": False}},
                ]},
                {"$set": {"crisis_drill_active_attempt_id": None, "crisis_drill_reservation_at": None, "updated_at": now_iso()}},
            )
            if released.modified_count != 1:
                raise HTTPException(status_code=409, detail="a Crisis Drill reservation is being created; retry shortly")
        else:
            if active.get("status") in {"active", "paused"}:
                raise HTTPException(status_code=409, detail=f"an active Crisis Drill is in progress; resume {active_id} before starting another")
            await db.players.update_one(
                {"id": player_id, "crisis_drill_active_attempt_id": active_id},
                {"$set": {"crisis_drill_active_attempt_id": None, "crisis_drill_reservation_at": None}},
            )

    # training mode is never ranked; crisis mode starts ranked but loses ranking
    # if paused or interrupted (pause sets ranked=False on the attempt).
    ranked = payload.mode == "crisis"
    attempt: Dict[str, Any] = {
        "attemptId": str(uuid.uuid4()),
        "player_id": player_id,
        "drillId": payload.drill_id,
        "version": manifest["version"],
        "family": manifest["family"],
        "variant": manifest["variant"],
        "difficulty": manifest["difficulty"],
        "mode": payload.mode,
        "beatId": "alert",          # first station in every drill
        "patient": {**manifest["initial"], "concern": manifest["concern"]},
        "known": [],
        "timeline": [],
        "responseIds": [],
        "timing_records": [],
        "safety": "safe",
        "status": "active",
        "ranked": ranked,
        "reviewMode": payload.retry_mode == "guided",
        "decision_started_at": now_iso(),
        "paused_at": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    # ── Atomic pointer reservation (mirrors Grand Rounds) ──
    reserved = await db.players.update_one(
        {"id": player_id, "$or": [
            {"crisis_drill_active_attempt_id": None},
            {"crisis_drill_active_attempt_id": {"$exists": False}},
        ]},
        {"$set": {
            "crisis_drill_active_attempt_id": attempt["attemptId"],
            "crisis_drill_reservation_at": now_iso(),
            "updated_at": now_iso(),
        }},
    )
    if reserved.modified_count != 1:
        current = await db.players.find_one({"id": player_id}, {"_id": 0, "crisis_drill_active_attempt_id": 1})
        raise HTTPException(status_code=409, detail=f"an active Crisis Drill is in progress; resume {(current or {}).get('crisis_drill_active_attempt_id')} before starting another")
    try:
        await db.crisis_drill_attempts.insert_one(attempt)
    except Exception:
        await db.players.update_one(
            {"id": player_id, "crisis_drill_active_attempt_id": attempt["attemptId"]},
            {"$set": {"crisis_drill_active_attempt_id": None, "crisis_drill_reservation_at": None, "updated_at": now_iso()}},
        )
        raise
    # Fence the insert
    fenced = await db.players.update_one(
        {"id": player_id, "crisis_drill_active_attempt_id": attempt["attemptId"]},
        {"$set": {"crisis_drill_reservation_at": None, "updated_at": now_iso()}},
    )
    if fenced.modified_count != 1:
        await db.crisis_drill_attempts.delete_one({"attemptId": attempt["attemptId"], "player_id": player_id})
        raise HTTPException(status_code=409, detail="the Crisis Drill reservation expired; retry the drill")
    return {"attempt": public_cd_attempt(attempt)}


@api_router.get("/player/{player_id}/crisis-drills/attempts/{attempt_id}")
async def get_crisis_drill_attempt(
    player_id: str, attempt_id: str, x_clinica_session: Optional[str] = Header(default=None),
):
    await _get_crisis_drill_player(player_id, x_clinica_session)
    attempt = await db.crisis_drill_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Crisis Drill attempt not found")
    return {"attempt": public_cd_attempt(attempt)}


@api_router.post("/player/{player_id}/crisis-drills/attempts/{attempt_id}/action")
async def submit_crisis_drill_decision(
    player_id: str,
    attempt_id: str,
    payload: CrisisDrillDecisionRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    await _get_crisis_drill_player(player_id, x_clinica_session)
    attempt = await db.crisis_drill_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Crisis Drill attempt not found")
    if attempt.get("status") != "active":
        raise HTTPException(status_code=409, detail="resume this drill before making a clinical decision")
    manifest = CRISIS_DRILL_CASES.get(attempt["drillId"])
    station = (manifest or {}).get("stations", {}).get(attempt.get("beatId"))
    response = (station or {}).get("responses", {}).get(payload.response_id)
    if not response:
        raise HTTPException(status_code=422, detail="that response is not legal at this decision beat")
    if payload.response_id in attempt.get("responseIds", []):
        raise HTTPException(status_code=409, detail="this beat response was already submitted")

    before, patient = dict(attempt["patient"]), dict(attempt["patient"])
    # The client never supplies a clock value.  Crisis efficiency is calculated
    # from the server's decision start timestamp; a slow safe response remains
    # clinically safe but records lower efficiency than a timely safe response.
    elapsed_seconds = 0
    if attempt.get("mode") == "crisis" and attempt.get("decision_started_at"):
        try:
            elapsed_seconds = max(
                0,
                int((datetime.now(timezone.utc) - datetime.fromisoformat(attempt["decision_started_at"])).total_seconds()),
            )
        except (TypeError, ValueError):
            elapsed_seconds = 45
    timed_out = elapsed_seconds > 45
    # A late response is recorded for the separate Crisis Efficiency metric
    # only. It must never change patient state, safety caps, mastery, or the
    # equal baseline reward for safe care.
    for key, value in response.get("delta", {}).items():
        patient[key] = max(0, min(100, int(patient.get(key, 0)) + int(value)))
    if patient["stability"] < 30:
        patient["acuity"] = "critical"
    elif patient["stability"] < 55:
        patient["acuity"] = "high"
    else:
        patient["acuity"] = "moderate"

    revealed_ids = response.get("reveal", [])
    existing = {item["id"] for item in attempt.get("known", [])}
    known = [*attempt.get("known", []), *[
        item for item in manifest["hidden"]
        if item["id"] in revealed_ids and item["id"] not in existing
    ]]

    delta = " · ".join(
        f"{key} {'+' if patient[key] > before[key] else ''}{patient[key] - before[key]}"
        for key in ("stability", "oxygenation", "perfusion") if patient[key] != before[key]
    ) or "no measurable patient-state change"
    timeline = [*attempt.get("timeline", []), {
        "responseId": payload.response_id,
        "beatId": attempt["beatId"],
        "announcement": response["announcement"],
        "stateDelta": delta,
        "knownIds": revealed_ids,
    }]
    next_beat = response.get("next")
    # An unsafe choice loses the crisis timing ranking
    ranked = bool(attempt.get("ranked")) and not response.get("unsafe")
    next_attempt = {
        **attempt,
        "patient": patient,
        "known": known,
        "timeline": timeline,
        "responseIds": [*attempt.get("responseIds", []), payload.response_id],
        # Timing records remain server-only. They are used for the separate
        # Crisis Efficiency debrief metric, never clinical mastery or rewards.
        "timing_records": [*attempt.get("timing_records", []), {
            "beatId": attempt["beatId"], "elapsedSeconds": elapsed_seconds, "timedOut": timed_out,
        }],
        "safety": "unsafe" if response.get("unsafe") else attempt.get("safety", "safe"),
        "ranked": ranked,
        "beatId": next_beat,
        "status": "completed" if next_beat is None else "active",
        "decision_started_at": now_iso() if next_beat is not None else attempt.get("decision_started_at"),
        "updated_at": now_iso(),
    }
    write = await db.crisis_drill_attempts.update_one(
        {"attemptId": attempt_id, "player_id": player_id, "status": "active",
         "beatId": attempt["beatId"], "responseIds": attempt.get("responseIds", [])},
        {"$set": next_attempt},
    )
    if write.modified_count != 1:
        raise HTTPException(status_code=409, detail="the drill state changed; reload before responding")
    return {"attempt": public_cd_attempt(next_attempt)}


@api_router.post("/player/{player_id}/crisis-drills/attempts/{attempt_id}/pause")
async def pause_crisis_drill(
    player_id: str, attempt_id: str, x_clinica_session: Optional[str] = Header(default=None),
):
    await _get_crisis_drill_player(player_id, x_clinica_session)
    # Pausing a crisis attempt permanently loses its timing ranking for this run.
    await db.crisis_drill_attempts.update_one(
        {"attemptId": attempt_id, "player_id": player_id, "status": "active"},
        {"$set": {"status": "paused", "ranked": False, "paused_at": now_iso(), "updated_at": now_iso()}},
    )
    attempt = await db.crisis_drill_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Crisis Drill attempt not found")
    return {"attempt": public_cd_attempt(attempt)}


@api_router.post("/player/{player_id}/crisis-drills/attempts/{attempt_id}/resume")
async def resume_crisis_drill(
    player_id: str, attempt_id: str, x_clinica_session: Optional[str] = Header(default=None),
):
    await _get_crisis_drill_player(player_id, x_clinica_session)
    await db.crisis_drill_attempts.update_one(
        {"attemptId": attempt_id, "player_id": player_id, "status": "paused"},
        # A pause is an accessibility/interruption boundary. Restart the
        # decision window after resuming so time spent paused cannot cause a
        # clinical deterioration; the run is already permanently unranked.
        {"$set": {"status": "active", "paused_at": None, "decision_started_at": now_iso(), "updated_at": now_iso()}},
    )
    attempt = await db.crisis_drill_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Crisis Drill attempt not found")
    return {"attempt": public_cd_attempt(attempt)}


@api_router.post("/player/{player_id}/crisis-drills/attempts/{attempt_id}/abandon")
async def abandon_crisis_drill(
    player_id: str, attempt_id: str, x_clinica_session: Optional[str] = Header(default=None),
):
    await _get_crisis_drill_player(player_id, x_clinica_session)
    await db.crisis_drill_attempts.update_one(
        {"attemptId": attempt_id, "player_id": player_id, "status": {"$in": ["active", "paused"]}},
        {"$set": {"status": "abandoned", "beatId": None, "updated_at": now_iso()}},
    )
    await db.players.update_one(
        {"id": player_id, "crisis_drill_active_attempt_id": attempt_id},
        {"$set": {"crisis_drill_active_attempt_id": None, "updated_at": now_iso()}},
    )
    current = await db.players.find_one({"id": player_id}, {"_id": 0})
    return {"player": Player(**current).model_dump()}


async def _apply_crisis_drill_grant(
    player_id: str, attempt: Dict[str, Any], plan: Dict[str, Any],
) -> None:
    """Serialize receipt recovery per player before applying the durable grant."""
    lock = CRISIS_DRILL_GRANT_LOCKS.setdefault(player_id, asyncio.Lock())
    async with lock:
        await _apply_crisis_drill_grant_unlocked(player_id, attempt, plan)


async def _apply_crisis_drill_grant_unlocked(
    player_id: str, attempt: Dict[str, Any], plan: Dict[str, Any],
) -> None:
    """Apply a persisted Crisis Drill receipt exactly once.

    Mongo runs locally as a standalone service, so this durable outbox pattern
    replaces a cross-document transaction: the immutable attempt receipt is
    written first, and this guarded player update can safely be retried after
    an interruption without duplicating XP, history, mastery, or daily credit.
    """
    grant_id = plan["grantId"]
    if plan.get("reviewMode"):
        await db.players.update_one(
            {"id": player_id, "crisis_drill_active_attempt_id": attempt["attemptId"]},
            {"$set": {"crisis_drill_active_attempt_id": None, "updated_at": now_iso()}},
        )
    else:
        # Merge receipt deltas into the current player record rather than
        # restoring a completion-time snapshot. This preserves progression when
        # several crash-recovered receipts are drained in sequence.
        current = await db.players.find_one({"id": player_id}, {"_id": 0}) or {}
        daily = dict(current.get("daily_rounds") or {})
        daily_ids = list(current.get("crisis_drill_daily_event_ids") or [])
        # Compatibility for receipts persisted before plans switched from
        # snapshots to deltas. Such a receipt already contains its intended
        # daily marker and its learner-facing mastery receipt.
        marker = plan.get("dailyMarker")
        legacy_markers = [
            value for value in plan.get("dailyIds", [])
            if isinstance(value, str) and value.endswith(":crisis-drill")
        ]
        if not marker and legacy_markers:
            marker = legacy_markers[-1]
        should_count_daily = bool(plan.get("countDaily")) or (
            "countDaily" not in plan and bool(marker)
        )
        if should_count_daily and marker and marker not in daily_ids:
            for objective in daily.get("objectives", []):
                if objective.get("event") == "university_lesson":
                    objective["progress"] = min(int(objective.get("target", 0)), int(objective.get("progress", 0)) + 1)
            for task in daily.get("weekly_tasks", []):
                if task.get("id") == "w_university":
                    task["progress"] = min(int(task.get("target", 0)), int(task.get("progress", 0)) + 1)
            daily_ids = [*daily_ids, marker][-365:]
        mastery_by_family = dict(current.get("crisis_drill_mastery_by_family") or {})
        mastery_delta = int(
            plan.get("masteryDelta", (attempt.get("completion") or {}).get("reward", {}).get("mastery", 0))
        )
        family = plan.get("family") or (plan.get("record") or {}).get("family")
        if mastery_delta and family:
            mastery_by_family[family] = min(100, int(mastery_by_family.get(family, 0)) + mastery_delta)
        await db.players.update_one(
            {"id": player_id, "crisis_drill_applied_grant_ids": {"$ne": grant_id}},
            {
                "$set": {
                    "daily_rounds": daily,
                    "crisis_drill_daily_event_ids": daily_ids,
                    "crisis_drill_mastery_by_family": mastery_by_family,
                    "crisis_drill_active_attempt_id": None,
                    "updated_at": now_iso(),
                },
                "$push": {
                    "crisis_drill_history": {"$each": [plan["record"]], "$slice": -60},
                    # This is a durable idempotency ledger, intentionally not
                    # truncated. A pending receipt may be replayed long after
                    # normal history retention, so expiring this marker could
                    # recreate an old reward after a crash boundary.
                    "crisis_drill_applied_grant_ids": grant_id,
                },
                "$max": {f"crisis_drill_drill_bests.{attempt['drillId']}": plan["score"]},
                "$inc": {"xp": plan["xp"], "university_credits": plan["credits"]},
            },
        )
    await db.crisis_drill_attempts.update_one(
        {"attemptId": attempt["attemptId"], "grant_id": grant_id},
        {"$set": {"grant_state": "applied", "grant_applied_at": now_iso()}},
    )


@api_router.post("/player/{player_id}/crisis-drills/attempts/{attempt_id}/complete")
async def complete_crisis_drill(
    player_id: str, attempt_id: str, x_clinica_session: Optional[str] = Header(default=None),
):
    player = await _get_crisis_drill_player(player_id, x_clinica_session)
    attempt = await db.crisis_drill_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Crisis Drill attempt not found")
    if attempt.get("completion"):
        # The receipt is durable before its player grant. If an interruption
        # leaves it pending, retry reconciles the exact persisted plan rather
        # than recomputing a potentially different first-clear reward.
        plan = attempt.get("grant_plan")
        if plan and attempt.get("grant_state") != "applied":
            await _apply_crisis_drill_grant(player_id, attempt, plan)
        current = await db.players.find_one({"id": player_id}, {"_id": 0})
        if current:
            await db.players.update_one(
                {"id": player_id, "xp": current.get("xp", 0)},
                {"$set": {"player_level": player_level_from_xp(int(current.get("xp", 0)))}},
            )
            current = await db.players.find_one({"id": player_id}, {"_id": 0})
        return {"player": Player(**(current or player)).model_dump(), "debrief": attempt["completion"], "already_completed": True}
    if attempt.get("status") != "completed" or attempt.get("beatId") is not None:
        raise HTTPException(status_code=409, detail="complete every decision beat before opening the debrief")

    # ── Atomic single-claim guard (mirrors Grand Rounds) ──
    claim_token = str(uuid.uuid4())
    stale_claim_before = (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat()
    claimed = await db.crisis_drill_attempts.update_one(
        {"attemptId": attempt_id, "completion": {"$exists": False}, "$or": [
            {"completion_claim": {"$exists": False}},
            {"completion_claimed_at": {"$lt": stale_claim_before}},
        ]},
        {"$set": {"completion_claim": claim_token, "completion_claimed_at": now_iso()}},
    )
    if claimed.modified_count != 1:
        for _ in range(40):
            pending = await db.crisis_drill_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
            if pending and pending.get("completion"):
                plan = pending.get("grant_plan")
                if plan and pending.get("grant_state") != "applied":
                    await _apply_crisis_drill_grant(player_id, pending, plan)
                current = await db.players.find_one({"id": player_id}, {"_id": 0})
                if current:
                    await db.players.update_one(
                        {"id": player_id, "xp": current.get("xp", 0)},
                        {"$set": {"player_level": player_level_from_xp(int(current.get("xp", 0)))}},
                    )
                    current = await db.players.find_one({"id": player_id}, {"_id": 0})
                return {"player": Player(**current).model_dump(), "debrief": pending["completion"], "already_completed": True}
            await asyncio.sleep(0.05)
        raise HTTPException(status_code=409, detail="Crisis Drill receipt is being finalized; retry to receive the canonical debrief")

    manifest = CRISIS_DRILL_CASES[attempt["drillId"]]
    patient = attempt["patient"]
    timeline = attempt.get("timeline", [])

    # ── Scoring ──
    # Max points per beat: 20 × 6 beats = 120 raw; normalize to 100.
    raw_score = round(sum(
        manifest["stations"][entry["beatId"]]["responses"][entry["responseId"]].get("points", 0)
        for entry in timeline
    ) / 1.2)
    raw_score = max(0, min(100, raw_score))
    unsafe = attempt.get("safety") == "unsafe" or int(patient["stability"]) < 30
    score = min(raw_score, 55) if unsafe else raw_score
    outcome = "unsafe" if unsafe else "excellent" if score >= 90 else "competent" if score >= 60 else "needs_review"
    patient_outcome = "deteriorated" if int(patient["stability"]) < 40 else "stabilized" if int(patient["stability"]) >= 65 else "guarded"
    timing_records = attempt.get("timing_records", [])
    crisis_efficiency = 0
    if attempt.get("mode") == "crisis" and timing_records and attempt.get("ranked"):
        on_time = sum(1 for item in timing_records if not item.get("timedOut"))
        crisis_efficiency = round((on_time / len(timing_records)) * 100)

    review_mode = bool(attempt.get("reviewMode"))
    history = list(player.get("crisis_drill_history") or [])
    first_clear = False
    if not review_mode and outcome in {"excellent", "competent"}:
        fc_path = f"crisis_drill_first_clear_claims.{attempt['drillId']}"
        fc_claim = await db.players.update_one(
            {"id": player_id, fc_path: {"$exists": False}},
            {"$set": {fc_path: attempt_id}},
        )
        first_clear = fc_claim.modified_count == 1
        if not first_clear:
            fc_current = await db.players.find_one({"id": player_id}, {"_id": 0, "crisis_drill_first_clear_claims": 1})
            first_clear = (fc_current or {}).get("crisis_drill_first_clear_claims", {}).get(attempt["drillId"]) == attempt_id

    completed_count = sum(1 for row in history if row.get("drillId") == attempt["drillId"])
    rewardable = outcome in {"excellent", "competent"} and not review_mode

    # Rewards mirror Grand Rounds baseline: first/repeat taper, same baseline mode.
    # training mode pays same rewards as crisis mode (mode affects ranking/daily event, not reward).
    xp, credits, mastery = (
        (25, 30, 4) if rewardable and first_clear
        else (3, 3, 1) if rewardable and completed_count < 2
        else (0, 0, 0)
    )
    reward_msg = (
        "Review mode pays no reward or progression." if review_mode
        else "A safety result needs review before rewards." if not rewardable
        else "First drill clear." if first_clear
        else "Repeat evidence is sharply tapered."
    )

    debrief = {
        "outcome": outcome,
        "patientOutcome": patient_outcome,
        "score": score,
        "safety": "unsafe" if unsafe else "safe",
        "ranked": bool(attempt.get("ranked")) and not review_mode,
        "crisisEfficiency": {
            "eligible": attempt.get("mode") == "crisis" and bool(attempt.get("ranked")) and not review_mode,
            "score": crisis_efficiency if attempt.get("mode") == "crisis" and bool(attempt.get("ranked")) and not review_mode else None,
            "note": "Prestige only — never changes clinical safety, mastery, or baseline rewards.",
        },
        "strongestDecision": (timeline[0]["announcement"] if timeline else "No completed clinical decision."),
        "missedOpportunity": (
            "Review the safety change and return through the related practice." if unsafe
            else "None — your reassessment closed the loop."
        ),
        "patientEvolution": f"Final stability {patient['stability']}, oxygenation {patient['oxygenation']}, perfusion {patient['perfusion']}.",
        # Public aliases consumed by the emergency board; no scoring keys or
        # unrevealed alternatives are included.
        "urgencyHandling": "missed" if unsafe else (
            "appropriate" if attempt.get("mode") == "training" or crisis_efficiency >= 70 else "delayed"
        ),
        "patientSummary": f"Patient outcome: {patient_outcome}. Final stability {patient['stability']}.",
        "clinicalPrinciple": manifest["principle"],
        "relatedPractice": manifest["relatedPractice"],
        "timeline": timeline,
        "firstClear": first_clear,
        "personalBest": not review_mode and score > int((player.get("crisis_drill_drill_bests") or {}).get(attempt["drillId"], -1)),
        "reward": {"xp": xp, "universityCredits": credits, "mastery": mastery, "message": reward_msg},
    }

    # ── Daily University event (exactly one per calendar day) ──
    daily = dict(player.get("daily_rounds") or {})
    daily_ids = list(player.get("crisis_drill_daily_event_ids") or [])
    daily_marker = f"{datetime.now(timezone.utc).date().isoformat()}:crisis-drill"
    # Training and Crisis have equal baseline progression.  A normal or
    # accessibility-paused Crisis attempt remains mastery/reward eligible;
    # pause only makes its timing prestige record unranked.
    count_daily = not review_mode and daily_marker not in daily_ids
    if count_daily:
        for objective in daily.get("objectives", []):
            if objective.get("event") == "university_lesson":
                objective["progress"] = min(int(objective.get("target", 0)), int(objective.get("progress", 0)) + 1)
        for task in daily.get("weekly_tasks", []):
            if task.get("id") == "w_university":
                task["progress"] = min(int(task.get("target", 0)), int(task.get("progress", 0)) + 1)
        daily_ids = [*daily_ids, daily_marker][-365:]

    record = {
        "attemptId": attempt_id,
        "drillId": attempt["drillId"],
        "family": manifest["family"],
        "variant": manifest["variant"],
        "score": score,
        "outcome": outcome,
        "safety": debrief["safety"],
        "ranked": debrief["ranked"],
        "completedAt": now_iso(),
    }
    mastery_by_family = dict(player.get("crisis_drill_mastery_by_family") or {})
    if mastery:
        mastery_by_family[manifest["family"]] = min(
            100, int(mastery_by_family.get(manifest["family"], 0)) + mastery
        )

    grant_plan = {
        "grantId": attempt_id,
        "reviewMode": review_mode,
        "xp": xp,
        "credits": credits,
        "score": score,
        "record": record,
        "dailyMarker": daily_marker,
        "countDaily": count_daily,
        "masteryDelta": mastery,
        "family": manifest["family"],
    }
    receipt_write = await db.crisis_drill_attempts.update_one(
        {"attemptId": attempt_id, "completion_claim": claim_token, "completion": {"$exists": False}},
        {"$set": {
            "completion": debrief,
            "grant_plan": grant_plan,
            "grant_id": attempt_id,
            "grant_state": "pending",
            "completed_at": now_iso(),
        }},
    )
    if receipt_write.modified_count != 1:
        persisted = await db.crisis_drill_attempts.find_one({"attemptId": attempt_id, "player_id": player_id}, {"_id": 0})
        if persisted and persisted.get("completion") and persisted.get("grant_plan"):
            await _apply_crisis_drill_grant(player_id, persisted, persisted["grant_plan"])
            current = await db.players.find_one({"id": player_id}, {"_id": 0})
            return {"player": Player(**current).model_dump(), "debrief": persisted["completion"], "already_completed": True}
        raise HTTPException(status_code=409, detail="Crisis Drill receipt is being finalized; retry to receive the canonical debrief")

    await _apply_crisis_drill_grant(player_id, attempt, grant_plan)
    current = await db.players.find_one({"id": player_id}, {"_id": 0})
    await db.players.update_one(
        {"id": player_id, "xp": current.get("xp", 0)},
        {"$set": {"player_level": player_level_from_xp(int(current.get("xp", 0)))}},
    )
    current = await db.players.find_one({"id": player_id}, {"_id": 0})
    receipt = await db.crisis_drill_attempts.find_one({"attemptId": attempt_id}, {"_id": 0, "completion": 1})
    return {
        "player": Player(**current).model_dump(),
        "debrief": (receipt or {}).get("completion") or debrief,
        "already_completed": False,
    }


@api_router.post("/player/{player_id}/activity-attempts/{activity}", response_model=Dict[str, Any])
async def begin_activity_attempt(
    player_id: str,
    activity: Literal["clinical_battle", "journey_treasure", "auto_sweep", "ward_defense", "university_practice", "world_event"],
    payload: ActivityAttemptRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Deprecated: generic client-created reward attempts are never trustworthy."""
    raise HTTPException(
        status_code=410,
        detail="generic activity attempts are retired; complete the activity through its server-owned route",
    )
    """
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    if activity in {"clinical_battle", "auto_sweep"}:
        required_cost = {"regular": 1, "elite": 2, "area_boss": 3, "major_boss": 5}[payload.tier]
        commitments = player.get("age1_stamina_commitments") or []
        commitment = next((c for c in reversed(commitments) if not c.get("consumed") and int(c.get("cost", 0)) == required_cost), None)
        if not commitment:
            raise HTTPException(status_code=409, detail="a matching Stamina commitment is required")
        updated_commitments = [
            {**c, "consumed": True} if c.get("id") == commitment.get("id") else c for c in commitments
        ]
        consumed = await db.players.update_one(
            {"id": player_id, "updated_at": player.get("updated_at")},
            {"$set": {"age1_stamina_commitments": updated_commitments, "updated_at": now_iso()}},
        )
        if consumed.modified_count != 1:
            raise HTTPException(status_code=409, detail="Stamina commitment changed; retry")
    attempt = {
        "id": str(uuid.uuid4()), "player_id": player_id, "activity": activity,
        "tier": payload.tier, "created_at": now_iso(), "claimed": False,
    }
    await db.activity_attempts.insert_one(attempt)
    return {"attempt_id": attempt["id"], "activity": activity, "tier": payload.tier}
    """


@api_router.post("/player/{player_id}/activity-attempts/{attempt_id}/claim", response_model=Dict[str, Any])
async def claim_activity_attempt(
    player_id: str,
    attempt_id: str,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Deprecated: generic client-created reward attempts are never trustworthy."""
    raise HTTPException(
        status_code=410,
        detail="generic activity claims are retired; complete the activity through its server-owned route",
    )
    """
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    attempt = await db.activity_attempts.find_one_and_update(
        {"id": attempt_id, "player_id": player_id, "claimed": False},
        {"$set": {"claimed": True, "claimed_at": now_iso()}},
        return_document=True,
    )
    if not attempt:
        raise HTTPException(status_code=409, detail="attempt already claimed or unavailable")
    tier = attempt["tier"]
    now = datetime.now(timezone.utc)
    day = age1_day_key(now)
    used = int(player.get("age1_reward_units", 0)) if player.get("age1_reward_day") == day else 0
    units = REPEAT_REWARD_UNITS[tier]
    multiplier = age1_reward_multiplier(used, units)
    base = REPEAT_ATTEMPT_REWARDS[tier]
    increments = {field: int(round(value * multiplier)) for field, value in base.items() if int(round(value * multiplier))}
    update: Dict[str, Any] = {
        "$set": {"age1_reward_day": day, "age1_reward_units": used + units, "updated_at": now_iso(),
                 "player_level": player_level_from_xp(int(player.get("xp", 0)) + int(increments.get("xp", 0)))},
    }
    if increments:
        update["$inc"] = increments
    write = await db.players.update_one({"id": player_id, "updated_at": player.get("updated_at")}, update)
    if write.modified_count != 1:
        # Do not leave an attempt permanently consumed if the player's state
        # changed concurrently; callers can retry against fresh state.
        await db.activity_attempts.update_one({"id": attempt_id}, {"$set": {"claimed": False}, "$unset": {"claimed_at": ""}})
        raise HTTPException(status_code=409, detail="player state changed; retry")
    refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
    return {"player": Player(**refreshed).model_dump(), "multiplier": multiplier, "units": units, "granted": increments}
    """


@api_router.post("/player/{player_id}/rewards/{activity}", response_model=Dict[str, Any])
async def grant_activity_reward(
    player_id: str,
    activity: Literal["clinical_battle", "journey_treasure", "auto_sweep", "ward_defense", "university_practice", "world_event"],
    payload: ActivityRewardGrant,
    x_clinica_session: Optional[str] = Header(default=None),
    x_clinica_economy_token: Optional[str] = Header(default=None),
):
    """Deprecated generic reward endpoint.

    Meaningful activity rewards must be derived by the activity's own
    server-owned completion route. A claim key supplied by a client is not
    evidence of a completed encounter.
    """
    raise HTTPException(
        status_code=410,
        detail="generic activity rewards are retired; use the activity's server-owned completion route",
    )
    if payload.activity != activity:
        raise HTTPException(status_code=422, detail="activity path and payload do not match")
    existing = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(existing, player_id, x_clinica_session or x_clinica_economy_token, None):
        raise HTTPException(status_code=401, detail="invalid player economy credential")
    if not payload.repeatable:
        content_key = (payload.claim_key or "").strip()
        if not content_key or len(content_key) > 160:
            raise HTTPException(status_code=422, detail="a content claim key is required")
        if activity == "ward_defense":
            # Ward Defense currently persists only its account-wide first-run
            # marker, not an authoritative per-run ID. Keep this bounded to
            # that one first-clear until the mode owns run records.
            content_key = "first_run"
        if activity == "journey_treasure":
            parts = content_key.split(":", 1)
            if len(parts) != 2 or not all(parts):
                raise HTTPException(status_code=422, detail="Journey treasure key must be run_id:tile_id")
            run = await db.journey_runs.find_one({"id": parts[0], "player_id": player_id}, {"_id": 0})
            if not run or not any(isinstance(tile, dict) and tile.get("id") == parts[1] and tile.get("rewardClaimed") for tile in run.get("tiles", [])):
                raise HTTPException(status_code=409, detail="Journey treasure has not been claimed in this run")
        if activity == "clinical_battle" and not content_key.replace("_", "").replace("-", "").isalnum():
            raise HTTPException(status_code=422, detail="invalid battle content key")
        if activity == "clinical_battle":
            if not payload.attempt_id:
                raise HTTPException(status_code=409, detail="a server-issued combat attempt is required")
            attempt = await db.activity_attempts.find_one_and_update(
                {"id": payload.attempt_id, "player_id": player_id,
                 "activity": "clinical_battle", "claimed": False},
                {"$set": {"claimed": True, "claimed_at": now_iso()}},
                return_document=True,
            )
            if not attempt:
                raise HTTPException(status_code=409, detail="combat attempt already claimed or unavailable")
        claim_key = f"{activity}:{content_key}"
        claimed_keys = existing.get("age1_claimed_reward_keys") or []
        if claim_key in claimed_keys:
            return {
                "player": Player(**existing).model_dump(),
                "multiplier": 0,
                "units": 0,
                "granted": {},
                "already_claimed": True,
            }
        increments = dict(FIRST_CLEAR_REWARDS[activity])
        commitment_update: Dict[str, Any] = {}
        if activity == "clinical_battle" and not payload.attempt_id:
            required_cost = {"regular": 1, "elite": 2, "area_boss": 3, "major_boss": 5}[payload.tier]
            commitments = existing.get("age1_stamina_commitments") or []
            commitment = next(
                (c for c in reversed(commitments) if not c.get("consumed") and int(c.get("cost", 0)) == required_cost),
                None,
            )
            if not commitment:
                raise HTTPException(status_code=409, detail="a matching Stamina commitment is required")
            commitment_update["age1_stamina_commitments"] = [
                {**c, "consumed": True} if c.get("id") == commitment.get("id") else c for c in commitments
            ]
        update = {
            "$inc": increments,
            "$addToSet": {"age1_claimed_reward_keys": claim_key},
            "$set": {"updated_at": now_iso(), **commitment_update,
                     "player_level": player_level_from_xp(int(existing.get("xp", 0)) + int(increments.get("xp", 0)))} ,
        }
        write = await db.players.update_one(
            {"id": player_id, "updated_at": existing.get("updated_at"),
             "age1_claimed_reward_keys": {"$ne": claim_key}},
            update,
        )
        if write.modified_count != 1:
            raise HTTPException(status_code=409, detail="reward claim changed; retry")
        refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
        return {"player": Player(**refreshed).model_dump(), "multiplier": 1, "units": 0, "granted": increments}

    raise HTTPException(status_code=410, detail="repeat rewards must use a server-issued attempt")


# Task 513 — Valid specialization IDs per class (mirrors classTree.ts CLASS_SPECIALIZATIONS).
# Kept in sync manually; the endpoint rejects any ID not in this map.
VALID_SPECIALIZATIONS: dict[str, list[str]] = {
    "guardian":  ["triage_commander", "intervention_specialist", "ward_shield"],
    "seer":      ["clinical_oracle", "mindweaver", "observer"],
    "caretaker": ["community_healer", "sanctuary", "lotus_recovery"],
    "scholar":   ["grand_archivist", "epidemic_warden", "research_lead"],
    "alchemist": ["lotus_pharmacist", "innovation_alchemist", "ward_artisan"],
    "medic":     ["code_calm_specialist", "field_commander", "adaptive_healer"],
}


class ClaimSpecializationRequest(BaseModel):
    specialization_id: str


class SelectClassRequest(BaseModel):
    class_id: str


class ClaimClassTierRequest(BaseModel):
    level: Literal[1, 10, 20, 30]


CLASS_TIER_REQUIREMENTS: dict[int, dict[str, int]] = {
    1: {},
    10: {"class_manuals": 1},
    20: {"knowledge_points": 30, "class_manuals": 1},
    30: {"ascension_seals": 1},
}


@api_router.post("/player/{player_id}/select-class", response_model=Player)
async def select_class(
    player_id: str,
    payload: SelectClassRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Persist the freely chosen Root Calling outside generic snapshots."""
    if payload.class_id not in VALID_SPECIALIZATIONS:
        raise HTTPException(status_code=422, detail="unknown class")
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    await db.players.update_one(
        {"id": player_id},
        {"$set": {"class_tree_id": payload.class_id, "updated_at": now_iso()}},
    )
    updated = await db.players.find_one({"id": player_id}, {"_id": 0})
    return Player(**updated)


@api_router.post("/player/{player_id}/class-tiers", response_model=Player)
async def claim_class_tier(
    player_id: str,
    payload: ClaimClassTierRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Atomically spend server-owned materials for one class-tier claim."""
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    class_id = player.get("class_tree_id")
    if class_id not in VALID_SPECIALIZATIONS:
        raise HTTPException(status_code=409, detail="select a Root Calling first")
    level = payload.level
    player_level = int(player.get("player_level") or player_level_from_xp(int(player.get("xp") or 0)))
    if player_level < level:
        raise HTTPException(status_code=409, detail=f"Player Level {level} is required")
    progress = (player.get("class_progress") or {}).get(class_id, [])
    previous = {10: 1, 20: 10, 30: 20}.get(level)
    if previous and previous not in progress:
        raise HTTPException(status_code=409, detail="claim the preceding class tier first")
    requirements = CLASS_TIER_REQUIREMENTS[level]
    query: Dict[str, Any] = {
        "id": player_id,
        f"class_progress.{class_id}": {"$ne": level},
    }
    for material, qty in requirements.items():
        query[f"inventory.{material}"] = {"$gte": qty}
    increments = {f"inventory.{material}": -qty for material, qty in requirements.items()}
    result = await db.players.update_one(
        query,
        {
            "$addToSet": {f"class_progress.{class_id}": level},
            "$inc": increments,
            "$set": {"updated_at": now_iso()},
        },
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="tier is already claimed or required materials are unavailable")
    updated = await db.players.find_one({"id": player_id}, {"_id": 0})
    return Player(**updated)


@api_router.post("/player/{player_id}/claim-specialization", response_model=Player)
async def claim_specialization(
    player_id: str,
    payload: ClaimSpecializationRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Atomically lock a class specialization after Lv30 is claimed.

    Guards enforced server-side (all validated before any write):
    - class_id derived from player.class_tree_id must be in VALID_SPECIALIZATIONS
    - specialization_id must be a valid id for that class
    - A single conditional $set write atomically verifies:
        * class_progress[class_id] contains 30  (Lv30 claimed)
        * class_specialization[class_id] does not already exist  (permanent lock)
      If either condition fails, the filter matches no document → 409 Conflict.
    Concurrent requests therefore cannot both succeed: the second write will find
    the field already set and return 409.
    """
    # Read once only to get class_tree_id and validate inputs before the write.
    doc = await db.players.find_one({"id": player_id}, {"_id": 0, "class_tree_id": 1, "economy_token": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(doc, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")

    class_id: str | None = doc.get("class_tree_id")
    if not class_id or class_id not in VALID_SPECIALIZATIONS:
        raise HTTPException(status_code=400, detail=f"No valid class active on this player (class_tree_id={class_id!r})")

    valid_ids = VALID_SPECIALIZATIONS[class_id]
    if payload.specialization_id not in valid_ids:
        raise HTTPException(
            status_code=400,
            detail=f"'{payload.specialization_id}' is not a valid specialization for class '{class_id}'. Valid: {valid_ids}"
        )

    # Single conditional write — the filter simultaneously enforces:
    #   1. Lv30 is in class_progress[class_id]
    #   2. class_specialization[class_id] has not been set yet
    # If the filter matches zero documents, either condition failed (or both).
    spec_field = f"class_specialization.{class_id}"
    result = await db.players.update_one(
        {
            "id": player_id,
            f"class_progress.{class_id}": 30,
            spec_field: {"$exists": False},
        },
        {"$set": {spec_field: payload.specialization_id, "updated_at": now_iso()}},
    )

    if result.matched_count == 0:
        # Either Lv30 not claimed, or specialization already set.
        # Re-read only to return a meaningful error message.
        current = await db.players.find_one({"id": player_id}, {"_id": 0, "class_progress": 1, "class_specialization": 1})
        if not current:
            raise HTTPException(status_code=404, detail="player not found")
        existing_spec = (current.get("class_specialization") or {}).get(class_id)
        if existing_spec:
            raise HTTPException(status_code=409, detail=f"Specialization already locked for '{class_id}': {existing_spec}")
        raise HTTPException(status_code=400, detail=f"Lv30 must be claimed for '{class_id}' before choosing a specialization")

    refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
    return Player(**refreshed)


@api_router.delete("/player/{player_id}")
async def delete_player(
    player_id: str,
    x_clinica_session: Optional[str] = Header(default=None),
):
    existing = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not existing:
        return {"deleted": 0}
    if not player_access_ok(existing, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    res = await db.players.delete_one({"id": player_id})
    return {"deleted": res.deleted_count}


# ── Journey Runs ─────────────────────────────────────────────────────────────
# journey_runs collection has a unique compound index:
#   (player_id, chapter_id, attempt_number)
# This prevents duplicate runs even under concurrent "Challenge Chapter" clicks.

class JourneyRunCreate(BaseModel):
    chapter_id:              int
    seed:                    str
    attempt_number:          int
    schema_version:          int            = 2   # bumped at Push 4
    tile_count:              int
    tiles:                   List[Any]      # opaque JSON, validated client-side
    start_tile_id:           str
    current_tile_id:         str
    gate_anchor_tile_id:     Optional[str]  = None
    area_boss_count:          int
    inherited_area_boss_keys: int           = 0
    area_boss_keys_collected: int           = 0
    chapter_boss_defeated:   bool           = False
    explored_tile_count:     int            = 0
    explored_tile_ids:       List[str]      = []
    stamina_spent:           int            = 0
    # Push 4 canonical fields
    shift:                   Optional[str]  = None   # 'day' | 'evening' | 'night'
    call_team:               List[str]      = []
    cards:                   List[Any]      = []
    blessings:               List[Any]      = []
    pressure:                float          = 0.0
    # Push 2 map identity — set at creation, never mutated.
    # mapLayoutVersion: 'v1' (blueprint), 'authored', 'procedural', 'legacy'
    # mapBlueprintHash: 8-char hex fingerprint of tile footprint
    # topologyFamily:   DNA topology family (e.g. 'academic_quad'); absent for non-blueprint
    map_layout_version:      str            = "legacy"
    map_blueprint_hash:      str            = ""
    topology_family:         Optional[str]  = None


class JourneyRunSave(BaseModel):
    tiles:                    List[Any]
    current_tile_id:          str
    area_boss_keys_collected: Optional[int]   = None
    chapter_boss_defeated:    Optional[bool]  = None
    explored_tile_count:      Optional[int]       = None
    explored_tile_ids:        Optional[List[str]] = None
    stamina_spent:            Optional[int]       = None
    # Push 4 canonical mutable fields
    call_team:                Optional[List[str]] = None
    cards:                    Optional[List[Any]] = None
    blessings:                Optional[List[Any]] = None
    pressure:                 Optional[float]     = None


def _server_merchant_inventory(seed: str, tile_id: str, chapter_id: int) -> list[dict[str, Any]]:
    pool = [("Lab Token", 1, 18), ("Training Scroll", 1, 24), ("Insight Crystal", 1, 30),
            ("Stabilising Poultice", 2, 16), ("Chain Catalyst", 1, 36), ("Restoration Salve", 2, 22)]
    digest = hashlib.sha256(f"{seed}:merchant:{tile_id}:{chapter_id}".encode()).digest()
    scale = 1 + max(0, chapter_id - 5) * 0.12
    stock = [{"id": f"stock-{i}", "name": pool[(digest[i] + i) % len(pool)][0],
              "quantity": pool[(digest[i] + i) % len(pool)][1],
              "price": int(round(pool[(digest[i] + i) % len(pool)][2] * scale)),
              "rarity": "rare" if i == 5 else "common", "sold": False} for i in range(6)]
    roll = int.from_bytes(digest[8:10], "big") % 1000
    if roll == 0:
        stock[-1] = {"id": "ultra-fragment", "name": "Covenant Skill Fragment", "quantity": 1, "price": int(round(180 * scale)), "rarity": "ultra", "sold": False}
    elif roll == 1:
        stock[-1] = {"id": "ultra-ticket", "name": "Night Market Ticket", "quantity": 1, "price": int(round(300 * scale)), "rarity": "ultra", "sold": False}
    return stock


_HEX_STEPS = ((1, 0), (-1, 0), (0, 1), (0, -1), (1, -1), (-1, 1))


def _journey_neighbors(tile: Dict[str, Any]) -> set[tuple[int, int]]:
    q, r = int(tile["q"]), int(tile["r"])
    return {(q + dq, r + dr) for dq, dr in _HEX_STEPS}


def _server_owned_journey_tiles(payload: JourneyRunCreate) -> tuple[list[dict[str, Any]], str]:
    """Freeze a valid client-rendered footprint, but derive all reward-bearing
    encounters and progress from server data before it is persisted."""
    raw = payload.tiles
    if len(raw) < 8 or len(raw) != payload.tile_count:
        raise HTTPException(status_code=422, detail="invalid journey tile count")
    tiles: list[dict[str, Any]] = []
    seen: set[tuple[int, int]] = set()
    merchant_used = False
    for value in raw:
        if not isinstance(value, dict) or not isinstance(value.get("id"), str):
            raise HTTPException(status_code=422, detail="invalid journey tile")
        q, r = value.get("q"), value.get("r")
        if not isinstance(q, int) or not isinstance(r, int) or (q, r) in seen:
            raise HTTPException(status_code=422, detail="invalid journey topology")
        seen.add((q, r))
        # Preserve ordinary authored encounters. Reward-bearing boss placement
        # is server-owned below, so a save cannot introduce an Area/Chapter Boss.
        encounter = value.get("encounter")
        if encounter not in {"battle", "treasure", "wardEvent", "merchant"}:
            encounter = "none"
        elif encounter == "merchant" and (payload.chapter_id < 5 or merchant_used):
            encounter = "none"
        elif encounter == "merchant":
            merchant_used = True
        tiles.append({"id": value["id"], "q": q, "r": r,
                      "zoneType": value.get("zoneType"), "clearingId": value.get("clearingId"),
                      "visualVariant": value.get("visualVariant"), "encounter": encounter,
                      # Generated client-side from a deterministic run namespace.
                      # Freeze it with the tile so reopening the merchant cannot reroll.
                      "merchantInventory": _server_merchant_inventory(payload.seed, value["id"], payload.chapter_id) if encounter == "merchant" else None,
                      "isElite": bool(value.get("isElite")) if encounter == "battle" else None,
                      "chestTier": value.get("chestTier") if encounter == "treasure" and value.get("chestTier") in {"bronze", "silver", "gold"} else "bronze",
                      "visibility": "unexplored", "visited": False, "resolved": False,
                      "rewardClaimed": False, "areaBossKeyClaimed": False})
    start = next((tile for tile in tiles if tile["id"] == payload.start_tile_id), None)
    if not start:
        raise HTTPException(status_code=422, detail="journey start tile is invalid")
    # The furthest tile is the server-owned gate. Ties are deterministic.
    def distance(tile: dict[str, Any]) -> tuple[int, str]:
        return (abs(tile["q"] - start["q"]) + abs(tile["r"] - start["r"]) + abs((tile["q"] + tile["r"]) - (start["q"] + start["r"])), tile["id"])
    gate = max(tiles, key=distance)
    gate["encounter"], gate["isGate"] = "boss", True
    candidates = [tile for tile in tiles if tile is not start and tile is not gate]
    ranked = sorted(candidates, key=lambda tile: hashlib.sha256(f"{payload.seed}:{tile['id']}".encode()).hexdigest())
    for tile in ranked[:min(3, len(ranked))]:
        tile["encounter"] = "areaBoss"
    start["visibility"], start["visited"] = "visibleNow", True
    return tiles, gate["id"]


@api_router.get("/player/{player_id}/journey-runs/{chapter_id}/active")
async def get_active_journey_run(player_id: str, chapter_id: int, x_clinica_session: Optional[str] = Header(default=None)):
    """Return the current active run for this player+chapter, or 404.

    Sorted by attempt_number DESC so that if more than one active run ever
    exists (e.g. from a partial Rechallenge Map transition where the new run
    was created before the old one was abandoned), the highest-attempt run is
    always returned — ensuring the player never sees stale map state.
    """
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player or not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    if chapter_id > int(player.get("chapter_progress", 1)):
        raise HTTPException(status_code=403, detail="chapter is not unlocked")
    cursor = (
        db.journey_runs
        .find({"player_id": player_id, "chapter_id": chapter_id, "status": "active"}, {"_id": 0})
        .sort("attempt_number", DESCENDING)
        .limit(1)
    )
    docs = await cursor.to_list(length=1)
    if not docs:
        raise HTTPException(status_code=404, detail="no active run")
    return docs[0]


@api_router.get("/player/{player_id}/journey-runs/{chapter_id}/latest")
async def get_latest_journey_run(player_id: str, chapter_id: int, x_clinica_session: Optional[str] = Header(default=None)):
    """Return the most recent run (any status, including 'abandoned') for this player+chapter, or 404.

    Intentionally includes 'abandoned' runs so that the frontend recovery path in
    loadOrCreateJourneyRun can detect the stuck state produced when rechallengeMap
    succeeds in archiving the old run (step 1) but fails before creating the new
    run (step 2).  On next load, getLatestRun returns the abandoned run, and
    loadOrCreateJourneyRun calls createRechallengeRun to complete the transition.

    If abandoned runs were filtered here, that recovery path would be unreachable:
    getLatestRun would return null and the frontend would call createFirstRun
    (attempt #1), which would 409 because earlier attempts are still in the DB.
    """
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player or not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    cursor = (
        db.journey_runs
        .find({"player_id": player_id, "chapter_id": chapter_id}, {"_id": 0})
        .sort("attempt_number", DESCENDING)
        .limit(1)
    )
    docs = await cursor.to_list(length=1)
    if not docs:
        raise HTTPException(status_code=404, detail="no runs found")
    return docs[0]


@api_router.post("/player/{player_id}/journey-runs")
async def create_journey_run(player_id: str, payload: JourneyRunCreate, x_clinica_session: Optional[str] = Header(default=None)):
    """Create a new run (attempt #1 or challenge).
    Idempotent: the unique compound index (player_id, chapter_id, attempt_number)
    catches any concurrent duplicate — the handler returns the existing run
    rather than raising a 5xx.
    """
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player or not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    run_id = str(uuid.uuid4())
    now    = now_iso()
    tiles, gate_id = _server_owned_journey_tiles(payload)
    doc    = {
        "id":         run_id,
        "player_id":  player_id,
        "status":     "active",
        "created_at": now,
        "updated_at": now,
        **payload.model_dump(exclude={"tiles", "gate_anchor_tile_id", "current_tile_id",
                                      "area_boss_keys_collected", "chapter_boss_defeated",
                                      "explored_tile_count", "explored_tile_ids", "stamina_spent"}),
        "tiles": tiles, "gate_anchor_tile_id": gate_id, "current_tile_id": payload.start_tile_id,
        "area_boss_keys_collected": 0, "chapter_boss_defeated": False,
        "explored_tile_count": 1, "explored_tile_ids": [payload.start_tile_id], "stamina_spent": 0,
    }
    try:
        await db.journey_runs.insert_one(doc)
    except DuplicateKeyError:
        # Race: another request already created this attempt. Return it.
        existing = await db.journey_runs.find_one(
            {
                "player_id":      player_id,
                "chapter_id":     payload.chapter_id,
                "attempt_number": payload.attempt_number,
            },
            {"_id": 0},
        )
        if existing:
            return existing
        raise HTTPException(status_code=409, detail="duplicate run, refetch failed")
    doc.pop("_id", None)
    return doc


@api_router.put("/journey-runs/{run_id}")
async def save_journey_run(run_id: str, payload: JourneyRunSave, x_clinica_session: Optional[str] = Header(default=None)):
    """Persist updated mutable run state (tiles, position, keys, etc.)."""
    run = await db.journey_runs.find_one({"id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    player = await db.players.find_one({"id": run["player_id"]}, {"_id": 0})
    if not player or not player_access_ok(player, run["player_id"], x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    frozen_tiles = run.get("tiles", [])
    incoming = payload.tiles
    if len(incoming) != len(frozen_tiles):
        raise HTTPException(status_code=422, detail="journey topology is immutable")
    frozen_by_id = {tile.get("id"): tile for tile in frozen_tiles if isinstance(tile, dict)}
    incoming_by_id = {tile.get("id"): tile for tile in incoming if isinstance(tile, dict)}
    if set(frozen_by_id) != set(incoming_by_id):
        raise HTTPException(status_code=422, detail="journey tile set is immutable")
    current = frozen_by_id.get(run.get("current_tile_id"))
    destination = frozen_by_id.get(payload.current_tile_id)
    if not current or not destination or (
        payload.current_tile_id != run.get("current_tile_id")
        and (destination["q"], destination["r"]) not in _journey_neighbors(current)
    ):
        raise HTTPException(status_code=409, detail="Journey movement must be adjacent")
    # Preserve the frozen topology and encounter assignment. A client may
    # report visual fog, but only the adjacent movement it just proved can add
    # a visited tile. This prevents a forged explored count from influencing
    # Player Hero development rolls.
    server_visited = {tile_id for tile_id, tile in frozen_by_id.items() if tile.get("visited")}
    server_visited.update({run.get("current_tile_id"), payload.current_tile_id})
    merged_tiles: list[dict[str, Any]] = []
    for tile_id, frozen in frozen_by_id.items():
        candidate = incoming_by_id[tile_id]
        if candidate.get("q") != frozen.get("q") or candidate.get("r") != frozen.get("r") or candidate.get("encounter") != frozen.get("encounter"):
            raise HTTPException(status_code=422, detail="journey encounters are immutable")
        merged = dict(frozen)
        merged["visibility"] = candidate.get("visibility", frozen.get("visibility"))
        merged["visited"] = tile_id in server_visited
        # A chest can only be resolved while standing on that server-owned
        # treasure tile. Other encounter/reward flags remain immutable.
        if (frozen.get("encounter") == "treasure"
                and tile_id == payload.current_tile_id
                and candidate.get("rewardClaimed") is True):
            merged["rewardClaimed"] = True
            merged["resolved"] = True
        merged_tiles.append(merged)
    updates: Dict[str, Any] = {
        "tiles": merged_tiles, "current_tile_id": payload.current_tile_id,
        "explored_tile_count": len(server_visited),
        "explored_tile_ids": sorted(server_visited),
        "call_team": payload.call_team, "cards": payload.cards, "blessings": payload.blessings, "pressure": payload.pressure,
    }
    updates = {key: value for key, value in updates.items() if value is not None}
    updates["updated_at"] = now_iso()
    result = await db.journey_runs.update_one({"id": run_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="run not found")
    doc = await db.journey_runs.find_one({"id": run_id}, {"_id": 0})
    return doc


class ClaimAreaBossKeyRequest(BaseModel):
    chapter_id: int
    tile_id: str


class JourneyChapterBossCompletionRequest(BaseModel):
    tile_id: str


class JourneyAreaBossCompletionRequest(BaseModel):
    chapter_id: int
    tile_id: str


class JourneyMerchantPurchaseRequest(BaseModel):
    tile_id: str
    stock_id: str


CHAPTER_BOSS_FIRST_CLEAR_REWARD = {"xp": 250, "crowns": 80, "codex_shards": 100}
WORLD_BOSS_FIRST_CLEAR_REWARD = {
    "xp": 500, "crowns": 300, "codex_shards": 200,
    "epidemic_tokens": 5000,
}
WORLD_BOSS_PHASE_III_THRESHOLD = 2500


@api_router.post("/player/{player_id}/world-event/verdantha/completion")
async def complete_verdantha(
    player_id: str,
    x_clinica_session: Optional[str] = Header(default=None),
):
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    if int(player.get("epidemic_tokens", 0)) < WORLD_BOSS_PHASE_III_THRESHOLD:
        raise HTTPException(status_code=409, detail="Verdantha is locked until Phase III")
    if "verdantha" in (player.get("bosses_defeated") or []):
        return {"already_completed": True, "player": Player(**player).model_dump(), "granted": {}}
    commitments = player.get("age1_stamina_commitments") or []
    commitment = next((c for c in reversed(commitments) if not c.get("consumed") and int(c.get("cost", 0)) == 5), None)
    if not commitment:
        raise HTTPException(status_code=409, detail="a World Boss Stamina commitment is required")
    consumed_commitments = [
        {**c, "consumed": True} if c.get("id") == commitment.get("id") else c for c in commitments
    ]
    update = {
        "$inc": {
            **WORLD_BOSS_FIRST_CLEAR_REWARD,
            "inventory.Verdanthite": 5,
            "inventory.Verdantha's Core": 1,
        },
        "$addToSet": {
            "bosses_defeated": "verdantha",
            "owned_titles": "verdantha_slayer",
            "owned_skins": "bloom_ward",
        },
        "$set": {"updated_at": now_iso(), "age1_stamina_commitments": consumed_commitments},
    }
    changed = await db.players.update_one(
        {"id": player_id, "bosses_defeated": {"$ne": "verdantha"}, "updated_at": player.get("updated_at")}, update,
    )
    if changed.modified_count != 1:
        current = await db.players.find_one({"id": player_id}, {"_id": 0})
        return {"already_completed": True, "player": Player(**current).model_dump(), "granted": {}}
    current = await db.players.find_one({"id": player_id}, {"_id": 0})
    return {
        "already_completed": False, "player": Player(**current).model_dump(),
        "granted": {**WORLD_BOSS_FIRST_CLEAR_REWARD, "inventory.Verdanthite": 5, "inventory.Verdantha's Core": 1},
    }


@api_router.post("/player/{player_id}/journey-runs/{run_id}/chapter-boss-completion")
async def complete_journey_chapter_boss(
    player_id: str,
    run_id: str,
    payload: JourneyChapterBossCompletionRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Commit one chapter-boss first clear from the persisted Journey gate.

    The UI may still run tactical combat locally, but it cannot select the
    reward, unlock a boss without the three persisted keys, or claim the same
    active run twice.
    """
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    run = await db.journey_runs.find_one({"id": run_id, "player_id": player_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="journey run not found")
    if int(run.get("chapter_id", 1)) > int(player.get("chapter_progress", 1)):
        raise HTTPException(status_code=403, detail="chapter is not unlocked")
    if run.get("chapter_boss_defeated") or run.get("status") == "cleared":
        # Reconcile a prior interrupted completion before returning its
        # idempotent response: once cleared, the run is the permanent roll key.
        opportunity = await resolve_player_hero_journey_opportunity(player, run)
        current = await db.players.find_one({"id": player_id}, {"_id": 0}) if opportunity else player
        return {
            "already_completed": True,
            "run": run,
            "player": Player(**current).model_dump(),
            "granted": {},
            "player_hero_opportunity": opportunity,
        }
    commitments = player.get("age1_stamina_commitments") or []
    commitment = next((c for c in reversed(commitments) if not c.get("consumed") and int(c.get("cost", 0)) == 5), None)
    if not commitment:
        raise HTTPException(status_code=409, detail="a Chapter Boss Stamina commitment is required")
    if run.get("status") != "active":
        raise HTTPException(status_code=409, detail="journey run is not active")
    gate_id = run.get("gate_anchor_tile_id")
    if not gate_id or payload.tile_id != gate_id:
        raise HTTPException(status_code=422, detail="chapter boss must be completed at this run's gate")
    current_tile = next(
        (t for t in run.get("tiles", [])
         if isinstance(t, dict) and t.get("id") == run.get("current_tile_id")),
        None,
    )
    gate_tile = next(
        (t for t in run.get("tiles", [])
         if isinstance(t, dict) and t.get("id") == gate_id),
        None,
    )
    if not current_tile or not gate_tile or (
        gate_tile.get("q"), gate_tile.get("r")
    ) not in _journey_neighbors(current_tile):
        raise HTTPException(status_code=409, detail="move adjacent to the chapter boss gate before completing it")
    tile = next((t for t in run.get("tiles", []) if isinstance(t, dict) and t.get("id") == gate_id), None)
    if not tile or not (tile.get("isGate") or tile.get("encounter") in {"gate", "boss"}):
        raise HTTPException(status_code=422, detail="run has no valid chapter boss gate")
    chapter_key = str(run.get("chapter_id"))
    keys = ((player.get("chapter_boss_keys") or {}).get(chapter_key) or {}).get("keys_collected", 0)
    if int(keys) < 3:
        raise HTTPException(status_code=409, detail="three chapter boss keys are required")
    transitioned = await db.journey_runs.update_one(
        {"id": run_id, "player_id": player_id, "status": "active", "chapter_boss_defeated": False},
        {"$set": {"status": "cleared", "chapter_boss_defeated": True, "updated_at": now_iso()}},
    )
    if transitioned.modified_count != 1:
        raise HTTPException(status_code=409, detail="chapter boss completion changed; retry")
    consumed_commitments = [
        {**c, "consumed": True} if c.get("id") == commitment.get("id") else c for c in commitments
    ]
    boss_marker = f"journey_chapter_{chapter_key}"
    reward_write = await db.players.update_one(
        {"id": player_id, "bosses_defeated": {"$ne": boss_marker}},
        {
            "$inc": CHAPTER_BOSS_FIRST_CLEAR_REWARD,
            "$addToSet": {"bosses_defeated": boss_marker},
            "$set": {"updated_at": now_iso(), "age1_stamina_commitments": consumed_commitments,
                     f"chapter_boss_keys.{chapter_key}": {"keys_collected": 0, "claimed_tile_ids": []}},
        },
    )
    if reward_write.modified_count != 1:
        # Replays are valid Journey completions but never pay a second
        # chapter-first-clear reward. Clear their temporary keys separately.
        await db.players.update_one(
            {"id": player_id},
            {"$set": {"updated_at": now_iso(), "age1_stamina_commitments": consumed_commitments,
                      f"chapter_boss_keys.{chapter_key}": {"keys_collected": 0, "claimed_tile_ids": []}}},
        )
    refreshed_player = await db.players.find_one({"id": player_id}, {"_id": 0})
    refreshed_run = await db.journey_runs.find_one({"id": run_id}, {"_id": 0})
    opportunity = await resolve_player_hero_journey_opportunity(refreshed_player, refreshed_run)
    if opportunity:
        refreshed_player = await db.players.find_one({"id": player_id}, {"_id": 0})
    return {
        "already_completed": False,
        "run": refreshed_run,
        "player": Player(**refreshed_player).model_dump(),
        "granted": CHAPTER_BOSS_FIRST_CLEAR_REWARD if reward_write.modified_count == 1 else {},
        "player_hero_opportunity": opportunity,
    }


@api_router.post("/player/{player_id}/journey-runs/{run_id}/area-boss-completion")
async def complete_journey_area_boss(
    player_id: str,
    run_id: str,
    payload: JourneyAreaBossCompletionRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    commitments = player.get("age1_stamina_commitments") or []
    commitment = next((c for c in reversed(commitments) if not c.get("consumed") and int(c.get("cost", 0)) == 3), None)
    if not commitment:
        raise HTTPException(status_code=409, detail="an Area Boss Stamina commitment is required")
    run = await db.journey_runs.find_one({"id": run_id, "player_id": player_id}, {"_id": 0})
    if not run or run.get("chapter_id") != payload.chapter_id:
        raise HTTPException(status_code=404, detail="journey run not found")
    if int(run.get("chapter_id", 1)) > int(player.get("chapter_progress", 1)):
        raise HTTPException(status_code=403, detail="chapter is not unlocked")
    tile_index = next(
        (i for i, tile in enumerate(run.get("tiles", []))
         if isinstance(tile, dict) and tile.get("id") == payload.tile_id),
        None,
    )
    if tile_index is None:
        raise HTTPException(status_code=422, detail="area boss tile is not in this run")
    tile = run["tiles"][tile_index]
    if tile.get("encounter") != "areaBoss":
        raise HTTPException(status_code=422, detail="tile is not an area boss")
    if run.get("current_tile_id") != payload.tile_id:
        raise HTTPException(status_code=409, detail="move to the Area Boss tile before completing it")
    if tile.get("areaBossKeyClaimed") or tile.get("resolved"):
        key_state = (player.get("chapter_boss_keys") or {}).get(str(payload.chapter_id), {})
        return {"already_completed": True, "run": run, "chapter_key_state": key_state}
    if run.get("status") != "active":
        raise HTTPException(status_code=409, detail="journey run is not active")
    path = f"tiles.{tile_index}"
    changed = await db.journey_runs.update_one(
        {"id": run_id, "player_id": player_id, "status": "active",
         f"{path}.areaBossKeyClaimed": {"$ne": True},
         f"{path}.resolved": {"$ne": True}},
        {"$set": {f"{path}.areaBossKeyClaimed": True, f"{path}.resolved": True,
                  f"{path}.rewardClaimed": True, "updated_at": now_iso()},
         "$inc": {"area_boss_keys_collected": 1}},
    )
    if changed.modified_count != 1:
        latest = await db.journey_runs.find_one({"id": run_id}, {"_id": 0})
        key_state = (player.get("chapter_boss_keys") or {}).get(str(payload.chapter_id), {})
        return {"already_completed": True, "run": latest, "chapter_key_state": key_state}
    consumed_commitments = [
        {**c, "consumed": True} if c.get("id") == commitment.get("id") else c for c in commitments
    ]
    await db.players.update_one(
        {"id": player_id},
        {"$set": {"age1_stamina_commitments": consumed_commitments, "updated_at": now_iso()}},
    )
    claim_id = f"{run_id}:{payload.tile_id}"
    chapter_key = str(payload.chapter_id)
    old_state = (player.get("chapter_boss_keys") or {}).get(chapter_key, {})
    old_ids = old_state.get("claimed_tile_ids") or []
    if claim_id not in old_ids:
        new_ids = [*old_ids, claim_id]
        await db.players.update_one(
            {"id": player_id},
            {"$set": {
                f"chapter_boss_keys.{chapter_key}": {
                    "claimed_tile_ids": new_ids,
                    "keys_collected": min(3, len(new_ids)),
                },
                "updated_at": now_iso(),
            }},
        )
    refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
    latest = await db.journey_runs.find_one({"id": run_id}, {"_id": 0})
    return {
        "already_completed": False,
        "run": latest,
        "chapter_key_state": (refreshed.get("chapter_boss_keys") or {}).get(chapter_key, {}),
    }


@api_router.post("/player/{player_id}/claim-area-boss-key")
async def claim_area_boss_key(player_id: str, payload: ClaimAreaBossKeyRequest):
    """Retired: Area Boss keys are committed only by area-boss-completion."""
    raise HTTPException(status_code=410, detail="use the authenticated area-boss completion route")


@api_router.post("/player/{player_id}/journey-runs/{run_id}/merchant-purchase")
async def purchase_journey_merchant_stock(
    player_id: str,
    run_id: str,
    payload: JourneyMerchantPurchaseRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Atomically buy one frozen merchant slot; prices and grants come from the run."""
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player or not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    run = await db.journey_runs.find_one({"id": run_id, "player_id": player_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="journey run not found")
    tile_index = next((i for i, t in enumerate(run.get("tiles", [])) if t.get("id") == payload.tile_id), None)
    if tile_index is None or run["tiles"][tile_index].get("encounter") != "merchant":
        raise HTTPException(status_code=422, detail="merchant tile is not in this run")
    stock = run["tiles"][tile_index].get("merchantInventory") or []
    stock_index = next((i for i, item in enumerate(stock) if item.get("id") == payload.stock_id and not item.get("sold")), None)
    if stock_index is None:
        raise HTTPException(status_code=409, detail="merchant stock is unavailable")
    item = stock[stock_index]
    price, quantity, name = int(item.get("price", 0)), int(item.get("quantity", 0)), str(item.get("name", ""))
    if price < 0 or quantity <= 0 or not name:
        raise HTTPException(status_code=422, detail="invalid merchant stock")
    increment = {f"inventory.{name}": quantity}
    updates: dict[str, Any] = {"updated_at": now_iso()}
    if name == "Night Market Ticket":
        updates["night_market_unlocked"] = True
    stock[stock_index] = {**item, "sold": True}
    consumed = await db.journey_runs.update_one(
        {"id": run_id, "player_id": player_id, f"tiles.{tile_index}.merchantInventory.{stock_index}.sold": {"$ne": True}},
        {"$set": {f"tiles.{tile_index}.merchantInventory": stock, "updated_at": now_iso()}},
    )
    if consumed.modified_count != 1:
        raise HTTPException(status_code=409, detail="merchant stock is unavailable")
    paid = await db.players.update_one(
        {"id": player_id, "crowns": {"$gte": price}},
        {"$inc": {"crowns": -price, **increment}, "$set": updates},
    )
    if paid.modified_count != 1:
        await db.journey_runs.update_one({"id": run_id, f"tiles.{tile_index}.merchantInventory.{stock_index}.sold": True}, {"$set": {f"tiles.{tile_index}.merchantInventory.{stock_index}.sold": False}})
        raise HTTPException(status_code=409, detail="not enough Crowns")
    fresh_player = await db.players.find_one({"id": player_id}, {"_id": 0})
    fresh_run = await db.journey_runs.find_one({"id": run_id}, {"_id": 0})
    return {"player": Player(**fresh_player).model_dump(), "run": fresh_run}


@api_router.patch("/journey-runs/{run_id}/cleared")
async def mark_run_cleared(run_id: str, x_clinica_session: Optional[str] = Header(default=None)):
    """Transition run status from 'active' to 'cleared'."""
    run = await db.journey_runs.find_one({"id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    player = await db.players.find_one({"id": run["player_id"]}, {"_id": 0})
    if not player or not player_access_ok(player, run["player_id"], x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    result = await db.journey_runs.update_one(
        {"id": run_id, "player_id": run["player_id"]},
        {"$set": {"status": "cleared", "updated_at": now_iso()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="run not found")
    doc = await db.journey_runs.find_one({"id": run_id}, {"_id": 0})
    return doc

@api_router.patch("/journey-runs/{run_id}/abandoned")
async def mark_run_abandoned(run_id: str, x_clinica_session: Optional[str] = Header(default=None)):
    """Archive an active run before a Rechallenge Map attempt.

    Transitions status from 'active' → 'abandoned'.  The run is kept in the
    database for history; it will no longer be returned by the active or latest
    run queries (which filter for 'active' / most-recent by attempt_number).
    Idempotent: abandoning an already-abandoned run is a no-op (200 OK).
    """
    run = await db.journey_runs.find_one({"id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    player = await db.players.find_one({"id": run["player_id"]}, {"_id": 0})
    if not player or not player_access_ok(player, run["player_id"], x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    result = await db.journey_runs.update_one(
        {"id": run_id, "player_id": run["player_id"], "status": "active"},
        {"$set": {"status": "abandoned", "updated_at": now_iso()}},
    )
    if result.matched_count == 0:
        # Either not found or already abandoned — either way treat as success.
        doc = await db.journey_runs.find_one({"id": run_id}, {"_id": 0})
        if doc is None:
            raise HTTPException(status_code=404, detail="run not found")
    else:
        doc = await db.journey_runs.find_one({"id": run_id}, {"_id": 0})
    return doc
@app.on_event("startup")
async def startup_db():
    """Create authority indexes for gameplay, activities, and faculty publishing."""
    get_runtime_config()
    await db.journey_runs.create_index(
        [("player_id", ASCENDING), ("chapter_id", ASCENDING), ("attempt_number", ASCENDING)],
        unique=True,
        name="unique_player_chapter_attempt",
    )
    await db.activity_completion_receipts.create_index(
        [("player_id", ASCENDING), ("activity_id", ASCENDING), ("completion_key", ASCENDING)],
        unique=True,
    )
    await db.daily_rounds_legacy_settlements.create_index(
        [("settlement_id", ASCENDING)],
        unique=True,
        name="one_legacy_daily_settlement_per_player",
    )
    await db.daily_rounds_legacy_authorizations.create_index(
        [("player_id", ASCENDING)],
        unique=True,
        name="one_legacy_daily_authorization_per_player",
    )
    await db.activity_analytics.create_index(
        [("receipt_key", ASCENDING)],
        unique=True,
    )
    await db.activity_analytics.create_index(
        [("activity_id", ASCENDING), ("day", ASCENDING)],
        name="activity_analytics_by_activity_day",
    )
    await db.grand_rounds_case_manifests.create_index(
        [("caseId", ASCENDING), ("version", ASCENDING)], unique=True, name="immutable_grand_round_version",
    )
    await db.grand_rounds_case_catalog.create_index([("caseId", ASCENDING)], unique=True, name="grand_round_catalog_case")
    await db.grand_rounds_case_drafts.create_index([("draftId", ASCENDING)], unique=True, name="grand_round_draft_id")
    await db.grand_rounds_case_drafts.create_index([("status", ASCENDING), ("updatedAt", DESCENDING)], name="grand_round_draft_review_queue")
    await db.faculty_credentials.create_index([("credentialId", ASCENDING)], unique=True, name="faculty_credential_id")
    await db.faculty_credentials.create_index([("tokenHash", ASCENDING)], unique=True, name="faculty_credential_hash")
    await db.faculty_credentials.create_index(
        [("facultyId", ASCENDING)], unique=True, partialFilterExpression={"status": "active"},
        name="one_active_faculty_credential",
    )
    await db.faculty_credentials.create_index([("status", ASCENDING), ("updatedAt", DESCENDING)], name="faculty_credential_status")

app.add_middleware(
    CORSMiddleware,
    # The API uses explicit signed/bearer-style headers rather than browser
    # cookies. Keeping credential mode off avoids authorizing ambient browser
    # credentials for the faculty administration workflow.
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

class FacultyGrandRoundsDraftUpdateRequest(BaseModel):
    expected_revision: int = Field(ge=1)
    manifest: Dict[str, Any]
@api_router.post("/faculty/grand-rounds/cases/drafts")
async def create_faculty_grand_round_draft(
    payload: FacultyGrandRoundsDraftCreateRequest, x_clinica_faculty_key: Optional[str] = Header(default=None),
):
    principal = await faculty_principal(x_clinica_faculty_key)
    require_faculty_role(principal, "author")
    case_id = (payload.case_id or "").strip()
    if not case_id:
        raise HTTPException(status_code=422, detail="case_id is required for a new faculty case")
    version = await next_grand_round_version(case_id)
    manifest = clean_grand_round_manifest(case_id, payload.manifest, version)
    now = now_iso()
    draft = {
        "draftId": str(uuid.uuid4()), "caseId": case_id, "version": version, "status": "draft", "revision": 1,
        "manifest": manifest, "authorId": principal["id"], "createdAt": now, "updatedAt": now,
        "audit": [{"at": now, "actorId": principal["id"], "event": "draft_created", "revision": 1}],
    }
    await db.grand_rounds_case_drafts.insert_one(draft)
    return {"draft": faculty_grand_round_view(draft)}

@api_router.post("/faculty/grand-rounds/cases/{case_id}/retire")
async def retire_faculty_grand_round(
    case_id: str, payload: FacultyGrandRoundsRetireRequest, x_clinica_faculty_key: Optional[str] = Header(default=None),
):
    principal = await faculty_principal(x_clinica_faculty_key)
    require_faculty_role(principal, "approver")
    now = now_iso()
    result = await db.grand_rounds_case_catalog.update_one(
        {"caseId": case_id, "status": "active"},
        {"$set": {"status": "retired", "retiredAt": now, "retiredBy": principal["id"], "retirementReason": payload.reason.strip(), "updatedAt": now}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=404, detail="there is no active faculty-published case with that id")
    await db.grand_rounds_case_audit.insert_one(
        {"caseId": case_id, "at": now, "actorId": principal["id"], "event": "case_retired", "reason": payload.reason.strip()}
    )
    return {"caseId": case_id, "status": "retired"}

@api_router.post("/faculty/grand-rounds/cases/drafts/{draft_id}/submit-review")
async def submit_faculty_grand_round_review(
    draft_id: str, payload: FacultyGrandRoundsApproveRequest, x_clinica_faculty_key: Optional[str] = Header(default=None),
):
    principal = await faculty_principal(x_clinica_faculty_key)
    require_faculty_role(principal, "author")
    now = now_iso()
    result = await db.grand_rounds_case_drafts.update_one(
        {"draftId": draft_id, "authorId": principal["id"], "revision": payload.expected_revision, "status": {"$in": ["draft", "changes_requested"]}},
        {"$set": {"status": "in_review", "revision": payload.expected_revision + 1, "updatedAt": now},
         "$push": {"audit": {"at": now, "actorId": principal["id"], "event": "review_requested", "revision": payload.expected_revision + 1}}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="this draft cannot be submitted; reload before trying again")
    updated = await db.grand_rounds_case_drafts.find_one({"draftId": draft_id}, {"_id": 0})
    return {"draft": faculty_grand_round_view(updated)}

async def next_grand_round_version(case_id: str) -> int:
    latest = await db.grand_rounds_case_manifests.find_one(
        {"caseId": case_id}, {"_id": 0, "version": 1}, sort=[("version", DESCENDING)]
    )
    static = GRAND_ROUNDS_CASES.get(case_id)
    return max(int((latest or {}).get("version", 0)), int((static or {}).get("version", 0))) + 1

def clean_grand_round_manifest(case_id: str, raw: Dict[str, Any], version: int) -> Dict[str, Any]:
    errors = _grand_round_manifest_errors(case_id, raw)
    if errors:
        raise HTTPException(status_code=422, detail={"message": "case manifest needs correction", "errors": errors})
    minutes = {"introductory": 15, "standard": 20, "advanced": 25, "expert": 30}[raw["difficulty"]]
    stability = int(raw["initial"]["stability"])
    acuity = "critical" if stability < 45 else "high" if stability < 65 else "moderate"
    return {
        **raw, "version": version, "estimatedMinutes": minutes,
        "family": raw["family"].strip(), "title": raw["title"].strip(), "subtitle": raw["subtitle"].strip(),
        "domain": raw["domain"].strip(), "patientName": raw["patientName"].strip(), "handoff": raw["handoff"].strip(),
        "concern": raw["concern"].strip(), "principle": raw["principle"].strip(),
        "relatedPractice": [item.strip() for item in raw["relatedPractice"]],
        # Acuity is server-derived, never a faculty-entered or player-controlled
        # field. Public attempts require this state from their first response.
        "initial": {**raw["initial"], "acuity": acuity},
    }

class FacultyGrandRoundsReviewRequest(BaseModel):
    expected_revision: int = Field(ge=1)
    decision: Literal["approve_for_publish", "changes_requested"]
    notes: str = Field(min_length=3, max_length=4000)

@api_router.get("/faculty/grand-rounds/cases")
async def list_faculty_grand_rounds(x_clinica_faculty_key: Optional[str] = Header(default=None)):
    principal = await faculty_principal(x_clinica_faculty_key)
    drafts = []
    cursor = db.grand_rounds_case_drafts.find({}, {"_id": 0}).sort("updatedAt", DESCENDING)
    async for draft in cursor:
        drafts.append(faculty_grand_round_view(draft))
    catalog = []
    async for item in db.grand_rounds_case_catalog.find({}, {"_id": 0}).sort("caseId", ASCENDING):
        catalog.append(item)
    return {"faculty": {"id": principal["id"], "role": principal["role"]}, "drafts": drafts, "catalog": catalog}

async def active_grand_round_manifests() -> Dict[str, Dict[str, Any]]:
    """Overlay governed approved versions over the legacy Age 1 catalog."""
    manifests = dict(GRAND_ROUNDS_CASES)
    rows = db.grand_rounds_case_catalog.find({"status": "active"}, {"_id": 0, "caseId": 1, "currentVersion": 1})
    async for row in rows:
        manifest = await grand_round_manifest(row["caseId"], int(row["currentVersion"]))
        if manifest:
            manifests[row["caseId"]] = manifest
    retired = db.grand_rounds_case_catalog.find({"status": "retired"}, {"_id": 0, "caseId": 1})
    async for row in retired:
        manifests.pop(row["caseId"], None)
    return manifests

def require_faculty_role(principal: Dict[str, str], *roles: str) -> None:
    if principal["role"] not in roles:
        raise HTTPException(status_code=403, detail="your faculty role cannot perform this action")

async def grand_round_manifest(case_id: str, version: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """Resolve a manifest by its immutable version, including retired content."""
    if version is not None:
        published = await db.grand_rounds_case_manifests.find_one(
            {"caseId": case_id, "version": int(version)}, {"_id": 0, "manifest": 1}
        )
        if published:
            return published["manifest"]
        static = GRAND_ROUNDS_CASES.get(case_id)
        return static if static and int(static["version"]) == int(version) else None
    catalog = await db.grand_rounds_case_catalog.find_one({"caseId": case_id, "status": "active"}, {"_id": 0})
    if catalog:
        return await grand_round_manifest(case_id, int(catalog["currentVersion"]))
    retired = await db.grand_rounds_case_catalog.find_one({"caseId": case_id, "status": "retired"}, {"_id": 0})
    if retired:
        return None
    return GRAND_ROUNDS_CASES.get(case_id)

@api_router.post("/faculty/grand-rounds/cases/drafts/{draft_id}/review")
async def review_faculty_grand_round(
    draft_id: str, payload: FacultyGrandRoundsReviewRequest, x_clinica_faculty_key: Optional[str] = Header(default=None),
):
    principal = await faculty_principal(x_clinica_faculty_key)
    require_faculty_role(principal, "reviewer")
    draft = await db.grand_rounds_case_drafts.find_one({"draftId": draft_id}, {"_id": 0})
    if not draft:
        raise HTTPException(status_code=404, detail="faculty case draft not found")
    if draft["authorId"] == principal["id"]:
        raise HTTPException(status_code=403, detail="a faculty author cannot review their own case")
    now = now_iso()
    next_status = "approved_for_publish" if payload.decision == "approve_for_publish" else "changes_requested"
    review = {"reviewerId": principal["id"], "decision": payload.decision, "notes": payload.notes.strip(), "reviewedAt": now}
    result = await db.grand_rounds_case_drafts.update_one(
        {"draftId": draft_id, "revision": payload.expected_revision, "status": "in_review"},
        {"$set": {"status": next_status, "review": review, "revision": payload.expected_revision + 1, "updatedAt": now},
         "$push": {"audit": {"at": now, "actorId": principal["id"], "event": payload.decision, "revision": payload.expected_revision + 1}}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="this review changed; reload before recording a decision")
    updated = await db.grand_rounds_case_drafts.find_one({"draftId": draft_id}, {"_id": 0})
    return {"draft": faculty_grand_round_view(updated)}

@api_router.post("/faculty/grand-rounds/cases/drafts/{draft_id}/approve")
async def approve_faculty_grand_round(
    draft_id: str, payload: FacultyGrandRoundsApproveRequest, x_clinica_faculty_key: Optional[str] = Header(default=None),
):
    principal = await faculty_principal(x_clinica_faculty_key)
    require_faculty_role(principal, "approver")
    draft = await db.grand_rounds_case_drafts.find_one({"draftId": draft_id}, {"_id": 0})
    if not draft:
        raise HTTPException(status_code=404, detail="faculty case draft not found")
    if draft["authorId"] == principal["id"] or (draft.get("review") or {}).get("reviewerId") == principal["id"]:
        raise HTTPException(status_code=403, detail="approval requires an independent faculty approver")
    if draft["status"] != "approved_for_publish" or int(draft["revision"]) != payload.expected_revision:
        raise HTTPException(status_code=409, detail="this case is not ready for approval; reload its review state")
    # Revalidate immediately before publishing; only this clean snapshot is
    # written to the append-only manifest collection.
    manifest = clean_grand_round_manifest(draft["caseId"], draft["manifest"], int(draft["version"]))
    now = now_iso()
    immutable = {
        "caseId": draft["caseId"], "version": draft["version"], "manifest": manifest,
        "approvedAt": now, "approvedBy": principal["id"], "sourceDraftId": draft_id,
        "review": draft["review"],
    }
    try:
        await db.grand_rounds_case_manifests.insert_one(immutable)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="this immutable case version was already published")
    await db.grand_rounds_case_catalog.update_one(
        {"caseId": draft["caseId"]},
        {"$set": {"caseId": draft["caseId"], "currentVersion": draft["version"], "status": "active", "updatedAt": now, "updatedBy": principal["id"]}},
        upsert=True,
    )
    await db.grand_rounds_case_drafts.update_one(
        {"draftId": draft_id, "revision": payload.expected_revision, "status": "approved_for_publish"},
        {"$set": {"status": "published", "approval": {"approverId": principal["id"], "approvedAt": now}, "revision": payload.expected_revision + 1, "updatedAt": now},
         "$push": {"audit": {"at": now, "actorId": principal["id"], "event": "immutable_version_published", "revision": payload.expected_revision + 1}}},
    )
    updated = await db.grand_rounds_case_drafts.find_one({"draftId": draft_id}, {"_id": 0})
    return {"draft": faculty_grand_round_view(updated), "published": {"caseId": draft["caseId"], "version": draft["version"]}}

@api_router.put("/faculty/grand-rounds/cases/drafts/{draft_id}")
async def update_faculty_grand_round_draft(
    draft_id: str, payload: FacultyGrandRoundsDraftUpdateRequest, x_clinica_faculty_key: Optional[str] = Header(default=None),
):
    principal = await faculty_principal(x_clinica_faculty_key)
    require_faculty_role(principal, "author")
    draft = await db.grand_rounds_case_drafts.find_one({"draftId": draft_id}, {"_id": 0})
    if not draft:
        raise HTTPException(status_code=404, detail="faculty case draft not found")
    if draft["authorId"] != principal["id"]:
        raise HTTPException(status_code=403, detail="only the drafting faculty member can edit this case")
    if draft["status"] not in {"draft", "changes_requested"}:
        raise HTTPException(status_code=409, detail="only a draft or requested-changes case can be edited")
    manifest = clean_grand_round_manifest(draft["caseId"], payload.manifest, int(draft["version"]))
    now = now_iso()
    result = await db.grand_rounds_case_drafts.update_one(
        {"draftId": draft_id, "revision": payload.expected_revision, "status": {"$in": ["draft", "changes_requested"]}},
        {"$set": {"manifest": manifest, "status": "draft", "revision": payload.expected_revision + 1, "updatedAt": now},
         "$push": {"audit": {"at": now, "actorId": principal["id"], "event": "draft_updated", "revision": payload.expected_revision + 1}}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="this draft changed; reload before saving")
    updated = await db.grand_rounds_case_drafts.find_one({"draftId": draft_id}, {"_id": 0})
    return {"draft": faculty_grand_round_view(updated)}

def faculty_credential_view(credential: Dict[str, Any]) -> Dict[str, Any]:
    """A safe administrative projection: credentials and digests never leave the server."""
    return {
        "credentialId": credential["credentialId"],
        "facultyId": credential["facultyId"],
        "role": credential["role"],
        "status": credential["status"],
        "issuedAt": credential["issuedAt"],
        "issuedBy": credential["issuedBy"],
        "updatedAt": credential["updatedAt"],
        "revokedAt": credential.get("revokedAt"),
        "revokedBy": credential.get("revokedBy"),
        "audit": credential.get("audit", []),
    }

def _server_registry_principal(
    environment_key: str, credential: Optional[str], expected_roles: set[str], unavailable_detail: str,
) -> Optional[Dict[str, str]]:
    """Authenticate from a server-only bootstrap registry without exposing its values."""
    raw_registry = os.environ.get(environment_key)
    if not raw_registry:
        return None
    try:
        registry = json.loads(raw_registry)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=503, detail=unavailable_detail) from error
    if not isinstance(registry, dict):
        raise HTTPException(status_code=503, detail=unavailable_detail)
    match: Optional[Dict[str, Any]] = None
    supplied = credential or ""
    for candidate, principal in registry.items():
        if isinstance(candidate, str) and hmac.compare_digest(candidate, supplied):
            match = principal if isinstance(principal, dict) else None
            break
    if not isinstance(match, dict):
        return None
    operator_id, role = match.get("id"), match.get("role")
    if (
        not isinstance(operator_id, str)
        or not FACULTY_ID_PATTERN.fullmatch(operator_id)
        or not isinstance(role, str)
        or role not in expected_roles
    ):
        raise HTTPException(status_code=503, detail=unavailable_detail)
    return {"id": operator_id, "role": role}

def _new_faculty_credential(faculty_id: str, role: str, administrator_id: str, now: str) -> tuple[Dict[str, Any], str]:
    raw_credential = f"cln_fac_{secrets.token_urlsafe(32)}"
    credential_id = str(uuid.uuid4())
    audit = {
        "at": now, "actorId": administrator_id, "event": "credential_issued",
        "credentialId": credential_id, "facultyId": faculty_id, "role": role,
    }
    return {
        "credentialId": credential_id, "facultyId": faculty_id, "role": role,
        "tokenHash": _credential_hash(raw_credential), "status": "active",
        "issuedAt": now, "issuedBy": administrator_id, "updatedAt": now, "audit": [audit],
    }, raw_credential

@api_router.post("/faculty/admin/credentials")
async def issue_faculty_credential(
    payload: FacultyCredentialIssueRequest, x_clinica_curriculum_admin_key: Optional[str] = Header(default=None),
):
    administrator = curriculum_admin_principal(x_clinica_curriculum_admin_key)
    faculty_id = payload.faculty_id.strip()
    if not FACULTY_ID_PATTERN.fullmatch(faculty_id):
        raise HTTPException(status_code=422, detail="faculty_id must be a stable 3-80 character identifier")
    now = now_iso()
    credential, raw_credential = _new_faculty_credential(faculty_id, payload.role, administrator["id"], now)
    try:
        await db.faculty_credentials.insert_one(credential)
    except DuplicateKeyError as error:
        raise HTTPException(status_code=409, detail="this faculty member already has an active credential; rotate it instead") from error
    return {
        "credential": faculty_credential_view(credential),
        # This is deliberately the only endpoint response which contains the
        # generated secret. It is never persisted in the application state.
        "oneTimeCredential": raw_credential,
    }

@api_router.post("/faculty/admin/credentials/{credential_id}/rotate")
async def rotate_faculty_credential(
    credential_id: str, payload: FacultyCredentialRotateRequest,
    x_clinica_curriculum_admin_key: Optional[str] = Header(default=None),
):
    administrator = curriculum_admin_principal(x_clinica_curriculum_admin_key)
    now = now_iso()
    old = await db.faculty_credentials.find_one(
        {"credentialId": credential_id}, {"_id": 0, "status": 1, "facultyId": 1, "role": 1},
    )
    if not old:
        raise HTTPException(status_code=404, detail="faculty credential not found")
    if old.get("status") != "active":
        raise HTTPException(status_code=409, detail="this credential is already inactive")
    raw_credential = f"cln_fac_{secrets.token_urlsafe(32)}"
    rotation_audit = {
        "at": now, "actorId": administrator["id"], "event": "credential_rotated",
        "credentialId": credential_id, "facultyId": old["facultyId"], "previousRole": old["role"],
        "nextRole": payload.role, "reason": payload.reason.strip(),
    }
    # A single document update swaps the credential digest and role together:
    # there is no partial-success window where a rotation can revoke access
    # before the replacement credential has been durably activated.
    rotated = await db.faculty_credentials.update_one(
        {"credentialId": credential_id, "status": "active"},
        {"$set": {
            "tokenHash": _credential_hash(raw_credential), "role": payload.role, "updatedAt": now,
        }, "$push": {"audit": rotation_audit}},
    )
    if rotated.modified_count != 1:
        raise HTTPException(status_code=409, detail="this credential changed; reload before rotating it")
    credential = await db.faculty_credentials.find_one({"credentialId": credential_id}, {"_id": 0})
    return {"credential": faculty_credential_view(credential), "oneTimeCredential": raw_credential}

@api_router.post("/faculty/admin/credentials/{credential_id}/revoke")
async def revoke_faculty_credential(
    credential_id: str, payload: FacultyCredentialRevokeRequest,
    x_clinica_curriculum_admin_key: Optional[str] = Header(default=None),
):
    administrator = curriculum_admin_principal(x_clinica_curriculum_admin_key)
    now = now_iso()
    result = await db.faculty_credentials.update_one(
        {"credentialId": credential_id, "status": "active"},
        {"$set": {"status": "revoked", "revokedAt": now, "revokedBy": administrator["id"], "updatedAt": now},
         "$push": {"audit": {
             "at": now, "actorId": administrator["id"], "event": "credential_revoked",
             "credentialId": credential_id, "reason": payload.reason.strip(),
         }}},
    )
    if result.modified_count == 1:
        credential = await db.faculty_credentials.find_one({"credentialId": credential_id}, {"_id": 0})
        return {"credential": faculty_credential_view(credential), "alreadyRevoked": False}
    credential = await db.faculty_credentials.find_one({"credentialId": credential_id}, {"_id": 0})
    if not credential:
        raise HTTPException(status_code=404, detail="faculty credential not found")
    return {"credential": faculty_credential_view(credential), "alreadyRevoked": True}

@api_router.get("/faculty/admin/credentials")
async def list_faculty_credentials(
    x_clinica_curriculum_admin_key: Optional[str] = Header(default=None),
):
    administrator = curriculum_admin_principal(x_clinica_curriculum_admin_key)
    credentials = []
    cursor = db.faculty_credentials.find({}, {"_id": 0, "tokenHash": 0}).sort("updatedAt", DESCENDING).limit(250)
    async for credential in cursor:
        credentials.append(faculty_credential_view(credential))
    return {"administrator": {"id": administrator["id"]}, "credentials": credentials}


# Register after every route declaration. Keeping this at the end prevents
# late-defined authority routes from being omitted from the mounted API.
app.include_router(api_router)
