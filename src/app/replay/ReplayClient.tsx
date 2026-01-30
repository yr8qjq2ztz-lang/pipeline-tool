"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Opportunity = {
  id: string;
  stage: string | null;
  close_date: string | null;
  rolling_12m_value: number | null;
  probability: number | null;
  created_at: string | null;
  next_action_due?: string | null;
  next_action_completed_at?: string | null;
};

type OpportunityEvent = {
  created_at: string;
  opportunity_id: string;
  event_type: "INSERT" | "UPDATE" | "DELETE";
  old_row: any | null;
  new_row: any | null;
  actor_user_id?: string | null;
};

type SnapshotMetrics = {
  ts: number;
  label: string;
  openCount: number;
  weightedPipeline: number;
  overdueActions: number;
  won: number;
  lost: number;
};

const CLOSED = new Set(["Won", "Lost"]);

function toDateOnlyKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function moneyNZ(n: number) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function clampProbTo01(p: unknown): number {
  const n = Number(p ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n <= 1) return n;
  return Math.min(1, n / 100);
}

function normalizeOpportunityRow(raw: any): Opportunity | null {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id ?? "").trim();
  if (!id) return null;

  return {
    id,
    stage: raw.stage ?? null,
    close_date: raw.close_date ?? null,
    rolling_12m_value: raw.rolling_12m_value == null ? null : Number(raw.rolling_12m_value),
    probability: raw.probability == null ? null : Number(raw.probability),
    created_at: raw.created_at ?? null,
    next_action_due: raw.next_action_due ?? null,
    next_action_completed_at: raw.next_action_completed_at ?? null,
  };
}

function computeMetrics(ts: number, label: string, rows: Map<string, Opportunity>): SnapshotMetrics {
  const now = new Date(ts);

  let openCount = 0;
  let weightedPipeline = 0;
  let overdueActions = 0;
  let won = 0;
  let lost = 0;

  for (const r of rows.values()) {
    const stage = String(r.stage ?? "Unstaged");

    if (stage === "Won") won += 1;
    if (stage === "Lost") lost += 1;

    const isClosed = CLOSED.has(stage);
    if (!isClosed) {
      openCount += 1;

      const value = Number(r.rolling_12m_value ?? 0) || 0;
      const prob = clampProbTo01(r.probability);
      weightedPipeline += value * prob;

      const nextDue = r.next_action_due ? new Date(String(r.next_action_due) + "T00:00:00") : null;
      const completed = Boolean(r.next_action_completed_at);
      if (!completed && nextDue && !Number.isNaN(nextDue.getTime()) && nextDue.getTime() < now.getTime()) {
        overdueActions += 1;
      }
    }
  }

  return {
    ts,
    label,
    openCount,
    weightedPipeline,
    overdueActions,
    won,
    lost,
  };
}

function buildDailySnapshots({
  opportunitiesNow,
  events,
  days,
}: {
  opportunitiesNow: Opportunity[];
  events: OpportunityEvent[];
  days: number;
}) {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const start = new Date(endOfToday);
  start.setDate(start.getDate() - Math.max(1, days - 1));
  start.setHours(0, 0, 0, 0);

  const state = new Map<string, Opportunity>();
  for (const r of opportunitiesNow) {
    if (r && r.id) state.set(r.id, r);
  }

  const eventsDesc = [...events]
    .filter((e) => e && e.created_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  let idx = 0;

  // For each day (from today backwards), apply reverse events that happened AFTER the day-end boundary.
  const snapshots: { key: string; ts: number; state: Map<string, Opportunity>; metrics: SnapshotMetrics }[] = [];

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const boundary = new Date(endOfToday);
    boundary.setDate(boundary.getDate() - dayOffset);
    boundary.setHours(23, 59, 59, 999);

    while (idx < eventsDesc.length) {
      const ev = eventsDesc[idx];
      const t = new Date(ev.created_at).getTime();
      if (!Number.isFinite(t) || t <= boundary.getTime()) break;

      // Reverse apply
      if (ev.event_type === "INSERT") {
        const created = normalizeOpportunityRow(ev.new_row);
        if (created?.id) state.delete(created.id);
      } else if (ev.event_type === "UPDATE") {
        const oldRow = normalizeOpportunityRow(ev.old_row);
        const newRow = normalizeOpportunityRow(ev.new_row);
        if (oldRow?.id) {
          state.set(oldRow.id, oldRow);
        } else if (newRow?.id) {
          // Worst case: if we don't have an old row, remove the record.
          state.delete(newRow.id);
        }
      } else if (ev.event_type === "DELETE") {
        const deleted = normalizeOpportunityRow(ev.old_row);
        if (deleted?.id) state.set(deleted.id, deleted);
      }

      idx += 1;
    }

    const key = toDateOnlyKey(boundary);
    const ts = boundary.getTime();
    // Freeze snapshot by copying map (maps are mutable)
    const snapshotState = new Map(state);
    const metrics = computeMetrics(ts, boundary.toLocaleDateString("en-NZ", { weekday: "short", day: "2-digit", month: "short" }), snapshotState);

    snapshots.push({ key, ts, state: snapshotState, metrics });
  }

  // Return chronological order (oldest -> newest)
  snapshots.reverse();
  return { startTs: start.getTime(), endTs: endOfToday.getTime(), snapshots, eventsDesc };
}

