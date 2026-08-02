# Clinica Tutorial System — Verification Report

> **Purpose:** Verified, corrected audit of the Clinica tutorial system covering all 8 investigation
> areas. This document supersedes and corrects the findings in `docs/clinica-tutorial-discovery-audit.md`
> where they conflict. All findings below are sourced from live code readings; file + line citations
> are provided throughout.
>
> **Scope:** Read-only audit. No application code was modified.

---

## Section A — Verified Findings

### A1 — Learner-Profile Identifiers

**Canonical IDs (four):** `curious`, `nursing_student`, `nclex`, `professional`

**Legacy / alternate IDs (nine):** `nonmedical`, `rpg`, `cozy`, `teen`, `preNursing`,
`nursingStudent`, `nclexPrep`, `healthcareProfessional`, `medical_learner`

**Every switch that compares profile values:**

| File | Lines | What it does |
|---|---|---|
| `frontend/src/game/clinical.ts` | 42–53 | `getDifficulty` switch; covers all 4 canonical IDs + all legacy aliases |
| `frontend/src/game/clinical.ts` | 90–104 | Profile-dependent clinical text/config; same groups |
| `frontend/src/game/clinical.ts` | 1245–1258 | Another profile switch; same groups |
| `frontend/src/game/clinical.ts` | 1443–1471 | Keyed label/description maps; all canonical + legacy |
| `frontend/src/game/tutorial.ts` | 17–36 | `getTutorialTier`: curious/nonmedical/rpg/cozy/teen/preNursing → `novice`; nursing_student/nursingStudent/nclex/nclexPrep → `practiced`; professional/healthcareProfessional → `expert`; default `practiced` |
| `frontend/src/game/firstWeekPath.ts` | 295–311 | `learningProfileLabel`; adds `medical_learner` |
| `frontend/app/learning-profile.tsx` | 141–144 | Equivalence checks for canonical ↔ legacy |

**Systems that do NOT handle all 4 canonical IDs:**
None found. All profile-aware switches cover all four canonical IDs. `getTutorialTier` handles
all four but maps them to tiers, not per-ID behavior. `firstWeekPath.ts:244-250` only tests
truthiness and is not a classification switch.

**Tutorial-depth bugs vs Clinical Care bugs:** No tutorial-depth bug was found. `getTutorialTier`
correctly maps legacy IDs to the same tiers as their canonical equivalents, so depth is consistent.
No `clinical.ts` switch was found to omit a canonical ID. No bug confirmed in this area.

---

### A2 — Shop Tutorial

**`shopIntro` does NOT exist.** The correct `TutorialId` is `systemShops`.

| Field | Value |
|---|---|
| TutorialId | `systemShops` |
| Host screen | `frontend/app/shop.tsx` |
| Trigger | Mounts on Shop tab; starts after `systemWardHub` is complete AND at least one lesson done; 500 ms delay |
| Steps | 1 step (`tutorials.ts:449-458`) |
| Required targets | None |
| Persistence key | `clinica.tutorials.v1` → field `systemShops` |
| Replay | Via `replayTutorial`; exit marks complete |
| Completion | Final step advance, skip, or exit (`useClearTutorialOnExit`) |
| What shop it introduces | Apothecary Market ("The Apothecary Market": market unlocked, currencies for supplies/upgrades/cosmetics, no performance shortcuts) |

---

### A3 — Summoning Tutorials

**`summonIntro` does NOT exist.** The correct `TutorialId` is `firstSummon`.

**Guaranteed recruitment ceremony vs normal Summoning Hall:**
- The ceremony is tracked by `tutorial_summon_1_done` / `tutorial_summon_2_done` flags
  (`recruit.tsx:91-104, 127-131`). `doTutorialSummon` calls store action `tutorialRecruitOnce(activeSummonIndex)`
  (`recruit.tsx:133-150`). It is guaranteed (preferred role for summon 2, excludes owned heroes,
  never trainee/credits; `university.ts:422-449`).
- The normal Summoning Hall (free draw, single, 10-pull) is entirely separate (`recruit.tsx:153-187`).
- Route `/summon` redirects to `/university/recruit` (`frontend/app/summon.tsx:1-5`).

