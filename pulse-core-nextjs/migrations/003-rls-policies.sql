-- ==================================================
-- AFYAHERO ROW LEVEL SECURITY POLICIES
-- KDPA Compliance and Multi-Tenant Isolation
-- Migration: 003-rls-policies.sql
-- ==================================================

-- Enable RLS on all patient data tables
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shif_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;

-- ==================================================
-- PATIENTS TABLE POLICIES
-- ==================================================
-- Patients: facility_id match OR own patient_id (for self-service)
CREATE POLICY patients_select_policy ON patients
    FOR SELECT
    USING (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        OR id = (auth.jwt() ->> 'app.user_id')::uuid
    );

CREATE POLICY patients_insert_policy ON patients
    FOR INSERT
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') IN ('clinician', 'admin')
    );

CREATE POLICY patients_update_policy ON patients
    FOR UPDATE
    USING (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') IN ('clinician', 'admin')
    )
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') IN ('clinician', 'admin')
    );

-- ==================================================
-- APPOINTMENTS TABLE POLICIES
-- ==================================================
CREATE POLICY appointments_select_policy ON appointments
    FOR SELECT
    USING (hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid);

CREATE POLICY appointments_insert_policy ON appointments
    FOR INSERT
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') IN ('reception', 'clinician', 'admin')
    );

CREATE POLICY appointments_update_policy ON appointments
    FOR UPDATE
    USING (hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid)
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') IN ('reception', 'clinician', 'admin')
    );

-- ==================================================
-- CONSULTATIONS TABLE POLICIES
-- ==================================================
CREATE POLICY consultations_select_policy ON consultations
    FOR SELECT
    USING (hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid);

CREATE POLICY consultations_insert_policy ON consultations
    FOR INSERT
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') IN ('clinician', 'admin')
    );

CREATE POLICY consultations_update_policy ON consultations
    FOR UPDATE
    USING (hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid)
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') IN ('clinician', 'admin')
    );

-- ==================================================
-- PRESCRIPTIONS TABLE POLICIES
-- ==================================================
CREATE POLICY prescriptions_select_policy ON prescriptions
    FOR SELECT
    USING (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (
            (auth.jwt() ->> 'app.role') IN ('clinician', 'admin')
            OR (
                (auth.jwt() ->> 'app.role') = 'pharmacist'
                AND hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
            )
            OR (
                patient_id = (auth.jwt() ->> 'app.user_id')::uuid
            )
        )
    );

CREATE POLICY prescriptions_insert_policy ON prescriptions
    FOR INSERT
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') IN ('clinician', 'admin')
    );

CREATE POLICY prescriptions_update_policy ON prescriptions
    FOR UPDATE
    USING (hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid)
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (
            (auth.jwt() ->> 'app.role') IN ('clinician', 'admin')
            OR (
                (auth.jwt() ->> 'app.role') = 'pharmacist'
                AND status IN ('pending', 'dispensing')
            )
        )
    );

-- ==================================================
-- CLINICAL VITALS TABLE POLICIES
-- ==================================================
CREATE POLICY clinical_vitals_select_policy ON clinical_vitals
    FOR SELECT
    USING (hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid);

CREATE POLICY clinical_vitals_insert_policy ON clinical_vitals
    FOR INSERT
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') IN ('clinician', 'admin')
    );

CREATE POLICY clinical_vitals_update_policy ON clinical_vitals
    FOR UPDATE
    USING (hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid)
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') IN ('clinician', 'admin')
    );

-- ==================================================
-- LAB REQUESTS TABLE POLICIES
-- ==================================================
CREATE POLICY lab_requests_select_policy ON lab_requests
    FOR SELECT
    USING (hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid);

CREATE POLICY lab_requests_insert_policy ON lab_requests
    FOR INSERT
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') IN ('clinician', 'admin')
    );

