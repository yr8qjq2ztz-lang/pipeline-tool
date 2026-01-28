"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { WhatIfSimulator } from "@/app/components/WhatIfSimulator";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

type Branch = { id: string; name: string };
type Account = { id: string; name: string };

type OpportunityRow = {
  id: string;

  account_id: string;
  branch_id: string | null;

  stage: string | null;
  close_date: string | null;
  rolling_12m_value: number | null;
  probability: number | null;
  next_action: string | null;
  next_action_due: string | null;
  notes: string | null;

  accounts?: { id: string; name: string } | null;
  branches?: { id: string; name: string } | null;
};

const STAGES = [
  "Prospecting",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
] as const;

type CloseWindow = "all" | "next30" | "next60" | "past";
type ProbBand = "all" | "0-30" | "31-60" | "61-100";
type Health = "all" | "at-risk" | "caution" | "healthy";

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown error";
}

function parseStage(value: string): (typeof STAGES)[number] {
  return (STAGES as readonly string[]).includes(value)
    ? (value as (typeof STAGES)[number])
    : "Prospecting";
}

function parseCloseWindow(value: string): CloseWindow {
  return value === "next30" || value === "next60" || value === "past" ? value : "all";
}

function parseProbBand(value: string): ProbBand {
  return value === "0-30" || value === "31-60" || value === "61-100" ? value : "all";
}

function parseHealth(value: string): Health {
  return value === "at-risk" || value === "caution" || value === "healthy" ? value : "all";
}

function isoToDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function isActiveStage(stage: string | null) {
  return stage !== "Won" && stage !== "Lost";
}

