import httpx
import logging
from uuid import uuid4
from datetime import datetime, UTC

from app.config import get_settings
from app.core.encryption.pii import decrypt_field

settings = get_settings()
logger = logging.getLogger("payments.sha")


class SHAClaimsService:
    """
    SHA Insurance Claims Service
    Handles claim building, validation, and submission to SHA API
    """

    async def build_and_submit(self, encounter_id: str, hospital_id: str) -> dict:
        """Build and submit SHA claim for encounter"""
        encounter = await self._load_encounter(encounter_id, hospital_id)

        claim = {
            "claimId": str(uuid4()),
            "facilityCode": encounter["hospital"]["moh_facility_code"],
            "claimDate": datetime.now(UTC).date().isoformat(),
            "patient": {
                "shaNumber": decrypt_field(encounter["patient"]["sha_number_enc"]),
                "nationalId": decrypt_field(encounter["patient"]["national_id_enc"]),
                "fullName": decrypt_field(encounter["patient"]["full_name_enc"]),
                "dob": encounter["patient"]["dob"],
                "sex": encounter["patient"]["sex"],
            },
            "visit": {
                "visitDate": encounter["encounter_date"],
                "visitType": self._map_encounter_type(encounter["encounter_type"]),
                "admissionDate": encounter.get("admitted_at"),
                "dischargeDate": encounter.get("discharged_at"),
                "clinicianRegNo": encounter["clinician"]["professional_reg_no"],
            },
            "diagnoses": [
                {
                    "icd10Code": d["code"],
                    "description": d["description"],
                    "diagnosisType": "primary" if i == 0 else "secondary"
                }
                for i, d in enumerate(encounter.get("diagnoses", []))
            ],
            "services": await self._collect_services(encounter)
        }

        claim["totalClaimed"] = sum(
            s["unitCost"] * s["quantity"] for s in claim["services"]
        )

        # Validate claim before submission
        validation = self._validate_claim(claim)
        if not validation["valid"]:
            return {
                "submitted": False,
                "errors": validation["errors"],
                "claim": claim
            }

        return await self._submit_claim(claim)

    def _validate_claim(self, claim: dict) -> dict:
        """Validate claim against SHA requirements"""
        errors = []

        if not claim["patient"].get("shaNumber", "").startswith("SHA"):
            errors.append({
                "field": "sha_number",
                "issue": "Invalid SHA number format",
                "fix": "Verify SHA number at reception"
            })

        if not claim["diagnoses"]:
            errors.append({
                "field": "diagnoses",
                "issue": "No ICD-10 diagnoses provided",
                "fix": "Complete diagnosis coding before submission"
            })

        if not claim["services"]:
            errors.append({
                "field": "services",
                "issue": "No billable services found",
                "fix": "Verify services are properly documented"
            })

        if claim.get("totalClaimed", 0) <= 0:
            errors.append({
                "field": "total",
                "issue": "Claim total cannot be zero"
            })

        return {
            "valid": len(errors) == 0,
            "errors": errors
        }

    async def _submit_claim(self, claim: dict) -> dict:
        """Submit claim to SHA API"""
        token = await self._get_access_token()

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.SHA_BASE_URL}/claims/submit",
                json=claim,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "X-Facility-Code": settings.SHA_FACILITY_CODE
                }
            )

        data = response.json()
        status = "submitted" if response.status_code == 200 else "failed"

        await self._store_claim(claim, data, status)

        return {
            "submitted": response.status_code == 200,
            "sha_reference": data.get("claimReference"),
            "status": data.get("status", status),
            "rejection_reasons": data.get("rejectionReasons", [])
        }

    async def _get_access_token(self) -> str:
        """Get cached OAuth access token"""
        from app.db import get_redis
        redis = get_redis()

        cached = await redis.get("sha_access_token")
        if cached:
            return cached.decode()

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{settings.SHA_BASE_URL}/oauth/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.SHA_CLIENT_ID,
                    "client_secret": settings.SHA_CLIENT_SECRET
                }
            )

        data = response.json()
        expires_in = data.get("expires_in", 3600) - 300  # 5 minute buffer

        await redis.setex("sha_access_token", expires_in, data["access_token"])
        return data["access_token"]

    async def _load_encounter(self, encounter_id: str, hospital_id: str) -> dict:
        """Load encounter and associated data"""
        from app.db import get_admin_client
        client = get_admin_client()

        # This would be implemented with actual joins
        return {}

    async def _collect_services(self, encounter: dict) -> list[dict]:
        """Collect billable services from encounter"""
        return []

    async def _store_claim(self, claim: dict, response: dict, status: str) -> None:
        """Store claim in database"""
        pass

    def _map_encounter_type(self, encounter_type: str) -> str:
        """Map internal encounter type to SHA visit type"""
        mapping = {
            "opd": "OUTPATIENT",
            "inpatient": "INPATIENT",
            "emergency": "EMERGENCY",
            "mch": "OUTPATIENT",
            "telemedicine": "TELEMEDICINE"
        }
        return mapping.get(encounter_type, "OUTPATIENT")