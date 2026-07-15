-- ─── AfyaHero Schema v2 ─────────────────────────────────────────────────────
-- Migration: run this against your Supabase project SQL editor.
-- Adds clinical tables, pharmacy, AI audit, DAWA sessions, integrations, and
-- seeds initial data from the application's existing hardcoded mock arrays.
-- All tables use hospital_id-scoped RLS so multi-tenancy is enforced.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";   -- for fuzzy search on drugs

-- ─── WARDS ───────────────────────────────────────────────────────────────────
create table if not exists wards (
  id          uuid default uuid_generate_v4() primary key,
  hospital_id uuid references hospitals(id) not null,
  name        text not null,
  code        text,
  capacity    integer default 0,
  created_at  timestamptz default now() not null
);
alter table wards enable row level security;
create policy "Hospital owns wards"
  on wards for all using (auth.uid() = hospital_id);

-- ─── BEDS ────────────────────────────────────────────────────────────────────
create table if not exists beds (
  id          uuid default uuid_generate_v4() primary key,
  hospital_id uuid references hospitals(id) not null,
  ward_id     uuid references wards(id),
  bed_number  text not null,
  status      text default 'Available'
    check (status in ('Available','Occupied','Reserved','Cleaning','Maintenance')),
  patient_id  uuid references patients(id),
  assigned_at timestamptz,
  notes       text,
  created_at  timestamptz default now() not null
);
alter table beds enable row level security;
create policy "Hospital owns beds"
  on beds for all using (auth.uid() = hospital_id);

-- ─── ENCOUNTERS ──────────────────────────────────────────────────────────────
create table if not exists encounters (
  id              uuid default uuid_generate_v4() primary key,
  hospital_id     uuid references hospitals(id) not null,
  patient_id      uuid references patients(id) not null,
  practitioner_id uuid references staff(id),
  encounter_type  text default 'OPD'
    check (encounter_type in ('OPD','IPD','Emergency','Teleconsultation','ANC','MCH')),
  chief_complaint text,
  history         text,
  examination     text,
  assessment      text,
  plan            text,
  icd10_codes     text[],
  status          text default 'Open'
    check (status in ('Open','Closed','Referred')),
  started_at      timestamptz default now() not null,
  closed_at       timestamptz,
  created_at      timestamptz default now() not null
);
alter table encounters enable row level security;
create policy "Hospital owns encounters"
  on encounters for all using (auth.uid() = hospital_id);

-- ─── VITALS ──────────────────────────────────────────────────────────────────
create table if not exists vitals (
  id          uuid default uuid_generate_v4() primary key,
  hospital_id uuid references hospitals(id) not null,
  patient_id  uuid references patients(id) not null,
  encounter_id uuid references encounters(id),
  recorded_by uuid references staff(id),
  bp_systolic  integer,
  bp_diastolic integer,
  pulse        integer,
  temperature  numeric(4,1),
  spo2         integer,
  weight_kg    numeric(5,1),
  height_cm    numeric(5,1),
  rbs          numeric(5,1),       -- random blood sugar mmol/L
  muac_cm      numeric(4,1),       -- mid-upper arm circumference (paeds)
  notes        text,
  recorded_at  timestamptz default now() not null
);
alter table vitals enable row level security;
create policy "Hospital owns vitals"
  on vitals for all using (auth.uid() = hospital_id);

-- Create index for quickly fetching latest vitals per patient
create index if not exists idx_vitals_patient_time
  on vitals(patient_id, recorded_at desc);

