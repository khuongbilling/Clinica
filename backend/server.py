from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError
import os
import random
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
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
    stamina: int = 5
    stamina_updated_at: str = Field(default_factory=now_iso)
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


@api_router.post("/player", response_model=Player)
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
    await db.players.insert_one(doc)
    return player


@api_router.get("/player/{player_id}", response_model=Player)
async def get_player(player_id: str):
    doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="player not found")
    return Player(**doc)


@api_router.put("/player/{player_id}", response_model=Player)
async def update_player(player_id: str, payload: PlayerUpdate):
    existing = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="player not found")
    updates: Dict[str, Any] = {k: v for k, v in payload.model_dump().items() if v is not None}
    # class_specialization is immutable once set; refuse any attempt to overwrite
    # it through the generic update path — use POST /claim-specialization instead.
    updates.pop("class_specialization", None)
    if "mastery" in updates and isinstance(updates["mastery"], dict) is False:
        updates["mastery"] = updates["mastery"].model_dump()
    updates["updated_at"] = now_iso()
    await db.players.update_one({"id": player_id}, {"$set": updates})
    refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
    return Player(**refreshed)


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
async def claim_specialization(player_id: str, payload: ClaimSpecializationRequest):
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
    doc = await db.players.find_one({"id": player_id}, {"_id": 0, "class_tree_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="player not found")

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
async def delete_player(player_id: str):
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
    stamina_spent:           int            = 0
    # Push 4 canonical fields
    shift:                   Optional[str]  = None   # 'day' | 'evening' | 'night'
    call_team:               List[str]      = []
    cards:                   List[Any]      = []
    blessings:               List[Any]      = []
    pressure:                float          = 0.0


class JourneyRunSave(BaseModel):
    tiles:                    List[Any]
    current_tile_id:          str
    area_boss_keys_collected: Optional[int]   = None
    chapter_boss_defeated:    Optional[bool]  = None
    explored_tile_count:      Optional[int]   = None
    stamina_spent:            Optional[int]   = None
    # Push 4 canonical mutable fields
    call_team:                Optional[List[str]] = None
    cards:                    Optional[List[Any]] = None
    blessings:                Optional[List[Any]] = None
    pressure:                 Optional[float]     = None


@api_router.get("/player/{player_id}/journey-runs/{chapter_id}/active")
async def get_active_journey_run(player_id: str, chapter_id: int):
    """Return the current active run for this player+chapter, or 404.

    Sorted by attempt_number DESC so that if more than one active run ever
    exists (e.g. from a partial Rechallenge Map transition where the new run
    was created before the old one was abandoned), the highest-attempt run is
    always returned — ensuring the player never sees stale map state.
    """
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
async def get_latest_journey_run(player_id: str, chapter_id: int):
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
async def create_journey_run(player_id: str, payload: JourneyRunCreate):
    """Create a new run (attempt #1 or challenge).
    Idempotent: the unique compound index (player_id, chapter_id, attempt_number)
    catches any concurrent duplicate — the handler returns the existing run
    rather than raising a 5xx.
    """
    run_id = str(uuid.uuid4())
    now    = now_iso()
    doc    = {
        "id":         run_id,
        "player_id":  player_id,
        "status":     "active",
        "created_at": now,
        "updated_at": now,
        **payload.model_dump(),
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
async def save_journey_run(run_id: str, payload: JourneyRunSave):
    """Persist updated mutable run state (tiles, position, keys, etc.)."""
    updates: Dict[str, Any] = {
        k: v for k, v in payload.model_dump().items() if v is not None
    }
    updates["updated_at"] = now_iso()
    result = await db.journey_runs.update_one({"id": run_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="run not found")
    doc = await db.journey_runs.find_one({"id": run_id}, {"_id": 0})
    return doc


class ClaimAreaBossKeyRequest(BaseModel):
    chapter_id: int
    tile_id: str


@api_router.post("/player/{player_id}/claim-area-boss-key")
async def claim_area_boss_key(player_id: str, payload: ClaimAreaBossKeyRequest):
    """Idempotently claim an Area Boss key for a chapter.

    Uses a single MongoDB aggregation-pipeline update so the read, set-union,
    and count derivation are fully atomic — no concurrent request can observe
    stale state or produce a duplicate increment.

    Algorithm (all in one round-trip):
      claimed_tile_ids = setUnion(existing_claimed_tile_ids, [tile_id])
      keys_collected   = min(3, size(claimed_tile_ids))

    Idempotent: if tile_id was already present, setUnion is a no-op and the
    returned state is the unchanged current state.  Returns the post-update
    chapter key state so the caller can reconcile locally without a full
    player re-fetch.
    """
    MAX_KEYS = 3  # CHAPTER_BOSS_KEY_REQUIREMENT from chapterBossKeys.ts
    chapter_key = str(payload.chapter_id)
    field = f"chapter_boss_keys.{chapter_key}"
    existing_ids_expr = {"$ifNull": [f"${field}.claimed_tile_ids", []]}
    new_ids_expr = {"$setUnion": [existing_ids_expr, [payload.tile_id]]}

    doc = await db.players.find_one_and_update(
        {"id": player_id},
        [
            {
                "$set": {
                    field: {
                        "claimed_tile_ids": new_ids_expr,
                        "keys_collected": {"$min": [MAX_KEYS, {"$size": new_ids_expr}]},
                    },
                    "updated_at": now_iso(),
                }
            }
        ],
        return_document=True,
        projection={"_id": 0, field: 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="player not found")

    state = (doc.get("chapter_boss_keys") or {}).get(chapter_key, {})
    return {
        "keys_collected":   state.get("keys_collected", 0),
        "claimed_tile_ids": state.get("claimed_tile_ids", []),
    }


@api_router.patch("/journey-runs/{run_id}/cleared")
async def mark_run_cleared(run_id: str):
    """Transition run status from 'active' to 'cleared'."""
    result = await db.journey_runs.update_one(
        {"id": run_id},
        {"$set": {"status": "cleared", "updated_at": now_iso()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="run not found")
    doc = await db.journey_runs.find_one({"id": run_id}, {"_id": 0})
    return doc

@api_router.patch("/journey-runs/{run_id}/abandoned")
async def mark_run_abandoned(run_id: str):
    """Archive an active run before a Rechallenge Map attempt.

    Transitions status from 'active' → 'abandoned'.  The run is kept in the
    database for history; it will no longer be returned by the active or latest
    run queries (which filter for 'active' / most-recent by attempt_number).
    Idempotent: abandoning an already-abandoned run is a no-op (200 OK).
    """
    result = await db.journey_runs.update_one(
        {"id": run_id, "status": "active"},
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