**`firstSummon` tutorial:**
- Host: `frontend/app/university/recruit.tsx:106-111` (auto-starts if incomplete, no delay listed).
- Steps: 3 (`tutorials.ts:275-301`); covers shards/recruitment, healer roles, free daily/single
  recruitment, duplicates → Hero Shards, assign team.
- Required targets: None (action type `summon`).
- `TutorialOverlay` rendered at `recruit.tsx:491`.

**First-use tutorial after ceremony:** There is no separate tutorial for the normal 1-pull / 10-pull
system after the ceremony. `firstSummon` fires on first visit to the recruit screen (before or
after the ceremony), not specifically after it. A gap exists: a player who completes both ceremony
pulls and then uses their first normal pull has no contextual guidance for it.

---

### A4 — Team Tutorial

**`teamIntro` does NOT exist.** The correct `TutorialId` is `firstHeroTeam`.

| Field | Value |
|---|---|
| TutorialId | `firstHeroTeam` |
| Host screen | `frontend/app/(tabs)/heroes.tsx` (Hall of Heroes, NOT mission loadout) |
| Trigger | Auto-starts if incomplete, 600 ms delay after mount |
| Steps | 2 (`tutorials.ts:350-368`) |
| Required targets | None (action type `setTeam`) |
| What it teaches | Roster stores recruited healers; up to 3 active; tap + to add/remove; changes save immediately |
| Completion | Final advance, skip, or exit |

**Mission Loadout guidance:** `frontend/app/mission-loadout.tsx` has no `TutorialOverlay`, no
`useTutorial` hook, no `teamIntro`/`firstHeroTeam` wiring. It provides static contextual notices:
prologue loaner explanation (`mission-loadout.tsx:908-918`), hero-picker route from empty slots
(`:946`), and CTA button "Begin Training"/"Deploy to Ward" (`:1226`). The `isTutorial` route
param gates some display logic (`:650-674`) but is not backed by the tutorial store.

**Hero Picker:** No tutorial wiring (`frontend/app/hero-picker.tsx:88-151`). Empty roster only
prompts visiting Recruitment Hall (`:153-172`).

**Gap:** The first mission loadout is only partially guided. `firstHeroTeam` runs earlier in
Hall of Heroes; by the time a player reaches mission loadout the team tutorial is complete, but
there is no guided overlay walking them through slot assignment or confirming which heroes are
equipped. The static loaner notice is the only scaffolding.

---

### A5 — Tutorial Persistence

**Storage key:** All tutorial completion flags live under `clinica.tutorials.v1` in AsyncStorage
(`tutorialStore.tsx:7`).

**`useClearTutorialOnExit` behavior** (`frontend/src/hooks/useClearTutorialOnExit.ts:6-21`):
Installed via `useFocusEffect`; cleanup callback calls `clearActiveTutorial()` on screen blur/unmount.
`clearActiveTutorial` (`tutorialStore.tsx:164-179`): clears queued pre-hydration starts, calls
`markDone(id)` if an active tutorial exists, updates the completion ref, clears active ID, resets
step index. **Leaving mid-tutorial DOES mark it complete and prevents auto-restart.**

| Scenario | Outcome |
|---|---|
| Normal navigation away | Screen blurs → `useFocusEffect` cleanup → `clearActiveTutorial` → `markDone` → persisted complete |
| Navigation replacement | Same as above; back and replace are indistinguishable to the hook |
| Hardware back | Same as above |
| App force-kill/OS termination | Not guaranteed; JS cleanup may not run; already-persisted completions survive |
| Tutorial replay | `replayTutorial(id)` writes `false` to `clinica.tutorials.v1` for that ID, re-enables it; next exit marks done again |
| Exception: prologueBattle | Replay-started via `replayTutorial`; intentionally re-enabled each time prologue replay screen loads |

**`startTutorial` vs storage:** `startTutorial` reads in-memory hydrated completion state (loaded
at hydration time from the key) but does NOT directly read/write AsyncStorage. Only `markDone`
writes the key.

**Screens using BOTH `clinica.tutorials.v1` AND `PlayerState seen_*` flags:**

