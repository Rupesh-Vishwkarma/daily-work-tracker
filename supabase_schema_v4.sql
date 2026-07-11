-- ============================================================
-- Daily Work Tracker v4 Schema — employee self-service absence
-- Run this in the Supabase SQL Editor AFTER v3 is in place.
-- Adds an optional reason note attached to an absence.
-- ============================================================

alter table entries add column if not exists absence_note text;
