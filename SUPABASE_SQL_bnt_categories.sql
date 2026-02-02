-- Add BNT categories to opportunities
-- Run this in Supabase SQL editor.

ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS bnt_categories text;

-- Optional: index for filtering/reporting (recommended once data grows)
CREATE INDEX IF NOT EXISTS opportunities_bnt_categories_idx
ON public.opportunities (bnt_categories);
