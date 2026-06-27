"""
Generate Suikoden II-style portrait sprites for every Clinica hero.

Run:  python /app/backend/scripts/generate_hero_sprites.py
Outputs PNG files to /app/frontend/assets/heroes/{hero_id}.png

Idempotent: skips any hero whose PNG already exists unless FORCE=1 is set.
"""

import asyncio
import base64
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

OUT_DIR = Path("/app/frontend/assets/heroes")
OUT_DIR.mkdir(parents=True, exist_ok=True)
FORCE = os.getenv("FORCE", "0") == "1"

STYLE = (
    "16-bit Suikoden II style RPG portrait, pixel art, head-and-shoulders bust, "
    "soft warm palette with rich dark fantasy shading, clear pixel outlines, "
    "centered on a plain dark navy background, ornate gold border frame, "
    "high detail face with expressive eyes, professional JRPG character art."
)

HEROES = [
    ("novice_guardian", "Young apprentice nurse-healer with short auburn hair, soft brown eyes, "
                        "white linen robe over a leather chestpiece, a small golden Air-rune amulet, kind determined expression"),
    ("night_watcher",   "Quiet middle-aged watcher in a deep navy hooded cloak, "
                        "sharp violet eyes peering from under the hood, holding a tiny silver bell, candle-lit face"),
    ("apprentice_seer", "Young scholar mage with long silver hair, "
                        "round wire-frame spectacles, indigo robe with star-pattern embroidery, holding a glowing crystal lens"),
    ("junior_warden",   "Stocky young guard-medic with cropped blonde hair, "
                        "silver plate spaulder over a green tabard with shield emblem, calm focused face"),
    ("data_acolyte",    "Slender androgynous tech-scribe with pale teal hair tied back, "
                        "glowing runic tattoo across one cheek, dark grey robe with circuit-like gold thread embroidery"),
    ("village_caretaker", "Warm elderly woman healer with grey hair in a bun, "
                          "soft wrinkled face with gentle smile, cream apron over a brown wool dress, holding a small wooden cup of tea"),
    ("storm_runner",    "Lean energetic young man, dark skin, tightly braided black hair, "
                        "leather harness with vials of healing potions, lightning-rune tattoo on collarbone, intense focused stare"),
    ("infection_warden", "Stern middle-aged woman with short crimson hair, "
                         "white mask pulled down to neck, deep red plague-doctor robe with brass buckles, lantern of cleansing flame at shoulder"),
    ("wound_sage",      "Calm older man, olive skin, long braided dark beard, "
                        "wearing a forest-green herbalist's apron over linen, holding bandages and dried herbs"),
    ("mindkeeper",      "Compassionate young woman with shaved sides and a long midnight-blue ponytail, "
                        "soft purple robe with moon-symbol clasp, holding a tiny silver chime, serene expression"),
]


async def generate_one(hero_id: str, descriptor: str) -> bool:
    out = OUT_DIR / f"{hero_id}.png"
    if out.exists() and not FORCE:
        print(f"  ✓ skip (exists): {out.name}")
        return True

    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print("  ✗ EMERGENT_LLM_KEY missing in /app/backend/.env")
        return False

    chat = LlmChat(
        api_key=api_key,
        session_id=f"sprite-{hero_id}",
        system_message="You are a pixel-art portrait illustrator for a clinical fantasy JRPG.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

    prompt = f"{STYLE}\n\nCharacter: {descriptor}"
    try:
        _text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    except Exception as exc:  # noqa: BLE001
        print(f"  ✗ {hero_id} request failed: {exc}")
        return False

    if not images:
        print(f"  ✗ {hero_id}: no image returned")
        return False

    img = images[0]
    try:
        data = base64.b64decode(img["data"])
    except Exception as exc:  # noqa: BLE001
        print(f"  ✗ {hero_id}: bad base64 ({exc})")
        return False

    out.write_bytes(data)
    size_kb = out.stat().st_size // 1024
    print(f"  ✓ {hero_id}.png  ({size_kb} KB)")
    return True


async def main() -> int:
    print(f"Generating {len(HEROES)} sprites → {OUT_DIR}")
    print(f"FORCE mode: {FORCE}")
    print("-" * 60)
    ok = 0
    for hid, desc in HEROES:
        if await generate_one(hid, desc):
            ok += 1
        await asyncio.sleep(0.5)
    print("-" * 60)
    print(f"Done: {ok}/{len(HEROES)} sprites generated")
    return 0 if ok == len(HEROES) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
