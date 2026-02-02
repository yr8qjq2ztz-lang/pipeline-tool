-- Fix for: "new row violates row-level security policy for table opportunity_events"
--
-- This happens when RLS is enabled on public.opportunity_events but there is no
-- INSERT policy. The Time Machine trigger on public.opportunities inserts rows
-- into public.opportunity_events on INSERT/UPDATE/DELETE.
--
-- Run this in: Supabase Dashboard -> SQL Editor

begin;

-- Ensure RLS is enabled (no-op if already enabled)
alter table public.opportunity_events enable row level security;

-- Allow authenticated users to read the audit log (used by /replay)
drop policy if exists opportunity_events_select_authenticated on public.opportunity_events;
create policy opportunity_events_select_authenticated
on public.opportunity_events
for select
to authenticated
using (true);

-- Allow authenticated users to insert audit rows (required for the trigger to work)
-- NOTE: This is intentionally broad ("Option A" style). If you want to restrict
-- inserts to only those created by the trigger / same-user, ask and we’ll tighten it.
drop policy if exists opportunity_events_insert_authenticated on public.opportunity_events;
create policy opportunity_events_insert_authenticated
on public.opportunity_events
for insert
to authenticated
with check (true);

-- Keep the table append-only from the client:
-- (No update/delete policies are created.)

commit;
