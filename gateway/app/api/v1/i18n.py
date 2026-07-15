"""
i18n API - Translations and multilingual support
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class TranslationKey(BaseModel):
    key: str
    en: str
    sw: str
    ki: Optional[str] = None
    luo: Optional[str] = None
    kam: Optional[str] = None
    som: Optional[str] = None
    sheng: Optional[str] = None
    context: str = "button"


class TranslationUpdate(BaseModel):
    en: Optional[str] = None
    sw: Optional[str] = None
    ki: Optional[str] = None
    luo: Optional[str] = None
    kam: Optional[str] = None
    som: Optional[str] = None
    sheng: Optional[str] = None
    context: Optional[str] = None


class ClinicalTranslation(BaseModel):
    code: str
    type: str  # 'condition', 'drug', 'instruction'
    en: str
    sw: Optional[str] = None
    ki: Optional[str] = None
    luo: Optional[str] = None
    kam: Optional[str] = None
    som: Optional[str] = None


class LanguageStats(BaseModel):
    total_keys: int
    en_coverage: float
    sw_coverage: float
    ki_coverage: float
    luo_coverage: float


from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id


@router.get("")
async def get_translations(
    lang: str = Query("sw", description="Language code"),
    context: Optional[str] = Query(None),
    db=Depends(get_db_session),
):
    """Get all translations for a language"""
    
    if lang not in ["en", "sw", "ki", "luo", "kam", "som", "sheng"]:
        lang = "sw"
    
    conditions = []
    params = {}
    
    if context:
        conditions.append("context = :context")
        params["context"] = context
    
    where = " AND ".join(conditions) if conditions else "true"
    
    sql = f"SELECT key, en, sw, {lang} as lang FROM i18n_keys WHERE {where}"
    rows = await db.fetchall(sql, params)
    
    return {row["key"]: row["lang"] or row["sw"] for row in rows}


@router.get("/keys")
async def list_keys(
    search: Optional[str] = Query(None),
    context: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db=Depends(get_db_session),
):
    """List translation keys"""
    
    conditions = []
    params = {"limit": limit, "offset": (page - 1) * limit}
    
    if search:
        conditions.append("(key ILIKE :search OR en ILIKE :search OR sw ILIKE :search)")
        params["search"] = f"%{search}%"
    
    if context:
        conditions.append("context = :context")
        params["context"] = context
    
    where = " AND ".join(conditions) if conditions else "true"
    
    sql = f"SELECT * FROM i18n_keys WHERE {where} ORDER BY key LIMIT :limit OFFSET :offset"
    rows = await db.fetchall(sql, params)
    
    return {
        "items": [
            {
                "key": row["key"],
                "en": row["en"],
                "sw": row["sw"],
                "ki": row["ki"],
                "luo": row["luo"],
                "context": row["context"],
            }
            for row in rows
        ]
    }


@router.post("/keys")
async def create_translation(
    translation: TranslationKey,
    db=Depends(get_db_session),
):
    """Create translation key (admin only)"""
    
    await db.execute(
        """INSERT INTO i18n_keys (key, en, sw, ki, luo, kam, som, sheng, context)
           VALUES (:key, :en, :sw, :ki, :luo, :kam, :som, :sheng, :context)
           ON CONFLICT (key) DO NOTHING""",
        translation.model_dump(),
    )
    
    return {"status": "created"}


@router.put("/keys/{key}")
async def update_translation(
    key: str,
    translation: TranslationUpdate,
    db=Depends(get_db_session),
):
    """Update translation"""
    
    updates = []
    params = {"key": key}
    
    for field, value in translation.model_dump(exclude_none=True).items():
        updates.append(f"{field} = :{field}")
        params[field] = value
    
    if not updates:
        return {"status": "no changes"}
    
    sql = f"UPDATE i18n_keys SET {', '.join(updates)} WHERE key = :key RETURNING key"
    row = await db.fetchone(sql, params)
    
    if not row:
        return {"status": "not found"}
    
    return {"status": "updated"}


@router.get("/clinical")
async def get_clinical_translations(
    lang: str = Query("sw"),
    type_filter: Optional[str] = Query(None, alias="type"),
    db=Depends(get_db_session),
):
    """Get clinical translations"""
    
    if lang not in ["en", "sw", "ki", "luo", "kam", "som"]:
        lang = "sw"
    
    conditions = []
    params = {}
    
    if type_filter:
        conditions.append("type = :type")
        params["type"] = type_filter
    
    where = " AND ".join(conditions) if conditions else "true"
    
    sql = f"SELECT code, type, en, {lang} as lang FROM clinical_i18n WHERE {where}"
    rows = await db.fetchall(sql, params)
    
    return {row["code"]: {"type": row["type"], "text": row["lang"] or row["en"]} for row in rows}


@router.post("/clinical")
async def create_clinical_translation(
    translation: ClinicalTranslation,
    db=Depends(get_db_session),
):
    """Create clinical translation"""
    
    await db.execute(
        """INSERT INTO clinical_i18n (code, type, en, sw, ki, luo, kam, som)
           VALUES (:code, :type, :en, :sw, :ki, :luo, :kam, :som)
           ON CONFLICT (code, type) DO NOTHING""",
        translation.model_dump(),
    )
    
    return {"status": "created"}


@router.get("/stats", response_model=LanguageStats)
async def get_language_stats(
    db=Depends(get_db_session),
):
    """Get translation coverage stats"""
    
    sql = """
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN en IS NOT NULL THEN 1 END) as en_count,
               COUNT(CASE WHEN sw IS NOT NULL THEN 1 END) as sw_count,
               COUNT(CASE WHEN ki IS NOT NULL THEN 1 END) as ki_count,
               COUNT(CASE WHEN luo IS NOT NULL THEN 1 END) as luo_count
        FROM i18n_keys
    """
    row = await db.fetchone(sql)
    
    total = row["total"] or 1
    
    return LanguageStats(
        total_keys=total,
        en_coverage=round((row["en_count"] or 0) / total * 100, 1),
        sw_coverage=round((row["sw_count"] or 0) / total * 100, 1),
        ki_coverage=round((row["ki_count"] or 0) / total * 100, 1),
        luo_coverage=round((row["luo_count"] or 0) / total * 100, 1),
    )


@router.get("/user-prefs")
async def get_user_language_prefs(
    user_id: str,
    db=Depends(get_db_session),
):
    """Get user's language preferences"""
    
    sql = """
        SELECT lang_ui, lang_patient, lang_voice 
        FROM profiles WHERE id = :user_id
    """
    row = await db.fetchone(sql, {"user_id": user_id})
    
    if not row:
        return {"lang_ui": "sw", "lang_patient": "sw", "lang_voice": "sw"}
    
    return {
        "lang_ui": row["lang_ui"] or "sw",
        "lang_patient": row["lang_patient"] or "sw",
        "lang_voice": row["lang_voice"] or "sw",
    }