function deltaLabel(a: SnapshotMetrics, b: SnapshotMetrics) {
  const delta = b.weightedPipeline - a.weightedPipeline;
  const sign = delta >= 0 ? "+" : "-";
  return `${sign}${moneyNZ(Math.abs(delta))}`;
}

function topDriversBetween({
  fromTs,
  toTs,
  eventsDesc,
}: {
  fromTs: number;
  toTs: number;
  eventsDesc: OpportunityEvent[];
}) {
  // We want events within (fromTs, toTs]. eventsDesc is descending.
  const min = Math.min(fromTs, toTs);
  const max = Math.max(fromTs, toTs);

  const byOpp = new Map<string, { id: string; changes: number; lastType: string; lastWhen: number }>();

  for (const ev of eventsDesc) {
    const t = new Date(ev.created_at).getTime();
    if (!Number.isFinite(t)) continue;
    if (t <= min) break; // since descending
    if (t > max) continue;

    const id = String(ev.opportunity_id ?? "").trim();
    if (!id) continue;

    const existing = byOpp.get(id) ?? { id, changes: 0, lastType: ev.event_type, lastWhen: t };
    existing.changes += 1;
    existing.lastType = ev.event_type;
    existing.lastWhen = Math.max(existing.lastWhen, t);
    byOpp.set(id, existing);
  }

  return Array.from(byOpp.values())
    .sort((a, b) => b.changes - a.changes)
    .slice(0, 8);
}

export default function ReplayClient({
  opportunitiesNow,
  events,
}: {
  opportunitiesNow: Opportunity[];
  events: OpportunityEvent[];
}) {
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const replay = useMemo(() => {
    return buildDailySnapshots({ opportunitiesNow, events, days });
  }, [opportunitiesNow, events, days]);

  const [idx, setIdx] = useState(0);

  const snapshots = replay.snapshots;
  const clampedIdx = Math.max(0, Math.min(idx, Math.max(0, snapshots.length - 1)));
  const snap = snapshots[clampedIdx];

  const prev = clampedIdx > 0 ? snapshots[clampedIdx - 1] : null;
  const delta = prev ? deltaLabel(prev.metrics, snap.metrics) : null;

  const drivers = useMemo(() => {
    if (!prev) return [];
    return topDriversBetween({ fromTs: prev.ts, toTs: snap.ts, eventsDesc: replay.eventsDesc });
  }, [prev, snap.ts, replay.eventsDesc]);

  return (
    <div className="p-6 min-h-screen bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Pipeline Time Machine</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Scrub through time and see what changed.
            </p>
          </div>
          <div className="flex gap-2">
            <Link className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm" href="/pipeline">
              Back
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Range</span>
              <select
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                value={days}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setDays(v === 7 ? 7 : v === 90 ? 90 : 30);
                  setIdx(0);
                }}
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>

            <div className="text-sm text-slate-700 dark:text-slate-200">
              {snap ? (
                <span>
                  <span className="font-semibold">{snap.metrics.label}</span>
                  {delta ? <span className="ml-2 text-slate-500">Δ weighted: {delta}</span> : null}
                </span>
              ) : (
                "No snapshots"
              )}
            </div>
          </div>

          <div className="mt-4">
            <input
              type="range"
              min={0}
              max={Math.max(0, snapshots.length - 1)}
              value={clampedIdx}
              onChange={(e) => setIdx(Number(e.target.value))}
              className="w-full"
            />
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>{snapshots[0]?.metrics.label ?? ""}</span>
              <span>{snapshots[snapshots.length - 1]?.metrics.label ?? ""}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Tile title="Open opportunities" value={String(snap?.metrics.openCount ?? 0)} />
          <Tile title="Weighted pipeline" value={moneyNZ(snap?.metrics.weightedPipeline ?? 0)} />
          <Tile title="Overdue actions" value={String(snap?.metrics.overdueActions ?? 0)} />
          <Tile title="Won / Lost" value={`${snap?.metrics.won ?? 0} / ${snap?.metrics.lost ?? 0}`} />
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">What changed</div>
              <div className="text-sm text-slate-600 dark:text-slate-300">Most-edited deals between this day and the previous snapshot.</div>
            </div>
            <div className="text-xs text-slate-500">(v1: counts edits; v2 will rank by $ impact)</div>
          </div>

          {prev ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {drivers.length ? (
                drivers.map((d) => (
                  <div key={d.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
                    <div className="text-sm font-semibold">Deal {d.id.slice(0, 8)}…</div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">Changes: {d.changes} · Last: {d.lastType}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-600 dark:text-slate-300">No logged changes in this interval.</div>
              )}
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">Move the slider to see changes.</div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
          <div className="text-sm font-semibold">How it works</div>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            This view starts from today’s current pipeline, then “rewinds” using the audit trail in
            <span className="font-mono"> opportunity_events</span>. It’s read-only and doesn’t modify your live data.
          </p>
        </div>
      </div>
    </div>
  );
}

function Tile({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4 shadow-sm">
      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
