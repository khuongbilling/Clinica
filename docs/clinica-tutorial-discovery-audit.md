<!-- READ-ONLY DOCUMENT — Do not modify application source files based on this document. This file records the audit brief only; findings are to be produced by a future code-review or explore task. -->

| Field | Value |
|---|---|
| Audit date | 2026-08-02 (UTC) |
| Current branch | `main` |
| Latest commit | `0d9f6f7c6dbf29c9cc93c6afd0d584370984f574` (Push 2: Battle UI & Bestiary — Elemental Counter display, log line, CalcBreakdown row, skill chip, Bestiary restructure) |
| Framework | Expo 54 (React Native / Expo Router) — web port 5000; backend FastAPI port 8000 |
| Files reviewed | See Section N |
| Systems not traced | See Section O |

---

# Clinica Tutorial Discovery Audit

Review the entire Clinica codebase and identify every important player-facing mechanic, screen, feature, and system that may require a tutorial when the player encounters it for the first time.

## Critical rules

1. Do not modify, refactor, rename, delete, or generate any code.
2. Do not implement tutorials.
3. Do not alter game balance, progression, routes, save data, or UI.
4. This is a read-only code audit.
5. Trace actual code behavior rather than relying only on filenames or comments.
6. Clearly distinguish:

   * Implemented and reachable
   * Implemented but currently unreachable
   * Partially implemented
   * Placeholder or mock data
   * Referenced but missing
7. Do not expose internal hidden mechanics in the recommended player-facing tutorial content.
8. Hidden systems may be listed privately for development awareness, but label them:
   **INTERNAL ONLY — DO NOT REVEAL TO PLAYER**
9. Important examples of hidden information include:

   * Stability resistance
   * Hidden resistance values
   * Secret multipliers
   * Invisible thresholds
   * Concealed scoring formulas
   * Enemy adaptation logic
   * Undiscovered encounter variables

The tutorial audit should focus on what the player sees, controls, chooses, earns, unlocks, or needs to understand.

---

# Part 1: Determine the application structure

Inspect the project and report:

* Framework and platform
* Main application entry point
* Navigation system
* Route definitions
* Screen directories
* Component directories
* Game-state management
* Save or persistence system
* Tutorial or onboarding state
* Feature-flag system
* Unlock and progression logic
* Battle engine location
* Clinical Care system location
* Affinity system location
* Shop and economy system locations
* Inventory and equipment locations
* Quest system location
* University or lesson system location

Include the exact file paths for each.

---

# Part 2: Reconstruct the real player journey

Trace the code beginning with a brand-new player and create the actual expected sequence.

Start from:

1. App launch
2. New game
3. Account, profile, or save creation
4. Opening questionnaire or player customization
5. Class, role, or identity selection
6. Initial loadout
7. Opening story or cutscene
8. First battle
9. Defeat, Silent Infarction, or Lotus Recall
10. Arrival at Clinica
11. Clinica University
12. First lesson
13. First mission
14. First reward
15. First shop visit
16. First inventory or equipment use
17. First affinity interaction
18. First Clinical Care encounter
19. First quest interaction
20. First use of each major hub feature

For every step, report:

* Screen or route
* File path
* Entry condition
* Required player action
* Exit condition
* Next destination
* Mechanics introduced
* Whether the feature is explained
* Whether the feature is practiced
* Whether the player can skip or leave
* Whether the system appears before its prerequisites are taught

Also identify alternate routes caused by learner mode, difficulty, class selection, or previous save state.

---

# Part 3: Inventory all player-facing screens

Find every screen, modal, overlay, major panel, and navigable game area.

For each one, report:

| Field               | Required information                                                 |
| ------------------- | -------------------------------------------------------------------- |
| Screen name         | Player-facing and code name                                          |
| Route               | Navigation route or state                                            |
| File path           | Exact implementation file                                            |
| Entry points        | All ways the player can reach it                                     |
| Unlock condition    | What makes it accessible                                             |
| Purpose             | What the player does there                                           |
| Important controls  | Buttons, tabs, selectors, menus                                      |
| New mechanics       | Mechanics first introduced here                                      |
| Current explanation | Dialogue, tooltip, tutorial, or none                                 |
| Risk                | What the player may misunderstand                                    |
| Tutorial need       | Required, guided practice, contextual prompt, optional help, or none |

Include locked, empty, error, reward, confirmation, and completed states when the code supports them.

---

# Part 4: Inventory important player-facing mechanics

Identify every meaningful mechanic that may require a first-use introduction.

Prioritize:

## Core navigation and onboarding

* Main menu
* New game and continue
* Save system
* Character creation
* Questionnaire
* Class or role selection
* Learner mode selection
* Loadout selection
* Hub navigation
* Back navigation
* Locked tabs and unlock messages

## Combat

* Movement
* Positioning
* Turn order
* Initiative display
* Basic attack
* Skill selection
* Target selection
* Range
* Area of effect
* Resource costs
* Cooldowns
* Visible health or condition states
* Visible status effects
* Party roles
* Ally selection
* Enemy inspection
* Victory
* Defeat
* Retreat
* Retry
* Reassessment after battle-state changes

## Affinity system

Report only the player-facing rules as tutorial recommendations.

Determine:

* Affinity names
* Affinity icons
* Where affinity appears
* Whether heroes have affinity
* Whether enemies have affinity
* Whether skills have affinity
* Whether equipment has affinity
* Whether environments have affinity
* How the player inspects affinity
* What visible feedback appears for favorable or unfavorable interactions
* When affinity first affects a meaningful choice
* Whether an affinity chart or Codex exists
* Whether affinities unlock gradually
* Which code controls the affinity calculation

Do not recommend revealing hidden multipliers, hidden resistances, thresholds, or internal formulas.

## Clinical Care

Trace the full player-facing Clinical Care loop:

* Entry trigger
* Assessment options
* Available clues
* Clue collection
* Priority selection
* Intervention selection
* Treatment or action confirmation
* Feedback
* Reassessment
* Escalation
* Success
* Partial success
* Failure
* Reflection or rationale
* Rewards
* Differences by learner mode
* Differences between combat and University cases

Identify the first encounter where each step becomes necessary.

Do not reveal the correct answer, hidden case scoring, deterioration thresholds, concealed variables, or invisible resistance systems in tutorial recommendations.

## Progression and rewards

* Experience
* Player level
* Hero level
* Skill level
* Competency
* Mastery
* Rank
* Chapter progression
* Lesson completion
* Unlock notifications
* Achievement systems
* Reward claiming
* Daily rewards
* Milestone rewards

## Inventory and equipment

* Inventory access
* Item categories
* Consumables
* Equipment
* Equip and unequip
* Equipment comparison
* Rarity
* Sorting and filtering
* Upgrade materials
* Enhancement
* Dismantling
* Selling
* Item locking
* Irreversible actions
* Capacity limits

## Shops and economy

Find every shop, vendor, market, exchange, summon system, purchase screen, and upgrade shop.

For each shop, report:

* Shop name
* Route or location
* File path
* Unlock condition
* Inventory source
* What it sells
* Currency accepted
* Buy function
* Sell function
* Refresh function
* Exchange function
* Purchase limits
* Confirmation behavior
* Rare-currency warnings
* Real-money connection, if present
* Placeholder behavior
* First point where the player can enter
* First point where the player can afford something

## Currency

Find all currency definitions, balances, icons, earn sources, and spending destinations.

For each currency, report:

| Field                      | Information                                           |
| -------------------------- | ----------------------------------------------------- |
| Code identifier            | Internal variable or key                              |
| Player-facing name         | Displayed name                                        |
| Icon                       | Asset or component                                    |
| Classification             | Common, progression, rare, premium, event, or unknown |
| Earn sources               | Where it is awarded                                   |
| Spend locations            | Where it is used                                      |
| First acquisition          | Earliest player event                                 |
| First spending opportunity | Earliest valid use                                    |
| Display locations          | Header, inventory, shop, etc.                         |
| Expiration                 | Whether it expires                                    |
| Reversibility              | Whether spending can be undone                        |
| Tutorial status            | Existing explanation or missing                       |

Flag currencies that:

* Appear before they are explained
* Can be spent before their value is understood
* Use similar names or icons
* Are displayed without a known purpose
* Have no earn source
* Have no spending destination
* Are implemented only as placeholders

## Quests and activities

* Main quests
* Side quests
* Tutorial quests
* Daily quests
* Weekly quests
* Milestone quests
* Quest tracking
* Quest claiming
* Objective completion
* Notification markers
* Expiration
* Failure
* Replay

## Education and support systems

* Clinica University
* Lessons
* Simulations
* Clinical cases
* Codex
* Help menu
* Medical glossary
* Affinity reference
* Public health board
* Career pathways
* Mentorship
* Wellness or journaling
* Daily health activities
* Community features

---

# Part 5: Locate existing tutorial systems

Search the entire codebase for:

* tutorial
* onboarding
* walkthrough
* coach mark
* tooltip
* spotlight
* first visit
* first use
* has seen
* seen tutorial
* completed tutorial
* tutorial step
* tutorial state
* intro
* help
* hint
* guide
* mentor dialogue
* system message
* Codex
* explanation modal
* feature discovery
* locked message
* unlock message

Report:

* File paths
* State variables
* Persistence keys
* Trigger conditions
* Completion conditions
* Skip behavior
* Replay behavior
* Reset behavior
* Whether tutorial state is account-wide, save-specific, character-specific, or session-only
* Whether tutorial completion is actually saved
* Whether tutorial triggers can repeat unexpectedly
* Whether different systems use inconsistent tutorial logic

Also identify tutorial components that exist but are unused.

---

# Part 6: Find first-use triggers

For every important mechanic, determine the earliest point where the player can:

* See it
* Enter it
* Interact with it
* Make a meaningful decision using it
* Fail because they do not understand it

The recommended tutorial trigger should usually occur at the first meaningful interaction, not merely when the icon first becomes visible.

For each mechanic, report:

| Mechanic | First visible | First interactive | First meaningful decision | Current tutorial trigger | Recommended trigger |
|---|---|---|---|---|---|

---

# Part 7: Tutorial prerequisite audit

Identify mechanics that depend on other mechanics.

Examples:

* Skill selection requires targeting knowledge
* Affinity requires knowing how to inspect heroes or enemies
* Clinical intervention requires clue recognition
* Reassessment requires understanding changing conditions
* Shops require understanding currency
* Equipment upgrades require understanding materials
* Quest claiming requires understanding quest tracking

Create a dependency map:

**Prerequisite mechanic → dependent mechanic**

Flag any situation where a dependent mechanic is introduced before its prerequisite.

---

# Part 8: Hidden-system protection audit

Inspect internal gameplay systems that affect visible outcomes.

Examples may include:

* Stability systems
* Resistance systems
* Hidden modifiers
* Case scoring
* Difficulty scaling
* Enemy adaptation
* AI decision weights
* Randomization
* Critical thresholds
* Progression multipliers

For each one, report privately:

* Internal system name
* File path
* Which visible mechanic it affects
* Whether the UI currently exposes it
* Whether current dialogue accidentally reveals it
* Whether tutorial wording could contradict it

Label every entry:

**INTERNAL ONLY — DO NOT REVEAL TO PLAYER**

Do not include exact formulas unless needed to identify a contradiction or bug.

---

# Part 9: Learner-mode audit

Trace differences between all available player modes, such as:

* Non-medical
* Medical learner
* NCLEX preparation
* Difficulty modes
* Accessibility modes

For each mode, report:

* Visible clues
* Hidden clues
* Terminology
* Hint availability
* Feedback detail
* Incorrect-answer handling
* Tutorial differences
* Clinical Care differences
* Affinity differences
* Reward differences
* Progression differences

Flag tutorial logic that assumes only one mode.

---

# Part 10: Return a tutorial audit table

Produce one consolidated table with one row for every important mechanic.

Required columns:

| Mechanic | Category | First appearance | File path | Unlock condition | Player action | Existing tutorial | Tutorial priority | Tutorial type | What to teach | What not to reveal | Completion condition | Replay location | Problems found |
| -------- | -------- | ---------------- | --------- | ---------------- | ------------- | ----------------- | ----------------- | ------------- | ------------- | ------------------ | -------------------- | --------------- | -------------- |

Use these tutorial types:

* Required guided tutorial
* Controlled practice encounter
* Contextual first-use prompt
* Optional Help or Codex entry
* No tutorial required

Use these priorities:

* Critical
* High
* Medium
* Low
* None

---

# Part 11: Prioritize important tutorials only

Do not recommend tutorials for every button.

Prioritize tutorials when misunderstanding could cause:

* Failure in a core encounter
* Loss of rare resources
* Incorrect clinical reasoning
* Confusion about progression
* Confusion about affinity
* Confusion about Clinical Care
* Confusion about shops or currency
* An irreversible action
* Inability to continue
* A major mismatch between player expectation and game behavior

Avoid mandatory tutorials for:

* Standard back buttons
* Obvious navigation
* Decorative elements
* Familiar interface conventions
* Minor settings
* Information already taught and practiced elsewhere

---

# Part 12: Final output sections

Return the audit in this exact order:

## A. Executive summary

Summarize the largest tutorial gaps and risks.

## B. Actual new-player route

Show the complete new-player sequence found in the code.

## C. Screen inventory

List all reachable screens and important states.

## D. Important mechanic inventory

List all important player-facing mechanics.

## E. First-use tutorial audit table

Provide the consolidated tutorial table.

## F. Affinity tutorial findings

Describe the player-facing introduction needed without exposing hidden calculations.

## G. Clinical Care tutorial findings

Describe the staged tutorial flow without revealing correct answers or hidden factors.

## H. Shops and currency findings

List every shop and currency, including when each first appears.

## I. Tutorial dependency map

