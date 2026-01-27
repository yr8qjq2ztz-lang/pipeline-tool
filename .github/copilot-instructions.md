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
- Signup with email confirmation enabled: User gets "Check your email" message, session is null
- Server-side redirects via `redirect()` not to be wrapped in try/catch; they throw NavigationError
- Browser clients must initialize Supabase in useEffect to avoid build-time errors

---

## Special Features & Implementation Notes

### 1. Keyboard Shortcuts System
- Defined in `pipeline/page.tsx` and passed to `useKeyboardShortcuts()` hook
- Auto-skips input fields; supports single keys (`n`, `f`, `d`), `/` for search, `?` for help
- Registry: `{ n: toggleCreate, f: clearFilters, d: goToDashboard, ...}`

### 2. What-If Simulator
- Interactive modal in `WhatIfSimulator.tsx`; allows probability and value adjustment
- Recalculates weighted pipeline impact in real-time
- Validates slider bounds (0-100 for probability, >0 for value)
- Shows delta from original state

### 3. Deal Prediction Scoring
- Located in `prediction.ts`; analyzes overdue actions, close date, probability
- Returns score 0-100 for deal health
- Used in `pipeline/page.tsx` for deal highlighting and sorting

#### Prediction Score Algorithm (`prediction.ts`)

Input factors validated with bounds:
```tsx
interface DealScoreFactors {
  ageInDays: number          // Days since opp created
  daysToClose: number        // Days until close_date (can be negative)
  probability: number        // 0-100, clamped [0, 100]
  hasDueAction: boolean      // next_action exists
  isDueActionOverdue: boolean // next_action_due < today
  stageProgress: number      // 0-1, stage position in pipeline
  valueScore: number         // rolling_12m_value for confidence weighting
}
```

**Scoring Factors** (modifies `baseScore` starting at `probability`):
1. **Overdue actions** (highest risk):
   - `isDueActionOverdue` → baseScore -= 20 (strong penalty)
   - `hasDueAction` → baseScore += 5 (action on track)

2. **Close date proximity** (urgency signal):
   - Past due (`daysToClose < 0`) → baseScore -= 25 (likely stalled)
   - Closing in <7 days → baseScore += 15 (imminent closure)
   - Closing in <30 days → baseScore += 10 (reasonable timeline)

3. **Deal age vs stage progress** (stalling detection):
   - Expected age = `(stageProgress + 0.5) × 30 × 4` days
   - If `ageInDays > expectedAge × 1.5` → baseScore -= 15 (stalled)
   - If `ageInDays < expectedAge × 0.5` → baseScore += 10 (fast progress)

4. **Value-based confidence** (affects confidence score, not likelihood):
   - `valueScore > $100k` → confidence += 25 (high-value deals scrutinized)
   - `valueScore < $10k` → confidence += 10 (small deals quick)

**Output**:
```tsx
{
  closureLikelihood: 0-100,        // Score after all adjustments, clamped [0, 100]
  confidence: 0-100,              // How sure we are (depends on value, overdue actions)
  riskFactors: string[],          // ["Overdue action", "Stalled deal", ...]
  recommendedActions: string[],   // ["Follow up", "Review strategy", ...]
  trend: "improving"|"declining"|"stable" // baseScore vs original probability
}
```

**Bounds Checking**:
- All numeric inputs validated with `Number.isFinite()` before use
- Probabilities clamped to [0, 100]
- Stage progress clamped to [0, 1]
- Final scores clamped to [0, 100]
- Invalid input object → return safe default (score 0, all risk factors)

### 4. Analytics Dashboard
- Multi-chart view: Funnel, Win/Loss Rate, Cycle Time, Stage Aging
- Data validation and NaN protection in `AnalyticsCharts.tsx`
- Computed on-demand from opportunity data (no separate analytics table)

#### Analytics Computation Details (`analytics/page.tsx`)

**Funnel Analysis** - Shows deal progression and weighted value through each stage:
```tsx
// For each stage: count deals + sum weighted value
value = Σ(rolling_12m_value × (probability / 100)) for all deals in stage
count = number of opportunities in stage
// Displayed: count + value in funnel chart
```

**Cycle Time by Stage** - Average days deals spend at each stage:
```tsx
// For each stage:
avgDaysInStage = Σ(now - created_at) / count
// Measures how long deals stay before progression
// Uses created_at field (when opp was created); note: doesn't reset per stage transition
// Includes all deals currently in stage, regardless of how long they've been there
```

**Win/Loss Analysis** - Conversion rates showing how many deals closed at each stage:
```tsx
// For each pre-final stage (Prospecting through Negotiation):
// Count how many "Won" deals exist across entire pipeline
// Count how many "Lost" deals exist across entire pipeline
// Ratio shows % of deals that won vs lost from that stage baseline
// Used to identify leakiest stages (highest loss rate)
```

**Key Metrics** - Aggregate KPIs:
- **Total Opportunities**: All records regardless of stage
- **Won Deals**: Count where `stage === "Won"`
- **Lost Deals**: Count where `stage === "Lost"`
- **Win Rate**: (Won Deals / Total Opportunities) × 100%

**Data Validation**:
- Array type-check: `Array.isArray(data) ? filter : []`
- Valid rows: `r && typeof r === 'object' && r.id`
- Number safety: `isFinite(value) ? value : 0`
- Date parsing: Try/catch on `new Date()` with fallback to current time

### 5. Dark Mode + System Preference
- `ThemeContext.tsx` manages state and localStorage persistence
- System preference detection via `window.matchMedia("(prefers-color-scheme: dark)")`
- Gracefully handles localStorage unavailable (private browsing)

---

## Integration Points & Dependencies

- **Supabase SDKs**: `@supabase/ssr` (auth/session), `@supabase/supabase-js` (queries)
- **Tailwind**: Utility-first CSS v4; globals.css imported in layout
- **Recharts**: Lightweight charting; passed data as `data` prop, config via XAxis/YAxis/Tooltip
- **Next.js routing**: App Router; pages auto-route from file path; `useRouter()` for navigation, `redirect()` for server-side redirects
- **localStorage**: Used for theme, saved views, deal templates; always wrapped in try/catch for error tolerance

---

## When Implementing New Features

1. **Data model first**: Define Supabase table/columns if new entity type
2. **Auth check**: Ensure page checks session; use server-side redirect for protected routes
3. **Server fetch, client render**: Data fetching in server components or useEffect; charts/forms in client
4. **Type safety**: Define TypeScript types for table shapes (Branch, Account, OpportunityRow patterns)
5. **Validation**: Validate before Supabase insert/update; show error toast/modal
6. **Robustness**: Check for null/undefined, array bounds, number bounds (NaN/Infinity); handle localStorage unavailable
7. **Accessibility**: Skip event handlers for input fields; use semantic HTML when possible
8. **Testing**: `npm run build` catches type errors; manual test on localhost:3000

---

## Robustness Principles

All new code should follow patterns in [ROBUSTNESS.md](ROBUSTNESS.md):
- **Input validation** at function entry (type, null, range checks)
- **Number safety**: Check `Number.isFinite()` before calculations; use `Math.max/min` for bounds
- **Error isolation**: Wrap risky operations in try/catch (especially event listeners, localStorage, DOM access)
- **Type narrowing**: Use TypeScript to eliminate null/undefined at compile time; runtime checks as fallback

