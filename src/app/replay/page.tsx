export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import ReplayClient from "./ReplayClient";

type OpportunityNowRow = {
  id: string;
  stage: string | null;
  close_date: string | null;
  rolling_12m_value: number | null;
  probability: number | null;
  created_at: string | null;
  next_action_due?: string | null;
  next_action_completed_at?: string | null;
};

type OpportunityEventRow = {
  created_at: string;
  opportunity_id: string;
  event_type: "INSERT" | "UPDATE" | "DELETE";
  old_row: unknown | null;
  new_row: unknown | null;
  actor_user_id?: string | null;
};

function isMissingTableError(message: string | undefined | null, tableName: string) {
  if (!message) return false;
  const msg = message.toLowerCase();
  const name = tableName.toLowerCase();

  // Examples:
  // - relation "opportunity_events" does not exist
  // - Could not find the 'opportunity_events' table
  const mentions = msg.includes(name);
  const missing = msg.includes("does not exist") || msg.includes("could not find") || msg.includes("relation");
  return mentions && missing;
}

export default async function ReplayPage() {
  const supabase = await supabaseServer();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const nowRes = await supabase
    .from("opportunities")
    .select("id, stage, close_date, rolling_12m_value, probability, created_at, next_action_due, next_action_completed_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (nowRes.error) {
    return (
      <div className="p-6 min-h-screen bg-white dark:bg-slate-950">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Pipeline Time Machine</h1>
            <Link className="text-sm underline" href="/pipeline">Back</Link>
          </div>
          <p className="mt-6 text-red-600 dark:text-red-400">Failed to load opportunities: {nowRes.error.message}</p>
        </div>
      </div>
    );
  }

  // Events: we pull the most recent N events (keeps payload bounded) and let the UI build a timeline.
  // You can increase limits once you love the feature.
  const eventsRes = await supabase
    .from("opportunity_events")
    .select("created_at, opportunity_id, event_type, old_row, new_row, actor_user_id")
    .order("created_at", { ascending: false })
    .limit(8000);

  const opportunitiesNow = (nowRes.data ?? []) as unknown as OpportunityNowRow[];

  if (eventsRes.error) {
    const missing = isMissingTableError(eventsRes.error.message, "opportunity_events");
    return (
      <div className="p-6 min-h-screen bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Pipeline Time Machine</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Rewind your pipeline like it’s a documentary.</p>
            </div>
            <Link className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm" href="/pipeline">Back</Link>
          </div>

          {missing ? (
            <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
              <div className="text-lg font-semibold">One-time setup required</div>
              <p className="mt-2 text-sm">
                The Time Machine needs an audit log table. Run the SQL in
                <span className="font-mono"> SUPABASE_SQL_opportunity_events_time_machine.sql</span> in your Supabase SQL editor.
              </p>
              <p className="mt-3 text-xs opacity-80">
                This is additive-only: it creates <span className="font-mono">opportunity_events</span> and a trigger to log future changes.
              </p>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-red-300 bg-red-50 p-6 text-red-950">
              <div className="text-lg font-semibold">Couldn’t load events</div>
              <p className="mt-2 text-sm">{eventsRes.error.message}</p>
            </div>
          )}

          <div className="mt-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
            <div className="text-sm font-semibold">What you’ll get once enabled</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <li>- A timeline slider to replay KPIs over time</li>
              <li>- A “what changed” panel showing the deals that moved the needle</li>
              <li>- Zero changes to your existing workflow</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const events = (eventsRes.data ?? []) as unknown as OpportunityEventRow[];

  return (
    <ReplayClient opportunitiesNow={opportunitiesNow} events={events} />
  );
}