| Screen | Tutorial-store usage | PlayerState `seen_*` flags |
|---|---|---|
| `frontend/app/(tabs)/index.tsx` | `isCompleted("systemHubIntro")`, `startTutorial`, `markDone` | `seen_reminiscence`, `seen_lv2_unlock` |
| `frontend/app/battle.tsx` | `prologueBattle`, `firstBattle` via tutorial store | `seen_florence_cameo`, `seen_boss_narrator`, `seen_card_tutorial`, `seen_call_tutorial`, `seen_fluid_phantom_counter_tutorial`, `seen_lord_imbalance_expertise_tutorial` |
| `frontend/app/university/index.tsx` | `useTutorial` (`activeTutorialId`) | `seen_university_intro` |

**Full list of `seen_*` flags in PlayerState** (`frontend/src/game/types.ts`):

| Flag | Line |
|---|---|
| `seen_lv2_unlock?: boolean` | :360 |
| `seen_florence_cameo?: boolean` | :364 |
| `seen_boss_narrator?: boolean` | :368 |
| `seen_reminiscence?: boolean` | :382 |
| `seen_university_intro?: boolean` | :383 |
| `seen_practice_curriculum?: boolean` | :430 |
| `seen_card_tutorial?: boolean` | :454 |
| `seen_call_tutorial?: boolean` | :457 |
| `seen_fluid_phantom_counter_tutorial?: boolean` | :460 |
| `seen_lord_imbalance_expertise_tutorial?: boolean` | :463 |

---

### A6 — Currency Terminology

| Player-Facing Label | Internal CurrencyId / Category | Status |
|---|---|---|
| Ward Coins | `ward_coins` (`economy.ts:39`) | **Canonical** |
| Codex Shards | `codex_shards` (`economy.ts:50,56`) | **Canonical** |
| Insight Crystals | `insight_crystals` (`economy.ts:61,68`) | **Canonical** |
| Refined Lotus Gems | `refined_lotus_gems` (`economy.ts:72,79`) | **Canonical** |
| Lotus Gems | `lotus_gems` (`economy.ts:83`) | **Canonical but placeholder** (monetization not live; `economy.ts:88-90, 157-186, 240-271`) |
| University Credits | `university_credits` (`economy.ts:105`) | **Canonical** |
| Ward Sigils | `ward_sigils` (`materials.ts:123-127`; `economy.ts:93-101`) | **Canonical** |
| Hero Shards | Not a CurrencyId; progression material | **Canonical material** (not economy currency) |
| Summoning Shards | Alias for Codex Shards | **Contradictory/Legacy** — appears in player-facing UI at `tutorial-encyclopedia.tsx:165,277,291`, `tutorial-center.tsx:69`, `chapterJourney.ts:78`, `journeyRewards.ts:39`, `milestones.ts:11`, `PlayerHeader.tsx:76,140,239,244,359`, `Lv2UnlockModal.tsx:29,47,52,133` |
| Crowns | Alias for Ward Coins | **Contradictory/Legacy** — appears at `modeHub.ts:97,105` (reward UI), `shop-section/[id].tsx:242` (WD recruitment) |
| Gold Crowns | — | **Unused** (no matches in codebase) |
| Ward Tokens | — | **Unused** (no matches in codebase) |
| Jade Scrolls | — | **Unused** (no matches in codebase) |

---

### A7 — First Regular Battle

**Route to first non-prologue battle:** After prologue/Recall → Chapter 1 → node `c1n4`
("First Shift — Dehydration Wisp", route `/shift`; `chapterJourney.ts:261-272`). Preceding nodes
in Ch1 are memory fragment + two story/triage beats (`chapterJourney.ts:148-185`). Ch1–8 are
simulations (`chapterJourney.ts:1-8`).

**Enemy:** `dehydration_wisp` / Hypovolemic Wisp. Stats from `docs/battle-audit.md:55-69`:
corruption 58, stability 68, instability 5, 5% hidden defense, River system, River weakness.

**Clue visibility:** Only `visibleClues` shown initially (`battle.tsx:1371-1386`). Hidden clues
(including hidden defense) are concealed until revealed by Assess/Analyze actions
(`battle.tsx:260, 613-675`). Skills with explicit reveal behavior are tagged in `content.ts`
(e.g. Lantern of Clues :69).

