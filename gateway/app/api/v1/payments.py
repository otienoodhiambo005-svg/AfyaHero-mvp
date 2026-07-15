"""
M-Pesa STK Push for SHA Co-pay
"""

import hashlib
import uuid
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import httpx

router = APIRouter()


class STKPushRequest(BaseModel):
    phone: str
    amount: float
    patient_id: str
    claim_id: Optional[str] = None
    description: str = "SHA Co-pay"


class STKPushResponse(BaseModel):
    checkout_id: str
    status: str
    phone: str
    amount: float
    created_at: str


class PaymentStatusResponse(BaseModel):
    checkout_id: str
    status: str
    phone: str
    amount: float
    mpesa_code: Optional[str] = None
    transaction_date: Optional[str] = None
    created_at: str
    updated_at: str


mpesa_transactions = {}


async def get_mpesa_access_token():
    """Get M-Pesa OAuth access token"""
    from app.config import get_settings

    settings = get_settings()

    if not settings.MPESA_CONSUMER_KEY or not settings.MPESA_CONSUMER_SECRET:
        raise HTTPException(status_code=503, detail="M-Pesa not configured")

    auth_url = (
        "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    )
    auth_header = (
        f"Basic {settings.MPESA_CONSUMER_KEY}:{settings.MPESA_CONSUMER_SECRET}"
    )

    async with httpx.AsyncClient() as client:
        resp = await client.get(auth_url, headers={"Authorization": auth_header})
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502, detail="Failed to authenticate with M-Pesa"
            )
        data = resp.json()
        return data.get("access_token")


async def initiate_stk_push(
    phone: str, amount: float, callback_url: str, account_ref: str, description: str
):
    """Initiate STK push request to M-Pesa Daraja API"""
    from app.config import get_settings

    settings = get_settings()

    access_token = await get_mpesa_access_token()

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = hashlib.sha256(
        f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}".encode()
    ).hexdigest()

    stk_url = "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "BusinessShortCode": settings.MPESA_SHORTCODE,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(amount),
        "PartyA": phone,
        "PartyB": settings.MPESA_SHORTCODE,
        "PhoneNumber": phone,
        "CallBackURL": callback_url,
        "AccountReference": account_ref,
        "TransactionDesc": description,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(stk_url, json=payload, headers=headers)
        response_data = resp.json()

        if resp.status_code == 200:
            return {
                "success": True,
                "checkout_id": response_data.get("CheckoutRequestID"),
                "response_code": response_data.get("ResponseCode"),
            }
        return {
            "success": False,
            "error": response_data.get("errorMessage", "Unknown error"),
        }


async def check_stk_status(checkout_id: str):
    """Check STK push transaction status"""
    from app.config import get_settings

    settings = get_settings()

    access_token = await get_mpesa_access_token()

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = hashlib.sha256(
        f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}".encode()
    ).hexdigest()

    status_url = "https://api.safaricom.co.ke/mpesa/stkpush/v1/query"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "BusinessShortCode": settings.MPESA_SHORTCODE,
        "Password": password,
        "Timestamp": timestamp,
        "CheckoutRequestID": checkout_id,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(status_url, json=payload, headers=headers)
        return resp.json()


from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id


@router.post("/stk-push", response_model=STKPushResponse)
async def initiate_stk_push_payment(
    request: STKPushRequest,
    hospital_id: str = Depends(get_hospital_id),
    db=Depends(get_db_session),
):
    """Initiate M-Pesa STK Push for SHA co-pay"""
    from app.config import get_settings

    settings = get_settings()

    if not settings.MPESA_CONSUMER_KEY:
        raise HTTPException(status_code=503, detail="M-Pesa not configured")

    phone = request.phone.replace("+254", "254").replace(" ", "")
    if not phone.startswith("254"):
        phone = "254" + phone.lstrip("0")

    checkout_id = f"COPAY{uuid.uuid4().hex[:12].upper()}"

    callback_url = (
        settings.MPESA_CALLBACK_URL or "https://yourdomain.com/api/v1/payments/callback"
    )

    result = await initiate_stk_push(
        phone=phone,
        amount=request.amount,
        callback_url=callback_url,
        account_ref=checkout_id,
        description=request.description,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=502, detail=result.get("error", "Failed to initiate STK push")
        )

    # Persist the transaction into the database
    await db.execute(
        """
        INSERT INTO payment_transactions (
            id, hospital_id, patient_id, reference, provider,
            amount, currency, status, description, metadata,
            created_at, updated_at
        )
        VALUES (
            :id, :hospital_id, :patient_id, :reference, 'mpesa',
            :amount, 'KES', 'pending', :description, :metadata,
            NOW(), NOW()
        )
        """,
        {
            "id": str(uuid.uuid4()),
            "hospital_id": hospital_id,
            "patient_id": request.patient_id,
            "reference": checkout_id,
            "amount": request.amount,
            "description": request.description,
            "metadata": json.dumps({"phone": phone, "claim_id": request.claim_id}),
        }
    )
    await db.commit()

    return STKPushResponse(
        checkout_id=checkout_id,
        status="pending",
        phone=phone,
        amount=request.amount,
        created_at=datetime.now().isoformat(),
    )


