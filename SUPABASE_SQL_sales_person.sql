-- Add Sales Person to opportunities
-- Run this in Supabase SQL editor.

ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS sales_person text;

-- Optional: index for filtering (recommended once data grows)
CREATE INDEX IF NOT EXISTS opportunities_sales_person_idx
ON public.opportunities (sales_person);
