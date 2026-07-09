from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
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
    avatar_id: str = ""
    rank: str = "Sprout Healer"
    rank_index: int = 0
    xp: int = 0
    player_level: int = 1
    class_tree_id: Optional[str] = None
    class_diagnostic_resonance: Optional[str] = None
    class_diagnostic_secondary: Optional[str] = None
    class_progress: Dict[str, List[int]] = Field(default_factory=dict)
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
    chapter_progress: int = 1
    class_trainees: Dict[str, int] = Field(default_factory=dict)
    university_credits: int = 0
    seen_reminiscence: bool = False
    lessons_completed: List[str] = Field(default_factory=list)
    simulations_completed: List[str] = Field(default_factory=list)
    badge_progress: Dict[str, int] = Field(default_factory=dict)
    claimed_milestones: List[str] = Field(default_factory=list)
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
    avatar_id: Optional[str] = None
    rank: Optional[str] = None
    rank_index: Optional[int] = None
    xp: Optional[int] = None
    player_level: Optional[int] = None
    class_tree_id: Optional[str] = None
    class_diagnostic_resonance: Optional[str] = None
    class_diagnostic_secondary: Optional[str] = None
    class_progress: Optional[Dict[str, List[int]]] = None
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
    chapter_progress: Optional[int] = None
    class_trainees: Optional[Dict[str, int]] = None
    university_credits: Optional[int] = None
    seen_reminiscence: Optional[bool] = None
    lessons_completed: Optional[List[str]] = None
    simulations_completed: Optional[List[str]] = None
    badge_progress: Optional[Dict[str, int]] = None
    claimed_milestones: Optional[List[str]] = None
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


# ---------- Routes ----------

@api_router.get("/")
async def root():
    return {"status": "ok", "service": "clinica-kingdom-of-healing"}


@api_router.post("/player", response_model=Player)
async def create_player(payload: PlayerCreate):
    if payload.aptitude not in {"guardian", "sage", "warden", "weaver"}:
        raise HTTPException(status_code=400, detail="invalid aptitude")
    aptitude_starting_hero = {
        "guardian": "novice_guardian",
        "sage": "apprentice_seer",
        "warden": "junior_warden",
        "weaver": "data_acolyte",
    }
    starting_hero = aptitude_starting_hero[payload.aptitude]
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
        heroes_owned=[starting_hero, "village_caretaker"],
        active_team=[starting_hero, "village_caretaker"],
        inventory={
            "Albuterol Mist": 1,
            "Glucose Gel": 1,
            "Fluid Bolus": 1,
            "Isolation Kit": 1,
            "Lab Token": 2,
        },
        codex_shards=50,
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
    if "mastery" in updates and isinstance(updates["mastery"], dict) is False:
        updates["mastery"] = updates["mastery"].model_dump()
    updates["updated_at"] = now_iso()
    await db.players.update_one({"id": player_id}, {"$set": updates})
    refreshed = await db.players.find_one({"id": player_id}, {"_id": 0})
    return Player(**refreshed)


@api_router.delete("/player/{player_id}")
async def delete_player(player_id: str):
    res = await db.players.delete_one({"id": player_id})
    return {"deleted": res.deleted_count}


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
