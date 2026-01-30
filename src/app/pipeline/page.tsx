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
  next_action_completed_at?: string | null;
  next_action_completed_by?: string | null;
  next_action_completed_note?: string | null;
  owner_user_id?: string | null;
  sales_person?: string | null;
  battery_solution?: string | null;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  how_we_win?: string | null;
  opportunity_for_bnt?: string | null;
  bnt_categories?: string | null;
  bnt_invite?: string | null;
  opportunity_for_penz?: string | null;
  penz_categories?: string | null;
  penz_invite?: string | null;
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

const BATTERY_SOLUTIONS = [
  "Automotive",
  "Commercial Vehicles and Fleets",
  "OEM",
  "Marine",
  "Deep Cycle",
  "Industrial",
  "Energy Storage",
  "Mixed",
] as const;

const HOW_WE_WIN_OPTIONS = [
  "Quality / performance",
  "Convenience / ease (time, effort, access)",
  "Price / value for money (including deals)",
  "Trust / credibility",
  "Recommendation",
] as const;

const BNT_CATEGORY_OPTIONS = [
  "Brake Friction",
  "Engine",
  "Steering and Suspension",
  "Lubricants",
  "Filtration",
  "All",
] as const;

const PENZ_CATEGORY_OPTIONS = [
  "Hoists",
  "Tyre Changers",
  "Wheel Balancers",
  "Wheel Aligners",
  "All",
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

function formatISODateOnly(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatNZDate(iso: string | null | undefined): string {
  const d = isoToDate(iso ?? null);
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-NZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function formatNZDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-NZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
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
  const [refreshing, setRefreshing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<OpportunityRow[]>([]);

  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");

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
  const [createSalesPerson, setCreateSalesPerson] = useState<string>("");
  const [createBatterySolution, setCreateBatterySolution] = useState<string>("");
  const [createHowWeWin, setCreateHowWeWin] = useState<string[]>([]);
  const [createOpportunityForBnt, setCreateOpportunityForBnt] = useState<string>("");
  const [createBntCategories, setCreateBntCategories] = useState<string[]>([]);
  const [createBntInvite, setCreateBntInvite] = useState<string>("");
  const [createOpportunityForPenz, setCreateOpportunityForPenz] = useState<string>("");
  const [createPenzCategories, setCreatePenzCategories] = useState<string[]>([]);
  const [createPenzInvite, setCreatePenzInvite] = useState<string>("");
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
  const [editNextActionCompletedAt, setEditNextActionCompletedAt] = useState<string>("");
  const [editCompletionNote, setEditCompletionNote] = useState<string>("");
  const [editOriginalNextAction, setEditOriginalNextAction] = useState<string>("");
  const [editOriginalNextActionDue, setEditOriginalNextActionDue] = useState<string>("");
  const [editOwnerUserId, setEditOwnerUserId] = useState<string>("");
  const [editSalesPerson, setEditSalesPerson] = useState<string>("");
  const [editBatterySolution, setEditBatterySolution] = useState<string>("");
  const [editHowWeWin, setEditHowWeWin] = useState<string[]>([]);
  const [editOpportunityForBnt, setEditOpportunityForBnt] = useState<string>("");
  const [editBntCategories, setEditBntCategories] = useState<string[]>([]);
  const [editBntInvite, setEditBntInvite] = useState<string>("");
  const [editOpportunityForPenz, setEditOpportunityForPenz] = useState<string>("");
  const [editPenzCategories, setEditPenzCategories] = useState<string[]>([]);
  const [editPenzInvite, setEditPenzInvite] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");

  function toggleMultiSelect(setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) {
    setter((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  }

  function parseMultiValue(raw: unknown): string[] {
    const s = String(raw ?? "").trim();
    if (!s) return [];
    return s
      .split(/[,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function getOpportunitySignals(o: OpportunityRow): string[] {
    const out: string[] = [];

    const howWeWin = parseMultiValue(o.how_we_win);
    if (howWeWin.length) {
      const shown = howWeWin.slice(0, 2).join(", ");
      const suffix = howWeWin.length > 2 ? ` +${howWeWin.length - 2}` : "";
      out.push(`How we win: ${shown}${suffix}`);
    }

    const bnt = String(o.opportunity_for_bnt ?? "").trim();
    if (bnt.toLowerCase() === "yes") {
      const cats = parseMultiValue(o.bnt_categories);
      const catText = cats.length
        ? ` (${cats.slice(0, 2).join(", ")}${cats.length > 2 ? ` +${cats.length - 2}` : ""})`
        : "";
      out.push(`BNT${catText}`);
    }

    const penz = String(o.opportunity_for_penz ?? "").trim();
    if (penz.toLowerCase() === "yes") {
      const cats = parseMultiValue(o.penz_categories);
      const catText = cats.length
        ? ` (${cats.slice(0, 2).join(", ")}${cats.length > 2 ? ` +${cats.length - 2}` : ""})`
        : "";
      out.push(`PENZ${catText}`);
    }

    return out;
  }

  // quick update UI state
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [nextActionSavingId, setNextActionSavingId] = useState<string | null>(null);

  // ---- Filters ----
  const [filterBranchId, setFilterBranchId] = useState<string>(""); // "" = All
  const [filterStage, setFilterStage] = useState<string>(""); // "" = All
  const [filterSalesPerson, setFilterSalesPerson] = useState<string>(""); // "" = All
  const [filterBatterySolution, setFilterBatterySolution] = useState<string>(""); // "" = All
  const [filterOwner, setFilterOwner] = useState<"all" | "mine">("all");
  const [filterCloseWindow, setFilterCloseWindow] = useState<CloseWindow>("all");
  const [filterProbBand, setFilterProbBand] = useState<ProbBand>("all");
  const [filterHealth, setFilterHealth] = useState<Health>("all");
  const [search, setSearch] = useState<string>("");

  const ownerFieldAvailable = useMemo(() => {
    return rows.some((r) => Object.prototype.hasOwnProperty.call(r, "owner_user_id"));
  }, [rows]);

  useEffect(() => {
    if (!ownerFieldAvailable && filterOwner !== "all") setFilterOwner("all");
  }, [ownerFieldAvailable, filterOwner]);

  const salesPeople = useMemo(() => {
    const uniq = new Set<string>();
    for (const r of rows) {
      const sp = String(r.sales_person ?? "").trim();
      if (sp) uniq.add(sp);
    }
    return Array.from(uniq).sort((a, b) => a.localeCompare(b));
  }, [rows]);

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

  async function refreshAll() {
    const ok = await ensureSignedInOrBounce();
    if (!ok) return;

    try {
      setRefreshing(true);
      setDbError(null);
      await Promise.all([fetchBranches(), fetchAccounts(), fetchOpportunities()]);
    } catch (e: unknown) {
      setDbError(getErrorMessage(e));
    } finally {
      setRefreshing(false);
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
      const wanted = "National Account/Head Office";
      const hasWanted = list.some((b) => b.name.trim().toLowerCase() === wanted.toLowerCase());

      if (!hasWanted) {
        try {
          const { data: created, error: createErr } = await supabase
            .from("branches")
            .insert({ name: wanted })
            .select("id,name")
            .single();

          if (createErr) {
            console.warn(
              `Could not auto-create branch "${wanted}". Add it in the branches table to show it in dropdowns.`,
              createErr
            );
            setBranches(list);
            if (!createBranchId && list.length) setCreateBranchId(list[0].id);
            return;
          }

          const next = [...list, (created as Branch)].sort((a, b) => a.name.localeCompare(b.name));
          setBranches(next);
          if (!createBranchId && next.length) setCreateBranchId(next[0].id);
          return;
        } catch (e) {
          console.warn(`Branch seed for "${wanted}" failed.`, e);
        }
      }

      setBranches(list);
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
      const MAX_OPPORTUNITIES = 2000;
      const { data, error } = await supabase
        .from("opportunities")
        .select("*, accounts(id, name), branches(id, name)")
        .order("created_at", { ascending: false })
        .limit(MAX_OPPORTUNITIES);

      if (error) throw new Error(error.message || "Failed to fetch opportunities");

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
        setCurrentUserId(session?.user?.id ?? "");
        setCurrentUserEmail(session?.user?.email ?? "");
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
    setCreateSalesPerson("");
    setCreateBatterySolution("");
    setCreateHowWeWin([]);
    setCreateOpportunityForBnt("");
    setCreateBntCategories([]);
    setCreateBntInvite("");
    setCreateOpportunityForPenz("");
    setCreatePenzCategories([]);
    setCreatePenzInvite("");
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
        throw new Error("Rolling 12 MTH value must be a number >= 0.");
      }

      const probNum = Number(createProbability);
      if (Number.isNaN(probNum) || probNum < 0 || probNum > 100) {
        throw new Error("Probability must be between 0 and 100.");
      }

      if (createCloseDate && new Date(createCloseDate) < new Date()) {
        throw new Error("Close date cannot be in the past");
      }

      const insertBase = {
        account_id: acctId,
        branch_id: createBranchId || null,
        stage: createStage,
        close_date: createCloseDate || null,
        rolling_12m_value: valueNum,
        probability: probNum,
        next_action: createNextAction.trim() || null,
        next_action_due: createNextActionDue || null,
        next_action_completed_at: null,
        ...(createSalesPerson.trim() ? { sales_person: createSalesPerson.trim() } : {}),
        ...(createBatterySolution.trim() ? { battery_solution: createBatterySolution.trim() } : {}),
        ...(createHowWeWin.length ? { how_we_win: createHowWeWin.join(", ") } : {}),
        ...(createOpportunityForBnt.trim() ? { opportunity_for_bnt: createOpportunityForBnt.trim() } : {}),
        ...(createOpportunityForBnt.trim().toLowerCase() === "yes" && createBntCategories.length
          ? { bnt_categories: createBntCategories.join(", ") }
          : {}),
        ...(createOpportunityForBnt.trim().toLowerCase() === "yes" && createBntInvite.trim()
          ? { bnt_invite: createBntInvite.trim() }
          : {}),
        ...(createOpportunityForPenz.trim() ? { opportunity_for_penz: createOpportunityForPenz.trim() } : {}),
        ...(createOpportunityForPenz.trim().toLowerCase() === "yes" && createPenzCategories.length
          ? { penz_categories: createPenzCategories.join(", ") }
          : {}),
        ...(createOpportunityForPenz.trim().toLowerCase() === "yes" && createPenzInvite.trim()
          ? { penz_invite: createPenzInvite.trim() }
          : {}),
        notes: createNotes.trim() || null,
      } as Record<string, unknown>;

      const insertWithOwner =
        currentUserId ? { ...insertBase, owner_user_id: currentUserId } : insertBase;

      let { error } = await supabase.from("opportunities").insert(insertWithOwner);

      if (error) {
        const msg = error.message || "Failed to create opportunity";

        const missingOwner =
          /owner_user_id/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg);
        if (missingOwner && currentUserId) {
          console.warn("owner_user_id column missing; creating opportunity without owner assignment.");
          const retry = await supabase.from("opportunities").insert(insertBase);
          error = retry.error;
        }

        if (!error) {
          // retry succeeded
        } else {
        if (/sales_person/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "Sales person field isn't in your database yet. Add a nullable text column on opportunities: sales_person."
          );
        }
        if (/battery_solution/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "Battery Solution field isn't in your database yet. Add a nullable text column on opportunities: battery_solution."
          );
        }
        if (/how_we_win/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "How we win field isn't in your database yet. Add a nullable text column on opportunities: how_we_win."
          );
        }
        if (/opportunity_for_bnt/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "BNT opportunity field isn't in your database yet. Add a nullable text column on opportunities: opportunity_for_bnt."
          );
        }
        if (/bnt_categories/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "BNT categories field isn't in your database yet. Add a nullable text column on opportunities: bnt_categories."
          );
        }
        if (/bnt_invite/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "BNT invite field isn't in your database yet. Add a nullable text column on opportunities: bnt_invite."
          );
        }
        if (/opportunity_for_penz/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "PENZ opportunity field isn't in your database yet. Add a nullable text column on opportunities: opportunity_for_penz."
          );
        }
        if (/penz_categories/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "PENZ categories field isn't in your database yet. Add a nullable text column on opportunities: penz_categories."
          );
        }
        if (/penz_invite/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "PENZ invite field isn't in your database yet. Add a nullable text column on opportunities: penz_invite."
          );
        }
          throw new Error(error.message || msg);
        }
      }

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
    setEditNextActionCompletedAt(String(row.next_action_completed_at ?? ""));
    setEditCompletionNote("");
    setEditOriginalNextAction(row.next_action ?? "");
    setEditOriginalNextActionDue(row.next_action_due ?? "");
    setEditOwnerUserId(String(row.owner_user_id ?? ""));
    setEditSalesPerson(String(row.sales_person ?? ""));
    setEditBatterySolution(String(row.battery_solution ?? ""));
    setEditHowWeWin(parseMultiValue(row.how_we_win));
    setEditOpportunityForBnt(String(row.opportunity_for_bnt ?? ""));
    setEditBntCategories(parseMultiValue(row.bnt_categories));
    setEditBntInvite(String(row.bnt_invite ?? ""));
    setEditOpportunityForPenz(String(row.opportunity_for_penz ?? ""));
    setEditPenzCategories(parseMultiValue(row.penz_categories));
    setEditPenzInvite(String(row.penz_invite ?? ""));
    setEditNotes(row.notes ?? "");
    setEditOpen(true);
  }

  async function snoozeNextAction(id: string, days: number) {
    const ok = await ensureSignedInOrBounce();
    if (!ok) return;

    if (!Number.isFinite(days) || days <= 0) return;

    const current = rows.find((r) => r.id === id);
    if (!current) return;
    if (current.next_action_completed_at) {
      alert("This next action is already completed.");
      return;
    }

    const confirmed = window.confirm(`Snooze this next action by ${days} day(s)?`);
    if (!confirmed) return;

    try {
      setNextActionSavingId(id);

      const base = isoToDate(current.next_action_due) ?? startOfDay(new Date());
      const nextDue = formatISODateOnly(addDays(base, days));

      // optimistic UI
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, next_action_due: nextDue } : r)));
      if (editOpen && editId === id) setEditNextActionDue(nextDue);

      const { error } = await supabase
        .from("opportunities")
        .update({ next_action_due: nextDue })
        .eq("id", id);

      if (error) throw new Error(error.message || "Failed to snooze next action");
    } catch (e: unknown) {
      console.error("Snooze failed:", e);
      await fetchOpportunities();
      alert(getErrorMessage(e));
    } finally {
      setNextActionSavingId(null);
    }
  }

  async function reopenNextAction(id: string) {
    const ok = await ensureSignedInOrBounce();
    if (!ok) return;

    const current = rows.find((r) => r.id === id);
    if (!current) return;
    if (!current.next_action_completed_at) return;

    const confirmed = window.confirm("Reopen this next action? It will return to overdue/due lists if applicable.");
    if (!confirmed) return;

    try {
      setNextActionSavingId(id);

      // optimistic UI
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                next_action_completed_at: null,
                next_action_completed_by: null,
                next_action_completed_note: null,
              }
            : r
        )
      );

      if (editOpen && editId === id) {
        setEditNextActionCompletedAt("");
        setEditCompletionNote("");
      }

      const fullUpdate = {
        next_action_completed_at: null,
        next_action_completed_by: null,
        next_action_completed_note: null,
      } as Record<string, unknown>;

      let { error } = await supabase.from("opportunities").update(fullUpdate).eq("id", id);

      if (error) {
        const msg = error.message || "Failed to reopen next action";
        if (/next_action_completed_at/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          // Completion tracking is optional; if the column doesn't exist, we can't persist reopen.
          // Refresh to restore server truth and continue without blocking the user.
          await fetchOpportunities();
          alert(
            "Completion tracking isn't enabled in your database yet. To enable reopen/history, run SUPABASE_SQL_next_action_completed_at.sql (see SUPABASE_SCHEMA_CHECKLIST.md)."
          );
          return;
        }

        const isMissingMeta =
          (/next_action_completed_by/i.test(msg) || /next_action_completed_note/i.test(msg)) &&
          /(does not exist|unknown column|column)/i.test(msg);

        if (isMissingMeta) {
          const retry = await supabase
            .from("opportunities")
            .update({ next_action_completed_at: null })
            .eq("id", id);
          error = retry.error;
        }

        if (error) throw new Error(error.message || msg);
      }
    } catch (e: unknown) {
      console.error("Reopen failed:", e);
      await fetchOpportunities();
      alert(getErrorMessage(e));
    } finally {
      setNextActionSavingId(null);
    }
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
        throw new Error("Rolling 12 MTH value must be a number >= 0.");
      }

      const probNum = Number(editProbability);
      if (Number.isNaN(probNum) || probNum < 0 || probNum > 100) {
        throw new Error("Probability must be between 0 and 100.");
      }

      if (editCloseDate && new Date(editCloseDate) < new Date()) {
        throw new Error("Close date cannot be in the past");
      }

      const norm = (s: string) => (s ?? "").trim() || null;
      const normDate = (s: string) => (s ?? "").trim() || null;

      const nextAction = norm(editNextAction);
      const nextActionDue = normDate(editNextActionDue);

      const originalNextAction = norm(editOriginalNextAction);
      const originalNextActionDue = normDate(editOriginalNextActionDue);

      const nextActionChanged =
        nextAction !== originalNextAction || nextActionDue !== originalNextActionDue;

      // If the next action changes (or is cleared), we clear completion; otherwise preserve it.
      const nextActionCompletedAt =
        !nextAction && !nextActionDue
          ? null
          : nextActionChanged
            ? null
            : normDate(editNextActionCompletedAt);

      const updateBase = {
        branch_id: editBranchId || null,
        stage: editStage,
        close_date: editCloseDate || null,
        rolling_12m_value: valueNum,
        probability: probNum,
        next_action: nextAction,
        next_action_due: nextActionDue,
        next_action_completed_at: nextActionCompletedAt,
        ...(editSalesPerson.trim() ? { sales_person: editSalesPerson.trim() } : { sales_person: null }),
        ...(editBatterySolution.trim()
          ? { battery_solution: editBatterySolution.trim() }
          : { battery_solution: null }),
        how_we_win: editHowWeWin.length ? editHowWeWin.join(", ") : null,
        opportunity_for_bnt: editOpportunityForBnt.trim() || null,
        bnt_categories:
          editOpportunityForBnt.trim().toLowerCase() === "yes"
            ? editBntCategories.length
              ? editBntCategories.join(", ")
              : null
            : null,
        bnt_invite:
          editOpportunityForBnt.trim().toLowerCase() === "yes" ? editBntInvite.trim() || null : null,
        opportunity_for_penz: editOpportunityForPenz.trim() || null,
        penz_categories:
          editOpportunityForPenz.trim().toLowerCase() === "yes"
            ? editPenzCategories.length
              ? editPenzCategories.join(", ")
              : null
            : null,
        penz_invite:
          editOpportunityForPenz.trim().toLowerCase() === "yes" ? editPenzInvite.trim() || null : null,
        ...(editBatterySolution.trim() === "Commercial Vehicles and Fleets"
          ? {}
          : {
              vehicle_brand: null,
              vehicle_model: null,
            }),
        notes: editNotes.trim() || null,
      } as Record<string, unknown>;

      const updateWithOwner = ownerFieldAvailable
        ? { ...updateBase, owner_user_id: editOwnerUserId.trim() || null }
        : updateBase;

      let { error } = await supabase.from("opportunities").update(updateWithOwner).eq("id", editId);

      if (error) {
        const msg = error.message || "Failed to update opportunity";
        if (/sales_person/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "Sales person field isn't in your database yet. Add a nullable text column on opportunities: sales_person."
          );
        }
        if (/battery_solution/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "Battery Solution field isn't in your database yet. Add a nullable text column on opportunities: battery_solution."
          );
        }

        if (/how_we_win/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "How we win field isn't in your database yet. Add a nullable text column on opportunities: how_we_win."
          );
        }
        if (/opportunity_for_bnt/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "BNT opportunity field isn't in your database yet. Add a nullable text column on opportunities: opportunity_for_bnt."
          );
        }
        if (/bnt_categories/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "BNT categories field isn't in your database yet. Add a nullable text column on opportunities: bnt_categories."
          );
        }
        if (/bnt_invite/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "BNT invite field isn't in your database yet. Add a nullable text column on opportunities: bnt_invite."
          );
        }
        if (/opportunity_for_penz/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "PENZ opportunity field isn't in your database yet. Add a nullable text column on opportunities: opportunity_for_penz."
          );
        }
        if (/penz_categories/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "PENZ categories field isn't in your database yet. Add a nullable text column on opportunities: penz_categories."
          );
        }
        if (/penz_invite/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          throw new Error(
            "PENZ invite field isn't in your database yet. Add a nullable text column on opportunities: penz_invite."
          );
        }

        if (/next_action_completed_at/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          // Completion tracking is optional (see SUPABASE_SCHEMA_CHECKLIST.md).
          // Retry the update without referencing the missing column.
          const retryUpdate = { ...(updateWithOwner as Record<string, unknown>) };
          delete retryUpdate.next_action_completed_at;
          const retry = await supabase.from("opportunities").update(retryUpdate).eq("id", editId);
          error = retry.error;
        }

        const missingOwner = /owner_user_id/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg);
        if (missingOwner && ownerFieldAvailable) {
          const retry = await supabase.from("opportunities").update(updateBase).eq("id", editId);
          error = retry.error;
        }

        if (error) throw new Error(error.message || msg);
      }

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

      const response = await supabase
        .from("opportunities")
        .delete()
        .eq("id", id);

      if (response.error) {
        console.error("Delete error from Supabase:", response.error);
        throw new Error(response.error.message || "Failed to delete - RLS policy may be blocking");
      }
      
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
    const sp = filterSalesPerson.trim().toLowerCase();
    const bs = filterBatterySolution.trim().toLowerCase();

    return rows.filter((r) => {
      if (filterBranchId && r.branch_id !== filterBranchId) return false;
      if (filterStage && (r.stage ?? "") !== filterStage) return false;

      if (ownerFieldAvailable && filterOwner === "mine") {
        if (!currentUserId) return false;
        if ((r.owner_user_id ?? "") !== currentUserId) return false;
      }

      if (sp) {
        const rowSp = String(r.sales_person ?? "").trim().toLowerCase();
        if (!rowSp.includes(sp)) return false;
      }

      if (bs) {
        const rowBs = String(r.battery_solution ?? "").trim().toLowerCase();
        if (!rowBs.includes(bs)) return false;
      }

      if (filterProbBand !== "all") {
        const p = Number(r.probability ?? 0);
        if (filterProbBand === "0-30" && !(p >= 0 && p <= 30)) return false;
        if (filterProbBand === "31-60" && !(p >= 31 && p <= 60)) return false;
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
  }, [rows, filterBranchId, filterStage, filterSalesPerson, filterBatterySolution, filterOwner, ownerFieldAvailable, currentUserId, filterProbBand, filterCloseWindow, filterHealth, search, today, in30, in60]);

  async function markNextActionDone(id: string, opts?: { note?: string | null }) {
    const ok = await ensureSignedInOrBounce();
    if (!ok) return;

    const current = rows.find((r) => r.id === id);
    const previousCompletedAt = current?.next_action_completed_at ?? null;
    if (previousCompletedAt) {
      alert(`Already marked done (${formatNZDateTime(previousCompletedAt)}).`);
      return;
    }

    const confirmed = window.confirm(
      "Mark this next action as done? This will record completion and remove it from overdue lists."
    );
    if (!confirmed) return;

    try {
      setNextActionSavingId(id);

      const completedAt = new Date().toISOString();

      const noteRaw = String(opts?.note ?? "").trim();
      const note = noteRaw ? noteRaw.slice(0, 500) : null;

      // best-effort user identity
      let completedBy: string | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        completedBy = data?.user?.email ?? data?.user?.id ?? null;
      } catch {
        completedBy = currentUserEmail || currentUserId || null;
      }

      // optimistic UI
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                next_action_completed_at: completedAt,
                next_action_completed_by: completedBy,
                next_action_completed_note: note,
              }
            : r
        )
      );

      if (editOpen && editId === id) {
        setEditNextActionCompletedAt(completedAt);
        setEditCompletionNote("");
      }

      // Try to write extended metadata; if those columns don't exist, fall back to completion timestamp only.
      const fullUpdate = {
        next_action_completed_at: completedAt,
        ...(completedBy ? { next_action_completed_by: completedBy } : {}),
        ...(note ? { next_action_completed_note: note } : {}),
      } as Record<string, unknown>;

      let { error } = await supabase.from("opportunities").update(fullUpdate).eq("id", id);

      if (error) {
        const msg = error.message || "Failed to mark next action done";
        if (/next_action_completed_at/i.test(msg) && /(does not exist|unknown column|column)/i.test(msg)) {
          // Completion tracking is optional (see SUPABASE_SCHEMA_CHECKLIST.md).
          // Fall back to clearing the next action so it no longer shows as overdue.
          const fallback = await supabase
            .from("opportunities")
            .update({ next_action: null, next_action_due: null })
            .eq("id", id);

          if (fallback.error) {
            throw new Error(fallback.error.message || msg);
          }

          // Keep UI consistent with DB (no completion history available).
          setRows((prev) =>
            prev.map((r) =>
              r.id === id
                ? {
                    ...r,
                    next_action: null,
                    next_action_due: null,
                    next_action_completed_at: null,
                    next_action_completed_by: null,
                    next_action_completed_note: null,
                  }
                : r
            )
          );

          if (editOpen && editId === id) {
            setEditNextAction("");
            setEditNextActionDue("");
            setEditNextActionCompletedAt("");
            setEditCompletionNote("");
          }

          await fetchOpportunities();
          alert(
            "Marked as done (fallback). To enable completion history, run SUPABASE_SQL_next_action_completed_at.sql in Supabase (see SUPABASE_SCHEMA_CHECKLIST.md)."
          );
          return;
        }

        const isMissingMeta =
          (/next_action_completed_by/i.test(msg) || /next_action_completed_note/i.test(msg)) &&
          /(does not exist|unknown column|column)/i.test(msg);

        if (isMissingMeta) {
          const retry = await supabase
            .from("opportunities")
            .update({ next_action_completed_at: completedAt })
            .eq("id", id);
          error = retry.error;
        }

        if (error) throw new Error(error.message || msg);
      }
    } catch (e: unknown) {
      console.error("Mark done failed:", e);
      await fetchOpportunities();
      if (editOpen && editId === id) {
        setEditNextActionCompletedAt(String(previousCompletedAt ?? ""));
      }
      alert(getErrorMessage(e));
    } finally {
      setNextActionSavingId(null);
    }
  }

  const dashboard = useMemo(() => {
    const active = filteredRows.filter((r) => isActiveStage(r.stage));

    const activeWithOpenActions = active.filter((r) => !r.next_action_completed_at);

    const overdueActions = activeWithOpenActions.filter((r) => {
      const d = isoToDate(r.next_action_due);
      if (!d) return false;
      return startOfDay(d) < today;
    });

    const dueThisWeek = activeWithOpenActions.filter((r) => {
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

    const nextActionsList = activeWithOpenActions
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
    if (!o.next_action_completed_at && nextDue && nextDue < now) return "at-risk";
    
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
    setFilterSalesPerson("");
    setFilterBatterySolution("");
    setFilterOwner("all");
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
          <p className="font-semibold text-slate-800 dark:text-slate-100">Loading pipeline…</p>
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">Fetching your data</p>
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
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 min-h-screen text-slate-950 dark:text-slate-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">Pipeline</h1>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Kanban board added. Drag deals around like you’re solving a crime.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="rounded-lg border border-slate-300 bg-white dark:bg-slate-800 dark:border-slate-600 shadow-sm p-1 flex gap-1">
            <button
              onClick={() => setViewMode("board")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-all ${
                viewMode === "board" ? "bg-blue-600 text-white shadow-md" : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-all ${
                viewMode === "table" ? "bg-blue-600 text-white shadow-md" : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              Table
            </button>
          </div>

          <button
            onClick={() => setShowWhatIf(true)}
            title="Simulate different scenarios"
            className="rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-md hover:shadow-lg"
          >
            🎯 What-If
          </button>

          <button
            onClick={refreshAll}
            disabled={refreshing || loading}
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all shadow-md hover:shadow-lg disabled:opacity-60"
            title="Refresh pipeline data"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>

          <button
            onClick={() => router.push("/analytics")}
            className="rounded-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-2.5 text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 hover:from-indigo-700 hover:to-indigo-800 active:translate-y-0 transition-all"
          >
            📊 Analytics
          </button>

          <button
            onClick={() => router.push("/replay")}
            className="rounded-full bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-2.5 text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 hover:from-slate-900 hover:to-black active:translate-y-0 transition-all"
            title="Rewind your pipeline and see what changed"
          >
            ⏪ Time Machine
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-full bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-2.5 text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 hover:from-purple-700 hover:to-purple-800 active:translate-y-0 transition-all"
          >
            Dashboard
          </button>

          <button
            onClick={() => setShowCreate((s) => !s)}
            className="rounded-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2.5 text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-800 active:translate-y-0 transition-all"
          >
            {showCreate ? "Close" : "New opportunity"}
          </button>

          <button
            onClick={signOut}
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all shadow-md hover:shadow-lg"
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
      <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Filters</h2>
          <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors" onClick={clearFilters}>
            Clear all
          </button>
        </div>

        <div className={`grid gap-4 ${ownerFieldAvailable ? "md:grid-cols-9" : "md:grid-cols-8"}`}>
          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Branch</label>
            <select
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all appearance-none cursor-pointer hover:border-slate-400 dark:hover:border-slate-500"
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
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Sales person</label>
            <select
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all appearance-none cursor-pointer hover:border-slate-400 dark:hover:border-slate-500"
              value={filterSalesPerson}
              onChange={(e) => setFilterSalesPerson(e.target.value)}
            >
              <option value="">All sales people</option>
              {salesPeople.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          </div>

          {ownerFieldAvailable && (
            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Owner</label>
              <select
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all appearance-none cursor-pointer hover:border-slate-400 dark:hover:border-slate-500"
                value={filterOwner}
                onChange={(e) => setFilterOwner(e.target.value === "mine" ? "mine" : "all")}
                disabled={!currentUserId}
              >
                <option value="all">All</option>
                <option value="mine">My deals</option>
              </select>
              {!currentUserId && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Sign in required.</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Battery Solution</label>
            <select
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all appearance-none cursor-pointer hover:border-slate-400 dark:hover:border-slate-500"
              value={filterBatterySolution}
              onChange={(e) => setFilterBatterySolution(e.target.value)}
            >
              <option value="">All solutions</option>
              {BATTERY_SOLUTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Stage</label>
            <select
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all appearance-none cursor-pointer hover:border-slate-400 dark:hover:border-slate-500"
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
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Close window</label>
            <select
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all appearance-none cursor-pointer hover:border-slate-400 dark:hover:border-slate-500"
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
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Probability</label>
            <select
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all appearance-none cursor-pointer hover:border-slate-400 dark:hover:border-slate-500"
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
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Deal Health</label>
            <select
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all appearance-none cursor-pointer hover:border-slate-400 dark:hover:border-slate-500"
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
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Search</label>
            <input
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all hover:border-slate-400 dark:hover:border-slate-500 placeholder:text-slate-500 dark:placeholder:text-slate-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Account name…"
            />
          </div>
        </div>
      </div>

      {/* DASHBOARD */}
      <div className="grid gap-4 md:grid-cols-4">
        <div
          className={`rounded-2xl border p-4 shadow-sm hover:shadow-md transition-shadow ${
            dashboard.overdueActions.length
              ? "border-red-200 bg-gradient-to-br from-red-50 to-red-100"
              : "border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100"
          }`}
        >
          <div className={`text-sm font-medium ${dashboard.overdueActions.length ? "text-red-800" : "text-blue-700"}`}>
            Overdue actions
          </div>
          <div className={`text-3xl font-bold mt-2 ${dashboard.overdueActions.length ? "text-red-900" : "text-blue-900"}`}>
            {dashboard.overdueActions.length}
          </div>
          <div className={`text-xs mt-1 ${dashboard.overdueActions.length ? "text-red-700" : "text-blue-600"}`}>
            Active stages only
          </div>
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
          <div className="text-sm font-medium text-green-700">Total 12 MTH value</div>
          <div className="text-3xl font-bold text-green-900 mt-2">
            {dashboard.totalValue.toLocaleString()}
          </div>
          <div className="text-xs text-green-600 mt-1">Filtered + active only</div>
        </div>
      </div>

      {/* NEXT ACTIONS LIST */}
      <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Next actions due (top 10)</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Account</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Branch</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Stage</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Due</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Next action</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Done</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.nextActionsList.map((o) => {
                const due = isoToDate(o.next_action_due);
                const isOverdue = !!due && startOfDay(due) < today;
                const isCompleted = Boolean(o.next_action_completed_at);
                const isSaving = nextActionSavingId === o.id;

                return (
                  <tr
                    key={o.id}
                    className={`border-t border-slate-200 dark:border-slate-700 ${
                      isOverdue
                        ? "bg-red-50/70 dark:bg-red-950/30"
                        : "bg-transparent"
                    }`}
                  >
                    <td className="p-3">{getAccountName(o)}</td>
                    <td className="p-3">{getBranchName(o)}</td>
                    <td className="p-3">{o.stage ?? "-"}</td>
                    <td className="p-3">
                      <span className={isOverdue ? "font-semibold text-red-900 dark:text-red-200" : ""}>
                        {formatNZDate(o.next_action_due)}
                      </span>
                      {isOverdue && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-red-200 text-red-900 px-2 py-0.5 text-xs font-semibold">
                          Overdue
                        </span>
                      )}
                    </td>
                    <td className="p-3">{o.next_action ?? "—"}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isSaving || isCompleted}
                          onClick={() => markNextActionDone(o.id)}
                          className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all shadow-sm disabled:opacity-60"
                        >
                          {isSaving ? "Saving…" : isCompleted ? "Done" : "Mark done"}
                        </button>

                        <button
                          type="button"
                          disabled={isSaving || isCompleted}
                          onClick={() => snoozeNextAction(o.id, 1)}
                          className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all shadow-sm disabled:opacity-60"
                        >
                          Snooze 1d
                        </button>

                        <button
                          type="button"
                          disabled={isSaving || isCompleted}
                          onClick={() => snoozeNextAction(o.id, 7)}
                          className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all shadow-sm disabled:opacity-60"
                        >
                          Snooze 7d
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!dashboard.nextActionsList.length && (
                <tr>
                  <td className="p-3" colSpan={6}>
                    No next actions due (either you’re incredibly organised or nobody is entering next actions).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECENTLY COMPLETED ACTIONS */}
      <div className="mt-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Recently completed next actions</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Account</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Completed</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">By</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Due</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Next action</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Reopen</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows
                .filter((r) => r.next_action_completed_at)
                .slice()
                .sort((a, b) =>
                  new Date(String(b.next_action_completed_at)).getTime() -
                  new Date(String(a.next_action_completed_at)).getTime()
                )
                .slice(0, 10)
                .map((o) => {
                  const isSaving = nextActionSavingId === o.id;
                  return (
                    <tr key={o.id} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="p-3">{getAccountName(o)}</td>
                      <td className="p-3">{formatNZDateTime(o.next_action_completed_at)}</td>
                      <td className="p-3">{o.next_action_completed_by ?? "—"}</td>
                      <td className="p-3">{formatNZDate(o.next_action_due)}</td>
                      <td className="p-3">
                        <div className="font-medium">{o.next_action ?? "—"}</div>
                        {o.next_action_completed_note ? (
                          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            Note: {o.next_action_completed_note}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => reopenNextAction(o.id)}
                          className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all shadow-sm disabled:opacity-60"
                        >
                          {isSaving ? "Saving…" : "Reopen"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              {!filteredRows.some((r) => r.next_action_completed_at) && (
                <tr>
                  <td className="p-3" colSpan={6}>
                    No completed next actions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE */}
      {showCreate && (
        <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Create opportunity</h2>
          <form onSubmit={onCreateOpportunity} className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Account (type existing or new)</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
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
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                If it doesn’t exist, it will be created automatically.
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Branch</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
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
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Sales person</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                value={createSalesPerson}
                onChange={(e) => setCreateSalesPerson(e.target.value)}
                list="sales-person-list-create"
                placeholder="e.g. Sam Taylor"
              />
              <datalist id="sales-person-list-create">
                {salesPeople.map((sp) => (
                  <option key={sp} value={sp} />
                ))}
              </datalist>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Used for filtering (optional).</p>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Battery Solution</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors appearance-none cursor-pointer"
                value={createBatterySolution}
                onChange={(e) => {
                  const next = e.target.value;
                  setCreateBatterySolution(next);
                }}
              >
                <option value="">(optional)</option>
                {BATTERY_SOLUTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">How we win?</label>
              <details className="mt-1 relative">
                <summary className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm hover:border-slate-400 dark:hover:border-slate-500 transition-colors cursor-pointer">
                  {createHowWeWin.length ? createHowWeWin.join(", ") : "Select one or more…"}
                </summary>
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-lg">
                  <div className="grid gap-2">
                    {HOW_WE_WIN_OPTIONS.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={createHowWeWin.includes(opt)}
                          onChange={() => toggleMultiSelect(setCreateHowWeWin, opt)}
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </details>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">OPPORTUNITY FOR BNT?</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                value={createOpportunityForBnt}
                onChange={(e) => {
                  const v = e.target.value;
                  setCreateOpportunityForBnt(v);
                  if (v.trim().toLowerCase() !== "yes") {
                    setCreateBntCategories([]);
                    setCreateBntInvite("");
                  }
                }}
              >
                <option value="">(select)</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            {createOpportunityForBnt.trim().toLowerCase() === "yes" && (
              <>
                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">BNT categories</label>
                  <details className="mt-1 relative">
                    <summary className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm hover:border-slate-400 dark:hover:border-slate-500 transition-colors cursor-pointer">
                      {createBntCategories.length ? createBntCategories.join(", ") : "Select one or more…"}
                    </summary>
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-lg">
                      <div className="grid gap-2">
                        {BNT_CATEGORY_OPTIONS.map((opt) => (
                          <label key={opt} className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                            <input
                              type="checkbox"
                              checked={createBntCategories.includes(opt)}
                              onChange={() => {
                                if (opt === "All") {
                                  setCreateBntCategories((prev) =>
                                    prev.includes("All") ? [] : Array.from(BNT_CATEGORY_OPTIONS)
                                  );
                                } else {
                                  toggleMultiSelect(setCreateBntCategories, opt);
                                  setCreateBntCategories((prev) => prev.filter((x) => x !== "All"));
                                }
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </details>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Next step invite who from BNT?</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                    value={createBntInvite}
                    onChange={(e) => setCreateBntInvite(e.target.value)}
                    placeholder="Name(s)…"
                  />
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">OPPORTUNITY FOR PENZ?</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                value={createOpportunityForPenz}
                onChange={(e) => {
                  const v = e.target.value;
                  setCreateOpportunityForPenz(v);
                  if (v.trim().toLowerCase() !== "yes") {
                    setCreatePenzCategories([]);
                    setCreatePenzInvite("");
                  }
                }}
              >
                <option value="">(select)</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            {createOpportunityForPenz.trim().toLowerCase() === "yes" && (
              <>
                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">PENZ categories</label>
                  <details className="mt-1 relative">
                    <summary className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm hover:border-slate-400 dark:hover:border-slate-500 transition-colors cursor-pointer">
                      {createPenzCategories.length ? createPenzCategories.join(", ") : "Select one or more…"}
                    </summary>
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-lg">
                      <div className="grid gap-2">
                        {PENZ_CATEGORY_OPTIONS.map((opt) => (
                          <label key={opt} className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                            <input
                              type="checkbox"
                              checked={createPenzCategories.includes(opt)}
                              onChange={() => {
                                if (opt === "All") {
                                  setCreatePenzCategories((prev) =>
                                    prev.includes("All") ? [] : Array.from(PENZ_CATEGORY_OPTIONS)
                                  );
                                } else {
                                  toggleMultiSelect(setCreatePenzCategories, opt);
                                  setCreatePenzCategories((prev) => prev.filter((x) => x !== "All"));
                                }
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </details>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Next step invite who from PENZ?</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                    value={createPenzInvite}
                    onChange={(e) => setCreatePenzInvite(e.target.value)}
                    placeholder="Name(s)…"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Stage</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
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
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Expected close date</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                type="date"
                value={createCloseDate}
                onChange={(e) => setCreateCloseDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Rolling 12 MTH value</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                type="number"
                min={0}
                step="0.01"
                value={createRolling12mValue}
                onChange={(e) => setCreateRolling12mValue(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Probability %</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                type="number"
                min={0}
                max={100}
                step={1}
                value={createProbability}
                onChange={(e) => setCreateProbability(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Next action</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                value={createNextAction}
                onChange={(e) => setCreateNextAction(e.target.value)}
                placeholder="e.g. Book site visit"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Next action due</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                type="date"
                value={createNextActionDue}
                onChange={(e) => setCreateNextActionDue(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notes</label>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
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
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all shadow-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* KANBAN BOARD */}
      {viewMode === "board" && (
        <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="text-sm text-slate-700 dark:text-slate-300 mb-4 font-medium">
            Drag a card into a new column to update the stage.
          </div>

          <div className="overflow-x-auto">
            <div className="flex gap-3 min-w-[1100px]">
              {STAGES.map((stage) => {
                const list = kanban.byStage[stage] ?? [];
                const total = kanban.totals[stage] ?? 0;

                return (
                  <div key={stage} className="w-[320px] flex-shrink-0">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{stage}</div>
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
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
                          const signals = getOpportunitySignals(o);
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

                            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
                                            {getBranchName(o)} · {(o.probability ?? 0) + "%"}
                                            {o.sales_person ? ` · ${o.sales_person}` : ""}
                                            {o.battery_solution ? ` · ${o.battery_solution}` : ""}
                                          </div>

                            {signals.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {signals.map((s) => (
                                  <span
                                    key={s}
                                    className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-800 dark:text-slate-100"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="text-xs font-semibold mt-2 text-slate-900 dark:text-slate-100">
                              Est. value: ${(estValue / 1000).toFixed(1)}k
                            </div>

                            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
                              Close: {formatNZDate(o.close_date) || "—"}
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
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 p-2">
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
        <div className="overflow-x-auto rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Account</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Branch</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Sales person</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Battery Solution</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Signals</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Stage</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Close</th>
                <th className="text-right p-3 font-semibold text-slate-800 dark:text-slate-200">12 MTH Value</th>
                <th className="text-right p-3 font-semibold text-slate-800 dark:text-slate-200">Prob</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Next Action</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Next Due</th>
                <th className="text-left p-3 font-semibold text-slate-800 dark:text-slate-200">Edit</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((o) => (
                <tr key={o.id} className="border-t border-slate-200 dark:border-slate-700 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 transition-colors">
                  <td className="p-3">{getAccountName(o)}</td>
                  <td className="p-3">{getBranchName(o)}</td>

                  <td className="p-3">{o.sales_person ?? "—"}</td>

                  <td className="p-3">{o.battery_solution ?? "—"}</td>

                  <td className="p-3">
                    {(() => {
                      const signals = getOpportunitySignals(o);
                      if (!signals.length) return "—";
                      return (
                        <div className="flex flex-wrap gap-1">
                          {signals.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-800 dark:text-slate-100"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </td>

                  <td className="p-3">
                    <select
                      className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
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
                      <span className="ml-2 text-xs font-medium text-slate-600 dark:text-slate-400">saving…</span>
                    )}
                  </td>

                  <td className="p-3">{formatNZDate(o.close_date)}</td>
                  <td className="p-3 text-right">
                    {Number(o.rolling_12m_value ?? 0).toLocaleString()}
                  </td>
                  <td className="p-3 text-right">{o.probability ?? 0}%</td>
                  <td className="p-3">{o.next_action ?? "—"}</td>
                  <td className="p-3">{formatNZDate(o.next_action_due)}</td>

                  <td className="p-3">
                    <button
                      className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all shadow-sm"
                      onClick={() => openEdit(o)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}

              {!filteredRows.length && (
                <tr>
                  <td className="p-3" colSpan={12}>
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
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 shadow-lg text-slate-950 dark:text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit opportunity</h2>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{editAccountName}</p>
              </div>

              <button
                onClick={() => setEditOpen(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all shadow-sm"
              >
                Close
              </button>
            </div>

            <form onSubmit={saveEdit} className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Branch</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
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

              {ownerFieldAvailable && (
                <div>
                  <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Owner</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors appearance-none cursor-pointer"
                    value={
                      !editOwnerUserId.trim()
                        ? ""
                        : editOwnerUserId.trim() === currentUserId
                          ? "mine"
                          : "other"
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "mine") {
                        if (currentUserId) setEditOwnerUserId(currentUserId);
                      } else if (v === "") {
                        setEditOwnerUserId("");
                      }
                    }}
                    disabled={!currentUserId}
                  >
                    <option value="">Unassigned</option>
                    <option value="mine">Me</option>
                    {editOwnerUserId.trim() && editOwnerUserId.trim() !== currentUserId && (
                      <option value="other" disabled>
                        Other user (read-only)
                      </option>
                    )}
                  </select>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Used by the “My deals” filter.</p>
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Sales person</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                  value={editSalesPerson}
                  onChange={(e) => setEditSalesPerson(e.target.value)}
                  list="sales-person-list-edit"
                  placeholder="e.g. Sam Taylor"
                />
                <datalist id="sales-person-list-edit">
                  {salesPeople.map((sp) => (
                    <option key={sp} value={sp} />
                  ))}
                </datalist>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Used for filtering (optional).</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Battery Solution</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors appearance-none cursor-pointer"
                  value={editBatterySolution}
                  onChange={(e) => {
                    const next = e.target.value;
                    setEditBatterySolution(next);
                  }}
                >
                  <option value="">(optional)</option>
                  {BATTERY_SOLUTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">How we win?</label>
                <details className="mt-1 relative">
                  <summary className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm hover:border-slate-400 dark:hover:border-slate-500 transition-colors cursor-pointer">
                    {editHowWeWin.length ? editHowWeWin.join(", ") : "Select one or more…"}
                  </summary>
                  <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-lg">
                    <div className="grid gap-2">
                      {HOW_WE_WIN_OPTIONS.map((opt) => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={editHowWeWin.includes(opt)}
                            onChange={() => toggleMultiSelect(setEditHowWeWin, opt)}
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </details>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">OPPORTUNITY FOR BNT?</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                  value={editOpportunityForBnt}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditOpportunityForBnt(v);
                    if (v.trim().toLowerCase() !== "yes") {
                      setEditBntCategories([]);
                      setEditBntInvite("");
                    }
                  }}
                >
                  <option value="">(select)</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              {editOpportunityForBnt.trim().toLowerCase() === "yes" && (
                <>
                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">BNT categories</label>
                    <details className="mt-1 relative">
                      <summary className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm hover:border-slate-400 dark:hover:border-slate-500 transition-colors cursor-pointer">
                        {editBntCategories.length ? editBntCategories.join(", ") : "Select one or more…"}
                      </summary>
                      <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-lg">
                        <div className="grid gap-2">
                          {BNT_CATEGORY_OPTIONS.map((opt) => (
                            <label key={opt} className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                              <input
                                type="checkbox"
                                checked={editBntCategories.includes(opt)}
                                onChange={() => {
                                  if (opt === "All") {
                                    setEditBntCategories((prev) =>
                                      prev.includes("All") ? [] : Array.from(BNT_CATEGORY_OPTIONS)
                                    );
                                  } else {
                                    toggleMultiSelect(setEditBntCategories, opt);
                                    setEditBntCategories((prev) => prev.filter((x) => x !== "All"));
                                  }
                                }}
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </details>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Next step invite who from BNT?</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                      value={editBntInvite}
                      onChange={(e) => setEditBntInvite(e.target.value)}
                      placeholder="Name(s)…"
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">OPPORTUNITY FOR PENZ?</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                  value={editOpportunityForPenz}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditOpportunityForPenz(v);
                    if (v.trim().toLowerCase() !== "yes") {
                      setEditPenzCategories([]);
                      setEditPenzInvite("");
                    }
                  }}
                >
                  <option value="">(select)</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              {editOpportunityForPenz.trim().toLowerCase() === "yes" && (
                <>
                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">PENZ categories</label>
                    <details className="mt-1 relative">
                      <summary className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm hover:border-slate-400 dark:hover:border-slate-500 transition-colors cursor-pointer">
                        {editPenzCategories.length ? editPenzCategories.join(", ") : "Select one or more…"}
                      </summary>
                      <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-lg">
                        <div className="grid gap-2">
                          {PENZ_CATEGORY_OPTIONS.map((opt) => (
                            <label key={opt} className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                              <input
                                type="checkbox"
                                checked={editPenzCategories.includes(opt)}
                                onChange={() => {
                                  if (opt === "All") {
                                    setEditPenzCategories((prev) =>
                                      prev.includes("All") ? [] : Array.from(PENZ_CATEGORY_OPTIONS)
                                    );
                                  } else {
                                    toggleMultiSelect(setEditPenzCategories, opt);
                                    setEditPenzCategories((prev) => prev.filter((x) => x !== "All"));
                                  }
                                }}
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </details>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Next step invite who from PENZ?</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                      value={editPenzInvite}
                      onChange={(e) => setEditPenzInvite(e.target.value)}
                      placeholder="Name(s)…"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Stage</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
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
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Expected close date</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                  type="date"
                  value={editCloseDate}
                  onChange={(e) => setEditCloseDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Rolling 12 MTH value</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                  type="number"
                  min={0}
                  step="0.01"
                  value={editRolling12mValue}
                  onChange={(e) => setEditRolling12mValue(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Probability %</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={editProbability}
                  onChange={(e) => setEditProbability(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Next action due</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                  type="date"
                  value={editNextActionDue}
                  onChange={(e) => setEditNextActionDue(e.target.value)}
                />
              </div>

              <div className="md:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Next action status</div>
                    {editNextActionCompletedAt.trim() ? (
                      <div className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                        <span className="inline-flex items-center rounded-full bg-green-200 text-green-900 px-2 py-0.5 text-xs font-semibold">
                          Completed
                        </span>
                        <span className="ml-2">{formatNZDateTime(editNextActionCompletedAt)}</span>
                      </div>
                    ) : editNextAction.trim() || editNextActionDue.trim() ? (
                      <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">Not completed yet</div>
                    ) : (
                      <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">No next action set</div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={
                      savingEdit ||
                      nextActionSavingId === editId ||
                      Boolean(editNextActionCompletedAt.trim()) ||
                      (!editNextAction.trim() && !editNextActionDue.trim())
                    }
                    onClick={() => markNextActionDone(editId, { note: editCompletionNote })}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all shadow-sm disabled:opacity-60"
                  >
                    {nextActionSavingId === editId ? "Saving…" : editNextActionCompletedAt.trim() ? "Done" : "Mark done"}
                  </button>
                </div>

                {!editNextActionCompletedAt.trim() && (editNextAction.trim() || editNextActionDue.trim()) && (
                  <div className="mt-3">
                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Completion note (optional)
                    </label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                      value={editCompletionNote}
                      onChange={(e) => setEditCompletionNote(e.target.value)}
                      placeholder="e.g. Spoke with fleet manager; confirmed CCA requirement"
                      maxLength={500}
                    />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      savingEdit ||
                      nextActionSavingId === editId ||
                      Boolean(editNextActionCompletedAt.trim())
                    }
                    onClick={() => snoozeNextAction(editId, 1)}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all shadow-sm disabled:opacity-60"
                  >
                    Snooze 1d
                  </button>
                  <button
                    type="button"
                    disabled={
                      savingEdit ||
                      nextActionSavingId === editId ||
                      Boolean(editNextActionCompletedAt.trim())
                    }
                    onClick={() => snoozeNextAction(editId, 7)}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all shadow-sm disabled:opacity-60"
                  >
                    Snooze 7d
                  </button>
                  <button
                    type="button"
                    disabled={
                      savingEdit ||
                      nextActionSavingId === editId ||
                      !Boolean(editNextActionCompletedAt.trim())
                    }
                    onClick={() => reopenNextAction(editId)}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all shadow-sm disabled:opacity-60"
                  >
                    Reopen
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Next action</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                  value={editNextAction}
                  onChange={(e) => setEditNextAction(e.target.value)}
                  placeholder="e.g. Call fleet manager"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notes</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
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
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all shadow-sm"
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