-- ─── LAB ORDERS + RESULTS ────────────────────────────────────────────────────
-- Rename existing lab_requests → lab_orders for naming consistency
-- (if migrating from v1, run: alter table lab_requests rename to lab_orders)
create table if not exists lab_orders (
  id              uuid default uuid_generate_v4() primary key,
  hospital_id     uuid references hospitals(id) not null,
  patient_id      uuid references patients(id) not null,
  encounter_id    uuid references encounters(id),
  ordered_by      uuid references staff(id),
  test_name       text not null,
  test_category   text,                    -- Haematology, Biochemistry, Microbiology, etc.
  panel_code      text,                    -- KEMSA/NHIF panel code
  priority        text default 'Routine'
    check (priority in ('Routine','Urgent','Stat')),
  sample_type     text,                    -- Blood, Urine, Swab, CSF
  sample_collected_at timestamptz,
  status          text default 'Pending'
    check (status in ('Pending','Collected','Processing','Resulted','Verified','Cancelled')),
  notes           text,
  created_at      timestamptz default now() not null
);
alter table lab_orders enable row level security;
create policy "Hospital owns lab_orders"
  on lab_orders for all using (auth.uid() = hospital_id);

create table if not exists lab_results (
  id              uuid default uuid_generate_v4() primary key,
  hospital_id     uuid references hospitals(id) not null,
  lab_order_id    uuid references lab_orders(id) not null,
  patient_id      uuid references patients(id) not null,
  parameter       text not null,
  value           text not null,
  unit            text,
  ref_range_low   numeric,
  ref_range_high  numeric,
  ref_range_text  text,
  flag            text check (flag in ('Normal','Low','High','Critical Low','Critical High','Abnormal')),
  verified_by     uuid references staff(id),
  verified_at     timestamptz,
  notes           text,
  created_at      timestamptz default now() not null
);
alter table lab_results enable row level security;
create policy "Hospital owns lab_results"
  on lab_results for all using (auth.uid() = hospital_id);

-- ─── FORMULARY ───────────────────────────────────────────────────────────────
create table if not exists formulary (
  id                  uuid default uuid_generate_v4() primary key,
  hospital_id         uuid references hospitals(id),  -- NULL = system-wide KEML entry
  generic_name        text not null,
  brand_name          text,
  drug_class          text,
  category            text,
  formulations        text[],                         -- e.g. {Tablet,Syrup,Injectable}
  adult_dose          text,
  paed_dose           text,
  route               text[],                         -- {Oral,IV,IM,SC}
  contraindications   text[],
  interactions        text[],
  controlled          boolean default false,
  on_nhif_list        boolean default false,
  nhif_benefit_code   text,
  kemsa_code          text,
  kemsa_price_kes     numeric(10,2),
  facility_price_kes  numeric(10,2),
  generic_available   boolean default true,
  status              text default 'Active'
    check (status in ('Active','Discontinued','Shortage')),
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null
);
alter table formulary enable row level security;
-- System-wide drugs visible to all; hospital-specific only to that hospital
create policy "View formulary"
  on formulary for select
  using (hospital_id is null or auth.uid() = hospital_id);
create policy "Hospital manages own formulary"
  on formulary for all
  using (auth.uid() = hospital_id);

-- Full-text + fuzzy search on drug names
create index if not exists idx_formulary_generic_trgm
  on formulary using gin(generic_name gin_trgm_ops);
create index if not exists idx_formulary_brand_trgm
  on formulary using gin(brand_name gin_trgm_ops);

-- ─── INVENTORY ───────────────────────────────────────────────────────────────
create table if not exists inventory (
  id                  uuid default uuid_generate_v4() primary key,
  hospital_id         uuid references hospitals(id) not null,
  formulary_id        uuid references formulary(id),
  generic_name        text not null,
  batch_number        text,
  lot_number          text,
  pack_size           text,
  current_stock       integer not null default 0,
  unit                text not null,
  reorder_level       integer default 0,
  maximum_level       integer,
  unit_cost_kes       numeric(10,2),
  selling_price_kes   numeric(10,2),
  expiry_date         date,
  supplier            text,
  last_received_at    timestamptz,
  last_received_qty   integer,
  status              text default 'Adequate'
    check (status in ('Adequate','Low','Critical','Out of Stock','Expiring Soon','Expired')),
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null
);
alter table inventory enable row level security;
create policy "Hospital owns inventory"
  on inventory for all using (auth.uid() = hospital_id);

