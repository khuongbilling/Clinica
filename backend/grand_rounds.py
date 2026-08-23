"""Private, reviewed Grand Rounds manifest and public-projection helpers.

Never import this module into the mobile/web bundle.  A response's point value,
safety classification, next station, and state effect are intentionally private.
"""
from typing import Any, Dict, List, Optional


def _case(
    case_id: str, family: str, title: str, subtitle: str, domain: str, difficulty: str,
    patient: str, age: int, handoff: str, concern: str, state: Dict[str, int],
    finding_label: str, finding_value: str, principle: str, practice: List[str],
    chapter: int = 1, practice_count: int = 3,
) -> Dict[str, Any]:
    finding = f"{case_id}-finding"
    minutes = {"introductory": 15, "standard": 20, "advanced": 25, "expert": 30}[difficulty]
    return {
        "version": 1, "family": family, "title": title, "subtitle": subtitle, "domain": domain,
        "difficulty": difficulty, "patientName": patient, "patientAge": age, "handoff": handoff,
        "concern": concern, "estimatedMinutes": minutes, "unlockChapter": chapter,
        "unlockPractice": practice_count, "initial": {**state, "acuity": "high" if min(state.values()) < 55 else "moderate"},
        "hidden": [{"id": finding, "label": finding_label, "value": finding_value}],
        "principle": principle, "relatedPractice": practice,
        "stations": {
            "observe": {
                "label": "Focused assessment", "inputKind": "single_choice",
                "prompt": "Choose the assessment that best clarifies the current risk.",
                "responses": {
                    "focused-assessment": {"label": f"Assess the changing pattern: {finding_label.lower()}", "rationale": "Make the concerning pattern observable.", "announcement": "Your focused assessment reveals information needed for the next decision.", "reveal": [finding], "points": 25, "next": "priority"},
                    "routine-deferral": {"label": "Continue routine tasks and reassess later", "rationale": "A new change should not be deferred without assessment.", "announcement": "The meaningful change remains unexamined while the patient loses reserve.", "delta": {"stability": -12}, "unsafe": True, "points": 0, "next": "priority"},
                },
            },
            "priority": {
                "label": "Priority decision", "inputKind": "priority",
                "prompt": "Set the immediate priority for this patient.",
                "responses": {
                    "escalate-priority": {"label": "Protect the patient and communicate the changing concern", "rationale": "The findings make this the immediate priority.", "announcement": "The concern is prioritized and a shared response begins.", "delta": {"stability": 8}, "points": 25, "next": "intervene"},
                    "defer-priority": {"label": "Finish lower-priority work before acting on the change", "rationale": "Delay can create a preventable complication.", "announcement": "The delay creates a complication requiring a deliberate adaptation.", "delta": {"stability": -18, "perfusion": -10}, "unsafe": True, "points": 0, "next": "complication"},
                },
            },
            "intervene": {
                "label": "Immediate response", "inputKind": "single_choice",
                "prompt": "Choose the safest approved response while the team evaluates the cause.",
                "responses": {
                    "support-and-escalate": {"label": "Provide immediate support and escalate the response", "rationale": "Support and escalation protect the patient while the plan is refined.", "announcement": "The immediate response improves the patient's reserve.", "delta": {"stability": 16, "oxygenation": 12, "perfusion": 12}, "points": 25, "next": "reassess"},
                    "single-fix": {"label": "Apply one familiar fix without escalating", "rationale": "A single unverified response can miss broader deterioration.", "announcement": "The isolated response does not address the full concern.", "delta": {"stability": -14, "oxygenation": -8}, "unsafe": True, "points": 0, "next": "reassess"},
                },
            },
            "complication": {
                "label": "Complication response", "inputKind": "sequence",
                "prompt": "A change occurred after the delay. Choose the next safe action.",
                "responses": {
                    "recover-and-escalate": {"label": "Stabilize the complication, name the change, and escalate", "rationale": "A visible complication needs recovery and clear communication.", "announcement": "The team responds to the complication and restores some reserve.", "delta": {"stability": 10, "oxygenation": 8, "perfusion": 8}, "points": 15, "next": "reassess"},
                    "minimize-complication": {"label": "Minimize the change and continue the original plan", "rationale": "Minimizing a new complication compounds the safety risk.", "announcement": "The unresolved complication worsens the patient's condition.", "delta": {"stability": -18, "perfusion": -12}, "unsafe": True, "points": 0, "next": "reassess"},
                },
            },
            "reassess": {
                "label": "Reassessment", "inputKind": "sequence",
                "prompt": "Close the loop by choosing the reassessment that confirms the plan.",
                "responses": {
                    "closed-loop-reassessment": {"label": "Reassess the response and communicate the next check", "rationale": "Safe care confirms the response rather than assuming improvement.", "announcement": "A closed-loop reassessment confirms the response and next check.", "delta": {"stability": 8, "oxygenation": 6, "perfusion": 6}, "points": 25, "next": None},
                    "assume-improvement": {"label": "Assume improvement and move on without reassessment", "rationale": "Without reassessment, an incomplete response may be missed.", "announcement": "The response is assumed rather than confirmed.", "delta": {"stability": -10}, "unsafe": True, "points": 0, "next": None},
                },
            },
        },
    }


