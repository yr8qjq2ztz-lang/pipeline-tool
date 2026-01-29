"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { FunnelChart, CycleTimeChart, WinLossChart } from "@/app/components/AnalyticsCharts";
import type { FunnelData, CycleTimeData } from "@/app/components/AnalyticsCharts";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

const devError = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.error(...args);
};

const STAGES = ["Prospecting", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];

interface OpportunityRow {
  id: string;
  stage: string | null;
  close_date: string | null;
  rolling_12m_value: number | null;
  probability: number | null;
  created_at: string | null;
  sales_person?: string | null;
  accounts?: { name: string }[] | null;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OpportunityRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  function isOpportunityRow(r: unknown): r is OpportunityRow {
    if (!r || typeof r !== "object") return false;
    const rec = r as { id?: unknown };
    return typeof rec.id === "string" && rec.id.length > 0;
  }

  useEffect(() => {
    async function load() {
      try {
        const { data: sub } = supabase.auth.onAuthStateChange(
          async (event: AuthChangeEvent, session: Session | null) => {
            if (event !== "INITIAL_SESSION") return;
            if (!session) {
              router.replace("/login");
              return;
            }

            try {
              setError(null);
              const { data, error: err } = await supabase
                .from("opportunities")
                // `sales_person` is an optional column (see SUPABASE_SCHEMA_CHECKLIST.md).
                .select("id, stage, close_date, rolling_12m_value, probability, created_at, accounts(name)");

              if (err) throw err;
              
              // Validate and filter data
              const validRows = Array.isArray(data) 
                ? data.filter(isOpportunityRow)
                : [];
              
              setRows(validRows);
            } catch (e: unknown) {
              const errorMsg = e instanceof Error ? e.message : "Failed to load analytics";
              devError("Analytics load error:", errorMsg);
              setError(errorMsg);
            } finally {
              setLoading(false);
            }
          }
        );

        return () => sub.subscription.unsubscribe();
      } catch (error) {
        devError("Setup error:", error);
        setError("Failed to initialize analytics");
        setLoading(false);
      }
    }

    load();
  }, [supabase, router]);

  const funnelData = useMemo(() => {
    const data: FunnelData[] = [];

    for (const stage of STAGES) {
      const stageRows = rows.filter((r) => r && r.stage === stage);
      const value = stageRows.reduce((sum, r) => {
        const val = Number(r?.rolling_12m_value ?? 0) || 0;
        const prob = Math.max(0, Math.min(100, Number(r?.probability ?? 0) || 0));
        return sum + (val * (prob / 100));
      }, 0);

      data.push({
        stage,
        count: stageRows.length,
        value: isFinite(value) ? value : 0,
      });
    }

    return data;
  }, [rows]);

  const cycleTimeData = useMemo(() => {
    const data: CycleTimeData[] = [];
    const now = new Date();

    for (const stage of STAGES) {
      const stageRows = rows.filter((r) => r && r.stage === stage);

      const avgDaysInStage =
        stageRows.length > 0
          ? stageRows.reduce((sum, r) => {
              try {
                const createdAt = r?.created_at ? new Date(r.created_at) : new Date();
                const timeDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
                const daysInStage = isFinite(timeDiff) ? timeDiff : 0;
                return sum + daysInStage;
              } catch {
                console.warn("Error calculating days for row:", r);
                return sum;
              }
            }, 0) / stageRows.length
          : 0;

      data.push({
        stage,
        avgDaysInStage: Math.max(0, avgDaysInStage),
        count: stageRows.length,
      });
    }

    return data;
  }, [rows]);

  const winLossData = useMemo(() => {
    const byStage: Record<string, { won: number; lost: number }> = {};

    for (const stage of STAGES.slice(0, 4)) {
      byStage[stage] = { won: 0, lost: 0 };
    }

    rows.forEach((r) => {
      const stage = r.stage || "Unknown";
      if (stage === "Won") {
        for (const key in byStage) {
          byStage[key].won++;
        }
      } else if (stage === "Lost") {
        for (const key in byStage) {
          byStage[key].lost++;
        }
      }
    });

    return Object.entries(byStage).map(([name, data]) => ({
      name,
      ...data,
    }));
  }, [rows]);

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <p className="text-gray-600 dark:text-gray-300">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-slate-950 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics & Insights</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Pipeline metrics and performance analysis
          </p>
        </div>

        <Link
          href="/pipeline"
          className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition"
        >
          Back to Pipeline
        </Link>
      </div>

      {/* Funnel Analysis */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Conversion Funnel</h2>
        <FunnelChart data={funnelData} />
      </div>

      {/* Cycle Time */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Cycle Time by Stage</h2>
        <CycleTimeChart data={cycleTimeData} />
      </div>

      {/* Win/Loss Analysis */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Win/Loss Analysis</h2>
        <WinLossChart data={winLossData} />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-900">
          <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total Opportunities</div>
          <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-2">{rows.length}</div>
        </div>

        <div className="rounded-lg bg-green-50 dark:bg-green-950 p-4 border border-green-200 dark:border-green-900">
          <div className="text-sm text-green-700 dark:text-green-300 font-medium">Won Deals</div>
          <div className="text-3xl font-bold text-green-900 dark:text-green-100 mt-2">
            {rows.filter((r) => r.stage === "Won").length}
          </div>
        </div>

        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-900">
          <div className="text-sm text-red-700 dark:text-red-300 font-medium">Lost Deals</div>
          <div className="text-3xl font-bold text-red-900 dark:text-red-100 mt-2">
            {rows.filter((r) => r.stage === "Lost").length}
          </div>
        </div>

        <div className="rounded-lg bg-purple-50 dark:bg-purple-950 p-4 border border-purple-200 dark:border-purple-900">
          <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Win Rate</div>
          <div className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-2">
            {rows.length > 0
              ? (((rows.filter((r) => r.stage === "Won").length) / rows.length) * 100).toFixed(0)
              : 0}
            %
          </div>
        </div>
      </div>
    </div>
  );
}
