-- Phase 3: Clinical AI - Disease Priors, Guidelines, Scribe
-- Migration: 20260411000000_phase3_clinical_ai.sql

-- ──────────────────────────────────────────────────────────────
-- 1. EPIDEMIOLOGICAL PRIORS - Kenya disease prevalence
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS epi_priors (
    id SERIAL PRIMARY KEY,
    icd10_code TEXT NOT NULL,
    condition_name TEXT NOT NULL,
    prevalence_rate NUMERIC(5,2),
    incidence_per_1000 NUMERIC(6,2),
    age_group TEXT,
    gender TEXT,
    region TEXT DEFAULT 'Kenya',
    season_peak TEXT,
    risk_factors TEXT[],
    severity_distribution JSONB,
    typical_treatment TEXT,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Kenya-specific disease priors
INSERT INTO epi_priors (icd10_code, condition_name, prevalence_rate, age_group, season_peak, typical_treatment, severity_distribution) VALUES
('O9A.3', 'Malaria (P. falciparum)', 27.5, 'all', 'Apr-Oct', 'ALu 20/120mg x24', '{"mild": 85, "moderate": 12, "severe": 3}'),
('A00', 'Cholera', 0.8, 'all', 'Jan-Mar', 'ORS + Zinc + Antibiotics', '{"mild": 70, "moderate": 25, "severe": 5}'),
('A01', 'Typhoid Fever', 1.2, '5-15', 'year-round', 'Azithromycin 1g x5d', '{"mild": 60, "moderate": 30, "severe": 10}'),
('A02', 'Food Poisoning', 2.5, 'all', 'year-round', 'Supportive + Antibiotics', '{"mild": 90, "moderate": 8, "severe": 2}'),
('B24', 'HIV/AIDS', 4.5, '15-49', 'year-round', 'ART (TLD)', '{"asymptomatic": 70, "symptomatic": 25, "AIDS": 5}'),
('E11', 'Type 2 Diabetes', 3.1, '25-60', 'year-round', 'Metformin + Lifestyle', '{"controlled": 40, "uncontrolled": 45, "complications": 15}'),
('I10', 'Hypertension', 4.4, '35-70', 'year-round', 'Amlodipine 5mg', '{"stage1": 50, "stage2": 35, "crisis": 15}'),
('J45', 'Asthma', 2.8, '5-40', 'Jan-Mar', 'Salbutamol + Budesonide', '{"intermittent": 55, "persistent": 40, "severe": 5}'),
('K50', 'Diarrhea (non-cholera)', 8.2, '<5', 'year-round', 'ORS + Zinc', '{"viral": 65, "bacterial": 25, "parasitic": 10}'),
('N39.0', 'Urinary Tract Infection', 4.1, '18-45', 'year-round', 'Nitrofurantoin 100mg x7d', '{"uncomplicated": 80, "recurrent": 15, "complicated": 5}'),
('M54.5', 'Lower Back Pain', 6.3, '25-55', 'year-round', 'NSAIDs + PT', '{"acute": 50, "chronic": 45, "radiculopathy": 5}'),
('A75', 'Rickettsial Diseases', 0.6, 'all', 'year-round', 'Doxycycline 100mg x7d', '{"mild": 70, "moderate": 25, "severe": 5}'),
('B54', 'Visceral Leishmaniasis', 0.1, '<15', 'Nov-Feb', 'Amphotericin B', '{"early": 30, "established": 50, "advanced": 20}'),
('A90', 'Dengue Fever', 0.3, 'all', 'year-round', 'Paracetamol + Supportive', '{"classic": 85, "hemorrhagic": 10, "shock": 5}'),
('L30', 'Skin Infections', 5.2, 'all', 'year-round', 'Topical + Antibiotics', '{"bacterial": 60, "fungal": 30, "viral": 10}');

-- ──────────────────────────────────────────────────────────────
-- 2. CLINICAL GUIDELINES - RAG chunk storage
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guideline_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    source_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    topic TEXT,
    keywords TEXT[],
    age_group TEXT,
    severity TEXT,
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for similarity search (pgvector)
-- CREATE INDEX ON guideline_chunks USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX idx_guideline_topic ON guideline_chunks(topic);
CREATE INDEX idx_guideline_source ON guideline_chunks(source);

-- Insert sample guidelines
INSERT INTO guideline_chunks (source, source_type, title, topic, content, keywords) VALUES
('MoH Kenya STD/STI Guidelines 2023', 'MoH Protocol', 'STI Management', 'sti', 
 '1. Syndrome-based diagnosis for urethral discharge, vaginal discharge, genital ulcer
 2. Urethral discharge: Ceftriaxone 250mg IM + Azithromycin 1g oral STAT
 3. Vaginal discharge: Metronidazole 2g oral STAT + Fluconazole 150mg oral STAT
 4. Genital ulcer: Benzathine penicillin 2.4MU IM + Azithromycin 1g oral', 
 ARRAY['sti','std','discharge','ulcer','treatment']),
('WHO IMCI', 'WHO Protocol', 'Childhood Illnesses', 'pediatrics',
 '1. Assess: cough, diarrhea, fever, ear problems, malnutrition
 2. Classify using color chart: Pink (urgent), Yellow (follow-up), Green (home)
 3. Treat: Antibiotics, ORS, Zinc, Antimalarials per weight
 4. Counsel: Feeding, fluids, when to return', 
 ARRAY['child','imci','pneumonia','diarrhea','malaria','under5']),
('KDPA Clinical Practice Guidelines', 'KDPA', 'Adult Hypertension', 'hypertension',
 '1. BP classification: Normal (<130/80), Stage1 (130-139/80-89), Stage2 (>=140/90)
 2. Lifestyle: DASH diet, 150min exercise, <5g salt, stop smoking
 3. First line: ACEi/ARB or CCB
 4. Target: <130/80 for most, <140/90 for elderly', 
 ARRAY['bp','hypertension','kdpa','cardiovascular']),
('MoH Kenya NCD Guidelines', 'MoH Protocol', 'Diabetes Management', 'diabetes',
 '1. Diagnosis: FPG >=126mg/dL or 2hr OGTT >=200mg/dL
 2. Classification: Type1 (insulin), Type2 (oral), Gestational
 3. First line: Metformin 500mg BID
 4. Monitoring: HbA1c q3months, target <7%', 
 ARRAY['diabetes','ncd','glucose','metformin']);

-- ──────────────────────────────────────────────────────────────
-- 3. SCRIBE SESSIONS - AI consultation recording
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scribe_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID REFERENCES encounters(id),
    patient_id UUID REFERENCES patients(id),
    practitioner_id UUID,
    audio_url TEXT,
    transcript JSONB,
    soap_note JSONB,
    ai_analysis JSONB,
    icd10_suggestions TEXT[],
    medication_suggestions TEXT[],
    status TEXT DEFAULT 'recording',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- 4. ORDER DICTIONARY - Clinical terminology
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_dictionary (
    code TEXT PRIMARY KEY,
    term_en TEXT NOT NULL,
    term_sw TEXT NOT NULL,
    term_ki TEXT,
    category TEXT,
    icd10 TEXT,
    loinc TEXT,
    is_active BOOLEAN DEFAULT true
);

INSERT INTO order_dictionary (code, term_en, term_sw, category, icd10, loinc) VALUES
('CBC', 'Complete Blood Count', 'Kupima damu kamili', 'lab', 'D64.9', '58410-2'),
('URINE', 'Urinalysis', 'Mkojo', 'lab', 'N39.0', '24331-1'),
('GLU', 'Blood Glucose', 'Mawakala wa sukari', 'lab', 'R73.9', '2339-0'),
('MALARIA', 'Malaria Test', 'Homa ya malari', 'lab', 'O9A.3', '24410-0'),
('STOOL', 'Stool Microscopy', 'K kotoran', 'lab', 'K59.0', '24478-0'),
('XRAY', 'Chest X-Ray', 'Picha ya mraba wa kifua', 'imaging', 'J18.9', '36643-5'),
('ECG', 'Electrocardiogram', 'ECG', 'imaging', 'I49.5', '34534-8'),
('USG', 'Abdominal Ultrasound', 'Ultrasound ya tumbo', 'imaging', 'R10.9', '28752-7');

-- ──────────────────────────────────────────────────────────────
-- 5. DRUG SAFETY - Interaction checker
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS drug_interactions (
    id SERIAL PRIMARY KEY,
    drug1_sha_code TEXT NOT NULL,
    drug2_sha_code TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT NOT NULL,
    swahili_warning TEXT NOT NULL,
    mechanism TEXT
);

CREATE TABLE IF NOT EXISTS drug_contraindications (
    id SERIAL PRIMARY KEY,
    sha_code TEXT NOT NULL,
    condition_code TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT NOT NULL,
    swahili_warning TEXT NOT NULL
);

-- Sample interactions (to be expanded)
INSERT INTO drug_interactions (drug1_sha_code, drug2_sha_code, severity, description, swahili_warning, mechanism) VALUES
('D001', 'D002', 'major', 'Rash risk when combined', 'Usionyeshe dawa mbili hizi pamoja - hatari ya allergy', 'Cross-reactivity risk'),
('MET', 'GLIP', 'moderate', 'Hypoglycemia risk', 'Asihi ya sukari - angalia kiwango cha sukari', 'Additive glucose lowering');

-- ──────────────────────────────────────────────────────────────
-- 6. VIDEO ROOMS - Teleconsultation
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS video_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code TEXT UNIQUE NOT NULL,
    patient_id UUID REFERENCES patients(id),
    practitioner_id UUID,
    mode TEXT DEFAULT 'video',
    status TEXT DEFAULT 'waiting',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    recording_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_room_code ON video_rooms(room_code);
CREATE INDEX idx_video_room_patient ON video_rooms(patient_id);

-- ──────────────────────────────────────────────────────────────
-- 7. LAB ANALYZERS - Device integration
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lab_analyzers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID REFERENCES hospitals(id),
    device_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL,
    manufacturer TEXT,
    model TEXT,
    serial_number TEXT,
    status TEXT DEFAULT 'online',
    last_reading JSONB,
    last_sync TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lab_analyzer_facility ON lab_analyzers(facility_id);

-- ──────────────────────────────────────────────────────────────
-- 8. MOBILE DEVICE PAIRING - BLE devices
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mobile_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    device_type TEXT NOT NULL,
    device_id TEXT NOT NULL,
    device_name TEXT,
    last_reading JSONB,
    last_sync TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mobile_device_patient ON mobile_devices(patient_id);
CREATE INDEX idx_mobile_device_type ON mobile_devices(device_type);

-- ──────────────────────────────────────────────────────────────
-- 9. OFFLINE QUEUE - Mesh network sync
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS offline_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID REFERENCES hospitals(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    operation TEXT NOT NULL,
    payload JSONB NOT NULL,
    synced BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

CREATE INDEX idx_offline_queue_synced ON offline_queue(synced, created_at);

PRINT 'Phase 3 migration completed: Clinical AI tables';