-- Enable Pipeline optional fields on opportunities (one-shot)
-- Run this in Supabase SQL editor.
-- This is safe to run multiple times (idempotent).

ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS branch_id uuid,
ADD COLUMN IF NOT EXISTS sales_person text,
ADD COLUMN IF NOT EXISTS battery_solution text,
ADD COLUMN IF NOT EXISTS how_we_win text,
ADD COLUMN IF NOT EXISTS opportunity_for_bnt text,
ADD COLUMN IF NOT EXISTS bnt_categories text,
ADD COLUMN IF NOT EXISTS bnt_invite text,
ADD COLUMN IF NOT EXISTS opportunity_for_penz text,
ADD COLUMN IF NOT EXISTS penz_categories text,
ADD COLUMN IF NOT EXISTS penz_invite text,
ADD COLUMN IF NOT EXISTS opportunity_for_bapcor_rebate text,
ADD COLUMN IF NOT EXISTS bapcor_rebate_invite text;

-- Optional: indexes for filtering/reporting (recommended once data grows)
CREATE INDEX IF NOT EXISTS opportunities_branch_id_idx
ON public.opportunities (branch_id);

CREATE INDEX IF NOT EXISTS opportunities_sales_person_idx
ON public.opportunities (sales_person);

CREATE INDEX IF NOT EXISTS opportunities_battery_solution_idx
ON public.opportunities (battery_solution);

CREATE INDEX IF NOT EXISTS opportunities_how_we_win_idx
ON public.opportunities (how_we_win);

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

CREATE INDEX IF NOT EXISTS opportunities_opportunity_for_bapcor_rebate_idx
ON public.opportunities (opportunity_for_bapcor_rebate);

CREATE INDEX IF NOT EXISTS opportunities_bapcor_rebate_invite_idx
ON public.opportunities (bapcor_rebate_invite);