Show prerequisites and dependent mechanics.

## J. Existing tutorial infrastructure

Explain what is already implemented and whether it persists correctly.

## K. Hidden-system protection notes

Mark all content as internal-only.

## L. Missing, unreachable, or contradictory systems

Identify code that is incomplete, duplicated, inaccessible, or inconsistent.

## M. Recommended tutorial sequence

Recommend the order in which tutorials should appear during normal progression.

## N. Files reviewed

List all important files inspected.

## O. Uncertainties

Clearly identify anything that could not be confirmed from the code.

Do not make any code changes.

---

# AUDIT FINDINGS

> All findings below were produced by read-only codebase inspection on 2026-08-02.  
> No application source files were modified.

---

## Part 1 — Application Structure

| System | Location |
|---|---|
| **Framework** | Expo 54 (React Native + Expo Router), web port 5000 |
| **Entry point** | `frontend/app/index.tsx` — waits for player store, redirects to `/title` |
| **Root layout** | `frontend/app/_layout.tsx` — Stack (headerShown:false); wraps Player, Settings, Tutorial, TestSession providers |
| **Navigation** | File-based Expo Router; tabs in `frontend/app/(tabs)/_layout.tsx`; dynamic segments `[id]`/`[nodeId]` |
| **Tab screens** | `/(tabs)/index`, `/(tabs)/heroes`, `/(tabs)/codex`, `/(tabs)/kingdom`, `/(tabs)/faction`, `/(tabs)/profile`, `/(tabs)/shop` |
| **Game-state store** | `frontend/src/game/store.tsx` (2 788 lines); `PlayerState` defined in `frontend/src/game/types.ts:238–472` |
| **Player persistence** | AsyncStorage key `clinica.player.v2` (`store.tsx:34`) |
| **Tutorial persistence** | AsyncStorage key `clinica.tutorials.v1` (`frontend/src/game/tutorialStore.tsx:7`) |
| **Tutorial/onboarding state** | `PlayerState` fields: `onboarding_complete`, `tutorial_summon_1_done`, `tutorial_summon_2_done`, `seen_lv2_unlock`, `seen_university_intro`, `seen_florence_cameo`, `seen_boss_narrator`, `seen_reminiscence`, `seen_practice_curriculum`, `seen_card_tutorial`, `seen_call_tutorial`, `seen_fluid_phantom_counter_tutorial`, `seen_lord_imbalance_expertise_tutorial` |
| **Feature-flag / unlock system** | `frontend/src/game/progression.ts` — `FEATURE_UNLOCKS` keyed by feature name, value = minimum player level |
| **Unlock/progression logic** | `progression.ts` (XP curve, stamina, level gates); `frontend/src/game/university.ts` (certification stars/caps); `frontend/src/game/milestones.ts` (one-time rewards) |
| **Battle engine** | UI: `frontend/app/battle.tsx`; Engine: `frontend/src/game/battle.ts`; Support: `battleXp.ts`, `battleAssets.ts` |
| **Clinical Care system** | `frontend/src/game/clinical.ts` (domain, action types, clue resolution, chain roles, cue system, disease categories) |
| **Affinity system** | Types: `frontend/src/game/types.ts:18–35, 112–180`; Runtime: `frontend/src/game/battle.ts` (`getAffinityModifier`, `calcAffinityFamilyMod`); Reference UI: `frontend/app/compendium.tsx` |
| **Shop / economy** | Economy definitions: `frontend/src/game/economy.ts`; Shop catalog: `frontend/src/game/shop.ts`; Shop hub helpers: `frontend/src/game/shopHub.ts`; UI: `frontend/app/shop.tsx`, `frontend/app/shop-section/[id].tsx`, `frontend/app/(tabs)/shop.tsx` |
| **Inventory / equipment** | Item bag UI: `frontend/app/item-bag.tsx`; Materials: `frontend/app/materials.tsx`; Equipment definitions: `frontend/src/game/equipment.ts`; Equipment state/actions: `frontend/src/game/store.tsx` (`owned_equipment`, `hero_equipment`, `equipItem`, `unequipItem`) |
| **Quest / milestone system** | `frontend/src/game/milestones.ts`; UI: `frontend/app/milestones.tsx`; Daily/weekly: `frontend/src/game/dailyRounds.ts`; Journey: `frontend/src/game/journeyRewards.ts` + `frontend/app/journey.tsx` |
| **University / lesson system** | `frontend/src/game/university.ts`, `lessons.ts`, `uniPractice.ts`, `practiceCurriculum.ts`; Routes: `frontend/app/university/` (26 screens) |

---

## Part 2 — New-Player Route (Code-Traced)

### Entry resolver (`frontend/src/game/route.ts:13–23`)

```
No player record → /prologue → /opening-prologue
prologue_complete:false → /prologue → /opening-prologue (or /battle?tutorial=1 legacy)
identity_restored:false OR diagnostic_intro_seen:false → /post-recall
seen_reminiscence:false → /reminiscence
Otherwise → /(tabs)
```

### Step-by-step sequence

| # | Screen | Route | File | Entry condition | Required action | Exit | Next | Mechanics introduced | Explained? | Skippable? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Boot splash | `/` | `app/index.tsx` | Always | None (auto-redirect) | Player store ready | `/title` | Rotating Codex hints (passive) | Yes (hints) | No |
| 2 | Title | `/title` | `app/title.tsx` | Always | Tap Start Game / Continue | Tap | `/preloader` | None | Yes (label copy) | No |
| 3 | Preloader | `/preloader` | `app/preloader.tsx` | Always | None (asset warm, 2.4–12 s) | Assets loaded | `resolveEntryRoute` | None | No | No |
| 4 | Prologue router | `/prologue` | `app/prologue.tsx` | No existing player | Spinner (auto-creates player) | Auto | `/opening-prologue` | None | No | No |
| 5 | Opening Prologue | `/opening-prologue` | `app/opening-prologue.tsx` | `opening_prologue_complete:false` | 8-phase cinematic: taps + battle interaction | Phase Complete × 8 | `/lotus-recall` then `/post-recall` | Narrative/world, battle tutorial (AP, skills, Care Chain), enemy corruption, scripted defeat, Lotus Recall | Yes (scenes + tutorial) | No |
| 6 | Lotus Recall | `/lotus-recall` | `app/lotus-recall.tsx` | Scripted defeat | Tap Continue (after ~1.8 s) | Tap | `/post-recall` | Lotus Recall mechanic (narrative rebirth) | Yes (story copy) | No |
| 7 | Post-Recall / Identity | `/post-recall` | `app/post-recall.tsx` | `identity_restored:false` | Name → diagnostic quiz → class assign → confirm | Confirm | `/reminiscence` (first time) | Identity, class/element diagnostic, class assignment | Yes (UI guidance + quiz copy) | Partially (per-question skip; class auto-assign; full flow not skippable) |
| 8 | Reminiscence | `/reminiscence` | `app/reminiscence.tsx` | `seen_reminiscence:false` | Scene progression taps | Scene end | `/(tabs)` | Memory/story transition | Yes (story) | No |
| 9 | Home Hub | `/(tabs)` | `app/(tabs)/index.tsx` | Always (post-onboarding) | Tap University/mode cards | Varies | Hub navigation | Objective onboarding, hub cards, XP/level, stamina, currencies | Partially (guided messages, no hands-on tutorial) | Yes |
| 10 | University | `/university` | `app/university/index.tsx` | Lv1 | Tap lesson card | Tap | `/university/lesson/[id]` | Lesson system, Lotus Journey, department navigation | Yes (System Narrator guide, BannerCards) | Yes |
| 11 | First Lesson | `/university/lesson/[id]` | `app/university/lesson/[id].tsx` | Lv1 | Read + complete lesson | Complete | University index + XP | Lesson completion, XP gain, University Credits | Yes (lesson content) | No |
| 12 | Ward Shift (hub) | `/shift` | `app/shift.tsx` | Lv1 + first lesson started | Tap mode card | Tap | `/shift-cases` or mode detail | Mode hub, stamina cost, daily rounds, locked modes | Partially (locked notices, lesson CTA) | Yes |
| 13 | Case Selection | `/shift-cases` | `app/shift-cases.tsx` | Lv1 + first lesson | Tap case / Begin | Begin | `/battle` | Rotating cases, stamina spend, auto-sweep | Partially (daily-quest subtitle, lesson bridge) | Yes (can return) |
| 14 | Mission Loadout | `/mission-loadout` | `app/mission-loadout.tsx` | Pre-battle | Select hero team, Begin | Begin | `/battle` | Hero slots, team composition | Partially (skill preview, badges) | Yes (back) |
| 15 | Battle | `/battle` | `app/battle.tsx` | From loadout | AP spend, skill use, End Turn | Victory or Defeat | `/result` or `/lotus-recall` | AP, skills, Care Chain, Clinical Cues, affinity, corrupton, turn flow | Yes in prologue (guided tutorial); contextual in regular battle | No (cannot leave mid-battle) |
| 16 | Result | `/result` | `app/result.tsx` | Post-battle | Tap Claim / Next | Tap | Hub | Stars, XP, rewards, clinical summary | Yes (WHAT YOU LEARNED section) | No |
| 17 | First recruitment (Ceremony) | `/university/recruit` | `app/university/recruit.tsx` | `tutorial_summon_1_done:false` after first shift | Tap guaranteed pull × 2 | Complete | Hub | Recruitment, hero acquisition, Codex Shards | Yes (ceremony tutorial) | Partially (ceremony is guided) |
| 18 | Summoning Hall | `/summon` | `app/summon.tsx` | Lv2 + ceremony done | Tap 1-pull or 10-pull | Pull result | Heroes roster / summon result | Gacha system, pity, duplicate shards | No dedicated tutorial |
| 19 | First shop access | `/(tabs)/shop` → `/shop` | `app/shop.tsx` | Lv3 (Apothecary) | Browse, tap category | Tap | `/shop-section/[id]` | Shop tabs, currency exchange preview | No dedicated tutorial |
| 20 | Ward Defense | `/ward-defense` | `app/ward-defense.tsx` | Lv4 | Deploy units, run wave | Wave end | Result | Tower-defense variant, unit deployment, wave mechanics | Yes (wardDefenseIntro tutorial) |

**Alternate routes:**
- Legacy player with `prologue_complete:false` → `/battle?tutorial=1` directly (skips cinematic opening)
- Player who has `identity_restored:false` after prologue → `/post-recall` only (no opening-prologue re-run)
- `learning_profile` selection changes explanation depth but does not alter route sequence
- `diagnostic_intro_seen:false` after prologue → `/post-recall` (captures legacy accounts)

---

## Part 3 — Screen Inventory

### Hub & Navigation Screens

| Screen name | Route | File | Unlock | Purpose | New mechanics | Existing explanation | Tutorial need |
|---|---|---|---|---|---|---|---|
| Boot splash | `/` | `app/index.tsx` | Always | Boot loader | Rotating Codex hints | Passive hints | None |
| Title | `/title` | `app/title.tsx` | Always | Start/continue entry | None | Label copy | None |
| Preloader | `/preloader` | `app/preloader.tsx` | Always | Asset warm-up | None | Progress bar | None |
| Home Hub | `/(tabs)/index` | `app/(tabs)/index.tsx` | Post-prologue | Central dashboard | Objectives, banners, modes, XP bar, stamina, currencies | Guided hub messages, unlock CTA | **High** (first visit) |
| Profile | `/(tabs)/profile` | `app/(tabs)/profile.tsx` | Always | Account identity, stats, settings | Player level, class abilities, reset | Stat labels | Low |
| Faction / Community | `/(tabs)/faction` | `app/(tabs)/faction.tsx` | Lv3 (Community Board) | Faction standing, public health board | Faction reputation, board tasks | Board copy | Medium |
| Mode Hub | `/shift` | `app/shift.tsx` | Lv1 + lesson | Choose Ward Shift / WD / Boss / Events | Stamina, daily rounds, locked modes | Locked notices, lesson CTA | **High** |
| Mode Briefing | `/mode/[id]` | `app/mode/[id].tsx` | Mode-specific gate | Explain mode before launch | Mode rules, rewards, costs | BRIEFING + HOW IT WORKS bullets | Medium (first mode: High) |
| Economy Guide | `/economy` | `app/economy.tsx` | Always | Informational currency reference | All currencies | Full reference | Low (reference only) |
| Materials Guide | `/materials` | `app/materials.tsx` | Always | Material catalog + earn sources | Material sources | Full reference | Low |
| Learning Profile | `/learning-profile` | `app/learning-profile.tsx` | Always | Set explanation depth | 4 learner modes | Screen copy explains each mode | Low |
| Events Hub | `/events` | `app/events.tsx` | No direct gate | Event tracks and offers | Timed events, offers | Preview/locked badges | Low |

### Story & Onboarding Screens

| Screen name | Route | File | Unlock | Purpose | New mechanics | Tutorial need |
|---|---|---|---|---|---|---|
| Opening Prologue | `/opening-prologue` | `app/opening-prologue.tsx` | No player | 8-phase cinematic + battle tutorial | Battle, Lotus Recall | **Critical** (contains it) |
| Lotus Recall | `/lotus-recall` | `app/lotus-recall.tsx` | Scripted defeat | Story rebirth narrative | Lotus Recall concept | None (narrative carries it) |
| Post-Recall / Identity | `/post-recall` | `app/post-recall.tsx` | Prologue complete | Character name, quiz, class selection | Identity, class diagnostic | **Critical** (contains it) |
| Reminiscence | `/reminiscence` | `app/reminiscence.tsx` | `seen_reminiscence:false` | Memory scene transition | Memory story mechanic | Low |
| Story Scene | `/story-scene` | `app/story-scene.tsx` | Triggered by chapter progress | Manhwa ink cutscene | Story beat | Low |
| Class Result | `/class-result` | `app/class-result.tsx` | Post-diagnostic | Class assignment display | Class role and element | Medium |
| Onboarding | `/onboarding` | `app/onboarding.tsx` | Alternative player-creation path | Alternative onboarding | Account creation | Medium (alternate path only) |

