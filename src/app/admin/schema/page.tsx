export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

type CheckResult = {
  key: string;
  label: string;
  status: "ok" | "missing" | "warning";
  detail?: string;
  fix?: string;
};

function parseAllowlist(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.toLowerCase())
  );
}

function isMissingColumnError(message: string | null | undefined, column: string) {
  if (!message) return false;
  const msg = message.toLowerCase();
  const col = column.toLowerCase();
  // Common PostgREST/Postgres variants:
  // - column opportunities.next_action_completed_at does not exist
  // - column "next_action_completed_at" does not exist
  return msg.includes("does not exist") && msg.includes("column") && msg.includes(col);
}

function isMissingTableError(message: string | null | undefined, table: string) {
  if (!message) return false;
  const msg = message.toLowerCase();
  const t = table.toLowerCase();
  // Examples:
  // - relation "opportunity_events" does not exist
  // - Could not find the 'opportunity_events' table
  const mentions = msg.includes(t);
  const missing = msg.includes("does not exist") || msg.includes("could not find") || msg.includes("relation");
  return mentions && missing;
}

async function checkSelect(supabase: Awaited<ReturnType<typeof supabaseServer>>, table: string, columns: string) {
  // Use a HEAD request and limit(0) to validate schema (column/table existence)
  // without scanning any rows. This keeps checks fast even with heavy RLS.
  return supabase.from(table).select(columns, { head: true }).limit(0);
}