-- Auto-compute status based on stock vs reorder level
create or replace function update_inventory_status()
returns trigger language plpgsql as $$
begin
  if new.current_stock = 0 then
    new.status := 'Out of Stock';
  elsif new.expiry_date is not null and new.expiry_date < (now() + interval '90 days') then
    new.status := 'Expiring Soon';
  elsif new.reorder_level > 0 and new.current_stock <= (new.reorder_level * 0.5) then
    new.status := 'Critical';
  elsif new.reorder_level > 0 and new.current_stock <= new.reorder_level then
    new.status := 'Low';
  else
    new.status := 'Adequate';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger inventory_status_update
  before insert or update on inventory
  for each row execute function update_inventory_status();

-- ─── PRESCRIPTIONS ───────────────────────────────────────────────────────────
create table if not exists prescriptions (
  id              uuid default uuid_generate_v4() primary key,
  hospital_id     uuid references hospitals(id) not null,
  patient_id      uuid references patients(id) not null,
  encounter_id    uuid references encounters(id),
  prescribed_by   uuid references staff(id),
  dispensed_by    uuid references staff(id),
  insurance_type  text default 'Cash'
    check (insurance_type in ('NHIF','Cash','AAR','Jubilee','UAP','Private')),
  nhif_auth_code  text,
  total_kes       numeric(10,2) default 0,
  status          text default 'Pending'
    check (status in ('Pending','Dispensing','Dispensed','Partial','On Hold','Cancelled')),
  notes           text,
  prescribed_at   timestamptz default now() not null,
  dispensed_at    timestamptz,
  created_at      timestamptz default now() not null
);
alter table prescriptions enable row level security;
create policy "Hospital owns prescriptions"
  on prescriptions for all using (auth.uid() = hospital_id);

create table if not exists prescription_items (
  id              uuid default uuid_generate_v4() primary key,
  prescription_id uuid references prescriptions(id) not null,
  formulary_id    uuid references formulary(id),
  inventory_id    uuid references inventory(id),
  generic_name    text not null,
  dose            text not null,
  frequency       text not null,          -- e.g. BD, TDS, QDS, Nocte, PRN
  route           text default 'Oral',
  duration_days   integer,
  quantity        integer not null,
  dispensed_qty   integer default 0,
  unit_price_kes  numeric(10,2),
  total_price_kes numeric(10,2),
  substitution_allowed boolean default true,
  notes           text,
  created_at      timestamptz default now() not null
);
alter table prescription_items enable row level security;
create policy "Via prescription"
  on prescription_items for all
  using (
    exists (
      select 1 from prescriptions p
      where p.id = prescription_id and p.hospital_id = auth.uid()
    )
  );

-- ─── MEDICATION ADMINISTRATION RECORD (MAR) ──────────────────────────────────
create table if not exists medications_mar (
  id                  uuid default uuid_generate_v4() primary key,
  hospital_id         uuid references hospitals(id) not null,
  patient_id          uuid references patients(id) not null,
  prescription_item_id uuid references prescription_items(id),
  bed_id              uuid references beds(id),
  ward_id             uuid references wards(id),
  drug_name           text not null,
  dose                text not null,
  route               text not null,
  frequency           text not null,
  scheduled_time      timestamptz not null,
  status              text default 'Due'
    check (status in ('Due','Given','Overdue','Held','Refused','Missed')),
  given_by            uuid references staff(id),
  given_at            timestamptz,
  hold_reason         text,
  refuse_reason       text,
  notes               text,
  created_at          timestamptz default now() not null
);
alter table medications_mar enable row level security;
create policy "Hospital owns MAR"
  on medications_mar for all using (auth.uid() = hospital_id);

create index if not exists idx_mar_patient_scheduled
  on medications_mar(patient_id, scheduled_time);
create index if not exists idx_mar_status_scheduled
  on medications_mar(status, scheduled_time) where status in ('Due','Overdue');

