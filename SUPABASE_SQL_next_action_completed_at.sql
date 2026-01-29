-- Add Next Action completion tracking to opportunities
-- Run this in Supabase SQL editor.

ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS next_action_completed_at timestamptz;

-- Optional: index for querying overdue/open actions
CREATE INDEX IF NOT EXISTS opportunities_next_action_completed_at_idx
ON public.opportunities (next_action_completed_at);