_ROWS = (
    ("gr-airway-quiet-decline", "airway-patterns", "The Quiet Decline", "Integrate changing oxygenation, communication, and reassessment.", "airway", "introductory", "Mr. Luo", 64, "A recovering pneumonia patient is quieter than usual and pauses between phrases.", "Subtle respiratory deterioration", {"stability": 66, "oxygenation": 52, "perfusion": 72}, "Oxygenation trend", "SpO₂ has fallen from 96% to 89% during conversation.", "Read a changing breathing pattern as a whole and close the loop after support.", ["Clinical Cue Lab", "Rapid Triage Hall"]),
    ("gr-perfusion-hidden-signal", "perfusion-patterns", "The Hidden Perfusion Signal", "A reassuring number cannot replace the bedside picture.", "assessment", "introductory", "Mr. Sato", 70, "After blood loss, the monitor seems acceptable but the patient is restless and pale.", "Early hypoperfusion", {"stability": 62, "oxygenation": 74, "perfusion": 46}, "Urine output", "Urine output is only 15 mL per hour and the hands are cool.", "Use converging bedside cues before a late monitor value.", ["Clinical Cue Lab", "Stabilize Stack Lab"]),
    ("gr-medication-safety-window", "medication-safety", "The Safety Window", "A scheduled medication meets a changed patient context.", "pharmacology", "introductory", "Mrs. Kapoor", 74, "A new result appears just before a scheduled medication is due.", "Medication context change", {"stability": 70, "oxygenation": 80, "perfusion": 62}, "New result", "A new finding changes the safety context for the scheduled medication.", "A medication schedule never replaces a current safety assessment.", ["Clinical Cue Lab", "Rapid Triage Hall"]),
    ("gr-handoff-closed-loop", "systems-handoff", "The Closed-Loop Handoff", "A transfer is safe only when the next action has an owner.", "systems", "introductory", "Ms. Ortiz", 78, "During transfer, a patient has become newly confused and the receiving team is busy.", "Change from baseline", {"stability": 64, "oxygenation": 76, "perfusion": 59}, "Change from baseline", "Family confirms this confusion is new today, not baseline.", "A safe handoff carries the change, a named owner, and a confirmed next check.", ["Rapid Triage Hall", "Stabilize Stack Lab"]),
    ("gr-sepsis-rising-line", "deterioration-recognition", "The Rising Line", "Trace a worsening infection pattern before it becomes a crisis.", "assessment", "standard", "Mr. Flynn", 52, "Chills and fatigue increase as temperature and pulse rise across checks.", "Worsening trend", {"stability": 60, "oxygenation": 70, "perfusion": 56}, "Trend review", "Temperature and heart rate have risen at each observation.", "A trend deserves a timely, coordinated response.", ["Clinical Cue Lab", "Stabilize Stack Lab"], 2, 5),
    ("gr-post-op-changing-pain", "post-op-judgment", "Pain That Changed", "A new pattern after surgery calls for reassessment, not autopilot.", "judgment", "standard", "Ms. Imani", 39, "Initial recovery was comfortable, but pain became sharper and moved location.", "Changed pain pattern", {"stability": 60, "oxygenation": 76, "perfusion": 58}, "Pain comparison", "Pain is new in location and differs from the earlier recovery pattern.", "When a symptom changes pattern, reassess and communicate before repeating the old plan.", ["Rapid Triage Hall", "Clinical Cue Lab"], 2, 5),
    ("gr-fall-risk-reassessment", "safety-reassessment", "The Unsteady Return", "A near-fall becomes a systems case when the first response is incomplete.", "stabilization", "standard", "Mr. Diaz", 81, "A patient nearly fell on standing and now wants to try again quickly.", "Repeat fall risk", {"stability": 63, "oxygenation": 80, "perfusion": 54}, "Mobility change", "He is more unsteady than during the earlier assisted walk.", "Safety support must be reassessed before the same risk.", ["Stabilize Stack Lab", "Rapid Triage Hall"], 2, 5),
    ("gr-respiratory-recurrence", "airway-patterns", "The Returning Wheeze", "A partial respiratory response needs adaptation, not reassurance.", "airway", "standard", "Ms. Thomas", 63, "Breathing improved briefly, then speech became interrupted again.", "Recurring airway concern", {"stability": 57, "oxygenation": 48, "perfusion": 66}, "Work of breathing", "She cannot finish a sentence without pausing.", "Reassessment changes the plan when the pattern returns.", ["Clinical Cue Lab", "Stabilize Stack Lab"], 2, 5),
    ("gr-source-control-bridge", "infection-systems", "The Bridge to Source Control", "A local change and systemic decline must be connected.", "systems", "advanced", "Ms. Lewis", 48, "A healing site has new drainage with chills and fatigue.", "Local and systemic change", {"stability": 55, "oxygenation": 72, "perfusion": 52}, "New drainage", "Drainage appeared with broader deterioration.", "Connect local findings to the whole patient.", ["Clinical Cue Lab", "Rapid Triage Hall"], 3, 8),
    ("gr-sedation-next-dose", "medication-safety", "Before the Next Dose", "A familiar schedule becomes unsafe as responsiveness changes.", "pharmacology", "advanced", "Mr. Okafor", 61, "The patient is drowsier and another sedating dose is scheduled.", "Increasing sedation", {"stability": 56, "oxygenation": 56, "perfusion": 68}, "Responsiveness trend", "He needs repeated prompting to stay awake.", "Assess and communicate a new sedation change before another dose.", ["Rapid Triage Hall", "Clinical Cue Lab"], 3, 8),
    ("gr-care-transition-gap", "systems-handoff", "Across the Teams", "An unowned time-sensitive task turns a transition into a patient risk.", "systems", "advanced", "Mr. Njeri", 45, "At handoff, a time-sensitive reassessment order has not been acknowledged.", "Unresolved care transition", {"stability": 54, "oxygenation": 74, "perfusion": 50}, "Unresolved order", "No receiving team member confirmed ownership of the order.", "Name an owner, state the next action, and verify it is understood.", ["Rapid Triage Hall", "Stabilize Stack Lab"], 3, 8),
    ("gr-grand-convergence", "age-one-capstone", "The Grand Convergence", "Age 1 capstone: hold assessment, priority, intervention, and systems thinking together.", "judgment", "expert", "Mrs. Chen", 78, "New confusion, falling output, shortness of breath, and an unconfirmed handoff detail.", "Multi-system deterioration", {"stability": 48, "oxygenation": 54, "perfusion": 42}, "Converging deterioration", "Responsiveness, output, breathing, and transfer record changed from baseline.", "Make the pattern visible, protect the patient, escalate, and reassess the shared plan.", ["Clinical Cue Lab", "Rapid Triage Hall", "Stabilize Stack Lab"], 4, 12),
)

