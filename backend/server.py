from fastapi import FastAPI, APIRouter, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError
import os
import random
import logging
import base64
import hashlib
import hmac
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional, Literal
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://127.0.0.1:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'clinica')]

app = FastAPI(title="Clinica: Kingdom of Healing API")
api_router = APIRouter(prefix="/api")


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


class DailyRoundsState(BaseModel):
    streak_count: int = 0
    last_checkin_date: str = ""
    daily_date: str = ""
    objectives: List[DailyObjectiveState] = Field(default_factory=list)
    all_complete_claimed: bool = False
    weekly_key: str = ""
    weekly_days_completed: int = 0
    weekly_claimed: bool = False
    weekly_credited_dates: List[str] = Field(default_factory=list)


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
        "advanced": (20, 35, "cue_scroll", 2),
    },
    "triage": {
        "beginner": (10, 15, "triage_scroll", 1), "standard": (15, 25, "triage_scroll", 2),
        "advanced": (20, 35, "triage_scroll", 2),
    },
    "stack": {
        "beginner": (10, 15, "stab_scroll", 1), "standard": (15, 25, "stab_scroll", 2),
        "advanced": (20, 35, "stab_scroll", 2),
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
    "daily_rounds_complete": ("day", 2),
    "weekly_rounds_complete": ("week", 3),
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
    ward_sigils: Optional[int] = None
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
    uni_cue_lab_count: Optional[int] = None
    uni_triage_count: Optional[int] = None
    uni_stack_count: Optional[int] = None
    uni_practice_milestones_claimed: Optional[List[str]] = None
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


# ---------- Routes ----------

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
        "bosses_defeated", "claimed_milestones", "owned_titles", "owned_skins",
        # Chapter readiness and Journey key/node claims are server-authoritative
        # so a client snapshot cannot unlock a chapter by fabricating progress.
        "chapter_progress", "chapter_boss_keys", "claimed_journey_nodes",
        "claimed_level_rewards", "claimed_chapter_chests", "claimed_chapter_3star",
    ):
        updates.pop(field, None)
    # class_specialization is immutable once set; refuse any attempt to overwrite
    # it through the generic update path — use POST /claim-specialization instead.
    updates.pop("class_specialization", None)
    if "mastery" in updates and isinstance(updates["mastery"], dict) is False:
        updates["mastery"] = updates["mastery"].model_dump()
    updates["updated_at"] = now_iso()
    await db.players.update_one({"id": player_id}, {"$set": updates})
    refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
    return Player(**refreshed)


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
        if source == "daily_rounds_complete":
            reward_increments = {"xp": 10, "crowns": 25, "codex_shards": 25}
        elif source == "weekly_rounds_complete":
            reward_increments = {"crowns": 100, "codex_shards": 150, "refined_lotus_gems": 5}
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
    difficulty: Literal["beginner", "standard", "advanced"]


