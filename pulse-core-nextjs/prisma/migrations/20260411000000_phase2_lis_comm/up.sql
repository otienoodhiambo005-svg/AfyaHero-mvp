-- Phase 2: LIS + Communication + Additional Tables
-- Migration: 20260411000000_phase2_lis_comm.sql

-- ──────────────────────────────────────────────────────────────
-- 1. LAB TESTS and PANELS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lab_tests (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    unit TEXT,
    ref_range_male TEXT,
    ref_range_female TEXT,
    ref_range_text TEXT,
    price NUMERIC(10,2),
    turnaround_hours INT DEFAULT 24,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lab_panels (
    panel_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tests JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert common tests
INSERT INTO lab_tests (code, name, category, unit, ref_range_male, ref_range_female, price, turnaround_hours) VALUES
('CBC', 'Complete Blood Count', 'Hematology', '%', '12-16', '12-16', 800, 4),
('HB', 'Hemoglobin', 'Hematology', 'g/dL', '13-17', '12-15', 350, 2),
('WBC', 'White Blood Cells', 'Hematology', 'x10^3/μL', '4-11', '4-11', 400, 2),
('PLT', 'Platelets', 'Hematology', 'x10^3/μL', '150-400', '150-400', 350, 2),
('GLU', 'Blood Glucose', 'Chemistry', 'mg/dL', '70-100', '70-100', 300, 1),
('CREAT', 'Creatinine', 'Chemistry', 'mg/dL', '0.7-1.3', '0.6-1.1', 400, 1),
('BUN', 'Blood Urea Nitrogen', 'Chemistry', 'mg/dL', '7-20', '7-20', 400, 1),
('URIC', 'Uric Acid', 'Chemistry', 'mg/dL', '3.4-7.0', '2.4-6.0', 450, 1),
('CHOL', 'Cholesterol', 'Chemistry', 'mg/dL', '<200', '<200', 600, 2),
('HDL', 'HDL Cholesterol', 'Chemistry', 'mg/dL', '>40', '>40', 500, 2),
('LDL', 'LDL Cholesterol', 'Chemistry', 'mg/dL', '<100', '<100', 500, 2),
('TG', 'Triglycerides', 'Chemistry', 'mg/dL', '<150', '<150', 500, 2),
('ALT', 'ALT/SGPT', 'Chemistry', 'U/L', '7-56', '7-56', 400, 1),
('AST', 'AST/SGOT', 'Chemistry', 'U/L', '10-40', '10-40', 400, 1),
('ALP', 'Alkaline Phosphatase', 'Chemistry', 'U/L', '44-147', '44-147', 450, 2),
('TP', 'Total Protein', 'Chemistry', 'g/dL', '6-8.3', '6-8.3', 400, 2),
('ALB', 'Albumin', 'Chemistry', 'g/dL', '3.5-5.5', '3.5-5.5', 400, 1),
('TBIL', 'Total Bilirubin', 'Chemistry', 'mg/dL', '0.1-1.2', '0.1-1.2', 450, 2),
('NA', 'Sodium', 'Electrolytes', 'mEq/L', '136-145', '136-145', 350, 1),
('K', 'Potassium', 'Electrolytes', 'mEq/L', '3.5-5.0', '3.5-5.0', 350, 1),
('CL', 'Chloride', 'Electrolytes', 'mEq/L', '98-106', '98-106', 350, 1),
('CO2', 'Bicarbonate', 'Electrolytes', 'mEq/L', '23-29', '23-29', 350, 1),
('CA', 'Calcium', 'Chemistry', 'mg/dL', '8.5-10.5', '8.5-10.5', 450, 2),
('MAG', 'Magnesium', 'Chemistry', 'mg/dL', '1.7-2.4', '1.7-2.4', 450, 2),
('PHOS', 'Phosphorus', 'Chemistry', 'mg/dL', '2.5-4.5', '2.5-4.5', 450, 2),
('TSH', 'TSH', 'Endocrine', 'μIU/mL', '0.4-4.0', '0.4-4.0', 800, 3),
('FT4', 'Free T4', 'Endocrine', 'ng/dL', '0.8-1.8', '0.8-1.8', 900, 3),
('HBA1C', 'HbA1c', 'Diabetes', '%', '<5.7', '<5.7', 1200, 3),
('CRP', 'C-Reactive Protein', 'Immunity', 'mg/L', '<3', '<3', 700, 2),
('RF', 'Rheumatoid Factor', 'Immunity', 'IU/mL', '<15', '<15', 600, 3),
('ASO', 'ASO Titer', 'Immunity', 'IU/mL', '<200', '<200', 600, 3),
('TYPHOID', 'Typhoid IGM', 'Serology', 'IgM', 'Negative', 'Negative', 850, 2),
('MALARIA', 'Malaria RAP', 'Parasitology', '', 'Negative', 'Negative', 500, 1),
('STOOL', 'Stool Microscopy', 'Parasitology', '', 'Negative', 'Negative', 400, 1),
('URINE', 'Urinalysis', 'Urine', '', 'Normal', 'Normal', 350, 1),
('HCG', 'Pregnancy Test', 'Fertility', '', 'Negative', 'Negative', 400, 1),
('HIV', 'HIV 1/2', 'Infectious', '', 'Negative', 'Negative', 0, 1),
('HBSAG', 'Hepatitis B Surface Ag', 'Infectious', '', 'Negative', 'Negative', 800, 2),
('HCV', 'Hepatitis C', 'Infectious', '', 'Negative', 'Negative', 1000, 3),
('VDRL', 'VDRL/RPR', 'Infectious', '', 'Non-reactive', 'Non-reactive', 600, 2);

-- Insert panels
INSERT INTO lab_panels (panel_id, name, tests) VALUES
('PANEL-BASIC', 'Basic Health', '["CBC","GLU","URINE"]'),
('PANEL-CBC', 'CBC Panel', '["CBC","HB","WBC","PLT"]'),
('PANEL-RENAL', 'Renal Function', '["CREAT","BUN","URIC","URINE"]'),
('PANEL-LFT', 'Liver Function', '["ALT","AST","ALP","TP","ALB","TBIL"]'),
('PANEL-LIPID', 'Lipid Profile', '["CHOL","HDL","LDL","TG"]'),
('PANEL-THYROID', 'Thyroid', '["TSH","FT4"]'),
('PANEL-DIABETES', 'Diabetes', '["GLU","HBA1C"]'),
('PANEL-ANA', 'Anemia', '["CBC","FER","B12","FOLATE"]'),
('PANEL-FERTILITY', 'Fertility', '["FSH","LH","PROLACTIN","E2","TESTO"]'),
('PANEL-MMP', 'Marriage Profile', '["CBC","GLU","HIV","HBSAG","HCV","VDRL"]');

-- ──────────────────────────────────────────────────────────────
-- 2. LAB RESULTS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES lab_requests(id),
    test_code TEXT NOT NULL,
    value NUMERIC(10,2),
    unit TEXT,
    flag TEXT,
    ref_range TEXT,
    recorded_by UUID,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- 3. USSD SESSIONS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ussd_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    phone TEXT,
    state TEXT,
    menu_level TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ussd_session ON ussd_sessions(session_id);

-- ──────────────────────────────────────────────────────────────
-- 4. COMMUNICATION SESSIONS (for WhatsApp bot state)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS communication_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    state TEXT DEFAULT 'start',
    context JSONB DEFAULT '{}',
    lang TEXT DEFAULT 'sw',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comm_session_phone ON communication_sessions(phone);

-- ──────────────────────────────────────────────────────────────
-- 5. ENHANCED INVENTORY: Expiry alerts
-- ────────────────────────────────────────────────��─────────────

ALTER TABLE inventory_forecast 
ADD COLUMN IF NOT EXISTS expiry_risk BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS transfer_suggested BOOLEAN DEFAULT false;

-- ──────────────────────────────────────────────────────────────
-- 6. REFERRAL: Additional tracking
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referral_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES fhir_resources(id),
    encounter_id UUID,
    diagnosis TEXT,
    treatment TEXT,
    outcome TEXT,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

PRINT 'Phase 2 migration completed: LIS + Communication tables';