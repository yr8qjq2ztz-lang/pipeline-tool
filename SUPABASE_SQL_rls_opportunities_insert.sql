-- Fix for: "new row violates row-level security policy for table opportunities"
--
-- This happens when RLS is enabled on public.opportunities but there is no
-- INSERT policy for the authenticated role.
--
-- Run this in: Supabase Dashboard -> SQL Editor
--
-- Choose ONE of the two policy options below.

begin;

-- Ensure RLS is enabled. (No-op if already enabled.)
alter table public.opportunities enable row level security;

-- -----------------------------------------------------------------------------
-- OPTION A (simplest): any authenticated user can INSERT any opportunity row.
-- Use this if you don't have owner-based permissions yet.
-- -----------------------------------------------------------------------------

drop policy if exists opportunities_insert_authenticated_all on public.opportunities;
create policy opportunities_insert_authenticated_all
on public.opportunities
for insert
to authenticated
with check (true);

-- -----------------------------------------------------------------------------
-- OPTION A2 (shared-team + allowlist, recommended if you use the auth allowlist):
-- Allow INSERT only for authenticated users whose email/domain is allowlisted.
--
-- Prerequisite:
-- - Run SUPABASE_SQL_auth_before_user_created_domain_allowlist.sql
-- - Run SUPABASE_SQL_rls_accounts_insert_allowed_domains.sql (defines public.is_allowed_app_user())
--
-- drop policy if exists opportunities_insert_allowed_domains on public.opportunities;
-- create policy opportunities_insert_allowed_domains
-- on public.opportunities
-- for insert
-- to authenticated
-- with check (public.is_allowed_app_user());

-- -----------------------------------------------------------------------------
-- OPTION B (recommended when you have ownership):
-- Only allow inserting rows where owner_user_id = auth.uid().
--
-- Requires column: public.opportunities.owner_user_id (uuid)
-- If you haven't added it, run SUPABASE_SQL_owner_user_id.sql first.
--
-- drop policy if exists opportunities_insert_owner_only on public.opportunities;
-- create policy opportunities_insert_owner_only
-- on public.opportunities
-- for insert
-- to authenticated
-- with check (owner_user_id = auth.uid());

commit;

-- Notes:
-- - If you have the Time Machine trigger enabled (SUPABASE_SQL_opportunity_events_time_machine.sql)
--   and RLS enabled on public.opportunity_events, you must also allow inserts there:
--   run SUPABASE_SQL_rls_opportunity_events.sql.