**Available heroes:** Player's recruited team (up to 3), assembled before the shift. No loaner
team in this battle (loaners are prologue-only).

**Tutorial prompts that fire — exact order:**
The `firstBattle` tutorial auto-starts on the first non-prologue battle (`battle.tsx:~422`).
Its 6 steps (`tutorials.ts:187-237`):

| Step ID | Title | Button |
|---|---|---|
| `fb_intro` | "This case is wrong." | BEGIN |
| `fb_scout` | "Look first." | GOT IT |
| `fb_stabilize` | "Now keep them steady." | GOT IT |
| `fb_counter` | "Push back the illness." | GOT IT |
| `fb_reassess` | "Check again." | GOT IT |
| `fb_done` | "You followed the rhythm correctly." | UNDERSTOOD |

**TutorialIds that do NOT yet exist** but were named in `clinica-tutorial-discovery-audit.md:1557-1564,
1582, 1691-1692` as planned: `clinicalCueIntro`, `affinityMatchIntro`, `lockedActionIntro`,
`currencyFirstEarnIntro`, `careChainIntro`, `affinityIntro`. None of these appear in the `TutorialId`
union (`tutorials.ts:1-17`). They are design intent, not implemented behavior.

---

### A8 — Audit Contradictions Resolved

| Contradiction | Resolution |
|---|---|
| Original audit names `shopIntro` | Correct ID is `systemShops` (`tutorials.ts:64-70, 449-458`; `shop.tsx:23-40`) |
| Original audit names `summonIntro` | Correct ID is `firstSummon` (`tutorials.ts:56-63, 275-301`; `recruit.tsx:106-111`) |
| Original audit names `teamIntro` | Correct ID is `firstHeroTeam` (`tutorials.ts:56-63, 350-368`; `heroes.tsx:46-67`) |
| `clinicalCueIntro`, `affinityMatchIntro`, `lockedActionIntro`, `careChainIntro`, `affinityIntro`, `currencyFirstEarnIntro` described as existing | None exist in `TutorialId`; they are unimplemented design targets in the audit doc |
| "Summoning Shards" used interchangeably with "Codex Shards" in audit | "Summoning Shards" is a legacy/contradictory alias; canonical name in `economy.ts` is "Codex Shards"; the legacy label appears in live player-facing UI in 8+ files |
| "Crowns" vs "Ward Coins" | "Crowns" is a legacy/contradictory alias; appears in `modeHub.ts:97,105` and `shop-section/[id].tsx:242` which are player-facing |
| `useClearTutorialOnExit` described in older hook comment as NOT marking complete | Current implementation DOES mark active tutorial complete on exit (`tutorialStore.tsx:164-179`); hook comment is outdated |
| `teamIntro` said to trigger from Mission Loadout | Confirmed: `firstHeroTeam` triggers from Hall of Heroes (`heroes.tsx`), not from mission loadout; loadout has only static notices |

---

## Section B — Incorrect Findings from Original Audit

The following items in `docs/clinica-tutorial-discovery-audit.md` are incorrect and must not be
relied upon for implementation planning:

1. **`shopIntro`** does not exist → the live `TutorialId` is `systemShops`.
2. **`summonIntro`** does not exist → the live `TutorialId` is `firstSummon`.
3. **`teamIntro`** does not exist → the live `TutorialId` is `firstHeroTeam`.
4. **`clinicalCueIntro`, `affinityMatchIntro`, `lockedActionIntro`, `careChainIntro`, `affinityIntro`, `currencyFirstEarnIntro`** do not exist in the live `TutorialId` union. They are unimplemented design targets only.
5. **`useClearTutorialOnExit` does NOT abandon without marking complete** — the current `clearActiveTutorial` implementation calls `markDone` (`tutorialStore.tsx:169-174`). Exiting a tutorial mid-way permanently marks it done. The older hook comment describing the opposite behavior is outdated.
6. **"Summoning Shards"** is not a canonical currency name; it is a legacy alias for Codex Shards that contradicts `economy.ts` and still appears in live player-facing UI across 8+ files.
7. **"Gold Crowns", "Ward Tokens", "Jade Scrolls"** do not appear anywhere in the codebase; they are fully unused terms that should not be referenced in any new copy or implementation work.

---

