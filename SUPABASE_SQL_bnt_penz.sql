-- Enable BNT + PENZ sub-form fields on opportunities (one-shot)
-- Run this in Supabase SQL editor.

ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS opportunity_for_bnt text,
ADD COLUMN IF NOT EXISTS bnt_categories text,
ADD COLUMN IF NOT EXISTS bnt_invite text,
ADD COLUMN IF NOT EXISTS opportunity_for_penz text,
ADD COLUMN IF NOT EXISTS penz_categories text,
ADD COLUMN IF NOT EXISTS penz_invite text;

-- Optional: indexes for filtering/reporting (recommended once data grows)
CREATE INDEX IF NOT EXISTS opportunities_opportunity_for_bnt_idx
ON public.opportunities (opportunity_for_bnt);

CREATE INDEX IF NOT EXISTS opportunities_bnt_categories_idx
ON public.opportunities (bnt_categories);

CREATE INDEX IF NOT EXISTS opportunities_bnt_invite_idx
ON public.opportunities (bnt_invite);

CREATE INDEX IF NOT EXISTS opportunities_opportunity_for_penz_idx
ON public.opportunities (opportunity_for_penz);

CREATE INDEX IF NOT EXISTS opportunities_penz_categories_idx
ON public.opportunities (penz_categories);

CREATE INDEX IF NOT EXISTS opportunities_penz_invite_idx
ON public.opportunities (penz_invite);
