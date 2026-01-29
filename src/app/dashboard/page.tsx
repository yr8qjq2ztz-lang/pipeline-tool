export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";
import { supabaseServer } from "@/lib/supabase/server";

type SearchParams = {
  branch?: string; // we'll use branch UUID here
  salesPerson?: string;
};

type Branch = { id: string; name: string };

type Opportunity = {
  id: string;
  account_id?: string | null;
  branch_id: string | null;
  sales_person?: string | null;
  stage: string | null;
  close_date: string | null;
  rolling_12m_value: number | null;
  probability: number | null;
  next_action_due: string | null;
  next_action_completed_at?: string | null;
  created_at: string | null;
  accounts?: { id: string; name: string | null }[] | null;
  branches?: { id: string; name: string | null }[] | null;
};

function isMissingColumnError(message: string | undefined | null, column: string) {
  if (!message) return false;
  const msg = message.toLowerCase();
  const col = column.toLowerCase();

  // Postgres/PostgREST error messages vary by adapter/version. Examples:
  // - "column opportunities.sales_person does not exist"
  // - "column \"sales_person\" does not exist"
  // - "unknown column sales_person"
  const mentionsColumn = msg.includes("column") || msg.includes("unknown column");
  const mentionsName = msg.includes(`opportunities.${col}`) || msg.includes(col);
  const missing = msg.includes("does not exist") || msg.includes("unknown column");

  return mentionsColumn && mentionsName && missing;
}

