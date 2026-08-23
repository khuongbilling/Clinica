"""Private, server-owned Crisis Drill manifest and public-projection helpers.

Age 1 approved catalog: 16 reviewed drills, eight emergency families × two
variants (training / crisis), first cases clearly named.  Each drill has 4-6
decision beats: Alert → Handoff → assessment → priority → intervention →
response/clinical-change → escalation → reassessment → outcome/debrief.

NEVER import this module into the mobile/web bundle.  Public projections never
leak correct keys, rewards, unrevealed findings, future branches, or scoring.
"""
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Internal drill builder
# ---------------------------------------------------------------------------

def _drill(
    drill_id: str,
    family: str,
    variant: str,       # "training" | "crisis"
    title: str,
    subtitle: str,
    domain: str,
    difficulty: str,    # "introductory" | "standard" | "advanced"
    patient: str,
    age: int,
    alert: str,
    handoff: str,
    concern: str,
    state: Dict[str, int],
    finding_label: str,
    finding_value: str,
    principle: str,
    practice: List[str],
) -> Dict[str, Any]:
    """Assemble a private Crisis Drill manifest."""
    finding_id = f"{drill_id}-finding"
    # Crisis Drill is deliberately a focused 3–8 minute experience, not a
    # replacement for the longer Clinical Simulation or Grand Rounds formats.
    minutes = {"introductory": 3, "standard": 5, "advanced": 8}[difficulty]
    acuity = "critical" if min(state.values()) < 45 else "high" if min(state.values()) < 60 else "moderate"
    return {
        "version": 1,
        "family": family,
        "variant": variant,
        "title": title,
        "subtitle": subtitle,
        "domain": domain,
        "difficulty": difficulty,
        "patientName": patient,
        "patientAge": age,
        "alert": alert,
        "handoff": handoff,
        "concern": concern,
        "estimatedMinutes": minutes,
        "initial": {**state, "acuity": acuity},
        "hidden": [{"id": finding_id, "label": finding_label, "value": finding_value}],
        "principle": principle,
        "relatedPractice": practice,
        # 5-beat station chain: alert → assess → priority → intervene → reassess
        # Safe branches recover; unsafe branches degrade state but remain solvable.
        "beats": ["alert", "handoff", "assess", "priority", "intervene", "reassess"],
        "stations": {
            # Beat 1 – Alert recognition
            "alert": {
                "label": "Alert recognition",
                "beat": "alert",
                "inputKind": "single_choice",
                "prompt": "A rapid change has been flagged. Choose the immediate recognition action.",
                "responses": {
                    "acknowledge-alert": {
                        "label": "Acknowledge the alert and move to the bedside immediately",
                        "rationale": "Timely recognition is the first barrier against preventable deterioration.",
                        "announcement": "You respond promptly; the alert is validated and handoff begins.",
                        "delta": {"stability": 4},
                        "points": 20,
                        "next": "handoff",
                    },
                    "defer-alert": {
                        "label": "Note the alert and finish the current task first",
                        "rationale": "Deferring an alert delays every subsequent step.",
                        "announcement": "The delayed response allows early deterioration to advance.",
                        "delta": {"stability": -10, "perfusion": -6},
                        "unsafe": True,
                        "points": 0,
                        "next": "handoff",
                    },
                },
            },
            # Beat 2 – Handoff / SBAR framing
            "handoff": {
                "label": "Structured handoff",
                "beat": "handoff",
                "inputKind": "sequence",
                "prompt": "The oncoming clinician needs the situation. Choose the handoff that includes the critical change.",
                "responses": {
                    "sbar-handoff": {
                        "label": "Deliver a structured situation-background-assessment-recommendation handoff",
                        "rationale": "A structured handoff transfers ownership of the critical change clearly.",
                        "announcement": "The receiving clinician has the concern and owns the next action.",
                        "delta": {"stability": 6},
                        "points": 20,
                        "next": "assess",
                    },
                    "informal-handoff": {
                        "label": "Give a brief informal update without naming the change",
                        "rationale": "An informal handoff leaves the concern unowned.",
                        "announcement": "The change is not communicated; the next clinician begins without it.",
                        "delta": {"stability": -8},
                        "unsafe": True,
                        "points": 0,
                        "next": "assess",
                    },
                },
            },
            # Beat 3 – Focused assessment (reveals hidden finding)
            "assess": {
                "label": "Focused assessment",
                "beat": "assessment",
                "inputKind": "single_choice",
                "prompt": "Choose the assessment that best clarifies the current risk.",
                "responses": {
                    "focused-assessment": {
                        "label": f"Assess the critical pattern: {finding_label.lower()}",
                        "rationale": "Make the concerning pattern visible before acting.",
                        "announcement": "Your focused assessment reveals information needed for the next decision.",
                        "reveal": [finding_id],
                        "delta": {"stability": 5},
                        "points": 20,
                        "next": "priority",
                    },
                    "skip-assessment": {
                        "label": "Skip the assessment and proceed to treatment",
                        "rationale": "Acting without assessment risks treating the wrong problem.",
                        "announcement": "The critical pattern remains unexamined; a misstep follows.",
                        "delta": {"stability": -12, "oxygenation": -8},
                        "unsafe": True,
                        "points": 0,
                        "next": "priority",
                    },
                },
            },
            # Beat 4 – Priority decision
            "priority": {
                "label": "Priority decision",
                "beat": "priority",
                "inputKind": "priority",
                "prompt": "Set the immediate priority for this emergency.",
                "responses": {
                    "escalate-priority": {
                        "label": "Name the emergency, protect the patient, and escalate now",
                        "rationale": "Rapid escalation with a named concern is the correct emergency response.",
                        "announcement": "The concern is escalated; the team mobilizes an appropriate response.",
                        "delta": {"stability": 10, "perfusion": 6},
                        "points": 20,
                        "next": "intervene",
                    },
                    "defer-priority": {
                        "label": "Continue current care while waiting for more information",
                        "rationale": "Delaying escalation in a crisis allows irreversible decline.",
                        "announcement": "The delay worsens the patient's reserve before the team responds.",
                        "delta": {"stability": -16, "perfusion": -10, "oxygenation": -8},
                        "unsafe": True,
                        "points": 0,
                        "next": "intervene",
                    },
                },
            },
            # Beat 5 – Intervention / immediate response
            "intervene": {
                "label": "Immediate intervention",
                "beat": "intervention",
                "inputKind": "single_choice",
                "prompt": "Choose the safest immediate intervention while the team evaluates the cause.",
                "responses": {
                    "bundle-response": {
                        "label": "Apply the evidence-based response bundle and escalate ongoing monitoring",
                        "rationale": "A bundle response addresses multiple failure modes simultaneously.",
                        "announcement": "The response bundle improves the patient's reserve and monitoring.",
                        "delta": {"stability": 14, "oxygenation": 10, "perfusion": 10},
                        "points": 20,
                        "next": "reassess",
                    },
                    "single-intervention": {
                        "label": "Apply one familiar intervention without escalating further",
                        "rationale": "A single unverified intervention may miss the broader emergency.",
                        "announcement": "The isolated response does not address the full concern.",
                        "delta": {"stability": -12, "oxygenation": -6},
                        "unsafe": True,
                        "points": 0,
                        "next": "reassess",
                    },
                },
            },
            # Beat 6 – Reassessment / outcome
            "reassess": {
                "label": "Reassessment and debrief",
                "beat": "reassessment",
                "inputKind": "sequence",
                "prompt": "Close the loop with the reassessment that confirms the emergency response.",
                "responses": {
                    "closed-loop-reassess": {
                        "label": "Reassess the response, communicate findings, and confirm the next check",
                        "rationale": "Closed-loop reassessment confirms the response and prevents recurrence.",
                        "announcement": "The reassessment closes the loop; outcome and next steps are shared.",
                        "delta": {"stability": 8, "oxygenation": 6, "perfusion": 6},
                        "points": 20,
                        "next": None,
                    },
                    "assume-resolved": {
                        "label": "Assume the emergency is resolved and move on without reassessing",
                        "rationale": "Without reassessment, an incomplete response may be missed.",
                        "announcement": "The response is assumed effective; a subtle issue persists undetected.",
                        "delta": {"stability": -8},
                        "unsafe": True,
                        "points": 0,
                        "next": None,
                    },
                },
            },
        },
    }


