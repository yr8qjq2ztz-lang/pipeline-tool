-- Fix for: "new row violates row-level security policy for table accounts"
--
-- This enables/updates RLS policies on public.accounts so authenticated users from
-- allowed email domains can SELECT and INSERT accounts.
--
-- Prerequisite:
-- - Run SUPABASE_SQL_auth_before_user_created_domain_allowlist.sql first, so the
--   allowlist table exists and contains your domains.

-- Helper: is this authenticated user allowed to use the app?
create or replace function public.is_allowed_app_user()
returns boolean
language sql
stable
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.signup_email_allowlist e
        where lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
      or exists (
        select 1
        from public.signup_email_domain_allowlist d
        where lower(d.domain) = lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 2))
      )
    );
$$;

-- Ensure RLS is enabled
alter table public.accounts enable row level security;

-- Read access (needed for account dropdown/search)
drop policy if exists accounts_select_allowed_domains on public.accounts;
create policy accounts_select_allowed_domains
on public.accounts
for select
to authenticated
using (public.is_allowed_app_user());

-- Insert access (needed for auto-create account on new opportunity)
drop policy if exists accounts_insert_allowed_domains on public.accounts;
create policy accounts_insert_allowed_domains
on public.accounts
for insert
to authenticated
with check (public.is_allowed_app_user());