export default function PipelinePage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<OpportunityRow[]>([]);

  // View mode: Board vs Table
  const [viewMode, setViewMode] = useState<"board" | "table">("board");

  // What-if simulator
  const [showWhatIf, setShowWhatIf] = useState(false);

  // ---- Create form state ----
  const [showCreate, setShowCreate] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [createAccountName, setCreateAccountName] = useState("");
  const [createBranchId, setCreateBranchId] = useState<string>("");
  const [createStage, setCreateStage] =
    useState<(typeof STAGES)[number]>("Prospecting");
  const [createCloseDate, setCreateCloseDate] = useState<string>("");
  const [createRolling12mValue, setCreateRolling12mValue] = useState<string>("0");
  const [createProbability, setCreateProbability] = useState<string>("10");
  const [createNextAction, setCreateNextAction] = useState<string>("");
  const [createNextActionDue, setCreateNextActionDue] = useState<string>("");
  const [createNotes, setCreateNotes] = useState<string>("");

  // ---- Edit modal state ----
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [editId, setEditId] = useState<string>("");
  const [editAccountName, setEditAccountName] = useState<string>("");
  const [editBranchId, setEditBranchId] = useState<string>("");
  const [editStage, setEditStage] =
    useState<(typeof STAGES)[number]>("Prospecting");
  const [editCloseDate, setEditCloseDate] = useState<string>("");
  const [editRolling12mValue, setEditRolling12mValue] = useState<string>("0");
  const [editProbability, setEditProbability] = useState<string>("10");
  const [editNextAction, setEditNextAction] = useState<string>("");
  const [editNextActionDue, setEditNextActionDue] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");

  // quick update UI state
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);

  // ---- Filters ----
  const [filterBranchId, setFilterBranchId] = useState<string>(""); // "" = All
  const [filterStage, setFilterStage] = useState<string>(""); // "" = All
  const [filterCloseWindow, setFilterCloseWindow] = useState<CloseWindow>("all");
  const [filterProbBand, setFilterProbBand] = useState<ProbBand>("all");
  const [filterHealth, setFilterHealth] = useState<Health>("all");
  const [search, setSearch] = useState<string>("");

  const accountNameToId = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((a) => map.set(a.name.toLowerCase(), a.id));
    return map;
  }, [accounts]);

  async function ensureSignedInOrBounce(): Promise<boolean> {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        router.replace("/login");
        return false;
      }
      return true;
    } catch (e) {
      console.error("Auth check failed:", e);
      return false;
    }
  }

  async function fetchBranches() {
    try {
      const { data, error } = await supabase
        .from("branches")
        .select("id,name")
        .order("name", { ascending: true });

      if (error) throw new Error(error.message || "Failed to fetch branches");

      const list = (data ?? []) as Branch[];
      if (list.length === 0) {
        console.warn("No branches found in database");
      }
      setBranches(list);

      // default branch for create form
      if (!createBranchId && list.length) setCreateBranchId(list[0].id);
    } catch (e) {
      console.error("Failed to fetch branches:", e);
      setDbError("Failed to load branches. Check database connection.");
      throw e;
    }
  }

  async function fetchAccounts() {
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("id,name")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw new Error(error.message || "Failed to fetch accounts");
      
      if (!data?.length) {
        console.warn("No accounts found in database");
      }
      setAccounts((data ?? []) as Account[]);
    } catch (e) {
      console.error("Failed to fetch accounts:", e);
      setDbError("Failed to load accounts. Check database connection.");
      throw e;
    }
  }

  async function fetchOpportunities() {
    try {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*, accounts(id, name), branches(id, name)");

      if (error) throw new Error(error.message || "Failed to fetch opportunities");
      
      const count = data?.length ?? 0;
      console.log("Fetched opportunities, count:", count);
      setRows((data ?? []) as OpportunityRow[]);
    } catch (e) {
      console.error("Failed to fetch opportunities:", e);
      setDbError("Failed to load opportunities. Check database connection.");
      throw e;
    }
  }

  // Keyboard shortcuts
  useKeyboardShortcuts({
    n: () => setShowCreate((s) => !s),
    f: () => setFilterBranchId(""),
    d: () => router.push("/dashboard"),
    p: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    e: () => {
      const firstRow = filteredRows[0];
      if (firstRow) setEditId(firstRow.id);
    },
    "/": () => {
      const searchInput = document.getElementById("search-input");
      if (searchInput instanceof HTMLInputElement) {
        searchInput.focus();
      }
    },
    "?": () => showKeyboardHelp(),
  });

  function showKeyboardHelp() {
    alert(
      "Keyboard Shortcuts:\n" +
      "N - New opportunity\n" +
      "F - Clear filters\n" +
      "D - Go to dashboard\n" +
      "P - Pipeline top\n" +
      "E - Edit first opportunity\n" +
      "/ - Focus search\n" +
      "? - Show this help"
    );
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (event !== "INITIAL_SESSION") return;

      if (!session) {
        router.replace("/login");
        return;
      }

      try {
        setDbError(null);
        setLoading(true);
        await Promise.all([fetchBranches(), fetchAccounts(), fetchOpportunities()]);
      } catch (e: unknown) {
        setDbError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getOrCreateAccountId(nameRaw: string): Promise<string> {
    const name = nameRaw.trim();
    if (!name) throw new Error("Account name is required.");

    const local = accountNameToId.get(name.toLowerCase());
    if (local) return local;

    try {
      const { data: found, error: findError } = await supabase
        .from("accounts")
        .select("id,name")
        .ilike("name", name)
        .limit(1);

      if (findError) throw new Error(findError.message || "Failed to search accounts");
      if (found && found.length) return found[0].id;

      const { data: created, error: createError } = await supabase
        .from("accounts")
        .insert({
          name,
          is_key_account: true,
          notes: "Created via pipeline tool",
        })
        .select("id")
        .single();

      if (createError) throw new Error(createError.message || "Failed to create account");
      if (!created?.id) throw new Error("Account created but ID not returned");
      return created.id;
    } catch (e) {
      console.error("Account operation failed:", e);
      throw e;
    }
  }

  function resetCreateForm() {
    setCreateAccountName("");
    setCreateStage("Prospecting");
    setCreateCloseDate("");
    setCreateRolling12mValue("0");
    setCreateProbability("10");
    setCreateNextAction("");
    setCreateNextActionDue("");
    setCreateNotes("");
  }

  async function onCreateOpportunity(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    const ok = await ensureSignedInOrBounce();
    if (!ok) return;

    try {
      setSavingCreate(true);

      // Validation
      if (!createAccountName.trim()) {
        throw new Error("Account name is required");
      }
      if (!createBranchId) {
        throw new Error("Branch is required");
      }

      const acctId = await getOrCreateAccountId(createAccountName);

      const valueNum = Number(createRolling12mValue);
      if (Number.isNaN(valueNum) || valueNum < 0) {
        throw new Error("Rolling 12M value must be a number >= 0.");
      }

      const probNum = Number(createProbability);
      if (Number.isNaN(probNum) || probNum < 0 || probNum > 100) {
        throw new Error("Probability must be between 0 and 100.");
      }

      if (createCloseDate && new Date(createCloseDate) < new Date()) {
        throw new Error("Close date cannot be in the past");
      }

      const { error } = await supabase.from("opportunities").insert({
        account_id: acctId,
        branch_id: createBranchId || null,
        stage: createStage,
        close_date: createCloseDate || null,
        rolling_12m_value: valueNum,
        probability: probNum,
        next_action: createNextAction.trim() || null,
        next_action_due: createNextActionDue || null,
        notes: createNotes.trim() || null,
      });

      if (error) throw new Error(error.message || "Failed to create opportunity");

      await Promise.all([fetchAccounts(), fetchOpportunities()]);
      resetCreateForm();
      setShowCreate(false);
    } catch (e: unknown) {
      setCreateError(getErrorMessage(e));
      console.error("Create error:", e);
    } finally {
      setSavingCreate(false);
    }
  }

  function openEdit(row: OpportunityRow) {
    setEditError(null);
    setEditId(row.id);
    setEditAccountName(row.accounts?.name ?? "(unknown)");
    setEditBranchId(row.branch_id ?? "");
    setEditStage(parseStage(row.stage ?? "Prospecting"));
    setEditCloseDate(row.close_date ?? "");
    setEditRolling12mValue(String(row.rolling_12m_value ?? 0));
    setEditProbability(String(row.probability ?? 0));
    setEditNextAction(row.next_action ?? "");
    setEditNextActionDue(row.next_action_due ?? "");
    setEditNotes(row.notes ?? "");
    setEditOpen(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditError(null);

    const ok = await ensureSignedInOrBounce();
    if (!ok) return;

    try {
      setSavingEdit(true);

      // Validation
      if (!editId) {
        throw new Error("No opportunity selected for editing");
      }

      const valueNum = Number(editRolling12mValue);
      if (Number.isNaN(valueNum) || valueNum < 0) {
        throw new Error("Rolling 12M value must be a number >= 0.");
      }

      const probNum = Number(editProbability);
      if (Number.isNaN(probNum) || probNum < 0 || probNum > 100) {
        throw new Error("Probability must be between 0 and 100.");
      }

      if (editCloseDate && new Date(editCloseDate) < new Date()) {
        throw new Error("Close date cannot be in the past");
      }

      const { error } = await supabase
        .from("opportunities")
        .update({
          branch_id: editBranchId || null,
          stage: editStage,
          close_date: editCloseDate || null,
          rolling_12m_value: valueNum,
          probability: probNum,
          next_action: editNextAction.trim() || null,
          next_action_due: editNextActionDue || null,
          notes: editNotes.trim() || null,
        })
        .eq("id", editId);

      if (error) throw new Error(error.message || "Failed to update opportunity");

      await fetchOpportunities();
      setEditOpen(false);
    } catch (e: unknown) {
      setEditError(getErrorMessage(e));
      console.error("Edit error:", e);
    } finally {
      setSavingEdit(false);
    }
  }

  async function quickUpdateStage(id: string, newStage: string) {
    const ok = await ensureSignedInOrBounce();
    if (!ok) return;

    if (!id || !newStage) {
      console.error("Invalid id or stage");
      return;
    }

    try {
      setRowSavingId(id);

      // optimistic UI
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, stage: newStage } : r))
      );

      const { error } = await supabase
        .from("opportunities")
        .update({ stage: newStage })
        .eq("id", id);

      if (error) {
        console.error("Stage update error:", error);
        throw new Error(error.message || "Failed to update stage");
      }
    } catch (e: unknown) {
      console.error("Stage update failed:", e);
      await fetchOpportunities();
      alert(getErrorMessage(e));
    } finally {
      setRowSavingId(null);
    }
  }

  async function deleteOpportunity(id: string) {
    const ok = await ensureSignedInOrBounce();
    if (!ok) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this opportunity? This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      setSavingEdit(true);
      setEditError(null);

      console.log("Attempting to delete opportunity:", id);
      
      const response = await supabase
        .from("opportunities")
        .delete()
        .eq("id", id);

      console.log("Delete response:", response);

      if (response.error) {
        console.error("Delete error from Supabase:", response.error);
        throw new Error(response.error.message || "Failed to delete - RLS policy may be blocking");
      }

      console.log("Delete API call succeeded, now fetching...");
      
      // Wait and refresh to confirm deletion persisted
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchOpportunities();
      setEditOpen(false);
      
    } catch (e: unknown) {
      const msg = getErrorMessage(e) || "Delete failed";
      setEditError(msg);
      console.error("Delete error caught:", msg, e);
      // Refresh to sync UI with DB
      await fetchOpportunities();
    } finally {
      setSavingEdit(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // ----- Derived: filtered rows + dashboard stats -----
  const today = useMemo(() => startOfDay(new Date()), []);
  const in30 = useMemo(() => addDays(today, 30), [today]);
  const in60 = useMemo(() => addDays(today, 60), [today]);
  const in7 = useMemo(() => addDays(today, 7), [today]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((r) => {
      if (filterBranchId && r.branch_id !== filterBranchId) return false;
      if (filterStage && (r.stage ?? "") !== filterStage) return false;

      if (filterProbBand !== "all") {
        const p = Number(r.probability ?? 0);
        if (filterProbBand === "0-30" && !(p >= 0 && p <= 30)) return false;
        if (filterProbBand === "31-60" && !(p >= 31 && p <= 60)) return false;
        if (filterProbBand === "61-100" && !(p >= 61 && p <= 100)) return false;
      }

      if (filterCloseWindow !== "all") {
        const cd = isoToDate(r.close_date);
        if (!cd) return false;
        const c = startOfDay(cd);

        if (filterCloseWindow === "next30" && !(c >= today && c <= in30)) return false;
        if (filterCloseWindow === "next60" && !(c >= today && c <= in60)) return false;
        if (filterCloseWindow === "past" && !(c < today)) return false;
      }

      if (q) {
        const name = (r.accounts?.name ?? "").toLowerCase();
        if (!name.includes(q)) return false;
      }

      if (filterHealth !== "all") {
        if (getDealHealth(r) !== filterHealth) return false;
      }

      return true;
    });
  }, [rows, filterBranchId, filterStage, filterProbBand, filterCloseWindow, filterHealth, search, today, in30, in60]);

  const dashboard = useMemo(() => {
    const active = filteredRows.filter((r) => isActiveStage(r.stage));

    const overdueActions = active.filter((r) => {
      const d = isoToDate(r.next_action_due);
      if (!d) return false;
      return startOfDay(d) < today;
    });

    const dueThisWeek = active.filter((r) => {
      const d = isoToDate(r.next_action_due);
      if (!d) return false;
      const x = startOfDay(d);
      return x >= today && x <= in7;
    });

    const closing30 = active.filter((r) => {
      const d = isoToDate(r.close_date);
      if (!d) return false;
      const x = startOfDay(d);
      return x >= today && x <= in30;
    });

    const totalValue = active.reduce((sum, r) => sum + Number(r.rolling_12m_value ?? 0), 0);

    const nextActionsList = active
      .filter((r) => r.next_action_due)
      .map((r) => ({ r, due: startOfDay(isoToDate(r.next_action_due)!) }))
      .sort((a, b) => a.due.getTime() - b.due.getTime())
      .slice(0, 10)
      .map((x) => x.r);

    return {
      overdueActions,
      dueThisWeek,
      closing30,
      totalValue,
      nextActionsList,
    };
  }, [filteredRows, today, in7, in30]);

  // ---- Deal health indicator (red/yellow/green) ----
  function getDealHealth(o: OpportunityRow): "at-risk" | "caution" | "healthy" {
    const now = new Date();
    const nextDue = isoToDate(o.next_action_due);
    const closeDate = isoToDate(o.close_date);
    
    // Red: overdue next action
    if (nextDue && nextDue < now) return "at-risk";
    
    // Yellow: closing within 7 days
    if (closeDate && closeDate <= addDays(now, 7) && closeDate >= now) return "caution";
    
    // Green: on track
    return "healthy";
  }

  function getHealthColor(health: "at-risk" | "caution" | "healthy") {
    switch (health) {
      case "at-risk": return "border-red-300 bg-red-50";
      case "caution": return "border-amber-300 bg-amber-50";
      case "healthy": return "border-green-300 bg-green-50";
    }
  }

  function getHealthBadge(health: "at-risk" | "caution" | "healthy") {
    switch (health) {
      case "at-risk": return <span className="inline-block px-2 py-1 text-xs font-semibold bg-red-200 text-red-900 rounded-full">🔴 At Risk</span>;
      case "caution": return <span className="inline-block px-2 py-1 text-xs font-semibold bg-amber-200 text-amber-900 rounded-full">🟡 Closing Soon</span>;
      case "healthy": return <span className="inline-block px-2 py-1 text-xs font-semibold bg-green-200 text-green-900 rounded-full">🟢 On Track</span>;
    }
  }

  // ---- Kanban grouping (uses filtered rows) ----
  const kanban = useMemo(() => {
    const byStage: Record<string, OpportunityRow[]> = {};
    STAGES.forEach((s) => (byStage[s] = []));

    for (const r of filteredRows) {
      const s = (r.stage ?? "Prospecting") as string;
      (byStage[s] ?? (byStage[s] = [])).push(r);
    }

    // sort within each column: earliest close date first, then highest probability
    for (const s of STAGES) {
      byStage[s].sort((a, b) => {
        const ad = isoToDate(a.close_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bd = isoToDate(b.close_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (ad !== bd) return ad - bd;
        return Number(b.probability ?? 0) - Number(a.probability ?? 0);
      });
    }

    const totals: Record<string, number> = {};
    for (const s of STAGES) {
      totals[s] = byStage[s].reduce((sum, r) => sum + Number(r.rolling_12m_value ?? 0), 0);
    }

    return { byStage, totals };
  }, [filteredRows]);

  function clearFilters() {
    setFilterBranchId("");
    setFilterStage("");
    setFilterCloseWindow("all");
    setFilterProbBand("all");
    setFilterHealth("all");
    setSearch("");
  }

  // Helper functions for safe data access
  function getAccountName(o: OpportunityRow): string {
    return o?.accounts?.name ?? "(Unknown account)";
  }

  function getBranchName(o: OpportunityRow): string {
    return o?.branches?.name ?? "-";
  }

  function onCardDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onColumnDragOver(e: React.DragEvent) {
    e.preventDefault(); // important: allows dropping
    e.dataTransfer.dropEffect = "move";
  }

  async function onColumnDrop(e: React.DragEvent, stage: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;

    const row = rows.find((r) => r.id === id);
    const currentStage = row?.stage ?? "Prospecting";
    if (currentStage === stage) return;

    await quickUpdateStage(id, stage);
  }

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="font-semibold text-gray-700">Loading pipeline…</p>
          <p className="text-sm text-gray-600 mt-2">Fetching your data</p>
        </div>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="max-w-2xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <div className="text-lg font-semibold text-red-900">Connection Error</div>
            <div className="mt-2 text-sm text-red-700">
              <p>There was a problem loading your pipeline data.</p>
              <p className="mt-2 text-xs font-mono text-red-600 break-words">{dbError}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 min-h-screen text-gray-900 dark:text-gray-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">Pipeline</h1>
          <p className="text-sm text-gray-600">
            Kanban board added. Drag deals around like you’re solving a crime.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="rounded-lg border border-gray-300 bg-white dark:bg-slate-800 dark:border-slate-600 shadow-sm p-1 flex gap-1">
            <button
              onClick={() => setViewMode("board")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-all ${
                viewMode === "board" ? "bg-blue-600 text-white shadow-md" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-all ${
                viewMode === "table" ? "bg-blue-600 text-white shadow-md" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
              }`}
            >
              Table
            </button>
          </div>

          <button
            onClick={() => setShowWhatIf(true)}
            title="Simulate different scenarios"
            className="rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            🎯 What-If
          </button>

          <button
            onClick={() => router.push("/analytics")}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-2 text-sm font-medium shadow-md hover:shadow-lg hover:from-indigo-700 hover:to-indigo-800 transition-all"
          >
            📊 Analytics
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2 text-sm font-medium shadow-md hover:shadow-lg hover:from-purple-700 hover:to-purple-800 transition-all"
          >
            Dashboard
          </button>

          <button
            onClick={() => setShowCreate((s) => !s)}
            className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 text-sm font-medium shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all"
          >
            {showCreate ? "Close" : "New opportunity"}
          </button>

          <button
            onClick={signOut}
            className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-400 dark:hover:border-slate-500 transition-all shadow-sm"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* QUICK STATS BANNER */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50 dark:from-blue-950 to-blue-100 dark:to-blue-900 p-4 shadow-sm">
          <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Open Opportunities</div>
          <div className="mt-2 text-3xl font-bold text-blue-900 dark:text-blue-100">{filteredRows.filter(r => isActiveStage(r.stage)).length}</div>
        </div>
        <div className="rounded-2xl border border-green-200 dark:border-green-900 bg-gradient-to-br from-green-50 dark:from-green-950 to-green-100 dark:to-green-900 p-4 shadow-sm">
          <div className="text-sm font-medium text-green-700 dark:text-green-300">Pipeline Value</div>
          <div className="mt-2 text-3xl font-bold text-green-900 dark:text-green-100">${(filteredRows.reduce((sum, r) => sum + (Number(r.rolling_12m_value ?? 0) * (Number(r.probability ?? 0) / 100)), 0) / 1000).toFixed(0)}k</div>
        </div>
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50 dark:from-amber-950 to-amber-100 dark:to-amber-900 p-4 shadow-sm">
          <div className="text-sm font-medium text-amber-700 dark:text-amber-300">At Risk</div>
          <div className="mt-2 text-3xl font-bold text-amber-900 dark:text-amber-100">{filteredRows.filter(r => getDealHealth(r) === "at-risk").length}</div>
        </div>
        <div className="rounded-2xl border border-purple-200 dark:border-purple-900 bg-gradient-to-br from-purple-50 dark:from-purple-950 to-purple-100 dark:to-purple-900 p-4 shadow-sm">
          <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Closing Soon</div>
          <div className="mt-2 text-3xl font-bold text-purple-900 dark:text-purple-100">{filteredRows.filter(r => getDealHealth(r) === "caution").length}</div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Filters</h2>
          <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors" onClick={clearFilters}>
            Clear all
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Branch</label>
            <select
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all appearance-none cursor-pointer hover:border-gray-400 dark:hover:border-slate-500"
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all appearance-none cursor-pointer hover:border-gray-400"
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
            >
              <option value="">All stages</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Close window</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all appearance-none cursor-pointer hover:border-gray-400"
              value={filterCloseWindow}
              onChange={(e) => setFilterCloseWindow(parseCloseWindow(e.target.value))}
            >
              <option value="all">All dates</option>
              <option value="next30">Next 30 days</option>
              <option value="next60">Next 60 days</option>
              <option value="past">Past due</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Probability</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all appearance-none cursor-pointer hover:border-gray-400"
              value={filterProbBand}
              onChange={(e) => setFilterProbBand(parseProbBand(e.target.value))}
            >
              <option value="all">All ranges</option>
              <option value="0-30">0–30%</option>
              <option value="31-60">31–60%</option>
              <option value="61-100">61–100%</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deal Health</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all appearance-none cursor-pointer hover:border-gray-400"
              value={filterHealth}
              onChange={(e) => setFilterHealth(parseHealth(e.target.value))}
            >
              <option value="all">All deals</option>
              <option value="at-risk">🔴 At Risk</option>
              <option value="caution">🟡 Closing Soon</option>
              <option value="healthy">🟢 On Track</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all hover:border-gray-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Account name…"
            />
          </div>
        </div>
      </div>

      {/* DASHBOARD */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-sm font-medium text-blue-700">Overdue actions</div>
          <div className="text-3xl font-bold text-blue-900 mt-2">{dashboard.overdueActions.length}</div>
          <div className="text-xs text-blue-600 mt-1">Active stages only</div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-sm font-medium text-amber-700">Due in 7 days</div>
          <div className="text-3xl font-bold text-amber-900 mt-2">{dashboard.dueThisWeek.length}</div>
          <div className="text-xs text-amber-600 mt-1">Next action due date</div>
        </div>

        <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-sm font-medium text-orange-700">Closing in 30 days</div>
          <div className="text-3xl font-bold text-orange-900 mt-2">{dashboard.closing30.length}</div>
          <div className="text-xs text-orange-600 mt-1">Close date window</div>
        </div>

        <div className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-sm font-medium text-green-700">Total 12M value</div>
          <div className="text-3xl font-bold text-green-900 mt-2">
            {dashboard.totalValue.toLocaleString()}
          </div>
          <div className="text-xs text-green-600 mt-1">Filtered + active only</div>
        </div>
      </div>

      {/* NEXT ACTIONS LIST */}
      <div className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold">Next actions due (top 10)</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Account</th>
                <th className="text-left p-3">Branch</th>
                <th className="text-left p-3">Stage</th>
                <th className="text-left p-3">Due</th>
                <th className="text-left p-3">Next action</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.nextActionsList.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="p-3">{getAccountName(o)}</td>
                  <td className="p-3">{getBranchName(o)}</td>
                  <td className="p-3">{o.stage ?? "-"}</td>
                  <td className="p-3">{o.next_action_due ?? "-"}</td>
                  <td className="p-3">{o.next_action ?? "—"}</td>
                </tr>
              ))}
              {!dashboard.nextActionsList.length && (
                <tr>
                  <td className="p-3" colSpan={5}>
                    No next actions due (either you’re incredibly organised or nobody is entering next actions).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE */}
      {showCreate && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">Create opportunity</h2>

          <form onSubmit={onCreateOpportunity} className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm">Account (type existing or new)</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={createAccountName}
                onChange={(e) => setCreateAccountName(e.target.value)}
                list="account-list"
                placeholder="e.g. Acme Fleet"
                required
              />
              <datalist id="account-list">
                {accounts.map((a) => (
                  <option key={a.id} value={a.name} />
                ))}
              </datalist>
              <p className="text-xs text-gray-500 mt-1">
                If it doesn’t exist, it will be created automatically.
              </p>
            </div>

            <div>
              <label className="text-sm">Branch</label>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={createBranchId}
                onChange={(e) => setCreateBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm">Stage</label>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={createStage}
                onChange={(e) => setCreateStage(parseStage(e.target.value))}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm">Expected close date</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                type="date"
                value={createCloseDate}
                onChange={(e) => setCreateCloseDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm">Rolling 12M value</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                type="number"
                min={0}
                step="0.01"
                value={createRolling12mValue}
                onChange={(e) => setCreateRolling12mValue(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm">Probability %</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                type="number"
                min={0}
                max={100}
                step={1}
                value={createProbability}
                onChange={(e) => setCreateProbability(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm">Next action</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={createNextAction}
                onChange={(e) => setCreateNextAction(e.target.value)}
                placeholder="e.g. Book site visit"
              />
            </div>

            <div>
              <label className="text-sm">Next action due</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                type="date"
                value={createNextActionDue}
                onChange={(e) => setCreateNextActionDue(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm">Notes</label>
              <textarea
                className="mt-1 w-full rounded-lg border px-3 py-2"
                rows={3}
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                placeholder="Anything that matters. Keep it short."
              />
            </div>

            {createError && (
              <div className="md:col-span-2 text-sm text-red-600">{createError}</div>
            )}

            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={savingCreate}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 text-sm font-medium shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 transition-all"
              >
                {savingCreate ? "Saving…" : "Create"}
              </button>

              <button
                type="button"
                onClick={() => {
                  resetCreateForm();
                  setShowCreate(false);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* KANBAN BOARD */}
      {viewMode === "board" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-600 mb-4 font-medium">
            Drag a card into a new column to update the stage.
          </div>

          <div className="overflow-x-auto">
            <div className="flex gap-3 min-w-[1100px]">
              {STAGES.map((stage) => {
                const list = kanban.byStage[stage] ?? [];
                const total = kanban.totals[stage] ?? 0;

                return (
                  <div key={stage} className="w-[320px] flex-shrink-0">
                    <div className="rounded-xl border bg-gray-50 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{stage}</div>
                        <div className="text-xs text-gray-600">
                          {list.length} · {total.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div
                      className="mt-2 rounded-xl border p-2 min-h-[300px] bg-white"
                      onDragOver={onColumnDragOver}
                      onDrop={(e) => onColumnDrop(e, stage)}
                    >
                      <div className="space-y-2">
                        {list.map((o) => {
                          const health = getDealHealth(o);
                          const estValue = Number(o.rolling_12m_value ?? 0) * (Number(o.probability ?? 0) / 100);
                          return (
                          <div
                            key={o.id}
                            draggable={rowSavingId !== o.id}
                            onDragStart={(e) => onCardDragStart(e, o.id)}
                            onClick={() => openEdit(o)}
                            className={`rounded-xl border-2 p-3 cursor-pointer select-none transition-all duration-200 animate-in fade-in ${
                              rowSavingId === o.id ? "opacity-60" : "hover:shadow-lg hover:scale-105 active:scale-100"
                            } ${getHealthColor(health)}`}
                            title="Click to edit. Drag to move stage."
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-semibold flex-1">
                                {getAccountName(o)}
                              </div>
                              {getHealthBadge(health)}
                            </div>

                            <div className="text-xs text-gray-600 mt-1">
                              {getBranchName(o)} · {(o.probability ?? 0) + "%"}
                            </div>

                            <div className="text-xs font-semibold mt-2 text-gray-900">
                              Est. value: ${(estValue / 1000).toFixed(1)}k
                            </div>

                            <div className="text-xs text-gray-600 mt-1">
                              Close: {o.close_date ?? "—"}
                            </div>

                            {o.next_action && (
                              <div className="text-xs mt-2 bg-blue-50 p-2 rounded border-l-2 border-blue-400">
                                <span className="text-blue-700 font-medium">Next:</span>{" "}
                                <span className="text-blue-600">{o.next_action}</span>
                              </div>
                            )}
                          </div>
                        );
                        })}

                        {!list.length && (
                          <div className="text-sm text-gray-500 p-2">
                            Drop cards here.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TABLE */}
      {viewMode === "table" && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 font-semibold text-gray-700">Account</th>
                <th className="text-left p-3 font-semibold text-gray-700">Branch</th>
                <th className="text-left p-3 font-semibold text-gray-700">Stage</th>
                <th className="text-left p-3 font-semibold text-gray-700">Close</th>
                <th className="text-right p-3 font-semibold text-gray-700">12M Value</th>
                <th className="text-right p-3 font-semibold text-gray-700">Prob</th>
                <th className="text-left p-3 font-semibold text-gray-700">Next Action</th>
                <th className="text-left p-3 font-semibold text-gray-700">Next Due</th>
                <th className="text-left p-3 font-semibold text-gray-700">Edit</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((o) => (
                <tr key={o.id} className="border-t border-gray-200 hover:bg-blue-50 transition-colors">
                  <td className="p-3">{getAccountName(o)}</td>
                  <td className="p-3">{getBranchName(o)}</td>

                  <td className="p-3">
                    <select
                      className="rounded-lg border px-2 py-1"
                      value={parseStage(o.stage ?? "Prospecting")}
                      disabled={rowSavingId === o.id}
                      onChange={(e) => quickUpdateStage(o.id, e.target.value)}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {rowSavingId === o.id && (
                      <span className="ml-2 text-xs text-gray-500">saving…</span>
                    )}
                  </td>

                  <td className="p-3">{o.close_date ?? "-"}</td>
                  <td className="p-3 text-right">
                    {Number(o.rolling_12m_value ?? 0).toLocaleString()}
                  </td>
                  <td className="p-3 text-right">{o.probability ?? 0}%</td>
                  <td className="p-3">{o.next_action ?? "—"}</td>
                  <td className="p-3">{o.next_action_due ?? "—"}</td>

                  <td className="p-3">
                    <button
                      className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                      onClick={() => openEdit(o)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}

              {!filteredRows.length && (
                <tr>
                  <td className="p-3" colSpan={9}>
                    Nothing matches your filters. Try “Clear” above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* EDIT MODAL */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-gray-200 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Edit opportunity</h2>
                <p className="text-sm text-gray-600 mt-1">{editAccountName}</p>
              </div>

              <button
                onClick={() => setEditOpen(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
              >
                Close
              </button>
            </div>

            <form onSubmit={saveEdit} className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm">Branch</label>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={editBranchId}
                  onChange={(e) => setEditBranchId(e.target.value)}
                >
                  <option value="">(none)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm">Stage</label>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={editStage}
                  onChange={(e) => setEditStage(parseStage(e.target.value))}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm">Expected close date</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  type="date"
                  value={editCloseDate}
                  onChange={(e) => setEditCloseDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm">Rolling 12M value</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  type="number"
                  min={0}
                  step="0.01"
                  value={editRolling12mValue}
                  onChange={(e) => setEditRolling12mValue(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm">Probability %</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={editProbability}
                  onChange={(e) => setEditProbability(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm">Next action due</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  type="date"
                  value={editNextActionDue}
                  onChange={(e) => setEditNextActionDue(e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm">Next action</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={editNextAction}
                  onChange={(e) => setEditNextAction(e.target.value)}
                  placeholder="e.g. Call fleet manager"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm">Notes</label>
                <textarea
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              {editError && (
                <div className="md:col-span-2 text-sm text-red-600">{editError}</div>
              )}

              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 text-sm font-medium shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 transition-all"
                >
                  {savingEdit ? "Saving…" : "Save changes"}
                </button>

                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => deleteOpportunity(editId)}
                  className="ml-auto rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 text-sm font-medium shadow-md hover:shadow-lg hover:from-red-700 hover:to-red-800 disabled:opacity-60 transition-all"
                >
                  {savingEdit ? "Deleting…" : "Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WHAT-IF SIMULATOR */}
      {showWhatIf && (
        <WhatIfSimulator
          onClose={() => setShowWhatIf(false)}
          deals={filteredRows.map((o) => ({
            id: o.id,
            name: getAccountName(o),
            stage: o.stage || "Unknown",
            value: Number(o.rolling_12m_value || 0),
            probability: Number(o.probability || 0),
          }))}
        />
      )}
    </div>
  );
}
