# Pipeline Time Machine (Replay)

This feature adds a new page at `/replay` that can rewind your pipeline using an append-only audit log.

## One-time Supabase setup

Run the SQL in:
- `SUPABASE_SQL_opportunity_events_time_machine.sql`

This creates:
- `public.opportunity_events`
- a trigger on `public.opportunities` that logs INSERT/UPDATE/DELETE

## Safety

- The replay UI is read-only.
- The SQL is additive (no schema changes to existing columns).
- If the table isn’t installed yet, `/replay` shows setup instructions instead of erroring.