export default async function AdminSchemaPage() {
  const supabase = await supabaseServer();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    return (
      <div className="p-6 min-h-screen bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold">Schema Status</h1>
          <p className="mt-4 text-red-600 dark:text-red-400">Auth error: {userErr.message}</p>
        </div>
      </div>
    );
  }

  if (!userData.user) redirect("/login");

  // Optional hardening: restrict this page to admin(s).
  const emailAllow = parseAllowlist(process.env.ADMIN_EMAIL_ALLOWLIST);
  const idAllow = parseAllowlist(process.env.ADMIN_USER_ID_ALLOWLIST);

  const userEmail = (userData.user.email ?? "").toLowerCase();
  const userId = (userData.user.id ?? "").toLowerCase();
  const hasAllowlist = emailAllow.size > 0 || idAllow.size > 0;
  const isAllowed = !hasAllowlist || emailAllow.has(userEmail) || idAllow.has(userId);

  if (!isAllowed) {
    return (
      <div className="p-6 min-h-screen bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Schema Status</h1>
            <Link className="text-sm underline" href="/pipeline">
              Back
            </Link>
          </div>
          <div className="rounded-2xl border border-red-300 bg-red-50 p-6 text-red-950">
            <div className="text-lg font-semibold">Access denied</div>
            <p className="mt-2 text-sm">Your account isn’t on the admin allowlist.</p>
          </div>
        </div>
      </div>
    );
  }

  const results: CheckResult[] = [];

  // Core table.
  const core = await checkSelect(supabase, "opportunities", "id");
  if (core.error) {
    results.push({
      key: "opportunities",
      label: "opportunities table readable",
      status: "warning",
      detail: core.error.message,
      fix: "Check Supabase RLS policies for opportunities.",
    });
  } else {
    results.push({ key: "opportunities", label: "opportunities table readable", status: "ok" });
  }

  const optionalCols: Array<{ col: string; label: string; script: string }> = [
    { col: "sales_person", label: "Sales person column", script: "SUPABASE_SQL_sales_person.sql" },
    { col: "battery_solution", label: "Battery solution column", script: "SUPABASE_SQL_battery_solution.sql" },
    { col: "vehicle_brand", label: "Vehicle brand column", script: "SUPABASE_SQL_vehicle_fields.sql" },
    { col: "vehicle_model", label: "Vehicle model column", script: "SUPABASE_SQL_vehicle_fields.sql" },
    {
      col: "next_action_completed_at",
      label: "Next action completion tracking",
      script: "SUPABASE_SQL_next_action_completed_at.sql",
    },
    {
      col: "next_action_completed_by",
      label: "Next action completion audit (by)",
      script: "SUPABASE_SQL_next_action_audit.sql",
    },
    {
      col: "next_action_completed_note",
      label: "Next action completion audit (note)",
      script: "SUPABASE_SQL_next_action_audit.sql",
    },
    { col: "owner_user_id", label: "Owner assignment (My deals)", script: "SUPABASE_SQL_owner_user_id.sql" },
  ];

  for (const item of optionalCols) {
    const res = await checkSelect(supabase, "opportunities", `id, ${item.col}`);

    if (!res.error) {
      results.push({ key: item.col, label: item.label, status: "ok" });
      continue;
    }

    if (isMissingColumnError(res.error.message, item.col)) {
      results.push({
        key: item.col,
        label: item.label,
        status: "missing",
        detail: `Missing column: ${item.col}`,
        fix: `Run ${item.script} in the Supabase SQL Editor.`,
      });
      continue;
    }

    results.push({
      key: item.col,
      label: item.label,
      status: "warning",
      detail: res.error.message,
      fix: `If the column exists but this check fails, it may be RLS/permissions. Otherwise run ${item.script}.`,
    });
  }

  // Time Machine table.
  const events = await checkSelect(supabase, "opportunity_events", "created_at");
  if (!events.error) {
    results.push({ key: "opportunity_events", label: "Time Machine audit table", status: "ok" });
  } else if (isMissingTableError(events.error.message, "opportunity_events")) {
    results.push({
      key: "opportunity_events",
      label: "Time Machine audit table",
      status: "missing",
      detail: "Missing table: opportunity_events",
      fix: "Run SUPABASE_SQL_opportunity_events_time_machine.sql in the Supabase SQL Editor.",
    });
  } else {
    results.push({
      key: "opportunity_events",
      label: "Time Machine audit table",
      status: "warning",
      detail: events.error.message,
      fix: "If the table exists, this is likely RLS/policy-related. Otherwise run SUPABASE_SQL_opportunity_events_time_machine.sql.",
    });
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  const missingCount = results.filter((r) => r.status === "missing").length;
  const warningCount = results.filter((r) => r.status === "warning").length;

  return (
    <div className="p-6 min-h-screen bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Schema Status</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Quick health-check for Supabase schema features.
            </p>
          </div>
          <div className="flex gap-2">
            <Link className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm" href="/pipeline">
              Back
            </Link>
          </div>
        </div>

        {!hasAllowlist ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <div className="text-sm font-semibold">Admin restriction not configured</div>
            <div className="mt-1 text-sm">
              Any signed-in user can see this page. To restrict it, set <span className="font-mono">ADMIN_EMAIL_ALLOWLIST</span> or <span className="font-mono">ADMIN_USER_ID_ALLOWLIST</span> in Vercel.
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <div className="text-sm text-slate-700 dark:text-slate-200">
            Signed in as <span className="font-mono">{userData.user.email ?? userData.user.id}</span>
          </div>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Summary: {okCount} OK · {missingCount} missing · {warningCount} warnings
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              <tr>
                <th className="text-left px-4 py-3">Check</th>
                <th className="text-left px-4 py-3 w-28">Status</th>
                <th className="text-left px-4 py-3">Details</th>
                <th className="text-left px-4 py-3">Fix</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.key} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-4 py-3 font-medium">{r.label}</td>
                  <td className="px-4 py-3">
                    {r.status === "ok" ? (
                      <span className="rounded-md bg-emerald-100 text-emerald-900 px-2 py-1">OK</span>
                    ) : r.status === "missing" ? (
                      <span className="rounded-md bg-rose-100 text-rose-900 px-2 py-1">Missing</span>
                    ) : (
                      <span className="rounded-md bg-amber-100 text-amber-900 px-2 py-1">Warning</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.detail ?? ""}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.fix ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
          <div className="text-sm font-semibold">Where to run fixes</div>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            Supabase Dashboard → SQL Editor → New query. Scripts are in the repo root, e.g.
            <span className="font-mono"> SUPABASE_SCHEMA_CHECKLIST.md</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
