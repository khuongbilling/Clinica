# Clinica: Kingdom of Healing — PRD

## Vision
A fantasy mobile RPG that teaches biology, anatomy, physiology, microbiology, nursing foundations, clinical judgment, and NCLEX reasoning through gameplay. Players collect healer heroes, rebuild a fallen kingdom, and battle disease corruptions through clue-based encounters tied to body systems.

## MVP Scope (Chapter 1: The Fading Core)
- **Onboarding** — Player name + Aptitude selection (Guardian / Sage / Warden / Weaver)
- **Daily Shift Run** — 3 deterministic encounters per session, drawn from starter + advanced enemy pools
- **Clue-Based Battle System** — Action points (3 per turn), 3 visible + hidden clue cards, stability meter, corruption HP, hero skills with risks
- **10 Starter Heroes** — Stabilizers, Assessors, Coordinators, Analysts, Specialists, Educators
- **10 Enemies** — Air Sprite, River Sludge, Energy Lock, Fire Imp, Mind Fog, Septara Seed, Cardion Echo, Glycora Spark, Pulmora Wisp, Electrox Flicker
- **Chapter 1 Boss** — Lord Imbalance (multi-system collapse) — unlocks after first shift
- **Codex Library** — 18 educational entries across body systems (Air, River, Fire, Energy, Storm, Mind, Protection)
- **Kingdom Building** — Academy of Healing, Library of Knowledge, Hall of Heroes, Apothecary
- **Progression** — Clinical Rank (Sprout Healer → Mythic Clinician), 6 Mastery stats (Assessment / Stabilization / Pharmacology / Judgment / Command / Systems)

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
