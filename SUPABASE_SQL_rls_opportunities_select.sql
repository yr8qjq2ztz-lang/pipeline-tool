-- Fix for: opportunities not loading when RLS is enabled
--
-- This happens when RLS is enabled on public.opportunities but there is no
-- SELECT policy for the authenticated role.
--
-- Run this in: Supabase Dashboard -> SQL Editor
--
-- Choose ONE of the policy options below.

begin;

-- Ensure RLS is enabled. (No-op if already enabled.)
alter table public.opportunities enable row level security;

-- -----------------------------------------------------------------------------
-- OPTION A (shared-team, simplest): any authenticated user can SELECT any row.
-- -----------------------------------------------------------------------------

drop policy if exists opportunities_select_authenticated_all on public.opportunities;
create policy opportunities_select_authenticated_all
on public.opportunities
for select
to authenticated
using (true);

-- -----------------------------------------------------------------------------
-- OPTION A2 (shared-team + allowlist): restrict SELECT to allowlisted users.
--
-- Prerequisite:
-- - Run SUPABASE_SQL_auth_before_user_created_domain_allowlist.sql
-- - Run SUPABASE_SQL_rls_accounts_insert_allowed_domains.sql (defines public.is_allowed_app_user())
--
-- drop policy if exists opportunities_select_allowed_domains on public.opportunities;
-- create policy opportunities_select_allowed_domains
-- on public.opportunities
-- for select
-- to authenticated
-- using (public.is_allowed_app_user());

-- -----------------------------------------------------------------------------
-- OPTION B (owner-only): only see rows where owner_user_id = auth.uid().
--
-- Requires column: public.opportunities.owner_user_id (uuid)
-- If you haven't added it, run SUPABASE_SQL_owner_user_id.sql first.
--
-- drop policy if exists opportunities_select_owner_only on public.opportunities;
-- create policy opportunities_select_owner_only
-- on public.opportunities
-- for select
-- to authenticated
-- using (owner_user_id = auth.uid());

commit;
