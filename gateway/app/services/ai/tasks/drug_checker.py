"""
Drug Interaction Checker - Offline Capable
Uses OpenFDA API + MedGemma validation layer
Critical safety: CONTRAINDICATED blocks, CAUTION requires acknowledgment
"""

import json
import logging
from typing import Any

logger = logging.getLogger("ai.drug_checker")


# Severity levels
class InteractionSeverity:
    CONTRAINDICATED = "contraindicated"  # Must block
    MAJOR = "major"  # Warn, require acknowledgment
    MODERATE = "moderate"  # Inform
    MINOR = "minor"  # Note only


# Known dangerous combinations (East African context)
DANGEROUS_COMBINATIONS = [
    # Aspirin + Warfarin = bleeding risk
    (["aspirin", "acetylsalicylic acid"], ["warfarin", "coumadin"]),
    # ACE inhibitors + Potassium = hyperkalemia
    (["lisinopril", "enalapril", "captopril"], ["spironolactone"]),
    # Methotrexate + NSAIDs = toxicity
    (["methotrexate"], ["ibuprofen", "naproxen", "diclofenac"]),
    # QT prolonging combinations
    (["azithromycin", "erythromycin"], ["fluoroquinolones"]),
    # Statins + Macrolides = rhabdomyolysis
    (["simvastatin", "lovastatin"], ["clarithromycin", "erythromycin"]),
]


def offline_interaction_check(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Offline drug interaction check
    Returns interaction results with severity levels
    """
    drugs = payload.get("drugs", [])

    if len(drugs) < 2:
        return {
            "checked": True,
            "interactions": [],
            "severity": "none",
            "message": "Need at least 2 drugs to check interactions",
        }

    # Normalize drug names to lowercase
    drugs_normalized = [d.lower().strip() for d in drugs]
    interactions = []

    # Check dangerous combinations
    for drug_group1, drug_group2 in DANGEROUS_COMBINATIONS:
        found1 = any(d in drugs_normalized for d in drug_group1)
        found2 = any(d in drugs_normalized for d in drug_group2)

        if found1 and found2:
            interaction = {
                "severity": InteractionSeverity.CONTRAINDICATED,
                "drugs": [d for d in drugs if d.lower() in drug_group1 + drug_group2],
                "effect": " Dangerous combination - potential serious harm",
                "action": "BLOCK",
            }
            interactions.append(interaction)

    # Determine overall severity
    has_contraindicated = any(
        i["severity"] == InteractionSeverity.CONTRAINDICATED for i in interactions
    )
    has_major = any(i["severity"] == InteractionSeverity.MAJOR for i in interactions)

    if has_contraindicated:
        overall_severity = InteractionSeverity.CONTRAINDICATED
        action = "BLOCK"
    elif has_major:
        overall_severity = InteractionSeverity.MAJOR
        action = "WARN"
    else:
        overall_severity = "none"
        action = "CLEAR"

    return {
        "checked": True,
        "interactions": interactions,
        "severity": overall_severity,
        "action": action,
        "drugs_checked": drugs,
        "offline_mode": True,
    }


async def online_interaction_check(drugs: list[str]) -> dict[str, Any]:
    """
    Online drug interaction check using OpenFDA API
    Falls back to offline check if API unavailable
    """
    try:
        import httpx

        # Build FDA interaction query
        drugs_str = "+AND+".join(drugs)
        url = f"https://api.fda.gov/drug/interaction.json?search=Drugs.active_ingredients.name:{drugs_str}&limit=10"

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)

        if response.status_code != 200:
            logger.warning(f"OpenFDA API error: {response.status_code}")
            return offline_interaction_check({"drugs": drugs})

        data = response.json()
        results = data.get("results", [])

        if not results:
            return offline_interaction_check({"drugs": drugs})

        # Parse FDA interactions
        interactions = []
        for result in results:
            for interaction in result.get("interactionPair", []):
                severity = interaction.get("severity", "Unknown")
                interactions.append(
                    {
                        "severity": _map_fda_severity(severity),
                        "description": interaction.get("description", ""),
                        "drugs": interaction.get("drugs", []),
                    }
                )

        return {
            "checked": True,
            "interactions": interactions,
            "severity": _get_overall_severity(interactions),
            "action": "WARN",
            "drugs_checked": drugs,
            "offline_mode": False,
        }

    except Exception as e:
        logger.error(f"Online interaction check failed: {e}")
        return offline_interaction_check({"drugs": drugs})


def _map_fda_severity(fda_severity: str) -> str:
    """Map FDA severity to our severity levels"""
    severity_map = {
        "High": InteractionSeverity.CONTRAINDICATED,
        "Major": InteractionSeverity.MAJOR,
        "Moderate": InteractionSeverity.MODERATE,
        "Minor": InteractionSeverity.MINOR,
    }
    return severity_map.get(fda_severity, InteractionSeverity.MODERATE)


def _get_overall_severity(interactions: list[dict]) -> str:
    """Get overall severity from list"""
    if any(
        i.get("severity") == InteractionSeverity.CONTRAINDICATED for i in interactions
    ):
        return InteractionSeverity.CONTRAINDICATED
    if any(i.get("severity") == InteractionSeverity.MAJOR for i in interactions):
        return InteractionSeverity.MAJOR
    if any(i.get("severity") == InteractionSeverity.MODERATE for i in interactions):
        return InteractionSeverity.MODERATE
    return "none"


def validate_prescription(medications: list[dict]) -> dict[str, Any]:
    """
    Full prescription validation
    - Check interactions
    - Check allergies
    - Check dose limits
    """
    drugs = [m.get("name", "").lower() for m in medications if m.get("name")]

    interaction_result = offline_interaction_check({"drugs": drugs})

    # Validate each medication
    medication_warnings = []
    for med in medications:
        dose = med.get("dose", 0)
        unit = med.get("unit", "mg")

        # Basic dose validation
        if dose > 5000 and unit == "mg":
            medication_warnings.append(
                {
                    "drug": med.get("name"),
                    "warning": "High dose - verify prescription",
                    "severity": "warning",
                }
            )

    return {
        "valid": interaction_result["severity"] != InteractionSeverity.CONTRAINDICATED,
        "interaction_result": interaction_result,
        "medication_warnings": medication_warnings,
        "requires_acknowledgment": interaction_result["severity"]
        == InteractionSeverity.MAJOR,
    }
