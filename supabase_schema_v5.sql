-- ============================================================
-- Daily Work Tracker v5 Schema — weekly summary email release
-- Run this in the Supabase SQL Editor AFTER v4 is in place.
-- ============================================================

create table if not exists weekly_summaries (
  id text primary key default gen_random_uuid()::text,
  week_start date not null,          -- Monday of the covered week
  week_end date not null,            -- Saturday of the covered week
  payload jsonb not null,            -- structured summary numbers (spec §4)
  narrative text,                    -- AI-written prose (null if AI skipped/failed)
  generated_at timestamptz not null default now(),
  sent_at timestamptz,               -- null until a send succeeds
  sent_to jsonb,                     -- recipient list on success
  send_error text,                   -- last send failure message, else null
  created_at timestamptz default now()
);

create unique index if not exists weekly_summaries_week_idx
  on weekly_summaries(week_start);   -- one row per week (idempotent upsert target)

alter table weekly_summaries disable row level security;
