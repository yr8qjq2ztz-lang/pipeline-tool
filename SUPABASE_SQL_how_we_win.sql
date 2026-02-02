-- Add How we win to opportunities
-- Run this in Supabase SQL editor.

ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS how_we_win text;

-- Optional: index for filtering/reporting (recommended once data grows)
CREATE INDEX IF NOT EXISTS opportunities_how_we_win_idx
ON public.opportunities (how_we_win);