## Section C — Remaining Uncertainties

1. **`firstBattle` vs planned contextual prompts:** The existing `firstBattle` (6 informational
   steps) does not cover affinity, Clinical Cue, locked actions, or Care Chain in any detail.
   Whether the planned IDs (`clinicalCueIntro` etc.) are intended to replace `firstBattle`,
   augment it, or fire as separate contextual prompts is not resolved in any implemented code.

2. **`cueHuntIntro` / `rapidTriageIntro` / `stabilizeIntro` as battle gates:** These University
   practice tutorials exist and are implemented, but whether completing them is a gate (or should
   be) for the first Ward Shift battle is unclear; no gate was found linking them.

3. **`firstSummon` vs ceremony ordering:** `firstSummon` starts on first visit to
   `/university/recruit`; this could fire before the two guaranteed ceremony pulls or after them.
   If a player arrives at the recruit screen for the ceremony, `firstSummon` may overlay the
   ceremony UI. The exact interplay was not traced to a definitive resolution.

4. **`systemHubIntro` gate chain:** `systemHubIntro` requires `seen_reminiscence` to be true;
   `seen_reminiscence` is set by the reminiscence screen, which itself requires prologue completion.
   The full gate chain was not traced end-to-end to confirm there is no race condition on first
   post-prologue hub visit.

5. **Force-kill persistence:** If the app is killed while a tutorial is on step 2 of 6, the
   completion flag is NOT written (only step advances are in-memory). The player re-visits the
   screen and the tutorial re-starts from step 1. This may be intentional (correct behavior) or
   a minor inconsistency depending on design intent.

---

## Section D — Files and Line Ranges Reviewed

```
frontend/src/game/clinical.ts:21-53, 90-104, 1245-1258, 1443-1471
frontend/src/game/tutorial.ts:17-36
frontend/src/game/tutorials.ts:1-17, 56-70, 97-237, 275-368, 400-458, 469-546
frontend/src/game/tutorialStore.tsx:7, 50-63, 86-99, 101-107, 109-122, 152-179
frontend/src/hooks/useClearTutorialOnExit.ts:6-32
frontend/src/game/firstWeekPath.ts:244-311
frontend/src/game/economy.ts:39, 50-90, 93-105, 120-145, 157-271, 355-494
frontend/src/game/university.ts:13, 187-190, 380, 405, 419-460, 422-449
frontend/src/game/materials.ts:123-127, 142
frontend/src/game/modeHub.ts:97-130
frontend/src/game/chapterJourney.ts:1-8, 78, 148-185, 261-272
frontend/src/game/journeyRewards.ts:8-39
frontend/src/game/milestones.ts:11-12
frontend/src/game/content.ts:~69, ~114, ~166, ~1012
frontend/src/game/types.ts:360-463
frontend/src/game/store.tsx:385, 457, 508, 550, 656, 1117, 2375, 2387-2390
frontend/app/(tabs)/index.tsx (full relevant sections)
frontend/app/(tabs)/heroes.tsx:46-93, 594
frontend/app/battle.tsx:260, 422, 613-675, 1371-1386
frontend/app/shop.tsx:23-40, 114-121
frontend/app/university/recruit.tsx:91-111, 127-187, 233-235, 491
frontend/app/university/index.tsx (seen_university_intro gating)
frontend/app/mission-loadout.tsx:650-674, 908-918, 946, 1226
frontend/app/hero-picker.tsx:88-172
frontend/app/summon.tsx:1-5
frontend/app/learning-profile.tsx:27-66, 141-144
frontend/app/tutorial-encyclopedia.tsx:26, 165, 168, 201, 272-291
frontend/app/tutorial-center.tsx:69
frontend/src/components/PlayerHeader.tsx:26-82, 132-294
frontend/src/components/Lv2UnlockModal.tsx:29-133
frontend/src/components/TutorialOverlay.tsx (structure)
frontend/app/shop-section/[id].tsx:242, 470-596
docs/battle-audit.md:41-69
docs/clinica-tutorial-discovery-audit.md:1557-1582, 1691-1692
```

---

## Section E — Safe Fixes Required Before Tutorial Implementation

These are low-risk, isolated corrections that must be in place before any new `TutorialId` values
are added. They prevent silent inconsistencies from propagating into the new tutorial work.