### Battle & Combat Screens

| Screen name | Route | File | Unlock | Purpose | New mechanics | Existing explanation | Tutorial need |
|---|---|---|---|---|---|---|---|
| Case Selection | `/shift-cases` | `app/shift-cases.tsx` | Lv1 + lesson | Daily rotating case picker | Rotating cases, stamina, auto-sweep | Daily quest subtitle, lesson bridge | **High** |
| Mission Loadout | `/mission-loadout` | `app/mission-loadout.tsx` | Pre-battle | Hero team assembly | Team slots, hero roles | Skill preview, role/element badges | Medium |
| Battle | `/battle` | `app/battle.tsx` | From loadout | Core combat loop | AP, skills, Care Chain, Cues, affinity, turn flow | Prologue tutorial (guided); contextual in-battle | **Critical** |
| Hero Select | `/hero-select` | `app/hero-select.tsx` | From hub/loadout | Alternative hero selection | Hero list | Badges | Low |
| Result | `/result` | `app/result.tsx` | Post-battle | Outcome, stars, rewards, summary | Stars, XP, shards, clinical form | Strong: WHAT YOU LEARNED section | Medium |
| Lotus Recall (defeat) | `/lotus-recall` | `app/lotus-recall.tsx` | Defeat | Defeat narrative | Rebirth concept | Story copy | Low (narrative sufficient) |
| Boss Battle | `/boss` | `app/boss.tsx` | Lv9 | Boss encounter | Boss mechanics, world boss drops | Narrator intro | **High** |
| World Event | `/world-event` | `app/world-event.tsx` | Lv7 | Outbreak board + participatory phases | Collective containment, Epidemic Tokens | Lore, meter, phase descriptions | **High** (first event) |

### Ward Defense Screens

| Screen name | Route | File | Unlock | Purpose | New mechanics | Tutorial need |
|---|---|---|---|---|---|---|
| Ward Defense | `/ward-defense` | `app/ward-defense.tsx` | Lv4 | Tower-defense combat | Unit deployment, pathing, condition badges, Code Blue, triage | **High** (wardDefenseIntro tutorial exists) |

### University Screens

| Screen name | Route | File | Unlock | Purpose | Tutorial need |
|---|---|---|---|---|---|
| University Hub | `/university` | `app/university/index.tsx` | Lv1 | Learning hub | **High** (seen_university_intro trigger) |
| Lessons List | `/university/lessons` | `app/university/lessons.tsx` | Lv1 | Browse lessons | Medium |
| Lesson | `/university/lesson/[id]` | `app/university/lesson/[id].tsx` | Lv1 | Complete lesson | Low (self-guided) |
| Department | `/university/department/[id]` | `app/university/department/[id].tsx` | Lv1 | Department courses | Low |
| Schools | `/university/schools` | `app/university/schools.tsx` | Lv1 | Browse schools | Low |
| Practice | `/university/practice` | `app/university/practice.tsx` | Lv1 | Clinical practice | Medium |
| Cue Lab | `/university/cue-lab` | `app/university/cue-lab.tsx` | Lv1 | Standalone cue practice | Low (no tutorial overlay) |
| Cue Hunt | `/university/cue-hunt` | `app/university/cue-hunt.tsx` | Lesson gate | Guided clue-hunt lesson | **High** (cueHuntIntro tutorial exists) |
| Cue Hunt Lesson | `/university/cue-hunt-lesson` | `app/university/cue-hunt-lesson.tsx` | Lesson gate | Cue hunt in lesson | High |
| Rapid Triage | `/university/rapid-triage` | `app/university/rapid-triage.tsx` | Lesson gate | Triage practice | High (rapidTriageIntro exists) |
| Stabilize Lesson | `/university/stabilize-lesson` | `app/university/stabilize-lesson.tsx` | Lesson gate | Stabilize practice | High |
| Stabilize Stack | `/university/stabilize-stack` | `app/university/stabilize-stack.tsx` | Lesson gate | Stacking stabilize | High (stabilizeStackIntro exists) |
| Stabilize Complete | `/university/stabilize-complete` | `app/university/stabilize-complete.tsx` | Post-lesson | Stabilize lesson done | Low |
| Stack Lab | `/university/stack-lab` | `app/university/stack-lab.tsx` | Lesson gate | Stack practice | Medium |
| Triage Hall | `/university/triage-hall` | `app/university/triage-hall.tsx` | Lesson gate | Triage hall | Medium |
| Triage Lesson | `/university/triage-lesson` | `app/university/triage-lesson.tsx` | Lesson gate | Triage lesson | High |
| Triage Complete | `/university/triage-complete` | `app/university/triage-complete.tsx` | Post-lesson | Triage lesson done | Low |
| Lotus Lesson | `/university/lotus-lesson/[nodeId]` | `app/university/lotus-lesson/[nodeId].tsx` | Lotus journey node | Lotus journey step | Medium |
| Simulation | `/university/simulation/[id]` | `app/university/simulation/[id].tsx` | Lv1 (advanced: Lv25) | Clinical simulation | **High** |
| Apply It | `/university/apply-it` | `app/university/apply-it.tsx` | Post-lesson | Apply lesson concept | Medium |
| Training | `/university/training` | `app/university/training.tsx` | Lv1 | Hero XP training hall | Medium |
| Skill Academy | `/university/skill-academy` | `app/university/skill-academy.tsx` | Lv1 | Global skill upgrades | **High** |
| Recruit | `/university/recruit` | `app/university/recruit.tsx` | Lv2 (Lv12 for 10-pull) | Hero recruitment | **High** (ceremony tutorial exists) |
| Uni Shop | `/university/uni-shop` | `app/university/uni-shop.tsx` | Lv1 | University store | High |
| Uni Milestones | `/university/uni-milestones` | `app/university/uni-milestones.tsx` | Lv1 | University milestone rewards | Medium |
| Career Explorer | `/university/career-explorer` | `app/university/career-explorer.tsx` | Lv1 | Career pathway browser | Low |
| Stabilize Placeholder | `/university/stabilize-placeholder` | `app/university/stabilize-placeholder.tsx` | Lesson gate | Coming-soon stabilize slot | Low |

### Hero & Roster Screens

| Screen name | Route | File | Unlock | Purpose | Tutorial need |
|---|---|---|---|---|---|
| Hall of Heroes | `/(tabs)/heroes` | `app/(tabs)/heroes.tsx` | Lv2 | Roster + team management | **High** (heroesIntro exists) |
| Hero Profile | `/hero/[id]` | `app/hero/[id].tsx` | Own hero | Stats, lore, skills, progression | Medium |
| Hero Picker | `/hero-picker` | `app/hero-picker.tsx` | Team slot assignment | Assign hero to slot | Low |
| Hero Audit (dev) | `/hero-audit` | `app/hero-audit.tsx` | Dev only | Hero data audit | None (dev tool) |

### Kingdom / Realm Screens

| Screen name | Route | File | Unlock | Purpose | Tutorial need |
|---|---|---|---|---|---|
| Realm Hub | `/(tabs)/kingdom` | `app/(tabs)/kingdom.tsx` | Lv5 + first Ward Shift | Settlement / production | **High** (kingdomIntro exists) |

### Progression & Reward Screens

| Screen name | Route | File | Unlock | Purpose | Tutorial need |
|---|---|---|---|---|---|
| Journey | `/journey` | `app/journey.tsx` | Lv1 | Chapter journey map + chests | **High** |
| Milestones | `/milestones` | `app/milestones.tsx` | Lv1 | Level + chapter milestone rewards | Medium |
| Compendium | `/compendium` | `app/compendium.tsx` | Lv1 | Enemy/affinity reference | Medium |
| Codex | `/(tabs)/codex` | `app/(tabs)/codex.tsx` | Lv1 | Clinical knowledge + shard collection | Medium |
| Academy Path | `/academy-path` | `app/academy-path.tsx` | Lv1 | Skill/class academy progress | Medium |
| Class Tree | `/class-tree` | `app/class-tree.tsx` | Lv10 | Class skill progression | High |
| Post-Recall | `/post-recall` | `app/post-recall.tsx` | Prologue complete | Identity + class diagnostic | **Critical** |

### Shop & Economy Screens

| Screen name | Route | File | Unlock | Purpose | Tutorial need |
|---|---|---|---|---|---|
| Shop Tab | `/(tabs)/shop` | `app/(tabs)/shop.tsx` | Lv1 | Shop hub entry | Medium |
| Shop Hub | `/shop` | `app/shop.tsx` | Lv3 (Apothecary) | Shop category browser | Medium |
| Shop Section | `/shop-section/[id]` | `app/shop-section/[id].tsx` | Category-specific | Category item grid | High (first purchase) |
| Bazaar | `/bazaar` | `app/bazaar.tsx` | TBD | Bazaar marketplace | Unknown (needs further trace) |
| Embassy | `/embassy` | `app/embassy.tsx` | TBD | Embassy features | Unknown |
| Summon | `/summon` | `app/summon.tsx` | Lv2 | Gacha recruitment | **High** (summonIntro exists) |

### Wellness & Journal Screens

| Screen name | Route | File | Unlock | Purpose | Tutorial need |
|---|---|---|---|---|---|
| Lotus Journal | `/lotus-journal` | `app/lotus-journal.tsx` | Lv2 | Wellness journaling | Medium (lotusJournalIntro exists) |
| Lotus Journal Log | `/lotus-journal-log` | `app/lotus-journal-log.tsx` | Lv2 | Journal entry log | Low |
| Lotus Journal Recipes | `/lotus-journal-recipes` | `app/lotus-journal-recipes.tsx` | Lv2 | Recipe collection | Low |
| Mealcraft | `/mealcraft` | `app/mealcraft.tsx` | Lv2 | Tap-to-build plate mini-game | **High** (mealcraftIntro exists) |

### Reference & Dev Screens

| Screen name | Route | File | Purpose | Tutorial need |
|---|---|---|---|---|
| Tutorial | `/tutorial` | `app/tutorial.tsx` | Healer's Manual (static reference) | Low (self-serve) |
| Tutorial Center | `/tutorial-center` | `app/tutorial-center.tsx` | Replay tutorials | Low |
| Tutorial Encyclopedia | `/tutorial-encyclopedia` | `app/tutorial-encyclopedia.tsx` | Reference + replay hub | Low |
| Battle Audit (dev) | `/battle-audit` | `app/battle-audit.tsx` | Battle stat audit | None (dev) |
| Dev Prologue Tester | `/dev-prologue-tester` | `app/dev-prologue-tester.tsx` | Dev test | None (dev) |

---

## Part 4 — Important Player-Facing Mechanic Inventory

### Core Navigation and Onboarding

| Mechanic | Where first encountered | Explained? |
|---|---|---|
| Title screen (start / continue) | `/title` | Yes (label copy) |
| Preloader | `/preloader` | No (intentionally silent) |
| Identity creation (name, pronouns, appearance) | `/post-recall` | Yes (step-by-step UI) |
| Learner mode / learning profile selection | `/post-recall` → `learning-profile` | Partially (options labeled but consequences not detailed) |
| Class / element diagnostic and assignment | `/post-recall` → `/class-result` | Yes (quiz copy explains reasoning) |
| Hub navigation (tabs, cards, locked states) | `/(tabs)/index` | Partially (guided hub messages, no hands-on) |
| Back navigation (locked on forced-flow screens) | Battle, ward defense, cue hunt | Yes via useBlockBack |
| Locked tab unlock messages | All locked feature cards | Yes (locked notice copy) |

### Combat Mechanics

| Mechanic | First encounter | Explained? |
|---|---|---|
| AP (Action Points) — earn, spend, turn refresh | Opening prologue battle | Yes (guided tutorial step) |
| Skill selection (per-hero, once per turn) | Opening prologue battle | Yes (guided step pins required skill) |
| Hero action limit (one action per hero per turn) | Opening prologue battle | Partially (implied by UI lock) |
| Targeting (implicit — single active enemy) | Opening prologue battle | No dedicated explanation |
| End Turn (triggers enemy action) | Opening prologue battle | Yes (guided tutorial step) |
| Care Chain (Assess → Stabilize → Treat → Reassess) | Opening prologue battle | Yes (guided tutorial + CareChainStrip) |
| Clinical Cues (in-battle question, AP/stability reward) | First regular battle | Partially (reward concept shown; trigger timing not taught) |
| Perfect Cast timing prompt | First qualifying skill | No tutorial |
| Items tab in battle | First battle | No tutorial |
| Cards tab in battle | First battle (if cards held) | Yes (seen_card_tutorial flag triggers) |
| Call / Escalate tab | First available Call | Yes (seen_call_tutorial flag triggers) |
| Ultimate charge | First battle | No dedicated tutorial |
| Locked action with required clue ("Needs prior assessment") | First skill requiring Scout | Implicit via log message only |
| Victory / 3-star scoring | First battle result | Yes (result screen summary) |
| Defeat → Lotus Recall | First scripted defeat | Yes (narrative) |
| Retry / Reassessment after defeat | `/result` screen | Yes (button present) |

### Affinity System

| Mechanic | Where | Explained? |
|---|---|---|
| Element pills on enemy panel | Battle UI | Partially (primary/secondary system shown) |
| Weak Element row ("Unknown" until scouted) | Battle UI | Partially (tool tip near `battle.tsx:2123`) |
| Affinity advantage / weak feedback in battle log | Battle log | Yes (log message per action) |
| Clinical domain affinity (respiratory, cardiac etc.) | Action feedback label | Partially ("Super effective / Limited effect" label) |
| Affinity reference in Compendium | `/compendium` | Yes (CLINICAL DOMAIN section per enemy) |
| Hero affinity (strong/weak affinities) | Hero profile | No dedicated tutorial |
| Skill Calc Breakdown "Affinity match" row | Battle skill estimate | Yes (breakdown row) |

