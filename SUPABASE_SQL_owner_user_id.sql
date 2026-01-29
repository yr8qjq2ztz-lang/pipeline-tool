-- Adds optional owner assignment for opportunities.
-- Safe to run multiple times.

alter table public.opportunities
  add column if not exists owner_user_id uuid;

create index if not exists opportunities_owner_user_id_idx
  on public.opportunities(owner_user_id);

-- Optional: FK to Supabase Auth users (safe guarded).
-- If you prefer to skip cross-schema FKs, you can comment out the DO block.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'opportunities_owner_user_id_fkey'
  ) then
    alter table public.opportunities
      add constraint opportunities_owner_user_id_fkey
      foreign key (owner_user_id)
      references auth.users(id)
      on delete set null;
  end if;
end $$;