@router.post("/callback")
async def mpesa_callback(
    checkout_id: str = Query(...),
    status: str = Query(...),
    mpesa_code: Optional[str] = Query(None),
    amount: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    transaction_date: Optional[str] = Query(None),
    db=Depends(get_db_session),
):
    """M-Pesa callback handler for STK push"""
    result = await db.execute(
        """
        SELECT * FROM payment_transactions WHERE reference = :reference
        """,
        {"reference": checkout_id}
    )
    txn = result.mappings().first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    new_status = "completed" if status == "0" else "failed"
    paid_at = datetime.now() if new_status == "completed" else None

    await db.execute(
        """
        UPDATE payment_transactions
        SET status = :status,
            transaction_id = :mpesa_code,
            paid_at = :paid_at,
            updated_at = NOW()
        WHERE reference = :reference
        """,
        {
            "status": new_status,
            "mpesa_code": mpesa_code,
            "paid_at": paid_at,
            "reference": checkout_id,
        }
    )
    await db.commit()

    return {
        "checkout_id": checkout_id,
        "status": new_status,
        "message": "Callback processed",
    }


@router.get("/status/{checkout_id}", response_model=PaymentStatusResponse)
async def get_payment_status(
    checkout_id: str,
    hospital_id: str = Depends(get_hospital_id),
    db=Depends(get_db_session),
):
    """Check payment status by checkout_id"""
    result = await db.execute(
        """
        SELECT * FROM payment_transactions WHERE reference = :reference
        """,
        {"reference": checkout_id}
    )
    txn = result.mappings().first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if str(txn["hospital_id"]) != hospital_id:
        raise HTTPException(status_code=403, detail="Access denied")

    status = txn["status"]
    mpesa_code = txn["transaction_id"]
    paid_at = txn["paid_at"]

    if status == "pending":
        status_result = await check_stk_status(checkout_id)
        result_code = status_result.get("ResultCode")

        if result_code == "0":
            status = "completed"
            mpesa_code = status_result.get("MpesaReceiptNumber")
            # Safaricom format e.g. 20260416140500
            t_date_str = status_result.get("TransactionDate")
            try:
                paid_at = datetime.strptime(t_date_str, "%Y%m%d%H%M%S") if t_date_str else datetime.now()
            except Exception:
                paid_at = datetime.now()
        elif result_code == "1":
            status = "failed"

        await db.execute(
            """
            UPDATE payment_transactions
            SET status = :status,
                transaction_id = :mpesa_code,
                paid_at = :paid_at,
                updated_at = NOW()
            WHERE reference = :reference
            """,
            {
                "status": status,
                "mpesa_code": mpesa_code,
                "paid_at": paid_at,
                "reference": checkout_id,
            }
        )
        await db.commit()

    meta = txn["metadata"]
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except Exception:
            meta = {}
    elif not meta:
        meta = {}
    phone = meta.get("phone", "")

    return PaymentStatusResponse(
        checkout_id=txn["reference"],
        status=status,
        phone=phone,
        amount=float(txn["amount"]),
        mpesa_code=mpesa_code,
        transaction_date=paid_at.isoformat() if paid_at else None,
        created_at=txn["created_at"].isoformat(),
        updated_at=txn["updated_at"].isoformat(),
    )


@router.get("/by-patient/{patient_id}")
async def get_payments_by_patient(
    patient_id: str,
    status_filter: Optional[str] = Query(None, alias="status"),
    hospital_id: str = Depends(get_hospital_id),
    db=Depends(get_db_session),
):
    """Get all payments for a patient"""
    query = """
        SELECT id, reference as checkout_id, amount, status, transaction_id as mpesa_code, created_at
        FROM payment_transactions
        WHERE patient_id = :patient_id AND hospital_id = :hospital_id
    """
    params = {"patient_id": patient_id, "hospital_id": hospital_id}
    if status_filter:
        query += " AND status = :status"
        params["status"] = status_filter
    query += " ORDER BY created_at DESC"

    result = await db.execute(query, params)
    rows = result.mappings().all()

    return [
        {
            "checkout_id": r["checkout_id"],
            "amount": float(r["amount"]),
            "status": r["status"],
            "mpesa_code": r["mpesa_code"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]
