-- AfyaHero Schema Compatibility Migration
-- Generated from schema.sql compatibility section
-- Date: 2026-04-04
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

