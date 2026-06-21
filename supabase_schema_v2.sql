-- ============================================================
-- Daily Work Tracker v2 Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Drop old entries table and recreate with v2 structure
drop table if exists entries cascade;

create table entries (
  id text primary key default 'e' || extract(epoch from now())::bigint || floor(random()*10000)::text,
  employee_id text not null references employees(id) on delete cascade,
  employee_name text not null,
  date date not null,
  workload text not null check (workload in ('light','medium','heavy')),
  timestamp timestamptz default now(),
  submit_count int default 1,
  is_absent boolean default false,
  submitted_by_manager boolean default false,
  project_tasks jsonb default '[]'::jsonb
);

create index if not exists entries_date_idx on entries(date);
create index if not exists entries_employee_idx on entries(employee_id);

-- 2. Projects table
create table if not exists projects (
  id text primary key,
  name text not null,
  color text default '#6366F1',
  lead text,
  members jsonb default '[]'::jsonb,
  start_date date,
  deadline date,
  end_date date,
  status text default 'active' check (status in ('active','closed')),
  previous_deadlines jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- 3. Comments table (manager notes on entries)
create table if not exists comments (
  id text primary key default gen_random_uuid()::text,
  entry_id text not null references entries(id) on delete cascade,
  text text not null,
  author text default 'Manager',
  timestamp timestamptz default now()
);

-- 4. Reviewed entries
create table if not exists reviewed_entries (
  entry_id text primary key references entries(id) on delete cascade,
  reviewed_at timestamptz default now()
);

-- 5. Resolved blockers
create table if not exists resolved_blockers (
  key text primary key,
  resolved_at timestamptz default now()
);

-- 6. Broadcast (single row, id always = 1)
create table if not exists broadcast (
  id int primary key default 1,
  message text default '',
  active boolean default false,
  updated_at timestamptz default now()
);
insert into broadcast (id, message, active) values (1, '', false) on conflict (id) do nothing;

-- Disable RLS (service_role key used server-side bypasses anyway)
alter table entries disable row level security;
alter table projects disable row level security;
alter table comments disable row level security;
alter table reviewed_entries disable row level security;
alter table resolved_blockers disable row level security;
alter table broadcast disable row level security;

-- Seed a few starter projects (optional)
insert into projects (id, name, color, lead, members, start_date, status) values
  ('merilverse', 'Merilverse', '#6366F1', 'rupesh', '["rupesh","karan","mampi"]', current_date, 'active'),
  ('xr-training', 'XR Training', '#0EA5E9', 'dev', '["dev","devparekh","devdesai"]', current_date, 'active'),
  ('haptics', 'Haptics SDK', '#10B981', 'rupesh', '["rupesh","mampi"]', current_date, 'active')
on conflict (id) do nothing;
