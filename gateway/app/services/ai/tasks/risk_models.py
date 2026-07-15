"""
Offline clinical risk models.
Zero dependencies, zero network calls.
Always available under all conditions.
"""


class NEWS2Calculator:
    """
    National Early Warning Score 2
    Standard adult deterioration score.
    Adopted by Kenya Ministry of Health.
    """

    def calculate(self, vitals: dict) -> dict:
        score = 0
        alerts = []
        components = {}

        def add_score(name: str, points: int, alert_msg: str | None = None):
            nonlocal score
            score += points
            components[name] = points
            if alert_msg and points >= 2:
                alerts.append(alert_msg)

        # Respiratory Rate
        rr = vitals.get("respiratory_rate")
        if rr is not None:
            if rr <= 8:
                add_score("rr", 3, "Critical: RR ≤8 - respiratory failure")
            elif rr <= 11:
                add_score("rr", 1)
            elif rr <= 20:
                add_score("rr", 0)
            elif rr <= 24:
                add_score("rr", 2)
            else:
                add_score("rr", 3, "Critical: RR >24 - respiratory distress")

        # Oxygen Saturation
        spo2 = vitals.get("spo2_percent")
        on_o2 = vitals.get("on_supplemental_o2", False)
        if spo2 is not None:
            if spo2 <= 91:
                add_score("spo2", 3, "Critical hypoxia")
            elif spo2 <= 93:
                add_score("spo2", 2)
            elif spo2 <= 95:
                add_score("spo2", 1)
            else:
                add_score("spo2", 0)
            if on_o2:
                add_score("spo2", 2)

        # Systolic Blood Pressure
        sbp = vitals.get("bp_systolic")
        if sbp is not None:
            if sbp <= 90:
                add_score("sbp", 3, "Critical: hypotension - shock risk")
            elif sbp <= 100:
                add_score("sbp", 2)
            elif sbp <= 110:
                add_score("sbp", 1)
            elif sbp <= 219:
                add_score("sbp", 0)
            else:
                add_score("sbp", 3, "Hypertensive emergency")

        # Pulse Rate
        pulse = vitals.get("pulse_bpm")
        if pulse is not None:
            if pulse <= 40:
                add_score("pulse", 3, "Critical bradycardia")
            elif pulse <= 50:
                add_score("pulse", 1)
            elif pulse <= 90:
                add_score("pulse", 0)
            elif pulse <= 110:
                add_score("pulse", 1)
            elif pulse <= 130:
                add_score("pulse", 2)
            else:
                add_score("pulse", 3, "Critical tachycardia")

        # Temperature
        temp = vitals.get("temperature_c")
        if temp is not None:
            if temp <= 35.0:
                add_score("temp", 3, "Hypothermia")
            elif temp <= 36.0:
                add_score("temp", 1)
            elif temp <= 38.0:
                add_score("temp", 0)
            elif temp <= 39.0:
                add_score("temp", 1)
            else:
                add_score("temp", 2, "High fever - sepsis/malaria/typhoid")

        # Consciousness (AVPU)
        avpu = vitals.get("avpu", "A").upper()
        avpu_score = {"A": 0, "V": 3, "P": 3, "U": 3}.get(avpu, 0)
        if avpu_score > 0:
            alerts.append(f"Altered consciousness level: {avpu}")
        score += avpu_score
        components["avpu"] = avpu_score

        # Determine severity level and action
        if score >= 7:
            level = "CRITICAL"
            action = "Emergency response NOW"
        elif score >= 5:
            level = "HIGH"
            action = "Urgent clinician review within 30 minutes"
        elif score >= 3:
            level = "MEDIUM"
            action = "Increased monitoring; clinician review"
        elif score >= 1:
            level = "LOW"
            action = "Increase observation frequency"
        else:
            level = "NONE"
            action = "Continue routine monitoring"

        return {
            "score": score,
            "level": level,
            "alerts": alerts,
            "recommended_action": action,
            "component_scores": components,
            "requires_immediate_action": score >= 5,
            "calculated_offline": True
        }


def calculate_paediatric_dose(payload: dict) -> dict:
    """Weight-based paediatric dosing calculator"""
    drug_name = payload.get("drug_name", "").lower()
    weight_kg = float(payload.get("weight_kg", 0))

    # East Africa common paediatric drug guidelines
    DOSING_GUIDELINES = {
        "amoxicillin": {
            "dose_mg_per_kg": 25,
            "frequency": "TDS",
            "max_mg": 500,
            "route": "oral"
        },
        "paracetamol": {
            "dose_mg_per_kg": 15,
            "frequency": "QID",
            "max_mg": 1000,
            "route": "oral/PR"
        },
        "artemether_lumefantrine": {
            "note": "Use weight band dosing on AL package insert",
            "frequency": "BD x 3 days",
            "route": "oral"
        },
        "ceftriaxone": {
            "dose_mg_per_kg": 50,
            "frequency": "OD",
            "max_mg": 2000,
            "route": "IV/IM"
        },
        "ibuprofen": {
            "dose_mg_per_kg": 10,
            "frequency": "TDS",
            "max_mg": 400,
            "route": "oral"
        }
    }

    if drug_name not in DOSING_GUIDELINES:
        return {
            "calculated": False,
            "message": f"Dosing guidelines for {drug_name} not available. Refer to BNFc or Kenya MOH guidelines."
        }

    guide = DOSING_GUIDELINES[drug_name]

    if "dose_mg_per_kg" in guide and weight_kg > 0:
        raw_dose = weight_kg * guide["dose_mg_per_kg"]
        final_dose = min(raw_dose, guide["max_mg"])

        return {
            "calculated": True,
            "drug": drug_name,
            "dose_mg": round(final_dose),
            "weight_kg": weight_kg,
            "frequency": guide["frequency"],
            "route": guide["route"],
            "basis": f"{guide['dose_mg_per_kg']} mg/kg (capped at {guide['max_mg']} mg)",
            "disclaimer": "Always verify with current BNFc or Kenya MOH guidelines."
        }

    return {
        "calculated": False,
        "note": guide.get("note", "Refer to package insert.")
    }