### E1 — Rename "Summoning Shards" → "Codex Shards" (player-facing copy)

**Risk:** Low — terminology-only change, no logic changes required.

**Files to update:**

| File | Relevant lines |
|---|---|
| `frontend/app/tutorial-encyclopedia.tsx` | 165, 277, 291 |
| `frontend/app/tutorial-center.tsx` | 69 |
| `frontend/src/game/chapterJourney.ts` | 78 |
| `frontend/src/game/journeyRewards.ts` | 39 |
| `frontend/src/game/milestones.ts` | 11 |
| `frontend/src/components/PlayerHeader.tsx` | 76, 140, 239, 244, 359 |
| `frontend/src/components/Lv2UnlockModal.tsx` | 29, 47, 52, 133 |

### E2 — Rename "Crowns" → "Ward Coins" (player-facing copy)

**Risk:** Low — copy-only in two files.

**Files to update:**

| File | Relevant lines | Context |
|---|---|---|
| `frontend/src/game/modeHub.ts` | 97, 105 | Reward preview copy |
| `frontend/app/shop-section/[id].tsx` | 242 | Ward Defense recruitment blurb |

### E3 — Update `useClearTutorialOnExit` hook comment

**File:** `frontend/src/hooks/useClearTutorialOnExit.ts`

**Change:** The JSDoc comment (lines 6–21) currently states that leaving a tutorial mid-way
does not mark it complete. The current implementation (`tutorialStore.tsx:164-179`) calls
`markDone` inside `clearActiveTutorial`. The comment must be updated to accurately state that
leaving mid-tutorial **does** mark it complete, so future implementors do not build logic
expecting incomplete tutorials to auto-resume.

### E4 — Verify `firstSummon` vs ceremony ordering (investigation + possible guard)

**Risk:** Medium if unaddressed — `firstSummon` may overlay the ceremony pull UI on first
recruit-screen visit.

**Action:** Trace the `firstSummon` auto-start guard (`recruit.tsx:106-111`) against the
ceremony state flags (`tutorial_summon_1_done`, `tutorial_summon_2_done`). If `firstSummon`
can start during the ceremony pulls, add a `ceremonyComplete` guard or a sequenced trigger
so the two flows do not overlap.

---

## Section F — Recommended First Tutorial Implementation Push

### Scope

Contextual in-battle tutorial overlays for affinity outcomes, Clinical Cues, and locked actions.

### Rationale

The existing `firstBattle` tutorial (6 informational steps, `tutorials.ts:187-237`) is purely
narrative — it does not guide the player through understanding affinity hit outcomes, Clinical
Cue bonus windows, or the meaning of dimmed/locked skill cards. The planned IDs for these
prompts (`clinicalCueIntro`, `affinityMatchIntro`, `lockedActionIntro`) exist as design intent
in the original audit doc but have not been added to the live `TutorialId` union. This push
wires the in-battle contextual prompts that fire when the player first encounters each mechanic.

### New `TutorialId` values to add

| New ID | Trigger condition | Steps |
|---|---|---|
| `clinicalCueIntro` | First Clinical Cue window opens in any non-prologue battle | 1–2 steps |
| `affinityMatchIntro` | Player's first skill produces a non-neutral affinity result (strong or weak hit) | 1–2 steps |
| `lockedActionIntro` | First time a skill card is dimmed due to insufficient AP | 1–2 steps |

### Where to implement each

Inside the relevant action handlers in `battle.tsx`, following the `onRequiredAction` / `markDone`
pattern already used by guided battle steps (see `battle.tsx:~421-424` for `firstBattle`
auto-start reference). Each should be a 1–2 step informational overlay (not blocking/forced),
using `startTutorial` only if the ID is not already completed.

### Pre-conditions for this push

1. Fixes **E1** (rename "Summoning Shards") and **E2** (rename "Crowns") are merged first.
2. Fix **E3** (hook comment update) is merged first.
3. Fix **E4** (`firstSummon`/ceremony ordering) is confirmed or resolved before this push ships.
4. This document (`docs/clinica-tutorial-verification-report.md`) is committed.

---

*Report generated from live code review. No application files were modified.*
