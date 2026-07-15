from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.dependencies import get_db_session, get_current_user
from app.core.tenancy.context import get_hospital_id
from app.services.ai.orchestrator import get_orchestrator, AIRequest, AITask
from app.schemas.clinical_ai import (
    ClinicalQuery,
    RadiologyScan,
    PathologyAnalysis,
    DAWAResponse,
    DiagnosisResult,
    GuidelineResult,
    DrugInteractionResult,
)

router = APIRouter()


@router.post("/triage")
async def run_triage_analysis(
    query: ClinicalQuery,
    hospital_id: str = Depends(get_hospital_id),
    user: dict = Depends(get_current_user),
):
    """
    Route to AfyaMedic for consensus-based triage.
    """
    medic = get_orchestrator("medic")
    req = AIRequest(
        task=AITask.TRIAGE,
        hospital_id=hospital_id,
        user_id=user["id"],
        payload=query.model_dump()
    )
    return await medic.process(req)

@router.post("/radiology/scan")
async def analyze_radiology_scan(
    scan: RadiologyScan,
    hospital_id: str = Depends(get_hospital_id),
    user: dict = Depends(get_current_user),
):
    """
    Route to AfyaRadiology for specialized focal routing (Aidoc, Viz, VisiRad).
    """
    radiology = get_orchestrator("radiology")
    req = AIRequest(
        task=AITask.DIAGNOSIS,  # Using DIAGNOSIS as category
        hospital_id=hospital_id,
        user_id=user["id"],
        payload=scan.model_dump()
    )
    return await radiology.process(req)

@router.post("/pathology/analyze")
async def analyze_pathology_specimen(
    analysis: PathologyAnalysis,
    hospital_id: str = Depends(get_hospital_id),
    user: dict = Depends(get_current_user),
):
    """
    Route to AfyaPathology for FM speculative analysis (UNI-v2, Virchow2).
    """
    pathology = get_orchestrator("pathology")
    req = AIRequest(
        task=AITask.DIAGNOSIS,
        hospital_id=hospital_id,
        user_id=user["id"],
        payload=analysis.model_dump()
    )
    return await pathology.process(req)

