-- Adds optional audit metadata fields for next actions.
-- Safe to run multiple times.

alter table public.opportunities
  add column if not exists next_action_completed_by text;

alter table public.opportunities
  add column if not exists next_action_completed_note text;

-- Notes:
-- - UI caps next_action_completed_note to 500 chars, but the DB is left as `text` for flexibility.