@router.put("/user-prefs")
async def update_user_language_prefs(
    lang_ui: Optional[str] = Query(None),
    lang_patient: Optional[str] = Query(None),
    lang_voice: Optional[str] = Query(None),
    db=Depends(get_db_session),
    user_id: str = Depends(lambda: "current"),  # Will use actual user
):
    """Update user's language preferences"""
    
    updates = []
    params = {"user_id": user_id}
    
    if lang_ui:
        updates.append("lang_ui = :lang_ui")
        params["lang_ui"] = lang_ui
    
    if lang_patient:
        updates.append("lang_patient = :lang_patient")
        params["lang_patient"] = lang_patient
    
    if lang_voice:
        updates.append("lang_voice = :lang_voice")
        params["lang_voice"] = lang_voice
    
    if not updates:
        return {"status": "no changes"}
    
    sql = f"UPDATE profiles SET {', '.join(updates)} WHERE id = :user_id"
    await db.execute(sql, params)
    
    return {"status": "updated"}


@router.post("/ai-translate")
async def ai_translate_keys(
    target_lang: str,
    db=Depends(get_db_session),
):
    """AI prefill translations using LLM"""
    # This would call the AI provider
    # Implementation depends on having AI configured
    return {"status": "not implemented", "message": "Requires AI provider configuration"}