# AI Copilot Instructions for pipeline-tool

## Project Overview

**pipeline-tool** is a Next.js 16 + React 19 sales pipeline management app with Supabase authentication and real-time dashboard analytics. It provides pipeline tracking (Kanban board & table views), opportunity management, and executive dashboards with KPI visualization.

### Key Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Auth**: Supabase Auth (JWT-based session in cookies)
- **Database**: Supabase PostgreSQL
- **Styling**: Tailwind CSS v4, Recharts for dashboards
- **Build**: npm, ESLint

---

## Architecture Patterns

### Auth Flow
- **Entry**: `/` redirects to `/login` or `/pipeline` based on Supabase session
- **Login** (`/login`): Client-side auth using `supabaseBrowser()`. Form submits to `signInWithPassword()` or `signUp()`
- **Server-side checks**: Dashboard uses `supabaseServer()` with cookie-based auth; redirects to `/login` if no session
- **Pattern**: Always check session before querying data; use `onAuthStateChange()` to initialize, not for continuous polling

**Key file**: [src/lib/supabase/browser.ts](src/lib/supabase/browser.ts), [src/lib/supabase/server.ts](src/lib/supabase/server.ts)

### Data Fetching Architecture
- **Client pages** (`/pipeline`): Fetch data in `useEffect()` with `supabase.from().select()` chains
- **Server pages** (`/dashboard`): Use async server components; query data at request time, pass to client components
- **Related data**: Use Supabase foreign key joins in `.select()` to load accounts/branches inline
  ```tsx
  .select(`id, stage, close_date, accounts ( id, name ), branches ( id, name )`)
  ```

### State Management
- Pipeline uses local React state (useState) with useMemo for derived views (filtered rows, Kanban grouping)
- Dashboard pre-computes KPIs in server component, passes as props to client visualizer

---

## Critical Developer Workflows

### Start Development
```bash
npm run dev          # Starts Next.js dev server on localhost:3000
npm run build        # Full production build (checks TypeScript)
npm run lint         # ESLint check
```

### Environment Setup
Create `.env.local` in project root:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
Without these, auth initialization fails silently at build time.

### Database Schema
Core tables (referenced in code):
- `accounts` - Customer accounts (id, name, is_key_account, notes, created_at)
- `branches` - Sales branches/teams (id, name)
- `opportunities` - Pipeline opportunities (id, account_id, branch_id, stage, close_date, rolling_12m_value, probability, next_action, next_action_due, notes, created_at, updated_at)

---

## Code Patterns & Conventions

### Opportunity CRUD Operations
- **Create/Edit forms**: Convert numeric inputs (rolling_12m_value, probability) via `Number()` with validation (>= 0, 0–100 range)
- **Date handling**: Store as ISO strings (e.g., `"2025-01-25"`); parse with `new Date(iso + "T00:00:00")`
- **Null coalescing**: Use `.accounts?.name ?? "(unknown)"` for optional foreign key lookups
- **Auto-create accounts**: `getOrCreateAccountId()` searches case-insensitively, creates if missing

### Filtering & Derived Views
- **Kanban board**: Groups `filteredRows` by stage; stage is immutable (STAGES constant)
- **Date windows**: Closing in 30/60 days uses `startOfDay()` and `addDays()` to compare date ranges
- **Probability bands**: "0-30", "31-60", "61-100" for quick filters
- **Search**: Case-insensitive substring match on account name

### Dashboard KPI Computation
- Computed server-side in `dashboard/page.tsx` to avoid round-trips
- **Weighted pipeline**: Sum of `(rolling_12m_value * probability / 100)` for active opportunities
- **Active stages**: Exclude "Won" and "Lost"
- **Overdue actions**: `next_action_due < today`
- **Closing 30 days**: `close_date` between today and today+30 (date-only, ignores time)

#### Dashboard KPI Formulas (`dashboard/page.tsx`)

**Weighted Pipeline** (forecast revenue):
```tsx
// Sum of all active opportunities with probability adjustment
weightedPipeline = Σ(rolling_12m_value × (probability / 100))
  where stage ∈ [Prospecting, Qualified, Proposal, Negotiation]
// Example: $100k deal at 50% probability = $50k weighted
// Example: $50k deal at 80% probability = $40k weighted
```

**At-Risk Count** - Deals with overdue actions requiring immediate attention:
```tsx
// Deals where:
// 1. Has next_action_due date AND
// 2. next_action_due < today (ISO string comparison)
// 3. Stage is active (not Won/Lost)
// Used for executive alerts and dashboard highlighting
```

**Closing in 30 Days** - Near-term revenue prediction:
```tsx
// Deals where:
// 1. close_date is set (not null)
// 2. close_date >= today AND close_date <= today+30
// 3. Stage is active
// Uses date-only comparison (ignores time component)
// Formula: startOfDay(today) <= close_date <= startOfDay(today) + 30 days
```

**Win Rate**:
```tsx
// winRate = (count of Won deals) / (count of Won + Lost deals) × 100%
// Only counts closed opportunities; active deals excluded
// Null stages treated as active (not counted in denominator)
```

**Total Active Pipeline** (count):
```tsx
// Count of all opportunities where stage ∈ [Prospecting...Negotiation]
```

### Feature Implementation Patterns

**Custom Hooks** (`src/lib/hooks/`):
- `useKeyboardShortcuts(shortcuts)` - Register dynamic shortcut handlers; skips input fields automatically
- Pattern: Pass object of `{ [key: string]: () => void }` for shortcut callbacks

**Context Providers** (`src/lib/context/`):
- `ThemeProvider` + `useTheme()` - Manages light/dark mode with localStorage fallback and system preference detection
- Handles browser errors gracefully (localStorage disabled in private mode)