# ---------------------------------------------------------------------------
# Reviewed Age 1 catalog – 16 drills, 8 families × 2 variants
# ---------------------------------------------------------------------------
# Column order: drill_id, family, variant, title, subtitle, domain, difficulty,
#               patient, age, alert, handoff, concern, state, finding_label,
#               finding_value, principle, practice

_DRILL_ROWS = (
    # ── Family 1: Airway Emergency ──────────────────────────────────────────
    (
        "cd-airway-training-alert",
        "airway-emergency", "training",
        "Airway Alert: Training Run",
        "Recognise and respond to a sudden airway change under supervision.",
        "airway", "introductory",
        "Ms. Rivera", 58,
        "Oxygen saturation alarm: SpO₂ 84% — new onset.",
        "Patient was comfortable two minutes ago; saturation has dropped sharply and she is now using accessory muscles.",
        "Acute airway compromise",
        {"stability": 52, "oxygenation": 42, "perfusion": 68},
        "SpO₂ trend", "SpO₂ fell from 97% to 84% in under three minutes.",
        "A sudden saturation drop requires immediate assessment before any intervention.",
        ["Clinical Cue Lab", "Rapid Triage Hall"],
    ),
    (
        "cd-airway-crisis-response",
        "airway-emergency", "crisis",
        "Airway Crisis: Rapid Response",
        "Coordinate a rapid response for imminent airway failure.",
        "airway", "standard",
        "Mr. Nakamura", 72,
        "EMERGENCY: Partial airway obstruction, audible stridor, cyanotic lips.",
        "Patient attempted to speak and began choking; airway partially obstructed and cyanosis is visible.",
        "Imminent airway failure",
        {"stability": 38, "oxygenation": 30, "perfusion": 52},
        "Obstruction level", "Upper airway partially occluded; stridor audible at one metre.",
        "Imminent airway failure requires concurrent assessment and escalation — never sequential.",
        ["Clinical Cue Lab", "Stabilize Stack Lab"],
    ),

    # ── Family 2: Respiratory Deterioration ─────────────────────────────────
    (
        "cd-resp-training-wheeze",
        "respiratory-deterioration", "training",
        "Respiratory Drill: The Returning Wheeze",
        "Manage a partial bronchospasm response that returns after initial treatment.",
        "airway", "introductory",
        "Mrs. Osei", 45,
        "New wheeze audible bilaterally; SpO₂ 91%.",
        "Bronchospasm initially improved with treatment but wheeze has returned and speech is laboured.",
        "Recurring bronchospasm",
        {"stability": 56, "oxygenation": 50, "perfusion": 70},
        "Work of breathing", "Patient cannot complete a sentence without pausing.",
        "A partial response that returns requires reassessment — the plan must change.",
        ["Clinical Cue Lab", "Stabilize Stack Lab"],
    ),
    (
        "cd-resp-crisis-silent-chest",
        "respiratory-deterioration", "crisis",
        "Respiratory Crisis: Silent Chest",
        "Recognise a life-threatening bronchospasm pattern before the monitor shows it.",
        "airway", "standard",
        "Ms. Park", 31,
        "ALERT: Breath sounds inaudible bilaterally — silent chest.",
        "Patient had moderate bronchospasm; breath sounds are now absent bilaterally.",
        "Severe bronchospasm — silent chest",
        {"stability": 40, "oxygenation": 36, "perfusion": 60},
        "Bilateral breath sounds", "Absent bilaterally; prior wheeze has disappeared.",
        "Silent chest is a late and dangerous sign — act before the monitor confirms deterioration.",
        ["Clinical Cue Lab", "Rapid Triage Hall"],
    ),

    # ── Family 3: Perfusion / Circulatory Collapse ──────────────────────────
    (
        "cd-perfusion-training-cool-extremities",
        "perfusion-collapse", "training",
        "Perfusion Drill: The Cool Hands",
        "Identify early circulatory compromise from bedside findings before the monitor changes.",
        "assessment", "introductory",
        "Mr. Vasquez", 61,
        "Nursing alert: patient cool and mottled to the knees.",
        "Urine output has dropped and patient is restless; systolic blood pressure is still within normal limits.",
        "Early circulatory compromise",
        {"stability": 57, "oxygenation": 72, "perfusion": 44},
        "Capillary refill", "Capillary refill > 4 seconds bilaterally.",
        "A reassuring number never replaces a converging bedside picture.",
        ["Clinical Cue Lab", "Stabilize Stack Lab"],
    ),
    (
        "cd-perfusion-crisis-shock",
        "perfusion-collapse", "crisis",
        "Perfusion Crisis: Distributive Shock",
        "Recognise and act on distributive shock before multi-organ failure begins.",
        "assessment", "standard",
        "Mrs. Okafor", 54,
        "EMERGENCY: BP 76/40, HR 128, skin flushed and warm.",
        "Septic focus identified; patient suddenly haemodynamically unstable.",
        "Distributive (septic) shock",
        {"stability": 34, "oxygenation": 58, "perfusion": 28},
        "Lactate trend", "Serum lactate 4.8 mmol/L — rising.",
        "Septic shock demands simultaneous resuscitation and source-control planning.",
        ["Stabilize Stack Lab", "Rapid Triage Hall"],
    ),

    # ── Family 4: Medication Emergency ──────────────────────────────────────
    (
        "cd-medication-training-wrong-rate",
        "medication-emergency", "training",
        "Medication Drill: Infusion Rate Error",
        "Identify and safely manage an infusion running faster than prescribed.",
        "pharmacology", "introductory",
        "Ms. Nguyen", 49,
        "Alert: heparin infusion pump alarming — rate discrepancy detected.",
        "Night nurse reports infusion has been running at double the prescribed rate for an unknown duration.",
        "Medication administration error — anticoagulant",
        {"stability": 60, "oxygenation": 74, "perfusion": 62},
        "Infusion duration at error rate", "Running at double rate for approximately 90 minutes.",
        "A medication error requires immediate pause, transparent communication, and a safe correction plan.",
        ["Clinical Cue Lab", "Rapid Triage Hall"],
    ),
    (
        "cd-medication-crisis-anaphylaxis",
        "medication-emergency", "crisis",
        "Medication Crisis: Anaphylaxis",
        "Recognise and immediately treat anaphylaxis after drug administration.",
        "pharmacology", "standard",
        "Mr. Johansson", 38,
        "EMERGENCY: Urticaria, stridor, and hypotension 3 minutes after IV antibiotic.",
        "Antibiotic given per order; patient developed hives, stridor, and BP dropped to 80/50.",
        "Anaphylaxis post-drug administration",
        {"stability": 36, "oxygenation": 46, "perfusion": 32},
        "Anaphylaxis trigger", "IV antibiotic administered 3 minutes before symptom onset.",
        "Anaphylaxis requires adrenaline as the first-line drug — every second counts.",
        ["Clinical Cue Lab", "Stabilize Stack Lab"],
    ),

    # ── Family 5: Neurological Deterioration ────────────────────────────────
    (
        "cd-neuro-training-confusion",
        "neurological-deterioration", "training",
        "Neurological Drill: New Confusion",
        "Differentiate new confusion from a patient's baseline and respond appropriately.",
        "assessment", "introductory",
        "Mrs. Tanaka", 76,
        "Family alert: patient not recognising family members — new today.",
        "Previously oriented patient is now confused, agitated, and cannot recall recent events.",
        "Acute altered mental status",
        {"stability": 58, "oxygenation": 68, "perfusion": 56},
        "Baseline comparison", "Family confirms this confusion is entirely new in the last two hours.",
        "New confusion is a medical emergency until a reversible cause is excluded.",
        ["Clinical Cue Lab", "Rapid Triage Hall"],
    ),
    (
        "cd-neuro-crisis-stroke",
        "neurological-deterioration", "crisis",
        "Neurological Crisis: Stroke Code",
        "Activate a stroke code rapidly and protect the patient during the time-sensitive window.",
        "judgment", "standard",
        "Mr. Osei", 67,
        "STROKE ALERT: Sudden right-sided weakness and slurred speech — onset 40 minutes ago.",
        "Patient was walking to the bathroom; right arm and leg suddenly became weak and speech is slurred.",
        "Acute ischaemic stroke — time-critical",
        {"stability": 50, "oxygenation": 66, "perfusion": 60},
        "Time since onset", "Onset confirmed 40 minutes ago — within thrombolysis window.",
        "Stroke is a time-critical emergency — rapid activation and communication prevent permanent disability.",
        ["Rapid Triage Hall", "Stabilize Stack Lab"],
    ),

    # ── Family 6: Cardiac Emergency ─────────────────────────────────────────
    (
        "cd-cardiac-training-ecg-change",
        "cardiac-emergency", "training",
        "Cardiac Drill: ECG Change Recognition",
        "Identify a new concerning ECG finding and initiate the correct escalation pathway.",
        "assessment", "introductory",
        "Ms. Singh", 55,
        "Telemetry alert: new ST-elevation on bedside monitor.",
        "Patient reported chest tightness 10 minutes ago; telemetry now shows ST-segment elevation.",
        "New ECG change — possible ACS",
        {"stability": 60, "oxygenation": 70, "perfusion": 56},
        "ST-elevation lead", "ST-elevation in leads II, III, and aVF — inferior pattern.",
        "A new ST-elevation demands immediate 12-lead ECG, escalation, and cath-lab activation planning.",
        ["Clinical Cue Lab", "Rapid Triage Hall"],
    ),
    (
        "cd-cardiac-crisis-vf-arrest",
        "cardiac-emergency", "crisis",
        "Cardiac Crisis: VF Arrest",
        "Lead the initial response to a witnessed ventricular fibrillation cardiac arrest.",
        "stabilization", "advanced",
        "Mr. Russo", 63,
        "EMERGENCY: Patient unresponsive — no pulse — cardiac monitor shows VF.",
        "Patient called out and immediately collapsed; telemetry shows coarse VF.",
        "Witnessed VF cardiac arrest",
        {"stability": 10, "oxygenation": 20, "perfusion": 10},
        "Arrest rhythm", "Coarse VF confirmed on cardiac monitor.",
        "VF arrest requires immediate CPR and defibrillation — every 10 seconds without CPR worsens outcome.",
        ["Stabilize Stack Lab", "Rapid Triage Hall"],
    ),

    # ── Family 7: Sepsis Recognition ────────────────────────────────────────
    (
        "cd-sepsis-training-subtle",
        "sepsis-recognition", "training",
        "Sepsis Drill: The Subtle Signs",
        "Identify early sepsis from converging vital sign trends before the patient is visibly unwell.",
        "assessment", "introductory",
        "Mrs. Mbeki", 66,
        "Nursing flag: temperature 38.4°C, heart rate 108, respiratory rate 22.",
        "Vital signs have been trending upward over the shift; patient has a known wound site.",
        "Early sepsis — converging vital signs",
        {"stability": 58, "oxygenation": 66, "perfusion": 52},
        "Source identification", "Wound site is erythematous and draining purulent material.",
        "Early sepsis is best treated before haemodynamic instability — the trend is the warning.",
        ["Clinical Cue Lab", "Stabilize Stack Lab"],
    ),
    (
        "cd-sepsis-crisis-bundle",
        "sepsis-recognition", "crisis",
        "Sepsis Crisis: Hour-1 Bundle",
        "Coordinate the sepsis Hour-1 Bundle before the patient decompensates.",
        "assessment", "standard",
        "Mr. Chukwu", 58,
        "SEPSIS ALERT: qSOFA 3/3 — lactate 2.8 mmol/L — BP dropping.",
        "Patient meets all sepsis criteria; BP is now 88/52 and deteriorating.",
        "Sepsis with impending septic shock",
        {"stability": 42, "oxygenation": 60, "perfusion": 38},
        "Bundle completion status", "Lactate measured, cultures ordered; antibiotics and fluids not yet started.",
        "The Hour-1 Bundle must be started simultaneously — not sequentially.",
        ["Stabilize Stack Lab", "Rapid Triage Hall"],
    ),

    # ── Family 8: Multi-System / Capstone ───────────────────────────────────
    (
        "cd-multisystem-training-overlap",
        "multisystem-crisis", "training",
        "Multi-System Drill: Overlapping Concerns",
        "Hold two concurrent clinical concerns and prioritise them without losing either.",
        "judgment", "standard",
        "Ms. Andrade", 74,
        "Simultaneous alerts: SpO₂ 89% AND new confusion in the same patient.",
        "Patient has both a dropping saturation and acute mental status change; team is managing a second patient.",
        "Concurrent respiratory and neurological deterioration",
        {"stability": 50, "oxygenation": 54, "perfusion": 58},
        "Dominant concern", "Respiratory decline is driving the mental status change — treat the airway first.",
        "When two concerns compete, the one causing the other is the primary priority.",
        ["Clinical Cue Lab", "Rapid Triage Hall"],
    ),
    (
        "cd-multisystem-crisis-convergence",
        "multisystem-crisis", "crisis",
        "Multi-System Crisis: Full Convergence",
        "Age 1 capstone: hold airway, perfusion, medication safety, and communication simultaneously.",
        "judgment", "advanced",
        "Mrs. Chen", 78,
        "FULL ALERT: Airway compromise + BP 74/42 + new drug allergy flag — code team en route.",
        "Patient deteriorating rapidly across three systems; code team is three minutes away.",
        "Multi-system crisis — capstone emergency",
        {"stability": 30, "oxygenation": 34, "perfusion": 26},
        "Convergence pattern", "Airway, perfusion, and pharmacological risks are simultaneously active.",
        "In a full convergence, name each threat aloud, assign owners, and act on the most reversible first.",
        ["Clinical Cue Lab", "Rapid Triage Hall", "Stabilize Stack Lab"],
    ),
)