### Clinical Care Loop

| Step | First encounter | Explained? |
|---|---|---|
| Clue visibility (visible vs hidden) | First battle with hidden clues | No first-use prompt |
| Scout/Assess to reveal clues | First battle | Partially (chain strip hints next step) |
| Priority selection (picking next chain step) | Care Chain strip | Partially (strip shows next required step) |
| Inappropriate/unsafe action feedback | Wrong treatment | Yes (explicit log warning) |
| Reassessment (chain final step) | Care Chain completion | Partially (required step shown) |
| Locked action — required clue gate | First locked action | Implicit (log message only) |
| Patient condition changes between turns | Mid-battle | No explicit tutorial |

### Progression and Rewards

| Mechanic | First encounter | Explained? |
|---|---|---|
| Player XP and level | First battle result | Yes (XP bar, level-up message) |
| Hero XP and hero level | First battle result | Yes (result breakdown) |
| Hero level cap by certification star | Hero profile | No dedicated tutorial |
| Certification star promotion (shards + University Credits) | Hall of Heroes / Hero profile | Partially (shard/status chips) |
| Chapter journey stars (1–3 per encounter) | First battle result + Journey screen | Yes (stars shown, Journey map) |
| Level milestone rewards | Milestones screen | Partially (screen explains; no first-visit prompt) |
| Chapter chest rewards | Journey screen | Partially (Journey screen shows) |
| Daily objectives | Shift hub | Yes (daily rounds copy) |
| Weekly tasks | Shift hub | Partially |
| One-time milestone rewards | Milestones screen | Partially |
| Class tree unlock (Lv10) | Milestone + hub | Partially (seen_lv2_unlock modal for Lv2; no Lv10 intro) |

### Inventory and Equipment

| Mechanic | First encounter | Explained? |
|---|---|---|
| Item bag (consumables) | `/item-bag` | No first-use tutorial |
| Equipment (status: "future" — display-only catalog) | `/item-bag` or hero profile | Items shown but not equippable — no tutorial needed yet |
| Materials (earn sources, used for) | `/materials` | Yes (materials guide) |

### Shops and Economy

See Section H.

### Quests and Activities

| Mechanic | First encounter | Explained? |
|---|---|---|
| Daily objectives (3 per day, deterministic shuffle) | Shift hub (Lv2) | Yes (daily rounds copy in shift hub) |
| Weekly tasks | Shift hub (Lv2) | Partially |
| One-time milestones (17 entries) | Milestones screen | Partially |
| Chapter chests | Journey screen | Partially |
| World Event containment objectives | World event (Lv7) | Partially (phase descriptions) |
| Journey node objectives | Journey screen | Partially |

### Education and Support

| System | Location | Status | Tutorial need |
|---|---|---|---|
| Clinica University | `/university` | Implemented + reachable | **High** (first-visit intro) |
| Lessons | `/university/lesson/[id]` | Implemented | Low (self-guided) |
| Clinical simulations | `/university/simulation/[id]` | Implemented (advanced Lv25) | High |
| Cue Hunt | `/university/cue-hunt` | Implemented + has tutorial | High (tutorial exists) |
| Rapid Triage | `/university/rapid-triage` | Implemented + has tutorial | High (tutorial exists) |
| Stabilize Stack | `/university/stabilize-stack` | Implemented + has tutorial | High (tutorial exists) |
| Codex | `/(tabs)/codex` | Implemented | Medium |
| Compendium (enemy/affinity reference) | `/compendium` | Implemented | Medium |
| Tutorial / Healer's Manual | `/tutorial` | Implemented (static reference) | Low |
| Tutorial Encyclopedia | `/tutorial-encyclopedia` | Implemented (replay hub) | Low |
| Tutorial Center | `/tutorial-center` | Implemented | Low |
| Career Explorer | `/university/career-explorer` | Implemented | Low |
| Lotus Journal (wellness) | `/lotus-journal` | Implemented | Medium |
| Mealcraft (mini-game) | `/mealcraft` | Implemented + has tutorial | High |
| Public health board | `/(tabs)/faction` | Implemented (Lv3) | Medium |
| Class tree / academy path | `/class-tree`, `/academy-path` | Implemented | High |
| Mentorship / Narrator (The System) | Hub messages, university | Implemented (narrative guide) | Carried by existing copy |

---

## Part 5 — Existing Tutorial Infrastructure

### Tutorial store and overlay system

| Component | File | Key facts |
|---|---|---|
| `tutorialStore` | `frontend/src/game/tutorialStore.tsx` | AsyncStorage `clinica.tutorials.v1`; `Partial<Record<TutorialId, boolean>>` completion map; one active tutorial at a time |
| `TutorialOverlay` | `frontend/src/components/TutorialOverlay.tsx:85–355` | Typewriter text; first tap reveals, second tap dismisses; battle mode uses blocking scrim during narration; mini-game mode uses no full-screen scrim + target press guards |
| `useHighlightTarget` | `frontend/src/game/tutorialStore.tsx:268–335` | Blocks wrong targets; highlights required target; exact-match by `requiredTargetId` |
| `useClearTutorialOnExit` | `frontend/src/hooks/useClearTutorialOnExit.ts` | Calls `clearActiveTutorial` on unmount — marks in-progress tutorial complete on exit, preventing mid-flow resume |
| `useBlockBack` | `frontend/src/hooks/useBlockBack.ts` | Blocks hardware/web back on forced-flow screens; filtered to back-type actions so `router.replace` passes |

### Tutorial state variables and persistence

| Variable | Location | Scope | Notes |
|---|---|---|---|
| `clinica.tutorials.v1` | `tutorialStore.tsx` | Device-local; **not** synced with backend player record | Full reset clears it; Tutorial Center can replay/reset individual IDs |
| `clinica.player.v2` | `store.tsx:34` | Account-wide player record | Contains all `seen_*` and `tutorial_*` PlayerState flags |
| `onboarding_complete` | `PlayerState` | Account-wide | Set after prologue/identity complete |
| `tutorial_summon_1_done`, `tutorial_summon_2_done` | `PlayerState` | Account-wide | Ceremony summon gating |
| `seen_lv2_unlock` | `PlayerState` | Account-wide | One-time modal at Lv2 |
| `seen_university_intro` | `PlayerState` | Account-wide | University hub first-visit narrator |
| `seen_florence_cameo`, `seen_boss_narrator` | `PlayerState` | Account-wide | One-time boss/cameo reveals |
| `seen_reminiscence` | `PlayerState` | Account-wide | Reminiscence memory scene gate |
| `seen_practice_curriculum` | `PlayerState` | Account-wide | Practice curriculum intro |
| `seen_card_tutorial`, `seen_call_tutorial` | `PlayerState` | Account-wide | In-battle first-use card/call triggers |
| `seen_fluid_phantom_counter_tutorial`, `seen_lord_imbalance_expertise_tutorial` | `PlayerState` | Account-wide | Specific boss encounter tutorial flags |

### Trigger behavior

- **Trigger pattern:** delayed mount effect; typically waits 500–700 ms then: `if (!isCompleted(id) && !activeTutorialId) startTutorial(id)`
- **Completion:** advancing past final step marks `true`; `skipTutorial` also marks `true` (skip is permanent until replay/reset)
- **Exit mid-flow:** `useClearTutorialOnExit` marks active tutorial complete on unmount — mid-flow exit suppresses re-trigger on revisit
- **Replay:** `replayTutorial(id)` sets that ID to `false` then starts it; accessible from Tutorial Center
- **Reset:** `resetTutorials()` removes `clinica.tutorials.v1` and clears all state; full account reset (`resetPlayer`) removes both `clinica.player.v2` and `clinica.tutorials.v1`
- **Tutorial state scope:** `clinica.tutorials.v1` is device-local only; `clinica.player.v2` flags are account-wide and would sync if backend sync were implemented
- **Inconsistency:** these two layers use different persistence and reset paths, creating a split where some tutorial flags survive account reset if only `clinica.tutorials.v1` is reset but not player state

### Known TutorialIds (from tutorial-encyclopedia and tutorial-center)

`battleIntro`, `wardDefenseIntro`, `cueHuntIntro`, `rapidTriageIntro`, `stabilizeStackIntro`, `summonIntro` (ceremony), `teamIntro`, `kingdomIntro`, `lotusJournalIntro`, `mealcraftIntro`, `shopIntro`, `heroesIntro`, `systemHubIntro` (one-time only; not replayable via Tutorial Center)

### Unused or partially wired tutorial components

- `cue-lab.tsx` — no tutorial overlay; standalone practice loop only
- `stabilize-placeholder.tsx` — coming-soon slot; no tutorial
- `career-explorer.tsx` — no tutorial overlay found
- `item-bag.tsx`, `milestones.tsx`, `journey.tsx` — no first-use tutorial triggers found

---

## Part 6 — First-Use Trigger Table

| Mechanic | First visible | First interactive | First meaningful decision | Current tutorial trigger | Recommended trigger |
|---|---|---|---|---|---|
| AP system | Opening prologue battle | Opening prologue battle | First skill tap | Yes — `battleIntro` guided step | Already handled |
| Care Chain (Assess→Stabilize→Treat→Reassess) | Opening prologue battle | Opening prologue battle | First chain step | Yes — `battleIntro` guided step | Already handled |
| Clinical Cues | First regular battle | First regular battle | Answer choice | Partial — seen_card_tutorial adjacent | First Clinical Cue appearance in battle |
| Hero action limit (once per turn) | First battle | First battle | Second hero tap | No trigger | Contextual prompt on second-hero-locked state |
| Weak Element (scouted vs "Unknown") | Battle enemy panel | First Scout action | Choosing Scout vs direct treatment | Partial (tool tip near `battle.tsx:2123`) | First battle with hidden weak element |
| Care Chain affinity advantage/weak feedback | First skill with affinity match | First skill use | Treatment selection | No trigger | First skill execution with affinity match |
| Certification star promotion | Hall of Heroes (Lv2) | Hero profile | Spending shards to promote | No trigger | First time promotion becomes affordable |
| Recruitment / gacha | Recruitment ceremony | Ceremony | Guaranteed first pull | Yes — ceremony tutorial | Already handled |
| Codex Shards spend | Summon screen (Lv2) | First non-ceremony pull | Choosing 1x vs 10x | No trigger | First visit to Summon screen post-ceremony |
| Ward Defense unit deployment | Ward Defense (Lv4) | First WD run | Placing first unit | Yes — `wardDefenseIntro` | Already handled |
| Daily objectives | Shift hub (Lv2 unlock) | First claim | Choosing which objective to pursue | No trigger | First daily objectives appear |
| Level milestone reward | Milestones screen | First Lv2 claim | Claim button | Partial — `seen_lv2_unlock` modal mentions it | First visit to Milestones screen |
| Chapter chest claim | Journey screen | First chest available | Claim button | No trigger | First chapter chest unlocked |
| Realm / settlement production | Realm (Lv5) | First building place | Placing producer | Yes — `kingdomIntro` | Already handled |
| Class tree skills | Class tree (Lv10) | First class point | Choosing which branch | No trigger | First time class tree unlocks |
| Skill Academy upgrades | Skill Academy | First upgrade | Selecting upgrade tier | No trigger | First visit to Skill Academy |
| World Event participation | World Event (Lv7) | First containment action | Phase selection | No trigger | Lv7 unlock notification |
| Stamina cost per shift | Shift-cases | First case tap | Spending stamina | No trigger | First stamina spend |
| Auto-sweep | Shift-cases | First 2-star clear | Sweep button | No trigger | First sweep eligibility |
| Perfect Cast timing | First qualifying skill | First Perfect Cast prompt | Timing tap | No trigger | First Perfect Cast prompt appearance |
| Currency exchange (shop) | Shop Exchange tab | First exchange | Amount entry | No trigger (copy conflicts with canonical names) | First shop visit |
| University Credits (spend path) | University shop | First star promotion | Spending credits | No trigger | First time promotion costs are shown |

---

## Part 7 — Tutorial Prerequisite / Dependency Map

**Legend:** `A → B` means understanding A must precede introducing B

```
AP spend → Skill selection
Skill selection → Care Chain (Assess step)
Care Chain → Affinity advantage/weak (treatment selection)
Care Chain → Clue-gated action ("Needs prior assessment" lock)
Care Chain → Reassessment (final chain step)
Scout/Assess → Weak Element reveal → Affinity/counter selection
Corruption concept → Appropriate vs inappropriate treatment stakes
Player level concept → Feature unlock understanding
Player level → Hero level cap (distinct systems)
Hero level cap → Certification star promotion (star = new cap)
Certification star promotion → Shards (spending destination)
Shards (codex_shards) → Recruitment / gacha
Recruitment → Team assembly → Mission loadout
Team assembly → Battle hero selection (per-hero once per turn)
Currency (crowns) → Apothecary Market purchases
University Credits → University Shop + star promotion
Ward Shift → Ward Defense unlock (Lv4 gate)
Ward Shift stars → Chapter star milestones (Journey chests)
Daily objectives → Weekly tasks (same UI, higher bar)
University lesson → Ward Shift access (lesson gate)
```

**⚠ Dependency violations found:**

