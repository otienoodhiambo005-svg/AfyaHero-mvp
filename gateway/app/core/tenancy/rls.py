from app.core.tenancy.context import get_hospital_id, get_user_id, get_user_role


async def set_rls_context(session) -> None:
    """
    Inject tenant context into PostgreSQL session for RLS policies.

    These settings are scoped to the current database session only.
    Call this at the start of every database transaction that touches clinical data.
    """
    await session.execute(
        "SELECT "
        "  set_config('app.current_hospital_id', :hid,  true), "
        "  set_config('app.current_user_id',     :uid,  true), "
        "  set_config('app.current_user_role',   :role, true)",
        {
            "hid":  str(get_hospital_id()),
            "uid":  str(get_user_id()),
            "role": get_user_role(),
        }
    )