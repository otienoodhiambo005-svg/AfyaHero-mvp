from fastapi import APIRouter

from app.api.v1 import patients
from app.api.v1 import triage
from app.api.v1 import pharmacy
from app.api.v1 import shif
from app.api.v1 import superadmin
from app.api.v1 import sync
from app.api.v1 import kdpa
from app.api.v1 import formulary
from app.api.v1 import stock
from app.api.v1 import referral
from app.api.v1 import beds
from app.api.v1 import claims
from app.api.v1 import i18n
from app.api.v1 import inventory_ai
from app.api.v1 import communication
from app.api.v1 import lis
from app.api.v1 import dashboard
from app.api.v1 import clinical_ai
from app.api.v1 import devices
from app.api.v1 import teleconsult
from app.api.v1 import chw
from app.api.v1 import fhir
from app.api.v1 import audit
from app.api.v1 import payments
from app.api.v1 import consultations


v1_router = APIRouter()

# Clinical routes
v1_router.include_router(patients.router, prefix="/patients", tags=["Patients"])
v1_router.include_router(triage.router, prefix="/triage", tags=["Triage & Vitals"])
v1_router.include_router(consultations.router, prefix="/consultations", tags=["Clinical Consultations"])
v1_router.include_router(pharmacy.router, prefix="/pharmacy", tags=["Pharmacy"])
v1_router.include_router(shif.router, prefix="/shif", tags=["SHIF Claims"])

# Pharmacy + Stock
v1_router.include_router(formulary.router, prefix="/formulary", tags=["Formulary"])
v1_router.include_router(stock.router, prefix="/stock", tags=["Stock Management"])
v1_router.include_router(
    inventory_ai.router, prefix="/inventory-ai", tags=["Smart Inventory"]
)

# Referral + Beds + Claims
v1_router.include_router(referral.router, prefix="/referrals", tags=["Referrals"])
v1_router.include_router(beds.router, prefix="/beds", tags=["Bed Management"])
v1_router.include_router(claims.router, prefix="/claims", tags=["Claims Dashboard"])

# Communication (WhatsApp/USSD)
v1_router.include_router(
    communication.router, prefix="/communication", tags=["Communication"]
)

# LIS (Lab)
v1_router.include_router(lis.router, prefix="/lis", tags=["Lab Information System"])

# Clinical AI (DAWA, Scribe, Guidelines)
v1_router.include_router(
    clinical_ai.router, prefix="/clinical-ai", tags=["Clinical AI"]
)

# Devices (BLE + Lab Analyzers)
v1_router.include_router(devices.router, prefix="/devices", tags=["Device Integration"])

# Teleconsultation
v1_router.include_router(
    teleconsult.router, prefix="/teleconsult", tags=["Teleconsultation"]
)

# CHW (Community Health Worker)
v1_router.include_router(chw.router, prefix="/chw", tags=["CHW Operations"])

# FHIR R4
v1_router.include_router(fhir.router, prefix="", tags=["FHIR R4"])

# i18n
v1_router.include_router(i18n.router, prefix="/i18n", tags=["Internationalization"])

# Dashboard
v1_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])

# Super Admin
v1_router.include_router(superadmin.router, prefix="/superadmin", tags=["Super Admin"])

# Audit Logs
v1_router.include_router(audit.router, prefix="/audit", tags=["Audit Logs"])

# Payments (M-Pesa)
v1_router.include_router(payments.router, prefix="/payments", tags=["Payments"])

# Offline Sync
v1_router.include_router(sync.router, prefix="/sync", tags=["Offline Sync"])

# KDPA Compliance
v1_router.include_router(kdpa.router, prefix="/kdpa", tags=["KDPA Compliance"])
