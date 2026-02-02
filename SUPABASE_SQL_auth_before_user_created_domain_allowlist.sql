-- Restrict Supabase Auth signups to an allowlist of email domains
--
-- This uses the Supabase Auth Hook: "Before User Created" (SQL / Postgres function).
-- It blocks user creation unless the email domain is explicitly allowed.
--
-- How to enable after running this SQL:
--   Supabase Dashboard → Authentication → Hooks → "Before User Created"
--   Type: Postgres function
--   Function: public.hook_before_user_created_allowlist_domains

-- Create table to store allowed domains
create table if not exists public.signup_email_domain_allowlist (
  id serial primary key,
  domain text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create table to store allowed individual emails (exceptions)
create table if not exists public.signup_email_allowlist (
  id serial primary key,
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.update_signup_email_domain_allowlist_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_signup_email_domain_allowlist_set_updated_at on public.signup_email_domain_allowlist;
create trigger trg_signup_email_domain_allowlist_set_updated_at
before update on public.signup_email_domain_allowlist
for each row
execute procedure public.update_signup_email_domain_allowlist_updated_at();

drop trigger if exists trg_signup_email_allowlist_set_updated_at on public.signup_email_allowlist;
create trigger trg_signup_email_allowlist_set_updated_at
before update on public.signup_email_allowlist
for each row
execute procedure public.update_signup_email_domain_allowlist_updated_at();

-- Seed / upsert allowed domains
insert into public.signup_email_domain_allowlist(domain)
values
  ('hcb.co.nz'),
  ('bapcor.com')
on conflict (domain) do nothing;

-- Seed / upsert allowed individual emails (admin/test exceptions)
insert into public.signup_email_allowlist(email)
values
  ('tim.mckibbin@outlook.com')
on conflict (email) do nothing;

-- Auth hook: before-user-created
create or replace function public.hook_before_user_created_allowlist_domains(event jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  email text;
  signup_domain text;
  is_allowed int;
begin
  email := event->'user'->>'email';

  -- No email present? Reject.
  if email is null or email = '' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Email is required to sign up.',
        'http_code', 400
      )
    );
  end if;

  signup_domain := lower(split_part(email, '@', 2));

  -- Allow exact email exceptions
  select count(*) into is_allowed
  from public.signup_email_allowlist
  where lower(public.signup_email_allowlist.email) = lower(email);

  if is_allowed > 0 then
    return '{}'::jsonb;
  end if;

  select count(*) into is_allowed
  from public.signup_email_domain_allowlist
  where lower(public.signup_email_domain_allowlist.domain) = signup_domain;

  if is_allowed > 0 then
    -- Allow signup
    return '{}'::jsonb;
  end if;

  -- Deny by default
  return jsonb_build_object(
    'error', jsonb_build_object(
      'message', 'Only @hcb.co.nz or @bapcor.com emails may sign up. Ask an admin if you need access.',
      'http_code', 403
    )
  );
end;
$$;

-- Permissions required for Supabase Auth to run the hook
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created_allowlist_domains(jsonb) to supabase_auth_admin;

-- Ensure the hook function is NOT callable via the public data APIs
revoke execute on function public.hook_before_user_created_allowlist_domains(jsonb) from authenticated, anon, public;
