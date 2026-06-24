# Clinica: Kingdom of Healing — PRD

## Vision
A fantasy mobile RPG that teaches biology, anatomy, physiology, microbiology, nursing foundations, clinical judgment, and NCLEX reasoning through gameplay. Players collect healer heroes, rebuild a fallen kingdom, and battle disease corruptions through clue-based encounters tied to body systems.

## MVP Scope (Chapter 1: The Fading Core)
- **Multi-step Onboarding** — Welcome → Name → 3-question Calling Quiz → Recommended Aptitude → Learning Goal → First Trial: Air Crystal → Battle
- **Daily Shift Run** — 3 deterministic encounters per session
- **Clue-Based Battle System** — Action points (3 per turn), 3 visible + hidden clue cards, stability meter, corruption HP, hero skills with clinical risks
- **Pharmacy / Intervention Items** — 5 starter items (Albuterol Mist, Glucose Gel, Fluid Bolus, Isolation Kit, Lab Token) with clue-gated use, system-bonus effects, and persistent inventory
- **Call Team Member** — One use per battle, 4 options conditionally available (Respiratory Support, Pharmacy, Rapid Response, Infection Control). Unlocks temporary actions (Open Airflow, Containment Order) so players are never stuck without the right hero
- **Aptitude Passives in Battle** — Guardian (-5 dmg/turn), Sage (first scout -1 AP), Weaver (auto-reveal 1 hidden clue)
- **Mentor's Guidance** — Per-enemy failure tracking. Loss 1 → gentle hint; Loss 2 → tactical hint; Loss 3+ → +10 stability boost + Training Battle CTA
- **Training Battle Mode** — Hidden clue auto-revealed, +10 stability, half rewards
- **Codex Depth Adaptation** — Learning goal maps to depth banner (simple / foundation / clinical / nclex / professional)
- **Gacha / Summon Hall** — Codex Shards currency earned from battles (25 normal / 100 boss / 10 training). 12-hero Foundation Banner with weighted random pulls (100 shards/pull). Duplicates refund 25 shards.
- **Active Team Builder** — Heroes screen tap-to-toggle (max 3 heroes), saved server-side
- **18 Codex entries** across body systems with depth-aware framing
- **Kingdom Building** — 4 starter buildings
- **Progression** — Clinical Rank, 6 Mastery stats

## Architecture
- **Frontend** — Expo Router 6, React Native 0.81. Game content client-side for snappy gameplay.
- **Backend** — FastAPI + MongoDB (Motor). Player CRUD only; player_id stored in AsyncStorage.
- **No auth** — Local profile keyed by player_id.

## Battle Mechanics
- Each turn: 3 Action Points
- Skills cost 1–2 AP. Types: Scout (reveal clues), Strike (reduce corruption), Stabilize (restore patient %), Shield (reduce next enemy damage), Cleanse, Command
- Elemental bonus: striking when hero element matches enemy weak system = +30% damage
- Clinical risks: e.g. Fluid Surge on Cardion (heart failure) drops stability 20% — teaches fluid balance
- Win: corruption HP → 0. Lose: stability → 0 (danger trigger triggers)
- Victory rewards: XP, Codex pages unlocked, Mastery stat increments

## Future / Deferred
- Multi-encounter shift chain (currently 1 encounter per launch)
- Hero gacha summoning + evolution
- Trials, Towers, Arena (PvP), Raids, Global Events
- Adaptive learning engine
- More Codex depth levels
- AI-generated rationale (Claude Sonnet 4.5) on victory

## Business / Engagement
- Daily Shift creates habitual return (Duolingo-style streak loop)
- Codex unlocks reward continued play with real NCLEX knowledge
- Smart enhancement: school/cohort leaderboards (deferred) for nursing programs as a B2B angle
