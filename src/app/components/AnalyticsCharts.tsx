"use client";

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export interface FunnelData {
  stage: string;
  count: number;
  value: number;
}

export interface CycleTimeData {
  stage: string;
  avgDaysInStage: number;
  count: number;
}

export interface WinLossData {
  name: string;
  won: number;
  lost: number;
}

export function FunnelChart({ data }: { data: FunnelData[] }) {
  // Validate and filter data
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="p-4 text-center text-gray-600 dark:text-gray-400">
        No funnel data available
      </div>
    );
  }

  // Filter valid entries and ensure proper types
  const validData = data.filter((d) => {
    if (!d || typeof d !== "object") return false;
    if (typeof d.count !== "number" || d.count < 0 || !isFinite(d.count)) return false;
    if (typeof d.value !== "number" || d.value < 0 || !isFinite(d.value)) return false;
    if (!d.stage || typeof d.stage !== "string") return false;
    return true;
  });

  if (validData.length === 0) {
    return (
      <div className="p-4 text-center text-gray-600 dark:text-gray-400">
        No valid funnel data available
      </div>
    );
  }

  const total = Math.max(validData[0]?.count || 1, 1);
  const chartData = validData.map((d, i) => {
    const percentage = total > 0 ? ((d.count / total) * 100) : 0;
    const conversion = i === 0 ? 100 : total > 0 ? ((validData[i].count / validData[i - 1].count) * 100) : 0;
    
    return {
      ...d,
      percentage: isFinite(percentage) ? percentage.toFixed(1) : "0",
      conversion: isFinite(conversion) ? conversion.toFixed(1) : "0",
    };
  });

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="stage" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#3b82f6" name="Opportunities" />
            <Bar dataKey="value" fill="#8b5cf6" name="Total Value" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {chartData.map((d) => (
          <div
            key={d.stage}
            className="rounded-lg bg-gray-50 dark:bg-slate-700 p-3 border border-gray-200 dark:border-slate-600"
          >
            <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{d.stage}</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{d.count}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {d.percentage}% · {d.conversion}%→
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CycleTimeChart({ data }: { data: CycleTimeData[] }) {
  // Validate and filter data
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="p-4 text-center text-gray-600 dark:text-gray-400">
        No cycle time data available
      </div>
    );
  }

  // Filter valid entries and ensure proper types
  const validData = data.filter((d) => {
    if (!d || typeof d !== "object") return false;
    if (typeof d.avgDaysInStage !== "number" || d.avgDaysInStage < 0 || !isFinite(d.avgDaysInStage)) return false;
    if (typeof d.count !== "number" || d.count < 0 || !isFinite(d.count)) return false;
    if (!d.stage || typeof d.stage !== "string") return false;
    return true;
  });

  if (validData.length === 0) {
    return (
      <div className="p-4 text-center text-gray-600 dark:text-gray-400">
        No valid cycle time data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={validData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="stage" />
          <YAxis label={{ value: "Days", angle: -90, position: "insideLeft" }} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="avgDaysInStage"
            stroke="#3b82f6"
            name="Avg Days in Stage"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {validData.map((d) => (
          <div
            key={d.stage}
            className="rounded-lg bg-blue-50 dark:bg-blue-950 p-3 border border-blue-200 dark:border-blue-900"
          >
            <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">{d.stage}</div>
            <div className="text-lg font-bold text-blue-900 dark:text-blue-100 mt-1">
              {isFinite(d.avgDaysInStage) ? d.avgDaysInStage.toFixed(1) : "0"}d
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {d.count} deals
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WinLossChart({ data }: { data: WinLossData[] }) {
  // Validate and filter data
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="p-4 text-center text-gray-600 dark:text-gray-400">
        No win/loss data available
      </div>
    );
  }

  // Filter and validate entries
  const validData = data.filter((d) => {
    if (!d || typeof d !== "object") return false;
    if (typeof d.won !== "number" || d.won < 0 || !isFinite(d.won)) return false;
    if (typeof d.lost !== "number" || d.lost < 0 || !isFinite(d.lost)) return false;
    if (!d.name || typeof d.name !== "string") return false;
    return true;
  });

  if (validData.length === 0) {
    return (
      <div className="p-4 text-center text-gray-600 dark:text-gray-400">
        No valid win/loss data available
      </div>
    );
  }

  const chartData = validData.map((d) => {
    const total = d.won + d.lost;
    const winRate = total > 0 ? ((d.won / total) * 100) : 0;
    return {
      ...d,
      winRate: isFinite(winRate) ? winRate.toFixed(1) : "0",
      total,
    };
  });

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="won" fill="#10b981" name="Won" />
          <Bar dataKey="lost" fill="#ef4444" name="Lost" />
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {chartData.map((d) => (
          <div
            key={d.name}
            className="rounded-lg bg-gradient-to-br from-green-50 to-red-50 dark:from-green-950 dark:to-red-950 p-3 border border-gray-200 dark:border-slate-600"
          >
            <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{d.name}</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
              {d.winRate}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {d.won}W / {d.lost}L
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConversionRateCard({ from, to, count }: { from: string; to: string; count: number }) {
  // Validate inputs
  if (!from || typeof from !== "string" || !to || typeof to !== "string") {
    return null;
  }
  if (typeof count !== "number" || count < 0 || !isFinite(count)) {
    console.error("ConversionRateCard: Invalid count:", count);
    return null;
  }

  return (
    <div className="rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 p-4 border border-blue-200 dark:border-blue-900">
      <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">
        {from} → {to}
      </div>
      <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-2">
        {Math.floor(count)} deals
      </div>
    </div>
  );
}
