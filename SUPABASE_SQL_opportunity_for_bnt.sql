-- Add BNT opportunity flag to opportunities
-- Run this in Supabase SQL editor.

ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS opportunity_for_bnt text;

-- Optional: index for filtering/reporting (recommended once data grows)
CREATE INDEX IF NOT EXISTS opportunities_opportunity_for_bnt_idx
ON public.opportunities (opportunity_for_bnt);