-- ─── NHIF CLAIMS ─────────────────────────────────────────────────────────────
create table if not exists nhif_claims (
  id                uuid default uuid_generate_v4() primary key,
  hospital_id       uuid references hospitals(id) not null,
  patient_id        uuid references patients(id) not null,
  encounter_id      uuid references encounters(id),
  prescription_id   uuid references prescriptions(id),
  nhif_member_no    text,
  nhif_id_no        text,
  preauth_code      text,
  scheme_type       text,                  -- NHIF scheme code
  claim_amount_kes  numeric(10,2),
  approved_amount_kes numeric(10,2),
  claim_reference   text,
  status            text default 'Draft'
    check (status in ('Draft','Submitted','Pending','Approved','Partial','Rejected','Appealed')),
  rejection_reason  text,
  submitted_at      timestamptz,
  adjudicated_at    timestamptz,
  created_at        timestamptz default now() not null
);
alter table nhif_claims enable row level security;
create policy "Hospital owns NHIF claims"
  on nhif_claims for all using (auth.uid() = hospital_id);

-- ─── FACILITY REGISTRATIONS (from Sprint 0) ──────────────────────────────────
create table if not exists facility_registrations (
  id                  uuid default uuid_generate_v4() primary key,
  facility_name       text not null,
  facility_type       text not null,
  ownership           text not null,
  county              text not null,
  sub_county          text,
  physical_address    text,
  phone               text,
  facility_email      text,
  mfl_code            text,
  mfl_verified        boolean default false,
  nhif_contracted     boolean default false,
  admin_name          text not null,
  admin_title         text,
  admin_email         text not null,
  admin_phone         text,
  services            text[],
  wards               text[],
  insurance           text[],
  bed_count           integer,
  operating_hours     text,
  status              text default 'pending'
    check (status in ('pending','under_review','approved','rejected')),
  reviewed_by         text,
  reviewed_at         timestamptz,
  reviewer_notes      text,
  admin_user_id       uuid references auth.users,
  submitted_at        timestamptz default now() not null,
  created_at          timestamptz default now() not null
);
alter table facility_registrations enable row level security;
create policy "Applicant views own registration"
  on facility_registrations for select
  using (auth.uid() = admin_user_id);
create policy "Service role manages all registrations"
  on facility_registrations for all
  using (auth.role() = 'service_role');

-- ─── KEMSA CATALOGUE ─────────────────────────────────────────────────────────
create table if not exists kemsa_catalogue (
  id              uuid default uuid_generate_v4() primary key,
  kemsa_code      text unique not null,
  generic_name    text not null,
  formulation     text,
  pack_size       text,
  unit            text,
  price_kes       numeric(10,2),
  category        text,
  essential_list  boolean default false,
  availability    text default 'Available'
    check (availability in ('Available','Limited','Out of Stock','Discontinued')),
  last_synced_at  timestamptz default now() not null
);
-- KEMSA catalogue is system-wide, readable by all authenticated users
alter table kemsa_catalogue enable row level security;
create policy "Authenticated users read KEMSA catalogue"
  on kemsa_catalogue for select
  using (auth.role() = 'authenticated');
create policy "Service role syncs KEMSA"
  on kemsa_catalogue for all
  using (auth.role() = 'service_role');

create index if not exists idx_kemsa_generic_trgm
  on kemsa_catalogue using gin(generic_name gin_trgm_ops);

-- ─── AI AUDIT LOG ────────────────────────────────────────────────────────────
create table if not exists ai_audit_log (
  id              uuid default uuid_generate_v4() primary key,
  hospital_id     uuid references hospitals(id),
  user_id         uuid references auth.users,
  user_role       text not null,
  user_subrole    text,
  user_name       text,
  ai_type         text not null,          -- diagnostic, analytics, drug_interaction, etc.
  dawa_persona    text,                   -- DAWA-Clinical, DAWA-Rx, DAWA-Ward, etc.
  provider_used   text,                   -- hf, groq, gemini, openai, anthropic, deepseek
  model_used      text,
  prompt_tokens   integer,
  completion_tokens integer,
  latency_ms      integer,
  success         boolean not null,
  error_message   text,
  input_summary   text,                   -- truncated to 200 chars, no PII
  output_summary  text,                   -- truncated to 200 chars
  action_taken    text,                   -- for DAWA write actions (JSON)
  patient_id      uuid references patients(id),
  created_at      timestamptz default now() not null
);
alter table ai_audit_log enable row level security;

