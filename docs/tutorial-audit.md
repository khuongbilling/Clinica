# Clinica Tutorial System — Full Developer Audit

> **Living document.** Re-generated each time an audit is requested.
> **Last audited:** 2026-08-09 · commit `76640c1`
> **Source branch:** main (current workspace)
> **Note:** Auto-stamped by `npm run gen:tutorial-audit`. Re-run after each audit to keep this current.

---## Table of Contents

1. [Tutorial System Architecture](#1-tutorial-system-architecture)
2. [Complete Tutorial Catalogue](#2-complete-tutorial-catalogue)
3. [Tutorial Persistence & State Machine](#3-tutorial-persistence--state-machine)
4. [New-Player Journey — Ordered Tutorial Sequence](#4-new-player-journey--ordered-tutorial-sequence)
5. [First Regular Battle — Full Context](#5-first-regular-battle--full-context)
6. [Tutorial Center & Encyclopedia Inventory](#6-tutorial-center--encyclopedia-inventory)
7. [Learner-Profile Compatibility](#7-learner-profile-compatibility)
8. [Currency Terminology](#8-currency-terminology)
9. [Known Bugs & Confirmed Gaps](#9-known-bugs--confirmed-gaps)
10. [Correct vs Previously Incorrect Claims](#10-correct-vs-previously-incorrect-claims)
11. [Remaining Open Questions](#11-remaining-open-questions)
12. [Suggested Improvements (Developer Notes)](#12-suggested-improvements-developer-notes)

---
## 1. Tutorial System Architecture

### Core files

| File | Role |
|---|---|
| `frontend/src/game/tutorials.ts` | Single source of truth — all 16 `TutorialId` definitions and their steps |
| `frontend/src/game/tutorialStore.tsx` | State machine: start / advance / skip / replay / reset / dismiss |
| `frontend/app/tutorial-center.tsx` | In-game Tutorial Center UI — 14 replayable entries |
| `frontend/app/tutorial-encyclopedia.tsx` | Codex-style reference — static text entries, some with replay buttons |
| `frontend/app/tutorial.tsx` | `getTutorialTier` — selects novice / practiced / expert content by learner profile |

### How a tutorial runs

```
startTutorial(id)
  → refuses if: not yet hydrated | already active | already completed | dismissed
  → sets activeId + step = 0
  → TutorialOverlay renders step[0]

Player taps Next / performs required action
  → doAdvance() called
  → if final step: markDone(id)  →  completed[id]=true  →  active cleared
  → otherwise: step++

Player taps Skip
  → skipTutorial()  →  markDone(id)  →  same end-state as finishing

Player navigates away mid-tutorial
  → clearActiveTutorial()  →  dismissed[id]=true  →  NOT completed
  → tutorial does NOT auto-restart; startTutorial() returns early when dismissed[id]=true
  → player must use Tutorial Center or Encyclopedia replay to see it again

replayTutorial(id)
  → completed[id]=false + dismissed[id]=false  →  forces activeId + step=0
  → bypasses all guards — always runs regardless of prior state
```

### AsyncStorage keys

| Key | Contents |
|---|---|
| `clinica.tutorials.v1` | `Record<TutorialId, boolean>` — completion map |
| `clinica.tutorials.dismissed.v1` | `Record<TutorialId, boolean>` — dismissal map |

Both keys are wiped by `resetTutorials()` and by full account reset (which clears all `clinica.*` keys).

### TutorialOverlay rendering

- Rendered once at the **host screen** level, not at the app level.
- `position` field controls placement: `top` | `center` | `bottom` | `banner`.
- `banner: true` on a step renders a full-width banner variant.
- Steps with `requireAction: true` block the "Next" button until `onRequiredAction(type)` is called from the correct action handler.
- Steps with `requireAction: false` show a tap-to-continue button immediately.
- `requiredSkillId` pins to a specific skill button; `requiredActionType` pins to any action of that type.
- **Web z-index note:** battle modals shown during a guided step (z9000) need `zIndex ≥ 9500` or they render under the overlay and swallow taps.

### `useClearTutorialOnExit` hook

Defined at `frontend/src/hooks/useClearTutorialOnExit.ts`. Used by `battle.tsx` and other tutorial host screens.

```typescript
// On screen blur / unmount:
clearActiveTutorial()  →  dismissed[id]=true  →  active cleared
```

Behaviour (from hook docstring):
- Marks the tutorial **dismissed** on blur/unmount — prevents auto-restart on next visit.
- Does **not** mark completed — tutorial remains available in Tutorial Replay Center / Encyclopedia.
- `replayTutorial()` clears the dismissed flag and restarts from step 1.
- Exception: `prologueBattle` is always launched via `replayTutorial()`, so this hook has no net effect on that tutorial.

---

## 2. Complete Tutorial Catalogue

All 16 `TutorialId` values defined in `frontend/src/game/tutorials.ts:101–637`.

---

### 2.1 `prologueBattle` — "Your First Shift"

**Host:** `frontend/app/battle.tsx`
**Trigger:** Always force-replayed on prologue battle mount (`isPrologueTutorial = true`) via `replayTutorial("prologueBattle")` at 800 ms. Ignores completion state — always runs during the prologue.
**Replay route (Tutorial Center):** `/battle?enemyId=dehydration_wisp&training=1&prologue=tutorial&replay=1`
**Skip behavior:** Marks complete, active cleared.
**Steps (10):**

| # | Step ID | Title | Position | Require action | Action type | Skill ID | Button |
|---|---|---|---|---|---|---|---|
| 1 | `prologue_welcome` | Your First Patient | bottom | No | — | — | I'M READY |
| 2 | `prologue_cue` | Read This Before Acting | top | **Yes** | `cue` | — | ANSWER THE QUESTION |
| 3 | `prologue_skills` | Your Team's Skills | center | No | — | — | UNDERSTOOD |
| 4 | `prologue_scout` | Step 1: Assess | center | **Yes** | — | `lantern_of_clues` | USE LAMP OF OBSERVATION |
| 5 | `prologue_stabilize` | Step 2: Stabilize | center | **Yes** | — | `guardians_touch` | USE GUARDIAN'S TOUCH |
| 6 | `prologue_counter` | Step 3: Treat | center | **Yes** | — | `mythic_prescience` | USE MYTHIC PRESCIENCE |
| 7 | `prologue_endturn` | Pass the Time | center | **Yes** | `endTurn` | — | END THE TURN |
| 8 | `prologue_reassess` | Step 4: Reassess | center | **Yes** | — | `reassess` | USE REASSESS |
| 9 | `prologue_prodigy` | Step 5: Finish It | center | No | — | — | GOT IT |
| 10 | `prologue_done` | Assess. Stabilize. Treat. Reassess. Finish. | center | No | — | — | FINISH THE SHIFT |

**Step 1 body:** "Look at those two bars above. The green one is Stability — how safe the patient is right now. If it hits zero, you lose. The red bar is Corruption — how far the disease has taken hold. Bring that to zero and the patient recovers. Your objective is pinned below the bars. I will walk you through every step."

**Step 2 body:** "A clinical question has appeared below this panel. That is your Clinical Cue — it is directly about what this disease is doing to your patient right now. Read it carefully. A correct answer will strengthen everything you do this turn. Tap here first, then answer the question below."

**Step 10 body:** "That's the Care Pathway. Five steps, every shift. Assess first. Stabilize and treat before the turn ends. Reassess after. Then deliver the finishing blow. Each healer has a role. None are passengers. The patient is safe. You did this."

**Developer notes:**
- `prologueBattle` is the **only** tutorial that bypasses the completed/dismissed guards via `replayTutorial` on every mount. Completing it does not prevent it from running again in the prologue context.
- The forced-loss boss scenario (`isPrologueBoss`) skips all tutorial logic entirely.
- Prologue loaners (Nightingale, Fleming, The Prodigy) are required for steps 4–6 and 8. If the pinned skill IDs (`lantern_of_clues`, `guardians_touch`, `mythic_prescience`, `reassess`) change, those steps will never advance.

---

### 2.2 `firstBattle` — "Battle Basics"

**Host:** `frontend/app/battle.tsx`
**Trigger:** First non-prologue, non-boss battle. `startTutorial("firstBattle")` at 800 ms if `!isCompleted("firstBattle")`.
**Replay route:** `/shift`
**Steps (6):**

| # | Step ID | Title | Position | Require action |
|---|---|---|---|---|
| 1 | `fb_intro` | This case is wrong | center | No |
| 2 | `fb_scout` | Read the Patient | center | No |
| 3 | `fb_stabilize` | Shore Up Stability | center | No |
| 4 | `fb_counter` | Reduce Corruption | center | No |
| 5 | `fb_reassess` | Reassess Before Finishing | center | No |
| 6 | `fb_done` | Before Recall | center | No |

All six steps are **informational only** (`requireAction: false`). The player taps through without needing to perform any specific action. No `requiredTargetId` on any step.

**Gate:** `clinicalCueIntro` will not fire until `firstBattle` is completed (`battle.tsx:427–441`).

**Developer notes:**
- All steps are passive. A player can advance every step without doing anything in battle. Consider whether step 3 or 4 should gate on an actual skill use to reinforce the Care Pathway learned in the prologue.
- `firstBattle` is the **entry gate for all subsequent in-battle tutorials** (`clinicalCueIntro`, `affinityMatchIntro`).

---

### 2.3 `firstKingdom` — "Sanctuary Basics"

**Host:** `frontend/app/(tabs)/kingdom.tsx`
**Trigger:** Not completed, auto-start on mount.
**Replay route:** `/(tabs)/kingdom`
**Steps:** Covers inventory, placing a building, and realm growth.
**Required targets:** None confirmed.

---

### 2.4 `firstSummon` — "Hero Summoning"

**Host:** `frontend/app/university/recruit.tsx`
**Trigger:** `startTutorial("firstSummon")` at 600 ms if not completed.
**Replay route:** `/university/recruit`
**Steps (3):**

| # | Step ID | Title | Position | Require action | Action type |
|---|---|---|---|---|---|
| 1 | `summon_intro` | Summoning Intro | center | No | — |
| 2 | `summon_roles` | Hero Roles | center | No | — |
| 3 | `summon_action` | Call a Healer | center | **Yes** | `summon` |

**`onRequiredAction("summon")` call sites:** `recruit.tsx:148, 162, 175` — all pull entry points (1× and 10×) satisfy the requirement.

**Developer notes:**
- Covers both guaranteed ceremony pulls and normal pulls on the same screen. No split.
- **Not taught:** ten-pull vs one-pull distinction, duplicate conversion to Codex Shards, pity counter.
- The "free pulls" / ceremony concept is not explained.

---

### 2.5 `firstWardDefense` — "Ward Defense"

**Host:** `frontend/app/ward-defense.tsx`
**Trigger:** Not completed, auto-start on mount.
**Replay route:** `/ward-defense`
**Steps:** Covers deploying healer units, managing AP, synthesising stronger units.
**Required targets:** None confirmed.

---

### 2.6 `firstHeroTeam` — "Your Active Team"

**Host:** `frontend/app/(tabs)/heroes.tsx`
**Trigger:** `startTutorial("firstHeroTeam")` at 600 ms if not completed.
**Replay route:** `/(tabs)/heroes`
**Steps (2):**

| # | Step ID | Title | Position | Require action | Action type |
|---|---|---|---|---|---|
| 1 | `heroes_intro` | Roster Overview | center | No | — |
| 2 | `heroes_set` | Set Your Team | center | **Yes** | `setTeam` |

**`onRequiredAction("setTeam")` call site:** `heroes.tsx:92`.

**Developer notes — what is NOT taught:**
- Hero roles (Striker / Support / Specialist / etc.)
- Skill previews
- Affinity or clinical-domain matching
- Empty-slot handling
- How to navigate from the Heroes tab to a shift

---

### 2.7 `firstLotusEntry` — "Lotus Plate Journal"

**Host:** `frontend/app/lotus-journal.tsx`
**Trigger:** Not completed, auto-start on mount.
**Replay route:** `/lotus-journal`
**Steps:** Logging a first meal or wellness check-in.

---

### 2.8 `systemHubIntro` — "The System Awakens"

**Host:** `frontend/app/(tabs)/index.tsx`
**Trigger:** `player.seen_reminiscence === true` AND `!isCompleted("systemHubIntro")` — fires at 700 ms delay.
**Replay route (Tutorial Center):** `/(tabs)` — now listed in the Onboarding group of the Tutorial Center ("The System Awakens").
**Steps (3):** Three informational steps (no required action on any).

| # | Step ID | Position |
|---|---|---|
| 1 | `system_awaken` | center |
| 2 | `system_topbar` | banner |
| 3 | `system_to_university` | center |

**`isCompleted` call sites:** `index.tsx:203, 242, 286, 494`; `shift.tsx:74` (gates `systemWardHub`).

**Developer notes:**
- `index.tsx:251` calls `markDone("systemHubIntro")` directly in the no-hero / invalid-state branch. A player who reaches the hub with no heroes gets this silently marked done without ever seeing it. They can replay it via the Tutorial Center ("The System Awakens"), but the first-run experience is still lost. **Review whether this is intentional.**

---

### 2.9 `systemWardHub` — "The Ward"

**Host:** `frontend/app/shift.tsx`
**Trigger:** `isCompleted("systemHubIntro")` AND `player.lessons_started` AND not completed.
**Replay route:** `/shift`
**Steps:** System introduces the Ward and directs the player to the University.

**Gate chain:** `systemHubIntro` → `systemWardHub` → `systemShops`.

---

### 2.10 `systemShops` — "The Apothecary Market"

**Host:** `frontend/app/shop.tsx`
**Trigger:** `isCompleted("systemWardHub")` AND `player.lessons_started` AND `!isCompleted("systemShops")` — fires at 500 ms delay.
**Replay route:** `/shop`
**Steps (1):** One informational step (`system_shops_intro`, center, no required action).

**Notes:**
- Covers the ward shop hub (`shop.tsx`) — the top-level screen listing Apothecary Market, University Shop, and Ward Upgrades. Not scoped to any sub-shop.
- Fires on the player's first visit to the shops hub after the ward introduction chain completes.
- Previously misidentified in audits as `shopIntro`. That name does not exist in code.

---

### 2.11 `clinicalCueIntro` — "Clinical Cues"

**Host:** `frontend/app/battle.tsx:427–441`
**Trigger:** `firstBattle` completed AND a Clinical Cue triggers in battle AND `!isCompleted("clinicalCueIntro")`.
**Replay:** Not listed in Tutorial Center, but IS accessible in the Tutorial Encyclopedia ("Clinical Cues" entry, `replayRoute: "/shift"`). Encyclopedia replay calls `replayTutorial("clinicalCueIntro")`, which immediately sets the tutorial active (bypassing all trigger guards), then navigates to `/shift`. The overlay appears on the next battle mount without waiting for a Clinical Cue event to occur.
**Steps:** Contextual explanation of Clinical Cues during an active battle.

---

### 2.12 `affinityMatchIntro` — "Treatment Affinity"

**Host:** `frontend/app/battle.tsx`
**Trigger:** An affinity match/mismatch event fires AND `!isCompleted("affinityMatchIntro")`.
**Replay:** Not listed in Tutorial Center, but IS accessible in the Tutorial Encyclopedia ("Treatment Affinity" entry, `replayRoute: "/shift"`). Encyclopedia replay calls `replayTutorial("affinityMatchIntro")`, which immediately sets the tutorial active (bypassing all trigger guards), then navigates to `/shift`. The overlay appears on the next battle mount without waiting for an affinity event to occur.
**Steps:** Contextual explanation of affinity bonuses and penalties.

---

### 2.13 `cueHuntIntro` — "Cue Hunt"

**Host:** `frontend/app/university/cue-hunt.tsx`
**Trigger:** Not completed, auto-start on mount.
**Replay route:** `/university/cue-hunt`
**Steps:** Spot three hidden clinical cues in the scene.

---

### 2.14 `rapidTriageIntro` — "Rapid Triage"

**Host:** `frontend/app/university/rapid-triage.tsx`
**Trigger:** Not completed, auto-start on mount.
**Replay route:** `/university/rapid-triage`
**Steps:** Sort three patients by urgency (Emergency / Urgent / Routine).

---

### 2.15 `stabilizeIntro` — "Stabilize Stack"

**Host:** `frontend/app/university/stabilize-stack.tsx`
**Trigger:** Not completed, auto-start on mount.
**Replay route:** `/university/stabilize-stack`
**Steps:** Arrange three care steps in the correct safe sequence.

---

### 2.16 `mealcraftIntro` — "Mealcraft: Lotus Plate"

**Host:** `frontend/app/mealcraft.tsx`
**Trigger:** Not completed, auto-start on mount.
**Replay route:** `/mealcraft`
**Steps:** Build a balanced plate starting with protein.

---

## 3. Tutorial Persistence & State Machine

### State after every possible scenario

| Scenario | `completed[id]` | `dismissed[id]` | Active cleared | Restarts on next mount? |
|---|---|---|---|---|
| Player advances through final step | ✅ true | Unchanged | ✅ | No |
| Player taps Skip | ✅ true | Unchanged | ✅ | No |
| Player navigates away mid-tutorial | Unchanged (false) | ✅ true | ✅ | **No** — dismissed blocks `startTutorial()`; must replay via Tutorial Center / Encyclopedia |
| `router.replace` mid-tutorial | Unchanged | ✅ true | ✅ | **No** — same dismissed block applies |
| Hardware Back mid-tutorial | Unchanged | ✅ true | ✅ | **No** — same dismissed block applies |
| App closed / refreshed mid-tutorial | Unchanged | ✅ true (persisted) | ✅ | **No** — dismissed persists across sessions; replay required |
| Replay via Tutorial Center / Codex | ❌ false | ❌ false (cleared) | — | Forces active immediately, ignores all guards |
| Reset tutorials only (`resetTutorials`) | Key removed | Key removed | ✅ | Yes — all tutorials back to unseen |
| Full account reset | Key removed | Key removed | ✅ | Yes — all tutorials back to unseen |

### Screens combining a TutorialId with a PlayerState flag

| Screen | TutorialId | PlayerState flag required |
|---|---|---|
| `(tabs)/index.tsx` | `systemHubIntro` | `player.seen_reminiscence === true` |
| `shift.tsx` | `systemWardHub` | `isCompleted("systemHubIntro")` |
| `shop.tsx` | `systemShops` | `player.lessons_started` truthy |

### tutorialStore.tsx function reference (lines current as of audit)

| Function | Lines | What it writes |
|---|---|---|
| `markDone(id)` | 133–146 | `completed[id]=true`, saves; clears `dismissed[id]` if set |
| `startTutorial(id)` | 148–164 | Sets `activeId` + `step=0`; refuses if hydrating/active/completed/dismissed |
| `doAdvance()` | 166–183 | `step++`; on final step calls `markDone`, clears active |
| `skipTutorial()` | 185–192 | Calls `markDone(activeId)`, clears active |
| `replayTutorial(id)` | 194–212 | Sets `completed[id]=false`, `dismissed[id]=false`, saves both, forces active |
| `clearActiveTutorial()` | 214–231 | Cancels pending start; sets `dismissed[id]=true`, saves; clears active |
| `resetTutorials()` | 233–245 | Removes both AsyncStorage keys; clears all in-memory maps |
| `isCompleted(id)` | 247–249 | Reads in-memory `completed[id]` |

---

## 4. New-Player Journey — Ordered Tutorial Sequence

Intended path for a fresh account:

```
 1. [Entry]          index → /title → /preloader → resolveEntryRoute
 2. [Onboarding]     Identity Reconstruction — naming / pronouns / profile quiz / aptitude select
 3. [Reminiscence]   Prologue cinematic; sets seen_reminiscence = true
 4. [Hub]            systemHubIntro fires (700 ms after hub mount)
 5. [Heroes tab]     firstHeroTeam fires (600 ms, on first Heroes tab visit)
 6. [Recruitment]    firstSummon fires (600 ms, on first Recruit screen visit)
                     ↳ Two guaranteed ceremony pulls before first Ward Shift
 7. [Prologue shift] prologueBattle ALWAYS force-replayed (10 guided steps, pinned skills)
 8. [Post-recall]    Class quiz / post-recall flow
 9. [Ward hub]       systemWardHub fires (after systemHubIntro + lessons_started)
10. [Real battle]    firstBattle fires (800 ms, first non-prologue battle)
11. [In-battle]      clinicalCueIntro fires on first Clinical Cue (requires firstBattle done)
12. [In-battle]      affinityMatchIntro fires on first affinity event
13. [Shop visit]     systemShops fires (after systemWardHub + lessons_started)
14. [Mode-specific]  firstWardDefense, firstKingdom, cueHuntIntro, rapidTriageIntro,
                     stabilizeIntro, mealcraftIntro — each fires on first screen visit
```

**What the entire sequence never teaches:**
- Ten-pull vs one-pull efficiency or duplicate conversion
- Pity counter display
- Hero roles in depth
- Affinity/clinical-domain matching before entering battle
- Empty-slot handling in the team screen
- How to navigate from Heroes tab to a shift
- Chapter Journey Map navigation
- Daily / Weekly Ward Rounds cycle
- Skill Academy upgrades
- Economy / currency relationships between all currency types

---

## 5. First Regular Battle — Full Context

**Route:** Hub → prologue shift → Recall → post-recall → first Chapter 1 journey node of type `battle` → `/battle?enemyId=fluid_phantom`

| Property | Detail |
|---|---|
| Enemy | Fluid Phantom (`chapterJourney.ts:313`, Chapter 1 first clinical node) |
| Heroes | Whatever three the player assembled — no restriction applied |
| Skills | Each hero's full skill set; no pre-battle locks |
| Initial clues | Profile-dependent: `curious` / `nonmedical` get one extra clue revealed via `getStartingHandicap`; others get the standard reveal set |
| Unknown clues | All non-revealed clues start as `unknown` |
| AP-locked actions | Skill cards dimmed when AP < cost; no label shown until tapped (Gap G-1 below) |
| First affinity feedback | On first skill use against a matched or opposed system |
| Care Chain start | Empty; no chain pre-built |
| Clinical Cue trigger | `clinicalCueIntro` fires only after `firstBattle` is fully completed |
| Reassessment requirement | NCLEX / professional profiles require reassess for 3-star; others do not |
| Tutorial IDs that fire | `firstBattle` at 800 ms (6 informational steps) |
| After firstBattle done | `clinicalCueIntro` permitted on next Clinical Cue event |
| Prompt order | `firstBattle` step 1 → player taps steps 2–6 → battle continues freely → `clinicalCueIntro` on first Cue event |

**What the player is not told at this point:**
- Which hero skills are strong/weak against Fluid Phantom's clinical system
- How the affinity bonus percentage is calculated
- What the Clinical Cue bonus does to skill output values
- Exact star requirements for this fight
- How the Care Chain fills or scores

---

## 6. Tutorial Center & Encyclopedia Inventory

### Tutorial Center — 14 entries

All 14 rows unconditionally render a Replay button.
`clinicalCueIntro` and `affinityMatchIntro` are excluded from the Tutorial Center but are accessible via the Tutorial Encyclopedia with a replay route of `/shift`.

| Group | Tutorial ID | Player-facing label | Replay route |
|---|---|---|---|
| Onboarding | `systemHubIntro` | The System Awakens | `/(tabs)` |
| Onboarding | `prologueBattle` | Your First Shift | `/battle?enemyId=dehydration_wisp&training=1&prologue=tutorial&replay=1` |
| Onboarding | `firstBattle` | Battle Basics | `/shift` |
| Onboarding | `systemWardHub` | The Ward | `/shift` |
| Onboarding | `systemShops` | The Apothecary Market | `/shop` |
| Heroes & Recruitment | `firstHeroTeam` | Your Active Team | `/(tabs)/heroes` |
| Heroes & Recruitment | `firstSummon` | Hero Summoning | `/university/recruit` |
| University Mini-Games | `cueHuntIntro` | Cue Hunt | `/university/cue-hunt` |
| University Mini-Games | `rapidTriageIntro` | Rapid Triage | `/university/rapid-triage` |
| University Mini-Games | `stabilizeIntro` | Stabilize Stack | `/university/stabilize-stack` |
| University Mini-Games | `mealcraftIntro` | Mealcraft: Lotus Plate | `/mealcraft` |
| Game Modes | `firstWardDefense` | Ward Defense | `/ward-defense` |
| Realm & Wellness | `firstKingdom` | Sanctuary Basics | `/(tabs)/kingdom` |
| Realm & Wellness | `firstLotusEntry` | Lotus Plate Journal | `/lotus-journal` |

### Tutorial Encyclopedia — all entries by section

| Section | Entry title | Has tutorialId / replay button | Note |
|---|---|---|---|
| Combat & Shifts | Ward Shift | ✅ Yes | — |
| Combat & Shifts | Clinical Cues | ✅ Yes | — |
| Combat & Shifts | Treatment Affinity | ✅ Yes | — |
| Combat & Shifts | Ward Defense | ✅ Yes | — |
| University Learning | Cue Hunt | ✅ Yes | — |
| University Learning | Rapid Triage | ✅ Yes | — |
| University Learning | Stabilize Stack | ✅ Yes | — |
| Heroes & Recruitment | Summoning Hall | ✅ Yes | — |
| Heroes & Recruitment | Active Team | ✅ Yes | — |
| Heroes & Recruitment | Skill Academy | ❌ No | Static text only |
| Realm & Wellness | Realm / Sanctuary | ✅ Yes | — |
| Realm & Wellness | Lotus Plate Journal | ✅ Yes | — |
| Realm & Wellness | Mealcraft | ✅ Yes | — |
| Shops & Economy | Apothecary Market | ✅ Yes | — |
| Shops & Economy | Currencies Guide | ❌ No | Static text only |
| Journey & Quests | Chapter Journey Map | ❌ No | Static text only |
| Journey & Quests | Daily & Weekly Rounds | ❌ No | Static text only |
| Journey & Quests | Community Board | ❌ No | `coming_soon` flag |

---

## 7. Learner-Profile Compatibility

### Canonical IDs and legacy aliases

| Canonical ID | Picker label | Legacy aliases accepted at picker |
|---|---|---|
| `curious` | New Learner | `nonmedical`, `rpg`, `cozy`, `teen` |
| `nursing_student` | Health Student | `nursingStudent`, `preNursing`, `medical_learner` |
| `nclex` | NCLEX Prep | `nclexPrep` |
| `professional` | Clinician Review | `healthcareProfessional` |

### Full call-site table

| File : line | Value checked | Canonical or legacy | Behavior controlled | Bug? |
|---|---|---|---|---|
| `battle.tsx:151` | `getExplanationLayer(player?.learning_profile)` | Both, delegated | Battle briefing / action feedback language | No |
| `battle.tsx:155` | `getStartingHandicap(profile)` | Both, delegated | Battle starting stability, damage reduction, extra clue, star settings | No |
| `battle.tsx:662` | `=== "curious" \|\| === "nonmedical"` inline literal | `curious` canonical; `nonmedical` legacy | Sets `isNonmedical` for battle presentation | ⚠️ Minor — inline instead of helper |
| `battle.tsx:1061` | `getStarRules(profile, ENEMY_CLINICAL[enemy.id])` | Both, delegated | Post-battle star requirements | No |
| `battle.tsx:1121` | `getStarRules(profile, enemyClinical)` | Both, delegated | Live battle star rules | No |
| `result.tsx:127–128` | `getExplanationLayer(player?.learning_profile)` | Both, delegated | Result-screen language | No |
| `tutorial.tsx:22–23` | `getTutorialTier(player?.learning_profile)` | Both, delegated | Novice / practiced / expert tutorial content | No |
| `learning-profile.tsx:82–89` | `player?.learning_profile ?? null` | Both | Picker display + `setLearningProfile` | No |
| `learning-profile.tsx:141` | `curious` ← `nonmedical, rpg, cozy, teen` | Legacy compat | Marks Curious option selected | No (intentional) |
| `learning-profile.tsx:142` | `nursing_student` ← `nursingStudent, preNursing, medical_learner` | Legacy compat | Marks Health Student option selected | ⚠️ `preNursing` grouped here but treated as novice in downstream systems |
| `learning-profile.tsx:143` | `nclex` ← `nclexPrep` | Legacy compat | Marks NCLEX option selected | No |
| `clinical.ts:40–55` `getInitialFeedbackLevel` | `preNursing` → `supportive` | Legacy | Feedback depth | ⚠️ Should be `standard` |
| `clinical.ts:88–108` `getStartingHandicap` | `preNursing` → +10/+3 | Legacy | Battle starting assist | ⚠️ Should be 0/0 |
| `clinical.ts:1242–1263` `getStarRules` | `preNursing` → student bucket | Legacy | Star rules | ✅ No bug — already correct |
| `difficulty.ts:110–126` `DEFAULT_DIFFICULTY_BY_PROFILE` | `preNursing` → `standard`; `medical_learner` absent | Legacy / gap | Default difficulty level | ⚠️ `preNursing` should be `clinical`; `medical_learner` missing |
| `tutorial.ts:17–37` `getTutorialTier` | `preNursing` → `novice` | Legacy | Tutorial depth | ⚠️ Should be `practiced` |
| `onboarding.ts:204–211` `PROFILE_ID_COMPAT` | Only `nonmedical → curious` normalized | Design gap | ID normalization at onboarding | ⚠️ Other aliases not normalized |
| `tests/consult_balance.test.ts:141` | `getStarRules('nursingStudent', ...)` | Legacy test fixture | Verifies star rules for legacy ID | No — confirms legacy support works |

### Summary by behavior domain

| Domain | Affected | Bug? |
|---|---|---|
| Tutorial depth (`getTutorialTier`) | `preNursing` gets `novice` instead of `practiced` | ⚠️ Yes |
| Feedback depth (`getInitialFeedbackLevel`) | `preNursing` gets `supportive` instead of `standard` | ⚠️ Yes |
| Battle handicap (`getStartingHandicap`) | `preNursing` gets +10/+3 instead of 0/0 | ⚠️ Yes |
| Difficulty default (`DEFAULT_DIFFICULTY_BY_PROFILE`) | `preNursing` = `standard` not `clinical`; `medical_learner` absent | ⚠️ Yes |
| Star rules (`getStarRules`) | `preNursing` already in correct bucket | ✅ No bug |
| Battle presentation (`battle.tsx:662`) | Inline literal instead of shared helper | ⚠️ Minor style issue |
| Clinical Cue behavior | No profile-based cue branching found | No gap |
| Progression / rewards | No profile-based reward differences found | No gap |

**Fix task:** Task #364 (Draft) covers all confirmed bugs above.

---

## 8. Currency Terminology

### Player-facing labels and CurrencyId map

| Player-facing label | CurrencyId | Status | Key locations |
|---|---|---|---|
| Codex Shards | `codex_shards` | ✅ Canonical, consistent | PlayerHeader, Ward Defense rewards, Encyclopedia, Tutorial Center, `gacha.ts` |
| Hero Shards | `hero_shards` | ✅ Canonical | `university.ts`, `evolution.ts`, `materials.ts`, Encyclopedia |
| Crowns | `crowns` | ✅ Canonical | PlayerHeader, Economy Guide, shop screens |
| Insight Crystals | `insight_crystals` | ✅ Canonical | Lotus Journal, Shop section, World Event, `economy.ts` |
| Refined Lotus Gems | `refined_lotus_gems` | ✅ Canonical | Shop section, Economy Guide, PlayerHeader, `milestones.tsx` |
| Lotus Gems | `lotus_gems` | ✅ Canonical (base tier) | Lotus Journal, Shop, `lessons.ts` |
| University Credits | `university_credits` | ✅ Canonical | Uni Shop, Credits badge component, `classTree.ts`, `store.tsx` |
| Ward Sigils | `ward_sigils` | ✅ Canonical (limited) | `economy.ts`, `materials.ts`, `realm.ts` |
| Summoning Shards | *(former name)* | ✅ Fully renamed — **zero occurrences** | Completed by Task #355 (merged) |
| Gold Crowns | *(label)* | Not found as a string literal | `crowns` is the CurrencyId; displayed as "Crowns" |
| Ward Coins | *(label)* | **Not found anywhere** | Not a CurrencyId, not a player-facing string |
| Ward Tokens | *(label)* | **Not found anywhere** | Not a CurrencyId, not a player-facing string |
| Jade Scrolls | *(label)* | **Not found anywhere** | Not a CurrencyId, not a player-facing string |

**Ward Coins, Ward Tokens, Jade Scrolls** have zero occurrences in all source files. They are either names planned but never implemented, or names removed before shipping. No action required unless they are being added.

---

## 9. Known Bugs & Confirmed Gaps

### Confirmed bugs (code-verified)

| ID | Severity | Area | Description | Task |
|---|---|---|---|---|
| B-1 | Medium | Learner profile | `preNursing` → `novice` tutorial tier; should be `practiced` | #364 |
| B-2 | Medium | Learner profile | `preNursing` → `supportive` feedback depth; should be `standard` | #364 |
| B-3 | Medium | Learner profile | `preNursing` → +10/+3 starting handicap; should be 0/0 | #364 |
| B-4 | Medium | Learner profile | `preNursing` → `standard` difficulty; should be `clinical` | #364 |
| B-5 | Low | Learner profile | `medical_learner` absent from `DEFAULT_DIFFICULTY_BY_PROFILE` | #364 |
| B-6 | Low | Learner profile | `battle.tsx:662` inline literal instead of shared helper | #364 |

### Confirmed gaps (not bugs — missing features or content)

| ID | Area | What is missing | Task |
|---|---|---|---|
| G-1 | Battle UI | "Not enough AP" label not shown on dimmed skill cards until tapped | #104 (Proposed) |
| G-2 | `firstHeroTeam` | Hero roles, skill previews, affinity matching, empty-slot handling, mission start not taught | None yet |
| G-3 | `firstSummon` | Ten-pull vs one-pull, duplicate conversion, pity display not taught | None yet |
| G-4 | `firstBattle` | All 6 steps informational — player can tap through without engaging with battle | None yet |
| G-5 | `systemHubIntro` | `markDone` silently fires in no-hero branch (`index.tsx:251`) before player sees the tutorial | Needs investigation |
| G-6 | Tutorial Center | `clinicalCueIntro` and `affinityMatchIntro` not in Tutorial Center, but both are accessible via the Tutorial Encyclopedia with `replayRoute: "/shift"` | None yet |
| G-7 | New-player path | No tutorial teaches: Chapter Journey Map, Daily/Weekly Rounds, currency relationships, Care Chain scoring | None yet |
| G-8 | Profile normalization | `nursingStudent`, `nclexPrep`, `healthcareProfessional` not normalized to canonical IDs in `PROFILE_ID_COMPAT` | None yet |

---

## 10. Correct vs Previously Incorrect Claims

### Incorrect claims — now resolved

| Claim | Truth |
|---|---|
| "`shopIntro` exists and is implemented" | The ID is `systemShops`. `shopIntro` does not exist anywhere in code. |
| "No dedicated shop tutorial exists" | `systemShops` is implemented and fires on first shop hub visit. |
| "`summonIntro` covers normal Summoning Hall separately from ceremony" | One tutorial (`firstSummon`) covers one screen; no split. |
| "`teamIntro` / `heroesIntro`" are valid TutorialIds | The implemented ID is `firstHeroTeam`. |
| "Mid-tutorial navigation permanently locks players out" | Fixed by Task #357 (merged). Dismissed state blocks `startTutorial()` auto-restart, but the player can replay at any time via Tutorial Center or Tutorial Encyclopedia — it does not lock them out permanently. |
| "Summoning Shards still appears in player-facing strings" | Fixed by Task #355 (merged). Zero occurrences remain. |
| "`useClearTutorialOnExit` hook does not exist" | The hook exists at `frontend/src/hooks/useClearTutorialOnExit.ts` and is used by `battle.tsx` and other tutorial host screens. It calls `clearActiveTutorial()` on blur/unmount. |

### Technically true but misleading

| Claim | Nuance |
|---|---|
| "An entire learner profile is broken" | Only specific branches of `preNursing` are wrong. Canonical IDs (`curious`, `nursing_student`, `nclex`, `professional`) work correctly throughout. |
| "The prologue tutorial can be skipped permanently" | `prologueBattle` can be skipped/completed, but it is force-replayed via `replayTutorial` on every prologue mount regardless of completion state. |
| "Currency terminology is inconsistent" | Was true for `Summoning Shards` before Task #355. All terminology is now clean. |

---

## 11. Remaining Open Questions

| # | Question | Why it matters |
|---|---|---|
| Q-1 | Does `recruit.tsx` host both the guaranteed ceremony pulls and normal pulls on the same screen, or are they separate screens? | If separate, `firstSummon` may not cover normal pulls at all. |
| Q-2 | Is `markDone("systemHubIntro")` at `index.tsx:251` in the no-hero branch intentional? | If not, players who reach the hub without heroes permanently skip the welcome tutorial. They can now replay it via the Tutorial Center, but the first-run experience is still lost. |
| Q-3 | Should `rpg/cozy/teen` aliases be actively migrated to `curious` in stored player data? | These values can still exist in old saves. If any downstream code doesn't handle them they silently fall through. |
| Q-4 | Are `Ward Tokens` and `Jade Scrolls` planned future currencies? | No code exists for them. If they are being added, `economy.ts` entries are needed before any UI references them. |
| Q-5 | Should `clinicalCueIntro` and `affinityMatchIntro` be added to Tutorial Center? | Both are replayable via the Tutorial Encyclopedia, but not via Tutorial Center. Players who do not find the Encyclopedia have no obvious replay path — consider whether Tutorial Center discoverability is worth the addition. |

---

## 12. Suggested Improvements (Developer Notes)

Design suggestions for review — accept or reject as appropriate.

**T-1. Gate at least one `firstBattle` step on a real action.**
All 6 steps are informational. A player can tap through the entire "Battle Basics" tutorial without touching a skill. Gating step 3 or 4 on an actual stabilise or strike action would ensure the Care Pathway is practised, not just read.

**T-2. Add `clinicalCueIntro` and `affinityMatchIntro` to Tutorial Center.**
Players who dismiss these in-battle can replay them via the Tutorial Encyclopedia ("Clinical Cues" and "Treatment Affinity" entries, both with `replayRoute: "/shift"`). They are not in Tutorial Center. Adding them to Tutorial Center as well would make the replay path more discoverable for players who do not find the Encyclopedia.

**T-3. Add a hero-roles step to `firstHeroTeam`.**
The current two steps (overview + set team) leave players unaware of role differences. A third informational step showing Striker / Support / Specialist labels before confirming the team would significantly improve early team-building decisions.

**T-4. Teach ten-pull value and pity in `firstSummon`.**
Only the basic summon action is required. Players who one-pull through the ceremony never learn about the pity counter or ten-pull efficiency.

**T-5. Add `medical_learner` to all profile-utility maps proactively.**
It currently only appears in `learningProfileLabel` and the explanation-layer mapper. Add it to `getTutorialTier`, `getInitialFeedbackLevel`, `getStartingHandicap`, and `DEFAULT_DIFFICULTY_BY_PROFILE` now (mapped to `nursing_student` equivalents) before any players accumulate that stored ID.

**T-6. Normalize all legacy profile IDs at login / profile load.**
`PROFILE_ID_COMPAT` only normalizes `nonmedical → curious`. Adding `nursingStudent → nursing_student`, `nclexPrep → nclex`, `healthcareProfessional → professional` eliminates the need for dual-ID branches in every downstream function.

**T-7. Review silent `markDone("systemHubIntro")` in the no-hero branch.**
`index.tsx:251` marks the welcome tutorial done when the player state is invalid. Players who hit this branch lose the first-run welcome sequence, though they can now replay it via the Tutorial Center ("The System Awakens" in the Onboarding group).

---

*To update this document: ask for a tutorial audit. The full codebase will be re-traced and this file regenerated.*
