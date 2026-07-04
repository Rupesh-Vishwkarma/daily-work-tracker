-- ============================================================
-- Daily Work Tracker v3 Schema — v6/v1 "commitments" release
-- Run this in the Supabase SQL Editor AFTER v2 is in place.
-- Keeps employees + projects; wipes old daily entries (PRD §13.3).
-- ============================================================

-- 1. Commitments (promise → follow-up → delivered loop, PRD §13.2)
create table if not exists commitments (
  id text primary key default gen_random_uuid()::text,
  employee_id text not null references employees(id) on delete cascade,
  employee_name text not null,
  project_id text,                       -- project id, '__other__', or null
  horizon text not null check (horizon in ('day','week')),
  text text not null,
  due_date date not null,                -- working day (or week-end Saturday) it is checked
  created_in_entry_id text,
  status text not null default 'open' check (status in ('open','done','partial','missed')),
  outcome_note text,
  resolved_at timestamptz,
  carry_count int not null default 0,    -- auto-carry bumps this and moves due_date forward
  created_at timestamptz default now()
);

create index if not exists commitments_employee_idx on commitments(employee_id);
create index if not exists commitments_due_idx on commitments(due_date);
create index if not exists commitments_status_idx on commitments(status);

alter table commitments disable row level security;

-- 2. Storage bucket for task attachments (screenshots/files)
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- 3. Wipe old daily entries for a clean start (keeps employees + projects)
delete from comments;
delete from reviewed_entries;
delete from resolved_blockers;
delete from entries;
