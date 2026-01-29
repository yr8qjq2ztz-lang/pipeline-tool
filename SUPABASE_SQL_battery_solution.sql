-- Add Battery Solution to opportunities
-- Run this in Supabase SQL editor.

ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS battery_solution text;

-- Optional: index for filtering/reporting (recommended once data grows)
CREATE INDEX IF NOT EXISTS opportunities_battery_solution_idx
ON public.opportunities (battery_solution);