-- Admin sees all logs for their hospital
create policy "Admin reads all hospital AI logs"
  on ai_audit_log for select
  using (
    exists (
      select 1 from auth.users u
      where u.id = auth.uid()
      and u.raw_user_meta_data->>'role' = 'admin'
      and (hospital_id is null or hospital_id = auth.uid())
    )
  );

-- Clinician sees only their own logs
create policy "Clinician reads own AI logs"
  on ai_audit_log for select
  using (auth.uid() = user_id);

-- Service role inserts on behalf of any user
create policy "Service role inserts AI logs"
  on ai_audit_log for insert
  with check (auth.role() = 'service_role');

-- Retention: auto-delete logs older than 365 days (run as cron or pg_cron job)
-- select cron.schedule('delete-old-ai-logs', '0 2 * * *',
--   $$delete from ai_audit_log where created_at < now() - interval '365 days'$$);

create index if not exists idx_ai_audit_user
  on ai_audit_log(user_id, created_at desc);
create index if not exists idx_ai_audit_hospital
  on ai_audit_log(hospital_id, created_at desc);
create index if not exists idx_ai_audit_type
  on ai_audit_log(ai_type, created_at desc);

-- ─── DAWA SESSIONS ───────────────────────────────────────────────────────────
create table if not exists dawa_sessions (
  id              uuid default uuid_generate_v4() primary key,
  hospital_id     uuid references hospitals(id),
  user_id         uuid references auth.users not null,
  persona         text not null,          -- DAWA-Clinical, DAWA-Rx, DAWA-Ward, DAWA-Lab, DAWA-Ops
  patient_id      uuid references patients(id),
  messages        jsonb not null default '[]'::jsonb,
                  -- [{role: 'user'|'dawa', content: string, timestamp: iso, lang: 'en'|'sw'|'sheng'}]
  context_snapshot jsonb,                 -- DB context at session start (beds, stock, etc.)
  session_closed  boolean default false,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null,
  expires_at      timestamptz default (now() + interval '8 hours') not null
);
alter table dawa_sessions enable row level security;
create policy "User manages own DAWA sessions"
  on dawa_sessions for all
  using (auth.uid() = user_id);
create policy "Service role manages DAWA sessions"
  on dawa_sessions for all
  using (auth.role() = 'service_role');

create index if not exists idx_dawa_sessions_user
  on dawa_sessions(user_id, created_at desc);

-- Auto-expire sessions
create or replace function expire_dawa_sessions()
returns trigger language plpgsql as $$
begin
  update dawa_sessions
  set session_closed = true
  where expires_at < now() and session_closed = false;
  return null;
end;
$$;

-- ─── SEED DATA ───────────────────────────────────────────────────────────────
-- Seed the KEML (Kenya Essential Medicines List) formulary entries
-- from the application's existing hardcoded pharmacy/formulary mock data

