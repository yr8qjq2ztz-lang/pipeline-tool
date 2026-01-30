export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import AnalyticsClient from "./AnalyticsClient";
import { supabaseServer } from "@/lib/supabase/server";

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

type FunnelData = {
  stage: string;
  count: number;
  value: number;
};

type CycleTimeData = {
  stage: string;
  avgDaysInStage: number;
  count: number;
};

type WinLossData = {
  name: string;
  won: number;
  lost: number;
};

function isOpportunityRow(r: unknown): r is OpportunityRow {
  if (!r || typeof r !== "object") return false;
  const rec = r as { id?: unknown };
  return typeof rec.id === "string" && rec.id.length > 0;
}

function safeDateFromIso(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function computeFunnel(rows: OpportunityRow[]): FunnelData[] {
  const data: FunnelData[] = [];

  for (const stage of STAGES) {
    const stageRows = rows.filter((r) => r && r.stage === stage);
    const value = stageRows.reduce((sum, r) => {
      const val = Number(r?.rolling_12m_value ?? 0) || 0;
      const prob = Math.max(0, Math.min(100, Number(r?.probability ?? 0) || 0));
      return sum + val * (prob / 100);
    }, 0);

    data.push({
      stage,
      count: stageRows.length,
      value: Number.isFinite(value) ? value : 0,
    });
  }

  return data;
}

function computeCycleTime(rows: OpportunityRow[]): CycleTimeData[] {
  const now = new Date();
  const data: CycleTimeData[] = [];

  for (const stage of STAGES) {
    const stageRows = rows.filter((r) => r && r.stage === stage);
    const avgDaysInStage =
      stageRows.length > 0
        ? stageRows.reduce((sum, r) => {
            const createdAt = safeDateFromIso(r?.created_at ?? null) ?? now;
            const timeDiffDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
            const days = Number.isFinite(timeDiffDays) ? timeDiffDays : 0;
            return sum + Math.max(0, days);
          }, 0) / stageRows.length
        : 0;

    data.push({
      stage,
      avgDaysInStage: Math.max(0, avgDaysInStage),
      count: stageRows.length,
    });
  }

  return data;
}

function computeWinLoss(rows: OpportunityRow[]): WinLossData[] {
  const byStage: Record<string, { won: number; lost: number }> = {};
  for (const stage of STAGES.slice(0, 4)) {
    byStage[stage] = { won: 0, lost: 0 };
  }

  rows.forEach((r) => {
    const stage = r.stage || "Unknown";
    if (stage === "Won") {
      for (const key in byStage) byStage[key].won++;
    } else if (stage === "Lost") {
      for (const key in byStage) byStage[key].lost++;
    }
  });

  return Object.entries(byStage).map(([name, data]) => ({ name, ...data }));
}

export default async function AnalyticsPage() {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data, error } = await supabase
    .from("opportunities")
    .select("id, stage, close_date, rolling_12m_value, probability, created_at");

  if (error) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="text-red-600 dark:text-red-400">Failed to load analytics.</div>
      </div>
    );
  }

  const rows = Array.isArray(data) ? data.filter(isOpportunityRow) : [];
  const funnelData = computeFunnel(rows);
  const cycleTimeData = computeCycleTime(rows);
  const winLossData = computeWinLoss(rows);

  const totalOpportunities = rows.length;
  const wonDeals = rows.filter((r) => r.stage === "Won").length;
  const lostDeals = rows.filter((r) => r.stage === "Lost").length;

  return (
    <AnalyticsClient
      funnelData={funnelData}
      cycleTimeData={cycleTimeData}
      winLossData={winLossData}
      totalOpportunities={totalOpportunities}
      wonDeals={wonDeals}
      lostDeals={lostDeals}
    />
  );
}