GRAND_ROUNDS_CASES = {row[0]: _case(*row) for row in _ROWS}


def public_station(manifest: Dict[str, Any], stage_id: Optional[str]) -> Optional[Dict[str, Any]]:
    if not stage_id:
        return None
    station = manifest["stations"][stage_id]
    return {"id": stage_id, "label": station["label"], "inputKind": station["inputKind"], "prompt": station["prompt"],
            "options": [{"id": rid, "label": item["label"], "rationale": item["rationale"]} for rid, item in station["responses"].items()]}


def public_attempt(attempt: Dict[str, Any], manifest: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Project an attempt without leaking its private answer contract.

    ``manifest`` is supplied by the server for faculty-published versions.  The
    static catalog remains a backwards-compatible fallback for legacy attempts.
    """
    manifest = manifest or GRAND_ROUNDS_CASES[attempt["caseId"]]
    return {
        "attemptId": attempt["attemptId"], "caseId": attempt["caseId"], "version": attempt["version"],
        "branchId": attempt["branchId"], "difficulty": attempt["difficulty"], "status": attempt["status"],
        "stage": public_station(manifest, attempt.get("stageId")) if attempt["status"] != "abandoned" else None,
        "patient": {key: attempt["patient"][key] for key in ("stability", "oxygenation", "perfusion", "concern", "acuity")},
        "known": attempt.get("known", []), "timeline": attempt.get("timeline", []), "safety": attempt.get("safety", "safe"),
        "notes": attempt.get("notes", ""), "complicationActive": attempt.get("stageId") == "complication",
    }