CRISIS_DRILL_CASES: Dict[str, Dict[str, Any]] = {row[0]: _drill(*row) for row in _DRILL_ROWS}

# Every decision must show a meaningful three-choice set and leave room for
# more than one defensible safe response.  The alternate response is intentionally
# less complete than the primary response, while still preserving safe care and
# the authored branch.  Scoring remains private to this server module.
for _manifest in CRISIS_DRILL_CASES.values():
    for _station_id, _station in _manifest["stations"].items():
        _primary_id, _primary = next(
            (response_id, response)
            for response_id, response in _station["responses"].items()
            if not response.get("unsafe")
        )
        _station["responses"][f"safe-alternative-{_station_id}"] = {
            "label": f"Use a safe interim response, then { _station['label'].lower() } with the team",
            "rationale": "A safe interim action can protect the patient while the team completes the full response.",
            "announcement": "You take a safe interim action and keep the team focused on the next clinical step.",
            "delta": {"stability": max(0, int(_primary.get("delta", {}).get("stability", 0)) // 2)},
            "points": max(8, int(_primary.get("points", 0)) - 6),
            "next": _primary.get("next"),
        }

# Family → [training_id, crisis_id] ordering (stable for client breadth display)
CRISIS_DRILL_FAMILIES: Dict[str, List[str]] = {}
for _drill_id, _manifest in CRISIS_DRILL_CASES.items():
    _fam = _manifest["family"]
    CRISIS_DRILL_FAMILIES.setdefault(_fam, []).append(_drill_id)


# ---------------------------------------------------------------------------
# Public projection helpers
# ---------------------------------------------------------------------------

def public_cd_beat(manifest: Dict[str, Any], beat_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Return the current decision beat without leaking answer keys or points."""
    if not beat_id:
        return None
    station = manifest["stations"].get(beat_id)
    if not station:
        return None
    return {
        "id": beat_id,
        "label": station["label"],
        "beat": station["beat"],
        "urgency": "critical" if manifest["initial"]["stability"] < 45 else "urgent",
        "inputKind": station["inputKind"],
        "prompt": station["prompt"],
        "options": [
            {"id": rid, "label": item["label"], "rationale": item["rationale"]}
            for rid, item in station["responses"].items()
        ],
    }


def public_cd_attempt(attempt: Dict[str, Any]) -> Dict[str, Any]:
    """Return only the player-visible state of a Crisis Drill attempt.

    Intentionally excluded from the projection:
    - correct answer keys / points per response
    - unrevealed findings
    - future branches / next-beat routing
    - scoring internals
    - server-side reward calculation inputs
    """
    manifest = CRISIS_DRILL_CASES[attempt["drillId"]]
    status = attempt["status"]
    current_beat = attempt.get("beatId") if status not in {"abandoned"} else None

    # Timing: expose a short server-owned response window only while a decision
    # is active. Paused and interrupted attempts omit it entirely.
    timing: Optional[Dict[str, Any]] = None
    if (
        status == "active"
        and current_beat
        and attempt.get("mode") == "crisis"
        and attempt.get("ranked")
        and attempt.get("decision_started_at")
        and not attempt.get("paused_at")
    ):
        timing = {
            "decision_started_at": attempt["decision_started_at"],
            "window_seconds": 45,
        }
    public_timeline = [
        {
            **entry,
            "stepId": entry["beatId"],
            "timingLabel": f"Step {index + 1}",
        }
        for index, entry in enumerate(attempt.get("timeline", []))
    ]
    patient = {
        k: attempt["patient"][k]
        for k in ("stability", "oxygenation", "perfusion", "concern", "acuity")
    }
    patient["urgency"] = "critical" if patient["acuity"] == "critical" else "urgent" if patient["acuity"] == "high" else "routine"

    return {
        "attemptId": attempt["attemptId"],
        "drillId": attempt["drillId"],
        # Compatibility aliases keep the public mobile contract semantic while
        # persistence remains explicitly drill-oriented on the server.
        "caseId": attempt["drillId"],
        "version": attempt["version"],
        "family": attempt["family"],
        "variant": attempt["variant"],
        "difficulty": attempt["difficulty"],
        "mode": attempt["mode"],
        "status": status,
        "beat": public_cd_beat(manifest, current_beat),
        "step": public_cd_beat(manifest, current_beat),
        "patient": patient,
        "known": attempt.get("known", []),
        "timeline": public_timeline,
        "safety": attempt.get("safety", "safe"),
        "timing": timing,
        "elapsedLabel": "Decision window active" if timing else "",
        "complicationActive": attempt.get("safety") == "unsafe",
        # ranked is false when paused/interrupted — clients must not show a
        # ranked badge until completion confirms it.
        "ranked": attempt.get("ranked", True) and status == "active",
    }
