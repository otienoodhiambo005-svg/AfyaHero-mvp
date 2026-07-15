-- Phase 1: Pharmacy Formulary + Stock + i18n Tables
-- Migration: 20260411000000_phase1_pharmacy_i18n.sql

-- ──────────────────────────────────────────────────────────────
-- 1. FORMULARY: Drugs + SHA codes + pack info
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS formulary (
    id SERIAL PRIMARY KEY,
    sha_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    strength TEXT,
    form TEXT,
    unit_ucum TEXT DEFAULT '{capsule}',
    pack_size INT DEFAULT 100,
    unit_price NUMERIC(10,2),
    sha_price NUMERIC(10,2),
    requires_auth BOOLEAN DEFAULT false,
    teleconsult_allowed BOOLEAN DEFAULT true,
    loinc_code TEXT,
    chw_formulary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_formulary_sha_code ON formulary(sha_code);
CREATE INDEX idx_formulary_active ON formulary(is_active) WHERE is_active = true;

-- ──────────────────────────────────────────────────────────────
-- 2. STOCK LOTS: Batches per facility
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    sha_code TEXT NOT NULL REFERENCES formulary(sha_code),
    batch_number TEXT NOT NULL,
    expiry_date DATE NOT NULL,
    qty_on_hand INT DEFAULT 0,
    qty_allocated INT DEFAULT 0,
    unit_cost NUMERIC(10,2),
    received_at TIMESTAMPTZ DEFAULT NOW(),
    supplier TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(facility_id, sha_code, batch_number)
);

CREATE INDEX idx_stock_lots_facility ON stock_lots(facility_id, sha_code, expiry_date);
CREATE INDEX idx_stock_lots_expiry ON stock_lots(expiry_date) WHERE qty_on_hand > 0;

