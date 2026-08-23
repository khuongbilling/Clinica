---
name: Clinical Simulation Lab authority
description: Durable contract for deterministic Package 2 simulation attempts and evidence.
---

Simulation attempts are server-owned receipts: the client may render patient state and submit an approved action ID, but it must never provide an official score, reward, safety result, branch, or clinical effect. A server attempt binds the player, reviewed manifest version, configuration, fixed seed/branch, and ordered action IDs; duplicate actions and duplicate completion must remain idempotent/rejected as appropriate. Completion must conditionally persist one canonical debrief and bind its daily-progress event to the attempt ID, so a parallel request or lost response cannot diverge the receipt or lose practice credit.

**Why:** Simulation cases are intended to produce bounded practice evidence rather than a client-spoofable reward loop, while preserving pause/resume and exact-branch review.

New Variation is also server-owned: after debrief, select an eligible sibling from the completed-receipt history and derive its difficulty/style configuration from the selected reviewed manifest. Once a family is exhausted, advance in stable order without repeating the just-completed patient.

**Why:** The client can render the selected case but must not decide which patient, difficulty, or style a learner receives next.

**How to apply:** Keep all new patient transitions, reveals, complications, objectives, and debrief calculations authored in matching reviewed manifests. Reuse the existing University Practice daily event exactly once on a new completion; never add a Simulation currency, AP, energy, timer, or a second question bank. When changing variation flows, send the just-completed attempt for server validation and render the returned case ID/configuration rather than predicting a sibling locally.