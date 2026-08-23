"""Pure regression coverage for reviewed Simulation Lab case rotation."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from server import CLINICAL_SIMULATION_MANIFESTS, select_new_simulation_variation


def receipt(simulation_id: str) -> dict[str, str]:
    return {
        "simulationId": simulation_id,
        "variantFamilyId": CLINICAL_SIMULATION_MANIFESTS[simulation_id]["family"],
    }


def test_new_variation_prefers_an_uncompleted_eligible_sibling() -> None:
    current = "sim-airway-quiet-change"

    # The Advanced airway sibling remains unavailable below the server gate,
    # so the only eligible fresh patient is selected.
    low_level_selection = select_new_simulation_variation(current, [receipt(current)], player_level=1)
    assert low_level_selection == "sim-airway-breathless-walk"
    assert CLINICAL_SIMULATION_MANIFESTS[low_level_selection]["difficulty"] != "advanced"

    # At the gate, the stable catalog ordering chooses a previously unseen
    # sibling rather than issuing another seed for the completed patient.
    high_level_selection = select_new_simulation_variation(current, [receipt(current)], player_level=25)
    assert high_level_selection == "sim-adaptive-airway"
    assert high_level_selection != current


def test_new_variation_cycles_deterministically_after_a_completed_family() -> None:
    current = "sim-airway-quiet-change"
    all_completed = [
        receipt("sim-airway-quiet-change"),
        receipt("sim-airway-breathless-walk"),
        receipt("sim-adaptive-airway"),
    ]

    first = select_new_simulation_variation(current, all_completed, player_level=25)
    second = select_new_simulation_variation(current, all_completed, player_level=25)

    assert first == second == "sim-adaptive-airway"
    assert first != current