| Dependent mechanic | Prerequisite | Problem |
|---|---|---|
| Currency exchange UI in shop (labels "Jade Scrolls, Gold Crowns, Ward Tokens") | Canonical currency names taught | Exchange tab shows non-canonical names before any currency tutorial |
| Recruitment UI says "Summoning Shards" | `codex_shards` / "Codex Shards" canonical name | Name conflict appears before player knows either name |
| Ward Defense waves | Basic battle mechanics | Ward Defense has its own tutorial but introduces unit deployment without bridge from battle knowledge |
| Clinical Cues (in-battle question) | AP system and turn flow | Cue can fire mid-first-regular-battle before the player fully grasps the AP/turn loop |
| Hero action limit per turn | Basic AP/turn flow | No explicit tutorial; player discovers by trial (UI lock) |
| Perfect Cast timing | Skill selection | Prompt appears without prior teaching |
| Class tree skills (Lv10) | Class/element assignment (post-recall) | No first-visit tutorial at Lv10 unlock |

---

## Part 8 — Hidden-System Protection Notes

> **INTERNAL ONLY — DO NOT REVEAL TO PLAYER**
> All entries in this section are private development findings.
> None of this information should appear in player-facing tutorial copy.

### 1. Stability-resistance dampener

**INTERNAL ONLY — DO NOT REVEAL TO PLAYER**

- **Internal name:** `stabilityResistance` / `stabilityResistanceMultiplier`
- **Files:** `frontend/src/game/types.ts:141–145`; `frontend/src/game/clinical.ts:1060–1079`; `frontend/src/game/battle.ts:1238–1250`, `1341–1361`, `764–766`
- **Visible mechanic affected:** displayed Stability recovery from skills, temporary actions, cards, and completed care pathways; resistant bosses recover less than the listed action amount
- **UI exposure:** resistance value is not exposed; listed action amount is shown while delivered gain is silently reduced
- **Tutorial leakage risk:** wording such as "bosses resist healing," "recovery is reduced," or "stabilization won't stick" would reveal this. Safe guidance: "Use appropriate care actions consistently for best results."

### 2. Corruption outcome algorithm / clinical status scoring

**INTERNAL ONLY — DO NOT REVEAL TO PLAYER**

- **Internal name:** `getCorruptionOutcome`; appropriateness status: `locked / unsafe / inappropriate / weak / appropriate / strong`
- **Files:** `frontend/src/game/clinical.ts:842–931`, `1118–1153`; `frontend/src/game/battle.ts:724–772`, `824–840`, `1232–1260`, `1291–1367`
- **Visible mechanic affected:** corruption reduction/worsening, stability penalties, care-chain progress, feedback labels
- **UI exposure:** player-visible status labels/rationales are shown (`clinical.ts:857–875`); internal multipliers and penalty scaling are not
- **Tutorial leakage risk:** explaining that exact status tiers determine corruption changes by specific amounts would reveal scoring. Safe guidance: "Appropriate care reduces the patient's distress; unsafe care can make them worse."

### 3. Difficulty and chapter corruption harshness scaling

**INTERNAL ONLY — DO NOT REVEAL TO PLAYER**

- **Internal name:** `getChapterCorruptionScale`, `getCorruptionPenaltyScale`
- **Files:** `frontend/src/game/clinical.ts:1081–1115`; `frontend/src/game/battle.ts:736–752`, `1732`
- **Visible mechanic affected:** wrong-treatment penalties, corruption spread, stability damage, late-game pressure
- **UI exposure:** difficulty mode is visible; resulting state changes are visible; the hidden chapter/difficulty scaling curve is not
- **Tutorial leakage risk:** avoid stating that "later chapters or harder modes make wrong care X times harsher." Safe guidance: "As you advance through the chapters, clinical precision becomes increasingly important."

### 4. Hidden pathology defense (unrevealed-clue defense)

**INTERNAL ONLY — DO NOT REVEAL TO PLAYER**

- **Internal name:** `hiddenDefense`
- **Files:** `frontend/src/game/types.ts:185–203`; `frontend/src/game/battle.ts:862–869`, `879–923`, `1895–2060`
- **Visible mechanic affected:** strike, stabilization, and shield effectiveness while clues remain hidden
- **UI exposure:** not exposed; the breakdown preview may show a generic modifier row but does not identify this mechanism
- **Tutorial leakage risk:** "Your actions are less effective when the patient's condition is unknown" would reveal it. Safe guidance: "Assessing a patient first helps you provide better care."

### 5. Per-enemy stabilityResistance affecting all stability-gain paths

**INTERNAL ONLY — DO NOT REVEAL TO PLAYER**

- **Internal name:** per-enemy `stabilityResistance` field
- **Files:** `frontend/src/game/types.ts:141–145`
- **Visible mechanic affected:** all stability gains (skill, item, card, temp action, care chain) are dampened silently for high-resistance enemies
- **UI exposure:** none; the value is an enemy field not shown in the Compendium or battle panel
- **Tutorial leakage risk:** any reference to resistance to stabilization by specific enemy type would reveal it

### 6. Diminishing returns on stability gain from current stability level

**INTERNAL ONLY — DO NOT REVEAL TO PLAYER**

- **Internal name:** `getStabilityGainModifier` (diminishing-returns curve)
- **Files:** `frontend/src/game/clinical.ts:1060–1079`
- **Visible mechanic affected:** stabilize skill effectiveness when patient stability is already high
- **UI exposure:** none
- **Tutorial leakage risk:** "stabilize is less effective when the patient is already stable" would reveal this curve

### 7. Hero XP contribution split formula

**INTERNAL ONLY — DO NOT REVEAL TO PLAYER**

- **Internal name:** contribution XP split (damage/heal/shield/reveal/AP contribution weights; floored at 40% of equal share; overleveled heroes at 35%)
- **Files:** `frontend/src/game/progression.ts:361–402`
- **Visible mechanic affected:** per-hero XP gain after battle
- **UI exposure:** result screen shows per-hero XP; formula is not shown
- **Tutorial leakage risk:** safe to say "heroes who contribute more earn more experience." Avoid specific percentage values.

---

## Part 9 — Learner-Mode Audit

### Available learning profile IDs

| Canonical ID | Player-facing label | Legacy ID (now deprecated) |
|---|---|---|
| `curious` | "Just Curious" / general player | `nonmedical` |
| `nursing_student` | "Nursing Student / Pre-nursing" | `nursingStudent`, `preNursing` |
| `nclex` | "NCLEX Preparation" | `nclexPrep` |
| `professional` | "Healthcare Professional / Clinician Review" | `healthcareProfessional` |

**Source:** `frontend/src/game/firstWeekPath.ts:294–310` (correctly maps canonical IDs); `frontend/app/learning-profile.tsx` (picker UI)

### Per-mode differences found in code

| Feature | curious | nursing_student | nclex | professional | Notes |
|---|---|---|---|---|---|
| Extra revealed clue (handicap) | +1 clue (`clinical.ts:76–82`) | No extra | No extra | No extra | Only `curious` / `nonmedical` family receives handicap |
| Feedback depth | Guided/supportive (with rationale + next steps) | Standard | Minimal (concise label+number) | Expert (number/effect only) | `clinical.ts:1362–1390` — chapter/mastery also add +1 or +2 levels |
| Star rules (strictness) | Standard | Standard | Stricter (turn limit -1, reassess required, no poor-fit tolerance) | Stricter same as NCLEX | `clinical.ts:1219–1236` |
| Clinical Care differences | None (only feedback depth) | None | Stricter star gate | Stricter star gate | Profile does not change affinity, appropriateness, or corruption mechanics |
| Affinity differences | None | None | None | None | Affinity is enemy/action metadata only |
| Reward differences | None explicitly | None | Potentially fewer stars (stricter rules) | Potentially fewer stars | `learning-profile.tsx:132–137` explicitly promises no reward/progression change |
| Progression differences | None | None | None | None | |
| Tutorial tier recommended | Incorrectly: Practiced (should Novice) | Correctly: Practiced | Incorrectly: Practiced (should Expert/Practiced) | Incorrectly: Practiced (should Expert) | `frontend/src/game/tutorial.ts:9–29` maps only legacy IDs |

### ⚠ Critical bug: canonical IDs not handled by clinical or tutorial switches

- **Clinical mechanics** (`clinical.ts`) branches on `curious` correctly (line ~76–82) but NCLEX-mode branches on legacy `nclexPrep` only; canonical `nclex` falls through to default standard rules
- **Tutorial tier recommendation** (`tutorial.ts:9–29`) maps only legacy IDs; all four canonical IDs default to `practiced`, so:
  - `curious` receives Practiced recommendation instead of Novice
  - `professional` receives Practiced recommendation instead of Expert
  - `nclex` does not receive stricter clinical mechanics
- **`isNonmedical` branch** in `battle.tsx:641–645` checks `learning_profile === 'nonmedical'`, not `curious`; canonical `curious` player does not receive the nonmedical adaptive briefing
- **User mitigation:** user can manually select any tier in `tutorial.tsx:49–69`, so recommendation is wrong but not blocking
- **Impact on tutorial:** any tutorial logic that assumes `nonmedical` maps to "needs more guidance" will silently miss players who set `curious`

### Flag: tutorial logic that assumes one mode

- `battle.tsx:641` — `isNonmedical = learning_profile === 'nonmedical'` — assumes legacy ID only
- `tutorial.ts:9–29` — all four canonical IDs fall to default `practiced` — should map canonical IDs explicitly
- These assume the old four-mode system; the new canonical system requires all switches to be updated

---

## Part 10 — Consolidated Tutorial Audit Table