CREATE POLICY lab_requests_update_policy ON lab_requests
    FOR UPDATE
    USING (hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid)
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (
            (auth.jwt() ->> 'app.role') IN ('clinician', 'admin')
            OR (
                (auth.jwt() ->> 'app.role') = 'lab'
                AND status IN ('ordered', 'sample-collected', 'processing')
            )
        )
    );

-- ==================================================
-- SHIF CLAIMS TABLE POLICIES
-- ==================================================
CREATE POLICY shif_claims_select_policy ON shif_claims
    FOR SELECT
    USING (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') IN ('admin', 'pharmacist')
    );

CREATE POLICY shif_claims_insert_policy ON shif_claims
    FOR INSERT
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') IN ('admin', 'pharmacist')
    );

CREATE POLICY shif_claims_update_policy ON shif_claims
    FOR UPDATE
    USING (hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid)
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') IN ('admin', 'pharmacist')
    );

-- ==================================================
-- AUDIT LOGS TABLE POLICIES
-- ==================================================
-- Read-only post-write, immutable
CREATE POLICY audit_logs_select_policy ON audit_logs
    FOR SELECT
    USING ((auth.jwt() ->> 'app.role') = 'super_admin');

-- No insert/update/delete policies - only service role can write

-- ==================================================
-- PROFILES TABLE POLICIES
-- ==================================================
CREATE POLICY profiles_select_policy ON profiles
    FOR SELECT
    USING (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        OR id = (auth.jwt() ->> 'app.user_id')::uuid
        OR (auth.jwt() ->> 'app.role') = 'super_admin'
    );

CREATE POLICY profiles_insert_policy ON profiles
    FOR INSERT
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') = 'admin'
    );

CREATE POLICY profiles_update_policy ON profiles
    FOR UPDATE
    USING (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (
            id = (auth.jwt() ->> 'app.user_id')::uuid
            OR (auth.jwt() ->> 'app.role') = 'admin'
        )
    )
    WITH CHECK (
        hospital_id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (
            id = (auth.jwt() ->> 'app.user_id')::uuid
            OR (auth.jwt() ->> 'app.role') = 'admin'
        )
    );

-- ==================================================
-- HOSPITALS TABLE POLICIES
-- ==================================================
CREATE POLICY hospitals_select_policy ON hospitals
    FOR SELECT
    USING (
        id = (auth.jwt() ->> 'app.facility_id')::uuid
        OR (auth.jwt() ->> 'app.role') = 'super_admin'
    );

CREATE POLICY hospitals_insert_policy ON hospitals
    FOR INSERT
    WITH CHECK ((auth.jwt() ->> 'app.role') = 'super_admin');

CREATE POLICY hospitals_update_policy ON hospitals
    FOR UPDATE
    USING (
        id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') = 'admin'
    )
    WITH CHECK (
        id = (auth.jwt() ->> 'app.facility_id')::uuid
        AND (auth.jwt() ->> 'app.role') = 'admin'
    );

-- ==================================================
-- ADDITIONAL TABLES (if they exist)
-- ==================================================
-- Enable RLS on any triage_assessments table if created later
-- ALTER TABLE triage_assessments ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY triage_assessments_select_policy ON triage_assessments
--     FOR SELECT
--     USING (facility_id = (auth.jwt() ->> 'app.facility_id')::uuid);

-- Enable RLS on feature_flags if exists
-- ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY feature_flags_select_policy ON feature_flags
--     FOR SELECT
--     USING (true); -- All authenticated can read

-- CREATE POLICY feature_flags_insert_policy ON feature_flags
--     FOR INSERT
--     WITH CHECK ((auth.jwt() ->> 'app.role') = 'super_admin');

-- CREATE POLICY feature_flags_update_policy ON feature_flags
--     FOR UPDATE
--     USING ((auth.jwt() ->> 'app.role') = 'super_admin')
--     WITH CHECK ((auth.jwt() ->> 'app.role') = 'super_admin');