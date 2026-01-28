"use client";

import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

function money(n: number) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export default function DashboardClient({
  branches,
  selectedBranchId,
  selectedBranchLabel,
  kpis,
  charts,
  atRiskDeals = [],
}: {
  branches: { id: string; name: string }[];
  selectedBranchId: string;
  selectedBranchLabel: string;
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
        <div className="text-center text-gray-600">
          <p>No branches available. Please check your database configuration.</p>
        </div>
      </div>
    );
  }

  const handleNavigateToPipeline = () => {
    try {
      router.push("/pipeline");
    } catch (error) {
      console.error("Navigation failed:", error);
      alert("Failed to navigate to pipeline. Please try again.");
    }
  };

  const handleBranchChange = (id: string) => {
    try {
      router.push(id === "All" ? "/dashboard" : `/dashboard?branch=${encodeURIComponent(id)}`);
    } catch (error) {
      console.error("Navigation failed:", error);
      alert("Failed to change branch. Please try again.");
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Branch: <span className="font-semibold text-gray-800">{selectedBranchLabel}</span>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Branch</span>
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
        <Tile title="Weighted pipeline (12m)" value={money(kpis.weightedPipeline)} color="green" />
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
                    <div className="text-xs text-gray-600">Stage: {deal.stage} · Due: {deal.dueDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">${(Number(deal.value) / 1000).toFixed(1)}k</div>
                    <div className="text-xs text-gray-600">{deal.probability}% prob</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Count by stage">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.byStage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="stage" tick={{ fontSize: 12 }} interval={0} angle={-20} height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="12-month rolling forecast (weighted value)">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.months}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} angle={-20} height={60} />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(value: unknown) => money(Number(value))} />
                <Line type="monotone" dataKey="weighted" strokeWidth={3} dot={false} stroke="#10b981" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
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
    blue: "text-blue-700",
    green: "text-green-700",
    amber: "text-amber-700",
    orange: "text-orange-700",
    red: "text-red-700",
  };

  const darkTextMap = {
    blue: "text-blue-900",
    green: "text-green-900",
    amber: "text-amber-900",
    orange: "text-orange-900",
    red: "text-red-900",
  };

  return (
    <div className={`rounded-2xl border ${colorMap[color]} p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className={`text-sm font-medium ${textMap[color]}`}>{title}</div>
      <div className={`mt-2 text-3xl font-bold ${darkTextMap[color]}`}>{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-sm font-semibold text-gray-800">{title}</div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