| Mechanic | Category | First appearance | File path | Unlock condition | Player action | Existing tutorial | Tutorial priority | Tutorial type | What to teach | What not to reveal | Completion condition | Replay location | Problems found |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AP (Action Points) | Combat | Opening prologue battle | `app/battle.tsx` | Prologue | Spend AP on skill | Yes — `battleIntro` guided step | Critical | Required guided tutorial | AP restores each turn; spending selects your action | AP formula and turn AP calculation | Complete prologue tutorial | Tutorial Center |
| Care Chain (Assess→Stabilize→Treat→Reassess) | Combat / Clinical | Opening prologue battle | `app/battle.tsx` | Prologue | Follow chain steps | Yes — `battleIntro` guided step | Critical | Required guided tutorial | Each chain step is a patient care role; completing the full chain is best practice | Internal chain advancement mechanics | Complete prologue tutorial | Tutorial Center |
| Skill selection (per-hero, once per turn) | Combat | Opening prologue battle | `app/battle.tsx` | Prologue | Tap a skill card | Yes — guided step pins skill | Critical | Required guided tutorial | Each hero acts once; choose wisely | Action limit implementation | Complete prologue tutorial | Tutorial Center |
| End Turn / enemy action | Combat | Opening prologue battle | `app/battle.tsx` | Prologue | Tap End Turn | Yes — guided step | Critical | Required guided tutorial | Ending your turn triggers the enemy; patient condition can worsen | Hidden corruption scaling | Complete prologue tutorial | Tutorial Center |
| Victory and star rating | Combat | First battle result | `app/result.tsx` | First battle | Read result screen | Yes — result screen summary | High | Contextual first-use prompt | Stars reflect care quality; 3 stars = excellent clinical pathway | Exact star formula and hidden thresholds | First result screen | None needed |
| Defeat → Lotus Recall | Combat | Opening prologue (scripted) | `app/lotus-recall.tsx` | Scripted | Tap Continue | Yes — narrative | High | Required guided tutorial | This is the rebirth mechanic; it is not a game-over | None | Prologue cinematic | Reminiscence screen |
| Retry after defeat | Combat | First non-scripted defeat | `app/result.tsx` | First loss | Tap Retry button | Partially (button present) | High | Contextual first-use prompt | You can retry any encounter without penalty | None | First defeat | None needed |
| Clinical Cues (in-battle question) | Combat / Clinical | First regular battle | `app/battle.tsx` | First regular battle | Answer question | No dedicated tutorial | High | Contextual first-use prompt | A clinical question appears during battle; correct answers boost AP and stabilization | Exact cue reward amounts | First Cue appearance | Tutorial Encyclopedia |
| Weak Element / Scout reveal | Combat / Affinity | First battle with hidden element | `app/battle.tsx` | First regular battle | Use Scout/Assess action | Partial (tooltip exists) | High | Contextual first-use prompt | Assessing the patient reveals what treatment approach works best | Hidden pathology defense value | First Scout action | Tutorial Encyclopedia |
| Affinity advantage/weak battle feedback | Affinity | First skill use | `app/battle.tsx` | First skill use | Any treatment skill | No dedicated tutorial | High | Contextual first-use prompt | Some treatments work especially well or poorly for this condition | Affinity multiplier values | First affinity match | Compendium |
| Perfect Cast timing | Combat | First qualifying skill | `app/battle.tsx` | First qualifying skill | Time the tap | No trigger | Medium | Contextual first-use prompt | Timing your action well improves its effect | Exact timing window | First Perfect Cast | Tutorial Encyclopedia |
| Items tab (consumables in battle) | Combat | First battle | `app/battle.tsx` | First battle | Tap Items tab | No trigger | Medium | Contextual first-use prompt | Items can help when AP is low or the patient needs emergency support | None | First battle | Tutorial Encyclopedia |
| Cards tab (battle) | Combat | First battle with cards | `app/battle.tsx` | First card acquired | Tap Cards tab | Yes — `seen_card_tutorial` | High | Contextual first-use prompt | Cards are one-use powerful actions | None | First card ownership | Tutorial Encyclopedia |
| Call / Escalate tab (battle) | Combat | First available Call | `app/battle.tsx` | First Call available | Tap Call tab | Yes — `seen_call_tutorial` | High | Contextual first-use prompt | Escalating brings reinforcements or specialist support | None | First Call available | Tutorial Encyclopedia |
| Identity creation (name, pronouns) | Onboarding | `/post-recall` | `app/post-recall.tsx` | Prologue complete | Enter name, select pronouns | Yes — step-by-step UI | Critical | Required guided tutorial | Your identity is saved; your name and pronouns appear in-game | None | Post-recall complete | Profile screen |
| Class and element assignment | Onboarding | `/post-recall` | `app/post-recall.tsx` | Prologue complete | Complete quiz → confirm | Yes — quiz copy | Critical | Required guided tutorial | Your class sets your battle role and element focus; can be adjusted later | None | Class confirmed | Class-result screen |
| Learner mode selection | Onboarding | `/post-recall` | `app/post-recall.tsx` | Prologue complete | Select mode | Yes — options labeled | High | Required guided tutorial | Your selected mode adjusts explanation depth; it does not change your rewards or progression | None | Profile complete | Learning-profile screen |
| Hero recruitment / gacha | Progression | Ceremony | `app/university/recruit.tsx` | Lv2 + prologue | Tap guaranteed pull | Yes — ceremony tutorial | Critical | Required guided tutorial | You earn heroes by recruiting; your first two are free | Pity formula, duplicate shard amounts | Ceremony complete | Summon screen (no repeat tutorial) |
| Team assembly (3-hero loadout) | Progression | Mission loadout | `app/mission-loadout.tsx` | First shift | Choose heroes, tap Begin | Yes — `teamIntro` | High | Contextual first-use prompt | Bring heroes whose skills match the patient's condition | Hidden affinities | First loadout | Tutorial Encyclopedia |
| Player XP and level | Progression | First battle result | `app/result.tsx` | First battle | Read result | Yes — XP bar/level-up | High | Contextual first-use prompt | XP earned from battles; levels unlock new features | XP formula | First level-up | None needed |
| Hero XP and hero level | Progression | First battle result | `app/result.tsx` | First battle | Read result | Yes — result breakdown | High | Contextual first-use prompt | Heroes also earn XP; their level cap rises with star promotions | Contribution split formula | First hero XP | Hero profile |
| Certification star promotion | Progression | Hall of Heroes (Lv2) | `app/(tabs)/heroes.tsx` | Lv2 | Tap promote hero | No dedicated trigger | High | Contextual first-use prompt | Use Codex Shards and University Credits to raise a hero's level cap | None | First promotion | Tutorial Encyclopedia |
| Chapter journey / chapter chests | Progression | Journey screen | `app/journey.tsx` | Lv1 | Read map, claim chest | No first-visit tutorial | Medium | Contextual first-use prompt | Stars on each encounter unlock chapter chests and milestones | None | First chest | None needed |
| Daily objectives | Progression | Shift hub (Lv2) | `app/shift.tsx` | Lv2 | Complete objective | Yes — daily rounds copy | Medium | Contextual first-use prompt | Three daily objectives refresh every day; completing all gives a bonus | Objective shuffle formula | First daily objective | Tutorial Encyclopedia |
| Ward Defense (tower defense variant) | Combat | Ward Defense (Lv4) | `app/ward-defense.tsx` | Lv4 | Deploy unit, start wave | Yes — `wardDefenseIntro` | High | Required guided tutorial | Deploy healer units to block corrupting enemies along a path | Internal unit resistance, wave escalation | WD tutorial complete | Tutorial Center |
| Realm / settlement | Progression | Realm (Lv5) | `app/(tabs)/kingdom.tsx` | Lv5 + first WD | Place building | Yes — `kingdomIntro` | High | Contextual first-use prompt | Buildings produce resources over time; assigning heroes boosts output | Production formula | First building placement | Tutorial Center |
| Codex shards (earn + spend) | Economy | First battle result | `app/result.tsx` | First battle | Earn shards | No dedicated tutorial | High | Contextual first-use prompt | Codex Shards are used to recruit heroes from the Summoning Hall | None | First recruitment | Economy guide |
| Ward Coins / crowns (earn + spend) | Economy | First battle result | `app/result.tsx` | First battle | Earn crowns | No dedicated tutorial | High | Contextual first-use prompt | Ward Coins are your everyday currency for the Apothecary Market | None | First shop visit | Economy guide |
| University Credits (earn + spend) | Economy | First lesson complete | `/university/lesson/[id]` | First lesson | Complete lesson | No dedicated tutorial | High | Contextual first-use prompt | University Credits fund hero star promotions | None | First promotion cost shown | Economy guide |
| Apothecary Market (shop) | Economy | Shift hub link (Lv3) | `app/shop-section/[id].tsx` | Lv3 | Browse and buy | No dedicated tutorial | High | Contextual first-use prompt | Spend Ward Coins on battle boosts and Ward Defense items | None | First purchase | Tutorial Encyclopedia |
| Summon Hall (gacha) | Economy | Lv2 unlock | `app/summon.tsx` | Lv2 | Tap 1x or 10x | Yes — `summonIntro` | High | Required guided tutorial | Pull heroes; duplicate heroes yield shards; pity system guarantees a hero every X pulls | Exact pity formula | Summon tutorial complete | Tutorial Center |
| Lotus Journal (wellness) | Wellness | Lv2 unlock | `app/lotus-journal.tsx` | Lv2 | Open journal | Yes — `lotusJournalIntro` | Medium | Contextual first-use prompt | Daily wellness reflection earns Insight Crystals | Currency cap | First journal entry | Tutorial Center |
| Mealcraft (mini-game) | Wellness | From Lotus Journal | `app/mealcraft.tsx` | Lv2 | Tap-to-build plate | Yes — `mealcraftIntro` | Medium | Required guided tutorial | Combine food items to complete the daily plate | None | Mealcraft tutorial complete | Tutorial Center |
| World Event participation | Events | World Event (Lv7) | `app/world-event.tsx` | Lv7 | Participate in phase | No dedicated tutorial | High | Contextual first-use prompt | Collective player actions advance the containment effort; phases unlock boss | None | First phase participation | Tutorial Encyclopedia |
| Boss encounter | Events | Boss (Lv9) | `app/boss.tsx` | Lv9 | Defeat boss | Yes — `seen_boss_narrator` | High | Contextual first-use prompt | Boss fights have phases and drop rare rewards | Hidden stability resistance | First boss | Tutorial Encyclopedia |
| Skill Academy upgrades | Progression | University | `app/university/skill-academy.tsx` | Lv1 | Select upgrade | No dedicated tutorial | Medium | Contextual first-use prompt | Global upgrades improve your entire team's skill effectiveness | None | First upgrade | Tutorial Encyclopedia |
| Class tree skills (Lv10) | Progression | Class tree | `app/class-tree.tsx` | Lv10 | Spend class point | No dedicated tutorial | High | Contextual first-use prompt | Class points unlock specialized abilities for your class | None | First class point spent | Tutorial Encyclopedia |
| Currency exchange UI in shop | Economy | Shop (Lv3) | `app/shop.tsx` | Lv3 | View exchange tab | No tutorial (non-canonical labels) | **High** | Contextual first-use prompt | How to exchange between currency types | None | First exchange | Economy guide |

---

## Part 11 — Tutorial Priority Summary

### Critical — game-blocking if missing
1. AP system and turn flow (prologue handles this — ✅)
2. Care Chain (prologue handles this — ✅)
3. Identity / class selection (post-recall handles this — ✅)
4. Hero recruitment ceremony (ceremony tutorial handles this — ✅)
5. Clinical Cue system — **no dedicated trigger** (first regular battle)
6. Weak Element / Scout reveal — partial only

### High — significant confusion or resource loss risk
7. Team assembly and hero loadout — `teamIntro` exists ✅
8. Certification star promotion and codex shard spend — **no trigger**
9. Ward Coins and Codex Shards earning — **no trigger** (appear before explained)
10. University Credits earning and spending — **no trigger**
11. Currency exchange UI (non-canonical labels in shop) — **no trigger, labels inconsistent**
12. Daily objectives introduction — partially in shift hub copy
13. Chapter journey and chests — **no first-visit trigger**
14. World Event participation — **no tutorial at Lv7 unlock**
15. Class tree at Lv10 — **no first-visit trigger**

### Medium
16. Items tab in battle — no trigger
17. Perfect Cast timing — no trigger
18. Hero XP vs Player XP distinction — result screen covers it partially
19. Lotus Journal / wellness — `lotusJournalIntro` exists ✅
20. Realm production timing — `kingdomIntro` exists ✅

### Low / None required
21. Back button, standard navigation — no tutorial needed
22. Equipment catalog (display-only, not yet active) — no tutorial needed
23. Profile screen stats — no tutorial needed
24. Title screen — no tutorial needed

---

## Part 12 — Final Output Sections

### A. Executive Summary

The Clinica codebase has a solid tutorial infrastructure (`tutorialStore`, `TutorialOverlay`, `useHighlightTarget`, `useBlockBack`, `useClearTutorialOnExit`) and meaningful coverage for the forced prologue battle sequence. However, the audit reveals five categories of gap:

1. **Critical first-regular-battle gaps.** Clinical Cues and the Weak Element / Scout reveal both lack first-use tutorials. These are the first mechanics a player encounters that require understanding without a forced guide, and misunderstanding either can cause compounding failure (wrong actions, wasted AP, no star progress).

2. **Economy introduction is fragmented and contradictory.** Seven currencies exist (crowns, codex_shards, insight_crystals, refined_lotus_gems, lotus_gems_paid, ward_sigils, university_credits). Three of them (crowns, codex_shards, university_credits) are earned before being explained. The shop exchange tab displays non-canonical names ("Jade Scrolls, Gold Crowns, Ward Tokens") that conflict with the canonical economy definitions, and the recruitment UI calls `codex_shards` "Summoning Shards." No currency introduction tutorial exists.

3. **Canonical learner-mode IDs are not handled by clinical switches or the tutorial tier recommender.** Players who select `curious`, `nclex`, or `professional` receive incorrect tutorial tier recommendations, and `curious`/`nclex` players do not receive mode-specific clinical mechanics they are supposed to receive (handicap clue, stricter star rules). The `isNonmedical` check in `battle.tsx` uses the legacy `nonmedical` ID.

4. **Mid-to-late progression lacks first-visit triggers.** Certification star promotion, chapter chest claiming, class tree unlock (Lv10), skill academy, World Event participation, and daily objectives have no contextual prompts at first encounter.

5. **Tutorial persistence has a two-layer split** (`clinica.tutorials.v1` is device-local; `clinica.player.v2` flags are account-wide) that creates edge cases: a player who resets tutorials via Tutorial Center but not their account retains account-wide `seen_*` flags; a player who resets their account retains Tutorial Center coach-mark completions if `clinica.tutorials.v1` is not also cleared. The account reset function (`resetPlayer`) does clear both keys, so full reset is correct; partial resets are the risk.

---

### B. Actual New-Player Route

See Part 2 step-by-step table above.

**Condensed path:**
```
/index → /title → /preloader → /prologue → /opening-prologue (8-phase cinematic + guided battle)
  → /lotus-recall → /post-recall (identity + class) → /reminiscence → /(tabs)
  → /university (lesson) → /shift → /shift-cases → /mission-loadout → /battle → /result
  → /university/recruit (ceremony × 2) → /(tabs)/heroes → further progression
```

---

### C. Screen Inventory

See Part 3 above. Full inventory covers 80+ routes across: Hub & Navigation (12), Story & Onboarding (7), Battle & Combat (8), Ward Defense (1), University (26), Hero & Roster (4), Kingdom / Realm (1), Progression & Reward (6), Shop & Economy (6), Wellness & Journal (4), Reference & Dev (5).

---

### D. Important Mechanic Inventory

See Part 4 above. Mechanics are organized across: Core Navigation, Combat (16 mechanics), Affinity (7 mechanics), Clinical Care (7 steps), Progression and Rewards (10 mechanics), Inventory and Equipment (3), Shops and Economy (see Section H), Quests and Activities (6), Education and Support (15 systems).

---

### E. First-Use Tutorial Audit Table

See Part 10 above. 35 rows covering all important mechanics with priority, type, what to teach, what not to reveal, completion condition, and replay location.

---

### F. Affinity Tutorial Findings

**Player-facing introduction needed (without revealing hidden calculations):**

The affinity system has two interleaved layers that are presented inconsistently to the player:

1. **11 AffinityFamily names** (`Fluid/Hydration`, `Airway/Respiratory`, `Fire/Inflammation`, `Protection/Immune`, `Energy/Metabolic`, `Storm/Cardiac`, `Mind/Neuro-Psych`, `Growth/Endocrine`, `Filter/Renal`, `Wound/Tissue`, `Community/Public Health`) — defined in `types.ts:18–35`. These appear on hero profiles but are **not shown as named pills in the battle enemy panel** — the enemy panel shows system pills, not family names.

2. **Disease-domain affinity** (`respiratory`, `circulatory`, `infection`, `metabolic`, `cardiac`, `neurological`, `integumentary`, `safety`, `general`) — the matching layer actually computed in battle. These appear in the Compendium as "CLINICAL DOMAIN" pills per enemy entry.

**Visible feedback that exists:**
- Battle log: "✅ Affinity advantage — effect increased." / "⚠️ Weak affinity — effect reduced." (`battle.ts:932–937`)
- Action labels: "Super effective" / "Limited effect" / "Strong fit" (`clinical.ts:969–1004`)
- Skill Calc Breakdown row: "Affinity match" (`battle.ts:2033–2036`)
- Enemy panel: primary/secondary system pills + Weak Element row ("Unknown" until scouted)
- Compendium: per-enemy CLINICAL DOMAIN section + ELEMENTAL COUNTER section

**Gaps identified:**
- No tutorial introduces the concept of affinity before first battle
- Players see "Limited effect" feedback without prior explanation of what affinity means
- The 11 family names on hero profiles are never linked to the disease-domain categories in the battle panel
- No chart/Codex table maps family names to clinical domains
- Hero affinity (strong/weak affinities fields on hero object) is not surfaced in a visible card or tutorial

