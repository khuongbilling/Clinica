---
name: Recruitment-only heroes
description: Heroes are earned exclusively via University Recruitment; loaner-team prologue pattern; grant-site audit rule.
---

Heroes come ONLY from University Recruitment (gacha). There must be NO other grant path:
new-player creation (frontend defaultPlayer + backend create_player) starts with
`heroes_owned=[]`, `active_team=[]`; lesson rewards must never include heroes
(LotusLessonRewards deliberately has no grantHeroes field); class-diagnostic
confirmation grants no hero.

**Why:** Free starter heroes undercut the Recruitment loop and created duplicate
grant sites that drifted (frontend map + backend map + lesson rewards).

**How to apply:**
- If a design asks for "give the player a hero", route it through the recruit flow
  (or a recruit ticket), never a direct `heroes_owned` write outside recruitment.
- Prologue/tutorial battles use a TEMPORARY loaner team pinned in battle.tsx
  (novice_guardian + village_caretaker) whenever prologue flags are set OR player
  owns 0 heroes; battle runs training=1 so no hero XP/ownership persists.
- Hero-dependent screens (heroes tab, hero-select, training hall) must keep
  friendly empty states with a RECRUIT CTA; hide confirm footers when roster is empty.
- Currency label is "University Credits" everywhere (old "Knowledge Points" copy retired);
  UniversityCreditsBadge.tsx is the shared icon+explainer component.
- Watch: new players start with 50 codex shards but a recruit costs 100 (first-recruit
  affordability is an open follow-up).
- Metro runs in CI mode (no watch): newly created files 500 the bundle until the
  Start application workflow is restarted.
