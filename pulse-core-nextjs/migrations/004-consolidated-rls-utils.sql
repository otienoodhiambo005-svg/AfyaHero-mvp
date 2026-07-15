-- ==================================================
-- AFYAHERO UNIFIED RLS UTILITIES
-- Migration: 004-consolidated-rls-utils.sql
-- ==================================================

-- 1. Create a function to extract the current hospital_id from any session or JWT source
CREATE OR REPLACE FUNCTION current_hospital_id() RETURNS uuid AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('app.current_hospital_id', true), '')::uuid,
    NULLIF(current_setting('app.facility_id', true), '')::uuid,
    (auth.jwt() ->> 'app.facility_id')::uuid,
    (auth.jwt() ->> 'hospital_id')::uuid
  );
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Create a function to extract current user_id
CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('app.current_user_id', true), '')::uuid,
    (auth.jwt() ->> 'app.user_id')::uuid,
    (auth.jwt() ->> 'sub')::uuid
  );
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Create a function to extract current user_role
CREATE OR REPLACE FUNCTION current_user_role() RETURNS text AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('app.current_user_role', true), ''),
    (auth.jwt() ->> 'app.role'),
    'guest'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN 'guest';
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Apply these functions to existing RLS policies by recreating them
-- This makes the policies source-agnostic (works with Next.js/Prisma AND Supabase Auth)
