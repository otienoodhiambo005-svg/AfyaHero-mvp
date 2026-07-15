-- ==================================================
-- UNIFIED RLS POLICIES (Consolidated)
-- Migration: 005-unified-rls-policies.sql
-- ==================================================

-- First, drop old policies that use legacy naming
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 1. PATIENTS
CREATE POLICY patients_unified_policy ON patients
    FOR ALL
    USING (
        hospital_id = current_hospital_id()
        OR id = current_user_id()
        OR current_user_role() = 'super_admin'
    )
    WITH CHECK (
        hospital_id = current_hospital_id()
        AND current_user_role() IN ('clinician', 'admin', 'medical', 'reception', 'super_admin')
    );

-- 2. APPOINTMENTS
CREATE POLICY appointments_unified_policy ON appointments
    FOR ALL
    USING (
        hospital_id = current_hospital_id()
        OR patient_id = current_user_id()
        OR current_user_role() = 'super_admin'
    )
    WITH CHECK (
        hospital_id = current_hospital_id()
        AND current_user_role() IN ('reception', 'clinician', 'admin', 'medical', 'super_admin')
    );

-- 3. CONSULTATIONS
CREATE POLICY consultations_unified_policy ON consultations
    FOR ALL
    USING (
        hospital_id = current_hospital_id()
        OR patient_id = current_user_id()
        OR current_user_role() = 'super_admin'
    )
    WITH CHECK (
        hospital_id = current_hospital_id()
        AND current_user_role() IN ('clinician', 'admin', 'medical', 'super_admin')
    );

-- 4. PRESCRIPTIONS
CREATE POLICY prescriptions_unified_policy ON prescriptions
    FOR ALL
    USING (
        hospital_id = current_hospital_id()
        OR patient_id = current_user_id()
        OR current_user_role() = 'super_admin'
    )
    WITH CHECK (
        hospital_id = current_hospital_id()
        AND current_user_role() IN ('clinician', 'admin', 'medical', 'pharmacy', 'pharmacist', 'super_admin')
    );

-- 5. CLINICAL VITALS
CREATE POLICY vitals_unified_policy ON clinical_vitals
    FOR ALL
    USING (
        hospital_id = current_hospital_id()
        OR current_user_role() = 'super_admin'
    )
    WITH CHECK (
        hospital_id = current_hospital_id()
        AND current_user_role() IN ('clinician', 'admin', 'medical', 'super_admin')
    );

-- 6. PROFILES (Staff)
CREATE POLICY profiles_unified_policy ON profiles
    FOR ALL
    USING (
        hospital_id = current_hospital_id()
        OR id = current_user_id()
        OR current_user_role() = 'super_admin'
    )
    WITH CHECK (
        hospital_id = current_hospital_id()
        AND current_user_role() IN ('admin', 'super_admin')
    );

-- 7. AUDIT LOGS (Selective Access)
CREATE POLICY audit_logs_unified_policy ON audit_logs
    FOR SELECT
    USING (
        (hospital_id = current_hospital_id() AND current_user_role() = 'admin')
        OR current_user_role() = 'super_admin'
    );
