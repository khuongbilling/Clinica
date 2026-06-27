"""
Generate Suikoden II-style portrait sprites for every Clinica enemy (Disease Corruption).

Run:  python /app/backend/scripts/generate_enemy_sprites.py
Outputs PNG files to /app/frontend/assets/enemies/{enemy_id}.png

Idempotent: skips any enemy whose PNG already exists unless FORCE=1 is set.
"""

import asyncio
import base64
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

OUT_DIR = Path("/app/frontend/assets/enemies")
OUT_DIR.mkdir(parents=True, exist_ok=True)
FORCE = os.getenv("FORCE", "0") == "1"

STYLE = (
    "16-bit Suikoden II style RPG enemy portrait, pixel art, head-and-shoulders bust framing, "
    "ominous dark fantasy palette with eerie glowing accents, clear pixel outlines, "
    "centered on a plain dark navy background, ornate dark crimson border frame, "
    "high detail expressive monster face, professional JRPG monster art, "
    "creature/spirit form (NOT a human nurse/healer), embodies the disease as a supernatural corruption."
)

# Each enemy is a personification of a disease/pathology — design as a corrupted elemental spirit.
ENEMIES = [
    ("air_sprite",
     "Wispy translucent air-elemental spirit with a gasping pale face, cyan-grey smoke trails for hair, "
     "hollow blue glowing eyes, mouth perpetually open as if struggling to breathe, "
     "wisps of stolen oxygen swirling around its throat, dim aquamarine glow."),

    ("river_sludge",
     "Crimson sludge wraith dripping like thick stagnant blood, sunken hollow eye sockets glowing dull red, "
     "viscous tendrils pooling at the shoulders, weak heartbeat-rune faintly pulsing on its chest, "
     "deep maroon and rust palette, body partially collapsed."),

    ("energy_lock",
     "Pale ghostly figure trembling with cold blue chains coiled around its neck and chest, "
     "frosted shimmer of low-glucose static across its skin, hollow shaking eyes, "
     "icy mint-blue glow, fingers locked in a tremor, faint sugar-crystal motes drifting away."),

    ("fire_imp",
     "Small angry imp creature with cracked red-hot skin, smoking ember rashes across its cheeks, "
     "yellow inflamed pustule-eyes, lit by an unhealthy orange glow, "
     "snarling expression, sparks of localized fever rising off its shoulders."),

    ("septara_seed",
     "Sinister thorned seedling spirit with veins of black infection spreading across its face like roots, "
     "burning amber eyes, brittle bark-like skin cracking to reveal red-orange sepsis glow underneath, "
     "wilted thorny crown, ominous green-black palette suggesting systemic spread."),

    ("cardion_echo",
     "Drowning ghostly figure with water pouring continuously down its chest, bluish lips, "
     "translucent skin showing a faltering glowing heart inside, slow heavy droplets falling, "
     "deep teal and steel-blue palette, sorrowful exhausted expression."),

    ("glycora_spark",
     "Sickly sugar-crystal djinn with amber jagged shards growing from its shoulders and cheeks, "
     "yellow-orange glowing acidic eyes, breath visible as deep slow Kussmaul mist, "
     "fractured crystalline skin, ketone-smoke trails."),

    ("pulmora_wisp",
     "Hunched smoky lung-spirit with a barrel-shaped chest of swirling grey vapor, "
     "weary half-closed eyes, pursed-lipped mouth exhaling thin grey smoke, "
     "ash-grey and dim olive palette, wisps of trapped CO2 around its head."),

    ("electrox_flicker",
     "Erratic lightning-elemental creature with arcing violet sparks crackling through its body, "
     "asymmetric peaked-T-wave shapes flickering on its chest, wild glowing magenta eyes, "
     "muscles spasming, palette of electric purple and angry yellow."),

    ("mind_fog",
     "Hooded shadow spirit with a face obscured by drifting grey mist, faint glowing white eyes through the fog, "
     "tendrils of confusion swirling around its skull, ghostly indigo robe, "
     "fingers fading in and out of visibility, dreamlike unsettling presence."),

    # CHAPTER 1 BOSS
    ("lord_imbalance",
     "Imposing multi-elemental dark lord with a cracked obsidian helm splitting into four glowing fragments "
     "(cyan Air, crimson River, amber Energy, violet Mind), each fragment leaking colored smoke; "
     "armor pieced together from broken pieces of the Codex; tall regal silhouette, "
     "fierce burning bicolored eyes, swirling storm of fractured light around the shoulders, "
     "epic Suikoden boss energy, ornate gold-trimmed dark armor."),
]


async def generate_one(enemy_id: str, descriptor: str) -> bool:
    out = OUT_DIR / f"{enemy_id}.png"
    if out.exists() and not FORCE:
        print(f"  ✓ skip (exists): {out.name}")
        return True

    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print("  ✗ EMERGENT_LLM_KEY missing in /app/backend/.env")
        return False

    chat = LlmChat(
        api_key=api_key,
        session_id=f"enemy-sprite-{enemy_id}",
        system_message="You are a pixel-art monster portrait illustrator for a clinical fantasy JRPG.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

    prompt = f"{STYLE}\n\nEnemy: {descriptor}"
    try:
        _text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    except Exception as exc:  # noqa: BLE001
        print(f"  ✗ {enemy_id} request failed: {exc}")
        return False

    if not images:
        print(f"  ✗ {enemy_id}: no image returned")
        return False

    img = images[0]
    try:
        data = base64.b64decode(img["data"])
    except Exception as exc:  # noqa: BLE001
        print(f"  ✗ {enemy_id}: bad base64 ({exc})")
        return False

    out.write_bytes(data)
    size_kb = out.stat().st_size // 1024
    print(f"  ✓ {enemy_id}.png  ({size_kb} KB)")
    return True


async def main() -> int:
    print(f"Generating {len(ENEMIES)} enemy sprites → {OUT_DIR}")
    print(f"FORCE mode: {FORCE}")
    print("-" * 60)
    ok = 0
    for eid, desc in ENEMIES:
        if await generate_one(eid, desc):
            ok += 1
        await asyncio.sleep(0.5)
    print("-" * 60)
    print(f"Done: {ok}/{len(ENEMIES)} sprites generated")
    return 0 if ok == len(ENEMIES) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
