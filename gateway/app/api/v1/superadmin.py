"""
Super Admin API - Tenant Management, Feature Flags, KPIs
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime, UTC
from uuid import uuid4
import json

from app.dependencies import get_db_session, super_admin
from app.dependencies import get_current_user
from app.core.tenancy.context import get_hospital_id, get_user_id

router = APIRouter()


# Tenant/Onboarding Schemas
class HospitalCreate(BaseModel):
    name: str
    subdomain: Optional[str] = None
    facility_type: str = "hospital"
    license_number: Optional[str] = None
    county: str
    subcounty: Optional[str] = None
    phone: str
    email: Optional[str] = None
    shif_code: Optional[str] = None  # SHIF facility code (formerly nhif_code)
    subscription_tier: str = "basic"  # basic, standard, premium


class FeatureFlagUpdate(BaseModel):
    feature: str
    enabled: bool
    scope: str = "global"  # global, hospital, user


class SubscriptionUpdate(BaseModel):
    hospital_id: str
    tier: str  # basic, standard, premium
    expires_at: str  # ISO date


# ─── Tenant Management ───────────────────────────────────────────────


@router.post("/hospitals", status_code=201, dependencies=[super_admin])
async def create_hospital(hospital: HospitalCreate, db=Depends(get_db_session)):
    """Create a new hospital tenant"""
    hospital_id = str(uuid4())
    now = datetime.now(UTC).isoformat()

    # Check subdomain unique
    if hospital.subdomain:
        check = await db.execute(
            """
            SELECT id FROM hospitals WHERE subdomain = :subdomain
        """,
            {"subdomain": hospital.subdomain},
        )

        if check.fetchone():
            raise HTTPException(status_code=400, detail="Subdomain already in use")

    # Create hospital
    await db.execute(
        """
        INSERT INTO hospitals (
            id, name, subdomain, facility_type, license_number,
            county, subcounty, phone, email, shif_code,
            subscription_tier, subscription_expires,
            is_active, created_at
        )
        VALUES (
            :id, :name, :subdomain, :facility_type, :license_number,
            :county, :subcounty, :phone, :email, :shif_code,
            :tier, :expires, :active, :now
        )
    """,
        {
            "id": hospital_id,
            "name": hospital.name,
            "subdomain": hospital.subdomain,
            "facility_type": hospital.facility_type,
            "license_number": hospital.license_number,
            "county": hospital.county,
            "subcounty": hospital.subcounty,
            "phone": hospital.phone,
            "email": hospital.email,
            "shif_code": hospital.shif_code,
            "tier": hospital.subscription_tier,
            "expires": datetime.now(UTC).timestamp() + (90 * 86400),  # 90 days
            "active": True,
            "now": now,
        },
    )

    # Create initial admin user
    admin_id = str(uuid4())
    await db.execute(
        """
        INSERT INTO users (
            id, hospital_id, email, role, is_active, created_at
        )
        VALUES (:id, :hospital_id, :email, 'admin', true, :now)
    """,
        {
            "id": admin_id,
            "hospital_id": hospital_id,
            "email": hospital.email,
            "now": now,
        },
    )

    await db.commit()

    return {
        "id": hospital_id,
        "name": hospital.name,
        "subscription_tier": hospital.subscription_tier,
        "created_at": now,
        "message": "Hospital onboarded successfully",
    }


@router.get("/hospitals")
async def list_hospitals(active_only: bool = True, db=Depends(get_db_session)):
    """List all hospitals (super admin only)"""
    query = "SELECT id, name, subdomain, subscription_tier, is_active, created_at FROM hospitals"
    if active_only:
        query += " WHERE is_active = true"
    query += " ORDER BY created_at DESC"

    result = await db.execute(query)
    hospitals = result.fetchall()

    return {
        "hospitals": [
            {
                "id": h.id,
                "name": h.name,
                "subdomain": h.subdomain,
                "subscription_tier": h.subscription_tier,
                "is_active": h.is_active,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            }
            for h in hospitals
        ]
    }


@router.patch("/hospitals/{hospital_id}/subscription", dependencies=[super_admin])
async def update_subscription(
    hospital_id: str, subscription: SubscriptionUpdate, db=Depends(get_db_session)
):
    """Update hospital subscription tier"""
    now = datetime.now(UTC).isoformat()

    # Calculate expiration
    tier_months = {"basic": 1, "standard": 1, "premium": 1}
    days = tier_months.get(subscription.tier, 1) * 30

    expires_at = datetime.now(UTC).timestamp() + (days * 86400)

    await db.execute(
        """
        UPDATE hospitals
        SET subscription_tier = :tier,
            subscription_expires = :expires,
            updated_at = :now
        WHERE id = :id
    """,
        {
            "id": hospital_id,
            "tier": subscription.tier,
            "expires": expires_at,
            "now": now,
        },
    )

    await db.commit()

    return {
        "id": hospital_id,
        "subscription_tier": subscription.tier,
        "message": "Subscription updated",
    }


@router.post("/hospitals/{hospital_id}/deactivate", dependencies=[super_admin])
async def deactivate_hospital(hospital_id: str, db=Depends(get_db_session)):
    """Deactivate a hospital (soft delete)"""
    now = datetime.now(UTC).isoformat()

    await db.execute(
        """
        UPDATE hospitals
        SET is_active = false, updated_at = :now
        WHERE id = :id
    """,
        {"id": hospital_id, "now": now},
    )

    # Deactivate all users
    await db.execute(
        """
        UPDATE users SET is_active = false, updated_at = :now
        WHERE hospital_id = :hospital_id
    """,
        {"hospital_id": hospital_id, "now": now},
    )

    await db.commit()

    return {"message": "Hospital deactivated"}


# ─── Feature Flags ─────────────────────────────────────────


@router.get("/features", dependencies=[super_admin])
async def get_feature_flags(db=Depends(get_db_session)):
    """Get all feature flags"""
    result = await db.execute("""
        SELECT feature, enabled, scope, updated_at
        FROM feature_flags
        ORDER BY feature
    """)

    flags = result.fetchall()

    return {
        "features": [
            {
                "feature": f.feature,
                "enabled": f.enabled,
                "scope": f.scope,
                "updated_at": f.updated_at.isoformat() if f.updated_at else None,
            }
            for f in flags
        ]
    }


@router.patch("/features", dependencies=[super_admin])
async def update_feature_flag(
    flag_update: FeatureFlagUpdate, db=Depends(get_db_session)
):
    """Update a feature flag"""
    now = datetime.now(UTC).isoformat()

    await db.execute(
        """
        INSERT INTO feature_flags (feature, enabled, scope, updated_at)
        VALUES (:feature, :enabled, :scope, :now)
        ON CONFLICT (feature) DO UPDATE SET
            enabled = :enabled,
            scope = :scope,
            updated_at = :now
    """,
        {
            "feature": flag_update.feature,
            "enabled": flag_update.enabled,
            "scope": flag_update.scope,
        },
    )

    await db.commit()

    return {"feature": flag_update.feature, "enabled": flag_update.enabled}


# ─── KPI Dashboard ─────────────────────────────────────────────


@router.get("/kpi", dependencies=[super_admin])
async def get_platform_kpis(db=Depends(get_db_session)):
    """Get platform-wide KPIs"""
    # Get hospital count
    hq = await db.execute(
        "SELECT COUNT(*) as count FROM hospitals WHERE is_active = true"
    )
    hospital_count = hq.fetchone().count

    # Get user count
    uq = await db.execute("SELECT COUNT(*) as count FROM users WHERE is_active = true")
    user_count = uq.fetchone().count

    # Get today's encounters
    eq = await db.execute("""
        SELECT COUNT(*) as count FROM encounters
        WHERE created_at > TODAY()
    """)
    today_encounters = eq.fetchone().count

    # Get pending SHIF claims
    cq = await db.execute("""
        SELECT COUNT(*), SUM(amount_claimed) FROM shif_claims
        WHERE status = 'submitted'
    """)
    claims_data = cq.fetchone()
    pending_claims = {
        "count": claims_data.count or 0,
        "amount": float(claims_data.sum or 0),
    }

    return {
        "hospitals": hospital_count,
        "users": user_count,
        "today_encounters": today_encounters,
        "pending_claims": pending_claims,
        "generated_at": datetime.now(UTC).isoformat(),
    }


# ─── Audit Logs ────────────────────────────────────────────────


@router.get("/audit-logs", dependencies=[super_admin])
async def get_audit_logs(
    hospital_id: Optional[str] = None,
    user_id: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 100,
    db=Depends(get_db_session),
):
    """Get audit logs with filters"""
    query = "SELECT * FROM audit_logs WHERE 1=1"
    params = {}

    if hospital_id:
        query += " AND hospital_id = :hospital_id"
        params["hospital_id"] = hospital_id

    if user_id:
        query += " AND user_id = :user_id"
        params["user_id"] = user_id

    if event_type:
        query += " AND event = :event"
        params["event"] = event_type

    query += " ORDER BY created_at DESC LIMIT :limit"
    params["limit"] = limit

    result = await db.execute(query, params)
    logs = result.fetchall()

    return {
        "logs": [
            {
                "id": l.id,
                "event": l.event,
                "user_id": l.user_id,
                "hospital_id": l.hospital_id,
                "patient_id": l.patient_id,
                "resource_type": l.resource_type,
                "resource_id": l.resource_id,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ]
    }


# ─── Billing/Invoicing ─────────────────────────────────────


@router.get("/invoices", dependencies=[super_admin])
async def list_invoices(
    hospital_id: Optional[str] = None,
    status: Optional[str] = None,
    db=Depends(get_db_session),
):
    """List SaaS invoices for hospitals"""
    query = """
        SELECT h.id, h.name, h.subscription_tier, h.subscription_expires,
               COUNT(u.id) as user_count
        FROM hospitals h
        LEFT JOIN users u ON h.id = u.hospital_id AND u.is_active = true
        WHERE 1=1
    """
    params = {}

    if hospital_id:
        query += " AND h.id = :hospital_id"
        params["hospital_id"] = hospital_id

    query += " GROUP BY h.id ORDER BY h.created_at DESC"

    result = await db.execute(query, params)
    invoices = result.fetchall()

    tier_prices = {"basic": 25000, "standard": 75000, "premium": 150000}

    return {
        "invoices": [
            {
                "hospital_id": i.id,
                "hospital_name": i.name,
                "tier": i.subscription_tier,
                "monthly_rate": tier_prices.get(i.subscription_tier, 0),
                "user_count": i.user_count,
                "expires_at": i.subscription_expires.isoformat()
                if i.subscription_expires
                else None,
            }
            for i in invoices
        ]
    }
