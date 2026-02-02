-- Optional feature: Bapcor Rebate fields on opportunities
--
-- Adds two nullable text columns used by the Pipeline UI:
-- - opportunities.opportunity_for_bapcor_rebate  ("Yes" | "No" | "Unsure" | null)
-- - opportunities.bapcor_rebate_invite           (free text, who to bring in)
--
-- This script is idempotent.

alter table public.opportunities
  add column if not exists opportunity_for_bapcor_rebate text;

alter table public.opportunities
  add column if not exists bapcor_rebate_invite text;