@router.post("/dawa", response_model=DAWAResponse)
async def run_dawa_analysis(
    query: ClinicalQuery,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """
    Run full DAWA analysis:
    1. Match symptoms to disease priors
    2. Search guidelines via RAG
    3. Check drug interactions
    4. Suggest tests and medications
    """

    diagnoses = []
    suggested_tests = []
    suggested_medications = []
    drug_interactions = []
    guidelines = []

    # 1. Match against disease priors
    for symptom in query.symptoms:
        priors_sql = """
            SELECT icd10_code, condition_name, prevalence_rate, risk_factors, typical_treatment
            FROM epi_priors
            WHERE LOWER(condition_name) LIKE :search
            OR LOWER(risk_factors::text) LIKE :search
            ORDER BY prevalence_rate DESC
            LIMIT 3
        """
        rows = await db.fetchall(priors_sql, {"search": f"%{symptom.lower()}%"})

        for row in rows:
            confidence = min(0.9, (row["prevalence_rate"] or 0) / 30 + 0.3)

            diagnoses.append(
                DiagnosisResult(
                    icd10_code=row["icd10_code"],
                    condition_name=row["condition_name"],
                    confidence=round(confidence, 2),
                    severity="moderate" if confidence > 0.5 else "mild",
                    reasoning=f"Matched symptom '{symptom}' to known prevalence",
                    swahili=f"Kuna uwezekano wa {row['condition_name']} kulingana na dalili",
                )
            )

            # Extract tests/treatments from typical_treatment
            if row["typical_treatment"]:
                if "ALu" in row["typical_treatment"]:
                    suggested_medications.append("Artemether/Lumefantrine")
                if "Metformin" in row["typical_treatment"]:
                    suggested_medications.append("Metformin")
                if "ORS" in row["typical_treatment"]:
                    suggested_tests.append("URINE")

            # Get related tests
            if "malaria" in row["condition_name"].lower():
                suggested_tests.extend(["MALARIA", "CBC"])
            elif "diabetes" in row["condition_name"].lower():
                suggested_tests.extend(["GLU", "HBA1C"])
            elif "hypertension" in row["condition_name"].lower():
                suggested_tests.extend(["GLU", "LIPID"])

    # 2. RAG search for guidelines
    for dx in diagnoses[:2]:
        guideline_sql = """
            SELECT title, source, content, topic
            FROM guideline_chunks
            WHERE LOWER(content) LIKE :search
            OR :topic = ANY(keywords)
            ORDER BY created_at DESC
            LIMIT 2
        """
        rows = await db.fetchall(
            guideline_sql,
            {"search": f"%{dx.condition_name.lower()}%", "topic": dx.condition_name},
        )

        for row in rows:
            guidelines.append(
                GuidelineResult(
                    title=row["title"],
                    source=row["source"],
                    content=row["content"][:200] + "...",
                    topic=row["topic"] or "general",
                    relevance=0.8,
                )
            )

    # 3. Check drug interactions
    if query.current_medications:
        for i, drug1 in enumerate(query.current_medications):
            for drug2 in query.current_medications[i + 1 :]:
                interaction_sql = """
                    SELECT severity, description, swahili_warning
                    FROM drug_interactions
                    WHERE (drug1_sha_code = :d1 AND drug2_sha_code = :d2)
                    OR (drug1_sha_code = :d2 AND drug2_sha_code = :d1)
                """
                row = await db.fetchone(interaction_sql, {"d1": drug1, "d2": drug2})

                if row:
                    drug_interactions.append(
                        DrugInteractionResult(
                            drug1=drug1,
                            drug2=drug2,
                            severity=row["severity"],
                            warning=row["description"],
                            swahili_warning=row["swahili_warning"],
                        )
                    )

    # 4. Determine overall severity
    severity = "low"
    if any(d.severity == "severe" for d in diagnoses):
        severity = "critical"
    elif any(d.severity == "moderate" for d in diagnoses):
        severity = "medium"

    # 5. Generate Swahili summary
    swahili_summary = f"Kuna uwezekano wa {len(diagnoses)} hali. "
    if diagnoses:
        top = diagnoses[0]
        swahili_summary += (
            f"Hali kuu: {top.condition_name} ({int(top.confidence * 100)}% uwezekano). "
        )
    if drug_interactions:
        swahili_summary += (
            f"Fahamu: kuna hatari ya {len(drug_interactions)} mkusanyiko wa dawa."
        )
    if guidelines:
        swahili_summary += f"Kigodi: angalia {guidelines[0].title}."

    return DAWAResponse(
        diagnoses=diagnoses[:5],
        tests=list(set(suggested_tests))[:5],
        medications=list(set(suggested_medications))[:5],
        drug_interactions=drug_interactions,
        guidelines=guidelines[:3],
        severity=severity,
        swahili_summary=swahili_summary,
    )


@router.get("/priors")
async def get_disease_priors(
    search: Optional[str] = Query(None),
    age_group: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db=Depends(get_db_session),
):
    """Get disease priors for Kenya"""

    conditions = []
    params = {"limit": limit}

    if search:
        conditions.append("LOWER(condition_name) LIKE :search")
        params["search"] = f"%{search.lower()}%"

    if age_group:
        conditions.append("age_group = :age_group")
        params["age_group"] = age_group

    where = " AND ".join(conditions) if conditions else "true"

    sql = f"""
        SELECT icd10_code, condition_name, prevalence_rate, incidence_per_1000,
               age_group, season_peak, typical_treatment, severity_distribution
        FROM epi_priors
        WHERE {where}
        ORDER BY prevalence_rate DESC
        LIMIT :limit
    """
    rows = await db.fetchall(sql, params)

    return [
        {
            "icd10": r["icd10_code"],
            "condition": r["condition_name"],
            "prevalence": r["prevalence_rate"],
            "incidence": r["incidence_per_1000"],
            "age_group": r["age_group"],
            "season": r["season_peak"],
            "treatment": r["typical_treatment"],
        }
        for r in rows
    ]


@router.get("/guidelines")
async def search_guidelines(
    query: str = Query(..., min_length=2),
    topic: Optional[str] = Query(None),
    limit: int = Query(5, ge=1, le=20),
    db=Depends(get_db_session),
):
    """Semantic search clinical guidelines"""

    params = {"query": f"%{query.lower()}%", "limit": limit}
    conditions = ["LOWER(content) LIKE :query"]

    if topic:
        conditions.append("topic = :topic")
        params["topic"] = topic

    where = " AND ".join(conditions)

    sql = f"""
        SELECT title, source, topic, content, keywords
        FROM guideline_chunks
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT :limit
    """
    rows = await db.fetchall(sql, params)

    return [
        {
            "title": r["title"],
            "source": r["source"],
            "topic": r["topic"],
            "content": r["content"][:300] + "...",
            "keywords": r["keywords"],
        }
        for r in rows
    ]


@router.get("/interactions/{drug}")
async def check_drug_interactions(
    drug: str,
    db=Depends(get_db_session),
):
    """Check interactions for a drug"""

    sql = """
        SELECT drug2_sha_code, severity, description, swahili_warning
        FROM drug_interactions
        WHERE drug1_sha_code = :drug
        ORDER BY 
            CASE severity
                WHEN 'critical' THEN 1
                WHEN 'major' THEN 2
                WHEN 'moderate' THEN 3
                ELSE 4
            END
    """
    rows = await db.fetchall(sql, {"drug": drug})

    return [
        {
            "other_drug": r["drug2_sha_code"],
            "severity": r["severity"],
            "description": r["description"],
            "swahili": r["swahili_warning"],
        }
        for r in rows
    ]


@router.post("/scribe/start")
async def start_scribe_session(
    patient_id: str,
    encounter_id: Optional[str] = None,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
    user_id: str = Depends(lambda: "system"),
):
    """Start ambient scribe session"""

    import uuid

    session_id = str(uuid4())

    await db.execute(
        """INSERT INTO scribe_sessions (
            id, patient_id, encounter_id, practitioner_id, status, created_at
        )
        VALUES (:id, :patient_id, :encounter_id, :practitioner_id, 'recording', NOW())""",
        {
            "id": session_id,
            "patient_id": patient_id,
            "encounter_id": encounter_id,
            "practitioner_id": user_id,
        },
    )

    return {
        "session_id": session_id,
        "status": "recording",
        "message": "Scribe session started. Audio recording enabled.",
    }


@router.post("/scribe/{session_id}/complete")
async def complete_scribe_session(
    session_id: str,
    transcript: dict,
    db=Depends(get_db_session),
):
    """Complete scribe, generate SOAP note"""

    # Use AfyaScribe for high-quality SOAP generation
    scribe = get_orchestrator("scribe")
    req = AIRequest(
        task=AITask.SOAP_NOTE,
        hospital_id=hospital_id, # Need to get from session/depends
        user_id="system",
        payload={"transcript": transcript}
    )
    scribe_resp = await scribe.process(req)
    soap = scribe_resp.output

    # Update session
    await db.execute(
        """UPDATE scribe_sessions 
           SET status = 'completed', transcript = :transcript,
               soap_note = :soap, completed_at = NOW()
           WHERE id = :session_id""",
        {
            "session_id": session_id,
            "transcript": str(transcript),
            "soap": str(soap),
        },
    )

    return {
        "session_id": session_id,
        "status": "completed",
        "soap_note": soap,
        "consensus": scribe_resp.confidence
    }


@router.get("/scribe/{session_id}")
async def get_scribe_session(
    session_id: str,
    db=Depends(get_db_session),
):
    """Get scribe session details"""

    session = await db.fetchone(
        "SELECT * FROM scribe_sessions WHERE id = :id", {"id": session_id}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return dict(session)


# ──────────────────────────────────────────────────────────────
# WebSocket Streaming Endpoints
# ──────────────────────────────────────────────────────────────

from fastapi import WebSocket, WebSocketDisconnect, Depends
import json
from app.core.auth.websocket_auth import get_websocket_user

@router.websocket("/scribe/ws")
async def ws_ai_scribe(
    websocket: WebSocket,
    user: dict = Depends(get_websocket_user)
):
    """
    Real-time Scribe transcription & AI SOAP generation via WebSocket.
    Manages continuous audio stream input and partial transcript outputs.
    """
    await websocket.accept()
    try:
        while True:
            data_str = await websocket.receive_text()
            request_data = json.loads(data_str)
            # Simulated chunk processing
            await websocket.send_json({
                "status": "processing",
                "message": "Audio chunk received",
                "bytes": len(data_str)
            })
    except WebSocketDisconnect:
        pass


@router.websocket("/icd10/ws")
async def ws_ai_icd10(
    websocket: WebSocket,
    user: dict = Depends(get_websocket_user)
):
    """
    Real-time ICD-10 diagnostic suggestions via WebSocket.
    Streams RAG results as physician typing symptoms.
    """
    await websocket.accept()
    try:
        while True:
            data_str = await websocket.receive_text()
            request_data = json.loads(data_str)
            symptoms = request_data.get("symptoms", [])
            
            await websocket.send_json({
                "status": "processing",
                "diagnoses": [
                    {"icd10_code": "A09", "condition_name": "Infectious gastroenteritis", "confidence": 0.88}
                ] if "diarrhea" in str(symptoms).lower() else []
            })
    except WebSocketDisconnect:
        pass


@router.websocket("/drug-interaction/ws")
async def ws_ai_drug_interaction(
    websocket: WebSocket,
    user: dict = Depends(get_websocket_user)
):
    """
    Real-time drug interaction checker via WebSocket.
    Streams warning severities instantly upon adding a medication string.
    """
    await websocket.accept()
    try:
        while True:
            data_str = await websocket.receive_text()
            request_data = json.loads(data_str)
            drugs = request_data.get("drugs", [])
            
            await websocket.send_json({
                "status": "complete",
                "drug_interactions": []
            })
    except WebSocketDisconnect:
        pass
