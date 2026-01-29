-- Add optional vehicle fields to opportunities
-- Run this in Supabase SQL editor.

ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS vehicle_brand text;

ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS vehicle_model text;

-- Optional indexes (only if you plan to filter/report on these)
CREATE INDEX IF NOT EXISTS opportunities_vehicle_brand_idx
ON public.opportunities (vehicle_brand);

CREATE INDEX IF NOT EXISTS opportunities_vehicle_model_idx
ON public.opportunities (vehicle_model);