**Recommended tutorial content (player-facing, no hidden values):**
- First-use prompt on first skill use with a non-neutral affinity result: "Some treatments are a strong match for this patient's condition; others are a weak match. Check the patient's clinical domain and match your hero's strengths."
- Reference entry in Tutorial Encyclopedia: affinity family names, disease domains, where to find them (Compendium), and the "Unknown" weak element until Scouted.
- Do **not** reveal: multiplier values, resistance tags, weakness tags, `calcAffinityFamilyMod` numeric outputs, or `stabilityResistance` relationship to affinity.

---

### G. Clinical Care Tutorial Findings

**Staged tutorial flow (without revealing correct answers or hidden factors):**

**Stage 1 — Prologue (already implemented, `battleIntro` guided tutorial):**
- Teach: AP, skill selection, Care Chain concept (Assess → Stabilize → Treat → Reassess), End Turn
- Teach: visible clues on the enemy panel; Scout/Assess to reveal more
- Teach: the Care Chain strip shows your next expected step
- Do not reveal: chain advancement gates, corruption formulas, hidden defense, stability resistance

**Stage 2 — First regular battle (currently no tutorial trigger):**
- Trigger: first non-prologue battle (`battleIntro` already completed, regular enemy)
- Teach: Clinical Cues appear mid-battle; they are clinical questions; correct answers reward AP and stability boost for this turn
- Teach: locked actions with "Needs prior assessment" mean the patient hasn't been fully evaluated yet; use Scout or Assess first
- Teach: inappropriate care makes the patient's condition worse; the log explains why
- Do not reveal: cue reward amounts, deterioration thresholds, corruption scoring tiers

**Stage 3 — First affinity feedback (no current trigger):**
- Trigger: first skill execution with a non-neutral clinical domain result
- Teach: "This treatment is a strong match / weak match for this patient's condition. Check the clinical domain in the enemy panel or Compendium."
- Do not reveal: affinity multiplier values, hidden resistance values

**Stage 4 — First Reassessment step needed (no current trigger):**
- Trigger: first time care chain reaches Reassess position
- Teach: Reassessing after treatment confirms the patient's response and completes the care pathway for maximum effect
- Do not reveal: reassess score bonuses, internal chain completion multiplier

**University vs combat differences:**
- University lessons and Cue Hunt provide the same clinical reasoning concepts in a lower-stakes environment
- University uses `ENEMY_CLINICAL` disease tags and is profile-aware for feedback depth
- University Cue Hunt has its own `cueHuntIntro` tutorial which correctly gates on target presses
- Rapid Triage and Stabilize Stack have their own tutorials; these are the main university clinical-skill teachers

**Learner-mode differences (see Part 9):**
- `curious` players receive one extra revealed clue (handicap) — but only if the legacy `nonmedical` branch is hit (currently `isNonmedical` check is broken for canonical `curious`)
- `nclex` players should face stricter star rules but canonical `nclex` ID falls through the clinical switch — bug
- All other feedback-depth differences work via chapter/mastery feedback level

---

### H. Shops and Currency Findings

#### Shops

| Shop name | Route | File | Unlock | What it sells | Currency | Buy/sell/refresh/exchange | First access | Notes |
|---|---|---|---|---|---|---|---|---|
| Apothecary Market | `/shop-section/apothecary` | `app/shop-section/[id].tsx` | Lv3 | Battle boosts (startAP, startShield), Ward Unit Mastery items, stamina refills | Ward Coins (`crowns`) | Buy only; immediate; no sell/refresh | Lv3 unlock milestone | Only 2 real battle levers (AP/shield); +Stability boost is dead (patient starts at max stability) |
| University Shop | `/university/uni-shop` | `app/university/uni-shop.tsx` | Lv1 | Certification promotions, hero training items | University Credits | Buy only | First lesson completion | No confirmation dialog found; spend path for University Credits |
| Summoning Hall / Recruitment | `/university/recruit`, `/summon` | `app/university/recruit.tsx`, `app/summon.tsx` | Lv2 (ceremony); Lv12 (10x pull) | Hero recruitment (gacha) | Codex Shards | Pull (1x / 10x); ceremony is guaranteed | Ceremony post-prologue | UI calls currency "Summoning Shards" (inconsistent with canonical `codex_shards`/Codex Shards) |
| Shop Hub (Exchange tab) | `/shop` | `app/shop.tsx` | Lv3 | Currency exchange preview | Non-canonical labels | Preview only; no live exchange implementation found | Lv3 | Labels "Jade Scrolls, Gold Crowns, Hero Shards, Ward Tokens" — none match canonical CurrencyId; placeholder/misleading |
| Bazaar | `/bazaar` | `app/bazaar.tsx` | Unknown | Unknown | Unknown | Unknown | Unknown | Requires further trace |
| Embassy | `/embassy` | `app/embassy.tsx` | Unknown | Unknown | Unknown | Unknown | Unknown | Requires further trace |
| Sanctuary Bank | `/shop-section/[id]` (bank section) | `app/shop-section/[id].tsx` | TBD | Exchange Insight Crystals → Refined Lotus Gems | Insight Crystals | Exchange | After first University lesson | Only active exchange path for earned-premium currencies |

#### Currencies

| Code ID | Player-facing name | Classification | Earn sources | Spend locations | First acquisition | Display locations | Flags |
|---|---|---|---|---|---|---|---|
| `crowns` | Ward Coins | Common / free | Battle/shift rewards, daily play | Apothecary Market, Ward Unit Mastery, stamina refills | First battle result | PlayerHeader, shop balance | Shop Exchange tab calls it "Gold Crowns" — **name conflict** |
| `codex_shards` | Codex Shards | Recruitment | Ward Shift, University milestones, Cue mastery, Codex discoveries, events, bosses | Summoning Hall hero recruitment | University milestone or first Ward Shift | Recruitment Hall, PlayerHeader, economy guide | Recruitment UI calls them "Summoning Shards" — **name conflict**; appear before explained |
| `insight_crystals` | Insight Crystals | Earned-premium | University lessons/research, Lotus Journal wellness milestones, mastery achievements | Sanctuary Bank exchange | First University lesson/research | Premium currency card, Bank modal, economy guide | No live shop purchase path; earned before spend destination is visible |
| `refined_lotus_gems` | Refined Lotus Gems | Earned-premium | Sanctuary Bank exchange | Planned cosmetics/marketplace (not yet active) | First successful Bank exchange | Premium currency card, Bank modal | **No active spending destination** — displayed without purpose |
| `lotus_gems_paid` | Lotus Gems | Paid-premium | Planned real-money bundles (inactive) | Planned cosmetics, convenience, marketplace | Future / inactive | Premium currency card, economy guide | **No earn source currently active**; displayed before explained |
| `ward_sigils` | Ward Sigils | Progression | Ward Defense runs, Defense Blueprints, Unit Mastery milestones | Future WD unit recruitment/progression (not yet active) | First Ward Defense run (Lv4) | Premium currency list, no active spend | UI exchange preview calls them "Ward Tokens" — **name conflict**; no active spend destination |
| `university_credits` | University Credits | Progression | University lessons, Recruitment Hall rolls (10%/guaranteed in 10x), Research Library | Hero Certification star promotions (500/1,500/5,000/15,000) | First University lesson or practice | University Shop balance, Recruitment Hall badge, economy guide | First spend opportunity is after first lesson; earn before spend is introduced |

**⚠ Flags:**
- `codex_shards` appear in the first battle result before the Summoning Hall tutorial explains their purpose
- `refined_lotus_gems` have no active spending destination — displayed in premium currency list without context
- `lotus_gems_paid` have no active earn source — appear in economy guide as future
- `ward_sigils` have no active spending destination — awarded at Lv4 with no use
- Shop Exchange tab displays four non-canonical currency names that do not match any `CurrencyId` entry — a player who reads the exchange tab will be confused about which currency is which
- No "sell" or "refresh" function exists anywhere in the current shop implementation
- Confirmation behavior: all purchases are immediate with a transient toast/banner; no confirmation dialog found for any shop purchase

---

### I. Tutorial Dependency Map

See Part 7 above for the full map. Key violations:

1. **Currency names appear before explanation** — `codex_shards` rewarded in first battle result; Summoning Hall tutorial (which explains spend path) comes after; no bridge tutorial
2. **Shop exchange shows non-canonical names** before any currency tutorial
3. **Clinical Cues fire in first regular battle** before any Cue tutorial outside University
4. **Weak Element row shows "Unknown"** before any Scout/Assess tutorial in regular battle
5. **Class tree unlocks at Lv10** with no first-visit intro, despite depending on understanding class identity taught at post-recall

---

### J. Existing Tutorial Infrastructure

**What is already implemented:**

