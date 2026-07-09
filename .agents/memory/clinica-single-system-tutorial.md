---
name: Single-System tutorial voice & anti-replay
description: All tutorials speak as "The System"; tutorial store guards against overlap, restarts, and a hydration race
---

- ALL tutorial/narrator surfaces use the single "System" persona (getSystemIdentity); Mentor Bai is removed. Any new tutorial, hint label, or failure-aid copy must be System-voiced.
- Forced (non-skippable) tutorials are listed in FORCED_TUTORIAL_IDS; skip button derives from isForcedTutorial. Deliberate restarts go through replayTutorial only (used by the prologue battle force-start).
- **Hydration race:** tutorial completion flags load async from AsyncStorage. Screens auto-start tutorials on ~600ms timers, which can beat hydration after a full page reload — startTutorial must queue pre-hydration requests and resolve them against the loaded flags, or completed tutorials replay themselves. **Why:** caught by e2e — hub intro replayed after reload.
- **How to apply:** never add a tutorial auto-start that bypasses startTutorial's guards; any new persistence read the store depends on must gate starts on hydration.
- Frontend API client has a 6s request timeout; a down backend must fail fast so local-fallback onboarding (createPlayer) never hangs. Backend defaults MONGO_URL to local mongod (127.0.0.1:27017) so it runs without the secret.
