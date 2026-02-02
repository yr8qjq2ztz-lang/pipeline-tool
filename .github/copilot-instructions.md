# Copilot instructions (pipeline-tool)

## Quick commands
- `npm run dev`
- `npm run lint`, `npm run typecheck`, `npm run build`
- `npm run smoke` (runs a production build + lightweight checks)
- Windows “production-like” run: see `RUN_LOCAL_WINDOWS.md`

## Project shape
- Next.js App Router (Next 16 / React 19) under `src/app/*`.
- Supabase is the backend: Auth + Postgres tables (`opportunities` joins to `accounts` + optional `branches`).

## Where to change UI
- Most Pipeline UX (board, table, create form, edit modal, “BNT/PENZ/Bapcor” sub-sections) lives in `src/app/pipeline/page.tsx`.
- Prefer small, local edits in that file; it’s intentionally monolithic to keep pipeline behavior in one place.

## Auth + data fetching patterns (follow existing code)
- Client pages (e.g. `src/app/pipeline/page.tsx`, `src/app/analytics/page.tsx`) wait for `supabase.auth.onAuthStateChange(...)` and act only on `event === "INITIAL_SESSION"`; always unsubscribe in cleanup.
- Server pages (e.g. `src/app/dashboard/page.tsx`) use `supabaseServer()` (cookie-backed) and `redirect("/login")` if `supabase.auth.getUser()` has no user.
- `supabaseBrowser()` intentionally returns a safe stub during SSR/build to avoid prerender failures (see `src/lib/supabase/browser.ts`). Don’t “simplify” this.

## Supabase RLS + schema scripts (how this repo manages DB changes)
- DB changes are applied via idempotent scripts at repo root (`SUPABASE_SQL_*.sql`); see `SUPABASE_SCHEMA_CHECKLIST.md`.
- Common RLS fixes:
	- `SUPABASE_SQL_rls_opportunities_select.sql` (fixes: opportunities not loading when RLS enabled)
	- `SUPABASE_SQL_rls_opportunities_insert.sql` (fixes: insert blocked on `public.opportunities`)
	- `SUPABASE_SQL_rls_opportunities_update.sql` (fixes: edits silently not persisting / RLS update blocked)
	- `SUPABASE_SQL_rls_accounts_insert_allowed_domains.sql` (fixes: insert blocked on `public.accounts`)
- If you enable the audit trigger (`SUPABASE_SQL_opportunity_events_time_machine.sql`) and also enable RLS on `public.opportunity_events`, run `SUPABASE_SQL_rls_opportunity_events.sql` so the trigger can insert audit rows.

## Database schema: optional columns are normal
- Schema guidance and SQL scripts live at repo root: `SUPABASE_SCHEMA_CHECKLIST.md`, `SUPABASE_SQL_*.sql`.
- UI/features should degrade gracefully if optional columns/relationships are missing (pattern: detect “missing column” errors and retry/omit fields), as done in `src/app/dashboard/page.tsx` and `src/app/pipeline/page.tsx`.

### Adding a new optional field
- Add an idempotent SQL script at repo root (e.g. `SUPABASE_SQL_bapcor_rebate.sql`) and list it in `SUPABASE_SCHEMA_CHECKLIST.md`.
- When reading rows: include the column in the select list, but keep `fetchOpportunities()` compatible with missing columns (it strips unknown optional columns automatically).
- When writing: add a specific “missing column” error message alongside other optional fields (see create/edit handlers in `src/app/pipeline/page.tsx`).

## Data conventions used across the app
- Dates are stored as ISO date-only strings (`YYYY-MM-DD`) and parsed via `new Date(iso + "T00:00:00")`.
- Probabilities are displayed/edited as 0–100; some KPI code tolerates 0–1 inputs (`pRaw <= 1 ? pRaw : pRaw / 100`). Don’t change without migrating existing data.

## AI integration (optional)
- API route: `src/app/api/battery-recommendation/route.ts` (Node runtime). Uses `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`, default `gpt-4o-mini`) and has a 15s timeout.
- When changing prompts, keep outputs short/actionable and do not invent OEM part numbers.

## Deployment (production, not just local)
- This app is intended to run on Vercel; production deploys happen on `git push` to `main` (see `README.md`).
- Before pushing: ensure `npm run lint`, `npm run typecheck`, and `npm run build` pass.
- If a feature adds new DB columns, also run the corresponding `SUPABASE_SQL_*.sql` script in Supabase Production.

## Robustness expectations
- Validate/filter unknown rows before rendering charts or lists; clamp numeric inputs (see `src/app/components/WhatIfSimulator.tsx`, `src/app/components/AnalyticsCharts.tsx`).
- Prefer absolute imports via `@/…` and avoid touching generated folders (`node_modules/`, `.next/`).

