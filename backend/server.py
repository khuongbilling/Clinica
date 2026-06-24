from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Clinica: Kingdom of Healing API")
api_router = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------

class PlayerCreate(BaseModel):
    name: str
    aptitude: str  # guardian | sage | warden | weaver


class MasteryStats(BaseModel):
    assessment: int = 0
    stabilization: int = 0
    pharmacology: int = 0
    judgment: int = 0
    command: int = 0
    systems: int = 0


class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    aptitude: str
    rank: str = "Sprout Healer"
    rank_index: int = 0
    xp: int = 0
    mastery: MasteryStats = Field(default_factory=MasteryStats)
    codex_unlocked: List[str] = Field(default_factory=list)
    heroes_owned: List[str] = Field(default_factory=list)
    kingdom_levels: Dict[str, int] = Field(default_factory=dict)
    runs_completed: int = 0
    bosses_defeated: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    rank: Optional[str] = None
    rank_index: Optional[int] = None
    xp: Optional[int] = None
    mastery: Optional[MasteryStats] = None
    codex_unlocked: Optional[List[str]] = None
    heroes_owned: Optional[List[str]] = None
    kingdom_levels: Optional[Dict[str, int]] = None
    runs_completed: Optional[int] = None
    bosses_defeated: Optional[List[str]] = None


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
    player = Player(
        name=payload.name.strip()[:24] or "Healer",
        aptitude=payload.aptitude,
        heroes_owned=[aptitude_starting_hero[payload.aptitude], "village_caretaker"],
        kingdom_levels={
            "academy_of_healing": 1,
            "library_of_knowledge": 1,
            "hall_of_heroes": 1,
            "apothecary": 1,
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
