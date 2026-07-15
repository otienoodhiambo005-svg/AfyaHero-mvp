-- AfyaHero Supabase Schema

-- Create hospitals table
create table hospitals (
  id uuid references auth.users not null primary key,
  name text not null,
  specialisation text,
  location text,
  license_number text unique,
  email text,
  accepted_insurances text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for hospitals
alter table hospitals enable row level security;

-- Policies for hospitals
create policy "Hospitals can view their own profile."
  on hospitals for select
  using ( auth.uid() = id );

create policy "Hospitals can update their own profile."
  on hospitals for update
  using ( auth.uid() = id );

-- Create staff table
create table staff (
  id uuid default uuid_generate_v4() primary key,
  hospital_id uuid references hospitals(id) not null,
  name text not null,
  role text check (role in ('Administrator', 'Doctor', 'Nurse', 'Staff', 'Pharmacist', 'Lab Technician')),
  department text,
  status text default 'Off Duty' check (status in ('On Duty', 'Off Duty', 'On Leave')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create patients table
create table patients (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null, -- Linked to auth user
  hospital_id uuid references hospitals(id), -- Nullable for independent registration
  name text not null,
  gender text check (gender in ('M', 'F', 'Other')),
  dob date not null,
  id_number text unique,
  phone text,
  insurance_provider text,
  insurance_id text,
  status text default 'Stable',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create appointments table
create table appointments (
  id uuid default uuid_generate_v4() primary key,
  hospital_id uuid references hospitals(id) not null,
  patient_id uuid references patients(id) not null,
  practitioner_id uuid references staff(id),
  appointment_date timestamp with time zone not null,
  type text,
  status text default 'Pending' check (status in ('Confirmed', 'Pending', 'Cancelled', 'Completed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create lab_requests table
create table lab_requests (
  id uuid default uuid_generate_v4() primary key,
  hospital_id uuid references hospitals(id) not null,
  patient_id uuid references patients(id) not null,
  test_name text not null,
  priority text check (priority in ('Routine', 'Urgent', 'Stat')),
  status text default 'Pending' check (status in ('Pending', 'In Progress', 'Completed', 'Cancelled')),
  results text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for all
alter table staff enable row level security;
alter table patients enable row level security;
alter table appointments enable row level security;
alter table lab_requests enable row level security;

-- Policies for hospital-owned data
create policy "Hospitals can manage their own staff."
  on staff for all using ( auth.uid() = hospital_id );

create policy "Hospitals can manage their own patients."
  on patients for all using ( auth.uid() = hospital_id );

create policy "Hospitals can manage their own appointments."
  on appointments for all using ( auth.uid() = hospital_id );

create policy "Hospitals can manage their own lab requests."
  on lab_requests for all using ( auth.uid() = hospital_id );

-- Patient Policies
create policy "Patients can view their own profile."
  on patients for select
  using ( auth.uid() = user_id );

create policy "Patients can update their own profile."
  on patients for update
  using ( auth.uid() = user_id );

-- Create pharmacy_inventory table
create table pharmacy_inventory (
  id uuid default uuid_generate_v4() primary key,
  hospital_id uuid references hospitals(id) not null,
  medication_name text not null,
  stock_quantity integer default 0,
  unit text,
  unit_price decimal(10,2),
  expiry_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create prescriptions table
create table prescriptions (
  id uuid default uuid_generate_v4() primary key,
  hospital_id uuid references hospitals(id) not null,
  patient_id uuid references patients(id) not null,
  doctor_id uuid references staff(id),
  medication_name text not null,
  dosage text,
  frequency text,
  status text default 'Pending' check (status in ('Pending', 'Dispensed', 'Cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table pharmacy_inventory enable row level security;
alter table prescriptions enable row level security;

-- Policies
create policy "Hospitals can manage their own pharmacy inventory."
  on pharmacy_inventory for all using ( auth.uid() = hospital_id );

create policy "Hospitals can manage their own prescriptions."
  on prescriptions for all using ( auth.uid() = hospital_id );
-- Create lab_inventory table
create table lab_inventory (
  id uuid default uuid_generate_v4() primary key,
  hospital_id uuid references hospitals(id) not null,
  name text not null,
  stock_quantity integer default 0,
  unit text,
  min_stock_level integer default 10,
  storage_temp text,
  status text default 'Optimal',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create clinical_vitals table
create table clinical_vitals (
  id uuid default uuid_generate_v4() primary key,
  hospital_id uuid references hospitals(id) not null,
  patient_id uuid references patients(id) not null,
  recorded_by uuid references staff(id),
  temp_c decimal(4,1),
  blood_pressure text,
  heart_rate integer,
  resp_rate integer,
  spo2 integer,
  recorded_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create consultations table
create table consultations (
  id uuid default uuid_generate_v4() primary key,
  hospital_id uuid references hospitals(id) not null,
  patient_id uuid references patients(id) not null,
  practitioner_id uuid references staff(id) not null,
  notes text,
  diagnosis text,
  prescription_id uuid references prescriptions(id),
  status text default 'Completed',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for new tables
alter table lab_inventory enable row level security;
alter table clinical_vitals enable row level security;
alter table consultations enable row level security;

-- Policies
create policy "Hospitals can manage their own lab inventory."
  on lab_inventory for all using ( auth.uid() = hospital_id );

create policy "Hospitals can manage clinical vitals."
  on clinical_vitals for all using ( auth.uid() = hospital_id );

create policy "Hospitals can manage consultations."
  on consultations for all using ( auth.uid() = hospital_id );

-- Create reminders table
create table reminders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  type text check (type in ('Medication', 'Appointment', 'Exercise', 'Other')),
  title text not null,
  reminder_time timestamp with time zone not null,
  is_completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table reminders enable row level security;
create policy "Users can manage their own reminders."
  on reminders for all using ( auth.uid() = user_id );

-- Create health_education table
create table health_education (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  category text not null,
  content text,
  media_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table health_education enable row level security;
create policy "Everyone can view health education."
  on health_education for select using ( true );

-- Create hospital_queue table (used by useRealtimeQueue hook)
create table hospital_queue (
  id uuid default uuid_generate_v4() primary key,
  hospital_id uuid references hospitals(id) not null,
  patient_id uuid references patients(id),
  patient_name text not null,
  ticket_number text not null,
  priority text default 'normal' check (priority in ('emergency', 'urgent', 'normal', 'low')),
  status text default 'waiting' check (status in ('waiting', 'in_progress', 'completed', 'cancelled', 'transferred')),
  triage_severity text check (triage_severity in ('high', 'medium', 'low')),
  chief_complaint text,
  assigned_to text,
  room text,
  wait_minutes integer default 0,
  arrived_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table hospital_queue enable row level security;
create policy "Hospitals can manage their own queue."
  on hospital_queue for all using ( auth.uid() = hospital_id );

-- Create reception_checkins table for patient intake/registration
create table reception_checkins (
  id uuid default uuid_generate_v4() primary key,
  hospital_id uuid references hospitals(id) not null,
  patient_id uuid references patients(id),
  -- Quick registration fields (for walk-in patients not yet in system)
  patient_name text not null,
  phone text,
  id_number text,
  insurance_provider text,
  insurance_id text,
  visit_reason text,
  visit_type text default 'OPD' check (visit_type in ('OPD', 'Emergency', 'Scheduled', 'Follow-up', 'Lab Only', 'Pharmacy Only')),
  payment_method text default 'Cash' check (payment_method in ('Cash', 'Insurance', 'NHIF', 'Credit', 'Waiver')),
  checked_in_at timestamp with time zone default timezone('utc'::text, now()) not null,
  checked_out_at timestamp with time zone,
  status text default 'Checked In' check (status in ('Checked In', 'In Queue', 'In Consultation', 'Checked Out', 'No Show')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table reception_checkins enable row level security;
create policy "Hospitals can manage their own checkins."
  on reception_checkins for all using ( auth.uid() = hospital_id );

-- Create handover_notes table for shift handovers
create table handover_notes (
  id uuid default uuid_generate_v4() primary key,
  hospital_id uuid references hospitals(id) not null,
  shift_date date not null default current_date,
  shift_type text check (shift_type in ('Morning', 'Afternoon', 'Night')),
  handing_over_staff_id uuid references staff(id),
  receiving_staff_id uuid references staff(id),
  handing_over_name text,
  receiving_name text,
  department text,
  summary text,
  pending_actions jsonb default '[]',
  critical_patients jsonb default '[]',
  medications_due jsonb default '[]',
  status text default 'Draft' check (status in ('Draft', 'Submitted', 'Acknowledged')),
  submitted_at timestamp with time zone,
  acknowledged_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table handover_notes enable row level security;
create policy "Hospitals can manage their own handover notes."
  on handover_notes for all using ( auth.uid() = hospital_id );

-- ═══════════════════════════════════════════════════════════════════════════
-- AFYAHERO RBAC PROFILES — v3.0
-- Staff profiles with role-based access control and approval workflow
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop old staff table references (replaced by profiles)
-- alter table staff ... (kept for backward compat)

-- Staff profiles table — one row per authenticated staff member
create table if not exists profiles (
  id            uuid references auth.users on delete cascade primary key,
  email         text not null unique,
  full_name     text not null,
  title         text,
  role          text not null check (role in ('reception','medical','lab','pharmacy','admin')),
  department    text,
  staff_id      text,
  hospital_code text,
  hospital_id   uuid references hospitals(id),
  phone         text,
  avatar_url    text,
  status        text not null default 'pending'
                  check (status in ('pending','active','suspended','rejected')),
  approved_by   uuid references auth.users,
  approved_at   timestamp with time zone,
  last_login    timestamp with time zone,
  created_at    timestamp with time zone default timezone('utc', now()) not null,
  updated_at    timestamp with time zone default timezone('utc', now()) not null
);

alter table profiles enable row level security;

-- Each staff member can read/update their own profile
create policy "profiles_select_own"
  on profiles for select
  using ( auth.uid() = id );

create policy "profiles_update_own"
  on profiles for update
  using ( auth.uid() = id )
  with check ( auth.uid() = id );

-- Admins (role='admin') can read ALL profiles in their hospital
create policy "profiles_admin_select_all"
  on profiles for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.status = 'active'
    )
  );

-- Admins can update status (approve/suspend/reject) for staff in their hospital
create policy "profiles_admin_update_status"
  on profiles for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.status = 'active'
    )
  );

-- Any authenticated user can insert their own profile (self-registration)
create policy "profiles_insert_own"
  on profiles for insert
  with check ( auth.uid() = id );

-- ── Trigger: auto-update updated_at ────────────────────────────────────────
create or replace function handle_profiles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure handle_profiles_updated_at();

-- ── Trigger: create profile on new auth user ───────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'reception')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- RECEPTION TABLES
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists reception_checkins (
  id              uuid default gen_random_uuid() primary key,
  hospital_id     uuid references hospitals(id),
  patient_id      uuid references patients(id),
  token_number    integer not null,
  service_type    text default 'OPD' check (service_type in ('OPD','Lab','Pharmacy','Theatre','Triage')),
  priority        text default 'normal' check (priority in ('normal','urgent','critical')),
  chief_complaint text,
  triage_notes    text,
  checked_in_by   uuid references profiles(id),
  checked_in_at   timestamp with time zone default now(),
  status          text default 'waiting' check (status in ('waiting','in-consult','done','admitted','referred')),
  updated_at      timestamp with time zone default now()
);

alter table reception_checkins enable row level security;

create policy "checkins_hospital_access"
  on reception_checkins for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.hospital_id = reception_checkins.hospital_id
        and p.status = 'active'
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- HOSPITAL QUEUE
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists hospital_queue (
  id              uuid default gen_random_uuid() primary key,
  hospital_id     uuid references hospitals(id),
  checkin_id      uuid references reception_checkins(id),
  patient_name    text not null,
  patient_id      uuid references patients(id),
  token_number    integer not null,
  service_type    text default 'OPD',
  priority        text default 'normal',
  status          text default 'waiting',
  called_at       timestamp with time zone,
  completed_at    timestamp with time zone,
  assigned_to     uuid references profiles(id),
  created_at      timestamp with time zone default now()
);

alter table hospital_queue enable row level security;

create policy "queue_hospital_access"
  on hospital_queue for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.hospital_id = hospital_queue.hospital_id
        and p.status = 'active'
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- HANDOVER NOTES
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists handover_notes (
  id              uuid default gen_random_uuid() primary key,
  hospital_id     uuid references hospitals(id),
  from_staff      uuid references profiles(id),
  to_staff        uuid references profiles(id),
  shift_date      date not null default current_date,
  shift_type      text check (shift_type in ('morning','afternoon','night')),
  critical_patients jsonb default '[]',
  pending_actions   jsonb default '[]',
  medications_due   jsonb default '[]',
  general_notes   text,
  ai_summary      text,
  status          text default 'draft' check (status in ('draft','submitted','acknowledged')),
  submitted_at    timestamp with time zone,
  acknowledged_at timestamp with time zone,
  created_at      timestamp with time zone default now()
);

alter table handover_notes enable row level security;

create policy "handover_medical_access"
  on handover_notes for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.hospital_id = handover_notes.hospital_id
        and p.role = 'medical'
        and p.status = 'active'
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- HEALTH EDUCATION FEED SOURCE CONFIG
-- Admin-managed trusted feed sources and priorities for live dashboard updates
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists health_education_feed_sources (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  url text not null,
  role text default 'all' check (role in ('all', 'reception', 'medical', 'lab', 'pharmacy', 'admin')),
  region_codes text[] default '{}',
  priority integer default 70,
  enabled boolean default true,
  created_by uuid references profiles(id),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create unique index if not exists health_education_feed_sources_url_idx on health_education_feed_sources (url);

alter table health_education_feed_sources enable row level security;

create policy "health_feed_sources_select_authenticated"
  on health_education_feed_sources for select
  using (auth.uid() is not null);

create policy "health_feed_sources_admin_manage"
  on health_education_feed_sources for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.status = 'active'
    )
  );

create or replace function handle_health_feed_sources_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists health_feed_sources_updated_at on health_education_feed_sources;
create trigger health_feed_sources_updated_at
  before update on health_education_feed_sources
  for each row execute procedure handle_health_feed_sources_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- LAB REQUESTS & RESULTS
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists lab_requests (
  id              uuid default gen_random_uuid() primary key,
  hospital_id     uuid references hospitals(id),
  lab_id          text not null,  -- e.g. LAB-2024-001
  patient_id      uuid references patients(id),
  ordered_by      uuid references profiles(id),
  test_name       text not null,
  panel           text,
  sample_type     text,
  priority        text default 'routine' check (priority in ('routine','urgent','STAT')),
  status          text default 'ordered' check (status in ('ordered','sample-collected','processing','completed','verified','rejected')),
  ordered_at      timestamp with time zone default now(),
  collected_at    timestamp with time zone,
  completed_at    timestamp with time zone,
  verified_by     uuid references profiles(id),
  verified_at     timestamp with time zone,
  results         jsonb default '[]',
  abnormal        boolean default false,
  critical        boolean default false,
  notes           text
);

alter table lab_requests enable row level security;

create policy "lab_requests_access"
  on lab_requests for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.hospital_id = lab_requests.hospital_id
        and p.status = 'active'
        and p.role in ('lab','medical','admin')
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- PRESCRIPTIONS & DISPENSING
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists prescriptions (
  id              uuid default gen_random_uuid() primary key,
  hospital_id     uuid references hospitals(id),
  rx_number       text not null,
  patient_id      uuid references patients(id),
  prescribed_by   uuid references profiles(id),
  prescribed_at   timestamp with time zone default now(),
  status          text default 'pending' check (status in ('pending','dispensing','dispensed','partial','cancelled','on-hold')),
  items           jsonb not null default '[]',
  notes           text,
  insurance       text,
  dispensed_by    uuid references profiles(id),
  dispensed_at    timestamp with time zone,
  priority        text default 'normal' check (priority in ('normal','urgent'))
);

alter table prescriptions enable row level security;

create policy "prescriptions_medical_write"
  on prescriptions for insert
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'medical' and p.status = 'active'
    )
  );

create policy "prescriptions_pharmacy_dispensing"
  on prescriptions for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('pharmacy','medical','admin')
        and p.hospital_id = prescriptions.hospital_id
        and p.status = 'active'
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- TELECONSULTATION APPOINTMENTS & WAITROOM
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists teleconsult_appointments (
  id uuid default gen_random_uuid() primary key,
  hospital_id uuid references hospitals(id),
  appointment_code text not null unique,
  patient_name text not null,
  appointment_time text not null,
  mode text not null check (mode in ('Video','Call','Text')),
  clinician_name text not null,
  status text not null default 'Scheduled' check (status in ('Scheduled','Confirmed','In Progress','Completed')),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists teleconsult_waitroom (
  id uuid default gen_random_uuid() primary key,
  hospital_id uuid references hospitals(id),
  waitroom_code text not null unique,
  patient_name text not null,
  waiting_for text not null,
  wait_minutes integer default 0,
  mode text not null check (mode in ('Video','Call','Text')),
  priority text not null default 'Normal' check (priority in ('Normal','Urgent')),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table teleconsult_appointments enable row level security;
alter table teleconsult_waitroom enable row level security;

create policy "teleconsult_appointments_access"
  on teleconsult_appointments for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.hospital_id = teleconsult_appointments.hospital_id
        and p.status = 'active'
        and p.role in ('medical','admin')
    )
  );

create policy "teleconsult_waitroom_access"
  on teleconsult_waitroom for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.hospital_id = teleconsult_waitroom.hospital_id
        and p.status = 'active'
        and p.role in ('medical','admin')
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- AUDIT LOGS — immutable clinical action trail
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists audit_logs (
  id              uuid default gen_random_uuid() primary key,
  action          text not null,
  actor_id        uuid,
  actor_email     text,
  actor_role      text,
  hospital_id     uuid references hospitals(id),
  resource_type   text,
  resource_id     text,
  detail          jsonb,
  ip_address      text,
  created_at      timestamp with time zone default now() not null
);

create index if not exists audit_logs_action_idx on audit_logs (action);
create index if not exists audit_logs_actor_idx on audit_logs (actor_id);
create index if not exists audit_logs_resource_idx on audit_logs (resource_type, resource_id);
create index if not exists audit_logs_created_idx on audit_logs (created_at desc);

alter table audit_logs enable row level security;

-- Only admins can read audit logs; service-role key writes (bypasses RLS)
create policy "audit_logs_admin_read"
  on audit_logs for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.status = 'active'
    )
  );

-- No UPDATE or DELETE policies — audit logs are immutable
-- INSERT is done via service-role key (bypasses RLS)

-- ═══════════════════════════════════════════════════════════════════════════
-- SCHEMA COMPATIBILITY PATCH (IDEMPOTENT)
-- Ensures all tables/columns used by the current app exist even when older
-- sections of this file were applied first.
-- ═══════════════════════════════════════════════════════════════════════════

-- Modern clinical form builder
create table if not exists specialty_forms (
  id          text primary key,
  specialty   text not null,
  name        text not null,
  fields      jsonb not null default '[]'::jsonb,
  created_by  uuid default auth.uid(),
  created_at  timestamp with time zone default now() not null,
  updated_at  timestamp with time zone default now() not null
);

create index if not exists specialty_forms_specialty_idx on specialty_forms (specialty);
alter table specialty_forms enable row level security;

drop policy if exists specialty_forms_owner_access on specialty_forms;
create policy specialty_forms_owner_access
  on specialty_forms for all
  using (auth.uid() = created_by or auth.role() = 'service_role')
  with check (auth.uid() = created_by or auth.role() = 'service_role');

create or replace function handle_specialty_forms_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists specialty_forms_updated_at on specialty_forms;
create trigger specialty_forms_updated_at
  before update on specialty_forms
  for each row execute procedure handle_specialty_forms_updated_at();

-- Bed operations table used by realtime bed census UI
create table if not exists hospital_beds (
  id                 uuid default gen_random_uuid() primary key,
  hospital_id        uuid references hospitals(id),
  ward_id            uuid,
  ward_name          text not null default 'General Ward',
  bed_number         text not null,
  status             text not null default 'available'
                     check (status in ('available','occupied','reserved','maintenance','cleaning')),
  patient_id         uuid references patients(id),
  patient_name       text,
  admitted_at        timestamp with time zone,
  expected_discharge timestamp with time zone,
  notes              text,
  created_at         timestamp with time zone default now() not null,
  updated_at         timestamp with time zone default now() not null
);

create index if not exists hospital_beds_hospital_idx on hospital_beds (hospital_id);
create index if not exists hospital_beds_hospital_ward_idx on hospital_beds (hospital_id, ward_id);
create index if not exists hospital_beds_hospital_status_idx on hospital_beds (hospital_id, status);

alter table hospital_beds enable row level security;

drop policy if exists hospital_beds_hospital_access on hospital_beds;
create policy hospital_beds_hospital_access
  on hospital_beds for all
  using (
    auth.role() = 'service_role' or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.hospital_id = hospital_beds.hospital_id
        and p.status = 'active'
    )
  )
  with check (
    auth.role() = 'service_role' or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.hospital_id = hospital_beds.hospital_id
        and p.status = 'active'
    )
  );

-- Ensure queue shape expected by hooks/components exists on any prior install
alter table if exists reception_checkins add column if not exists token_number integer;
alter table if exists reception_checkins add column if not exists chief_complaint text;
alter table if exists reception_checkins add column if not exists priority text default 'normal';

update reception_checkins
set token_number = coalesce(token_number, floor(extract(epoch from coalesce(checked_in_at, now())))::integer % 100000)
where token_number is null;

alter table if exists hospital_queue add column if not exists ticket_number text;
alter table if exists hospital_queue add column if not exists triage_severity text;
alter table if exists hospital_queue add column if not exists chief_complaint text;
alter table if exists hospital_queue add column if not exists room text;
alter table if exists hospital_queue add column if not exists wait_minutes integer default 0;
alter table if exists hospital_queue add column if not exists arrived_at timestamp with time zone;
alter table if exists hospital_queue add column if not exists token_number integer;

update hospital_queue
set ticket_number = coalesce(ticket_number, token_number::text, substring(id::text, 1, 8))
where ticket_number is null;

update hospital_queue
set arrived_at = coalesce(arrived_at, created_at, now())
where arrived_at is null;

do $$
begin
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'patient_queue') then
    execute $view$
      create or replace view patient_queue with (security_invoker = true) as
      select
        id,
        hospital_id,
        patient_id,
        patient_name,
        ticket_number,
        priority,
        status,
        arrived_at
      from hospital_queue
    $view$;
  elsif exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'patient_queue'
  ) then
    alter table patient_queue add column if not exists hospital_id uuid;
    alter table patient_queue add column if not exists patient_id uuid;
    alter table patient_queue add column if not exists patient_name text;
    alter table patient_queue add column if not exists ticket_number text;
    alter table patient_queue add column if not exists priority text default 'normal';
    alter table patient_queue add column if not exists status text default 'waiting';
    alter table patient_queue add column if not exists arrived_at timestamp with time zone default now();
  else
    execute $view$
      create view patient_queue with (security_invoker = true) as
      select
        id,
        hospital_id,
        patient_id,
        patient_name,
        ticket_number,
        priority,
        status,
        arrived_at
      from hospital_queue
    $view$;
  end if;
end $$;

-- KPI compatibility for appointments screen/query
alter table if exists appointments add column if not exists scheduled_at date;
update appointments
set scheduled_at = coalesce(scheduled_at, appointment_date::date)
where scheduled_at is null;
create index if not exists appointments_scheduled_at_idx on appointments (scheduled_at);

-- Ensure labs module columns exist even when old lab_requests table was created first
alter table if exists lab_requests add column if not exists lab_id text;
alter table if exists lab_requests add column if not exists panel text;
alter table if exists lab_requests add column if not exists sample_type text;
alter table if exists lab_requests add column if not exists ordered_at timestamp with time zone;
alter table if exists lab_requests add column if not exists abnormal boolean default false;
alter table if exists lab_requests add column if not exists critical boolean default false;
alter table if exists lab_requests add column if not exists notes text;

update lab_requests
set ordered_at = coalesce(ordered_at, created_at, now())
where ordered_at is null;

update lab_requests
set lab_id = coalesce(lab_id, 'LAB-' || upper(substring(replace(id::text, '-', ''), 1, 8)))
where lab_id is null or trim(lab_id) = '';

create index if not exists lab_requests_hospital_ordered_idx on lab_requests (hospital_id, ordered_at desc);

-- Ensure prescriptions module columns exist even when old table was created first
alter table if exists prescriptions add column if not exists rx_number text;
alter table if exists prescriptions add column if not exists prescribed_by uuid;
alter table if exists prescriptions add column if not exists prescribed_at timestamp with time zone;
alter table if exists prescriptions add column if not exists priority text default 'normal';
alter table if exists prescriptions add column if not exists insurance text;
alter table if exists prescriptions add column if not exists items jsonb default '[]'::jsonb;
alter table if exists prescriptions add column if not exists dispensed_by uuid;
alter table if exists prescriptions add column if not exists dispensed_at timestamp with time zone;

update prescriptions
set rx_number = coalesce(rx_number, 'RX-' || upper(substring(replace(id::text, '-', ''), 1, 8)))
where rx_number is null or trim(rx_number) = '';

update prescriptions
set prescribed_at = coalesce(prescribed_at, created_at, now())
where prescribed_at is null;

update prescriptions
set status = lower(status)
where status is not null;

update prescriptions
set priority = lower(priority)
where priority is not null;

update prescriptions
set items = '[]'::jsonb
where items is null;

alter table if exists prescriptions drop constraint if exists prescriptions_status_check;
alter table if exists prescriptions drop constraint if exists prescriptions_priority_check;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'prescriptions'
  ) then
    alter table prescriptions
      add constraint prescriptions_status_check
      check (status in ('pending','dispensing','dispensed','partial','cancelled','on-hold'));

    alter table prescriptions
      add constraint prescriptions_priority_check
      check (priority in ('normal','urgent','critical'));
  end if;
end $$;

create index if not exists prescriptions_hospital_prescribed_idx on prescriptions (hospital_id, prescribed_at desc);

-- Normalize beds.status values for live dashboard counters
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'beds'
  ) then
    update beds
    set status = lower(status)
    where status is not null;

    alter table beds drop constraint if exists beds_status_check;
    alter table beds alter column status set default 'available';
    alter table beds
      add constraint beds_status_check
      check (status in ('available','occupied','reserved','cleaning','maintenance'));
  end if;
end $$;
