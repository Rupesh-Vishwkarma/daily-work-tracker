-- ============================================================
-- Daily Work Tracker v6 Schema — cancellable weekly commitments
-- Run this in the Supabase SQL Editor AFTER v5 is in place.
-- ============================================================
--
-- Adds a 'cancelled' commitment status for when a planned (weekly) commitment
-- changes or is dropped. Cancelled commitments are excluded from delivery and
-- reliability metrics — they are NOT treated as missed or broken promises.

alter table commitments drop constraint if exists commitments_status_check;

alter table commitments
  add constraint commitments_status_check
  check (status in ('open', 'done', 'partial', 'missed', 'cancelled'));
