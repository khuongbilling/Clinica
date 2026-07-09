---
name: Narrator timeline (Bai vs System) & tutorial anti-replay
description: Who narrates before vs after the Recall, the VN cut-in overlay layout, and the tutorial store's replay/hydration guards
---

- **Narrator timeline rule:** the System did not exist until the player's Recall (time travel at the end of the prologue). Pre-Recall surfaces — title screen, guided prologue tutorial battle, scripted-loss prologue boss — speak as **Master Bai** (MASTER_BAI in systemNarrator.ts, gold accent) or as neutral in-world HUD ("WARD ALARM", "MONITOR"), never "The System". Everything post-prologue is System-voiced. **Why:** user-defined lore; the System's first appearance is the voice after the boss loss.
- **How to apply:** any new tutorial gets System voice unless it belongs to the prologue; `isSystemTutorial` excludes prologueBattle; battle labels gate on `isPrologueTutorial || isPrologueBoss`. Sweep for stray "SYSTEM" strings on pre-Recall screens when adding copy.
- Tutorial overlay renders a large VN-style avatar cut-in (NarratorFigure) instead of a small circle portrait — figure beside text in guided boxes, big cut-in above the center popover. The battle "Goal:" objective strip is hidden while any tutorial is active (narrator carries the objective).
- Forced (non-skippable) tutorials are in FORCED_TUTORIAL_IDS. Deliberate restarts use replayTutorial only.
- **Hydration race:** tutorial flags load async; startTutorial queues pre-hydration requests and resolves against loaded flags, or completed tutorials replay after a full page reload. Never bypass startTutorial's guards.
- Frontend API client has a 6s timeout (down backend must fail fast, not hang onboarding); backend defaults MONGO_URL to local mongod.
