"use client";

import Link from "next/link";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { CycleTimeData, FunnelData, WinLossData } from "@/app/components/AnalyticsCharts";
import LazyOnVisible from "@/app/components/LazyOnVisible";

const ChartSkeleton = ({ label }: { label: string }) => (
  <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 p-4">
    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</div>
    <div className="mt-3 h-[300px] w-full animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-700/40" />
  </div>
);

const FunnelChart = dynamic(
  () => import("@/app/components/AnalyticsCharts").then((m) => m.FunnelChart),
  { ssr: false, loading: () => <ChartSkeleton label="Loading funnel…" /> }
);
const CycleTimeChart = dynamic(
  () => import("@/app/components/AnalyticsCharts").then((m) => m.CycleTimeChart),
  { ssr: false, loading: () => <ChartSkeleton label="Loading cycle time…" /> }
);
const WinLossChart = dynamic(
  () => import("@/app/components/AnalyticsCharts").then((m) => m.WinLossChart),
  { ssr: false, loading: () => <ChartSkeleton label="Loading win/loss…" /> }
);

export default function AnalyticsClient({
  funnelData,
  cycleTimeData,
  winLossData,
  totalOpportunities,
  wonDeals,
  lostDeals,
}: {
  funnelData: FunnelData[];
  cycleTimeData: CycleTimeData[];
  winLossData: WinLossData[];
  totalOpportunities: number;
  wonDeals: number;
  lostDeals: number;
}) {
  const winRate = useMemo(() => {
    if (!Number.isFinite(totalOpportunities) || totalOpportunities <= 0) return 0;
    if (!Number.isFinite(wonDeals) || wonDeals < 0) return 0;
    return Math.round((wonDeals / totalOpportunities) * 100);
  }, [totalOpportunities, wonDeals]);

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
        <LazyOnVisible
          rootMargin="400px"
          minHeight={360}
          placeholder={<ChartSkeleton label="Funnel chart will load shortly…" />}
        >
          <FunnelChart data={funnelData} />
        </LazyOnVisible>
      </div>

      {/* Cycle Time */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Cycle Time by Stage</h2>
        <LazyOnVisible
          rootMargin="400px"
          minHeight={360}
          placeholder={<ChartSkeleton label="Cycle time chart will load shortly…" />}
        >
          <CycleTimeChart data={cycleTimeData} />
        </LazyOnVisible>
      </div>

      {/* Win/Loss Analysis */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Win/Loss Analysis</h2>
        <LazyOnVisible
          rootMargin="400px"
          minHeight={360}
          placeholder={<ChartSkeleton label="Win/loss chart will load shortly…" />}
        >
          <WinLossChart data={winLossData} />
        </LazyOnVisible>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-900">
          <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total Opportunities</div>
          <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-2">{totalOpportunities}</div>
        </div>

        <div className="rounded-lg bg-green-50 dark:bg-green-950 p-4 border border-green-200 dark:border-green-900">
          <div className="text-sm text-green-700 dark:text-green-300 font-medium">Won Deals</div>
          <div className="text-3xl font-bold text-green-900 dark:text-green-100 mt-2">{wonDeals}</div>
        </div>

        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-900">
          <div className="text-sm text-red-700 dark:text-red-300 font-medium">Lost Deals</div>
          <div className="text-3xl font-bold text-red-900 dark:text-red-100 mt-2">{lostDeals}</div>
        </div>

        <div className="rounded-lg bg-purple-50 dark:bg-purple-950 p-4 border border-purple-200 dark:border-purple-900">
          <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Win Rate</div>
          <div className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-2">{winRate}%</div>
        </div>
      </div>
    </div>
  );
}
