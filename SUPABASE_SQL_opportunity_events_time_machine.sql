-- Pipeline Time Machine (Opportunity Events)
--
-- What this does:
-- - Creates an append-only audit table `public.opportunity_events`
-- - Adds a trigger on `public.opportunities` to log INSERT/UPDATE/DELETE
--
-- Safety:
-- - Additive only (does not modify opportunities columns)
-- - Safe to run multiple times
--
-- Notes:
-- - This table can grow. Consider retention (e.g., keep 180 days) once you love it.
-- - If you already have audit tooling, you can adapt the app to your schema instead.

create table if not exists public.opportunity_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  opportunity_id uuid not null,
  event_type text not null check (event_type in ('INSERT','UPDATE','DELETE')),
  actor_user_id uuid null,
  old_row jsonb null,
  new_row jsonb null
);

create index if not exists opportunity_events_created_at_idx
  on public.opportunity_events (created_at desc);

create index if not exists opportunity_events_opportunity_id_created_at_idx
  on public.opportunity_events (opportunity_id, created_at desc);

-- Optional: If you want to keep the table small, you can add a retention job later.
-- Example (manual): delete from public.opportunity_events where created_at < now() - interval '180 days';

create or replace function public.log_opportunity_event()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.opportunity_events (opportunity_id, event_type, actor_user_id, old_row, new_row)
    values (new.id, 'INSERT', auth.uid(), null, to_jsonb(new));
    return new;
  end if;

  if (tg_op = 'UPDATE') then
    insert into public.opportunity_events (opportunity_id, event_type, actor_user_id, old_row, new_row)
    values (new.id, 'UPDATE', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  end if;

  if (tg_op = 'DELETE') then
    insert into public.opportunity_events (opportunity_id, event_type, actor_user_id, old_row, new_row)
    values (old.id, 'DELETE', auth.uid(), to_jsonb(old), null);
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists opportunities_audit_to_events on public.opportunities;

create trigger opportunities_audit_to_events
after insert or update or delete on public.opportunities
for each row execute function public.log_opportunity_event();

-- RLS (optional)
--
-- The app reads this table via the logged-in user's Supabase session.
-- If you enable RLS, you MUST create policies that allow appropriate reads.
-- A simple starting point (adjust to your needs):
--
-- alter table public.opportunity_events enable row level security;
--
-- create policy "opportunity_events_read_authenticated"
-- on public.opportunity_events
-- for select
-- to authenticated
-- using (true);
--
-- If your `opportunities` table is RLS-protected per-user/branch, consider
-- tightening this by joining against `opportunities` in a security definer view.
