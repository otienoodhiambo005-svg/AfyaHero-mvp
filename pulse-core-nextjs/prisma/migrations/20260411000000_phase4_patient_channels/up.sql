-- Phase 4: Patient Channels - CHW, USSD, WhatsApp Bot
-- Migration: 20260411000000_phase4_patient_channels.sql

-- ──────────────────────────────────────────────────────────────
-- 1. CHW PROFILES - Community Health Workers
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chw_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id),
    facility_id UUID REFERENCES hospitals(id),
    catchment_area TEXT,
    village TEXT,
    sub_location TEXT,
    phone_number TEXT,
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chw_facility ON chw_profiles(facility_id);
CREATE INDEX idx_chw_area ON chw_profiles(catchment_area);

-- ──────────────────────────────────────────────────────────────
-- 2. CHW KIT INVENTORY - Per CHW stock
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chw_kits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chw_id UUID REFERENCES chw_profiles(id),
    sha_code TEXT NOT NULL,
    current_qty INT DEFAULT 0,
    min_level INT DEFAULT 10,
    max_level INT DEFAULT 50,
    last_restock TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chw_kit_chw ON chw_kits(chw_id);

-- ──────────────────────────────────────────────────────────────
-- 3. PATIENT ONBOARDING - "Jiandikishe" flow
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    channel TEXT DEFAULT 'whatsapp',
    state TEXT DEFAULT 'start',
    step_data JSONB DEFAULT '{}',
    lang TEXT DEFAULT 'sw',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_onboarding_phone ON onboarding_sessions(phone);
CREATE INDEX idx_onboarding_state ON onboarding_sessions(state);

-- Onboarding states:
-- start → name → dob → gender → phone → location → facility → confirm → complete

-- ──────────────────────────────────────────────────────────────
-- 4. WhatsApp BOT MENUS - Interactive menus
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bot_menu_items (
    id SERIAL PRIMARY KEY,
    menu_id TEXT NOT NULL,
    label_en TEXT NOT NULL,
    label_sw TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT,
    parent_id INT REFERENCES bot_menu_items(id),
    sort_order INT DEFAULT 0
);

-- Main menu
INSERT INTO bot_menu_items (menu_id, label_en, label_sw, action, sort_order) VALUES
('main', 'Register', 'Jisajili', 'state:register', 1),
('main', 'Appointments', 'Miadi', 'action:get_appointments', 2),
('main', 'Lab Results', 'Matokeo ya Lab', 'action:get_lab_results', 3),
('main', 'My Medicines', 'Dawa Zangu', 'action:get_medications', 4),
('main', 'Pay Bill', 'Lipa Bill', 'action:pay_bill', 5),
('main', 'Help', 'Msaada', 'action:help', 6);

-- ──────────────────────────────────────────────────────────────
-- 5. PAYMENTS - M-Pesa Integration
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mpesa_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT UNIQUE,
    phone TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    reference TEXT,
    status TEXT DEFAULT 'pending',
    transaction_type TEXT,
    result_code TEXT,
    result_desc TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_mpesa_phone ON mpesa_transactions(phone);
CREATE INDEX idx_mpesa_status ON mpesa_transactions(status);

-- ──────────────────────────────────────────────────────────────
-- 6. OFFLINE SYNC - Mesh network data
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID REFERENCES hospitals(id),
    device_id TEXT NOT NULL,
    sync_type TEXT NOT NULL,
    records_sent INT DEFAULT 0,
    records_received INT DEFAULT 0,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_facility ON sync_logs(facility_id);
CREATE INDEX idx_sync_status ON sync_logs(status);

-- ──────────────────────────────────────────────────────────────
-- 7. REFERRAL TRACKING - CHW to facility
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chw_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chw_id UUID REFERENCES chw_profiles(id),
    patient_name TEXT NOT NULL,
    patient_phone TEXT,
    symptoms TEXT NOT NULL,
    urgency TEXT DEFAULT 'normal',
    facility_id UUID REFERENCES hospitals(id),
    status TEXT DEFAULT 'pending',
    facility_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chw_referral_chw ON chw_referrals(chw_id);
CREATE INDEX idx_chw_referral_facility ON chw_referrals(facility_id);

-- ──────────────────────────────────────────────────────────────
-- 8. HEALTH TIPS - Broadcast to patients
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS health_tips (
    id SERIAL PRIMARY KEY,
    title_en TEXT NOT NULL,
    title_sw TEXT NOT NULL,
    content_en TEXT,
    content_sw TEXT NOT NULL,
    category TEXT,
    target_audience TEXT,
    send_via TEXT DEFAULT 'whatsapp',
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample health tips
INSERT INTO health_tips (title_en, title_sw, content_sw, category) VALUES
('Hand Washing', 'Kunawa Mikono', 'Kunawa mikono kila mara baada ya choo, kabla ya kula, na baada ya kugusa vitu vya umma. Hii inazuia magonjwa mengi.', 'prevention'),
('Malaria Prevention', 'Kuzuia Malaria', 'Jishauri na wapi moshi, tumia vyandarua, na kunywa dawa ya kuzuilia kama unaenda maeneo ya malaria.', 'prevention'),
('Nutrition', 'Chakula Bora', 'Kula mbogamboga, matunda, na protini kila siku. Mgonjwa anaweza kulawali kutokuwa na nguvu.', 'nutrition'),
('Medication Adherence', 'Kunywa Dawa Vizuri', 'Kunywa dawa kama ulivyoagiziwa daktari. Usiache dawa hata unajiona vizuri.', 'treatment');

PRINT 'Phase 4 migration completed: Patient channels tables';