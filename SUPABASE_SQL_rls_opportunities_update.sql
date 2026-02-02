-- Fix for: edits not saving due to Supabase RLS blocking UPDATE on public.opportunities
--
-- Symptoms:
-- - The app can read opportunities, but pressing "Save changes" doesn't persist.
-- - PostgREST may return 200/204 with 0 rows updated (no error) when RLS blocks UPDATE.
--
-- Run this in: Supabase Dashboard -> SQL Editor
--
-- Choose ONE of the two policy options below.

begin;

-- Ensure RLS is enabled. (No-op if already enabled.)
alter table public.opportunities enable row level security;

-- -----------------------------------------------------------------------------
-- OPTION A (simplest): any authenticated user can UPDATE any opportunity row.
-- Use this if you don't have owner-based permissions yet.
-- -----------------------------------------------------------------------------
drop policy if exists opportunities_update_authenticated_all on public.opportunities;
create policy opportunities_update_authenticated_all
on public.opportunities
for update
to authenticated
using (true)
with check (true);

-- -----------------------------------------------------------------------------
-- OPTION B (recommended when you have ownership):
-- Only allow updating rows where owner_user_id = auth.uid().
--
-- Requires column: public.opportunities.owner_user_id (uuid)
-- If you haven't added it, run SUPABASE_SQL_owner_user_id.sql first.
-- -----------------------------------------------------------------------------
-- drop policy if exists opportunities_update_owner_only on public.opportunities;
-- create policy opportunities_update_owner_only
-- on public.opportunities
-- for update
-- to authenticated
-- using (owner_user_id = auth.uid())
-- with check (owner_user_id = auth.uid());

commit;

-- Notes:
-- - UPDATE policy alone is not enough if you also block SELECT/INSERT via RLS.
--   If you can see rows in the app, you already have a working SELECT policy.
-- - If you want managers/admins to edit all rows, we can extend OPTION B with a
--   role/claim check (e.g., JWT app_metadata) later.