-- ──────────────────────────────────────────────────────────────
-- 3. I18N KEYS: UI translations
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS i18n_keys (
    key TEXT PRIMARY KEY,
    en TEXT NOT NULL,
    sw TEXT NOT NULL,
    ki TEXT,
    luo TEXT,
    kam TEXT,
    som TEXT,
    sheng TEXT,
    context TEXT DEFAULT 'button',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert core UI keys
INSERT INTO i18n_keys (key, en, sw, context) VALUES
('btn.save', 'Save', 'Hifadhi', 'button'),
('btn.cancel', 'Cancel', 'Ghairi', 'button'),
('btn.submit', 'Submit', 'Wasilisha', 'button'),
('btn.edit', 'Edit', 'Hariri', 'button'),
('btn.delete', 'Delete', 'Futa', 'button'),
('btn.search', 'Search', 'Tafuta', 'button'),
('btn.add', 'Add', 'Ongeza', 'button'),
('btn.close', 'Close', 'Funga', 'button'),
('btn.confirm', 'Confirm', 'Thibitisha', 'button'),
('btn.back', 'Back', 'Rudi', 'button'),
('error.required', 'Required', 'Inahitaji', 'error'),
('error.invalid', 'Invalid', 'Batili', 'error'),
('error.network', 'Network error', 'Hitilafu ya mtandao', 'error'),
('error.unauthorized', 'Unauthorized', 'Hai ruhusiwi', 'error'),
('menu.dashboard', 'Dashboard', 'Dashibodi', 'menu'),
('menu.patients', 'Patients', 'Wagonjwa', 'menu'),
('menu.appointments', 'Appointments', 'Miadi', 'menu'),
('menu.pharmacy', 'Pharmacy', 'Duka la Dawa', 'menu'),
('menu.lab', 'Lab', 'Maabara', 'menu'),
('menu.beds', 'Beds', 'Vilala', 'menu'),
('menu.referrals', 'Referrals', 'Rufaa', 'menu'),
('menu.claims', 'Claims', 'Madai', 'menu'),
('menu.settings', 'Settings', 'Mpangilio', 'menu'),
('status.pending', 'Pending', 'Inasubiri', 'status'),
('status.active', 'Active', 'Inaendelea', 'status'),
('status.completed', 'Completed', 'Imemalizika', 'status'),
('status.cancelled', 'Cancelled', 'Imeghairishwa', 'status'),
('status.waiting', 'Waiting', 'Inangoja', 'status'),
('status.in Progress', 'In Progress', 'Inashughulikiwa', 'status'),
('label.name', 'Name', 'Jina', 'label'),
('label.phone', 'Phone', 'Simu', 'label'),
('label.date', 'Date', 'Tarehe', 'label'),
('label.time', 'Time', 'Saa', 'label'),
('label.notes', 'Notes', 'Maelezo', 'label'),
('label.drug', 'Drug', 'Dawa', 'label'),
('label.dose', 'Dose', 'Kiwango', 'label'),
('label.quantity', 'Quantity', 'Kiasi', 'label'),
('label.status', 'Status', 'Hali', 'label');

-- ──────────────────────────────────────────────────────────────
-- 4. CLINICAL I18N: Clinical content translations
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinical_i18n (
    code TEXT NOT NULL,
    type TEXT NOT NULL,
    en TEXT NOT NULL,
    sw TEXT,
    ki TEXT,
    luo TEXT,
    kam TEXT,
    som TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (code, type)
);

-- Insert common conditions (ICD-10)
INSERT INTO clinical_i18n (code, type, en, sw) VALUES
('E11', 'condition', 'Diabetes Mellitus', 'Kisukari'),
('I10', 'condition', 'Hypertension', 'Mgongo wa damu'),
('J06.9', 'condition', 'Upper Respiratory Infection', 'Maambukizi ya njia ya hewa'),
('K50', 'condition', 'Crohn Disease', 'Ugua wa Crohn'),
('N39.0', 'condition', 'Urinary Tract Infection', 'Maambukizi ya mkojo'),
('J45', 'condition', 'Asthma', 'Pumu'),
('B24', 'condition', 'HIV/AIDS', 'UKIMWI'),
('O9A.3', 'condition', 'Malaria', 'Homa ya malari'),
('M54.5', 'condition', 'Lower Back Pain', 'Maumivu ya mgongo wa chini'),
('R50.9', 'condition', 'Fever', 'Homa');

-- Insert common drug instructions
INSERT INTO clinical_i18n (code, type, en, sw) VALUES
('D001', 'instruction', 'Take 1 tablet three times daily', 'Meza 1 mara 3 kwa siku'),
('D002', 'instruction', 'Take 1 tablet twice daily', 'Meza 1 mara 2 kwa siku'),
('D003', 'instruction', 'Take 1 tablet once daily', 'Meza 1 kwa siku'),
('D004', 'instruction', 'Take 1 capsule three times daily', 'Meza 1 kapsula mara 3 kwa siku'),
('D005', 'instruction', 'Take 5ml three times daily', 'Meza 5ml mara 3 kwa siku'),
('D006', 'instruction', 'Apply twice daily', 'Paka mara 2 kwa siku'),
('D007', 'instruction', 'Take with food', 'Chukua na Chakula'),
('D008', 'instruction', 'Take on empty stomach', 'Chukua kabla ya kula'),
('D009', 'instruction', 'Complete full course', 'Maliza dozi yote'),
('D010', 'instruction', 'Avoid alcohol', 'Epuka pombe');

-- ──────────────────────────────────────────────────────────────
-- 5. TTS VOICES: Voice model mapping
-- ───────────────────────────────────���──────────────────────────

CREATE TABLE IF NOT EXISTS tts_voices (
    lang TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    sample_rate INT DEFAULT 22050,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO tts_voices (lang, model, sample_rate) VALUES
('sw', 'vits-sw-ke-female', 22050),
('en', 'vits-en-us-female', 22050),
('ki', 'vits-ki-ke-male', 22050),
('luo', 'vits-luo-ke-female', 22050);

-- ──────────────────────────────────────────────────────────────
-- 6. UPDATE PROFILES: Language preferences
-- ──────────────────────────────────────────────────────────────

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS lang_ui TEXT DEFAULT 'sw',
ADD COLUMN IF NOT EXISTS lang_patient TEXT DEFAULT 'sw',
ADD COLUMN IF NOT EXISTS lang_voice TEXT DEFAULT 'sw';

-- ──────────────────────────────────────────────────────────────
-- 7. INVENTORY CONSUMPTION: Daily rollup
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_consumption (
    facility_id UUID NOT NULL REFERENCES hospitals(id),
    sha_code TEXT NOT NULL,
    day DATE NOT NULL,
    qty_dispensed INT DEFAULT 0,
    qty_expired INT DEFAULT 0,
    qty_received INT DEFAULT 0,
    PRIMARY KEY (facility_id, sha_code, day)
);

CREATE INDEX idx_inventory_consumption_day ON inventory_consumption(day DESC);

-- ──────────────────────────────────────────────────────────────
-- 8. INVENTORY FORECAST: Predictions
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_forecast (
    facility_id UUID NOT NULL REFERENCES hospitals(id),
    sha_code TEXT NOT NULL,
    forecast_date DATE NOT NULL,
    predicted_daily_use NUMERIC(10,2),
    days_to_stockout INT,
    reorder_point INT,
    suggested_order_qty INT,
    model_version TEXT DEFAULT 'ewma-v1',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (facility_id, sha_code, forecast_date)
);

-- ──────────────────────────────────────────────────────────────
-- 9. INVENTORY AI LOG: AI insights
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_ai_log (
    id BIGSERIAL PRIMARY KEY,
    facility_id UUID NOT NULL REFERENCES hospitals(id),
    sha_code TEXT,
    insight_type TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    action_taken TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_ai_log_facility ON inventory_ai_log(facility_id, created_at DESC);
CREATE INDEX idx_inventory_ai_log_severity ON inventory_ai_log(severity, created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- 10. BED STATUS: Materialized bed view
-- ────���─���───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bed_status (
    location_id UUID PRIMARY KEY,
    facility_id UUID NOT NULL REFERENCES hospitals(id),
    ward_name TEXT,
    bed_number TEXT NOT NULL,
    bed_type TEXT DEFAULT 'general',
    status TEXT DEFAULT 'free',
    patient_id UUID,
    encounter_id UUID,
    admitted_at TIMESTAMPTZ,
    expected_discharge DATE,
    UNIQUE(facility_id, bed_number)
);

CREATE INDEX idx_bed_status_facility ON bed_status(facility_id, status);
CREATE INDEX idx_bed_status_ward ON bed_status(facility_id, ward_name);

-- ──────────────────────────────────────────────────────────────
-- 11. CLAIMS SUMMARY: Materialized view
-- ──────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS claims_summary AS
SELECT
    h.id AS facility_id,
    DATE_TRUNC('day', sc.created_at) AS day,
    sc.status AS claim_status,
    COUNT(*) AS count_claims,
    SUM(sc.amount_claimed) AS total_billed,
    SUM(COALESCE(sc.amount_approved, 0)) AS total_paid,
    SUM(sc.amount_claimed) - SUM(COALESCE(sc.amount_approved, 0)) AS outstanding
FROM shif_claims sc
JOIN hospitals h ON sc.hospital_id = h.id
GROUP BY h.id, DATE_TRUNC('day', sc.created_at), sc.status;

-- Index for dashboard performance
CREATE INDEX IF NOT EXISTS idx_claims_summary_facility ON claims_summary(facility_id, day DESC);

-- ──────────────────────────────────────────────────────────────
-- 12. COMMUNICATION QUEUE: WhatsApp/USSD queue
-- ────────────────────────────────────���─────────────────────────

CREATE TABLE IF NOT EXISTS communication_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    phone TEXT NOT NULL,
    channel TEXT DEFAULT 'whatsapp',
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_communication_queue_status ON communication_queue(status, created_at);

-- ──────────────────────────────────────────────────────────────
-- 13. FHIR RESOURCES: Extended storage
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fhir_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type TEXT NOT NULL,
    fhir_id TEXT NOT NULL,
    facility_id UUID REFERENCES hospitals(id),
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(resource_type, fhir_id)
);

CREATE INDEX idx_fhir_resource_type ON fhir_resources(resource_type);
CREATE INDEX idx_fhir_facility ON fhir_resources(facility_id, resource_type);
CREATE INDEX idx_fhir_subject ON fhir_resources((data->>'subject')) WHERE resource_type IN ('MedicationRequest', 'MedicationDispense', 'Task');

-- ──────────────────────────────────────────────────────────────
-- TRIGGER: rx_stock_check
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION rx_stock_check()
RETURNS TRIGGER AS $$
DECLARE drug TEXT; qty_req INT; qty_avail INT; facility UUID;
BEGIN
    IF NEW.resource_type != 'MedicationRequest' OR NEW.data->>'status' != 'active' THEN
        RETURN NEW;
    END IF;

    drug := NEW.data->'medicationCodeableConcept'->'coding'->0->>'code';
    facility := split_part(NEW.data->'requester'->>'reference', '/', 2)::uuid;
    qty_req := (NEW.data->'dosageInstruction'->0->'timing'->'repeat'->>'count')::int *
               (NEW.data->'dosageInstruction'->0->'doseAndRate'->0->'doseQuantity'->>'value')::int;

    SELECT COALESCE(SUM(qty_on_hand - qty_allocated), 0) INTO qty_avail
    FROM stock_lots 
    WHERE facility_id = facility AND sha_code = drug AND expiry_date > CURRENT_DATE;

    IF qty_avail < qty_req THEN
        INSERT INTO fhir_resources(resource_type, fhir_id, data) VALUES (
            'Task', gen_random_uuid()::text,
            jsonb_build_object(
                'resourceType', 'Task',
                'status', 'requested',
                'intent', 'order',
                'code', jsonb_build_object('text', 'dispense-oos'),
                'priority', 'urgent',
                'description', 'Out of stock: ' || drug || ' need ' || qty_req || ' have ' || qty_avail,
                'for', NEW.data->'subject',
                'basedOn', jsonb_build_array(jsonb_build_object('reference', 'MedicationRequest/' || NEW.fhir_id))
            )
        );
        RAISE WARNING 'E108: Insufficient stock for %: need % have %', drug, qty_req, qty_avail;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rx_stock_check_tg
AFTER INSERT OR UPDATE ON fhir_resources
FOR EACH ROW EXECUTE FUNCTION rx_stock_check();

-- ──────────────────────────────────────────────────────────────
-- TRIGGER: dispense_stock_decrement (FEFO)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION dispense_stock_decrement()
RETURNS TRIGGER AS $$
DECLARE drug TEXT; qty INT; facility UUID; lot RECORD; remaining INT;
BEGIN
    IF NEW.resource_type != 'MedicationDispense' OR NEW.data->>'status' != 'completed' THEN
        RETURN NEW;
    END IF;

    drug := NEW.data->'medicationCodeableConcept'->'coding'->0->>'code';
    qty := (NEW.data->'quantity'->>'value')::int;
    facility := split_part(NEW.data->'performer'->0->'actor'->>'reference', '/', 2)::uuid;
    remaining := qty;

    FOR lot IN SELECT * FROM stock_lots
              WHERE facility_id = facility AND sha_code = drug AND qty_on_hand > 0
              ORDER BY expiry_date ASC
    LOOP
        EXIT WHEN remaining <= 0;
        IF lot.qty_on_hand >= remaining THEN
            UPDATE stock_lots SET qty_on_hand = qty_on_hand - remaining WHERE id = lot.id;
            remaining := 0;
        ELSE
            remaining := remaining - lot.qty_on_hand;
            UPDATE stock_lots SET qty_on_hand = 0 WHERE id = lot.id;
        END IF;
    END LOOP;

    IF remaining > 0 THEN
        RAISE EXCEPTION 'E109: Negative stock % after dispense', drug;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dispense_stock_decrement_tg
AFTER INSERT ON fhir_resources
FOR EACH ROW EXECUTE FUNCTION dispense_stock_decrement();

-- ──────────────────────────────────────────────────────────────
-- TRIGGER: Referral notification
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION referral_notify()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.resource_type != 'Task' OR NEW.data->>'status' != 'accepted' THEN
        RETURN NEW;
    END IF;
    IF NEW.data->'code'->>'text' != 'referral' THEN
        RETURN NEW;
    END IF;

    INSERT INTO communication_queue(phone, message, channel, status)
    SELECT p.phone, 'Rufaa imekubaliwa: ' || pt.name || ' na ' || h.name, 'whatsapp', 'pending'
    FROM fhir_resources sr
    JOIN patients pt ON pt.id = split_part(sr.data->'subject'->>'reference', '/', 2)::uuid
    JOIN hospitals h ON h.id = split_part(sr.data->'performer'->0->>'reference', '/', 2)::uuid
    JOIN profiles p ON p.id = split_part(sr.data->'requester'->>'reference', '/', 2)::uuid
    WHERE sr.fhir_id = split_part(NEW.data->'basedOn'->0->>'reference', '/', 2)
    AND sr.resource_type = 'ServiceRequest';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER referral_notify_tg
AFTER UPDATE ON fhir_resources
FOR EACH ROW EXECUTE FUNCTION referral_notify();

-- ──────────────────────────────────────────────────────────────
-- RLS POLICIES
-- ──────────────────────────────────────────────────────────────

ALTER TABLE formulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE i18n_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_i18n ENABLE ROW LEVEL SECURITY;
ALTER TABLE tts_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_ai_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bed_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE fhir_resources ENABLE ROW LEVEL SECURITY;

-- Anyone can read translations
CREATE POLICY i18n_read ON i18n_keys FOR SELECT TO authenticated USING (true);
CREATE POLICY clinical_i18n_read ON clinical_i18n FOR SELECT TO authenticated USING (true);
CREATE POLICY tts_voices_read ON tts_voices FOR SELECT TO authenticated USING (true);

-- Facility isolation for stock
CREATE POLICY stock_lots_facility ON stock_lots FOR ALL TO authenticated
USING (facility_id IN (SELECT hospital_id FROM profiles WHERE id = auth.uid()));

-- Claims summary for finance
CREATE POLICY claims_summary_read ON claims_summary FOR SELECT TO authenticated
USING (facility_id IN (SELECT hospital_id FROM profiles WHERE id = auth.uid())
       AND current_setting('app.settings.role', true) IN ('finance', 'admin'));

PRINT 'Phase 1 migration completed: pharmacy + i18n tables';