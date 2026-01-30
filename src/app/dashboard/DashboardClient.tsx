"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import LazyOnVisible from "@/app/components/LazyOnVisible";

const DashboardCharts = dynamic(() => import("./DashboardCharts"), {
  ssr: false,
  loading: () => (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Count by stage</div>
        <div className="mt-4 h-72 w-full animate-pulse rounded-lg bg-slate-200" />
      </div>
      <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">12 MTH rolling forecast (weighted value)</div>
        <div className="mt-4 h-72 w-full animate-pulse rounded-lg bg-slate-200" />
      </div>
    </div>
  ),
});

const devError = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.error(...args);
};

function money(n: number) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function formatNZDate(iso: string) {
  if (!iso) return "";
  // Expecting YYYY-MM-DD from Postgres date
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-NZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export default function DashboardClient({
  branches,
  selectedBranchId,
  selectedBranchLabel,
  salesPeople,
  selectedSalesPerson,
  kpis,
  charts,
  atRiskDeals = [],
}: {
  branches: { id: string; name: string }[];
  selectedBranchId: string;
  selectedBranchLabel: string;
  salesPeople: string[];
  selectedSalesPerson: string;
  kpis: {
    openCount: number;
    weightedPipeline: number;
    closing30: number;
    stale: number;
    overdueActions: number;
  };
  charts: {
    byStage: { stage: string; count: number; weighted: number }[];
    months: { label: string; weighted: number; count: number }[];
  };
  atRiskDeals?: Array<{
    accountName: string;
    stage: string;
    value: number;
    probability: number;
    dueDate: string;
  }>;
}) {
  const router = useRouter();

  if (!branches?.length) {
    return (
      <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="text-center text-slate-700">
          <p>No branches available. Please check your database configuration.</p>
        </div>
      </div>
    );
  }

  const handleNavigateToPipeline = () => {
    try {
      router.push("/pipeline");
    } catch (error) {
      devError("Navigation failed:", error);
      alert("Failed to navigate to pipeline. Please try again.");
    }
  };

  const handleBranchChange = (id: string) => {
    try {
      const params = new URLSearchParams();
      if (id !== "All") params.set("branch", id);
      if (selectedSalesPerson !== "All") params.set("salesPerson", selectedSalesPerson);
      const qs = params.toString();
      router.push(qs ? `/dashboard?${qs}` : "/dashboard");
    } catch (error) {
      devError("Navigation failed:", error);
      alert("Failed to change branch. Please try again.");
    }
  };

  const handleSalesPersonChange = (sp: string) => {
    try {
      const params = new URLSearchParams();
      if (selectedBranchId !== "All") params.set("branch", selectedBranchId);
      if (sp !== "All") params.set("salesPerson", sp);
      const qs = params.toString();
      router.push(qs ? `/dashboard?${qs}` : "/dashboard");
    } catch (error) {
      devError("Navigation failed:", error);
      alert("Failed to change sales person. Please try again.");
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">Dashboard</h1>
          <p className="text-sm text-slate-700 mt-1">
            Branch: <span className="font-semibold text-slate-900">{selectedBranchLabel}</span>
            {selectedSalesPerson !== "All" ? (
              <>
                {" "}· Sales person: <span className="font-semibold text-slate-900">{selectedSalesPerson}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">Branch</span>
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all cursor-pointer hover:border-gray-400"
              value={selectedBranchId}
              onChange={(e) => handleBranchChange(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">Sales person</span>
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all cursor-pointer hover:border-gray-400"
              value={selectedSalesPerson}
              onChange={(e) => handleSalesPersonChange(e.target.value)}
            >
              {salesPeople.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleNavigateToPipeline}
            className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 text-sm font-medium shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all"
          >
            Go to Pipeline
          </button>

          <button
            onClick={() => {
              const csv = "Metric,Value\nOpen Opportunities," + kpis.openCount + "\nWeighted Pipeline," + Math.round(kpis.weightedPipeline) + "\nClosing in 30 Days," + kpis.closing30 + "\nStale Deals," + kpis.stale + "\nOverdue Actions," + kpis.overdueActions;
              const blob = new Blob([csv], { type: "text/csv" });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `pipeline-dashboard-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
            }}
            className="rounded-lg border border-gray-300 text-gray-700 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-50 hover:border-gray-400 transition-all"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Tile title="Open opportunities" value={String(kpis.openCount)} color="blue" />
        <Tile title="Weighted pipeline (12 MTH)" value={money(kpis.weightedPipeline)} color="green" />
        <Tile title="Closing in 30 days" value={String(kpis.closing30)} color="amber" />
        <Tile title="Stale deals" value={String(kpis.stale)} color="orange" />
        <Tile title="Overdue actions" value={String(kpis.overdueActions)} color="red" />
      </div>

      {/* At-Risk Alerts */}
      {atRiskDeals.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="text-lg font-semibold text-red-900">⚠️ Deals at Risk</div>
            <span className="inline-block px-2 py-1 text-xs font-semibold bg-red-200 text-red-900 rounded-full">{atRiskDeals.length}</span>
          </div>
          <div className="space-y-2">
            {atRiskDeals.map((deal, idx) => (
              <div key={idx} className="bg-white rounded-lg p-3 border border-red-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{deal.accountName}</div>
                    <div className="text-xs font-medium text-slate-700">Stage: {deal.stage} · Due: {formatNZDate(deal.dueDate)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">${(Number(deal.value) / 1000).toFixed(1)}k</div>
                    <div className="text-xs font-medium text-slate-700">{deal.probability}% prob</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <LazyOnVisible
        rootMargin="400px"
        minHeight={340}
        placeholder={
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Count by stage</div>
              <div className="mt-4 h-72 w-full animate-pulse rounded-lg bg-slate-200" />
            </div>
            <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">12 MTH rolling forecast (weighted value)</div>
              <div className="mt-4 h-72 w-full animate-pulse rounded-lg bg-slate-200" />
            </div>
          </div>
        }
      >
        <DashboardCharts charts={charts} />
      </LazyOnVisible>
    </div>
  );
}

function Tile({ title, value, color = "blue" }: { title: string; value: string; color?: "blue" | "green" | "amber" | "orange" | "red" }) {
  const colorMap = {
    blue: "border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100",
    green: "border-green-200 bg-gradient-to-br from-green-50 to-green-100",
    amber: "border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100",
    orange: "border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100",
    red: "border-red-200 bg-gradient-to-br from-red-50 to-red-100",
  };

  const textMap = {
    blue: "text-blue-800",
    green: "text-green-800",
    amber: "text-amber-800",
    orange: "text-orange-800",
    red: "text-red-800",
  };

  const darkTextMap = {
    blue: "text-slate-950",
    green: "text-slate-950",
    amber: "text-slate-950",
    orange: "text-slate-950",
    red: "text-slate-950",
  };

  return (
    <div className={`rounded-2xl border ${colorMap[color]} p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className={`text-sm font-semibold ${textMap[color]}`}>{title}</div>
      <div className={`mt-2 text-3xl font-bold ${darkTextMap[color]}`}>{value}</div>
    </div>
  );
}

// Card is now rendered inside the dynamically loaded chart bundle.
