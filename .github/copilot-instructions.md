# Copilot instructions (pipeline-tool)

## Quick commands
- `npm run dev`
- `npm run lint`, `npm run typecheck`, `npm run build`

## Project shape
- Next.js App Router (Next 16 / React 19) under `src/app/*`.
- Supabase is the backend: Auth + Postgres tables (`opportunities` with joins to `accounts` and `branches`).

## Auth + data fetching patterns (follow existing code)
- Client pages (e.g. `src/app/pipeline/page.tsx`, `src/app/analytics/page.tsx`) wait for `supabase.auth.onAuthStateChange(...)` and act only on `event === "INITIAL_SESSION"`; always unsubscribe in cleanup.
- Server pages (e.g. `src/app/dashboard/page.tsx`) use `supabaseServer()` (cookie-backed) and `redirect("/login")` if `supabase.auth.getUser()` has no user.
- `supabaseBrowser()` intentionally returns a safe stub during SSR/build to avoid prerender failures (see `src/lib/supabase/browser.ts`). Don’t “simplify” this.

## Database schema: optional columns are normal
- Schema guidance and SQL scripts live at repo root: `SUPABASE_SCHEMA_CHECKLIST.md`, `SUPABASE_SQL_*.sql`.
- UI/features should degrade gracefully if optional columns/relationships are missing (pattern: detect “missing column” errors and retry/omit fields), as done in `src/app/dashboard/page.tsx` and `src/app/pipeline/page.tsx`.

## Data conventions used across the app
- Dates are stored as ISO date-only strings (`YYYY-MM-DD`) and parsed via `new Date(iso + "T00:00:00")`.
- Probabilities are displayed/edited as 0–100; some KPI code tolerates 0–1 inputs (`pRaw <= 1 ? pRaw : pRaw / 100`). Don’t change without migrating existing data.

## AI integration (optional)
- API route: `src/app/api/battery-recommendation/route.ts` (Node runtime). Uses `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`, default `gpt-4o-mini`) and has a 15s timeout.
- When changing prompts, keep outputs short/actionable and do not invent OEM part numbers.

## Robustness expectations
- Validate/filter unknown rows before rendering charts or lists; clamp numeric inputs (see `src/app/components/WhatIfSimulator.tsx`, `src/app/components/AnalyticsCharts.tsx`).
- Prefer absolute imports via `@/…` and avoid touching generated folders (`node_modules/`, `.next/`).