| Component | Status | Persists correctly? |
|---|---|---|
| `TutorialOverlay` | Fully implemented; handles battle scrim, mini-game target guards, typewriter text | Yes — `clinica.tutorials.v1` per ID |
| `useHighlightTarget` | Fully implemented; blocks wrong targets, highlights required target | Yes — completion mark on step advance |
| `useClearTutorialOnExit` | Fully implemented; marks active tutorial complete on unmount | Yes — but risk: mid-flow exit permanently suppresses re-trigger without replay |
| `useBlockBack` | Fully implemented; blocks hardware/web back on forced screens | N/A (navigation, not persistent) |
| `tutorialStore` | Fully implemented; one active tutorial at a time; hydration guard; skip = permanent; replay via Tutorial Center | Yes — `clinica.tutorials.v1` |
| `battleIntro` guided tutorial | Fully implemented; pins skills, requires chain steps, blocks non-required actions | Yes |
| `wardDefenseIntro` tutorial | Fully implemented | Yes |
| `cueHuntIntro` tutorial | Fully implemented (700 ms delay, `useHighlightTarget` per target ID) | Yes |
| `rapidTriageIntro` tutorial | Fully implemented | Yes |
| `stabilizeStackIntro` tutorial | Fully implemented | Yes |
| `summonIntro` / ceremony tutorial | Fully implemented | Yes |
| `teamIntro` tutorial | Implemented | Yes |
| `kingdomIntro` tutorial | Implemented | Yes |
| `lotusJournalIntro` tutorial | Implemented | Yes |
| `mealcraftIntro` tutorial | Implemented | Yes |
| `shopIntro` tutorial | Implemented | Yes |
| `heroesIntro` tutorial | Implemented | Yes |
| `systemHubIntro` | One-time only; intentionally not replayable via Tutorial Center; only re-runs on full account reset | Partially (can't replay) |

**Persistence behavior:**
- Tutorial coach-mark completion lives in `clinica.tutorials.v1` (device-local)
- Account-wide `seen_*` and `tutorial_*` flags live in `clinica.player.v2`
- Full account reset clears both; Tutorial Center reset clears only `clinica.tutorials.v1`
- A player who replays a tutorial via Tutorial Center but has a `seen_*` flag set in player state may encounter inconsistent behavior if the host screen also checks the player flag

**Unused or incomplete:**
- `cue-lab.tsx` — no tutorial overlay (standalone practice, intentional)
- `stabilize-placeholder.tsx` — coming-soon placeholder, no tutorial
- `item-bag.tsx`, `milestones.tsx`, `journey.tsx`, `class-tree.tsx`, `skill-academy.tsx`, `world-event.tsx` — no first-visit trigger wired

---

### K. Hidden-System Protection Notes

See Part 8 above. Seven internal systems are documented with private findings, all labeled **INTERNAL ONLY — DO NOT REVEAL TO PLAYER**:

1. Stability-resistance dampener — `types.ts:141–145`, `clinical.ts:1060–1079`, `battle.ts:1238–1361`
2. Corruption outcome algorithm / clinical status scoring — `clinical.ts:842–1153`, `battle.ts:724–1367`
3. Difficulty and chapter corruption harshness scaling — `clinical.ts:1081–1115`, `battle.ts:736–1732`
4. Hidden pathology defense (unrevealed-clue defense) — `types.ts:185–203`, `battle.ts:862–923`
5. Per-enemy `stabilityResistance` affecting all stability-gain paths — `types.ts:141–145`
6. Diminishing returns on stability gain from current stability level — `clinical.ts:1060–1079`
7. Hero XP contribution split formula — `progression.ts:361–402`

All safe player-facing tutorial copy avoids: resistance values, stability dampening specifics, corruption score tier formulas, clue-defense specifics, and contribution split percentages.

---

### L. Missing, Unreachable, or Contradictory Systems

| System | Status | Details |
|---|---|---|
| Currency exchange tab in Shop | **Contradictory** | Displays "Jade Scrolls, Gold Crowns, Hero Shards, Ward Tokens" — none match canonical `CurrencyId`; no live exchange implementation; labeled as placeholder |
| `refined_lotus_gems` spend path | **Placeholder** | No active spending destination; currency is awarded but cannot be used; Economy guide acknowledges this |
| `lotus_gems_paid` earn path | **Placeholder** | Real-money bundles not implemented; currency exists in definitions but has no earn source |
| `ward_sigils` spend path | **Placeholder / future** | Awarded from Ward Defense (Lv4) but no active spending destination; UI exchange preview labels them "Ward Tokens" |
| Equipment system | **Partially implemented** | `equipment.ts` is display-only catalog (status "future"); `equipItem`/`unequipItem` actions exist in store but items cannot be equipped in practice |
| Recruitment UI "Summoning Shards" name | **Contradictory** | UI name conflicts with canonical `codex_shards` / "Codex Shards" throughout economy definitions |
| Canonical learner-mode IDs in clinical switches | **Incomplete** | `nclex`, `curious` not handled by all clinical branches; `isNonmedical` uses legacy ID; tutorial tier recommender maps legacy IDs only |
| `/bazaar`, `/embassy` | **Uncertain** | Routes exist; unlock condition and full purpose not confirmed from this audit's read scope |
| `stabilize-placeholder.tsx` | **Placeholder** | Coming-soon lesson slot; no content |
| `onboarding.tsx` | **Alternate / potentially unreachable** | Alternate player-creation path; primary path is through prologue → post-recall; conditions under which onboarding.tsx is reached instead of post-recall not fully confirmed |
| `dev-prologue-tester.tsx`, `battle-audit.tsx`, `hero-audit.tsx` | **Dev-only** | Not player-reachable in production build |
| `systemHubIntro` tutorial | **Non-replayable** | One-time only; intentionally excluded from Tutorial Center replay list; only resets on full account reset |
| Cue-lab tutorial | **Absent** | `cue-lab.tsx` has no tutorial overlay — confirmed intentional (standalone practice loop) |
| Advanced simulations gate | **Partial** | Basic simulations available Lv1; advanced simulations gate at Lv25 (FEATURE_UNLOCKS); no first-visit intro at Lv25 unlock |
| World Event boss drop table display vs award | **Bug (existing task #37)** | Result screen shows World Boss drop table but full drop table not actually awarded — separate known issue |
| Ward Defense, University, Realm Epidemic Token earning | **Bug (existing task #41)** | Only battle awards Epidemic Tokens; WD/University/Realm award path not implemented |

---

### M. Recommended Tutorial Sequence

The following sequence places tutorials at the first meaningful interaction with each mechanic, respecting the dependency map and feature unlock ladder:

| Order | When | Tutorial | Type | Mechanic |
|---|---|---|---|---|
| 1 | Opening prologue (forced) | `battleIntro` ✅ | Required guided | AP, skill selection, Care Chain, End Turn, Lotus Recall |
| 2 | Post-recall | Identity creation steps ✅ | Required guided | Name, pronouns, class/element diagnostic |
| 3 | Post-recall | Learning profile prompt ✅ | Required guided | Learner mode — what it adjusts, what it doesn't |
| 4 | University first visit | `seen_university_intro` ✅ / `systemHubIntro` | Required guided | University as primary progression engine |
| 5 | First regular battle — first Clinical Cue fires | New: `clinicalCueIntro` | Contextual first-use | What Clinical Cues are, how to answer, what the reward is |
| 6 | First regular battle — first non-neutral affinity result | New: `affinityMatchIntro` | Contextual first-use | Affinity advantage/weak concept; where to find the reference |
| 7 | First regular battle — first locked action ("Needs prior assessment") | New: `lockedActionIntro` | Contextual first-use | Clue gates; Scout/Assess before treating |
| 8 | First battle result | XP bar level-up message ✅ + new: `currencyFirstEarnIntro` | Contextual first-use | What Ward Coins and Codex Shards are and where they can be spent |
| 9 | Ceremony (Lv2) | `summonIntro` ✅ | Required guided | Recruitment, hero acquisition, Summoning Hall; canonical currency name aligned |
| 10 | First visit to Hall of Heroes (Lv2) | `heroesIntro` ✅ | Contextual first-use | Roster, team slots, rarity, star caps |
| 11 | First time certification promotion becomes affordable | New: `promotionIntro` | Contextual first-use | Star promotion, shards cost, University Credits cost, level cap unlock |
| 12 | First Daily Objectives appear (Lv2) | New: `dailyObjectivesIntro` | Contextual first-use | Three daily objectives, reset timing, bonus for completing all |
| 13 | First visit to Journey screen | New: `journeyChestIntro` | Contextual first-use | Chapter journey, star clearing, chest claim |
| 14 | First shop visit (Lv3) | `shopIntro` ✅ | Contextual first-use | Shop tabs, Ward Coins spending; correct currency names |
| 15 | First Ward Defense run (Lv4) | `wardDefenseIntro` ✅ | Required guided | Tower-defense variant, unit deployment, wave flow |
| 16 | First Perfect Cast prompt | New: `perfectCastIntro` | Contextual first-use | Timing mechanic, effect boost |
| 17 | First Realm visit (Lv5) | `kingdomIntro` ✅ | Contextual first-use | Settlement production, building placement, hero assignment |
| 18 | First Lotus Journal access (Lv2) | `lotusJournalIntro` ✅ | Contextual first-use | Wellness journal, Insight Crystals |
| 19 | First Mealcraft session | `mealcraftIntro` ✅ | Required guided | Plate-building mini-game |
| 20 | First World Event participation (Lv7) | New: `worldEventIntro` | Contextual first-use | Collective containment phases, Epidemic Token earn path |
| 21 | First Boss encounter (Lv9) | `seen_boss_narrator` ✅ (partial) | Contextual first-use | Boss phase mechanic; stability may not stick (without revealing resistance) |
| 22 | Class tree unlock (Lv10) | New: `classTreeIntro` | Contextual first-use | Class points, branch selection, ability types |
| 23 | Advanced simulations unlock (Lv25) | New: `advancedSimIntro` | Contextual first-use | Advanced simulation differences |

**New tutorials needed (not yet implemented):**
`clinicalCueIntro`, `affinityMatchIntro`, `lockedActionIntro`, `currencyFirstEarnIntro`, `promotionIntro`, `dailyObjectivesIntro`, `journeyChestIntro`, `perfectCastIntro`, `worldEventIntro`, `classTreeIntro`, `advancedSimIntro`

---

### N. Files Reviewed

| File | Purpose |
|---|---|
| `frontend/app/index.tsx` | Boot entry |
| `frontend/app/_layout.tsx` | Root layout and providers |
| `frontend/app/(tabs)/_layout.tsx` | Tab layout |
| `frontend/app/(tabs)/index.tsx` | Home hub |
| `frontend/app/(tabs)/heroes.tsx` | Hall of Heroes |
| `frontend/app/(tabs)/codex.tsx` | Research Library / Codex |
| `frontend/app/(tabs)/kingdom.tsx` | Realm hub |
| `frontend/app/(tabs)/faction.tsx` | Faction / Community Board |
| `frontend/app/(tabs)/profile.tsx` | Profile |
| `frontend/app/(tabs)/shop.tsx` | Shop tab entry |
| `frontend/app/title.tsx` | Title screen |
| `frontend/app/preloader.tsx` | Asset preloader |
| `frontend/app/prologue.tsx` | Prologue router |
| `frontend/app/opening-prologue.tsx` | 8-phase opening cinematic |
| `frontend/app/lotus-recall.tsx` | Lotus Recall screen |
| `frontend/app/post-recall.tsx` | Identity / class selection |
| `frontend/app/reminiscence.tsx` | Memory scene |
| `frontend/app/onboarding.tsx` | Alternate onboarding |
| `frontend/app/battle.tsx` | Battle UI |
| `frontend/app/result.tsx` | Battle result screen |
| `frontend/app/shift.tsx` | Ward Shift mode hub |
| `frontend/app/shift-cases.tsx` | Case selection |
| `frontend/app/mission-loadout.tsx` | Hero team loadout |
| `frontend/app/ward-defense.tsx` | Ward Defense |
| `frontend/app/boss.tsx` | Boss encounter |
| `frontend/app/world-event.tsx` | World Event |
| `frontend/app/events.tsx` | Events hub |
| `frontend/app/mode/[id].tsx` | Mode briefing |
| `frontend/app/shop.tsx` | Shop hub |
| `frontend/app/shop-section/[id].tsx` | Shop section |
| `frontend/app/summon.tsx` | Summoning Hall / gacha |
| `frontend/app/bazaar.tsx` | Bazaar (partial review) |
| `frontend/app/embassy.tsx` | Embassy (partial review) |
| `frontend/app/journey.tsx` | Chapter journey map |
| `frontend/app/milestones.tsx` | Level and chapter milestones |
| `frontend/app/hero/[id].tsx` | Hero profile |
| `frontend/app/hero-picker.tsx` | Hero slot picker |
| `frontend/app/hero-select.tsx` | Hero selection |
| `frontend/app/item-bag.tsx` | Item bag / inventory |
| `frontend/app/materials.tsx` | Materials guide |
| `frontend/app/economy.tsx` | Economy guide |
| `frontend/app/learning-profile.tsx` | Learner mode picker |
| `frontend/app/compendium.tsx` | Enemy / affinity reference |
| `frontend/app/story-scene.tsx` | Manhwa cutscene |
| `frontend/app/class-tree.tsx` | Class tree |
| `frontend/app/class-result.tsx` | Class assignment result |
| `frontend/app/tutorial.tsx` | Healer's Manual (static) |
| `frontend/app/tutorial-center.tsx` | Tutorial replay hub |
| `frontend/app/tutorial-encyclopedia.tsx` | Tutorial encyclopedia |
| `frontend/app/lotus-journal.tsx` | Lotus Journal |
| `frontend/app/lotus-journal-log.tsx` | Journal log |
| `frontend/app/lotus-journal-recipes.tsx` | Recipes |
| `frontend/app/mealcraft.tsx` | Mealcraft mini-game |
| `frontend/app/academy-path.tsx` | Academy path |
| `frontend/app/university/index.tsx` | University hub |
| `frontend/app/university/lesson/[id].tsx` | Lesson screen |
| `frontend/app/university/lessons.tsx` | Lessons list |
| `frontend/app/university/recruit.tsx` | Recruitment / ceremony |
| `frontend/app/university/cue-hunt.tsx` | Cue hunt lesson |
| `frontend/app/university/cue-lab.tsx` | Cue lab practice |
| `frontend/app/university/rapid-triage.tsx` | Rapid triage |
| `frontend/app/university/stabilize-lesson.tsx` | Stabilize lesson |
| `frontend/app/university/stabilize-stack.tsx` | Stabilize stack |
| `frontend/app/university/skill-academy.tsx` | Skill Academy |
| `frontend/app/university/uni-shop.tsx` | University shop |
| `frontend/app/university/training.tsx` | Training hall |
| `frontend/app/university/simulation/[id].tsx` | Clinical simulation |
| `frontend/src/game/store.tsx` | Game state store |
| `frontend/src/game/types.ts` | All type definitions |
| `frontend/src/game/battle.ts` | Battle engine |
| `frontend/src/game/clinical.ts` | Clinical Care system |
| `frontend/src/game/progression.ts` | XP, levels, FEATURE_UNLOCKS |
| `frontend/src/game/milestones.ts` | Milestone definitions |
| `frontend/src/game/dailyRounds.ts` | Daily/weekly quest system |
| `frontend/src/game/journeyRewards.ts` | Journey chapter rewards |
| `frontend/src/game/university.ts` | University definitions |
| `frontend/src/game/economy.ts` | Currency and economy definitions |
| `frontend/src/game/shop.ts` | Shop catalog |
| `frontend/src/game/shopHub.ts` | Shop hub helpers |
| `frontend/src/game/equipment.ts` | Equipment definitions |
| `frontend/src/game/tutorial.ts` | Tutorial tier recommender |
| `frontend/src/game/tutorialStore.tsx` | Tutorial state store |
| `frontend/src/game/route.ts` | Entry route resolver |
| `frontend/src/game/firstWeekPath.ts` | Learning profile label helper |
| `frontend/src/game/battleXp.ts` | Battle XP calculation |
| `frontend/src/game/battleAssets.ts` | Battle asset loader |
| `frontend/src/components/TutorialOverlay.tsx` | Tutorial overlay component |
| `frontend/src/hooks/useClearTutorialOnExit.ts` | Tutorial cleanup hook |
| `frontend/src/hooks/useBlockBack.ts` | Back navigation guard |

---

### O. Uncertainties

| Item | Uncertainty | What would resolve it |
|---|---|---|
| `/bazaar` and `/embassy` | Unlock condition, inventory source, currency, and full purpose not confirmed | Read `bazaar.tsx` and `embassy.tsx` fully; trace data sources |
| `onboarding.tsx` alternate path | Conditions under which a player reaches `/onboarding` instead of `/post-recall` not fully confirmed | Trace all router.push/replace calls that target `/onboarding` |
| Equipment equip path | `equipItem`/`unequipItem` exist in store but no confirmed equip UI flow reachable by player | Search all call sites of `equipItem` and `unequipItem` |
| Codex shard display on first battle result | Confirmed it is earned; display format on result screen not verified pixel-for-pixel | Read `result.tsx` reward display section |
| Advanced simulation gate behavior | Lv25 gate confirmed; actual simulation content quality/completeness at Lv25 not audited | Read `simulation/[id].tsx` fully |
| `battleIntro` step count and exact step content | Guided prologue tutorial steps confirmed to exist; exact full step sequence (all 8+ steps and their `requiredSkillId` / `requiredActionType`) not fully enumerated | Read `battle.tsx` guided step definitions (approx lines 716–960) |
| `clinicalCueIntro` possibility — Cue Hunt vs in-battle | Whether the `cueHuntIntro` university tutorial is intended to substitute for an in-battle Cue intro, or whether both are needed | Confirm intended design with product owner |
| Ward sigils and University Credits actual earn rates | Earn rates inferred from economy.ts descriptions; actual drop amounts per battle/lesson not audited | Read battle reward tables and lesson completion reward grants |
| `seen_*` PlayerState flag vs `clinica.tutorials.v1` interaction | Whether screens that check both a `seen_*` PlayerState flag AND `isCompleted(tutorialId)` behave consistently on partial reset | Read each host screen that both uses `useTutorial` and checks a `seen_*` field |
| Faction / Embassy world event relationship | Whether Embassy and Faction features share state or unlock dependencies | Read `embassy.tsx` and `faction.tsx` unlock logic fully |
| Class-change at 3★ — whether tutorial exists | Confirmed at `university.ts:22–27`; whether any tutorial or prompt fires when Class Change first becomes available not audited | Search store/UI for `classChange` or `3star` first-availability trigger |
