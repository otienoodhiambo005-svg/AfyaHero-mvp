from enum import Enum
from typing import FrozenSet


class Permission(str, Enum):
    # Patient management
    PATIENT_READ            = "patient:read"
    PATIENT_WRITE           = "patient:write"
    PATIENT_ARCHIVE         = "patient:archive"

    # Encounters
    ENCOUNTER_READ          = "encounter:read"
    ENCOUNTER_WRITE         = "encounter:write"

    # Consultations
    CONSULTATION_READ       = "consultation:read"
    CONSULTATION_WRITE      = "consultation:write"
    CONSULTATION_SIGN       = "consultation:sign"

    # Clinical data
    VITALS_WRITE            = "vitals:write"
    PRESCRIPTION_WRITE      = "prescription:write"
    PRESCRIPTION_DISPENSE   = "prescription:dispense"

    # Laboratory
    LAB_REQUEST             = "lab:request"
    LAB_RESULT_WRITE        = "lab:result:write"

    # Imaging
    IMAGING_REQUEST         = "imaging:request"
    IMAGING_RESULT_WRITE    = "imaging:result:write"

    # Referrals
    REFERRAL_WRITE          = "referral:write"

    # MCH
    MCH_WRITE               = "mch:write"

    # AI capabilities
    AI_TRIAGE               = "ai:triage"
    AI_DOCUMENTATION        = "ai:documentation"
    AI_IMAGING              = "ai:imaging"
    AI_DRUG_CHECK           = "ai:drug_check"

    # Billing
    BILLING_READ            = "billing:read"
    BILLING_WRITE           = "billing:write"
    INSURANCE_SUBMIT        = "insurance:submit"

    # Administration
    USER_MANAGE             = "user:manage"
    HOSPITAL_CONFIG         = "hospital:config"
    AUDIT_READ              = "audit:read"
    DATA_EXPORT             = "data:export"

    # Super admin
    SUPER_ADMIN             = "super:admin"
    CROSS_TENANT            = "cross:tenant"


# Shared clinical permissions
_CLINICAL_BASE = frozenset({
    Permission.PATIENT_READ,
    Permission.PATIENT_WRITE,
    Permission.ENCOUNTER_READ,
    Permission.ENCOUNTER_WRITE,
    Permission.CONSULTATION_READ,
    Permission.VITALS_WRITE,
    Permission.LAB_REQUEST,
    Permission.REFERRAL_WRITE,
    Permission.MCH_WRITE,
    Permission.BILLING_READ,
    Permission.AI_TRIAGE,
})


# Kenyan clinical scope of practice mapping
ROLE_PERMISSIONS: dict[str, FrozenSet[Permission]] = {

    "doctor": frozenset(_CLINICAL_BASE.union({
        Permission.CONSULTATION_WRITE,
        Permission.CONSULTATION_SIGN,
        Permission.PRESCRIPTION_WRITE,
        Permission.IMAGING_REQUEST,
        Permission.AI_DOCUMENTATION,
        Permission.AI_IMAGING,
        Permission.AI_DRUG_CHECK,
    })),

    "clinical_officer": frozenset(_CLINICAL_BASE.union({
        Permission.CONSULTATION_WRITE,
        Permission.CONSULTATION_SIGN,
        Permission.PRESCRIPTION_WRITE,
        Permission.IMAGING_REQUEST,
        Permission.AI_DOCUMENTATION,
        Permission.AI_IMAGING,
        Permission.AI_DRUG_CHECK,
    })),

    "nurse": frozenset({
        Permission.PATIENT_READ,
        Permission.PATIENT_WRITE,
        Permission.ENCOUNTER_READ,
        Permission.ENCOUNTER_WRITE,
        Permission.CONSULTATION_READ,
        Permission.VITALS_WRITE,
        Permission.LAB_REQUEST,
        Permission.REFERRAL_WRITE,
        Permission.MCH_WRITE,
        Permission.BILLING_READ,
        Permission.AI_TRIAGE,
    }),

    "pharmacist": frozenset({
        Permission.PATIENT_READ,
        Permission.ENCOUNTER_READ,
        Permission.CONSULTATION_READ,
        Permission.PRESCRIPTION_WRITE,
        Permission.PRESCRIPTION_DISPENSE,
        Permission.BILLING_WRITE,
        Permission.AI_DRUG_CHECK,
    }),

    "lab_technician": frozenset({
        Permission.PATIENT_READ,
        Permission.ENCOUNTER_READ,
        Permission.LAB_RESULT_WRITE,
        Permission.BILLING_WRITE,
    }),

    "radiographer": frozenset({
        Permission.PATIENT_READ,
        Permission.ENCOUNTER_READ,
        Permission.IMAGING_RESULT_WRITE,
        Permission.BILLING_WRITE,
        Permission.AI_IMAGING,
    }),

    "receptionist": frozenset({
        Permission.PATIENT_READ,
        Permission.PATIENT_WRITE,
        Permission.ENCOUNTER_READ,
        Permission.ENCOUNTER_WRITE,
        Permission.BILLING_READ,
        Permission.BILLING_WRITE,
    }),

    "hospital_admin": frozenset({
        Permission.PATIENT_READ,
        Permission.ENCOUNTER_READ,
        Permission.CONSULTATION_READ,
        Permission.BILLING_READ,
        Permission.BILLING_WRITE,
        Permission.INSURANCE_SUBMIT,
        Permission.USER_MANAGE,
        Permission.HOSPITAL_CONFIG,
        Permission.AUDIT_READ,
        Permission.DATA_EXPORT,
    }),

    "compliance_officer": frozenset({
        Permission.PATIENT_READ,
        Permission.AUDIT_READ,
        Permission.DATA_EXPORT,
    }),

    "super_admin": frozenset(Permission),
}


def get_permissions_for_role(role: str) -> FrozenSet[Permission]:
    """Get all permissions for a given role"""
    return ROLE_PERMISSIONS.get(role, frozenset())


def has_permission(role: str, permission: Permission) -> bool:
    """Check if a role has the specified permission"""
    return permission in ROLE_PERMISSIONS.get(role, frozenset())