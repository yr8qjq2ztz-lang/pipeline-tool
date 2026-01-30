"use client";

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

export default function DashboardCharts({
  charts,
}: {
  charts: {
    byStage: { stage: string; count: number; weighted: number }[];
    months: { label: string; weighted: number; count: number }[];
  };
}) {
  return (
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

      <Card title="12 MTH rolling forecast (weighted value)">
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
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