insert into formulary (
  generic_name, brand_name, drug_class, category, formulations,
  adult_dose, paed_dose, route, contraindications, interactions,
  on_nhif_list, controlled, generic_available, facility_price_kes
) values
  ('Amoxicillin + Clavulanate 625mg', 'Augmentin', 'Penicillin + Beta-lactamase inhibitor',
   'Antibiotic', ARRAY['Tablet'], '625mg every 8-12 hours × 7-10 days', 'Paediatric: weight-based (Augmentin 312mg/5mL syrup)',
   ARRAY['Oral'], ARRAY['Penicillin allergy','Severe hepatic impairment'],
   ARRAY['Warfarin (increased bleeding risk)','Methotrexate'],
   true, false, true, 380),
  ('Artemether + Lumefantrine 20/120mg', 'Coartem', 'Artemisinin combination therapy',
   'Antimalarial', ARRAY['Tablet'], '4 tablets BD × 3 days (body weight ≥35 kg)',
   'Weight-based: <15 kg 1 tab, 15–24 kg 2 tabs, 25–34 kg 3 tabs (BD × 3 days)',
   ARRAY['Oral'], ARRAY['QTc prolongation','Severe malaria (use IV artesunate)'],
   ARRAY['QTc-prolonging agents (avoid)','CYP3A4 inhibitors'],
   true, false, false, 560),
  ('Metformin 500/850/1000mg', 'Glucophage', 'Biguanide',
   'Antidiabetic', ARRAY['Tablet'], '500-850mg BD-TDS with meals; max 2g/day',
   'Not routinely used <10 years', ARRAY['Oral'],
   ARRAY['eGFR <30 mL/min','Contrast media procedures','Severe hepatic impairment'],
   ARRAY['Alcohol (lactic acidosis risk)','IV contrast (hold 48h)'],
   true, false, true, 85),
  ('Amlodipine 5/10mg', 'Norvasc', 'Calcium channel blocker (dihydropyridine)',
   'Antihypertensive', ARRAY['Tablet'], '5mg once daily; may increase to 10mg after 2 weeks',
   'Hypertension: 2.5-5mg once daily', ARRAY['Oral'],
   ARRAY['Cardiogenic shock','Severe aortic stenosis'],
   ARRAY['CYP3A4 inhibitors (ketoconazole,ritonavir)','Simvastatin >20mg'],
   true, false, true, 35),
  ('Ibuprofen 200/400/600mg', 'Brufen', 'NSAID',
   'Analgesic/Anti-inflammatory', ARRAY['Tablet','Syrup'], '400-600mg TDS with food; max 2.4g/day',
   '5-10 mg/kg every 6-8 hours (syrup 100mg/5mL)', ARRAY['Oral'],
   ARRAY['Peptic ulcer','CKD','NSAID hypersensitivity','Third trimester pregnancy'],
   ARRAY['Warfarin','ACE inhibitors','Diuretics','Aspirin'],
   true, false, true, 25),
  ('Azithromycin 250/500mg', 'Zithromax', 'Macrolide antibiotic',
   'Antibiotic', ARRAY['Tablet','Syrup'], '500mg once daily × 3 days (or 500mg day 1 then 250mg × 4 days)',
   '10 mg/kg day 1 then 5 mg/kg × 4 days; max 500mg/day', ARRAY['Oral'],
   ARRAY['QTc prolongation','Macrolide hypersensitivity'],
   ARRAY['QTc-prolonging agents','Antacids reduce absorption(space 1h)'],
   true, false, true, 120),
  ('Furosemide 40/80mg', 'Lasix', 'Loop diuretic',
   'Diuretic', ARRAY['Tablet','Injectable'], '40-80mg once or BD; max 600mg/day in divided doses',
   '1-2 mg/kg/dose every 12-24 hours', ARRAY['Oral','IV','IM'],
   ARRAY['Anuria','Severe electrolyte depletion'],
   ARRAY['Aminoglycosides (ototoxicity)','Digoxin (hypokalaemia toxicity)','Lithium'],
   true, false, true, 15),
  ('Paracetamol 500mg / 1g', 'Panadol', 'Analgesic/Antipyretic',
   'Analgesic', ARRAY['Tablet','Syrup','Suppository','Injectable'], '500mg-1g every 4-6 hours; max 4g/day',
   '15 mg/kg every 4-6 hours (syrup 120mg/5mL)', ARRAY['Oral','IV','Rectal'],
   ARRAY['Severe hepatic impairment'],
   ARRAY['Warfarin (high-dose)','Alcohol (hepatotoxicity)'],
   true, false, true, 10)
on conflict do nothing;

-- Seed inventory items (from pharmacy/inventory/page.tsx hardcoded mock)
-- NOTE: hospital_id will need to be set to actual facility UUID in production.
-- These are left with hospital_id = null as template entries — copy per facility on onboarding.
-- In production, run: insert into inventory (...) select ... where hospital_id = '<facility_uuid>';