**Utility Functions** (`src/lib/utils/`):
- `dealTemplates.ts` - Template CRUD with localStorage persistence (validates structure before use)
- `prediction.ts` - Deal scoring algorithm with bounds checking (0-100 score range)
- `savedViews.ts` - Filter/view persistence with JSON schema validation
- `animations.ts` - Tailwind animation helpers for fade-in, scale, transitions

**Advanced UI Components** (`src/app/components/`):
- `WhatIfSimulator.tsx` - Modal with slider controls for what-if analysis; validates numeric bounds
- `AnalyticsCharts.tsx` - Recharts wrappers with data validation and NaN protection
- `BulkActionsPanel.tsx` - Multi-select operations with user confirmation
- `DealTemplatesSelector.tsx` - Template picker with callback pattern for reusability

### UI Component Props Pattern
- Server components pre-compute and pass data as props (e.g., `kpis`, `charts` objects)
- Client components ("use client") receive props and render charts/tables
- Charts use **Recharts**: BarChart, LineChart, ResponsiveContainer for responsive dashboards

---

## File Organization

```
src/
├── app/
│   ├── page.tsx          # Home (auth redirect router)
│   ├── login/
│   │   └── page.tsx      # Login form, client-side
│   ├── pipeline/
│   │   └── page.tsx      # Pipeline board/table, main feature (1493 lines)
│   ├── dashboard/
│   │   ├── page.tsx      # Server component: KPI computation, data fetching
│   │   └── DashboardClient.tsx  # Client component: charts & display
│   ├── analytics/
│   │   └── page.tsx      # Funnel, cycle time, win/loss analysis
│   ├── components/       # Reusable components
│   │   ├── WhatIfSimulator.tsx
│   │   ├── AnalyticsCharts.tsx
│   │   ├── BulkActionsPanel.tsx
│   │   └── DealTemplatesSelector.tsx
│   ├── layout.tsx        # Root layout (fonts, globals.css, ThemeProvider)
│   └── globals.css
└── lib/
    ├── supabase/
    │   ├── browser.ts    # createBrowserClient for client pages
    │   └── server.ts     # createServerClient for server components
    ├── hooks/
    │   └── useKeyboardShortcuts.ts
    ├── context/
    │   └── ThemeContext.tsx
    └── utils/
        ├── dealTemplates.ts
        ├── prediction.ts
        ├── savedViews.ts
        └── animations.ts
```

---

## Important Notes & Quirks

### Build-Time Serialization
- Environment variables used in server components must be defined before build
- Supabase client creation in useEffect ensures browser-only initialization (avoids hydration mismatch)

### Kanban vs Table Toggle
Pipeline page supports both views (controlled by `viewMode` state). Kanban groups by `stage` (6 predefined stages). Table shows all columns with inline quick-update for stage (optimistic UI).

### Validation Patterns
- **Rolling 12M value**: Must be number >= 0
- **Probability**: Must be integer 0–100
- **Strings**: Trimmed on save; null if empty
- **Dates**: ISO format, nullable

### Authentication Edge Cases
# Copilot instructions (pipeline-tool)

## What this repo is
- Next.js App Router app (Next 16 + React 19 + TypeScript) for sales pipeline + dashboards.
- Data/auth: Supabase Postgres + Supabase Auth.

## Key paths to know
- Pages/routes: `src/app/*` (not `/pages`). Main entrypoints: `src/app/pipeline/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/analytics/page.tsx`, `src/app/login/page.tsx`.
- Supabase clients: `src/lib/supabase/browser.ts` (client-only; returns a safe stub during SSR/build) and `src/lib/supabase/server.ts` (Server Components).
- Reusable UI: `src/app/components/*` (Recharts wrappers, What-If modal, bulk actions, etc.).

## Local workflow
- Run: `npm run dev` (Next dev server), `npm run build`, `npm run lint`, `npm run typecheck`.
- Required env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`).
- Optional: `NEXT_PUBLIC_DEMO_MODE=true` shows the banner (see `src/app/layout.tsx`).

## Auth + data fetching patterns (match existing code)
- Home/login are client pages and wait for `onAuthStateChange(... INITIAL_SESSION ...)` before redirecting (see `src/app/page.tsx`, `src/app/login/page.tsx`).
- Dashboard is a Server Component: create client via `supabaseServer()`, call `supabase.auth.getUser()`, then `redirect("/login")` if not logged in (see `src/app/dashboard/page.tsx`).
- Keep “server fetch, client render”: server computes KPI/props → `DashboardClient` renders charts (`src/app/dashboard/DashboardClient.tsx`).

## Database schema is partially optional (common footgun)
- Canonical checklist: `SUPABASE_SCHEMA_CHECKLIST.md`.
- Optional columns are enabled via idempotent SQL scripts (repo root):
  - `SUPABASE_SQL_sales_person.sql` adds `opportunities.sales_person` (fixes “column opportunities.sales_person does not exist”).
  - Others: `battery_solution`, `vehicle_brand/model`, `owner_user_id`, `next_action_completed_at`, audit fields.

## OpenAI integration (battery recommendations)
- API route: `src/app/api/battery-recommendation/route.ts` (Node runtime). Uses `OPENAI_API_KEY` and optional `OPENAI_MODEL` (default `gpt-4o-mini`), with a 15s timeout.

## Conventions to preserve when editing
- Dates stored as `YYYY-MM-DD` strings for Postgres date columns and parsed via `new Date(iso + "T00:00:00")` (see pipeline/dashboard formatting helpers).
- Probability is treated as either 0–100 or 0–1 in dashboard calculations (`prob = pRaw <= 1 ? pRaw : pRaw / 100`). Don’t “simplify” this without migrating data.
  isDueActionOverdue: boolean // next_action_due < today

  stageProgress: number      // 0-1, stage position in pipeline