@api_router.post("/player/{player_id}/university-practice/complete")
async def complete_university_practice(
    player_id: str,
    payload: UniversityPracticeCompletionRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Persist a fixed-table University completion; no reward values are client input."""
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    if not player_access_ok(player, player_id, x_clinica_session, None):
        raise HTTPException(status_code=401, detail="invalid player session")
    xp, credits, item, quantity = UNIVERSITY_PRACTICE_REWARDS[payload.activity][payload.difficulty]
    day = age1_day_key()
    used = int(player.get("age1_reward_units", 0)) if player.get("age1_reward_day") == day else 0
    multiplier = age1_reward_multiplier(used, 1)
    increments = {
        "xp": int(round(xp * multiplier)),
        "university_credits": int(round(credits * multiplier)),
        f"inventory.{item}": int(round(quantity * multiplier)),
    }
    increments = {key: value for key, value in increments.items() if value}
    next_xp = int(player.get("xp", 0)) + increments.get("xp", 0)
    updated = await db.players.update_one(
        {"id": player_id, "updated_at": player.get("updated_at")},
        {"$inc": increments, "$set": {
            "updated_at": now_iso(), "age1_reward_day": day, "age1_reward_units": used + 1,
            "player_level": player_level_from_xp(next_xp),
        }},
    )
    if updated.modified_count != 1:
        raise HTTPException(status_code=409, detail="University reward state changed; retry")
    current = await db.players.find_one({"id": player_id}, {"_id": 0})
    return {"player": Player(**current).model_dump(), "multiplier": multiplier, "granted": increments}


@api_router.post("/player/{player_id}/activity-attempts/{activity}", response_model=Dict[str, Any])
async def begin_activity_attempt(
    player_id: str,
    activity: Literal["clinical_battle", "journey_treasure", "auto_sweep", "ward_defense", "university_practice", "world_event"],
    payload: ActivityAttemptRequest,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Register a one-use repeatable activity before its reward can be claimed."""
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


@api_router.post("/player/{player_id}/activity-attempts/{attempt_id}/claim", response_model=Dict[str, Any])
async def claim_activity_attempt(
    player_id: str,
    attempt_id: str,
    x_clinica_session: Optional[str] = Header(default=None),
):
    """Consume one recorded repeatable attempt and derive its grant server-side."""
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


@api_router.post("/player/{player_id}/rewards/{activity}", response_model=Dict[str, Any])
async def grant_activity_reward(
    player_id: str,
    activity: Literal["clinical_battle", "journey_treasure", "auto_sweep", "ward_defense", "university_practice", "world_event"],
    payload: ActivityRewardGrant,
    x_clinica_session: Optional[str] = Header(default=None),
    x_clinica_economy_token: Optional[str] = Header(default=None),
):
    """Apply a bounded activity reward and its shared repeat taper atomically.

    Reward values never travel through the generic player snapshot. The activity
    path, tier ladder, per-field ceilings, and current daily budget are all
    validated from the persisted player document before a single conditional
    write commits the reward.
    """
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
    # Preserve the frozen topology and encounter assignment. Only the benign
    # visibility/visited state may be carried forward from the client.
    merged_tiles: list[dict[str, Any]] = []
    for tile_id, frozen in frozen_by_id.items():
        candidate = incoming_by_id[tile_id]
        if candidate.get("q") != frozen.get("q") or candidate.get("r") != frozen.get("r") or candidate.get("encounter") != frozen.get("encounter"):
            raise HTTPException(status_code=422, detail="journey encounters are immutable")
        merged = dict(frozen)
        merged["visibility"] = candidate.get("visibility", frozen.get("visibility"))
        merged["visited"] = bool(candidate.get("visited", frozen.get("visited")))
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
        "explored_tile_count": max(int(run.get("explored_tile_count", 1)), int(payload.explored_tile_count or 0)),
        "explored_tile_ids": list(set(run.get("explored_tile_ids", [])) | set(payload.explored_tile_ids or [])),
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
    commitments = player.get("age1_stamina_commitments") or []
    commitment = next((c for c in reversed(commitments) if not c.get("consumed") and int(c.get("cost", 0)) == 5), None)
    if not commitment:
        raise HTTPException(status_code=409, detail="a Chapter Boss Stamina commitment is required")
    run = await db.journey_runs.find_one({"id": run_id, "player_id": player_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="journey run not found")
    if int(run.get("chapter_id", 1)) > int(player.get("chapter_progress", 1)):
        raise HTTPException(status_code=403, detail="chapter is not unlocked")
    if run.get("chapter_boss_defeated") or run.get("status") == "cleared":
        return {"already_completed": True, "run": run, "granted": {}}
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
    return {
        "already_completed": False,
        "run": refreshed_run,
        "player": Player(**refreshed_player).model_dump(),
        "granted": CHAPTER_BOSS_FIRST_CLEAR_REWARD if reward_write.modified_count == 1 else {},
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
    """Create the unique compound index that prevents duplicate journey runs."""
    await db.journey_runs.create_index(
        [("player_id", ASCENDING), ("chapter_id", ASCENDING), ("attempt_number", ASCENDING)],
        unique=True,
        name="unique_player_chapter_attempt",
    )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