function isMissingRelationshipOrTableError(message: string | undefined | null, tableOrRelation: string) {
  if (!message) return false;
  const msg = message.toLowerCase();
  const name = tableOrRelation.toLowerCase();

  // Examples seen from PostgREST/Supabase:
  // - "Could not find a relationship between 'opportunities' and 'accounts' in the schema cache"
  // - "relation \"accounts\" does not exist"
  // - "Could not find the 'accounts' table"
  const isRelationship = msg.includes("relationship") && msg.includes(name);
  const isSchemaCache = msg.includes("schema cache") && msg.includes(name);
  const isRelationMissing = msg.includes("relation") && msg.includes(name) && msg.includes("does not exist");

  return isRelationship || isSchemaCache || isRelationMissing;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shortId(id: string) {
  return id ? `${id.slice(0, 8)}…` : "";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  try {
    const params = await searchParams;
    const selectedBranchId = params.branch && params.branch !== "All" ? params.branch : "All";
    let selectedSalesPerson = params.salesPerson && params.salesPerson !== "All" ? params.salesPerson : "All";

    const supabase = await supabaseServer();

  // Must be logged in
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  // Try to load branch names if you have a branches table (optional).
  // If not present, we fall back to showing branch UUIDs.
    let branches: Branch[] = [];
    const branchesRes = await supabase.from("branches").select("id,name").order("name");
    if (!branchesRes.error && branchesRes.data) {
      branches = branchesRes.data as Branch[];
    }

  // Pull opportunities.
  // Several fields are OPTIONAL and/or depend on FK relationships:
  // - opportunities.sales_person (optional column)
  // - opportunities.next_action_completed_at (optional column)
  // - embedded selects accounts(...), branches(...) require relationships/tables
    const scalarBase =
      "id, account_id, branch_id, stage, close_date, rolling_12m_value, probability, next_action_due, created_at";

    let hasSalesPersonColumn = true;
    let hasCompletionColumn = true;
    let hasEmbeddedJoins = true;

    const buildSelect = () => {
      const fields: string[] = [scalarBase];
      if (hasSalesPersonColumn) fields.push("sales_person");
      if (hasCompletionColumn) fields.push("next_action_completed_at");
      if (hasEmbeddedJoins) fields.push("accounts(id, name)", "branches(id, name)");
      return fields.join(", ");
    };

    const runQuery = async () => {
      let q = supabase.from("opportunities").select(buildSelect());

      if (selectedBranchId !== "All") {
        q = q.eq("branch_id", selectedBranchId);
      }

      if (hasSalesPersonColumn && selectedSalesPerson !== "All") {
        q = q.eq("sales_person", selectedSalesPerson);
      }

      return await q;
    };

    // Attempt query; progressively degrade on common schema mismatches.
    let res = await runQuery();
    if (res.error && isMissingColumnError(res.error.message, "sales_person")) {
      hasSalesPersonColumn = false;
      selectedSalesPerson = "All";
      res = await runQuery();
    }
    if (res.error && isMissingColumnError(res.error.message, "next_action_completed_at")) {
      hasCompletionColumn = false;
      res = await runQuery();
    }
    if (
      res.error &&
      (isMissingRelationshipOrTableError(res.error.message, "accounts") ||
        isMissingRelationshipOrTableError(res.error.message, "branches"))
    ) {
      hasEmbeddedJoins = false;
      res = await runQuery();
    }

    if (res.error) throw new Error(res.error.message);

    const data = (res.data ?? []) as unknown as Opportunity[];

  const salesPeople = hasSalesPersonColumn
    ? Array.from(
        new Set(
          data
            .map((r) => String(r.sales_person ?? "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b))
    : [];

  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);

  const CLOSED = new Set(["Won", "Lost"]);

  // KPIs
  let openCount = 0;
  let weightedPipeline = 0;
  let closing30 = 0;
  let stale = 0;
  let overdueActions = 0;

  // Charts
  const stageMap = new Map<string, { stage: string; count: number; weighted: number }>();

  const months: { key: string; label: string; weighted: number; count: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      key: monthKey(d),
      label: d.toLocaleString("en-NZ", { month: "short", year: "2-digit" }),
      weighted: 0,
      count: 0,
    });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i] as const));

  // branch dropdown source:
  // - if branches table exists, use it
  // - else build from distinct IDs in opportunities
    const branchIdsFromOpps = Array.from(
      new Set(data.map((r) => String(r.branch_id ?? "")))
    ).filter(Boolean);
  const dropdownBranches =
    branches.length > 0
      ? [{ id: "All", name: "All" }, ...branches]
      : [{ id: "All", name: "All" }, ...branchIdsFromOpps.map((id) => ({ id, name: shortId(id) }))];

  const branchNameById = new Map(dropdownBranches.map((b) => [b.id, b.name] as const));

    for (const r of data) {
    const stage = String(r.stage ?? "Unstaged");
    const isClosed = CLOSED.has(stage);

    const closeDate = r.close_date ? new Date(r.close_date) : null;
    const nextDue = r.next_action_due ? new Date(r.next_action_due) : null;
    const isNextActionCompleted = Boolean(r.next_action_completed_at);
    const createdAt = r.created_at ? new Date(r.created_at) : null;

    const value = r.rolling_12m_value == null ? 0 : Number(r.rolling_12m_value);
    const pRaw = r.probability == null ? 0 : Number(r.probability);
    const prob = pRaw <= 1 ? pRaw : pRaw / 100; // handles 0–1 or 0–100
    const weighted = value * prob;

    if (!isClosed) {
      openCount += 1;
      weightedPipeline += weighted;

      if (closeDate && closeDate <= in30) closing30 += 1;

      // “Stale” rule (simple + useful):
      // - next action overdue OR
      // - no next action and created > 30 days ago
      if (!isNextActionCompleted && nextDue && nextDue < now) {
        overdueActions += 1;
        stale += 1;
      } else if (!nextDue && createdAt) {
        const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays >= 30) stale += 1;
      }
    }

    // Stage chart (include all, but you can make it open-only by wrapping in !isClosed)
    const existing = stageMap.get(stage) ?? { stage, count: 0, weighted: 0 };
    existing.count += 1;
    existing.weighted += weighted;
    stageMap.set(stage, existing);

    // 12 MTH forecast chart (open-only, uses close_date)
    if (!isClosed && closeDate) {
      const mk = monthKey(closeDate);
      const idx = monthIndex.get(mk);
      if (idx != null) {
        months[idx].weighted += weighted;
        months[idx].count += 1;
      }
    }
  }

  const byStage = Array.from(stageMap.values()).sort((a, b) => b.count - a.count);

  // Collect at-risk deals from filtered data
    const atRiskDeals = data
    .filter((r) => {
      const nextDue = r.next_action_due ? new Date(r.next_action_due) : null;
      const stage = r.stage ?? "";
      return !CLOSED.has(stage) && !r.next_action_completed_at && nextDue && nextDue < now;
    })
    .slice(0, 5) // top 5
    .map((r) => ({
      accountName: r.accounts?.[0]?.name ?? (r.account_id ? shortId(String(r.account_id)) : "Unknown"),
      stage: r.stage ?? "",
      value: Number(r.rolling_12m_value ?? 0),
      probability: Number(r.probability ?? 0),
      dueDate: r.next_action_due ?? "",
    }));

    return (
      <DashboardClient
        branches={dropdownBranches}
        selectedBranchId={selectedBranchId}
        selectedBranchLabel={branchNameById.get(selectedBranchId) ?? (selectedBranchId === "All" ? "All" : shortId(selectedBranchId))}
        salesPeople={hasSalesPersonColumn ? ["All", ...salesPeople] : ["All"]}
        selectedSalesPerson={selectedSalesPerson}
        kpis={{
          openCount,
          weightedPipeline,
          closing30,
          stale,
          overdueActions,
        }}
        charts={{
          byStage,
          months,
        }}
        atRiskDeals={atRiskDeals}
      />
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error loading dashboard";
    return (
      <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <div className="text-lg font-semibold text-red-900">Dashboard Error</div>
            <div className="mt-2 text-sm text-red-700">
              There was a problem loading the dashboard. This usually means a column name doesn’t match your table structure.
            </div>
            <pre className="mt-4 text-xs whitespace-pre-wrap bg-red-100 p-3 rounded-lg text-red-800 overflow-auto">
              {message}
            </pre>
          </div>
        </div>
      </div>
    );
  }
}
